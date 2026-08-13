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
  status?: "Present" | "Late";
  time?: string;
}

// Marks the school day "started" up to this hour before a scan counts as Late —
// a device check-in has no teacher to judge lateness, so it's time-based.
const LATE_AFTER_HOUR = 9;

export async function checkInByCardUid(cardUid: string, source: "device" | "kiosk"): Promise<CheckInResult> {
  const trimmed = cardUid.trim();
  if (!trimmed) return { error: "Empty card ID." };

  const cardRes = await query(
    `SELECT sic.student_id, s.name, s.status FROM student_id_cards sic
     JOIN students s ON s.id = sic.student_id WHERE sic.card_uid=$1`,
    [trimmed]
  );
  if (cardRes.rows.length === 0) return { error: "Card not recognized. Ask the office to enroll it." };
  const { student_id, name, status: studentStatus } = cardRes.rows[0];
  if (studentStatus !== "Active") return { error: `${name}'s enrollment is not active.` };

  const enrollRes = await query(
    `SELECT e.class_id, e.section_id, e.academic_year_id, c.name as class_name, sec.name as section_name
     FROM enrollments e JOIN classes c ON c.id = e.class_id LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE e.student_id=$1 AND e.status='Active' ORDER BY e.updated_at DESC NULLS LAST LIMIT 1`,
    [student_id]
  );
  if (enrollRes.rows.length === 0) return { error: `${name} has no active class enrollment.` };
  const { class_id, section_id, academic_year_id, class_name, section_name } = enrollRes.rows[0];

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
