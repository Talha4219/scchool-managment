"use server";

// Staff (teacher/employee) attendance — manual admin marking + biometric/RFID
// device check-in, sharing the same attendance_device_keys and
// /api/attendance/checkin endpoint the student system already uses. Mirrors
// academic-core.ts's auth/error conventions exactly (requireRole/requireSession,
// try/catch swallow-to-empty, nanoid-prefixed IDs, logAudit on mutations).

import { query, checkDbConnection } from "@/lib/db";
import { getSession } from "./auth";
import { logAudit } from "@/lib/audit";

type Role = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'EMPLOYEE';

async function requireRole(...roles: Role[]): Promise<{ session: NonNullable<Awaited<ReturnType<typeof getSession>>> } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (!roles.includes(session.role as Role)) return { error: 'You are not authorized to perform this action.' };
  return { session };
}

async function requireSession(): Promise<{ session: NonNullable<Awaited<ReturnType<typeof getSession>>> } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  return { session };
}

export interface StaffAttendanceRecord {
  id: string; userId: number; userName?: string; date: string;
  status: 'Present' | 'Absent' | 'Late' | 'Leave' | 'Half Day';
  checkInTime: string | null; checkOutTime: string | null;
  source: string; markedBy: string | null; remarks: string | null;
}

function mapRow(r: any): StaffAttendanceRecord {
  return {
    id: r.id, userId: r.user_id, userName: r.user_name, date: r.date, status: r.status,
    checkInTime: r.check_in_time, checkOutTime: r.check_out_time,
    source: r.source, markedBy: r.marked_by, remarks: r.remarks,
  };
}

// Non-admin callers are always forced to their own userId — a teacher can
// never read a colleague's attendance through this action, matching the
// payslip self-service pattern (fetchPayslipsDB) from the HR/Payroll work.
export async function fetchStaffAttendanceDB(date?: string, userId?: number): Promise<StaffAttendanceRecord[]> {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  const scopedUserId = auth.session.role === 'ADMIN' ? userId : auth.session.userId;
  try {
    let sql = `SELECT sa.*, u.name as user_name FROM staff_attendance sa JOIN users u ON u.id = sa.user_id WHERE 1=1`;
    const params: any[] = [];
    if (date) { params.push(date); sql += ` AND sa.date=$${params.length}`; }
    if (scopedUserId !== undefined) { params.push(scopedUserId); sql += ` AND sa.user_id=$${params.length}`; }
    sql += ` ORDER BY u.name`;
    const res = await query(sql, params);
    return res.rows.map(mapRow);
  } catch { return []; }
}

export async function markStaffAttendanceDB(records: { userId: number; date: string; status: string; remarks?: string }[]): Promise<{ error?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  try {
    const { nanoid } = await import("nanoid");
    const { generateSubstitutionsForTeacherDateDB, clearAutoSubstitutionsForTeacherDateDB } = await import("./substitutions");
    for (const r of records) {
      const existing = await query("SELECT id, status FROM staff_attendance WHERE user_id=$1 AND date=$2", [r.userId, r.date]);
      const previousStatus = existing.rows[0]?.status;
      if (existing.rows.length > 0) {
        await query("UPDATE staff_attendance SET status=$1, remarks=$2, marked_by=$3 WHERE id=$4", [r.status, r.remarks || null, auth.session.name, existing.rows[0].id]);
      } else {
        const id = `sa-${nanoid(8)}`;
        await query(
          "INSERT INTO staff_attendance (id, user_id, date, status, remarks, marked_by, source) VALUES ($1,$2,$3,$4,$5,$6,'manual')",
          [id, r.userId, r.date, r.status, r.remarks || null, auth.session.name]
        );
      }

      // Whole-day substitution trigger. A correction back to Present clears
      // only the auto-generated rows for that teacher/date — a manual_override
      // an admin already made stays put, matching this session's established
      // "don't clobber an explicit admin choice" convention.
      if (r.status === 'Absent' || r.status === 'Leave') {
        await generateSubstitutionsForTeacherDateDB(r.userId, r.date, r.status === 'Absent' ? 'absent' : 'leave');
      } else if (previousStatus === 'Absent' || previousStatus === 'Leave') {
        await clearAutoSubstitutionsForTeacherDateDB(r.userId, r.date);
      }
    }
    await logAudit({
      actor: { userId: auth.session.userId, name: auth.session.name, role: auth.session.role },
      action: 'UPDATE', entityType: 'staff_attendance', entityId: records[0]?.date || '',
      summary: `Marked staff attendance for ${records.length} staff member(s) on ${records[0]?.date}`,
      after: Object.fromEntries(records.map(r => [r.userId, r.status])),
    });
    return {};
  } catch { return { error: 'Failed to save staff attendance.' }; }
}

// Admin manual checkout (biometric second-scan checkout lives in attendance-checkin.ts,
// which calls the same substitution engine directly to avoid a circular import here).
// Flips status to 'Half Day' when the checkout lands early enough that at least one
// full period is still left on the school day's bell schedule — a checkout right at
// the end of the last period is just a normal Present day, not a half day.
export async function checkOutStaffDB(userId: number, date: string, checkoutTime?: string): Promise<{ error?: string; halfDay?: boolean }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  try {
    const existing = await query("SELECT id, status FROM staff_attendance WHERE user_id=$1 AND date=$2", [userId, date]);
    const checkoutHM = checkoutTime || new Date().toTimeString().slice(0, 5);
    const checkoutTimestamp = new Date(`${date}T${checkoutHM}:00`);

    const yearRes = await query("SELECT id FROM academic_years WHERE is_active=true LIMIT 1");
    let isHalfDay = false;
    if (yearRes.rows.length > 0) {
      const lastPeriod = await query(
        "SELECT end_time FROM period_slots WHERE academic_year_id=$1 AND is_break=false ORDER BY period_number DESC LIMIT 1",
        [yearRes.rows[0].id]
      );
      if (lastPeriod.rows.length > 0) {
        isHalfDay = checkoutHM < lastPeriod.rows[0].end_time;
      }
    }
    const newStatus = isHalfDay ? 'Half Day' : (existing.rows[0]?.status || 'Present');

    if (existing.rows.length > 0) {
      await query("UPDATE staff_attendance SET check_out_time=$1, status=$2 WHERE id=$3", [checkoutTimestamp, newStatus, existing.rows[0].id]);
    } else {
      const { nanoid } = await import("nanoid");
      const id = `sa-${nanoid(8)}`;
      await query(
        `INSERT INTO staff_attendance (id, user_id, date, status, marked_by, source, check_out_time) VALUES ($1,$2,$3,$4,$5,'manual',$6)`,
        [id, userId, date, newStatus, auth.session.name, checkoutTimestamp]
      );
    }

    if (isHalfDay) {
      const { generateSubstitutionsForTeacherDateDB } = await import("./substitutions");
      await generateSubstitutionsForTeacherDateDB(userId, date, 'half_day', checkoutHM);
    }
    return { halfDay: isHalfDay };
  } catch { return { error: 'Failed to record checkout.' }; }
}

export async function fetchStaffAttendanceSummaryDB(userId: number, startDate: string, endDate: string): Promise<Record<string, number> & { total: number; percentage: number }> {
  const auth = await requireSession();
  if ('error' in auth) return { total: 0, percentage: 0 };
  const scopedUserId = auth.session.role === 'ADMIN' ? userId : auth.session.userId;
  try {
    const res = await query(
      "SELECT status, COUNT(*)::int as count FROM staff_attendance WHERE user_id=$1 AND date >= $2 AND date <= $3 GROUP BY status",
      [scopedUserId, startDate, endDate]
    );
    const counts: Record<string, number> = { Present: 0, Absent: 0, Late: 0, Leave: 0, "Half Day": 0 };
    let total = 0;
    res.rows.forEach((r: any) => { counts[r.status] = r.count; total += r.count; });
    const percentage = total > 0 ? Math.round(((counts.Present + counts.Late) / total) * 100) : 0;
    return { ...counts, total, percentage };
  } catch { return { total: 0, percentage: 0 }; }
}

export async function fetchStaffAttendanceHistoryDB(userId: number, startDate: string, endDate: string): Promise<StaffAttendanceRecord[]> {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const scopedUserId = auth.session.role === 'ADMIN' ? userId : auth.session.userId;
  try {
    const res = await query(
      `SELECT sa.*, u.name as user_name FROM staff_attendance sa JOIN users u ON u.id = sa.user_id
       WHERE sa.user_id=$1 AND sa.date >= $2 AND sa.date <= $3 ORDER BY sa.date DESC`,
      [scopedUserId, startDate, endDate]
    );
    return res.rows.map(mapRow);
  } catch { return []; }
}

// ── Staff biometric card enrollment (mirrors assignStudentCardAction) ──────────
export interface StaffCardRecord { id: string; userId: number; userName: string; cardUid: string; label: string | null; issuedAt: string; }

export async function fetchStaffCardsAction(): Promise<StaffCardRecord[]> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return [];
  try {
    const res = await query(`SELECT sc.*, u.name as user_name FROM staff_id_cards sc JOIN users u ON u.id = sc.user_id ORDER BY u.name`);
    return res.rows.map((r: any) => ({ id: r.id, userId: r.user_id, userName: r.user_name, cardUid: r.card_uid, label: r.label, issuedAt: r.issued_at }));
  } catch { return []; }
}

export async function enrollStaffCardDB(userId: number, cardUid: string, label?: string): Promise<{ error?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  const trimmed = cardUid.trim();
  if (!trimmed) return { error: 'Card ID is required.' };
  try {
    const { nanoid } = await import("nanoid");
    const id = `sic-${nanoid(8)}`;
    await query(
      `INSERT INTO staff_id_cards (id, user_id, card_uid, label) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET card_uid=$3, label=$4`,
      [id, userId, trimmed, label || null]
    );
    return {};
  } catch (err: any) {
    if (err?.code === '23505') return { error: 'That card ID is already assigned to someone else.' };
    return { error: 'Failed to enroll card.' };
  }
}

export async function removeStaffCardDB(id: string): Promise<{ error?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  try { await query("DELETE FROM staff_id_cards WHERE id=$1", [id]); return {}; }
  catch { return { error: 'Failed to remove card.' }; }
}
