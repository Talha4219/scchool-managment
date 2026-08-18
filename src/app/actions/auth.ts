"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { query } from "@/lib/db";
import { initializeDatabase } from "@/lib/db-init";
import { encrypt, decrypt, type SessionPayload } from "@/lib/auth";
import { logServerError } from "@/lib/error-log";
import { isEmailConfigured, sendEmail } from "@/lib/email";

let _authDbInitialized = false;
async function ensureDbInit() {
  if (_authDbInitialized) return;
  // Only mark done on success — flipping this before initializeDatabase()
  // resolves meant a single transient failure (e.g. a DDL ordering bug)
  // permanently skipped init for the rest of the process's life, so every
  // request after the first kept failing with "column does not exist"
  // instead of the schema ever getting a chance to finish creating itself.
  await initializeDatabase();
  _authDbInitialized = true;
}

const SESSION_COOKIE = "sc_session";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between requests per account

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// A precomputed bcrypt hash of a value nobody will ever type, compared against
// on a nonexistent-email lookup so that path costs about the same as a real
// one (bcrypt.compare dominates the timing either way) — keeps response time
// from being a cheap side-channel for enumerating registered emails.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8i1nRcMDZ0ONtRxJ7mYyw4XHhVMy1u";

function formatMinutes(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export async function login(email: string, password: string): Promise<{ error?: string; role?: string }> {
  try {
    await ensureDbInit();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      return { error: "Invalid email or password." };
    }

    const statusRes = await query(
      'SELECT status, failed_login_attempts, locked_until, branch_id FROM users WHERE id=$1',
      [user.id]
    );
    const row = statusRes.rows[0];
    const status = row?.status ?? 'ACTIVE';
    const failedAttempts: number = row?.failed_login_attempts ?? 0;
    const lockedUntil: Date | null = row?.locked_until ? new Date(row.locked_until) : null;
    const branchId: string | null = row?.branch_id ?? null;

    // Gate on lockout before ever touching the password — this is the whole
    // point: once locked, further guesses are refused outright, not just
    // rejected after a wasted bcrypt.compare.
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      return { error: `Too many failed attempts. Try again in ${formatMinutes(lockedUntil.getTime() - Date.now())}.` };
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      const attempts = failedAttempts + 1;
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const until = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await query('UPDATE users SET failed_login_attempts=0, locked_until=$1 WHERE id=$2', [until, user.id]);
        return { error: `Too many failed attempts. Your account is locked for ${formatMinutes(LOCKOUT_DURATION_MS)}.` };
      }
      await query('UPDATE users SET failed_login_attempts=$1 WHERE id=$2', [attempts, user.id]);
      return { error: "Invalid email or password." };
    }

    // Correct password: clear any accumulated attempts/lock before proceeding.
    if (failedAttempts > 0 || lockedUntil) {
      await query('UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE id=$1', [user.id]);
    }

    if (status === 'PENDING') {
      return { error: "Your account is pending admin approval. You will be notified once approved." };
    }

    if (status === 'INACTIVE') {
      return { error: "This account has been deactivated. Contact the school office if you believe this is a mistake." };
    }

    const payload: SessionPayload = { userId: user.id, name: user.name, email: user.email, role: user.role as SessionPayload['role'], branchId };
    const token = await encrypt(payload);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return { role: user.role };
  } catch (err) {
    logServerError("auth", "Login error:", err);
    return { error: "An error occurred. Please try again." };
  }
}

// Self-signup: account created as PENDING, no session set
export async function register(
  name: string,
  email: string,
  password: string,
  role: "ADMIN" | "TEACHER" | "STUDENT"
): Promise<{ error?: string; pending?: boolean }> {
  try {
    await ensureDbInit();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "An account with this email already exists." };

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, passwordHash, role } });
    await query('UPDATE users SET status=$1 WHERE id=$2', ['PENDING', user.id]);

    return { pending: true };
  } catch (err) {
    logServerError("auth", "Register error:", err);
    return { error: "An error occurred. Please try again." };
  }
}

// Teacher self-signup: PENDING, no session set
export async function registerTeacher(
  name: string,
  email: string,
  password: string,
  profile: {
    phone: string;
    cnic: string;
    specialization: string;
    qualification: string;
    experienceYears: number;
    joiningDate: string;
    address: string;
    profilePhoto: string | null;
    degreePhoto: string | null;
  }
): Promise<{ error?: string; pending?: boolean }> {
  try {
    await ensureDbInit();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "An account with this email already exists." };

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, passwordHash, role: "TEACHER" } });
    await query('UPDATE users SET status=$1 WHERE id=$2', ['PENDING', user.id]);

    const id = `tp_${Date.now()}`;
    await query(
      `INSERT INTO teacher_profiles (id, user_id, phone, cnic, specialization, qualification, experience_years, joining_date, address, profile_photo, degree_photo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, user.id, profile.phone, profile.cnic, profile.specialization, profile.qualification,
       profile.experienceYears, profile.joiningDate, profile.address,
       profile.profilePhoto || null, profile.degreePhoto || null]
    );

    return { pending: true };
  } catch (err) {
    logServerError("auth", "Register teacher error:", err);
    return { error: "An error occurred. Please try again." };
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Step 1 of self-service reset: issue a single-use token for the account.
// Always returns a generic outcome to the caller — the UI never states
// outright whether the email is registered. When SMTP is configured
// (isEmailConfigured()) the link is emailed directly and never returned to
// the caller — the proper flow. Until a school sets SMTP_* env vars, the raw
// link is handed back in `resetLink` instead, so an admin/teacher can still
// relay it manually rather than the feature being fully absent.
export async function requestPasswordResetAction(email: string): Promise<{ message: string; resetLink?: string }> {
  const generic = { message: "If an account exists for that email, a password reset link has been generated." };
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return generic;

    const recent = await query(
      `SELECT created_at FROM password_reset_tokens WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );
    if (recent.rows.length > 0) {
      const elapsed = Date.now() - new Date(recent.rows[0].created_at).getTime();
      if (elapsed < RESET_RESEND_COOLDOWN_MS) {
        return { message: "A reset link was already generated recently — please wait a minute before requesting another." };
      }
    }

    const token = randomBytes(32).toString("hex");
    const id = `prt_${Date.now()}_${randomBytes(4).toString("hex")}`;
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ($1,$2,$3,$4)`,
      [id, user.id, hashToken(token), expiresAt]
    );

    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetLink = `/reset-password?token=${token}`;

    if (isEmailConfigured()) {
      const result = await sendEmail({
        to: user.email,
        subject: "Reset your password",
        html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password. This link expires in 1 hour and can only be used once.</p><p><a href="${origin}${resetLink}">${origin}${resetLink}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
      });
      if (result.error) {
        logServerError("auth", "requestPasswordResetAction: email send failed, falling back to link", result.error);
        return { ...generic, resetLink };
      }
      return generic;
    }

    return { ...generic, resetLink };
  } catch (err) {
    logServerError("auth", "requestPasswordResetAction error:", err);
    return generic;
  }
}

export async function resetPasswordWithTokenAction(token: string, newPassword: string): Promise<{ error?: string }> {
  if (!token) return { error: "Missing reset token." };
  if (!newPassword || newPassword.length < 8) return { error: "Password must be at least 8 characters." };
  try {
    const tokenHash = hashToken(token);
    const res = await query(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash=$1`,
      [tokenHash]
    );
    const row = res.rows[0];
    if (!row) return { error: "This reset link is invalid. Please request a new one." };
    if (row.used_at) return { error: "This reset link has already been used. Please request a new one." };
    if (new Date(row.expires_at).getTime() < Date.now()) return { error: "This reset link has expired. Please request a new one." };

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: row.user_id }, data: { passwordHash } });
    await query(`UPDATE password_reset_tokens SET used_at=NOW() WHERE id=$1`, [row.id]);
    // Invalidate any other outstanding links for this account.
    await query(`UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL`, [row.user_id]);

    return {};
  } catch (err) {
    logServerError("auth", "resetPasswordWithTokenAction error:", err);
    return { error: "Failed to reset password. Please try again." };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(OWNER_VIEW_BRANCH_COOKIE);
  redirect("/login");
}

const OWNER_VIEW_BRANCH_COOKIE = "sc_owner_view_branch";

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = await decrypt(token);
    if (!session) return null;
    // An OWNER viewing a specific branch (global header selector) gets that
    // branch stamped onto branchId for the rest of this request — every
    // scopeBranch() call site (src/lib/auth-scope.ts) then scopes OWNER
    // exactly like any other role, with no per-call-site changes needed.
    if (session.role === "OWNER") {
      const viewBranchId = cookieStore.get(OWNER_VIEW_BRANCH_COOKIE)?.value;
      if (viewBranchId) return { ...session, branchId: viewBranchId };
    }
    return session;
  } catch {
    return null;
  }
}

// Sets/clears the branch the Owner is currently "viewing as" — scopes every
// branch-aware query (students, fees, HR, attendance, everything) to that
// branch, app-wide, until cleared. OWNER-only; anyone else's selection is a
// no-op since scopeBranch() only reads branchId specially for OWNER.
export async function setOwnerViewBranchAction(branchId: string | null): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "OWNER") return { error: "Only the school owner can switch branch view." };
  const cookieStore = await cookies();
  if (branchId) {
    cookieStore.set(OWNER_VIEW_BRANCH_COOKIE, branchId, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    });
  } else {
    cookieStore.delete(OWNER_VIEW_BRANCH_COOKIE);
  }
  return {};
}

export async function getOwnerViewBranchAction(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(OWNER_VIEW_BRANCH_COOKIE)?.value ?? null;
}
