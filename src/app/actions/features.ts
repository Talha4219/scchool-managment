"use server";

import { query } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import type { ParentRecord, TeacherSubjectAssignment, ExamSession, ExamMarkEntry, StudentExamScore, ClassCompilation, ResultPosition } from '@/lib/types';
import bcrypt from 'bcryptjs';
import { getSession } from '@/app/actions/auth';
import { logServerError } from '@/lib/error-log';
import { logAudit } from '@/lib/audit';

export async function notify(title: string, message: string, recipientRole: string, recipientEmail?: string | null) {
  try {
    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const date = new Date().toISOString().split('T')[0];
    await query(
      `INSERT INTO notifications (id, title, message, date, recipient_role, recipient_email, read) VALUES ($1,$2,$3,$4,$5,$6,false)`,
      [id, title, message, date, recipientRole, recipientEmail || null]
    );
  } catch (err) { logServerError("features", 'notify failed', err); }
}

export interface Announcement {
  id: string; title: string; content: string; date: string;
  authorId: string; authorName: string; targetRole: string | null;
  targetClass: string | null; priority: string;
}

export interface Assignment {
  id: string; title: string; description: string; dueDate: string;
  className: string; subject: string; teacherName: string; createdAt: string;
  classId?: string | null; sectionId?: string | null; subjectId?: string | null; teacherId?: number | null;
  attachmentData?: string | null; attachmentName?: string | null;
}

export interface AssignmentSubmission {
  id: string; assignmentId: string; studentId: string; studentName: string;
  submittedAt: string; notes: string | null; grade: string | null; feedback: string | null;
  isLate?: boolean; gradedAt?: string | null; attachmentData?: string | null; attachmentName?: string | null;
}

export interface TimetableEntry {
  id: string; className: string; subjectName: string; teacherName: string;
  dayOfWeek: string; startTime: string; endTime: string; room: string | null;
  classId: string | null; sectionId: string | null; subjectId: string | null;
  teacherId: number | null; academicYearId: string | null;
  status: 'draft' | 'active'; competencyOverride: boolean;
}

// ── Announcements ────────────────────────────────────────────────────────────

export async function fetchAnnouncementsDB(role?: string, viewerUserId?: number): Promise<Announcement[]> {
  try {
    let sql = 'SELECT * FROM announcements';
    const params: string[] = [];
    if (role && role !== 'ADMIN') {
      // Older seed data stores "everyone" announcements as the literal string
      // 'ALL' rather than NULL — treat both as "everyone" so they aren't
      // silently excluded for every non-admin role (was hiding all "ALL"
      // announcements, and leaving PARENT with zero results entirely since no
      // row explicitly targets PARENT).
      // Also always include the viewer's own posts regardless of who they
      // targeted — a Teacher posting a "Students Only" announcement should
      // still see it in their own feed as confirmation it went out.
      params.push(role);
      let clause = "(target_role IS NULL OR target_role = 'ALL' OR target_role = $1)";
      if (viewerUserId) { params.push(String(viewerUserId)); clause = `(${clause} OR author_id = $${params.length})`; }
      sql += ` WHERE ${clause}`;
    }
    sql += ' ORDER BY date DESC';
    const res = await query(sql, params);
    return res.rows.map(r => ({
      id: r.id, title: r.title, content: r.content, date: r.date,
      authorId: r.author_id, authorName: r.author_name,
      targetRole: r.target_role, targetClass: r.target_class, priority: r.priority,
    }));
  } catch { return []; }
}

export async function createAnnouncementDB(data: Omit<Announcement, 'id'>): Promise<{ error?: string }> {
  // Server-side RBAC — the client hides the "Post" button for STUDENT/PARENT,
  // but that's UI-only; a crafted request could still call this action directly.
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role !== 'ADMIN' && session.role !== 'TEACHER') {
    return { error: 'Only admins and teachers can post announcements.' };
  }
  // A teacher can only target a class they're actually assigned to teach —
  // trust the session's identity for authorship, not whatever the client sent.
  if (session.role === 'TEACHER' && data.targetClass) {
    const assigned = await query(
      `SELECT 1 FROM teacher_class_subjects tcs JOIN classes c ON tcs.class_id = c.id
       WHERE tcs.teacher_id=$1 AND c.name=$2 LIMIT 1`,
      [session.userId, data.targetClass]
    );
    if (assigned.rows.length === 0) {
      return { error: "You can only target a class you're assigned to teach." };
    }
  }
  try {
    const id = `ann_${Date.now()}`;
    await query(
      `INSERT INTO announcements (id, title, content, date, author_id, author_name, target_role, target_class, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, data.title, data.content, data.date, String(session.userId), session.name,
       data.targetRole || null, data.targetClass || null, data.priority]
    );
    return {};
  } catch (err) { logServerError("features", err); return { error: 'Failed to create.' }; }
}

export async function deleteAnnouncementDB(id: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role !== 'ADMIN') return { error: 'Only admins can delete announcements.' };
  try { await query('DELETE FROM announcements WHERE id=$1', [id]); return {}; }
  catch { return { error: 'Failed to delete.' }; }
}

// ── Assignments ──────────────────────────────────────────────────────────────

function mapAssignment(r: any): Assignment {
  return {
    id: r.id, title: r.title, description: r.description, dueDate: r.due_date,
    className: r.class_name, subject: r.subject, teacherName: r.teacher_name, createdAt: r.created_at,
    classId: r.class_id, sectionId: r.section_id, subjectId: r.subject_id, teacherId: r.teacher_id,
    attachmentData: r.attachment_data, attachmentName: r.attachment_name,
  };
}

export async function fetchAssignmentsDB(
  className?: string, teacherName?: string,
  opts?: { classId?: string; sectionId?: string; teacherId?: number }
): Promise<Assignment[]> {
  try {
    let sql = 'SELECT * FROM assignments WHERE 1=1';
    const params: (string | number)[] = [];
    if (className) { params.push(className); sql += ` AND class_name=$${params.length}`; }
    if (teacherName) { params.push(teacherName); sql += ` AND teacher_name=$${params.length}`; }
    if (opts?.classId) { params.push(opts.classId); sql += ` AND class_id=$${params.length}`; }
    if (opts?.sectionId) { params.push(opts.sectionId); sql += ` AND section_id=$${params.length}`; }
    if (opts?.teacherId !== undefined) { params.push(opts.teacherId); sql += ` AND teacher_id=$${params.length}`; }
    sql += ' ORDER BY due_date ASC';
    const res = await query(sql, params);
    return res.rows.map(mapAssignment);
  } catch { return []; }
}

export async function createAssignmentDB(
  data: Omit<Assignment, 'id' | 'teacherName' | 'teacherId' | 'className' | 'subject' | 'createdAt'> & { classId: string; sectionId?: string; subjectId: string }
): Promise<{ error?: string; id?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role !== 'ADMIN' && session.role !== 'TEACHER') {
    return { error: 'Only admins and teachers can create assignments.' };
  }
  try {
    if (session.role === 'TEACHER') {
      const assigned = await query(
        `SELECT 1 FROM teacher_class_subjects WHERE teacher_id=$1 AND class_id=$2 AND subject_id=$3 LIMIT 1`,
        [session.userId, data.classId, data.subjectId]
      );
      if (assigned.rows.length === 0) {
        return { error: "You're not assigned to teach this class/subject." };
      }
    }
    const clsRes = await query('SELECT name FROM classes WHERE id=$1', [data.classId]);
    const subRes = await query('SELECT name FROM subjects WHERE id=$1', [data.subjectId]);
    const className = clsRes.rows[0]?.name || '';
    const subjectName = subRes.rows[0]?.name || '';

    const id = `asgn_${Date.now()}`;
    await query(
      `INSERT INTO assignments (id, title, description, due_date, class_name, subject, teacher_name, created_at, class_id, section_id, subject_id, teacher_id, attachment_data, attachment_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, data.title, data.description, data.dueDate, className, subjectName, session.name, new Date().toISOString().split('T')[0],
       data.classId, data.sectionId || null, data.subjectId, session.userId, data.attachmentData || null, data.attachmentName || null]
    );

    const roster = await query(
      `SELECT s.email, s.parent_email FROM enrollments e JOIN students s ON e.student_id = s.id
       WHERE e.class_id=$1 AND e.status='Active' AND ($2::text IS NULL OR e.section_id=$2)`,
      [data.classId, data.sectionId || null]
    );
    const msg = `New assignment "${data.title}" posted for ${className} (${subjectName}), due ${data.dueDate}.`;
    await Promise.all(roster.rows.flatMap((r: any) => [
      r.email ? notify('New Assignment', msg, 'STUDENT', r.email) : null,
      r.parent_email ? notify('New Assignment', msg, 'PARENT', r.parent_email) : null,
    ].filter(Boolean) as Promise<void>[]));

    return { id };
  } catch (err) { logServerError("features", err); return { error: 'Failed to create.' }; }
}

export async function deleteAssignmentDB(id: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  try {
    if (session.role === 'ADMIN') {
      await query('DELETE FROM assignments WHERE id=$1', [id]);
      return {};
    }
    if (session.role === 'TEACHER') {
      const res = await query('DELETE FROM assignments WHERE id=$1 AND teacher_id=$2', [id, session.userId]);
      if (res.rowCount === 0) return { error: "You can only delete your own assignments." };
      return {};
    }
    return { error: 'Not authorized.' };
  } catch { return { error: 'Failed to delete.' }; }
}

export async function fetchSubmissionsDB(assignmentId: string): Promise<AssignmentSubmission[]> {
  try {
    const res = await query('SELECT * FROM assignment_submissions WHERE assignment_id=$1', [assignmentId]);
    return res.rows.map(r => ({
      id: r.id, assignmentId: r.assignment_id, studentId: r.student_id,
      studentName: r.student_name, submittedAt: r.submitted_at,
      notes: r.notes, grade: r.grade, feedback: r.feedback,
      isLate: !!r.is_late, gradedAt: r.graded_at, attachmentData: r.attachment_data, attachmentName: r.attachment_name,
    }));
  } catch { return []; }
}

export async function submitAssignmentDB(data: { assignmentId: string; notes: string; attachmentData?: string; attachmentName?: string }): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role !== 'STUDENT') return { error: 'Only students can submit assignments.' };
  try {
    const studentRes = await query('SELECT id, name FROM students WHERE email=$1 AND status=$2', [session.email, 'Active']);
    if (studentRes.rows.length === 0) return { error: 'No active student record found for this account.' };
    const studentId = studentRes.rows[0].id;
    const studentName = studentRes.rows[0].name;

    const asgnRes = await query(
      `SELECT a.class_id, a.section_id, a.due_date, a.title, u.email as teacher_email
       FROM assignments a LEFT JOIN users u ON a.teacher_id = u.id WHERE a.id=$1`,
      [data.assignmentId]
    );
    if (asgnRes.rows.length === 0) return { error: 'Assignment not found.' };
    const { class_id, section_id, due_date, title, teacher_email } = asgnRes.rows[0];

    if (class_id) {
      const enrolled = await query(
        `SELECT 1 FROM enrollments WHERE student_id=$1 AND class_id=$2 AND status='Active'
         AND ($3::text IS NULL OR section_id=$3) LIMIT 1`,
        [studentId, class_id, section_id]
      );
      if (enrolled.rows.length === 0) return { error: "You're not enrolled in this class." };
    }

    const existing = await query('SELECT id, graded_at FROM assignment_submissions WHERE assignment_id=$1 AND student_id=$2', [data.assignmentId, studentId]);
    const today = new Date().toISOString().split('T')[0];
    const isLate = !!due_date && today > due_date;

    if (existing.rows.length > 0) {
      if (existing.rows[0].graded_at) {
        return { error: 'This submission has already been graded — ask your teacher to reopen it.' };
      }
      await query(
        `UPDATE assignment_submissions SET submitted_at=$1, notes=$2, is_late=$3, attachment_data=$4, attachment_name=$5 WHERE id=$6`,
        [today, data.notes || null, isLate, data.attachmentData || null, data.attachmentName || null, existing.rows[0].id]
      );
    } else {
      const id = `sub_${Date.now()}`;
      await query(
        `INSERT INTO assignment_submissions (id, assignment_id, student_id, student_name, submitted_at, notes, is_late, attachment_data, attachment_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, data.assignmentId, studentId, studentName, today, data.notes || null, isLate, data.attachmentData || null, data.attachmentName || null]
      );
    }
    if (teacher_email) {
      await notify('New Submission', `${studentName} submitted "${title}"${isLate ? ' (late)' : ''}.`, 'TEACHER', teacher_email);
    }
    return {};
  } catch (err) { logServerError("features", err); return { error: 'Failed to submit.' }; }
}

export async function gradeSubmissionDB(id: string, grade: string, feedback: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role !== 'ADMIN' && session.role !== 'TEACHER') return { error: 'Not authorized.' };
  try {
    if (session.role === 'TEACHER') {
      const owns = await query(
        `SELECT 1 FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id
         WHERE s.id=$1 AND a.teacher_id=$2 LIMIT 1`,
        [id, session.userId]
      );
      if (owns.rows.length === 0) return { error: "You can only grade submissions for your own assignments." };
    }
    await query('UPDATE assignment_submissions SET grade=$1, feedback=$2, graded_at=NOW() WHERE id=$3', [grade, feedback, id]);

    const info = await query(
      `SELECT s.student_id as student_pk, st.email, st.parent_email, a.title
       FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id
       JOIN students st ON st.id = s.student_id WHERE s.id=$1`,
      [id]
    );
    if (info.rows.length > 0) {
      const { email, parent_email, title } = info.rows[0];
      const msg = `Your submission for "${title}" has been graded: ${grade}.`;
      if (email) await notify('Assignment Graded', msg, 'STUDENT', email);
      if (parent_email) await notify('Assignment Graded', msg, 'PARENT', parent_email);
    }
    return {};
  } catch { return { error: 'Failed to grade.' }; }
}

// ── Timetable ────────────────────────────────────────────────────────────────

function mapTimetableEntry(r: any): TimetableEntry {
  return {
    id: r.id, className: r.class_name, subjectName: r.subject_name,
    teacherName: r.teacher_name, dayOfWeek: r.day_of_week,
    startTime: r.start_time, endTime: r.end_time, room: r.room,
    classId: r.class_id, sectionId: r.section_id, subjectId: r.subject_id,
    teacherId: r.teacher_id, academicYearId: r.academic_year_id,
    status: r.status ?? 'draft', competencyOverride: !!r.competency_override,
  };
}

// By default only 'active' (published) entries are returned — matches every
// existing caller (dashboard "today's schedule", teacher/student/parent views).
// Pass opts.status to see drafts too (the admin timetable-builder screen).
export async function fetchTimetableDB(
  className?: string,
  teacherName?: string,
  opts?: { status?: 'draft' | 'active' | 'all'; classId?: string; sectionId?: string; academicYearId?: string; teacherId?: number }
): Promise<TimetableEntry[]> {
  try {
    let sql = 'SELECT * FROM timetable_entries WHERE 1=1';
    const params: (string | number)[] = [];
    if (className) { params.push(className); sql += ` AND class_name=$${params.length}`; }
    if (teacherName) { params.push(teacherName); sql += ` AND teacher_name=$${params.length}`; }
    if (opts?.classId) { params.push(opts.classId); sql += ` AND class_id=$${params.length}`; }
    if (opts?.sectionId) { params.push(opts.sectionId); sql += ` AND section_id=$${params.length}`; }
    if (opts?.academicYearId) { params.push(opts.academicYearId); sql += ` AND academic_year_id=$${params.length}`; }
    if (opts?.teacherId !== undefined) { params.push(opts.teacherId); sql += ` AND teacher_id=$${params.length}`; }
    const status = opts?.status ?? 'active';
    if (status !== 'all') { params.push(status); sql += ` AND COALESCE(status, 'draft')=$${params.length}`; }
    sql += ' ORDER BY day_of_week, start_time';
    const res = await query(sql, params);
    return res.rows.map(mapTimetableEntry);
  } catch { return []; }
}

export interface TimetableConflict { kind: 'teacher_double_booked'; entry: TimetableEntry }
type TimetableEntryInput = Omit<TimetableEntry, 'id' | 'status' | 'competencyOverride'> & { assignedByUserId?: number };
type InsertResult = { error?: string; conflict?: TimetableConflict; needsCompetencyOverride?: boolean; id?: string };

// Shared by the single "Add Slot" flow and bulk copy — conflict check ->
// competency check -> insert -> ClassSubject sync, so both callers get the
// exact same safety rules instead of duplicating them.
async function insertTimetableEntry(data: TimetableEntryInput, opts?: { competencyOverride?: boolean }): Promise<InsertResult> {
  try {
    // Hard block: teacher can't be in two places for an overlapping time on the same day.
    // No override — this one is a physical impossibility, not a policy call.
    if (data.teacherId) {
      const clash = await query(
        `SELECT * FROM timetable_entries
         WHERE teacher_id=$1 AND day_of_week=$2 AND COALESCE(academic_year_id,'')=COALESCE($3,'')
           AND COALESCE(status,'draft') != 'archived'
           AND start_time < $4 AND end_time > $5`,
        [data.teacherId, data.dayOfWeek, data.academicYearId || null, data.endTime, data.startTime]
      );
      if (clash.rows.length > 0) {
        return { error: 'This teacher is already scheduled elsewhere at an overlapping time on this day.', conflict: { kind: 'teacher_double_booked', entry: mapTimetableEntry(clash.rows[0]) } };
      }
    }

    // Competency hard-block (same rule/escape-hatch as ClassSubject assignment).
    if (data.teacherId && data.subjectId && data.classId && !opts?.competencyOverride) {
      const competent = await query(
        'SELECT id FROM teacher_subject_competencies WHERE teacher_id=$1 AND subject_id=$2 AND class_id=$3',
        [data.teacherId, data.subjectId, data.classId]
      );
      if (competent.rows.length === 0) {
        return { error: 'not_competent', needsCompetencyOverride: true };
      }
    }

    const id = `tt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    await query(
      `INSERT INTO timetable_entries
        (id, class_name, subject_name, teacher_name, day_of_week, start_time, end_time, room,
         class_id, section_id, subject_id, teacher_id, academic_year_id, status, competency_override, assigned_by_user_id, assigned_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft',$14,$15,NOW())`,
      [id, data.className, data.subjectName, data.teacherName, data.dayOfWeek, data.startTime, data.endTime, data.room || null,
       data.classId || null, data.sectionId || null, data.subjectId || null, data.teacherId || null, data.academicYearId || null,
       !!opts?.competencyOverride, data.assignedByUserId || null]
    );

    // ClassSubject sync: assigning a teacher to teach a subject in a class/section
    // via Timetable creates/keeps in sync the matching teacher_class_subjects row,
    // so gradebook/marks entry never drifts from "who actually teaches this slot."
    if (data.teacherId && data.classId && data.sectionId && data.subjectId && data.academicYearId) {
      const exists = await query(
        'SELECT id FROM teacher_class_subjects WHERE teacher_id=$1 AND class_id=$2 AND section_id=$3 AND subject_id=$4 AND academic_year_id=$5',
        [data.teacherId, data.classId, data.sectionId, data.subjectId, data.academicYearId]
      );
      if (exists.rows.length === 0) {
        const { nanoid } = await import('nanoid');
        await query(
          `INSERT INTO teacher_class_subjects (id, teacher_id, class_id, section_id, subject_id, academic_year_id, competency_override) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [`tcs-${nanoid(8)}`, data.teacherId, data.classId, data.sectionId, data.subjectId, data.academicYearId, !!opts?.competencyOverride]
        );
      }
    }

    return { id };
  } catch (err) { logServerError("features", err); return { error: 'Failed to create.' }; }
}

export async function createTimetableEntryDB(
  data: TimetableEntryInput,
  opts?: { competencyOverride?: boolean }
): Promise<InsertResult> {
  return insertTimetableEntry(data, opts);
}

// ── Bulk copy: duplicate one section's week onto another (same academic year) ──

export interface CopyTimetableSkip { subjectName: string; teacherName: string; dayOfWeek: string; startTime: string; endTime: string; reason: string }

export async function copyTimetableDB(
  sourceClassId: string, sourceSectionId: string,
  targetClassId: string, targetSectionId: string, targetClassName: string,
  academicYearId: string, assignedByUserId?: number
): Promise<{ error?: string; copied?: number; skipped?: CopyTimetableSkip[] }> {
  try {
    const source = await fetchTimetableDB(undefined, undefined, { classId: sourceClassId, sectionId: sourceSectionId, academicYearId, status: 'all' });
    let copied = 0;
    const skipped: CopyTimetableSkip[] = [];

    for (const e of source) {
      const res = await insertTimetableEntry({
        className: targetClassName, subjectName: e.subjectName, teacherName: e.teacherName,
        dayOfWeek: e.dayOfWeek, startTime: e.startTime, endTime: e.endTime, room: e.room,
        classId: targetClassId, sectionId: targetSectionId, subjectId: e.subjectId,
        teacherId: e.teacherId, academicYearId, assignedByUserId,
      });
      if (res.id) copied++;
      else skipped.push({ subjectName: e.subjectName, teacherName: e.teacherName, dayOfWeek: e.dayOfWeek, startTime: e.startTime, endTime: e.endTime, reason: res.error || 'Failed to copy.' });
    }

    return { copied, skipped };
  } catch (err) { logServerError("features", err); return { error: 'Failed to copy timetable.' }; }
}

export async function deleteTimetableEntryDB(id: string): Promise<{ error?: string }> {
  try { await query('DELETE FROM timetable_entries WHERE id=$1', [id]); return {}; }
  catch { return { error: 'Failed to delete.' }; }
}

// ── Publish gate ─────────────────────────────────────────────────────────────
// A section's timetable is invisible to Teachers/Students/Parents (who only
// ever see status='active' rows, per fetchTimetableDB's default) until Admin
// explicitly publishes it here.

export async function publishTimetableDB(
  classId: string, sectionId: string, academicYearId: string,
  publishedByUserId?: number, publishedByName?: string
): Promise<{ error?: string; count?: number }> {
  try {
    const res = await query(
      `UPDATE timetable_entries SET status='active'
       WHERE class_id=$1 AND section_id=$2 AND academic_year_id=$3 AND COALESCE(status,'draft')='draft'`,
      [classId, sectionId, academicYearId]
    );
    await query(
      `INSERT INTO timetable_publications (id, class_id, section_id, academic_year_id, published_by_user_id, published_by_name)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [`ttpub_${Date.now()}`, classId, sectionId, academicYearId, publishedByUserId || null, publishedByName || null]
    );
    return { count: res.rowCount ?? 0 };
  } catch (err) { logServerError("features", err); return { error: 'Failed to publish timetable.' }; }
}

export interface TimetablePublication {
  id: string; classId: string; sectionId: string; academicYearId: string;
  publishedByName: string | null; publishedAt: string;
}

export async function fetchTimetablePublicationsDB(classId: string, sectionId: string): Promise<TimetablePublication[]> {
  try {
    const res = await query(
      'SELECT * FROM timetable_publications WHERE class_id=$1 AND section_id=$2 ORDER BY published_at DESC',
      [classId, sectionId]
    );
    return res.rows.map(r => ({
      id: r.id, classId: r.class_id, sectionId: r.section_id, academicYearId: r.academic_year_id,
      publishedByName: r.published_by_name, publishedAt: r.published_at,
    }));
  } catch { return []; }
}

// ── Period Slots (reusable weekly bell schedule, one grid per academic year) ────

export interface PeriodSlot {
  id: string; academicYearId: string; periodNumber: number;
  label: string; startTime: string; endTime: string; isBreak: boolean;
}

export async function fetchPeriodSlotsDB(academicYearId: string): Promise<PeriodSlot[]> {
  try {
    const res = await query('SELECT * FROM period_slots WHERE academic_year_id=$1 ORDER BY period_number', [academicYearId]);
    return res.rows.map(r => ({
      id: r.id, academicYearId: r.academic_year_id, periodNumber: r.period_number,
      label: r.label, startTime: r.start_time, endTime: r.end_time, isBreak: !!r.is_break,
    }));
  } catch { return []; }
}

export async function createPeriodSlotDB(data: Omit<PeriodSlot, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `ps_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    await query(
      `INSERT INTO period_slots (id, academic_year_id, period_number, label, start_time, end_time, is_break) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, data.academicYearId, data.periodNumber, data.label, data.startTime, data.endTime, data.isBreak]
    );
    return { id };
  } catch (err) { logServerError("features", err); return { error: 'Failed to add period.' }; }
}

export async function updatePeriodSlotDB(id: string, data: Partial<Omit<PeriodSlot, 'id' | 'academicYearId'>>): Promise<{ error?: string }> {
  try {
    const fields: string[] = []; const vals: any[] = []; let i = 1;
    if (data.periodNumber !== undefined) { fields.push(`period_number=$${i++}`); vals.push(data.periodNumber); }
    if (data.label !== undefined) { fields.push(`label=$${i++}`); vals.push(data.label); }
    if (data.startTime !== undefined) { fields.push(`start_time=$${i++}`); vals.push(data.startTime); }
    if (data.endTime !== undefined) { fields.push(`end_time=$${i++}`); vals.push(data.endTime); }
    if (data.isBreak !== undefined) { fields.push(`is_break=$${i++}`); vals.push(data.isBreak); }
    if (fields.length === 0) return {};
    vals.push(id);
    await query(`UPDATE period_slots SET ${fields.join(', ')} WHERE id=$${i}`, vals);
    return {};
  } catch { return { error: 'Failed to update period.' }; }
}

export async function deletePeriodSlotDB(id: string): Promise<{ error?: string }> {
  try { await query('DELETE FROM period_slots WHERE id=$1', [id]); return {}; }
  catch { return { error: 'Failed to delete period.' }; }
}

// ── User Management (Prisma) ─────────────────────────────────────────────────

// Every function below manages other users' accounts or every role's
// permissions — admin-only, checked server-side (not just hidden client UI).
// These had no session check at all before this pass: any authenticated
// request (or a crafted unauthenticated one) could call updateUserDB to
// self-promote to ADMIN, or flip another role's permissions.
async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' } as const;
  if (session.role !== 'ADMIN') return { error: 'Only administrators can do this.' } as const;
  return { session };
}

export async function fetchUsersDB() {
  const auth = await requireAdmin();
  if ('error' in auth) return [];
  try {
    const res = await query(
      `SELECT u.id, u.name, u.email, u.role, u.created_at, COALESCE(u.status, 'ACTIVE') AS status,
              u.custom_role_id, cr.name AS custom_role_name, cr.color AS custom_role_color
       FROM users u
       LEFT JOIN custom_roles cr ON cr.id = u.custom_role_id
       WHERE COALESCE(u.status, 'ACTIVE') IN ('ACTIVE', 'INACTIVE')
       ORDER BY u.created_at DESC`
    );
    return res.rows.map(r => ({
      id: r.id, name: r.name, email: r.email, role: r.role,
      createdAt: new Date(r.created_at), status: r.status,
      customRoleId: r.custom_role_id as string | null,
      customRoleName: r.custom_role_name as string | null,
      customRoleColor: r.custom_role_color as string | null,
    }));
  } catch { return []; }
}

export async function fetchPendingUsersDB() {
  const auth = await requireAdmin();
  if ('error' in auth) return [];
  try {
    const res = await query(
      `SELECT u.id, u.name, u.email, u.role, u.created_at,
              tp.phone, tp.cnic, tp.specialization, tp.qualification,
              tp.experience_years, tp.joining_date, tp.address,
              tp.profile_photo, tp.degree_photo
       FROM users u
       LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
       WHERE COALESCE(u.status, 'ACTIVE') = 'PENDING'
       ORDER BY u.created_at DESC`
    );
    return res.rows.map(r => ({
      id: r.id as number,
      name: r.name as string,
      email: r.email as string,
      role: r.role as string,
      createdAt: new Date(r.created_at),
      profile: r.phone ? {
        phone: r.phone, cnic: r.cnic, specialization: r.specialization,
        qualification: r.qualification, experienceYears: r.experience_years,
        joiningDate: r.joining_date, address: r.address,
        profilePhoto: r.profile_photo as string | null,
        degreePhoto: r.degree_photo as string | null,
      } : null,
    }));
  } catch { return []; }
}

export async function approveUserDB(id: number): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return auth;
  try {
    await query('UPDATE users SET status=$1 WHERE id=$2', ['ACTIVE', id]);
    await logAudit({ actor: auth.session, action: 'UPDATE', entityType: 'user', entityId: String(id), summary: `Approved pending account #${id}`, after: { status: 'ACTIVE' } });
    return {};
  } catch { return { error: 'Failed to approve user.' }; }
}

export async function rejectUserDB(id: number): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return auth;
  try {
    await query('DELETE FROM teacher_profiles WHERE user_id=$1', [id]);
    await prisma.user.delete({ where: { id } });
    await logAudit({ actor: auth.session, action: 'DELETE', entityType: 'user', entityId: String(id), summary: `Rejected and removed pending account #${id}` });
    return {};
  } catch { return { error: 'Failed to reject user.' }; }
}

export async function updateUserDB(
  id: number,
  data: { name?: string; role?: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'EMPLOYEE'; customRoleId?: string | null }
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return auth;
  try {
    const { customRoleId, ...prismaData } = data;
    if (Object.keys(prismaData).length > 0) await prisma.user.update({ where: { id }, data: prismaData });
    if (customRoleId !== undefined) await query('UPDATE users SET custom_role_id=$1 WHERE id=$2', [customRoleId, id]);
    await logAudit({ actor: auth.session, action: 'UPDATE', entityType: 'user', entityId: String(id), summary: `Updated user #${id}`, after: data });
    return {};
  } catch { return { error: 'Failed to update user.' }; }
}

export async function deactivateUserDB(id: number): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return auth;
  if (auth.session.userId === id) return { error: "You can't deactivate your own account." };
  try {
    await query(`UPDATE users SET status='INACTIVE' WHERE id=$1`, [id]);
    await logAudit({ actor: auth.session, action: 'UPDATE', entityType: 'user', entityId: String(id), summary: `Deactivated user #${id}`, after: { status: 'INACTIVE' } });
    return {};
  } catch { return { error: 'Failed to deactivate user.' }; }
}

export async function reactivateUserDB(id: number): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return auth;
  try {
    await query(`UPDATE users SET status='ACTIVE', failed_login_attempts=0, locked_until=NULL WHERE id=$1`, [id]);
    await logAudit({ actor: auth.session, action: 'UPDATE', entityType: 'user', entityId: String(id), summary: `Reactivated user #${id}`, after: { status: 'ACTIVE' } });
    return {};
  } catch { return { error: 'Failed to reactivate user.' }; }
}

export async function deleteUserDB(id: number): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return auth;
  if (auth.session.userId === id) return { error: "You can't delete your own account." };
  try {
    await prisma.user.delete({ where: { id } });
    await logAudit({ actor: auth.session, action: 'DELETE', entityType: 'user', entityId: String(id), summary: `Deleted user #${id}` });
    return {};
  } catch { return { error: 'Failed to delete user.' }; }
}

export async function resetUserPasswordDB(id: number, newPassword: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return auth;
  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    await logAudit({ actor: auth.session, action: 'UPDATE', entityType: 'user', entityId: String(id), summary: `Reset password for user #${id}` });
    return {};
  } catch { return { error: 'Failed to reset password.' }; }
}

export async function createUserDB(
  name: string, email: string, password: string,
  role: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'EMPLOYEE',
  customRoleId?: string | null
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return auth;
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: 'Email already in use.' };
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, passwordHash, role } });
    if (customRoleId) await query('UPDATE users SET custom_role_id=$1 WHERE id=$2', [customRoleId, user.id]);
    await logAudit({ actor: auth.session, action: 'CREATE', entityType: 'user', entityId: String(user.id), summary: `Created user ${name} (${role})`, after: { name, email, role, customRoleId: customRoleId || null } });
    return {};
  } catch { return { error: 'Failed to create user.' }; }
}

// Self-service: the session JWT only carries the base `role` (set at login),
// so a custom-role assignment needs a live lookup rather than requiring
// every affected user to log out and back in for it to take effect.
export async function fetchMyCustomRoleIdDB(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  try {
    const res = await query('SELECT custom_role_id FROM users WHERE id=$1', [session.userId]);
    return res.rows[0]?.custom_role_id ?? null;
  } catch { return null; }
}

// ── Custom Roles ───────────────────────────────────────────────────────────────

export interface CustomRole {
  id: string; name: string; baseRole: string; description: string; color: string; createdAt: string;
}

export async function fetchCustomRolesDB(): Promise<CustomRole[]> {
  const session = await getSession();
  if (!session) return [];
  try {
    const res = await query('SELECT * FROM custom_roles ORDER BY name');
    return res.rows.map(r => ({
      id: r.id, name: r.name, baseRole: r.base_role, description: r.description || '',
      color: r.color || 'blue', createdAt: r.created_at,
    }));
  } catch { return []; }
}

// A new custom role starts as a clone of its base role's current permissions
// (copy-on-create) rather than all-off — an empty grid is a worse first run
// than "identical to Teacher, now go customize it."
export async function createCustomRoleDB(data: { name: string; baseRole: string; description?: string; color?: string }): Promise<{ error?: string; id?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return auth;
  try {
    const { nanoid } = await import('nanoid');
    const id = `cr_${nanoid(8)}`;
    await query(
      'INSERT INTO custom_roles (id, name, base_role, description, color) VALUES ($1,$2,$3,$4,$5)',
      [id, data.name, data.baseRole, data.description || '', data.color || 'blue']
    );
    const basePerms = await query('SELECT permission, enabled FROM role_permissions WHERE role=$1', [data.baseRole]);
    for (const p of basePerms.rows) {
      await query('INSERT INTO role_permissions (role, permission, enabled) VALUES ($1,$2,$3) ON CONFLICT (role, permission) DO NOTHING', [id, p.permission, p.enabled]);
    }
    await logAudit({ actor: auth.session, action: 'CREATE', entityType: 'custom_role', entityId: id, summary: `Created custom role "${data.name}" (based on ${data.baseRole})`, after: data });
    return { id };
  } catch { return { error: 'Failed to create custom role.' }; }
}

export async function updateCustomRoleDB(id: string, data: { name?: string; description?: string; color?: string }): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return auth;
  try {
    await query(
      'UPDATE custom_roles SET name=COALESCE($1,name), description=COALESCE($2,description), color=COALESCE($3,color) WHERE id=$4',
      [data.name ?? null, data.description ?? null, data.color ?? null, id]
    );
    await logAudit({ actor: auth.session, action: 'UPDATE', entityType: 'custom_role', entityId: id, summary: `Updated custom role ${id}`, after: data });
    return {};
  } catch { return { error: 'Failed to update custom role.' }; }
}

export async function deleteCustomRoleDB(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return auth;
  try {
    const inUse = await query('SELECT COUNT(*) FROM users WHERE custom_role_id=$1', [id]);
    if (parseInt(inUse.rows[0].count) > 0) return { error: 'Cannot delete a custom role that is still assigned to users.' };
    await query('DELETE FROM role_permissions WHERE role=$1', [id]);
    await query('DELETE FROM custom_roles WHERE id=$1', [id]);
    await logAudit({ actor: auth.session, action: 'DELETE', entityType: 'custom_role', entityId: id, summary: `Deleted custom role ${id}` });
    return {};
  } catch { return { error: 'Failed to delete custom role.' }; }
}

// ── Role Permissions ──────────────────────────────────────────────────────────

// Deliberately NOT admin-gated: every logged-in user calls this for their own
// role/custom-role to render their own sidebar and page access.
export async function fetchRolePermissionsDB(role?: string): Promise<Record<string, boolean>> {
  try {
    const where = role ? `WHERE role = $1` : '';
    const params = role ? [role] : [];
    const res = await query(`SELECT permission, enabled FROM role_permissions ${where} ORDER BY permission`, params);
    const map: Record<string, boolean> = {};
    for (const r of res.rows) map[r.permission] = r.enabled;
    return map;
  } catch { return {}; }
}

export async function fetchAllRolePermissionsDB(): Promise<Record<string, Record<string, boolean>>> {
  const auth = await requireAdmin();
  if ('error' in auth) return {};
  try {
    const res = await query(`SELECT role, permission, enabled FROM role_permissions ORDER BY role, permission`);
    const map: Record<string, Record<string, boolean>> = {};
    for (const r of res.rows) {
      if (!map[r.role]) map[r.role] = {};
      map[r.role][r.permission] = r.enabled;
    }
    return map;
  } catch { return {}; }
}

export async function updateRolePermissionDB(role: string, permission: string, enabled: boolean): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return auth;
  try {
    await query(
      `INSERT INTO role_permissions (role, permission, enabled) VALUES ($1, $2, $3)
       ON CONFLICT (role, permission) DO UPDATE SET enabled = $3`,
      [role, permission, enabled]
    );
    await logAudit({ actor: auth.session, action: 'UPDATE', entityType: 'role_permission', entityId: `${role}:${permission}`, summary: `Set ${permission} = ${enabled} for role ${role}`, after: { enabled } });
    return {};
  } catch { return { error: 'Failed to update permission.' }; }
}

export async function bulkUpdateRolePermissionsDB(role: string, permissions: Record<string, boolean>): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if ('error' in auth) return auth;
  try {
    for (const [perm, enabled] of Object.entries(permissions)) {
      await query(
        `INSERT INTO role_permissions (role, permission, enabled) VALUES ($1, $2, $3)
         ON CONFLICT (role, permission) DO UPDATE SET enabled = $3`,
        [role, perm, enabled]
      );
    }
    await logAudit({ actor: auth.session, action: 'UPDATE', entityType: 'role_permission', entityId: role, summary: `Bulk-updated ${Object.keys(permissions).length} permission(s) for role ${role}`, after: permissions });
    return {};
  } catch { return { error: 'Failed to update permissions.' }; }
}

// ── Teacher Profiles ──────────────────────────────────────────────────────────

export interface TeacherProfile {
  id: string;
  userId: number;
  phone: string;
  cnic: string;
  specialization: string;
  qualification: string;
  experienceYears: number;
  joiningDate: string;
  address: string;
  profilePhoto: string | null;
  degreePhoto: string | null;
  employeeId: string | null;
  employmentType: 'fulltime' | 'parttime' | 'visiting';
  status: 'active' | 'on_leave' | 'inactive';
  payScaleId: string | null;
  designation: string | null;
}

function mapTeacherProfile(r: any): TeacherProfile {
  return {
    id: r.id, userId: r.user_id, phone: r.phone ?? '', cnic: r.cnic ?? '',
    specialization: r.specialization ?? '', qualification: r.qualification ?? '',
    experienceYears: r.experience_years ?? 0, joiningDate: r.joining_date ?? '',
    address: r.address ?? '', profilePhoto: r.profile_photo, degreePhoto: r.degree_photo,
    employeeId: r.employee_id ?? null, employmentType: r.employment_type ?? 'fulltime',
    status: r.status ?? 'active', payScaleId: r.pay_scale_id ?? null, designation: r.designation ?? null,
  };
}

export async function createTeacherWithProfileDB(
  name: string,
  email: string,
  password: string,
  profile: Omit<TeacherProfile, 'id' | 'userId'>
): Promise<{ error?: string; userId?: number }> {
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: 'Email already in use.' };
    if (profile.employeeId) {
      const dupe = await query('SELECT id FROM teacher_profiles WHERE employee_id=$1', [profile.employeeId]);
      if (dupe.rows.length) return { error: 'Employee ID already in use.' };
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, passwordHash, role: 'TEACHER' } });
    const id = `tp_${Date.now()}`;
    // employees is the canonical HR record for every staff member (teachers
    // included) — create the linked row in the same flow so this person is
    // immediately visible/editable in HR and selectable in Payroll/Leave.
    const empId = `emp_tp_${user.id}`;
    await query(
      `INSERT INTO employees (id, user_id, name, email, phone, department, designation, employment_type, joining_date, cnic, address, emergency_contact, emergency_phone, qualification, experience, status, bank_name, bank_account, profile_photo, pay_scale_id)
       VALUES ($1,$2,$3,$4,$5,'Teaching',$6,$7,$8,$9,$10,'','',$11,$12,$13,'','','',$14)`,
      [empId, user.id, name, email, profile.phone, profile.designation || '', profile.employmentType || 'fulltime',
       profile.joiningDate, profile.cnic, profile.address, profile.qualification, profile.experienceYears,
       profile.status === 'inactive' ? 'Inactive' : 'Active', profile.payScaleId || null]
    );
    await query(
      `INSERT INTO teacher_profiles (id, user_id, phone, cnic, specialization, qualification, experience_years, joining_date, address, profile_photo, degree_photo, employee_id, employment_type, status, pay_scale_id, designation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [id, user.id, profile.phone, profile.cnic, profile.specialization, profile.qualification,
       profile.experienceYears, profile.joiningDate, profile.address,
       profile.profilePhoto || null, profile.degreePhoto || null,
       profile.employeeId || null, profile.employmentType || 'fulltime', profile.status || 'active',
       profile.payScaleId || null, profile.designation || null]
    );
    return { userId: user.id };
  } catch { return { error: 'Failed to create teacher.' }; }
}

export async function fetchTeacherProfileDB(userId: number): Promise<TeacherProfile | null> {
  try {
    const res = await query('SELECT * FROM teacher_profiles WHERE user_id=$1', [userId]);
    if (!res.rows.length) return null;
    return mapTeacherProfile(res.rows[0]);
  } catch { return null; }
}

export async function fetchAllTeacherProfilesDB(): Promise<TeacherProfile[]> {
  try {
    const res = await query('SELECT * FROM teacher_profiles ORDER BY created_at DESC');
    return res.rows.map(mapTeacherProfile);
  } catch { return []; }
}

// Every other field on a teacher was permanently fixed at creation time until
// this — the Teacher module redesign's core fix. ADMIN-only, unlike the
// sibling functions above which have no session check (pre-existing gap;
// not touched here to keep this change contained — see the redesign plan).
export async function updateTeacherProfileDB(
  userId: number, data: Partial<Omit<TeacherProfile, 'id' | 'userId' | 'status'>>
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Only admins can edit teacher profiles.' };
  try {
    const fields: string[] = []; const vals: any[] = []; let i = 1;
    if (data.phone !== undefined) { fields.push(`phone=$${i++}`); vals.push(data.phone); }
    if (data.cnic !== undefined) { fields.push(`cnic=$${i++}`); vals.push(data.cnic); }
    if (data.specialization !== undefined) { fields.push(`specialization=$${i++}`); vals.push(data.specialization); }
    if (data.qualification !== undefined) { fields.push(`qualification=$${i++}`); vals.push(data.qualification); }
    if (data.experienceYears !== undefined) { fields.push(`experience_years=$${i++}`); vals.push(data.experienceYears); }
    if (data.joiningDate !== undefined) { fields.push(`joining_date=$${i++}`); vals.push(data.joiningDate); }
    if (data.address !== undefined) { fields.push(`address=$${i++}`); vals.push(data.address); }
    if (data.profilePhoto !== undefined) { fields.push(`profile_photo=$${i++}`); vals.push(data.profilePhoto); }
    if (data.degreePhoto !== undefined) { fields.push(`degree_photo=$${i++}`); vals.push(data.degreePhoto); }
    if (data.employeeId !== undefined) { fields.push(`employee_id=$${i++}`); vals.push(data.employeeId || null); }
    if (data.employmentType !== undefined) { fields.push(`employment_type=$${i++}`); vals.push(data.employmentType); }
    if (data.designation !== undefined) { fields.push(`designation=$${i++}`); vals.push(data.designation); }
    if (data.payScaleId !== undefined) { fields.push(`pay_scale_id=$${i++}`); vals.push(data.payScaleId || null); }
    if (!fields.length) return {};
    vals.push(userId);
    await query(`UPDATE teacher_profiles SET ${fields.join(',')} WHERE user_id=$${i}`, vals);

    // employees is the canonical HR record — keep the linked row's
    // overlapping fields in sync so HR/Payroll see the same data a Teacher
    // profile edit just wrote, without a second manual entry.
    const empFields: string[] = []; const empVals: any[] = []; let j = 1;
    if (data.phone !== undefined) { empFields.push(`phone=$${j++}`); empVals.push(data.phone); }
    if (data.cnic !== undefined) { empFields.push(`cnic=$${j++}`); empVals.push(data.cnic); }
    if (data.address !== undefined) { empFields.push(`address=$${j++}`); empVals.push(data.address); }
    if (data.qualification !== undefined) { empFields.push(`qualification=$${j++}`); empVals.push(data.qualification); }
    if (data.experienceYears !== undefined) { empFields.push(`experience=$${j++}`); empVals.push(data.experienceYears); }
    if (data.joiningDate !== undefined) { empFields.push(`joining_date=$${j++}`); empVals.push(data.joiningDate); }
    if (data.employmentType !== undefined) { empFields.push(`employment_type=$${j++}`); empVals.push(data.employmentType); }
    if (data.designation !== undefined) { empFields.push(`designation=$${j++}`); empVals.push(data.designation || ''); }
    if (data.payScaleId !== undefined) { empFields.push(`pay_scale_id=$${j++}`); empVals.push(data.payScaleId || null); }
    if (empFields.length) {
      empVals.push(userId);
      await query(`UPDATE employees SET ${empFields.join(',')} WHERE user_id=$${j}`, empVals);
    }

    await logAudit({
      actor: { userId: session.userId, name: session.name, role: session.role },
      action: 'UPDATE', entityType: 'teacher_profile', entityId: String(userId),
      summary: `Updated teacher profile fields: ${Object.keys(data).join(', ')}`,
    });
    return {};
  } catch { return { error: 'Failed to update teacher profile.' }; }
}

// ── Teacher status (deactivation guarded by active assignments) ────────────────

export async function updateTeacherStatusDB(userId: number, status: 'active' | 'on_leave' | 'inactive'): Promise<{ error?: string; activeAssignments?: number }> {
  try {
    if (status === 'inactive') {
      const res = await query('SELECT COUNT(*)::int as count FROM teacher_class_subjects WHERE teacher_id=$1', [userId]);
      const count = res.rows[0]?.count ?? 0;
      if (count > 0) return { error: 'This teacher has active class/subject assignments. Reassign them before deactivating.', activeAssignments: count };
    }
    await query('UPDATE teacher_profiles SET status=$1 WHERE user_id=$2', [status, userId]);
    return {};
  } catch { return { error: 'Failed to update teacher status.' }; }
}

// ── Pay Scales (HR metadata lookup, editable by Admin) ──────────────────────────

export interface PayScale { id: string; label: string; sortOrder: number; }

export async function fetchPayScalesDB(): Promise<PayScale[]> {
  try {
    const res = await query('SELECT * FROM pay_scales ORDER BY sort_order, label');
    return res.rows.map(r => ({ id: r.id, label: r.label, sortOrder: r.sort_order }));
  } catch { return []; }
}

export async function createPayScaleDB(label: string, sortOrder: number): Promise<{ error?: string; id?: string }> {
  try {
    const id = `ps_${Date.now()}`;
    await query('INSERT INTO pay_scales (id, label, sort_order) VALUES ($1,$2,$3)', [id, label, sortOrder]);
    return { id };
  } catch { return { error: 'Failed to create pay scale (label may already exist).' }; }
}

export async function deletePayScaleDB(id: string): Promise<{ error?: string }> {
  try { await query('DELETE FROM pay_scales WHERE id=$1', [id]); return {}; }
  catch { return { error: 'Failed to delete pay scale.' }; }
}

// ── Teacher Qualifications ──────────────────────────────────────────────────────

export interface TeacherQualification {
  id: string; teacherId: number; degreeTitle: string; institution: string;
  yearCompleted: number | null; specialization: string | null; certificateFilePath: string | null;
}

export async function fetchTeacherQualificationsDB(teacherId: number): Promise<TeacherQualification[]> {
  try {
    const res = await query('SELECT * FROM teacher_qualifications WHERE teacher_id=$1 ORDER BY year_completed DESC NULLS LAST', [teacherId]);
    return res.rows.map(r => ({
      id: r.id, teacherId: r.teacher_id, degreeTitle: r.degree_title, institution: r.institution ?? '',
      yearCompleted: r.year_completed, specialization: r.specialization, certificateFilePath: r.certificate_file_path,
    }));
  } catch { return []; }
}

export async function addTeacherQualificationDB(data: Omit<TeacherQualification, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `tq_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    await query(
      `INSERT INTO teacher_qualifications (id, teacher_id, degree_title, institution, year_completed, specialization, certificate_file_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, data.teacherId, data.degreeTitle, data.institution || null, data.yearCompleted || null, data.specialization || null, data.certificateFilePath || null]
    );
    return { id };
  } catch { return { error: 'Failed to add qualification.' }; }
}

export async function deleteTeacherQualificationDB(id: string): Promise<{ error?: string }> {
  try { await query('DELETE FROM teacher_qualifications WHERE id=$1', [id]); return {}; }
  catch { return { error: 'Failed to delete qualification.' }; }
}

// ── Teacher Subject Competency (qualified-to-teach, independent of assignment) ──

export interface TeacherSubjectCompetency {
  id: string; teacherId: number; subjectId: string; subjectName?: string; classId: string; className?: string;
}

export async function fetchTeacherCompetenciesDB(teacherId?: number): Promise<TeacherSubjectCompetency[]> {
  try {
    let sql = `SELECT tsc.*, sub.name as subject_name, c.name as class_name
               FROM teacher_subject_competencies tsc
               JOIN subjects sub ON tsc.subject_id = sub.id
               JOIN classes c ON tsc.class_id = c.id`;
    const params: any[] = [];
    if (teacherId !== undefined) { sql += ' WHERE tsc.teacher_id=$1'; params.push(teacherId); }
    const res = await query(sql, params);
    return res.rows.map(r => ({
      id: r.id, teacherId: r.teacher_id, subjectId: r.subject_id, subjectName: r.subject_name,
      classId: r.class_id, className: r.class_name,
    }));
  } catch { return []; }
}

export async function addTeacherCompetencyDB(teacherId: number, subjectId: string, classId: string): Promise<{ error?: string; id?: string }> {
  try {
    const id = `tsc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    await query(
      `INSERT INTO teacher_subject_competencies (id, teacher_id, subject_id, class_id) VALUES ($1,$2,$3,$4)
       ON CONFLICT (teacher_id, subject_id, class_id) DO NOTHING`,
      [id, teacherId, subjectId, classId]
    );
    return { id };
  } catch { return { error: 'Failed to add competency.' }; }
}

export async function deleteTeacherCompetencyDB(id: string): Promise<{ error?: string }> {
  try { await query('DELETE FROM teacher_subject_competencies WHERE id=$1', [id]); return {}; }
  catch { return { error: 'Failed to delete competency.' }; }
}

// ── Parents ──────────────────────────────────────────────────────────────────

export async function fetchParentsDB(): Promise<ParentRecord[]> {
  try {
    const res = await query('SELECT * FROM parents ORDER BY name ASC');
    return res.rows.map(r => ({
      id: r.id, name: r.name, email: r.email, phone: r.phone,
      studentIds: JSON.parse(r.student_ids || '[]'),
      status: r.status as 'Active' | 'Inactive',
    }));
  } catch { return []; }
}

export async function createParentDB(data: Omit<ParentRecord, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `par_${Date.now()}`;
    await query(
      `INSERT INTO parents (id, name, email, phone, student_ids, status) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, data.name, data.email, data.phone || null, JSON.stringify(data.studentIds || []), data.status]
    );
    return { id };
  } catch (err) { logServerError("features", err); return { error: 'Failed to create parent.' }; }
}

export async function updateParentDB(id: string, data: Partial<Omit<ParentRecord, 'id'>>): Promise<{ error?: string }> {
  try {
    const fields: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (data.name !== undefined)       { fields.push(`name=$${i++}`);        vals.push(data.name); }
    if (data.email !== undefined)      { fields.push(`email=$${i++}`);       vals.push(data.email); }
    if (data.phone !== undefined)      { fields.push(`phone=$${i++}`);       vals.push(data.phone); }
    if (data.studentIds !== undefined) { fields.push(`student_ids=$${i++}`); vals.push(JSON.stringify(data.studentIds)); }
    if (data.status !== undefined)     { fields.push(`status=$${i++}`);      vals.push(data.status); }
    if (!fields.length) return {};
    vals.push(id);
    await query(`UPDATE parents SET ${fields.join(',')} WHERE id=$${i}`, vals);
    return {};
  } catch { return { error: 'Failed to update parent.' }; }
}

export async function deleteParentDB(id: string): Promise<{ error?: string }> {
  try { await query('DELETE FROM parents WHERE id=$1', [id]); return {}; }
  catch { return { error: 'Failed to delete parent.' }; }
}

// ── Exam Publish ─────────────────────────────────────────────────────────────

export async function publishExamDB(id: string, published: boolean): Promise<{ error?: string }> {
  try {
    await query('UPDATE exams SET published=$1 WHERE id=$2', [published, id]);
    return {};
  } catch { return { error: 'Failed to update exam status.' }; }
}

// ── Profile ──────────────────────────────────────────────────────────────────

export async function getSessionProfileDB(): Promise<{ id: number; name: string; email: string; role: string; createdAt: Date } | null> {
  try {
    const session = await getSession();
    if (!session) return null;
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    return user;
  } catch { return null; }
}

export async function changePasswordDB(oldPassword: string, newPassword: string): Promise<{ error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { error: 'Not authenticated.' };
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return { error: 'User not found.' };
    const match = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!match) return { error: 'Current password is incorrect.' };
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return {};
  } catch { return { error: 'Failed to change password.' }; }
}

// ── Exam Sessions ─────────────────────────────────────────────────────────────

export async function fetchExamSessionsDB(): Promise<ExamSession[]> {
  try {
    const res = await query('SELECT * FROM exam_sessions ORDER BY created_at DESC');
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      term: r.term,
      deadline: r.deadline,
      status: r.status as ExamSession['status'],
      classes: r.classes || [],
      subjects: r.subjects || [],
      totalMarks: r.total_marks,
      createdAt: r.created_at,
      createdBy: r.created_by,
    }));
  } catch { return []; }
}

export async function createExamSessionDB(
  data: Omit<ExamSession, 'id'>
): Promise<{ error?: string; id?: string }> {
  try {
    const id = `es_${Date.now()}`;
    await query(
      `INSERT INTO exam_sessions (id, name, term, deadline, status, classes, subjects, total_marks, created_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id, data.name, data.term, data.deadline, data.status,
        JSON.stringify(data.classes), JSON.stringify(data.subjects),
        data.totalMarks, data.createdAt, data.createdBy,
      ]
    );
    return { id };
  } catch (err) { logServerError("features", err); return { error: 'Failed to create exam session.' }; }
}

export async function updateExamSessionStatusDB(
  id: string,
  status: ExamSession['status']
): Promise<{ error?: string }> {
  try {
    await query('UPDATE exam_sessions SET status=$1 WHERE id=$2', [status, id]);
    return {};
  } catch { return { error: 'Failed to update exam session.' }; }
}

export async function deleteExamSessionDB(id: string): Promise<{ error?: string }> {
  try {
    await query('DELETE FROM exam_marks WHERE session_id=$1', [id]);
    await query('DELETE FROM exam_sessions WHERE id=$1', [id]);
    return {};
  } catch { return { error: 'Failed to delete exam session.' }; }
}

// ── Exam Marks ────────────────────────────────────────────────────────────────

export async function fetchExamMarksBySessionDB(sessionId: string): Promise<ExamMarkEntry[]> {
  try {
    const res = await query(
      'SELECT * FROM exam_marks WHERE session_id=$1 ORDER BY class_name, subject_name',
      [sessionId]
    );
    return res.rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      subjectName: r.subject_name,
      className: r.class_name,
      teacherId: r.teacher_id,
      teacherName: r.teacher_name,
      studentResults: r.student_results || [],
      status: r.status as ExamMarkEntry['status'],
      submittedAt: r.submitted_at,
    }));
  } catch { return []; }
}

export async function fetchExamMarksByTeacherDB(teacherId: number): Promise<ExamMarkEntry[]> {
  try {
    const res = await query(
      'SELECT * FROM exam_marks WHERE teacher_id=$1 ORDER BY session_id, class_name, subject_name',
      [teacherId]
    );
    return res.rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      subjectName: r.subject_name,
      className: r.class_name,
      teacherId: r.teacher_id,
      teacherName: r.teacher_name,
      studentResults: r.student_results || [],
      status: r.status as ExamMarkEntry['status'],
      submittedAt: r.submitted_at,
    }));
  } catch { return []; }
}

export async function fetchExamMarksForTeacherDB(
  sessionId: string,
  className: string,
  subjectName: string
): Promise<ExamMarkEntry | null> {
  try {
    const res = await query(
      'SELECT * FROM exam_marks WHERE session_id=$1 AND class_name=$2 AND subject_name=$3 LIMIT 1',
      [sessionId, className, subjectName]
    );
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      sessionId: r.session_id,
      subjectName: r.subject_name,
      className: r.class_name,
      teacherId: r.teacher_id,
      teacherName: r.teacher_name,
      studentResults: r.student_results || [],
      status: r.status as ExamMarkEntry['status'],
      submittedAt: r.submitted_at,
    };
  } catch { return null; }
}

export async function upsertExamMarksDB(data: {
  sessionId: string;
  subjectName: string;
  className: string;
  teacherId: number;
  teacherName: string;
  studentResults: StudentExamScore[];
  status: 'pending' | 'submitted';
}): Promise<{ error?: string; id?: string }> {
  try {
    const existing = await query(
      'SELECT id FROM exam_marks WHERE session_id=$1 AND class_name=$2 AND subject_name=$3',
      [data.sessionId, data.className, data.subjectName]
    );
    const submittedAt = data.status === 'submitted' ? new Date().toISOString().split('T')[0] : null;
    if (existing.rows.length > 0) {
      const id = existing.rows[0].id;
      await query(
        `UPDATE exam_marks SET teacher_id=$1, teacher_name=$2, student_results=$3, status=$4, submitted_at=$5
         WHERE id=$6`,
        [data.teacherId, data.teacherName, JSON.stringify(data.studentResults), data.status, submittedAt, id]
      );
      return { id };
    } else {
      const id = `em_${Date.now()}`;
      await query(
        `INSERT INTO exam_marks (id, session_id, subject_name, class_name, teacher_id, teacher_name, student_results, status, submitted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, data.sessionId, data.subjectName, data.className, data.teacherId, data.teacherName,
         JSON.stringify(data.studentResults), data.status, submittedAt]
      );
      return { id };
    }
  } catch (err) { logServerError("features", err); return { error: 'Failed to save marks.' }; }
}

// ── Class Compilations ────────────────────────────────────────────────────────

export async function fetchClassCompilationsDB(sessionId?: string): Promise<ClassCompilation[]> {
  try {
    let sql = 'SELECT * FROM class_compilations';
    const params: any[] = [];
    if (sessionId) { sql += ' WHERE session_id=$1'; params.push(sessionId); }
    sql += ' ORDER BY submitted_at DESC';
    const res = await query(sql, params);
    return res.rows.map(r => ({
      id: r.id, sessionId: r.session_id, className: r.class_name,
      teacherName: r.teacher_name, status: r.status as ClassCompilation['status'],
      submittedAt: r.submitted_at, adminNotes: r.admin_notes,
    }));
  } catch { return []; }
}

export async function fetchAllMarksForClassesDB(classNames: string[]): Promise<ExamMarkEntry[]> {
  if (!classNames.length) return [];
  try {
    const placeholders = classNames.map((_, i) => `$${i + 1}`).join(',');
    const res = await query(
      `SELECT * FROM exam_marks WHERE class_name IN (${placeholders}) ORDER BY session_id, class_name, subject_name`,
      classNames
    );
    return res.rows.map(r => ({
      id: r.id, sessionId: r.session_id, subjectName: r.subject_name,
      className: r.class_name, teacherId: r.teacher_id, teacherName: r.teacher_name,
      studentResults: r.student_results || [], status: r.status as ExamMarkEntry['status'],
      submittedAt: r.submitted_at,
    }));
  } catch { return []; }
}

export async function submitClassCompilationDB(
  sessionId: string,
  className: string,
  teacherName: string
): Promise<{ error?: string; id?: string }> {
  try {
    const existing = await query(
      'SELECT id, status FROM class_compilations WHERE session_id=$1 AND class_name=$2',
      [sessionId, className]
    );
    const now = new Date().toISOString().split('T')[0];
    let id: string;
    if (existing.rows.length > 0) {
      id = existing.rows[0].id;
      if (existing.rows[0].status === 'approved') return { error: 'Already approved by admin.' };
      await query(
        'UPDATE class_compilations SET status=$1, submitted_at=$2, teacher_name=$3 WHERE id=$4',
        ['submitted', now, teacherName, id]
      );
    } else {
      id = `cc_${Date.now()}`;
      await query(
        `INSERT INTO class_compilations (id, session_id, class_name, teacher_name, status, submitted_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, sessionId, className, teacherName, 'submitted', now]
      );
    }
    // Mark all submitted exam_marks for this session+class as reviewed
    await query(
      `UPDATE exam_marks SET status='reviewed' WHERE session_id=$1 AND class_name=$2 AND status='submitted'`,
      [sessionId, className]
    );
    return { id };
  } catch (err) { logServerError("features", err); return { error: 'Failed to submit compilation.' }; }
}

// ── Teacher Subject Assignments ───────────────────────────────────────────────

export async function fetchTeacherSubjectAssignmentsDB(teacherId?: number): Promise<TeacherSubjectAssignment[]> {
  try {
    let sql = 'SELECT * FROM teacher_subject_assignments';
    const params: any[] = [];
    if (teacherId !== undefined) {
      sql += ' WHERE teacher_id=$1';
      params.push(teacherId);
    }
    sql += ' ORDER BY class_name, subject_name';
    const res = await query(sql, params);
    return res.rows.map(r => ({
      id: r.id,
      teacherId: r.teacher_id,
      teacherName: r.teacher_name,
      subjectName: r.subject_name,
      className: r.class_name,
    }));
  } catch { return []; }
}

export async function createTeacherSubjectAssignmentDB(
  data: Omit<TeacherSubjectAssignment, 'id'>
): Promise<{ error?: string; id?: string }> {
  try {
    const existing = await query(
      'SELECT id FROM teacher_subject_assignments WHERE teacher_id=$1 AND subject_name=$2 AND class_name=$3',
      [data.teacherId, data.subjectName, data.className]
    );
    if (existing.rows.length > 0) return { error: 'This assignment already exists.' };
    const id = `tsa_${Date.now()}`;
    await query(
      `INSERT INTO teacher_subject_assignments (id, teacher_id, teacher_name, subject_name, class_name)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, data.teacherId, data.teacherName, data.subjectName, data.className]
    );
    return { id };
  } catch (err) { logServerError("features", err); return { error: 'Failed to create assignment.' }; }
}

export async function deleteTeacherSubjectAssignmentDB(id: string): Promise<{ error?: string }> {
  try {
    await query('DELETE FROM teacher_subject_assignments WHERE id=$1', [id]);
    return {};
  } catch { return { error: 'Failed to delete assignment.' }; }
}

// ── Phase 5: Approval + Position Calculation ──────────────────────────────────

export async function approveClassCompilationDB(
  compilationId: string,
  sessionId: string,
  className: string
): Promise<{ error?: string }> {
  try {
    await query("UPDATE class_compilations SET status='approved' WHERE id=$1", [compilationId]);

    const sessionRes = await query("SELECT * FROM exam_sessions WHERE id=$1", [sessionId]);
    if (!sessionRes.rows.length) return { error: 'Session not found.' };
    const sess = sessionRes.rows[0];
    const subjects: string[] = sess.subjects || [];
    const totalMarksPerSubject: number = sess.total_marks;
    const allSessionClasses: string[] = sess.classes || [];
    const maxPossible = totalMarksPerSubject * subjects.length;

    // Derive grade name (e.g. "Grade 8-A" → "Grade 8")
    const dashIdx = className.lastIndexOf('-');
    const gradeName = dashIdx > 0 ? className.slice(0, dashIdx) : className;

    // All session classes in same grade
    const gradeClasses = allSessionClasses.filter(c => {
      const di = c.lastIndexOf('-');
      return (di > 0 ? c.slice(0, di) : c) === gradeName;
    });

    // Build section student totals
    type StuData = { studentId: string; studentName: string; total: number; subjectScores: { subject: string; score: number }[] };
    const sectionMap = new Map<string, StuData>();
    const marksRes = await query(
      "SELECT * FROM exam_marks WHERE session_id=$1 AND class_name=$2",
      [sessionId, className]
    );
    for (const row of marksRes.rows) {
      for (const r of (row.student_results || []) as StudentExamScore[]) {
        if (!sectionMap.has(r.studentId)) {
          sectionMap.set(r.studentId, { studentId: r.studentId, studentName: r.studentName, total: 0, subjectScores: [] });
        }
        const stu = sectionMap.get(r.studentId)!;
        stu.total += r.score;
        stu.subjectScores.push({ subject: row.subject_name, score: r.score });
      }
    }
    const sectionStudents = [...sectionMap.values()].sort((a, b) => b.total - a.total);
    const sectionTotal = sectionStudents.length;

    // Build grade-wide totals (across all classes in same grade)
    const gradeMap = new Map<string, number>();
    for (const gc of gradeClasses) {
      const gcRes = await query("SELECT * FROM exam_marks WHERE session_id=$1 AND class_name=$2", [sessionId, gc]);
      for (const row of gcRes.rows) {
        for (const r of (row.student_results || []) as StudentExamScore[]) {
          gradeMap.set(r.studentId, (gradeMap.get(r.studentId) ?? 0) + r.score);
        }
      }
    }
    const gradeSorted = [...gradeMap.entries()].sort((a, b) => b[1] - a[1]);
    const gradeTotal = gradeSorted.length;
    const gradePosMap = new Map<string, number>();
    gradeSorted.forEach(([sid], i) => gradePosMap.set(sid, i + 1));

    // Wipe existing positions for this class+session, then insert fresh
    await query("DELETE FROM result_positions WHERE session_id=$1 AND class_name=$2", [sessionId, className]);
    const now = new Date().toISOString().split('T')[0];
    for (let i = 0; i < sectionStudents.length; i++) {
      const s = sectionStudents[i];
      const gradePos = gradePosMap.get(s.studentId) ?? 0;
      const pct = maxPossible > 0 ? ((s.total / maxPossible) * 100).toFixed(2) : '0.00';
      const id = `rp_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`;
      await query(
        `INSERT INTO result_positions
         (id, session_id, class_name, grade_name, student_id, student_name, total_marks, max_possible, percentage,
          section_position, section_total, grade_position, grade_total, subject_scores, calculated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [id, sessionId, className, gradeName, s.studentId, s.studentName,
         s.total, maxPossible, pct, i + 1, sectionTotal, gradePos, gradeTotal,
         JSON.stringify(s.subjectScores), now]
      );
    }
    return {};
  } catch (err) { logServerError("features", err); return { error: 'Failed to approve compilation.' }; }
}

export async function rejectClassCompilationDB(
  compilationId: string,
  adminNotes: string
): Promise<{ error?: string }> {
  try {
    const compRes = await query("SELECT session_id, class_name FROM class_compilations WHERE id=$1", [compilationId]);
    if (!compRes.rows.length) return { error: 'Compilation not found.' };
    const { session_id, class_name } = compRes.rows[0];

    await query(
      "UPDATE class_compilations SET status='rejected', admin_notes=$1 WHERE id=$2",
      [adminNotes, compilationId]
    );
    // Revert reviewed marks → submitted so class teacher can re-verify and re-submit
    await query(
      "UPDATE exam_marks SET status='submitted' WHERE session_id=$1 AND class_name=$2 AND status='reviewed'",
      [session_id, class_name]
    );
    return {};
  } catch (err) { logServerError("features", err); return { error: 'Failed to reject compilation.' }; }
}

export async function fetchResultPositionsDB(
  sessionId: string,
  className?: string
): Promise<ResultPosition[]> {
  try {
    let sql = "SELECT * FROM result_positions WHERE session_id=$1";
    const params: any[] = [sessionId];
    if (className) { sql += " AND class_name=$2"; params.push(className); }
    sql += " ORDER BY class_name, section_position";
    const res = await query(sql, params);
    return res.rows.map(r => ({
      id: r.id, sessionId: r.session_id, className: r.class_name, gradeName: r.grade_name,
      studentId: r.student_id, studentName: r.student_name,
      totalMarks: r.total_marks, maxPossible: r.max_possible,
      percentage: parseFloat(r.percentage),
      sectionPosition: r.section_position, sectionTotal: r.section_total,
      gradePosition: r.grade_position, gradeTotal: r.grade_total,
      subjectScores: r.subject_scores || [],
      calculatedAt: r.calculated_at,
    }));
  } catch { return []; }
}

// ── Phase 6: Publish + Student Result Lookup ──────────────────────────────────

export async function publishSessionDB(
  sessionId: string,
  publish: boolean
): Promise<{ error?: string }> {
  try {
    await query(
      'UPDATE exam_sessions SET status=$1 WHERE id=$2',
      [publish ? 'published' : 'approved', sessionId]
    );
    return {};
  } catch (err) { logServerError("features", err); return { error: 'Failed to update session status.' }; }
}

export async function fetchPublishedResultsForStudentDB(
  studentId: string,
  className: string
): Promise<{ session: ExamSession; position: ResultPosition }[]> {
  try {
    const sessRes = await query(
      "SELECT * FROM exam_sessions WHERE status='published' ORDER BY created_at DESC"
    );
    const sessions: ExamSession[] = sessRes.rows.map(r => ({
      id: r.id, name: r.name, term: r.term, deadline: r.deadline,
      status: r.status as ExamSession['status'],
      classes: r.classes || [], subjects: r.subjects || [],
      totalMarks: r.total_marks, createdAt: r.created_at, createdBy: r.created_by,
    })).filter(s => s.classes.includes(className));

    const results: { session: ExamSession; position: ResultPosition }[] = [];
    for (const session of sessions) {
      const posRes = await query(
        'SELECT * FROM result_positions WHERE session_id=$1 AND student_id=$2 LIMIT 1',
        [session.id, studentId]
      );
      if (!posRes.rows.length) continue;
      const r = posRes.rows[0];
      results.push({
        session,
        position: {
          id: r.id, sessionId: r.session_id, className: r.class_name, gradeName: r.grade_name,
          studentId: r.student_id, studentName: r.student_name,
          totalMarks: r.total_marks, maxPossible: r.max_possible,
          percentage: parseFloat(r.percentage),
          sectionPosition: r.section_position, sectionTotal: r.section_total,
          gradePosition: r.grade_position, gradeTotal: r.grade_total,
          subjectScores: r.subject_scores || [],
          calculatedAt: r.calculated_at,
        },
      });
    }
    return results;
  } catch (err) { logServerError("features", err); return []; }
}

// ── Profile Photo ─────────────────────────────────────────────────────────────

export async function fetchProfilePhotoAction(): Promise<string | null> {
  try {
    const session = await getSession();
    if (!session) return null;
    if (session.role === 'STUDENT') {
      const sr = await query('SELECT name FROM students WHERE email=$1 LIMIT 1', [session.email]);
      if (!sr.rows.length) return null;
      const [firstName, ...rest] = (sr.rows[0].name as string).trim().split(' ');
      const lastName = rest.join(' ');
      const ar = await query(
        'SELECT profile_photo FROM admission_applications WHERE first_name=$1 AND last_name=$2 AND profile_photo IS NOT NULL LIMIT 1',
        [firstName, lastName]
      );
      return ar.rows[0]?.profile_photo ?? null;
    }
    if (session.role === 'PARENT') {
      const ar = await query(
        'SELECT profile_photo FROM admission_applications WHERE parent_email=$1 AND profile_photo IS NOT NULL LIMIT 1',
        [session.email]
      );
      return ar.rows[0]?.profile_photo ?? null;
    }
    return null;
  } catch { return null; }
}

// ── LMS / Courses ──────────────────────────────────────────────────────────────
export async function fetchCoursesDB(gradeLevel?: string): Promise<import('@/lib/types').Course[]> {
  try {
    let sql = 'SELECT * FROM courses';
    const params: string[] = [];
    if (gradeLevel) { params.push(gradeLevel); sql += ` WHERE grade_level=$${params.length}`; }
    sql += ' ORDER BY title';
    const res = await query(sql, params);
    return res.rows.map(r => ({ id: r.id, title: r.title, code: r.code, description: r.description, gradeLevel: r.grade_level, teacherName: r.teacher_name, credits: r.credits, learningOutcomes: r.learning_outcomes || [], prerequisites: r.prerequisites || [], isActive: r.is_active }));
  } catch { return []; }
}

export async function createCourseDB(data: Omit<import('@/lib/types').Course, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `crs_${Date.now()}`;
    await query(`INSERT INTO courses (id, title, code, description, grade_level, teacher_name, credits, learning_outcomes, prerequisites, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, data.title, data.code, data.description, data.gradeLevel, data.teacherName, data.credits, data.learningOutcomes, data.prerequisites, data.isActive]);
    return { id };
  } catch (err: any) { return { error: err?.message || 'Failed to create course.' }; }
}

export async function updateCourseDB(id: string, data: Partial<import('@/lib/types').Course>): Promise<{ error?: string }> {
  try {
    const fields: string[] = []; const vals: any[] = []; let i = 1;
    if (data.title !== undefined) { fields.push(`title=$${i++}`); vals.push(data.title); }
    if (data.description !== undefined) { fields.push(`description=$${i++}`); vals.push(data.description); }
    if (data.teacherName !== undefined) { fields.push(`teacher_name=$${i++}`); vals.push(data.teacherName); }
    if (data.credits !== undefined) { fields.push(`credits=$${i++}`); vals.push(data.credits); }
    if (data.isActive !== undefined) { fields.push(`is_active=$${i++}`); vals.push(data.isActive); }
    if (data.gradeLevel !== undefined) { fields.push(`grade_level=$${i++}`); vals.push(data.gradeLevel); }
    if (data.learningOutcomes !== undefined) { fields.push(`learning_outcomes=$${i++}`); vals.push(data.learningOutcomes); }
    if (data.prerequisites !== undefined) { fields.push(`prerequisites=$${i++}`); vals.push(data.prerequisites); }
    if (!fields.length) return {};
    vals.push(id);
    await query(`UPDATE courses SET ${fields.join(',')} WHERE id=$${i}`, vals);
    return {};
  } catch { return { error: 'Failed to update course.' }; }
}

export async function deleteCourseDB(id: string): Promise<{ error?: string }> {
  try { await query('DELETE FROM courses WHERE id=$1', [id]); return {}; } catch { return { error: 'Failed to delete course.' }; }
}

// ── Course Materials (Notes + Video Lectures) ───────────────────────────────
// Notes are stored as base64 data URIs (type='document'), the same
// readAsDataURL pattern already used for photo uploads elsewhere in this app —
// no blob storage exists here, and study notes are small enough for this to
// be fine. Video Lectures (type='video') store a YouTube/Vimeo URL, embedded
// via iframe — actual video file upload isn't attempted, base64-in-DB doesn't
// scale to video file sizes and there's no alternative storage in this codebase.

async function requireCourseMaterialWriteAccess(courseId: string): Promise<{ userId: number; name: string; role: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role === 'ADMIN') return { userId: session.userId, name: session.name, role: session.role };
  if (session.role !== 'TEACHER') return { error: 'Only admins and teachers can manage course materials.' };
  const courseRes = await query('SELECT teacher_name FROM courses WHERE id=$1', [courseId]);
  if (courseRes.rows.length === 0) return { error: 'Course not found.' };
  if (courseRes.rows[0].teacher_name !== session.name) {
    return { error: 'You can only manage materials for your own courses.' };
  }
  return { userId: session.userId, name: session.name, role: session.role };
}

export async function fetchCourseMaterialsDB(courseId: string): Promise<import('@/lib/types').CourseMaterial[]> {
  const session = await getSession();
  if (!session) return [];
  try {
    const res = await query('SELECT * FROM course_materials WHERE course_id=$1 ORDER BY created_at DESC', [courseId]);
    return res.rows.map(r => ({
      id: r.id, courseId: r.course_id, title: r.title, type: r.type, url: r.url,
      fileName: r.file_name, description: r.description, createdByName: r.created_by_name, createdAt: r.created_at,
    }));
  } catch { return []; }
}

export async function createCourseMaterialDB(data: {
  courseId: string; title: string; type: 'video' | 'document'; url: string; fileName?: string; description?: string;
}): Promise<{ error?: string; id?: string }> {
  const auth = await requireCourseMaterialWriteAccess(data.courseId);
  if ('error' in auth) return { error: auth.error };
  if (!data.title.trim() || !data.url.trim()) return { error: 'Title and content are required.' };
  try {
    const id = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await query(
      `INSERT INTO course_materials (id, course_id, title, type, url, file_name, description, created_by_user_id, created_by_name, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, data.courseId, data.title.trim(), data.type, data.url, data.fileName || null, data.description || null, auth.userId, auth.name, new Date().toISOString()]
    );
    return { id };
  } catch { return { error: 'Failed to add material.' }; }
}

export async function deleteCourseMaterialDB(id: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  try {
    const res = await query('SELECT course_id FROM course_materials WHERE id=$1', [id]);
    if (res.rows.length === 0) return {};
    const auth = await requireCourseMaterialWriteAccess(res.rows[0].course_id);
    if ('error' in auth) return { error: auth.error };
    await query('DELETE FROM course_materials WHERE id=$1', [id]);
    return {};
  } catch { return { error: 'Failed to delete material.' }; }
}

// Library ────────────────────────────────────────────────────────────────────
export async function fetchLibraryBooksDB(category?: string): Promise<import('@/lib/types').LibraryBook[]> {
  try {
    let sql = 'SELECT * FROM library_books';
    const params: string[] = [];
    if (category) { params.push(category); sql += ` WHERE category=$${params.length}`; }
    sql += ' ORDER BY title';
    const res = await query(sql, params);
    return res.rows.map(r => ({ id: r.id, title: r.title, author: r.author, isbn: r.isbn, category: r.category, publisher: r.publisher, publishYear: r.publish_year, totalCopies: r.total_copies, availableCopies: r.available_copies, rackNumber: r.rack_number, barcode: r.barcode, isDigital: r.is_digital, digitalUrl: r.digital_url, status: r.status }));
  } catch { return []; }
}

export async function createLibraryBookDB(data: Omit<import('@/lib/types').LibraryBook, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `lb_${Date.now()}`;
    await query(`INSERT INTO library_books (id, title, author, isbn, category, publisher, publish_year, total_copies, available_copies, rack_number, barcode, is_digital, digital_url, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, data.title, data.author, data.isbn, data.category, data.publisher, data.publishYear, data.totalCopies, data.availableCopies, data.rackNumber, data.barcode, data.isDigital, data.digitalUrl, data.status]);
    return { id };
  } catch (err: any) { return { error: err?.message || 'Failed.' }; }
}

export async function issueBookDB(bookId: string, studentId: string, studentName: string, dueDate: string): Promise<{ error?: string }> {
  try {
    const bookRes = await query('SELECT title, available_copies FROM library_books WHERE id=$1', [bookId]);
    if (!bookRes.rows.length) return { error: 'Book not found.' };
    if (bookRes.rows[0].available_copies < 1) return { error: 'No copies available.' };
    const id = `bi_${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];
    await query(`INSERT INTO book_issues (id, book_id, book_title, student_id, student_name, issued_date, due_date, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, bookId, bookRes.rows[0].title, studentId, studentName, today, dueDate, 'Issued']);
    await query('UPDATE library_books SET available_copies = available_copies - 1 WHERE id=$1', [bookId]);
    return {};
  } catch { return { error: 'Failed to issue book.' }; }
}

export async function returnBookDB(issueId: string): Promise<{ error?: string }> {
  try {
    const res = await query('SELECT book_id, due_date, status FROM book_issues WHERE id=$1', [issueId]);
    if (!res.rows.length) return { error: 'Issue not found.' };
    const { book_id, due_date, status } = res.rows[0];
    if (status === 'Returned') return { error: 'Book already returned.' };
    const today = new Date().toISOString().split('T')[0];
    const fine = today > due_date ? Math.ceil((Date.parse(today) - Date.parse(due_date)) / (1000*60*60*24)) * 10 : 0;
    await query('UPDATE book_issues SET status=$1, returned_date=$2, fine=$3 WHERE id=$4', ['Returned', today, fine, issueId]);
    await query('UPDATE library_books SET available_copies = available_copies + 1 WHERE id=$1', [book_id]);
    return {};
  } catch { return { error: 'Failed to return book.' }; }
}

export async function fetchBookIssuesDB(studentId?: string): Promise<import('@/lib/types').BookIssue[]> {
  try {
    let sql = 'SELECT * FROM book_issues';
    const params: string[] = [];
    if (studentId) { params.push(studentId); sql += ` WHERE student_id=$${params.length}`; }
    sql += ' ORDER BY issued_date DESC';
    const res = await query(sql, params);
    return res.rows.map(r => ({ id: r.id, bookId: r.book_id, bookTitle: r.book_title, studentId: r.student_id, studentName: r.student_name, issuedDate: r.issued_date, dueDate: r.due_date, returnedDate: r.returned_date, status: r.status, fine: r.fine, finePaid: r.fine_paid }));
  } catch { return []; }
}

export async function payBookFineDB(issueId: string): Promise<{ error?: string }> {
  try { await query('UPDATE book_issues SET fine_paid=true WHERE id=$1', [issueId]); return {}; }
  catch { return { error: 'Failed.' }; }
}

export async function deleteLibraryBookDB(id: string): Promise<{ error?: string }> {
  try { await query('DELETE FROM library_books WHERE id=$1', [id]); return {}; } catch { return { error: 'Failed.' }; }
}

// Hostel ──────────────────────────────────────────────────────────────────────
export async function fetchHostelsDB(): Promise<import('@/lib/types').Hostel[]> {
  try { const res = await query('SELECT * FROM hostels ORDER BY name'); return res.rows.map(r => ({ id: r.id, name: r.name, type: r.type, wardenName: r.warden_name, contactPhone: r.contact_phone, totalRooms: r.total_rooms, totalBeds: r.total_beds, address: r.address })); } catch { return []; }
}

export async function createHostelDB(data: Omit<import('@/lib/types').Hostel, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `hst_${Date.now()}`;
    await query(`INSERT INTO hostels (id, name, type, warden_name, contact_phone, total_rooms, total_beds, address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, data.name, data.type, data.wardenName, data.contactPhone, data.totalRooms, data.totalBeds, data.address]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

export async function fetchHostelRoomsDB(hostelId: string): Promise<import('@/lib/types').HostelRoom[]> {
  try {
    const res = await query('SELECT * FROM hostel_rooms WHERE hostel_id=$1 ORDER BY room_number', [hostelId]);
    return res.rows.map(r => ({ id: r.id, hostelId: r.hostel_id, roomNumber: r.room_number, floor: r.floor, totalBeds: r.total_beds, occupiedBeds: r.occupied_beds, monthlyFee: r.monthly_fee, isActive: r.is_active }));
  } catch { return []; }
}

export async function createHostelRoomDB(data: Omit<import('@/lib/types').HostelRoom, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `hr_${Date.now()}`;
    await query(`INSERT INTO hostel_rooms (id, hostel_id, room_number, floor, total_beds, occupied_beds, monthly_fee, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, data.hostelId, data.roomNumber, data.floor, data.totalBeds, data.occupiedBeds, data.monthlyFee, data.isActive]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

export async function allocateHostelDB(data: Omit<import('@/lib/types').HostelAllocation, 'id'>): Promise<{ error?: string }> {
  try {
    const id = `ha_${Date.now()}`;
    await query(`INSERT INTO hostel_allocations (id, hostel_id, hostel_name, room_id, room_number, student_id, student_name, start_date, end_date, status, fee_amount, fee_paid) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, data.hostelId, data.hostelName, data.roomId, data.roomNumber, data.studentId, data.studentName, data.startDate, data.endDate, data.status, data.feeAmount, data.feePaid]);
    await query('UPDATE hostel_rooms SET occupied_beds = occupied_beds + 1 WHERE id=$1', [data.roomId]);
    return {};
  } catch { return { error: 'Failed.' }; }
}

export async function fetchHostelAllocationsDB(hostelId?: string): Promise<import('@/lib/types').HostelAllocation[]> {
  try {
    let sql = 'SELECT * FROM hostel_allocations';
    const params: string[] = [];
    if (hostelId) { params.push(hostelId); sql += ` WHERE hostel_id=$${params.length}`; }
    sql += ' ORDER BY start_date DESC';
    const res = await query(sql, params);
    return res.rows.map(r => ({ id: r.id, hostelId: r.hostel_id, hostelName: r.hostel_name, roomId: r.room_id, roomNumber: r.room_number, studentId: r.student_id, studentName: r.student_name, startDate: r.start_date, endDate: r.end_date, status: r.status, feeAmount: r.fee_amount, feePaid: r.fee_paid }));
  } catch { return []; }
}

// Transport ───────────────────────────────────────────────────────────────────
export async function fetchTransportRoutesDB(): Promise<import('@/lib/types').TransportRoute[]> {
  try { const res = await query('SELECT * FROM transport_routes ORDER BY route_name'); return res.rows.map(r => ({ id: r.id, routeName: r.route_name, startPoint: r.start_point, endPoint: r.end_point, stops: r.stops || [], distance: r.distance, feeAmount: r.fee_amount, isActive: r.is_active })); } catch { return []; }
}

export async function createTransportRouteDB(data: Omit<import('@/lib/types').TransportRoute, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `tr_${Date.now()}`;
    await query(`INSERT INTO transport_routes (id, route_name, start_point, end_point, stops, distance, fee_amount, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, data.routeName, data.startPoint, data.endPoint, JSON.stringify(data.stops), data.distance, data.feeAmount, data.isActive]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

export async function fetchTransportVehiclesDB(routeId?: string): Promise<import('@/lib/types').TransportVehicle[]> {
  try {
    let sql = 'SELECT * FROM transport_vehicles';
    const params: string[] = [];
    if (routeId) { params.push(routeId); sql += ` WHERE route_id=$${params.length}`; }
    sql += ' ORDER BY vehicle_number';
    const res = await query(sql, params);
    return res.rows.map(r => ({ id: r.id, vehicleNumber: r.vehicle_number, type: r.type, capacity: r.capacity, routeId: r.route_id, driverName: r.driver_name, driverPhone: r.driver_phone, registrationDate: r.registration_date, fitnessExpiry: r.fitness_expiry, insuranceExpiry: r.insurance_expiry, isActive: r.is_active }));
  } catch { return []; }
}

// HR ──────────────────────────────────────────────────────────────────────────
export async function fetchEmployeesDB(): Promise<import('@/lib/types').EmployeeRecord[]> {
  const session = await getSession();
  if (!session) return [];
  try { const res = await query('SELECT * FROM employees ORDER BY name'); return res.rows.map(r => ({ id: r.id, userId: r.user_id, name: r.name, email: r.email, phone: r.phone, department: r.department, designation: r.designation, employmentType: r.employment_type, joiningDate: r.joining_date, cnic: r.cnic, address: r.address, emergencyContact: r.emergency_contact, emergencyPhone: r.emergency_phone, qualification: r.qualification, experience: r.experience, status: r.status, bankName: r.bank_name, bankAccount: r.bank_account, profilePhoto: r.profile_photo, payScaleId: r.pay_scale_id ?? null })); } catch { return []; }
}

// Every staff member (teaching or not) is fundamentally a `users` row —
// this replaces the old createEmployeeDB, which never created a login and
// always wrote user_id=0, making every HR-added "employee" a phantom record
// invisible to Payroll/Leave. ADMIN-only.
export async function createStaffEmployeeDB(
  name: string, email: string, password: string,
  data: Omit<import('@/lib/types').EmployeeRecord, 'id' | 'userId' | 'name' | 'email'>
): Promise<{ error?: string; userId?: number }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Only admins can add staff.' };
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: 'Email already in use.' };
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, passwordHash, role: 'EMPLOYEE' } });
    const id = `emp_${Date.now()}`;
    await query(`INSERT INTO employees (id, user_id, name, email, phone, department, designation, employment_type, joining_date, cnic, address, emergency_contact, emergency_phone, qualification, experience, status, bank_name, bank_account, profile_photo, pay_scale_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [id, user.id, name, email, data.phone, data.department, data.designation, data.employmentType, data.joiningDate, data.cnic, data.address, data.emergencyContact, data.emergencyPhone, data.qualification, data.experience, data.status, data.bankName, data.bankAccount, data.profilePhoto, (data as any).payScaleId || null]);
    return { userId: user.id };
  } catch (err: any) { return { error: err?.message || 'Failed to create staff member.' }; }
}

export async function updateEmployeeDB(userId: number, data: Partial<Omit<import('@/lib/types').EmployeeRecord, 'id' | 'userId'>>): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Only admins can edit staff.' };
  try {
    const fields: string[] = []; const vals: any[] = []; let i = 1;
    const colMap: Record<string, string> = { phone: 'phone', department: 'department', designation: 'designation', employmentType: 'employment_type', joiningDate: 'joining_date', cnic: 'cnic', address: 'address', emergencyContact: 'emergency_contact', emergencyPhone: 'emergency_phone', qualification: 'qualification', experience: 'experience', status: 'status', bankName: 'bank_name', bankAccount: 'bank_account', profilePhoto: 'profile_photo', payScaleId: 'pay_scale_id' };
    for (const [key, col] of Object.entries(colMap)) {
      const v = (data as any)[key];
      if (v !== undefined) { fields.push(`${col}=$${i++}`); vals.push(v); }
    }
    if (!fields.length) return {};
    vals.push(userId);
    await query(`UPDATE employees SET ${fields.join(',')} WHERE user_id=$${i}`, vals);
    // Keep the linked Teacher profile's overlapping fields in sync too.
    await query(
      `UPDATE teacher_profiles SET
         phone = COALESCE($1, phone), cnic = COALESCE($2, cnic), address = COALESCE($3, address),
         qualification = COALESCE($4, qualification), experience_years = COALESCE($5, experience_years),
         joining_date = COALESCE($6, joining_date), employment_type = COALESCE($7, employment_type),
         designation = COALESCE($8, designation), pay_scale_id = COALESCE($9, pay_scale_id)
       WHERE user_id=$10`,
      [data.phone ?? null, data.cnic ?? null, data.address ?? null, data.qualification ?? null,
       data.experience ?? null, data.joiningDate ?? null, data.employmentType ?? null,
       data.designation ?? null, (data as any).payScaleId ?? null, userId]
    );
    return {};
  } catch { return { error: 'Failed to update staff member.' }; }
}

export async function deleteEmployeeDB(userId: number): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Only admins can remove staff.' };
  try { await query('DELETE FROM employees WHERE user_id=$1', [userId]); return {}; }
  catch { return { error: 'Failed to remove staff member.' }; }
}

// Powers every staff picker (Leave, Salary Structures, Payslips, Performance)
// — real people only, sourced from users+employees, never hand-typed again.
export async function fetchStaffDirectoryDB(): Promise<{ userId: number; name: string; role: string; department: string; designation: string; payScaleId: string | null }[]> {
  const session = await getSession();
  if (!session) return [];
  try {
    const res = await query(
      `SELECT u.id as user_id, u.name, u.role, e.department, e.designation, e.pay_scale_id
       FROM users u JOIN employees e ON e.user_id = u.id
       WHERE u.role IN ('ADMIN','TEACHER','EMPLOYEE')
       ORDER BY u.name`
    );
    return res.rows.map(r => ({ userId: r.user_id, name: r.name, role: r.role, department: r.department, designation: r.designation, payScaleId: r.pay_scale_id }));
  } catch { return []; }
}

export async function fetchLeaveRequestsDB(employeeId?: number): Promise<import('@/lib/types').LeaveRequest[]> {
  const session = await getSession();
  if (!session) return [];
  // Non-admins may only see their own leave requests (self-service).
  if (session.role !== 'ADMIN') employeeId = session.userId;
  try {
    let sql = 'SELECT * FROM leave_requests';
    const params: any[] = [];
    if (employeeId !== undefined) { params.push(employeeId); sql += ` WHERE employee_id=$${params.length}`; }
    sql += ' ORDER BY applied_at DESC';
    const res = await query(sql, params);
    return res.rows.map(r => ({ id: r.id, employeeId: r.employee_id, employeeName: r.employee_name, leaveType: r.leave_type, startDate: r.start_date, endDate: r.end_date, totalDays: r.total_days, reason: r.reason, status: r.status, approvedBy: r.approved_by, appliedAt: r.applied_at }));
  } catch { return []; }
}

// Any authenticated staff member can self-submit; admins can submit on
// behalf of someone else via the HR picker.
export async function createLeaveRequestDB(data: Omit<import('@/lib/types').LeaveRequest, 'id'>): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'You must be signed in to submit a leave request.' };
  try {
    const id = `lr_${Date.now()}`;
    await query(`INSERT INTO leave_requests (id, employee_id, employee_name, leave_type, start_date, end_date, total_days, reason, status, approved_by, applied_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, data.employeeId, data.employeeName, data.leaveType, data.startDate, data.endDate, data.totalDays, data.reason, data.status, data.approvedBy || '', data.appliedAt]);
    return {};
  } catch { return { error: 'Failed.' }; }
}

export async function approveLeaveDB(id: string, approvedBy: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Only admins can approve leave.' };
  try {
    const leaveRes = await query('SELECT employee_id, start_date, end_date FROM leave_requests WHERE id=$1', [id]);
    await query('UPDATE leave_requests SET status=$1, approved_by=$2 WHERE id=$3', ['Approved', approvedBy, id]);

    // Missing link this session added: an approved leave now feeds the
    // timetable substitution engine for every date in range, same as marking
    // a teacher Absent does — a school shouldn't need both a leave approval
    // AND a separate manual attendance entry to get a substitute assigned.
    if (leaveRes.rows.length > 0) {
      const { employee_id, start_date, end_date } = leaveRes.rows[0];
      const { generateSubstitutionsForTeacherDateDB } = await import('./substitutions');
      const start = new Date(`${start_date}T00:00:00`);
      const end = new Date(`${end_date}T00:00:00`);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        await generateSubstitutionsForTeacherDateDB(employee_id, d.toISOString().split('T')[0], 'leave');
      }
    }
    return {};
  } catch { return { error: 'Failed.' }; }
}

export async function rejectLeaveDB(id: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Only admins can reject leave.' };
  try { await query("UPDATE leave_requests SET status='Rejected' WHERE id=$1", [id]); return {}; } catch { return { error: 'Failed.' }; }
}

// Performance ─────────────────────────────────────────────────────────────────
export async function fetchPerformanceEvaluationsDB(employeeId?: number): Promise<import('@/lib/types').PerformanceEvaluation[]> {
  const session = await getSession();
  if (!session) return [];
  try {
    let sql = 'SELECT * FROM performance_evaluations';
    const params: any[] = [];
    if (employeeId !== undefined) { params.push(employeeId); sql += ` WHERE employee_id=$${params.length}`; }
    sql += ' ORDER BY evaluation_date DESC';
    const res = await query(sql, params);
    return res.rows.map(r => ({ id: r.id, employeeId: r.employee_id, employeeName: r.employee_name, evaluatorName: r.evaluator_name, evaluationDate: r.evaluation_date, rating: r.rating, feedback: r.feedback, goals: r.goals, overallScore: r.overall_score }));
  } catch { return []; }
}

export async function createPerformanceEvaluationDB(data: Omit<import('@/lib/types').PerformanceEvaluation, 'id'>): Promise<{ error?: string; id?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Only admins can record a performance evaluation.' };
  try {
    const id = `pe_${Date.now()}`;
    await query(`INSERT INTO performance_evaluations (id, employee_id, employee_name, evaluator_name, evaluation_date, rating, feedback, goals, overall_score) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, data.employeeId, data.employeeName, data.evaluatorName, data.evaluationDate, data.rating, data.feedback, data.goals, data.overallScore]);
    return { id };
  } catch { return { error: 'Failed to save evaluation.' }; }
}

// Payroll ─────────────────────────────────────────────────────────────────────
export async function fetchSalaryStructuresDB(): Promise<import('@/lib/types').SalaryStructure[]> {
  const session = await getSession();
  if (!session) return [];
  try {
    const res = await query('SELECT * FROM salary_structures ORDER BY employee_name');
    return res.rows.map(r => ({ id: r.id, name: r.name, employeeId: r.employee_id, employeeName: r.employee_name, basicSalary: r.basic_salary, allowances: r.allowances || [], deductions: r.deductions || [], totalSalary: r.total_salary, isActive: r.is_active }));
  } catch { return []; }
}

export async function createSalaryStructureDB(data: Omit<import('@/lib/types').SalaryStructure, 'id'>): Promise<{ error?: string; id?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Only admins can create a salary structure.' };
  try {
    const id = `ss_${Date.now()}`;
    await query(`INSERT INTO salary_structures (id, name, employee_id, employee_name, basic_salary, allowances, deductions, total_salary, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, data.name, data.employeeId, data.employeeName, data.basicSalary, JSON.stringify(data.allowances), JSON.stringify(data.deductions), data.totalSalary, data.isActive]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

export async function updateSalaryStructureDB(id: string, data: Partial<Omit<import('@/lib/types').SalaryStructure, 'id' | 'employeeId' | 'employeeName'>>): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Only admins can edit a salary structure.' };
  try {
    const fields: string[] = []; const vals: any[] = []; let i = 1;
    if (data.name !== undefined) { fields.push(`name=$${i++}`); vals.push(data.name); }
    if (data.basicSalary !== undefined) { fields.push(`basic_salary=$${i++}`); vals.push(data.basicSalary); }
    if (data.allowances !== undefined) { fields.push(`allowances=$${i++}`); vals.push(JSON.stringify(data.allowances)); }
    if (data.deductions !== undefined) { fields.push(`deductions=$${i++}`); vals.push(JSON.stringify(data.deductions)); }
    if (data.totalSalary !== undefined) { fields.push(`total_salary=$${i++}`); vals.push(data.totalSalary); }
    if (data.isActive !== undefined) { fields.push(`is_active=$${i++}`); vals.push(data.isActive); }
    if (!fields.length) return {};
    vals.push(id);
    await query(`UPDATE salary_structures SET ${fields.join(',')} WHERE id=$${i}`, vals);
    return {};
  } catch { return { error: 'Failed to update salary structure.' }; }
}

export async function generatePayslipDB(data: Omit<import('@/lib/types').Payslip, 'id'>): Promise<{ error?: string; id?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Only admins can generate a payslip.' };
  try {
    const id = `ps_${Date.now()}`;
    await query(`INSERT INTO payslips (id, employee_id, employee_name, month, year, basic_salary, allowances, deductions, gross_pay, total_deductions, net_pay, tax_amount, overtime_pay, status, generated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [id, data.employeeId, data.employeeName, data.month, data.year, data.basicSalary, JSON.stringify(data.allowances), JSON.stringify(data.deductions), data.grossPay, data.totalDeductions, data.netPay, data.taxAmount, data.overtimePay, data.status, data.generatedAt]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

// Generates one payslip per active staff member with an active salary
// structure for the given month/year, skipping (and counting) anyone
// without one — the manual one-by-one flow is the norm in budget school ERPs.
export async function bulkGeneratePayslipsDB(month: string, year: number): Promise<{ error?: string; generated?: number; skipped?: number }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Only admins can generate payslips.' };
  try {
    const structures = await query('SELECT * FROM salary_structures WHERE is_active = true');
    const existing = await query('SELECT employee_id FROM payslips WHERE month=$1 AND year=$2', [month, year]);
    const already = new Set(existing.rows.map((r: any) => r.employee_id));
    let generated = 0, skipped = 0;
    for (const s of structures.rows) {
      if (already.has(s.employee_id)) { skipped++; continue; }
      const allowances = s.allowances || []; const deductions = s.deductions || [];
      const allowanceTotal = allowances.reduce((sum: number, a: any) => sum + (a.type === 'Percentage' ? Math.round(s.basic_salary * a.amount / 100) : a.amount), 0);
      const deductionTotal = deductions.reduce((sum: number, d: any) => sum + (d.type === 'Percentage' ? Math.round(s.basic_salary * d.amount / 100) : d.amount), 0);
      const grossPay = s.basic_salary + allowanceTotal;
      const netPay = grossPay - deductionTotal;
      const id = `ps_${Date.now()}_${s.employee_id}`;
      await query(`INSERT INTO payslips (id, employee_id, employee_name, month, year, basic_salary, allowances, deductions, gross_pay, total_deductions, net_pay, tax_amount, overtime_pay, status, generated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,0,'Generated',$12)`,
        [id, s.employee_id, s.employee_name, month, year, s.basic_salary, JSON.stringify(allowances), JSON.stringify(deductions), grossPay, deductionTotal, netPay, new Date().toISOString()]);
      generated++;
    }
    return { generated, skipped };
  } catch { return { error: 'Bulk generation failed.' }; }
}

export async function markPayslipPaidDB(id: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Only admins can mark a payslip paid.' };
  try { await query("UPDATE payslips SET status='Paid' WHERE id=$1", [id]); return {}; }
  catch { return { error: 'Failed.' }; }
}

export async function fetchPayslipsDB(employeeId?: number): Promise<import('@/lib/types').Payslip[]> {
  const session = await getSession();
  if (!session) return [];
  // Non-admins may only see their own payslips (self-service), never anyone else's.
  if (session.role !== 'ADMIN') employeeId = session.userId;
  try {
    let sql = 'SELECT * FROM payslips';
    const params: any[] = [];
    if (employeeId !== undefined) { params.push(employeeId); sql += ` WHERE employee_id=$${params.length}`; }
    sql += ' ORDER BY year DESC, month DESC';
    const res = await query(sql, params);
    return res.rows.map(r => ({ id: r.id, employeeId: r.employee_id, employeeName: r.employee_name, month: r.month, year: r.year, basicSalary: r.basic_salary, allowances: r.allowances || [], deductions: r.deductions || [], grossPay: r.gross_pay, totalDeductions: r.total_deductions, netPay: r.net_pay, taxAmount: r.tax_amount, overtimePay: r.overtime_pay, status: r.status, generatedAt: r.generated_at }));
  } catch { return []; }
}

// Accounting ──────────────────────────────────────────────────────────────────
export async function fetchAccountEntriesDB(type?: string): Promise<import('@/lib/types').AccountEntry[]> {
  try {
    let sql = 'SELECT * FROM account_entries';
    const params: string[] = [];
    if (type) { params.push(type); sql += ` WHERE type=$${params.length}`; }
    sql += ' ORDER BY date DESC';
    const res = await query(sql, params);
    return res.rows.map(r => ({ id: r.id, date: r.date, type: r.type, category: r.category, description: r.description, amount: r.amount, paymentMethod: r.payment_method, reference: r.reference, createdBy: r.created_by }));
  } catch { return []; }
}

export async function createAccountEntryDB(data: Omit<import('@/lib/types').AccountEntry, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `ae_${Date.now()}`;
    await query(`INSERT INTO account_entries (id, date, type, category, description, amount, payment_method, reference, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, data.date, data.type, data.category, data.description, data.amount, data.paymentMethod, data.reference, data.createdBy]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

export async function fetchBudgetAllocationsDB(): Promise<import('@/lib/types').BudgetAllocation[]> {
  try { const res = await query('SELECT * FROM budget_allocations ORDER BY fiscal_year, department'); return res.rows.map(r => ({ id: r.id, department: r.department, category: r.category, allocatedAmount: r.allocated_amount, spentAmount: r.spent_amount, fiscalYear: r.fiscal_year, notes: r.notes })); } catch { return []; }
}

// Scholarship ─────────────────────────────────────────────────────────────────
export async function fetchScholarshipsDB(): Promise<import('@/lib/types').Scholarship[]> {
  try { const res = await query('SELECT * FROM scholarships ORDER BY name'); return res.rows.map(r => ({ id: r.id, name: r.name, type: r.type, amount: r.amount, totalSlots: r.total_slots, availableSlots: r.available_slots, eligibilityCriteria: r.eligibility_criteria, isActive: r.is_active })); } catch { return []; }
}

export async function createScholarshipDB(data: Omit<import('@/lib/types').Scholarship, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `sch_${Date.now()}`;
    await query(`INSERT INTO scholarships (id, name, type, amount, total_slots, available_slots, eligibility_criteria, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, data.name, data.type, data.amount, data.totalSlots, data.availableSlots, data.eligibilityCriteria, data.isActive]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

export async function applyScholarshipDB(data: Omit<import('@/lib/types').ScholarshipApplication, 'id'>): Promise<{ error?: string }> {
  try {
    const id = `sa_${Date.now()}`;
    await query(`INSERT INTO scholarship_applications (id, scholarship_id, scholarship_name, student_id, student_name, applying_for_class, academic_score, family_income, supporting_docs, status, applied_at, approved_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, data.scholarshipId, data.scholarshipName, data.studentId, data.studentName, data.applyingForClass, data.academicScore, data.familyIncome, data.supportingDocs, data.status, data.appliedAt, data.approvedBy || null]);
    return {};
  } catch { return { error: 'Failed.' }; }
}

export async function approveScholarshipDB(appId: string, approvedBy: string): Promise<{ error?: string }> {
  try {
    const appRes = await query('SELECT scholarship_id FROM scholarship_applications WHERE id=$1', [appId]);
    if (!appRes.rows.length) return { error: 'Not found.' };
    await query('UPDATE scholarship_applications SET status=$1, approved_by=$2 WHERE id=$3', ['Approved', approvedBy, appId]);
    await query('UPDATE scholarships SET available_slots = available_slots - 1 WHERE id=$1', [appRes.rows[0].scholarship_id]);
    return {};
  } catch { return { error: 'Failed.' }; }
}

// Discipline ──────────────────────────────────────────────────────────────────
export async function fetchIncidentsDB(): Promise<import('@/lib/types').IncidentReport[]> {
  try { const res = await query('SELECT * FROM incident_reports ORDER BY incident_date DESC'); return res.rows.map(r => ({ id: r.id, studentId: r.student_id, studentName: r.student_name, class: r.class, reportedBy: r.reported_by, incidentDate: r.incident_date, incidentType: r.incident_type, description: r.description, severity: r.severity, location: r.location, witnesses: r.witnesses, status: r.status, actionTaken: r.action_taken, resolvedAt: r.resolved_at })); } catch { return []; }
}

export async function createIncidentDB(data: Omit<import('@/lib/types').IncidentReport, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `inc_${Date.now()}`;
    await query(`INSERT INTO incident_reports (id, student_id, student_name, class, reported_by, incident_date, incident_type, description, severity, location, witnesses, status, action_taken, resolved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, data.studentId, data.studentName, data.class, data.reportedBy, data.incidentDate, data.incidentType, data.description, data.severity, data.location, data.witnesses, data.status, data.actionTaken, data.resolvedAt]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

export async function updateIncidentStatusDB(id: string, status: string, actionTaken?: string): Promise<{ error?: string }> {
  try {
    const today = new Date().toISOString().split('T')[0];
    if (status === 'Resolved' || status === 'Closed') {
      await query('UPDATE incident_reports SET status=$1, action_taken=$2, resolved_at=$3 WHERE id=$4', [status, actionTaken || '', today, id]);
    } else {
      await query('UPDATE incident_reports SET status=$1 WHERE id=$2', [status, id]);
    }
    return {};
  } catch { return { error: 'Failed.' }; }
}

// Health ──────────────────────────────────────────────────────────────────────
export async function fetchMedicalRecordsDB(studentId?: string): Promise<import('@/lib/types').MedicalRecord[]> {
  try {
    let sql = 'SELECT * FROM medical_records';
    const params: string[] = [];
    if (studentId) { params.push(studentId); sql += ` WHERE student_id=$${params.length}`; }
    const res = await query(sql, params);
    return res.rows.map(r => ({ id: r.id, studentId: r.student_id, studentName: r.student_name, bloodGroup: r.blood_group, allergies: r.allergies, chronicConditions: r.chronic_conditions, medications: r.medications, emergencyContact: r.emergency_contact, emergencyPhone: r.emergency_phone, insuranceProvider: r.insurance_provider, insuranceNumber: r.insurance_number }));
  } catch { return []; }
}

export async function upsertMedicalRecordDB(data: import('@/lib/types').MedicalRecord): Promise<{ error?: string }> {
  try {
    await query(`INSERT INTO medical_records (id, student_id, student_name, blood_group, allergies, chronic_conditions, medications, emergency_contact, emergency_phone, insurance_provider, insurance_number) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (student_id) DO UPDATE SET student_name=$3, blood_group=$4, allergies=$5, chronic_conditions=$6, medications=$7, emergency_contact=$8, emergency_phone=$9, insurance_provider=$10, insurance_number=$11`,
      [data.id, data.studentId, data.studentName, data.bloodGroup, data.allergies, data.chronicConditions, data.medications, data.emergencyContact, data.emergencyPhone, data.insuranceProvider, data.insuranceNumber]);
    return {};
  } catch { return { error: 'Failed.' }; }
}

// Events ──────────────────────────────────────────────────────────────────────
export async function fetchEventsDB(): Promise<import('@/lib/types').Event[]> {
  try { const res = await query('SELECT * FROM events ORDER BY start_date DESC'); return res.rows.map(r => ({ id: r.id, title: r.title, description: r.description, category: r.category, startDate: r.start_date, endDate: r.end_date, startTime: r.start_time, endTime: r.end_time, venue: r.venue, organizer: r.organizer, maxParticipants: r.max_participants, registrationDeadline: r.registration_deadline, status: r.status, budget: r.budget, bannerUrl: r.banner_url })); } catch { return []; }
}

export async function createEventDB(data: Omit<import('@/lib/types').Event, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `evt_${Date.now()}`;
    await query(`INSERT INTO events (id, title, description, category, start_date, end_date, start_time, end_time, venue, organizer, max_participants, registration_deadline, status, budget, banner_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [id, data.title, data.description, data.category, data.startDate, data.endDate, data.startTime, data.endTime, data.venue, data.organizer, data.maxParticipants, data.registrationDeadline, data.status, data.budget, data.bannerUrl]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

export async function registerForEventDB(data: Omit<import('@/lib/types').EventRegistration, 'id'>): Promise<{ error?: string }> {
  try {
    const id = `er_${Date.now()}`;
    await query(`INSERT INTO event_registrations (id, event_id, student_id, student_name, class, registered_at, attended, certificate_issued) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, data.eventId, data.studentId, data.studentName, data.class, data.registeredAt, data.attended, data.certificateIssued]);
    return {};
  } catch { return { error: 'Failed.' }; }
}

// Alumni ──────────────────────────────────────────────────────────────────────
export async function fetchAlumniDB(): Promise<import('@/lib/types').Alumni[]> {
  try {
    const res = await query('SELECT * FROM alumni ORDER BY graduation_year DESC, name');
    return res.rows.map(r => ({
      id: r.id, name: r.name, email: r.email, phone: r.phone, graduationYear: r.graduation_year, class: r.class,
      currentOccupation: r.current_occupation, company: r.company, address: r.address, linkedinUrl: r.linkedin_url,
      facebookUrl: r.facebook_url, isDonor: r.is_donor, donationAmount: r.donation_amount, status: r.status,
      sourceStudentId: r.source_student_id,
    }));
  } catch { return []; }
}

export async function createAlumniDB(data: Omit<import('@/lib/types').Alumni, 'id'>): Promise<{ error?: string; id?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { error: 'Only admins can add alumni.' };
  try {
    const id = `al_${Date.now()}`;
    await query(`INSERT INTO alumni (id, name, email, phone, graduation_year, class, current_occupation, company, address, linkedin_url, facebook_url, is_donor, donation_amount, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, data.name, data.email, data.phone, data.graduationYear, data.class, data.currentOccupation, data.company, data.address, data.linkedinUrl, data.facebookUrl, data.isDonor, data.donationAmount, data.status]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

// Placement ───────────────────────────────────────────────────────────────────
export async function fetchJobPostingsDB(): Promise<import('@/lib/types').JobPosting[]> {
  try { const res = await query('SELECT * FROM job_postings ORDER BY posted_at DESC'); return res.rows.map(r => ({ id: r.id, companyName: r.company_name, companyLogo: r.company_logo, title: r.title, description: r.description, requirements: r.requirements, location: r.location, salaryRange: r.salary_range, jobType: r.job_type, applicationDeadline: r.application_deadline, postedAt: r.posted_at, status: r.status, contactEmail: r.contact_email })); } catch { return []; }
}

export async function createJobPostingDB(data: Omit<import('@/lib/types').JobPosting, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `jp_${Date.now()}`;
    await query(`INSERT INTO job_postings (id, company_name, company_logo, title, description, requirements, location, salary_range, job_type, application_deadline, posted_at, status, contact_email) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, data.companyName, data.companyLogo, data.title, data.description, data.requirements, data.location, data.salaryRange, data.jobType, data.applicationDeadline, data.postedAt, data.status, data.contactEmail]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

export async function applyForJobDB(data: Omit<import('@/lib/types').JobApplication, 'id'>): Promise<{ error?: string }> {
  try {
    const id = `ja_${Date.now()}`;
    await query(`INSERT INTO job_applications (id, job_id, student_id, student_name, class, resume, cover_letter, status, applied_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, data.jobId, data.studentId, data.studentName, data.class, data.resume, data.coverLetter, data.status, data.appliedAt]);
    return {};
  } catch { return { error: 'Failed.' }; }
}

// Research ────────────────────────────────────────────────────────────────────
export async function fetchResearchProjectsDB(): Promise<import('@/lib/types').ResearchProject[]> {
  try { const res = await query('SELECT * FROM research_projects ORDER BY start_date DESC'); return res.rows.map(r => ({ id: r.id, title: r.title, researcherName: r.researcher_name, department: r.department, description: r.description, startDate: r.start_date, endDate: r.end_date, fundingAmount: r.funding_amount, fundingSource: r.funding_source, status: r.status, outcomes: r.outcomes })); } catch { return []; }
}

export async function createResearchProjectDB(data: Omit<import('@/lib/types').ResearchProject, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `rp_${Date.now()}`;
    await query(`INSERT INTO research_projects (id, title, researcher_name, department, description, start_date, end_date, funding_amount, funding_source, status, outcomes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, data.title, data.researcherName, data.department, data.description, data.startDate, data.endDate, data.fundingAmount, data.fundingSource, data.status, data.outcomes]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

// Online Exams ────────────────────────────────────────────────────────────────
export async function fetchOnlineExamsDB(): Promise<import('@/lib/types').OnlineExam[]> {
  const session = await getSession();
  if (!session) return [];
  try { const res = await query('SELECT * FROM online_exams ORDER BY start_time DESC'); return res.rows.map(r => ({ id: r.id, title: r.title, className: r.class_name, subject: r.subject, duration: r.duration, totalMarks: r.total_marks, passingMarks: r.passing_marks, startTime: r.start_time, endTime: r.end_time, instructions: r.instructions, proctoringEnabled: r.proctoring_enabled, shuffleQuestions: r.shuffle_questions, status: r.status, examSubjectId: r.exam_subject_id ?? null })); } catch { return []; }
}

export async function createOnlineExamDB(data: Omit<import('@/lib/types').OnlineExam, 'id'>): Promise<{ error?: string; id?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role !== 'ADMIN' && session.role !== 'TEACHER') return { error: 'Only admins and teachers can create exams.' };
  try {
    const id = `oe_${Date.now()}`;
    await query(`INSERT INTO online_exams (id, title, class_name, subject, duration, total_marks, passing_marks, start_time, end_time, instructions, proctoring_enabled, shuffle_questions, status, exam_subject_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, data.title, data.className, data.subject, data.duration, data.totalMarks, data.passingMarks, data.startTime, data.endTime, data.instructions, data.proctoringEnabled, data.shuffleQuestions, data.status, data.examSubjectId || null]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

export async function updateOnlineExamDB(id: string, data: Partial<Omit<import('@/lib/types').OnlineExam, 'id'>>): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role !== 'ADMIN' && session.role !== 'TEACHER') return { error: 'Only admins and teachers can manage exams.' };
  try {
    await query(
      `UPDATE online_exams SET title=COALESCE($1,title), class_name=COALESCE($2,class_name), subject=COALESCE($3,subject),
       duration=COALESCE($4,duration), total_marks=COALESCE($5,total_marks), passing_marks=COALESCE($6,passing_marks),
       start_time=COALESCE($7,start_time), end_time=COALESCE($8,end_time), instructions=COALESCE($9,instructions),
       proctoring_enabled=COALESCE($10,proctoring_enabled), shuffle_questions=COALESCE($11,shuffle_questions), status=COALESCE($12,status),
       exam_subject_id=COALESCE($13,exam_subject_id)
       WHERE id=$14`,
      [data.title ?? null, data.className ?? null, data.subject ?? null, data.duration ?? null, data.totalMarks ?? null,
       data.passingMarks ?? null, data.startTime ?? null, data.endTime ?? null, data.instructions ?? null,
       data.proctoringEnabled ?? null, data.shuffleQuestions ?? null, data.status ?? null, data.examSubjectId ?? null, id]
    );
    return {};
  } catch { return { error: 'Failed to update exam.' }; }
}

// Writes a submitted/graded online-exam score into marks_entries so it
// counts toward the student's real term result — only when the exam was
// explicitly tied to a real exam_subjects row (online_exams.exam_subject_id).
// Bypasses upsertMarksEntryDB's ADMIN/TEACHER role gate on purpose: this is a
// system-triggered sync following a legitimate student submission or teacher
// grading action that has already been authorized by its own caller.
async function syncOnlineExamScoreToMarksDB(examId: string, studentId: string, score: number): Promise<void> {
  try {
    const examRes = await query('SELECT exam_subject_id FROM online_exams WHERE id=$1', [examId]);
    const examSubjectId = examRes.rows[0]?.exam_subject_id;
    if (!examSubjectId) return;
    const existing = await query('SELECT id FROM marks_entries WHERE exam_subject_id=$1 AND student_id=$2', [examSubjectId, studentId]);
    if (existing.rows.length > 0) {
      await query('UPDATE marks_entries SET marks_obtained=$1 WHERE id=$2', [score, existing.rows[0].id]);
    } else {
      const id = `me_oe_${Date.now()}`;
      await query('INSERT INTO marks_entries (id, exam_subject_id, student_id, marks_obtained) VALUES ($1,$2,$3,$4)', [id, examSubjectId, studentId, score]);
    }
  } catch (err) { logServerError("features", "syncOnlineExamScoreToMarksDB failed", err); }
}

export async function deleteOnlineExamDB(id: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role !== 'ADMIN' && session.role !== 'TEACHER') return { error: 'Only admins and teachers can manage exams.' };
  try {
    const attempts = await query('SELECT COUNT(*) FROM online_exam_attempts WHERE exam_id=$1', [id]);
    if (parseInt(attempts.rows[0].count) > 0) return { error: 'Cannot delete an exam that students have already attempted.' };
    await query('DELETE FROM online_exam_questions WHERE exam_id=$1', [id]);
    await query('DELETE FROM online_exams WHERE id=$1', [id]);
    return {};
  } catch { return { error: 'Failed to delete exam.' }; }
}

// Online Exams: question bank ────────────────────────────────────────────────
export async function fetchOnlineExamQuestionsDB(examId: string, opts?: { includeAnswers?: boolean }): Promise<import('@/lib/types').OnlineExamQuestion[]> {
  const session = await getSession();
  if (!session) return [];
  try {
    const res = await query('SELECT * FROM online_exam_questions WHERE exam_id=$1 ORDER BY id', [examId]);
    return res.rows.map((r: any) => ({
      id: r.id, examId: r.exam_id, type: r.type, question: r.question,
      options: typeof r.options === 'string' ? JSON.parse(r.options) : (r.options || []),
      // Answer key is withheld from students by default — fetch it explicitly
      // only from admin/teacher call sites (question bank editor, grading).
      correctAnswer: opts?.includeAnswers ? r.correct_answer : '',
      marks: r.marks,
    }));
  } catch { return []; }
}

export async function createOnlineExamQuestionDB(data: Omit<import('@/lib/types').OnlineExamQuestion, 'id'>): Promise<{ error?: string; id?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role !== 'ADMIN' && session.role !== 'TEACHER') return { error: 'Only admins and teachers can manage questions.' };
  try {
    const id = `oeq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await query(
      `INSERT INTO online_exam_questions (id, exam_id, type, question, options, correct_answer, marks) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, data.examId, data.type, data.question, JSON.stringify(data.options || []), data.correctAnswer, data.marks]
    );
    return { id };
  } catch { return { error: 'Failed to add question.' }; }
}

export async function updateOnlineExamQuestionDB(id: string, data: Partial<Omit<import('@/lib/types').OnlineExamQuestion, 'id' | 'examId'>>): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role !== 'ADMIN' && session.role !== 'TEACHER') return { error: 'Only admins and teachers can manage questions.' };
  try {
    await query(
      `UPDATE online_exam_questions SET type=COALESCE($1,type), question=COALESCE($2,question), options=COALESCE($3,options), correct_answer=COALESCE($4,correct_answer), marks=COALESCE($5,marks) WHERE id=$6`,
      [data.type || null, data.question || null, data.options ? JSON.stringify(data.options) : null, data.correctAnswer ?? null, data.marks ?? null, id]
    );
    return {};
  } catch { return { error: 'Failed to update question.' }; }
}

export async function deleteOnlineExamQuestionDB(id: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role !== 'ADMIN' && session.role !== 'TEACHER') return { error: 'Only admins and teachers can manage questions.' };
  try { await query('DELETE FROM online_exam_questions WHERE id=$1', [id]); return {}; } catch { return { error: 'Failed to delete question.' }; }
}

// Online Exams: student attempt lifecycle ────────────────────────────────────
export interface OnlineExamAttemptView {
  id: string; examId: string; studentId: string; studentName: string;
  answers: { questionId: string; answer: string; marksObtained?: number }[];
  score: number; startedAt: string; submittedAt: string | null; status: string;
}

async function resolveActiveStudent(session: NonNullable<Awaited<ReturnType<typeof getSession>>>): Promise<{ id: string; name: string } | null> {
  const res = await query('SELECT id, name FROM students WHERE email=$1 AND status=$2', [session.email, 'Active']);
  if (res.rows.length === 0) return null;
  return { id: res.rows[0].id, name: res.rows[0].name };
}

function mapOnlineExamAttempt(r: any): OnlineExamAttemptView {
  return {
    id: r.id, examId: r.exam_id, studentId: r.student_id, studentName: r.student_name,
    answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || []),
    score: r.score, startedAt: r.started_at, submittedAt: r.submitted_at || null, status: r.status,
  };
}

// A student's exams are scoped to the classes they're actively enrolled in —
// never the full catalog — and only once an exam has actually been published.
export async function fetchAvailableOnlineExamsForStudentDB(): Promise<import('@/lib/types').OnlineExam[]> {
  const session = await getSession();
  if (!session || session.role !== 'STUDENT') return [];
  try {
    const student = await resolveActiveStudent(session);
    if (!student) return [];
    const enrollRes = await query(
      `SELECT DISTINCT c.name as class_name FROM enrollments e JOIN classes c ON e.class_id=c.id WHERE e.student_id=$1 AND e.status='Active'`,
      [student.id]
    );
    const classNames = enrollRes.rows.map((r: any) => r.class_name);
    if (classNames.length === 0) return [];
    const res = await query(
      `SELECT * FROM online_exams WHERE class_name = ANY($1) AND status IN ('Scheduled','Ongoing','Completed') ORDER BY start_time DESC`,
      [classNames]
    );
    return res.rows.map((r: any) => ({ id: r.id, title: r.title, className: r.class_name, subject: r.subject, duration: r.duration, totalMarks: r.total_marks, passingMarks: r.passing_marks, startTime: r.start_time, endTime: r.end_time, instructions: r.instructions, proctoringEnabled: r.proctoring_enabled, shuffleQuestions: r.shuffle_questions, status: r.status, examSubjectId: r.exam_subject_id ?? null }));
  } catch { return []; }
}

export async function startOnlineExamAttemptDB(examId: string): Promise<{ error?: string; attempt?: OnlineExamAttemptView }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role !== 'STUDENT') return { error: 'Only students can take this exam.' };
  try {
    const student = await resolveActiveStudent(session);
    if (!student) return { error: 'No active student record found for this account.' };

    const examRes = await query('SELECT * FROM online_exams WHERE id=$1', [examId]);
    if (examRes.rows.length === 0) return { error: 'Exam not found.' };
    const exam = examRes.rows[0];
    if (exam.status === 'Cancelled') return { error: 'This exam has been cancelled.' };
    if (exam.status === 'Draft') return { error: 'This exam is not yet published.' };
    const now = new Date();
    if (exam.start_time && now < new Date(exam.start_time)) return { error: 'This exam has not started yet.' };
    if (exam.end_time && now > new Date(exam.end_time)) return { error: 'This exam window has closed.' };

    const existing = await query('SELECT * FROM online_exam_attempts WHERE exam_id=$1 AND student_id=$2', [examId, student.id]);
    if (existing.rows.length > 0) {
      const a = existing.rows[0];
      if (a.status !== 'InProgress') return { error: 'You have already submitted this exam.' };
      return { attempt: mapOnlineExamAttempt(a) };
    }

    const id = `oea_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const startedAt = now.toISOString();
    // submitted_at / proctoring_logs are non-nullable text columns (per the
    // Prisma schema the live table was migrated with) — an empty string is
    // this row's "not yet submitted / no logs" sentinel, not NULL.
    await query(
      `INSERT INTO online_exam_attempts (id, exam_id, student_id, student_name, answers, score, started_at, submitted_at, status, proctoring_logs)
       VALUES ($1,$2,$3,$4,'[]',0,$5,'','InProgress','')`,
      [id, examId, student.id, student.name, startedAt]
    );
    if (exam.status === 'Scheduled') await query(`UPDATE online_exams SET status='Ongoing' WHERE id=$1`, [examId]);
    return { attempt: { id, examId, studentId: student.id, studentName: student.name, answers: [], score: 0, startedAt, submittedAt: null, status: 'InProgress' } };
  } catch (err) { logServerError("features", err); return { error: 'Failed to start exam.' }; }
}

export async function fetchMyOnlineExamAttemptDB(examId: string): Promise<OnlineExamAttemptView | null> {
  const session = await getSession();
  if (!session || session.role !== 'STUDENT') return null;
  try {
    const student = await resolveActiveStudent(session);
    if (!student) return null;
    const res = await query('SELECT * FROM online_exam_attempts WHERE exam_id=$1 AND student_id=$2', [examId, student.id]);
    if (res.rows.length === 0) return null;
    return mapOnlineExamAttempt(res.rows[0]);
  } catch { return null; }
}

export async function saveOnlineExamAnswerDB(attemptId: string, questionId: string, answer: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'STUDENT') return { error: 'Not authenticated.' };
  try {
    const student = await resolveActiveStudent(session);
    if (!student) return { error: 'No active student record found for this account.' };
    const res = await query('SELECT student_id, status, answers FROM online_exam_attempts WHERE id=$1', [attemptId]);
    if (res.rows.length === 0) return { error: 'Attempt not found.' };
    if (res.rows[0].student_id !== student.id) return { error: 'Not your attempt.' };
    if (res.rows[0].status !== 'InProgress') return { error: 'This exam has already been submitted.' };

    const answers: { questionId: string; answer: string }[] = typeof res.rows[0].answers === 'string' ? JSON.parse(res.rows[0].answers) : (res.rows[0].answers || []);
    const idx = answers.findIndex((a: any) => a.questionId === questionId);
    if (idx >= 0) answers[idx] = { questionId, answer }; else answers.push({ questionId, answer });
    await query('UPDATE online_exam_attempts SET answers=$1 WHERE id=$2', [JSON.stringify(answers), attemptId]);
    return {};
  } catch { return { error: 'Failed to save answer.' }; }
}

// Objective questions (MCQ / TrueFalse) grade themselves on submit; Essay and
// ShortAnswer are left at 0 and flagged for a teacher via fetchOnlineExamAttemptsDB.
export async function submitOnlineExamAttemptDB(attemptId: string): Promise<{ error?: string; score?: number; totalMarks?: number }> {
  const session = await getSession();
  if (!session || session.role !== 'STUDENT') return { error: 'Not authenticated.' };
  try {
    const student = await resolveActiveStudent(session);
    if (!student) return { error: 'No active student record found for this account.' };
    const attemptRes = await query('SELECT * FROM online_exam_attempts WHERE id=$1', [attemptId]);
    if (attemptRes.rows.length === 0) return { error: 'Attempt not found.' };
    const attempt = attemptRes.rows[0];
    if (attempt.student_id !== student.id) return { error: 'Not your attempt.' };

    const questionsRes = await query('SELECT * FROM online_exam_questions WHERE exam_id=$1', [attempt.exam_id]);
    const totalMarks = questionsRes.rows.reduce((sum: number, q: any) => sum + q.marks, 0);
    if (attempt.status !== 'InProgress') return { score: attempt.score, totalMarks }; // idempotent re-submit

    const answers: { questionId: string; answer: string }[] = typeof attempt.answers === 'string' ? JSON.parse(attempt.answers) : (attempt.answers || []);
    let score = 0;
    const graded: { questionId: string; answer: string; marksObtained: number }[] = [];
    for (const q of questionsRes.rows) {
      const given = answers.find((a: any) => a.questionId === q.id);
      let marksObtained = 0;
      if (given && (q.type === 'MCQ' || q.type === 'TrueFalse')) {
        if (given.answer.trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase()) marksObtained = q.marks;
      }
      score += marksObtained;
      graded.push({ questionId: q.id, answer: given?.answer || '', marksObtained });
    }

    const hasSubjective = questionsRes.rows.some((q: any) => q.type === 'Essay' || q.type === 'ShortAnswer');
    const status = hasSubjective ? 'Submitted' : 'Graded';
    const submittedAt = new Date().toISOString();
    await query(
      'UPDATE online_exam_attempts SET answers=$1, score=$2, submitted_at=$3, status=$4 WHERE id=$5',
      [JSON.stringify(graded), score, submittedAt, status, attemptId]
    );
    // Objective-only exams are fully graded at this point — sync now. Exams
    // with subjective questions sync later, once a teacher finishes grading
    // via gradeOnlineExamAnswerDB (status flips to 'Graded' there).
    if (!hasSubjective) await syncOnlineExamScoreToMarksDB(attempt.exam_id, student.id, score);
    return { score, totalMarks };
  } catch (err) { logServerError("features", err); return { error: 'Failed to submit exam.' }; }
}

export async function fetchOnlineExamAttemptsDB(examId: string): Promise<OnlineExamAttemptView[]> {
  const session = await getSession();
  if (!session) return [];
  if (session.role !== 'ADMIN' && session.role !== 'TEACHER') return [];
  try {
    const res = await query('SELECT * FROM online_exam_attempts WHERE exam_id=$1 ORDER BY submitted_at DESC NULLS LAST, started_at DESC', [examId]);
    return res.rows.map(mapOnlineExamAttempt);
  } catch { return []; }
}

// Manual override for one subjective (Essay/ShortAnswer) answer — recomputes
// the attempt's total and flips it to Graded once every answer has a mark.
export async function gradeOnlineExamAnswerDB(attemptId: string, questionId: string, marksObtained: number): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role !== 'ADMIN' && session.role !== 'TEACHER') return { error: 'Only admins and teachers can grade.' };
  try {
    const res = await query('SELECT answers FROM online_exam_attempts WHERE id=$1', [attemptId]);
    if (res.rows.length === 0) return { error: 'Attempt not found.' };
    const answers: any[] = typeof res.rows[0].answers === 'string' ? JSON.parse(res.rows[0].answers) : (res.rows[0].answers || []);
    const idx = answers.findIndex((a: any) => a.questionId === questionId);
    if (idx < 0) return { error: 'Answer not found.' };
    answers[idx].marksObtained = marksObtained;
    const newScore = answers.reduce((sum: number, a: any) => sum + (a.marksObtained || 0), 0);
    await query('UPDATE online_exam_attempts SET answers=$1, score=$2, status=$3 WHERE id=$4', [JSON.stringify(answers), newScore, 'Graded', attemptId]);
    const attemptRes = await query('SELECT exam_id, student_id FROM online_exam_attempts WHERE id=$1', [attemptId]);
    if (attemptRes.rows.length > 0) {
      await syncOnlineExamScoreToMarksDB(attemptRes.rows[0].exam_id, attemptRes.rows[0].student_id, newScore);
    }
    return {};
  } catch { return { error: 'Failed to grade answer.' }; }
}

// Certificates ────────────────────────────────────────────────────────────────
export async function fetchCertificateRecordsDB(studentId?: string): Promise<import('@/lib/types').CertificateRecord[]> {
  try {
    let sql = 'SELECT * FROM certificate_records';
    const params: string[] = [];
    if (studentId) { params.push(studentId); sql += ` WHERE student_id=$${params.length}`; }
    sql += ' ORDER BY issued_date DESC';
    const res = await query(sql, params);
    return res.rows.map(r => ({ id: r.id, studentId: r.student_id, studentName: r.student_name, certificateType: r.certificate_type, certificateNumber: r.certificate_number, issuedDate: r.issued_date, issuedBy: r.issued_by, verified: r.verified, verificationCode: r.verification_code, documentUrl: r.document_url }));
  } catch { return []; }
}

export async function issueCertificateDB(data: Omit<import('@/lib/types').CertificateRecord, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `cert_${Date.now()}`;
    const code = `VC-${Date.now().toString(36).toUpperCase()}`;
    await query(`INSERT INTO certificate_records (id, student_id, student_name, certificate_type, certificate_number, issued_date, issued_by, verified, verification_code, document_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, data.studentId, data.studentName, data.certificateType, data.certificateNumber, data.issuedDate, data.issuedBy, false, code, data.documentUrl]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

// Inventory & Assets ──────────────────────────────────────────────────────────
export async function fetchAssetsDB(): Promise<import('@/lib/types').Asset[]> {
  try { const res = await query('SELECT * FROM assets ORDER BY name'); return res.rows.map(r => ({ id: r.id, name: r.name, category: r.category, assetTag: r.asset_tag, location: r.location, purchaseDate: r.purchase_date, purchaseCost: r.purchase_cost, currentValue: r.current_value, vendor: r.vendor, warrantyExpiry: r.warranty_expiry, status: r.status, assignedTo: r.assigned_to, notes: r.notes })); } catch { return []; }
}

export async function createAssetDB(data: Omit<import('@/lib/types').Asset, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `ast_${Date.now()}`;
    await query(`INSERT INTO assets (id, name, category, asset_tag, location, purchase_date, purchase_cost, current_value, vendor, warranty_expiry, status, assigned_to, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, data.name, data.category, data.assetTag, data.location, data.purchaseDate, data.purchaseCost, data.currentValue, data.vendor, data.warrantyExpiry, data.status, data.assignedTo, data.notes]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

export async function fetchConsumableItemsDB(): Promise<import('@/lib/types').ConsumableItem[]> {
  try { const res = await query('SELECT * FROM consumable_items ORDER BY name'); return res.rows.map(r => ({ id: r.id, name: r.name, category: r.category, unit: r.unit, quantity: r.quantity, minStockLevel: r.min_stock_level, unitPrice: r.unit_price, supplier: r.supplier, lastRestocked: r.last_restocked })); } catch { return []; }
}

// Procurement ─────────────────────────────────────────────────────────────────
export async function fetchPurchaseRequestsDB(): Promise<import('@/lib/types').PurchaseRequest[]> {
  try { const res = await query('SELECT * FROM purchase_requests ORDER BY created_at DESC'); return res.rows.map(r => ({ id: r.id, requestedBy: r.requested_by, department: r.department, description: r.description, items: r.items || [], totalCost: r.total_cost, priority: r.priority, status: r.status, createdAt: r.created_at, approvedBy: r.approved_by })); } catch { return []; }
}

export async function createPurchaseRequestDB(data: Omit<import('@/lib/types').PurchaseRequest, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `pr_${Date.now()}`;
    await query(`INSERT INTO purchase_requests (id, requested_by, department, description, items, total_cost, priority, status, created_at, approved_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, data.requestedBy, data.department, data.description, JSON.stringify(data.items), data.totalCost, data.priority, data.status, data.createdAt, data.approvedBy || null]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

export async function approvePurchaseRequestDB(id: string, approvedBy: string): Promise<{ error?: string }> {
  try { await query('UPDATE purchase_requests SET status=$1, approved_by=$2 WHERE id=$3', ['Approved', approvedBy, id]); return {}; } catch { return { error: 'Failed.' }; }
}

// Facility ────────────────────────────────────────────────────────────────────
export async function fetchRoomsDB(): Promise<import('@/lib/types').Room[]> {
  try { const res = await query('SELECT * FROM rooms ORDER BY building, floor, name'); return res.rows.map(r => ({ id: r.id, name: r.name, type: r.type, capacity: r.capacity, floor: r.floor, building: r.building, hasProjector: r.has_projector, hasAC: r.has_ac, hasComputers: r.has_computers, isActive: r.is_active })); } catch { return []; }
}

export async function createRoomDB(data: Omit<import('@/lib/types').Room, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `rm_${Date.now()}`;
    await query(`INSERT INTO rooms (id, name, type, capacity, floor, building, has_projector, has_ac, has_computers, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, data.name, data.type, data.capacity, data.floor, data.building, data.hasProjector, data.hasAC, data.hasComputers, data.isActive]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

export async function bookRoomDB(data: Omit<import('@/lib/types').RoomBooking, 'id'>): Promise<{ error?: string }> {
  try {
    const id = `rb_${Date.now()}`;
    await query(`INSERT INTO room_bookings (id, room_id, room_name, booked_by, purpose, date, start_time, end_time, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, data.roomId, data.roomName, data.bookedBy, data.purpose, data.date, data.startTime, data.endTime, data.status]);
    return {};
  } catch { return { error: 'Failed.' }; }
}

export async function fetchRoomBookingsDB(date?: string): Promise<import('@/lib/types').RoomBooking[]> {
  try {
    let sql = 'SELECT * FROM room_bookings';
    const params: string[] = [];
    if (date) { params.push(date); sql += ` WHERE date=$${params.length}`; }
    sql += ' ORDER BY date, start_time';
    const res = await query(sql, params);
    return res.rows.map(r => ({ id: r.id, roomId: r.room_id, roomName: r.room_name, bookedBy: r.booked_by, purpose: r.purpose, date: r.date, startTime: r.start_time, endTime: r.end_time, status: r.status }));
  } catch { return []; }
}

export async function fetchMaintenanceRequestsDB(): Promise<import('@/lib/types').MaintenanceRequest[]> {
  try { const res = await query('SELECT * FROM maintenance_requests ORDER BY reported_date DESC'); return res.rows.map(r => ({ id: r.id, roomId: r.room_id, location: r.location, issueType: r.issue_type, description: r.description, reportedBy: r.reported_by, reportedDate: r.reported_date, priority: r.priority, status: r.status, assignedTo: r.assigned_to, resolvedDate: r.resolved_date, cost: r.cost })); } catch { return []; }
}

export async function createMaintenanceRequestDB(data: Omit<import('@/lib/types').MaintenanceRequest, 'id'>): Promise<{ error?: string; id?: string }> {
  try {
    const id = `mr_${Date.now()}`;
    await query(`INSERT INTO maintenance_requests (id, room_id, location, issue_type, description, reported_by, reported_date, priority, status, assigned_to, resolved_date, cost) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, data.roomId, data.location, data.issueType, data.description, data.reportedBy, data.reportedDate, data.priority, data.status, data.assignedTo || null, data.resolvedDate || null, data.cost]);
    return { id };
  } catch { return { error: 'Failed.' }; }
}

// ── Class Teacher Assignment ──────────────────────────────────────────────────

export async function updateClassTeacherDB(classId: string, teacherName: string): Promise<{ error?: string }> {
  try {
    await query('UPDATE classes SET teacher_name=$1 WHERE id=$2', [teacherName || null, classId]);
    return {};
  } catch { return { error: 'Failed to assign teacher to class.' }; }
}

// ── Parent Portal Data ────────────────────────────────────────────────────────

export interface ParentPortalChild {
  id: string; name: string; admissionNumber: string;
  class: string; section: string; status: string; email: string;
  studentPortalPassword: string | null;
}

export interface ParentPortalData {
  children: ParentPortalChild[];
  attendance: { id: string; studentId: string; studentName: string; class: string; section: string; date: string; status: string }[];
  feeRecords: import("@/lib/types").FeeRecord[];
  exams: { id: string; examName: string; subject: string; className: string; date: string; studentResults: any[] }[];
  announcements: { id: string; title: string; content: string; date: string; priority: string }[];
}

export async function getParentPortalData(): Promise<ParentPortalData | null> {
  try {
    const session = await getSession();
    if (!session || session.role !== 'PARENT') return null;

    const childRes = await query(
      "SELECT id, name, admission_number, class, section, status, email, student_portal_password FROM students WHERE parent_email=$1",
      [session.email]
    );
    const children: ParentPortalChild[] = childRes.rows.map(r => ({
      id: r.id, name: r.name, admissionNumber: r.admission_number,
      class: r.class, section: r.section, status: r.status, email: r.email,
      studentPortalPassword: r.student_portal_password || null,
    }));

    if (children.length === 0) return { children: [], attendance: [], feeRecords: [], exams: [], announcements: [] };

    const ids = children.map(c => c.id);
    const idList = ids.map((_, i) => `$${i + 1}`).join(',');

    const attRes = await query(
      `SELECT * FROM attendance WHERE student_id IN (${idList}) ORDER BY date DESC LIMIT 100`,
      ids
    );

    const feeRes = await query(
      `SELECT * FROM fee_records WHERE student_id IN (${idList}) ORDER BY due_date DESC`,
      ids
    );

    const examRes = await query(
      "SELECT * FROM exams WHERE published=true ORDER BY date DESC LIMIT 20"
    );

    const annRes = await query(
      "SELECT id, title, content, date, priority FROM announcements WHERE target_role IS NULL OR target_role='STUDENT' OR target_role='PARENT' ORDER BY date DESC LIMIT 15"
    );

    const childIdSet = new Set(ids);
    const exams = examRes.rows.map(r => ({
      id: r.id, examName: r.exam_name, subject: r.subject,
      className: r.class_name, date: r.date,
      studentResults: (r.student_results || []).filter((sr: any) => childIdSet.has(sr.studentId)),
    })).filter(e => e.studentResults.length > 0);

    return {
      children,
      attendance: attRes.rows.map(r => ({
        id: r.id, studentId: r.student_id, studentName: r.student_name,
        class: r.class, section: r.section, date: r.date, status: r.status,
      })),
      feeRecords: feeRes.rows.map(r => ({
        id: r.id, studentId: r.student_id, studentName: r.student_name,
        amount: Number(r.amount), dueDate: r.due_date, status: r.status,
        voucherId: r.voucher_id, paymentDate: r.payment_date || null,
        feeType: r.fee_type || null, month: r.month || null,
      })),
      exams,
      announcements: annRes.rows.map(r => ({
        id: r.id, title: r.title, content: r.content, date: r.date, priority: r.priority,
      })),
    };
  } catch (err) {
    logServerError("features", 'getParentPortalData error', err);
    return null;
  }
}
