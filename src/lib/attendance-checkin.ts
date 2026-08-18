// Shared core for both attendance ingestion paths:
//   - src/app/api/attendance/checkin/route.ts (external device/agent bridge, API-key authenticated)
//   - src/app/actions/attendance-devices.ts kioskCheckInAction (browser kiosk, session authenticated)
// Not a "use server" action itself — a plain function both call into, so the
// actual attendance-writing logic exists exactly once.

import { query } from "./db";

export interface CheckInResult {
  error?: string;
  studentName?: string;
  className?: string;
  sectionName?: string;
  status?: "Present" | "Late" | "Checked Out" | "Half Day";
  time?: string;
}

// Marks the school day "started" up to this hour before a scan counts as Late —
// a device check-in has no teacher to judge lateness, so it's time-based.
const LATE_AFTER_HOUR = 9;

// Resolves a student by their student-card UID — errors here mean "this
// input isn't a recognized card", which callers (kioskCheckInAction) use to
// decide whether to fall through and try the next identifier type (roll
// number) instead of surfacing the error immediately.
export async function resolveStudentByCardUid(cardUid: string): Promise<{ error: string } | { studentId: string; name: string }> {
  const trimmed = cardUid.trim();
  if (!trimmed) return { error: "Empty card ID." };
  const cardRes = await query(
    `SELECT sic.student_id, s.name, s.status FROM student_id_cards sic
     JOIN students s ON s.id = sic.student_id WHERE sic.card_uid=$1`,
    [trimmed]
  );
  if (cardRes.rows.length === 0) return { error: "Card not recognized." };
  const { student_id, name, status } = cardRes.rows[0];
  if (status !== "Active") return { error: `${name}'s enrollment is not active.` };
  return { studentId: student_id, name };
}

// Resolves a student by their roll number (enrollments.roll_number) — the
// kiosk fallback for a student with no physical ID card yet. Scoped to
// branchId when given (an Admin/Teacher operating the kiosk for their own
// branch) since roll numbers are only unique within a class/section, not
// school-wide across branches.
async function resolveStudentByRollNumber(rollNumber: string, branchId: string | null): Promise<{ error: string } | { studentId: string; name: string }> {
  const trimmed = rollNumber.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return { error: "Not a valid roll number." };
  const params: (string | number)[] = [parseInt(trimmed, 10)];
  let sql = `SELECT e.student_id, s.name, s.status FROM enrollments e
             JOIN students s ON s.id = e.student_id
             WHERE e.roll_number=$1 AND e.status='Active'`;
  if (branchId) { params.push(branchId); sql += ` AND s.branch_id=$${params.length}`; }
  sql += ` ORDER BY e.updated_at DESC NULLS LAST LIMIT 1`;
  const res = await query(sql, params);
  if (res.rows.length === 0) return { error: "Roll number not recognized." };
  const { student_id, name, status } = res.rows[0];
  if (status !== "Active") return { error: `${name}'s enrollment is not active.` };
  return { studentId: student_id, name };
}

async function markStudentCheckIn(studentId: string, name: string, source: "device" | "kiosk"): Promise<CheckInResult> {
  const enrollRes = await query(
    `SELECT e.class_id, e.section_id, e.academic_year_id, c.name as class_name, sec.name as section_name
     FROM enrollments e JOIN classes c ON c.id = e.class_id LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE e.student_id=$1 AND e.status='Active' ORDER BY e.updated_at DESC NULLS LAST LIMIT 1`,
    [studentId]
  );
  if (enrollRes.rows.length === 0) return { error: `${name} has no active class enrollment.` };
  const { class_id, section_id, academic_year_id, class_name, section_name } = enrollRes.rows[0];
  const student_id = studentId;

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const attendanceStatus: "Present" | "Late" = now.getHours() >= LATE_AFTER_HOUR ? "Late" : "Present";

  let sessionRes = await query(
    `SELECT id FROM attendance_sessions WHERE class_id=$1 AND section_id=$2 AND date=$3`,
    [class_id, section_id, today]
  );
  let sessionId: string;
  if (sessionRes.rows.length > 0) {
    sessionId = sessionRes.rows[0].id;
  } else {
    sessionId = `as-dev-${Date.now()}`;
    await query(
      `INSERT INTO attendance_sessions (id, academic_year_id, class_id, section_id, date, taken_by, status, source)
       VALUES ($1,$2,$3,$4,$5,$6,'Completed',$7)`,
      [sessionId, academic_year_id, class_id, section_id, today, source === "device" ? "Device Scanner" : "Kiosk", source]
    );
  }

  const existing = await query(
    `SELECT id FROM attendance_records WHERE session_id=$1 AND student_id=$2`,
    [sessionId, student_id]
  );
  if (existing.rows.length > 0) {
    return { error: `${name} already checked in today.` };
  }

  const recordId = `ar-dev-${Date.now()}`;
  await query(
    `INSERT INTO attendance_records (id, session_id, student_id, status, source, checked_in_at)
     VALUES ($1,$2,$3,$4,$5,NOW())`,
    [recordId, sessionId, student_id, attendanceStatus, source]
  );

  return {
    studentName: name, className: class_name, sectionName: section_name || "",
    status: attendanceStatus, time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
}

export async function checkInByCardUid(cardUid: string, source: "device" | "kiosk"): Promise<CheckInResult> {
  const resolved = await resolveStudentByCardUid(cardUid);
  if ("error" in resolved) {
    return { error: resolved.error === "Card not recognized." ? "Card not recognized. Ask the office to enroll it." : resolved.error };
  }
  return markStudentCheckIn(resolved.studentId, resolved.name, source);
}

// Kiosk fallback for students without a physical card yet — type a roll
// number instead of tapping/scanning. Same attendance-marking path as the
// card flow (markStudentCheckIn), just a different way to identify who's
// checking in.
export async function checkInByRollNumber(rollNumber: string, source: "device" | "kiosk", branchId: string | null = null): Promise<CheckInResult> {
  const resolved = await resolveStudentByRollNumber(rollNumber, branchId);
  if ("error" in resolved) return { error: resolved.error };
  return markStudentCheckIn(resolved.studentId, resolved.name, source);
}

export interface StaffCheckInResult {
  error?: string;
  staffName?: string;
  status?: "Present" | "Late" | "Checked Out" | "Half Day";
  time?: string;
}

// Simpler than the student path — no class/section/session indirection,
// just one row per (user_id, date). Same late-cutoff convention. A SECOND
// same-day scan from the same badge is treated as checkout (a real gate
// reader is tapped in and out), which can flip today's status to "Half Day"
// and trigger the substitution engine for the teacher's remaining periods.
export async function checkInByStaffCardUid(cardUid: string, source: "device" | "kiosk"): Promise<StaffCheckInResult> {
  const trimmed = cardUid.trim();
  if (!trimmed) return { error: "Empty card ID." };

  const cardRes = await query(
    `SELECT sic.user_id, u.name FROM staff_id_cards sic JOIN users u ON u.id = sic.user_id WHERE sic.card_uid=$1`,
    [trimmed]
  );
  if (cardRes.rows.length === 0) return { error: "Card not recognized. Ask the office to enroll it." };
  const { user_id, name } = cardRes.rows[0];

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const attendanceStatus: "Present" | "Late" = now.getHours() >= LATE_AFTER_HOUR ? "Late" : "Present";

  const existing = await query(`SELECT id, check_in_time, check_out_time FROM staff_attendance WHERE user_id=$1 AND date=$2`, [user_id, today]);
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (row.check_in_time && !row.check_out_time) {
      const checkoutHM = now.toTimeString().slice(0, 5);
      const yearRes = await query("SELECT id FROM academic_years WHERE is_active=true LIMIT 1");
      let isHalfDay = false;
      if (yearRes.rows.length > 0) {
        const lastPeriod = await query(
          "SELECT end_time FROM period_slots WHERE academic_year_id=$1 AND is_break=false ORDER BY period_number DESC LIMIT 1",
          [yearRes.rows[0].id]
        );
        if (lastPeriod.rows.length > 0) isHalfDay = checkoutHM < lastPeriod.rows[0].end_time;
      }
      const newStatus = isHalfDay ? "Half Day" : null;
      await query(
        `UPDATE staff_attendance SET check_out_time=NOW()${newStatus ? ", status=$2" : ""} WHERE id=$1`,
        newStatus ? [row.id, newStatus] : [row.id]
      );
      if (isHalfDay) {
        const { generateSubstitutionsForTeacherDateDB } = await import("@/app/actions/substitutions");
        await generateSubstitutionsForTeacherDateDB(user_id, today, "half_day", checkoutHM);
      }
      return { staffName: name, status: isHalfDay ? "Half Day" : "Checked Out", time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) };
    }
    return { error: `${name} already checked in and out today.` };
  }

  const recordId = `sa-dev-${Date.now()}`;
  await query(
    `INSERT INTO staff_attendance (id, user_id, date, status, source, check_in_time)
     VALUES ($1,$2,$3,$4,$5,NOW())`,
    [recordId, user_id, today, attendanceStatus, source]
  );

  return { staffName: name, status: attendanceStatus, time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) };
}
