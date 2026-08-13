"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { query } from "@/lib/db";
import { initializeDatabase } from "@/lib/db-init";
import { encrypt, decrypt, type SessionPayload } from "@/lib/auth";

let _authDbInitialized = false;
async function ensureDbInit() {
  if (_authDbInitialized) return;
  _authDbInitialized = true;
  await initializeDatabase();
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
      'SELECT status, failed_login_attempts, locked_until FROM users WHERE id=$1',
      [user.id]
    );
    const row = statusRes.rows[0];
    const status = row?.status ?? 'ACTIVE';
    const failedAttempts: number = row?.failed_login_attempts ?? 0;
    const lockedUntil: Date | null = row?.locked_until ? new Date(row.locked_until) : null;

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

    const payload: SessionPayload = { userId: user.id, name: user.name, email: user.email, role: user.role };
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
    console.error("Login error:", err);
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
    console.error("Register error:", err);
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
    console.error("Register teacher error:", err);
    return { error: "An error occurred. Please try again." };
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Step 1 of self-service reset: issue a single-use token for the account.
// Always returns a generic outcome to the caller — the UI never states
// outright whether the email is registered — but since this deployment has
// no email transport wired up yet, the raw link is handed back in `resetLink`
// so an admin/teacher can be sent it directly. Once SMTP is configured this
// function is the one place to change: email the link instead of returning it.
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

    return { ...generic, resetLink: `/reset-password?token=${token}` };
  } catch (err) {
    console.error("requestPasswordResetAction error:", err);
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
    console.error("resetPasswordWithTokenAction error:", err);
    return { error: "Failed to reset password. Please try again." };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await decrypt(token);
  } catch {
    return null;
  }
}
