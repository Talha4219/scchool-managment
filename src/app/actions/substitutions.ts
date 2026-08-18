"use server";

// Auto-substitution engine: when a teacher is Absent/on Leave for a whole day,
// or checks out early (Half Day), finds a stand-in for every affected period
// on that specific calendar date and records it in timetable_substitutions.
// timetable_entries are recurring weekly templates (keyed by day_of_week, no
// date) — substitutions key off (timetable_entry_id, date) so the same weekly
// slot can have a different (or no) substitute on each date it's actually missed.

import { query } from "@/lib/db";
import { notify } from "./features";
import { requireRole, requireSession, scopeBranch } from "@/lib/auth-scope";
import { notificationService } from "@/lib/notification-service";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface SubstitutionRecord {
  id: string;
  timetableEntryId: string;
  date: string;
  className: string; subjectName: string; dayOfWeek: string; startTime: string; endTime: string;
  originalTeacherId: number; originalTeacherName: string;
  substituteTeacherId: number | null; substituteTeacherName: string | null;
  reason: 'absent' | 'leave' | 'half_day' | 'manual';
  status: 'auto' | 'confirmed' | 'manual_override' | 'unfilled';
}

function mapRow(r: any): SubstitutionRecord {
  return {
    id: r.id, timetableEntryId: r.timetable_entry_id, date: r.date,
    className: r.class_name, subjectName: r.subject_name, dayOfWeek: r.day_of_week,
    startTime: r.start_time, endTime: r.end_time,
    originalTeacherId: r.original_teacher_id, originalTeacherName: r.original_teacher_name,
    substituteTeacherId: r.substitute_teacher_id, substituteTeacherName: r.substitute_teacher_name,
    reason: r.reason, status: r.status,
  };
}

const SELECT_WITH_NAMES = `
  SELECT ts.*, te.class_name, te.subject_name, te.day_of_week, te.start_time, te.end_time,
         ot.name as original_teacher_name, sub.name as substitute_teacher_name
  FROM timetable_substitutions ts
  JOIN timetable_entries te ON te.id = ts.timetable_entry_id
  JOIN users ot ON ot.id = ts.original_teacher_id
  LEFT JOIN users sub ON sub.id = ts.substitute_teacher_id
`;

// Core engine — called from staff-attendance.ts (Absent/Leave/checkout paths)
// and features.ts (leave approval). Idempotent: re-running for the same
// teacher/date skips any period that already has a substitution row, so a
// second trigger (e.g. re-marking Absent) never clobbers an admin's manual swap.
export async function generateSubstitutionsForTeacherDateDB(
  teacherId: number,
  date: string,
  reason: 'absent' | 'leave' | 'half_day',
  fromTime?: string
): Promise<{ assigned: number; unfilled: number }> {
  try {
    const dayOfWeek = DAY_NAMES[new Date(`${date}T00:00:00`).getDay()];

    let entriesSql = `SELECT * FROM timetable_entries WHERE teacher_id=$1 AND day_of_week=$2 AND COALESCE(status,'draft')='active'`;
    const entriesParams: any[] = [teacherId, dayOfWeek];
    if (fromTime) { entriesParams.push(fromTime); entriesSql += ` AND start_time >= $${entriesParams.length}`; }
    const entries = await query(entriesSql, entriesParams);

    let assigned = 0, unfilled = 0;
    const { nanoid } = await import("nanoid");

    // Resolved once per run (not per period) — every auto-assigned substitution
    // for this teacher/date needs sign-off from the branch's principal(s) AND
    // admin(s) — both can approve (approveSubstitutionDB), so both get notified.
    const teacherRes = await query('SELECT name, branch_id FROM users WHERE id=$1', [teacherId]);
    const originalTeacherName = teacherRes.rows[0]?.name || 'A teacher';
    const branchId = teacherRes.rows[0]?.branch_id ?? null;
    const approvers = branchId
      ? (await query(
          `SELECT id, email, name, role FROM users WHERE role IN ('PRINCIPAL','ADMIN') AND branch_id=$1`,
          [branchId]
        )).rows
      : (await query(`SELECT id, email, name, role FROM users WHERE role='ADMIN' AND branch_id IS NULL`)).rows;

    // Every period is proposed here (substitute pre-computed via
    // findBestSubstitute so the principal sees a concrete suggestion), but
    // nothing is announced to the covering teacher yet — that only happens
    // once a principal/admin approves it (see approveSubstitutionDB). This
    // is what "requires approval" actually means: the match is suggested,
    // not committed, until signed off.
    const periods: { periodDesc: string; substituteName: string | null }[] = [];

    for (const entry of entries.rows) {
      const already = await query(
        `SELECT id FROM timetable_substitutions WHERE timetable_entry_id=$1 AND date=$2`,
        [entry.id, date]
      );
      if (already.rows.length > 0) continue;

      const substituteId = await findBestSubstitute(entry, date, dayOfWeek);
      const id = `tsub-${nanoid(8)}`;
      await query(
        `INSERT INTO timetable_substitutions (id, timetable_entry_id, date, original_teacher_id, substitute_teacher_id, reason, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'system')`,
        [id, entry.id, date, teacherId, substituteId, reason, substituteId ? 'auto' : 'unfilled']
      );

      const periodDesc = `${entry.class_name} ${entry.subject_name}, ${entry.start_time}-${entry.end_time}`;
      if (substituteId) {
        assigned++;
        const subRes = await query('SELECT name FROM users WHERE id=$1', [substituteId]);
        periods.push({ periodDesc, substituteName: subRes.rows[0]?.name || null });
      } else {
        unfilled++;
        periods.push({ periodDesc, substituteName: null });
      }
    }

    // Nothing new to report (every period already had a row from an earlier
    // run) — don't send an empty approval request.
    if (periods.length === 0) return { assigned, unfilled };

    // One consolidated message per approver instead of one per period —
    // a teacher with 7 periods sends 7 individual pings otherwise.
    const reasonText = reason === 'half_day' ? 'checking out early' : reason;
    const periodLines = periods
      .map((p, i) => `${i + 1}. ${p.periodDesc} → ${p.substituteName ? p.substituteName : 'UNFILLED (no eligible substitute found)'}`)
      .join('\n');
    const summaryMessage =
      `${originalTeacherName} is ${reasonText} on ${date}. ${periods.length} period(s) need coverage:\n${periodLines}\n\n` +
      `Please review and approve in the dashboard.`;

    for (const p of approvers) {
      await notify('Substitution Needs Approval', summaryMessage, p.role, p.email);
      // recipientType 'PRINCIPAL' just means "resolve WhatsApp contact
      // directly from the users table" (see notification-service.ts) — works
      // the same for an ADMIN row, not principal-role-specific.
      // Free text first (instant, no template) — if the recipient's 24h
      // WhatsApp conversation window is closed, that fails and this falls
      // back to the SUBSTITUTION_APPROVAL template automatically (requires
      // that template to be marked APPROVED under WhatsApp > Templates).
      await notificationService.sendFreeTextWithTemplateFallback({
        type: 'SUBSTITUTION_APPROVAL',
        recipientType: 'PRINCIPAL',
        recipientId: String(p.id),
        message: summaryMessage,
        templateData: {
          teacher_name: originalTeacherName,
          date,
          reason: reasonText,
          periods_summary: periodLines,
        },
      });
    }

    return { assigned, unfilled };
  } catch { return { assigned: 0, unfilled: 0 }; }
}

// Ranking: (1) another teacher competent in this subject+class who's free at
// this exact day/time and not absent that date; (2) failing that, the free
// teacher with the fewest periods already scheduled that weekday ("least
// classes that day"). Both pools exclude anyone already substituting
// elsewhere at the same date+time.
async function findBestSubstitute(entry: any, date: string, dayOfWeek: string): Promise<number | null> {
  const busyTeachers = await query(
    `SELECT teacher_id FROM timetable_entries
     WHERE day_of_week=$1 AND COALESCE(status,'draft')='active' AND teacher_id != $2
       AND start_time < $3 AND end_time > $4`,
    [dayOfWeek, entry.teacher_id, entry.end_time, entry.start_time]
  );
  const busySubs = await query(
    `SELECT ts.substitute_teacher_id FROM timetable_substitutions ts
     JOIN timetable_entries te ON te.id = ts.timetable_entry_id
     WHERE ts.date=$1 AND ts.substitute_teacher_id IS NOT NULL
       AND te.start_time < $2 AND te.end_time > $3`,
    [date, entry.end_time, entry.start_time]
  );
  const absentToday = await query(
    `SELECT user_id FROM staff_attendance WHERE date=$1 AND status IN ('Absent','Leave')`,
    [date]
  );
  const excluded = new Set<number>([
    entry.teacher_id,
    ...busyTeachers.rows.map((r: any) => r.teacher_id),
    ...busySubs.rows.map((r: any) => r.substitute_teacher_id),
    ...absentToday.rows.map((r: any) => r.user_id),
  ]);

  if (entry.subject_id && entry.class_id) {
    const competent = await query(
      `SELECT tsc.teacher_id FROM teacher_subject_competencies tsc
       JOIN users u ON u.id = tsc.teacher_id
       WHERE tsc.subject_id=$1 AND tsc.class_id=$2 AND u.role='TEACHER'`,
      [entry.subject_id, entry.class_id]
    );
    const candidate = competent.rows.map((r: any) => r.teacher_id).find((id: number) => !excluded.has(id));
    if (candidate) return candidate;
  }

  const teachers = await query(`SELECT id FROM users WHERE role='TEACHER'`);
  const free = teachers.rows.map((r: any) => r.id).filter((id: number) => !excluded.has(id));
  if (free.length === 0) return null;

  const loadRes = await query(
    `SELECT teacher_id, COUNT(*)::int as cnt FROM timetable_entries
     WHERE day_of_week=$1 AND COALESCE(status,'draft')='active' AND teacher_id = ANY($2::int[])
     GROUP BY teacher_id`,
    [dayOfWeek, free]
  );
  const loadMap = new Map<number, number>(loadRes.rows.map((r: any) => [r.teacher_id, r.cnt]));
  free.sort((a: number, b: number) => (loadMap.get(a) || 0) - (loadMap.get(b) || 0));
  return free[0];
}

// Clears only system-generated ('auto'/'unfilled') rows — an admin's explicit
// 'manual_override' or 'confirmed' choice is never silently undone.
export async function clearAutoSubstitutionsForTeacherDateDB(teacherId: number, date: string): Promise<void> {
  try {
    await query(
      `DELETE FROM timetable_substitutions WHERE original_teacher_id=$1 AND date=$2 AND status IN ('auto','unfilled')`,
      [teacherId, date]
    );
  } catch { /* best-effort */ }
}

// Self-scoped for non-admins (mirrors the staff-attendance pattern) — a
// teacher can see the whole day's board is irrelevant to them; they should
// only see what THEY are covering, not the school's full substitution sheet.
export async function fetchSubstitutionsForDateDB(date: string, opts?: { teacherId?: number }): Promise<SubstitutionRecord[]> {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const scopedTeacherId = (auth.session.role === 'ADMIN' || auth.session.role === 'PRINCIPAL' || auth.session.role === 'OWNER') ? opts?.teacherId : auth.session.userId;
  try {
    // timetable_entries (this legacy demo table, distinct from the real
    // relational `timetables`) has no class_id/branch_id — scope via the
    // original teacher's branch instead.
    let sql = `${SELECT_WITH_NAMES} WHERE ts.date=$1`;
    const params: any[] = [date];
    if (scopedTeacherId !== undefined) { params.push(scopedTeacherId); sql += ` AND ts.substitute_teacher_id=$${params.length}`; }
    const branchId = scopeBranch(auth.session);
    if (branchId) { params.push(branchId); sql += ` AND ot.branch_id=$${params.length}`; }
    sql += ` ORDER BY (ts.status='unfilled') DESC, te.start_time`;
    const res = await query(sql, params);
    return res.rows.map(mapRow);
  } catch { return []; }
}

// Same eligibility rules the engine uses, exposed for the admin swap picker
// so the dropdown never offers a choice that would create a new conflict.
export async function fetchEligibleSubstitutesDB(substitutionId: string): Promise<{ userId: number; name: string }[]> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return [];
  try {
    const subRes = await query(
      `SELECT ts.date, te.* FROM timetable_substitutions ts JOIN timetable_entries te ON te.id = ts.timetable_entry_id WHERE ts.id=$1`,
      [substitutionId]
    );
    if (subRes.rows.length === 0) return [];
    const entry = subRes.rows[0];
    const dayOfWeek = entry.day_of_week;
    const date = entry.date;

    const busyTeachers = await query(
      `SELECT teacher_id FROM timetable_entries WHERE day_of_week=$1 AND COALESCE(status,'draft')='active' AND teacher_id != $2 AND start_time < $3 AND end_time > $4`,
      [dayOfWeek, entry.teacher_id, entry.end_time, entry.start_time]
    );
    const busySubs = await query(
      `SELECT ts.substitute_teacher_id FROM timetable_substitutions ts JOIN timetable_entries te ON te.id = ts.timetable_entry_id
       WHERE ts.date=$1 AND ts.id != $2 AND ts.substitute_teacher_id IS NOT NULL AND te.start_time < $3 AND te.end_time > $4`,
      [date, substitutionId, entry.end_time, entry.start_time]
    );
    const absentToday = await query(`SELECT user_id FROM staff_attendance WHERE date=$1 AND status IN ('Absent','Leave')`, [date]);
    const excluded = new Set<number>([
      entry.teacher_id,
      ...busyTeachers.rows.map((r: any) => r.teacher_id),
      ...busySubs.rows.map((r: any) => r.substitute_teacher_id),
      ...absentToday.rows.map((r: any) => r.user_id),
    ]);

    // Only ever consider teachers in the substitution's own branch — a
    // cross-branch teacher can't physically cover the class.
    const branchId = scopeBranch(auth.session);
    const teachersSql = branchId
      ? `SELECT id, name FROM users WHERE role='TEACHER' AND branch_id=$1 ORDER BY name`
      : `SELECT id, name FROM users WHERE role='TEACHER' ORDER BY name`;
    const teachers = await query(teachersSql, branchId ? [branchId] : []);
    return teachers.rows.filter((r: any) => !excluded.has(r.id)).map((r: any) => ({ userId: r.id, name: r.name }));
  } catch { return []; }
}

// Signs off an auto-assigned ('auto' status) substitution, flipping it to
// 'confirmed'. ADMIN or the branch PRINCIPAL only (requireRole('ADMIN')
// already includes PRINCIPAL — see auth-scope.ts) — a teacher can't approve
// their own coverage assignment.
export async function approveSubstitutionDB(id: string): Promise<{ error?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  try {
    const res = await query(
      `SELECT ts.status, ts.date, ts.substitute_teacher_id, te.class_name, te.subject_name, te.start_time, te.end_time, u.email
       FROM timetable_substitutions ts JOIN timetable_entries te ON te.id = ts.timetable_entry_id
       LEFT JOIN users u ON u.id = ts.substitute_teacher_id
       WHERE ts.id=$1`,
      [id]
    );
    if (res.rows.length === 0) return { error: 'Substitution not found.' };
    const row = res.rows[0];
    if (row.status !== 'auto') return { error: 'Only pending (auto-assigned) substitutions can be approved.' };
    await query(
      `UPDATE timetable_substitutions SET status='confirmed', approved_by=$1, approved_at=NOW() WHERE id=$2`,
      [auth.session.userId, id]
    );
    // The covering teacher is only told about it now, on approval — not at
    // auto-assignment time — matching "propose, don't commit until approved".
    if (row.email) {
      await notify(
        'Substitution Assignment',
        `You're covering ${row.class_name} ${row.subject_name}, ${row.start_time}-${row.end_time} on ${row.date}.`,
        'TEACHER', row.email
      );
    }
    return {};
  } catch { return { error: 'Failed to approve substitution.' }; }
}

// Count of substitutions still awaiting principal/admin sign-off, scoped to
// the caller's branch — powers the dashboard's Pending Approvals widget.
export async function fetchPendingSubstitutionApprovalCountDB(): Promise<number> {
  const auth = await requireSession();
  if ('error' in auth) return 0;
  if (auth.session.role !== 'ADMIN' && auth.session.role !== 'PRINCIPAL' && auth.session.role !== 'OWNER') return 0;
  try {
    const branchId = scopeBranch(auth.session);
    let sql = `SELECT COUNT(*)::int as count FROM timetable_substitutions ts JOIN users ot ON ot.id = ts.original_teacher_id WHERE ts.status='auto'`;
    const params: any[] = [];
    if (branchId) { params.push(branchId); sql += ` AND ot.branch_id=$${params.length}`; }
    const res = await query(sql, params);
    return res.rows[0]?.count || 0;
  } catch { return 0; }
}

export async function overrideSubstitutionDB(id: string, newTeacherId: number): Promise<{ error?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  try {
    const before = await query(`SELECT substitute_teacher_id FROM timetable_substitutions WHERE id=$1`, [id]);
    await query(
      `UPDATE timetable_substitutions SET substitute_teacher_id=$1, status='manual_override', created_by=$2 WHERE id=$3`,
      [newTeacherId, auth.session.name, id]
    );
    const info = await query(
      `SELECT ts.date, te.class_name, te.subject_name, te.start_time, te.end_time, u.email
       FROM timetable_substitutions ts JOIN timetable_entries te ON te.id = ts.timetable_entry_id
       JOIN users u ON u.id = $1 WHERE ts.id=$2`,
      [newTeacherId, id]
    );
    if (info.rows.length > 0) {
      const r = info.rows[0];
      await notify('Substitution Assignment', `You're now covering ${r.class_name} ${r.subject_name}, ${r.start_time}-${r.end_time} on ${r.date}.`, 'TEACHER', r.email);
    }
    if (before.rows[0]?.substitute_teacher_id) {
      const oldRes = await query('SELECT email FROM users WHERE id=$1', [before.rows[0].substitute_teacher_id]);
      if (oldRes.rows[0]) await notify('Substitution Reassigned', `A substitution you were covering on this date has been reassigned to another teacher.`, 'TEACHER', oldRes.rows[0].email);
    }
    return {};
  } catch { return { error: 'Failed to override substitution.' }; }
}

export async function fillUnfilledSubstitutionDB(id: string, teacherId: number): Promise<{ error?: string }> {
  return overrideSubstitutionDB(id, teacherId);
}
