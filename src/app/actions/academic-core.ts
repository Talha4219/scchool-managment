"use server";

import { query, checkDbConnection } from "@/lib/db";
import pool from "@/lib/db";
import { initializeDatabase } from "@/lib/db-init";
import { getSession } from "./auth";
import { logAudit, type AuditActor } from "@/lib/audit";
import { logServerError } from "@/lib/error-log";
import { notificationService } from "@/lib/notification-service";
// Role gating used to live only in the React components calling these — a raw
// request to the server action endpoint bypassed it entirely. See audit finding
// "Three core server-action files have zero session/role checks". Every read
// in this file requires at least a logged-in session — these fetchers were
// previously callable with no auth at all, leaking full class/enrollment/
// exam/attendance data to anonymous requests.
import { requireRole, requireSession, scopeBranch } from "@/lib/auth-scope";

let _acDbInitialized = false;
async function ensureDbInit() {
  if (_acDbInitialized) return;
  _acDbInitialized = true;
  await initializeDatabase();
}

// ── Academic Year ──────────────────────────────────────────────────────────────

export async function checkSectionCapacityDB(sectionId: string): Promise<{ ok: boolean; current: number; capacity: number; error?: string }> {
  const auth = await requireSession();
  if ('error' in auth) return { ok: false, current: 0, capacity: 0, error: auth.error };
  try {
    const secRes = await query("SELECT capacity FROM sections WHERE id = $1", [sectionId]);
    if (secRes.rows.length === 0) return { ok: false, current: 0, capacity: 0, error: "Section not found" };
    const capacity = parseInt(secRes.rows[0].capacity, 10);
    const countRes = await query(
      "SELECT COUNT(*) FROM enrollments WHERE section_id = $1 AND status = 'Active'",
      [sectionId]
    );
    const current = parseInt(countRes.rows[0].count, 10);
    if (current >= capacity) {
      return { ok: false, current, capacity, error: `Section is full (${current}/${capacity} students). Remove a student or increase capacity first.` };
    }
    return { ok: true, current, capacity };
  } catch {
    // Fail closed like every other function in this file — a DB error here
    // must not silently let an enrollment through a capacity check that
    // never actually ran.
    return { ok: false, current: 0, capacity: 0, error: "Could not verify section capacity. Please try again." };
  }
}

// ── Grade Scales ──────────────────────────────────────────────────────────────

export interface GradeScaleItem {
  id: number;
  name: string;
  minPercentage: number;
  maxPercentage: number;
  grade: string;
  points: number;
  isPass: boolean;
  sortOrder: number;
}

export async function fetchGradeScalesDB(): Promise<GradeScaleItem[]> {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query("SELECT * FROM grade_scales ORDER BY sort_order ASC");
    return res.rows.map((r: any) => ({
      id: r.id, name: r.name,
      minPercentage: parseFloat(r.min_percentage), maxPercentage: parseFloat(r.max_percentage),
      grade: r.grade, points: parseFloat(r.points),
      isPass: r.is_pass, sortOrder: r.sort_order,
    }));
  } catch { return []; }
}

export async function updateGradeScaleDB(id: number, data: { minPercentage?: number; maxPercentage?: number; grade?: string; points?: number; isPass?: boolean }): Promise<{ error?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  try {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (data.minPercentage !== undefined) { fields.push(`min_percentage = $${idx}`); params.push(data.minPercentage); idx++; }
    if (data.maxPercentage !== undefined) { fields.push(`max_percentage = $${idx}`); params.push(data.maxPercentage); idx++; }
    if (data.grade !== undefined) { fields.push(`grade = $${idx}`); params.push(data.grade); idx++; }
    if (data.points !== undefined) { fields.push(`points = $${idx}`); params.push(data.points); idx++; }
    if (data.isPass !== undefined) { fields.push(`is_pass = $${idx}`); params.push(data.isPass); idx++; }
    if (fields.length === 0) return {};
    params.push(id);
    await query(`UPDATE grade_scales SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    return {};
  } catch { return { error: "Failed to update grade scale" }; }
}

export async function computeGradeFromDB(percentage: number): Promise<{ grade: string; points: number; isPass: boolean }> {
  const auth = await requireSession();
  if ('error' in auth) return { grade: "F", points: 0, isPass: false };
  try {
    const res = await query(
      "SELECT grade, points, is_pass FROM grade_scales WHERE $1 >= min_percentage AND $1 <= max_percentage ORDER BY sort_order ASC LIMIT 1",
      [percentage]
    );
    if (res.rows.length > 0) {
      return { grade: res.rows[0].grade, points: parseFloat(res.rows[0].points), isPass: res.rows[0].is_pass };
    }
  } catch {}
  return { grade: "F", points: 0, isPass: false };
}

export async function fetchAcademicYearsDB() {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query("SELECT * FROM academic_years ORDER BY start_date DESC");
    return res.rows.map((r: any) => ({ id: r.id, name: r.name, startDate: r.start_date, endDate: r.end_date, isActive: r.is_active }));
  } catch { return []; }
}

export async function createAcademicYearDB(data: { name: string; startDate: string; endDate: string }) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  try {
    const { nanoid } = await import("nanoid");
    const id = `ay-${nanoid(8)}`;
    await query(
      `INSERT INTO academic_years (id, name, start_date, end_date, is_active) VALUES ($1, $2, $3, $4, $5)`,
      [id, data.name, data.startDate, data.endDate, false]
    );
    return { id, ...data, isActive: false };
  } catch { return null; }
}

export async function setActiveAcademicYearDB(id: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try {
    await query("UPDATE academic_years SET is_active = false WHERE is_active = true");
    await query("UPDATE academic_years SET is_active = true WHERE id = $1", [id]);
  } catch {}
}

// ── Classes (stored in `classes` table) ──────────────────────────────────────
export async function fetchClassesDB(_academicYearId?: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  await ensureDbInit();
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    // "classes" is the multi-branch scoping anchor — sections, enrollments,
    // timetable and attendance all cascade from class_id, so scoping the
    // class list here is what keeps a Principal's whole experience scoped
    // to their own branch without needing branch_id on every child table.
    const branchId = scopeBranch(auth.session);
    const sql = branchId ? "SELECT * FROM classes WHERE branch_id=$1 ORDER BY grade_level, name" : "SELECT * FROM classes ORDER BY grade_level, name";
    const res = await query(sql, branchId ? [branchId] : []);
    return res.rows.map((r: any) => ({ id: r.id, name: r.name, gradeLevel: r.grade_level, academicYearId: r.academic_year_id, isGraduating: !!r.is_graduating }));
  } catch { return []; }
}

export async function deleteClassDB(id: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try {
    await query("DELETE FROM sections WHERE class_id = $1", [id]);
    await query("DELETE FROM classes WHERE id = $1", [id]);
  } catch (e) {
    logServerError("academic-core", "deleteClassDB error:", e);
  }
}

export async function createClassDB(data: { name: string; gradeLevel: string; academicYearId: string; isGraduating?: boolean }) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return null;
  await ensureDbInit();
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  try {
    const { nanoid } = await import("nanoid");
    const id = `cls-${nanoid(8)}`;
    // New classes belong to the creator's own branch. OWNER has no branch of
    // their own — cross-branch class creation isn't supported yet (OWNER
    // manages branches, not per-branch academic structure).
    const branchId = scopeBranch(auth.session);
    await query(
      `INSERT INTO classes (id, name, grade_level, academic_year_id, is_graduating, branch_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, data.name, data.gradeLevel, data.academicYearId, !!data.isGraduating, branchId]
    );
    return { id, name: data.name, gradeLevel: data.gradeLevel, academicYearId: data.academicYearId, isGraduating: !!data.isGraduating };
  } catch (e) {
    logServerError("academic-core", "createClassDB error:", e);
    return null;
  }
}

export async function updateClassDB(data: { id: string; name: string; gradeLevel: string; isGraduating?: boolean }) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return null;
  await ensureDbInit();
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  try {
    await query(`UPDATE classes SET name = $1, grade_level = $2, is_graduating = $3 WHERE id = $4`, [data.name, data.gradeLevel, !!data.isGraduating, data.id]);
    return { id: data.id, name: data.name, gradeLevel: data.gradeLevel, isGraduating: !!data.isGraduating };
  } catch (e) {
    logServerError("academic-core", "updateClassDB error:", e);
    return null;
  }
}

// ── Sections (new relational) ─────────────────────────────────────────────────
export async function fetchSectionsByClassDB(classId: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    // sections has no branch_id of its own — scope indirectly via
    // classes.branch_id (defensive: classId is normally already a class the
    // caller is scoped to, but this closes the gap if it isn't).
    const branchId = scopeBranch(auth.session);
    const sql = branchId
      ? "SELECT s.* FROM sections s JOIN classes c ON c.id = s.class_id WHERE s.class_id = $1 AND c.branch_id = $2 ORDER BY s.name"
      : "SELECT * FROM sections WHERE class_id = $1 ORDER BY name";
    const res = await query(sql, branchId ? [classId, branchId] : [classId]);
    return res.rows.map((r: any) => ({ id: r.id, name: r.name, capacity: r.capacity, teacherName: r.teacher_name, classId: r.class_id, group: r.section_group }));
  } catch { return []; }
}

export async function fetchAllSectionsDB(classIds?: string[]) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  await ensureDbInit();
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const branchId = scopeBranch(auth.session);
    if (classIds && classIds.length > 0) {
      const placeholders = classIds.map((_, i) => `$${i + 1}`).join(",");
      const res = await query(`SELECT * FROM sections WHERE class_id IN (${placeholders}) ORDER BY class_id, name`, classIds);
      return res.rows.map((r: any) => ({ id: r.id, name: r.name, capacity: r.capacity, teacherName: r.teacher_name, classId: r.class_id, group: r.section_group }));
    }
    // No classIds given — this is the "every section school-wide" path, so
    // it's the one that actually needs the branch join.
    const sql = branchId
      ? "SELECT s.* FROM sections s JOIN classes c ON c.id = s.class_id WHERE c.branch_id = $1 ORDER BY s.class_id, s.name"
      : "SELECT * FROM sections ORDER BY class_id, name";
    const res = await query(sql, branchId ? [branchId] : []);
    return res.rows.map((r: any) => ({ id: r.id, name: r.name, capacity: r.capacity, teacherName: r.teacher_name, classId: r.class_id, group: r.section_group }));
  } catch { return []; }
}

export async function createSectionDB(data: { name: string; capacity: number; teacherName?: string; classId: string; group?: string }) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return null;
  await ensureDbInit();
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  try {
    const { nanoid } = await import("nanoid");
    const id = `sec-${nanoid(8)}`;
    await query(
      `INSERT INTO sections (id, name, capacity, teacher_name, class_id, section_group) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, data.name, data.capacity, data.teacherName || null, data.classId, data.group || null]
    );
    return { id, ...data };
  } catch { return null; }
}

export async function deleteSectionDB(id: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try { await query("DELETE FROM sections WHERE id = $1", [id]); } catch {}
}

export async function updateSectionDB(data: { id: string; name: string; capacity: number; teacherName?: string; group?: string }) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return false;
  await ensureDbInit();
  const isOnline = await checkDbConnection();
  if (!isOnline) return false;
  try {
    await query("UPDATE sections SET name=$1, capacity=$2, teacher_name=$3, section_group=$4 WHERE id=$5",
      [data.name, data.capacity, data.teacherName || null, data.group || null, data.id]);
    return true;
  } catch (e) { logServerError("academic-core", "updateSectionDB error:", e); return false; }
}

export async function updateSectionTeacherDB(sectionId: string, teacherName: string | null) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return false;
  await ensureDbInit();
  const isOnline = await checkDbConnection();
  if (!isOnline) return false;
  try {
    await query("UPDATE sections SET teacher_name = $1 WHERE id = $2", [teacherName, sectionId]);
    return true;
  } catch (e) { logServerError("academic-core", "updateSectionTeacherDB error:", e); return false; }
}

// ── Enrollments ────────────────────────────────────────────────────────────────
export async function fetchEnrollmentsDB(academicYearId?: string, classId?: string, studentId?: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    let sql = `SELECT e.*, s.name as student_name, s.profile_photo as student_photo, c.name as class_name, sec.name as section_name
               FROM enrollments e
               JOIN students s ON e.student_id = s.id
               JOIN classes c ON e.class_id = c.id
               LEFT JOIN sections sec ON e.section_id = sec.id`;
    const conditions: string[] = [];
    const params: string[] = [];
    if (academicYearId) { conditions.push(`e.academic_year_id = $${params.length + 1}`); params.push(academicYearId); }
    if (classId) { conditions.push(`e.class_id = $${params.length + 1}`); params.push(classId); }
    if (studentId) { conditions.push(`e.student_id = $${params.length + 1}`); params.push(studentId); }
    const branchId = scopeBranch(auth.session);
    if (branchId) { conditions.push(`c.branch_id = $${params.length + 1}`); params.push(branchId); }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY e.roll_number, s.name";
    const res = await query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id, studentId: r.student_id, studentName: r.student_name,
      classId: r.class_id, className: r.class_name,
      sectionId: r.section_id, sectionName: r.section_name,
      academicYearId: r.academic_year_id, rollNumber: r.roll_number, status: r.status,
      profilePhoto: r.student_photo,
    }));
  } catch { return []; }
}

export async function fetchStudentsForDropdownDB(classId?: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    let sql = `SELECT DISTINCT ON (s.id) s.id, s.name, s.class, s.section,
                      e.class_id as enrolled_class_id, c.name as class_name
               FROM students s
               LEFT JOIN enrollments e ON e.student_id = s.id
               LEFT JOIN classes c ON e.class_id = c.id
               WHERE s.status = 'Active'`;
    const params: any[] = [];
    if (classId) {
      sql += ` AND e.class_id = $${params.length + 1}`;
      params.push(classId);
    }
    sql += ` ORDER BY s.id, s.name`;
    const res = await query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id, name: r.name, classId: r.enrolled_class_id || null,
      className: r.class_name || r.class || "",
    }));
  } catch { return []; }
}

export async function createEnrollmentDB(data: { studentId: string; classId: string; sectionId: string; academicYearId: string; rollNumber: number }): Promise<{ error?: string; id?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  const isOnline = await checkDbConnection();
  if (!isOnline) return { error: "Database offline" };

  // Check section capacity
  if (data.sectionId) {
    const cap = await checkSectionCapacityDB(data.sectionId);
    if (!cap.ok) return { error: cap.error };
  }

  try {
    const { nanoid } = await import("nanoid");
    const id = `enr-${nanoid(8)}`;
    await query(
      `INSERT INTO enrollments (id, student_id, class_id, section_id, academic_year_id, roll_number, status) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, data.studentId, data.classId, data.sectionId, data.academicYearId, data.rollNumber, "Active"]
    );
    return { id };
  } catch { return { error: "Failed to create enrollment" }; }
}

export async function updateEnrollmentStatusDB(id: string, status: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try { await query("UPDATE enrollments SET status = $1, updated_at = NOW() WHERE id = $2", [status, id]); } catch {}
}

// ── Student Promotions ──────────────────────────────────────────────────────────
export async function fetchPromotionsDB(studentId?: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    let sql = `SELECT sp.*, s.name as student_name, fc.name as from_class_name, tc.name as to_class_name
               FROM student_promotions sp
               JOIN students s ON sp.student_id = s.id
               JOIN classes fc ON sp.from_class_id = fc.id
               JOIN classes tc ON sp.to_class_id = tc.id`;
    const params: string[] = [];
    if (studentId) { sql += " WHERE sp.student_id = $1"; params.push(studentId); }
    sql += " ORDER BY sp.promoted_at DESC";
    const res = await query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id, studentId: r.student_id, studentName: r.student_name,
      fromClassId: r.from_class_id, fromClassName: r.from_class_name,
      fromSectionId: r.from_section_id,
      toClassId: r.to_class_id, toClassName: r.to_class_name,
      toSectionId: r.to_section_id,
      academicYearId: r.academic_year_id,
      promotedBy: r.promoted_by,
      promotedAt: r.promoted_at,
    }));
  } catch { return []; }
}

export async function promoteStudentDB(data: {
  enrollmentId: string;
  studentId: string;
  fromClassId: string;
  fromSectionId: string;
  toClassId: string;
  toSectionId: string;
  academicYearId: string;
  promotedBy?: string;
}) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  const isOnline = await checkDbConnection();
  if (!isOnline) return { error: "Database offline" };

  // Check target section capacity
  if (data.toSectionId) {
    const cap = await checkSectionCapacityDB(data.toSectionId);
    if (!cap.ok) return { error: cap.error };
  }

  try {
    const { nanoid } = await import("nanoid");
    const promotionId = `prom-${nanoid(8)}`;
    await query("UPDATE enrollments SET status='Completed' WHERE id=$1", [data.enrollmentId]);
    const rollRes = await query("SELECT COALESCE(MAX(roll_number),0)+1 as next FROM enrollments WHERE class_id=$1", [data.toClassId]);
    const rollNumber = parseInt(rollRes.rows[0]?.next || '1', 10);
    const enrollId = `enr-${nanoid(8)}`;
    await query(
      `INSERT INTO enrollments (id, student_id, class_id, section_id, academic_year_id, roll_number, status)
       VALUES ($1,$2,$3,$4,$5,$6,'Active')`,
      [enrollId, data.studentId, data.toClassId, data.toSectionId, data.academicYearId, rollNumber]
    );
    await query(
      `INSERT INTO student_promotions (id, student_id, from_class_id, from_section_id, to_class_id, to_section_id, academic_year_id, promoted_by, promoted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [promotionId, data.studentId, data.fromClassId, data.fromSectionId, data.toClassId, data.toSectionId, data.academicYearId, data.promotedBy || null]
    );
    return { promotionId, enrollmentId: enrollId, rollNumber };
  } catch (e) {
    logServerError("academic-core", "promoteStudentDB error:", e);
    return { error: "Failed to promote student" };
  }
}

// ── Bulk end-of-year promotion ──────────────────────────────────────────────────

export interface PromotionCandidate {
  enrollmentId: string; studentId: string; studentName: string; rollNumber: number;
}

export async function fetchPromotionCandidatesDB(classId: string, sectionId: string): Promise<{ isGraduating: boolean; className: string; candidates: PromotionCandidate[] }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { isGraduating: false, className: '', candidates: [] };
  const isOnline = await checkDbConnection();
  if (!isOnline) return { isGraduating: false, className: '', candidates: [] };
  try {
    const clsRes = await query("SELECT name, is_graduating FROM classes WHERE id=$1", [classId]);
    const enrRes = await query(
      `SELECT e.id as enrollment_id, e.student_id, e.roll_number, s.name as student_name
       FROM enrollments e JOIN students s ON s.id = e.student_id
       WHERE e.class_id=$1 AND e.section_id=$2 AND e.status='Active'
       ORDER BY e.roll_number`,
      [classId, sectionId]
    );
    return {
      isGraduating: !!clsRes.rows[0]?.is_graduating,
      className: clsRes.rows[0]?.name || '',
      candidates: enrRes.rows.map((r: any) => ({
        enrollmentId: r.enrollment_id, studentId: r.student_id, studentName: r.student_name, rollNumber: r.roll_number,
      })),
    };
  } catch { return { isGraduating: false, className: '', candidates: [] }; }
}

export interface PromotionDecision {
  enrollmentId: string; studentId: string; outcome: 'promoted' | 'retained' | 'withdrawn';
  remarks?: string;
}

export interface BulkPromotionResult {
  error?: string;
  succeeded?: { studentId: string; outcome: string }[];
  failed?: { studentId: string; reason: string }[];
}

// Shared by both bulkPromoteStudentsDB (whole-class graduation) and
// graduateStudentToAlumniDB (single student, from the Students page) so there's
// one INSERT that actually carries the student's email/phone across, instead of
// two divergent paths — the bulk path used to leave an alumni row with only a
// name. `client` is the caller's already-open transaction. `source_student_id`
// makes this idempotent: graduating the same student twice is rejected here
// rather than producing a duplicate alumni row.
async function insertAlumniRecord(
  client: any, studentId: string, className: string, graduationYear: number,
  extra?: { currentOccupation?: string }
): Promise<{ error?: string; alumniId?: string }> {
  const dupe = await client.query("SELECT id FROM alumni WHERE source_student_id=$1", [studentId]);
  if (dupe.rows.length > 0) return { error: "This student has already been graduated to Alumni." };

  const studentRes = await client.query("SELECT name, email, parent_phone FROM students WHERE id=$1", [studentId]);
  if (studentRes.rows.length === 0) return { error: "Student not found." };
  const student = studentRes.rows[0];

  const { nanoid } = await import("nanoid");
  const alumniId = `alumni-${nanoid(8)}`;
  await client.query(
    `INSERT INTO alumni (id, name, email, phone, graduation_year, class, current_occupation, status, source_student_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'Active',$8)`,
    [alumniId, student.name || 'Unknown', student.email || '', student.parent_phone || '', graduationYear, className || '', extra?.currentOccupation || '', studentId]
  );
  return { alumniId };
}

export async function bulkPromoteStudentsDB(payload: {
  fromClassId: string; fromSectionId: string; fromAcademicYearId: string;
  toClassId?: string; toSectionId?: string; toAcademicYearId: string;
  isGraduating: boolean;
  decisions: PromotionDecision[];
  promotedByUserId?: number; promotedByName?: string;
  batchRemarks?: string;
}): Promise<BulkPromotionResult> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  const isOnline = await checkDbConnection();
  if (!isOnline) return { error: "Database offline" };
  if (!payload.isGraduating && (!payload.toClassId || !payload.toSectionId)) {
    return { error: "Target class and section are required." };
  }

  const { nanoid } = await import("nanoid");
  const client = await pool.connect();
  const succeeded: { studentId: string; outcome: string }[] = [];
  const failed: { studentId: string; reason: string }[] = [];
  let promotedCount = 0, retainedCount = 0, withdrawnCount = 0;

  try {
    await client.query("BEGIN");

    let fromClassName = '';
    if (payload.isGraduating) {
      const cls = await client.query("SELECT name FROM classes WHERE id=$1", [payload.fromClassId]);
      fromClassName = cls.rows[0]?.name || '';
    }
    let graduationYear: number | null = null;
    if (payload.isGraduating) {
      const yr = await client.query("SELECT name FROM academic_years WHERE id=$1", [payload.toAcademicYearId]);
      graduationYear = parseInt((yr.rows[0]?.name || '').slice(0, 4), 10) || new Date().getFullYear();
    }

    for (const d of payload.decisions) {
      try {
        if (d.outcome === 'withdrawn') {
          await client.query("UPDATE enrollments SET status='Inactive', updated_at=NOW() WHERE id=$1", [d.enrollmentId]);
          await client.query(
            `INSERT INTO student_promotions (id, student_id, from_class_id, from_section_id, to_class_id, to_section_id, academic_year_id, promoted_by, promoted_at, outcome, remarks)
             VALUES ($1,$2,$3,$4,$3,$4,$5,$6,NOW(),'withdrawn',$7)`,
            [`prom-${nanoid(8)}`, d.studentId, payload.fromClassId, payload.fromSectionId, payload.toAcademicYearId, payload.promotedByName || null, d.remarks || payload.batchRemarks || null]
          );
          withdrawnCount++;
          succeeded.push({ studentId: d.studentId, outcome: 'withdrawn' });
          continue;
        }

        if (payload.isGraduating) {
          const alumniResult = await insertAlumniRecord(client, d.studentId, fromClassName, graduationYear!);
          if (alumniResult.error) {
            // Already graduated (e.g. duplicate entry in this batch) — skip, don't fail the whole batch.
            failed.push({ studentId: d.studentId, reason: alumniResult.error });
            continue;
          }
          await client.query("UPDATE enrollments SET status='Graduated', updated_at=NOW() WHERE id=$1", [d.enrollmentId]);
          await client.query(
            `INSERT INTO student_promotions (id, student_id, from_class_id, from_section_id, to_class_id, to_section_id, academic_year_id, promoted_by, promoted_at, outcome, remarks)
             VALUES ($1,$2,$3,$4,$3,$4,$5,$6,NOW(),'graduated',$7)`,
            [`prom-${nanoid(8)}`, d.studentId, payload.fromClassId, payload.fromSectionId, payload.toAcademicYearId, payload.promotedByName || null, d.remarks || payload.batchRemarks || null]
          );
          const studentRes = await client.query("SELECT email FROM students WHERE id=$1", [d.studentId]);
          if (studentRes.rows[0]?.email) {
            await client.query("UPDATE users SET status='INACTIVE' WHERE email=$1", [studentRes.rows[0].email]);
          }
          promotedCount++;
          succeeded.push({ studentId: d.studentId, outcome: 'graduated' });
          continue;
        }

        // promoted or retained — both open a new enrollment; retained targets
        // the same class/section as the source, promoted targets payload.to*.
        const targetClassId = d.outcome === 'retained' ? payload.fromClassId : payload.toClassId!;
        const targetSectionId = d.outcome === 'retained' ? payload.fromSectionId : payload.toSectionId!;

        const secRes = await client.query("SELECT capacity FROM sections WHERE id=$1", [targetSectionId]);
        const capacity = parseInt(secRes.rows[0]?.capacity, 10) || 0;
        const countRes = await client.query(
          "SELECT COUNT(*)::int as c FROM enrollments WHERE section_id=$1 AND status='Active' AND academic_year_id=$2",
          [targetSectionId, payload.toAcademicYearId]
        );
        if (capacity > 0 && countRes.rows[0].c >= capacity) {
          failed.push({ studentId: d.studentId, reason: `Target section is full (${countRes.rows[0].c}/${capacity}).` });
          continue;
        }

        await client.query("UPDATE enrollments SET status='Completed', updated_at=NOW() WHERE id=$1", [d.enrollmentId]);
        const rollRes = await client.query("SELECT COALESCE(MAX(roll_number),0)+1 as next FROM enrollments WHERE class_id=$1 AND academic_year_id=$2", [targetClassId, payload.toAcademicYearId]);
        await client.query(
          `INSERT INTO enrollments (id, student_id, class_id, section_id, academic_year_id, roll_number, status)
           VALUES ($1,$2,$3,$4,$5,$6,'Active')`,
          [`enr-${nanoid(8)}`, d.studentId, targetClassId, targetSectionId, payload.toAcademicYearId, parseInt(rollRes.rows[0]?.next || '1', 10)]
        );
        await client.query(
          `INSERT INTO student_promotions (id, student_id, from_class_id, from_section_id, to_class_id, to_section_id, academic_year_id, promoted_by, promoted_at, outcome, remarks)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,$10)`,
          [`prom-${nanoid(8)}`, d.studentId, payload.fromClassId, payload.fromSectionId, targetClassId, targetSectionId, payload.toAcademicYearId, payload.promotedByName || null, d.outcome, d.remarks || payload.batchRemarks || null]
        );
        if (d.outcome === 'retained') retainedCount++; else promotedCount++;
        succeeded.push({ studentId: d.studentId, outcome: d.outcome });
      } catch (err) {
        logServerError("academic-core", "bulkPromoteStudentsDB per-student error:", err);
        failed.push({ studentId: d.studentId, reason: "Unexpected error." });
      }
    }

    await client.query(
      `INSERT INTO promotion_batches (id, from_class_id, from_section_id, from_academic_year_id, to_class_id, to_section_id, to_academic_year_id, is_graduating, promoted_count, retained_count, withdrawn_count, promoted_by_user_id, promoted_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [`pb-${nanoid(8)}`, payload.fromClassId, payload.fromSectionId, payload.fromAcademicYearId,
       payload.isGraduating ? null : payload.toClassId, payload.isGraduating ? null : payload.toSectionId, payload.toAcademicYearId,
       payload.isGraduating, promotedCount, retainedCount, withdrawnCount, payload.promotedByUserId || null, payload.promotedByName || null]
    );

    await client.query("COMMIT");
    return { succeeded, failed };
  } catch (err) {
    await client.query("ROLLBACK");
    logServerError("academic-core", "bulkPromoteStudentsDB error:", err);
    return { error: "Promotion batch failed — no changes were made." };
  } finally {
    client.release();
  }
}

// Single-student graduation, triggered from the Students page row action —
// the individual-student counterpart to bulkPromoteStudentsDB's graduating
// branch above (shares insertAlumniRecord so both produce a fully-populated
// alumni row, not just a bare name). Closes the enrollment, deactivates the
// student's portal login (they're no longer a student), and writes both an
// audit entry and a student_promotions row so this shows up in existing
// promotion history views.
export async function graduateStudentToAlumniDB(
  enrollmentId: string, graduationYear: number, currentOccupation?: string
): Promise<{ error?: string; alumniId?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  const isOnline = await checkDbConnection();
  if (!isOnline) return { error: "Database offline." };

  const { nanoid } = await import("nanoid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const enrRes = await client.query(
      `SELECT e.student_id, e.status, e.class_id, e.section_id, e.academic_year_id, c.name as class_name
       FROM enrollments e JOIN classes c ON c.id = e.class_id
       WHERE e.id=$1`,
      [enrollmentId]
    );
    if (enrRes.rows.length === 0) { await client.query("ROLLBACK"); return { error: "Enrollment not found." }; }
    const enr = enrRes.rows[0];
    if (enr.status !== "Active") { await client.query("ROLLBACK"); return { error: "Only an actively-enrolled student can be graduated." }; }

    const alumniResult = await insertAlumniRecord(client, enr.student_id, enr.class_name, graduationYear, { currentOccupation });
    if (alumniResult.error) { await client.query("ROLLBACK"); return { error: alumniResult.error }; }

    await client.query("UPDATE enrollments SET status='Graduated', updated_at=NOW() WHERE id=$1", [enrollmentId]);
    await client.query(
      `INSERT INTO student_promotions (id, student_id, from_class_id, from_section_id, to_class_id, to_section_id, academic_year_id, promoted_by, promoted_at, outcome)
       VALUES ($1,$2,$3,$4,$3,$4,$5,$6,NOW(),'graduated')`,
      [`prom-${nanoid(8)}`, enr.student_id, enr.class_id, enr.section_id, enr.academic_year_id, auth.session.name]
    );

    const studentRes = await client.query("SELECT email FROM students WHERE id=$1", [enr.student_id]);
    if (studentRes.rows[0]?.email) {
      await client.query("UPDATE users SET status='INACTIVE' WHERE email=$1", [studentRes.rows[0].email]);
    }

    await client.query("COMMIT");

    await logAudit({
      actor: { userId: auth.session.userId, name: auth.session.name, role: auth.session.role },
      action: 'CREATE',
      entityType: 'alumni',
      entityId: alumniResult.alumniId!,
      summary: `Graduated student to Alumni — class ${enr.class_name}, year ${graduationYear}`,
    });

    return { alumniId: alumniResult.alumniId };
  } catch (err) {
    await client.query("ROLLBACK");
    logServerError("academic-core", "graduateStudentToAlumniDB error:", err);
    return { error: "Failed to graduate student." };
  } finally {
    client.release();
  }
}

export interface PromotionBatch {
  id: string; fromClassId: string | null; fromSectionId: string | null; fromAcademicYearId: string | null;
  toClassId: string | null; toSectionId: string | null; toAcademicYearId: string;
  isGraduating: boolean; promotedCount: number; retainedCount: number; withdrawnCount: number;
  promotedByName: string | null; createdAt: string;
}

export async function fetchPromotionBatchesDB(): Promise<PromotionBatch[]> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return [];
  try {
    const res = await query("SELECT * FROM promotion_batches ORDER BY created_at DESC");
    return res.rows.map((r: any) => ({
      id: r.id, fromClassId: r.from_class_id, fromSectionId: r.from_section_id, fromAcademicYearId: r.from_academic_year_id,
      toClassId: r.to_class_id, toSectionId: r.to_section_id, toAcademicYearId: r.to_academic_year_id,
      isGraduating: !!r.is_graduating, promotedCount: r.promoted_count, retainedCount: r.retained_count, withdrawnCount: r.withdrawn_count,
      promotedByName: r.promoted_by_name, createdAt: r.created_at,
    }));
  } catch { return []; }
}

export async function changeEnrollmentClassDB(data: {
  enrollmentId: string;
  classId: string;
  sectionId: string;
  academicYearId: string;
}) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  const isOnline = await checkDbConnection();
  if (!isOnline) return { error: "Database offline" };

  // Check target section capacity
  if (data.sectionId) {
    const cap = await checkSectionCapacityDB(data.sectionId);
    if (!cap.ok) return { error: cap.error };
  }

  try {
    const rollRes = await query("SELECT COALESCE(MAX(roll_number),0)+1 as next FROM enrollments WHERE class_id=$1", [data.classId]);
    const rollNumber = parseInt(rollRes.rows[0]?.next || '1', 10);
    await query(
      "UPDATE enrollments SET class_id=$1, section_id=$2, roll_number=$3, updated_at=NOW() WHERE id=$4",
      [data.classId, data.sectionId, rollNumber, data.enrollmentId]
    );
    return {};
  } catch { return { error: "Failed to update class/section" }; }
}

// ── Teacher Class Subject Assignments ─────────────────────────────────────────
export async function fetchTeacherAssignmentsDB(teacherId?: number, academicYearId?: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    let sql = `SELECT tcs.*, u.name as teacher_name, c.name as class_name, sec.name as section_name, sub.name as subject_name
               FROM teacher_class_subjects tcs
               JOIN users u ON tcs.teacher_id = u.id
               JOIN classes c ON tcs.class_id = c.id
               JOIN sections sec ON tcs.section_id = sec.id
               JOIN subjects sub ON tcs.subject_id = sub.id`;
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (teacherId) { conditions.push(`tcs.teacher_id = $${params.length + 1}`); params.push(teacherId); }
    if (academicYearId) { conditions.push(`tcs.academic_year_id = $${params.length + 1}`); params.push(academicYearId); }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    const res = await query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id, teacherId: r.teacher_id, teacherName: r.teacher_name,
      classId: r.class_id, className: r.class_name,
      sectionId: r.section_id, sectionName: r.section_name,
      subjectId: r.subject_id, subjectName: r.subject_name,
      academicYearId: r.academic_year_id,
    }));
  } catch { return []; }
}

export async function createTeacherAssignmentDB(data: { teacherId: number; classId: string; sectionId: string; subjectId: string; academicYearId: string; override?: boolean }) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  try {
    if (!data.override) {
      const competent = await query(
        'SELECT id FROM teacher_subject_competencies WHERE teacher_id=$1 AND subject_id=$2 AND class_id=$3',
        [data.teacherId, data.subjectId, data.classId]
      );
      if (competent.rows.length === 0) {
        return { error: 'not_competent' as const };
      }
    }
    const { nanoid } = await import("nanoid");
    const id = `tcs-${nanoid(8)}`;
    await query(
      `INSERT INTO teacher_class_subjects (id, teacher_id, class_id, section_id, subject_id, academic_year_id, competency_override) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, data.teacherId, data.classId, data.sectionId, data.subjectId, data.academicYearId, !!data.override]
    );
    return { id, ...data };
  } catch { return null; }
}

export async function deleteTeacherAssignmentDB(id: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try { await query("DELETE FROM teacher_class_subjects WHERE id = $1", [id]); } catch {}
}

// ── Term Exams ────────────────────────────────────────────────────────────────
export async function fetchTermExamsDB(academicYearId?: string, classId?: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    let sql = `SELECT te.*, c.name as class_name, sec.name as section_name
               FROM term_exams te
               JOIN classes c ON te.class_id = c.id
               LEFT JOIN sections sec ON te.section_id = sec.id`;
    const conditions: string[] = [];
    const params: string[] = [];
    if (academicYearId) { conditions.push(`te.academic_year_id = $${params.length + 1}`); params.push(academicYearId); }
    if (classId) { conditions.push(`te.class_id = $${params.length + 1}`); params.push(classId); }
    const branchId = scopeBranch(auth.session);
    if (branchId) { conditions.push(`c.branch_id = $${params.length + 1}`); params.push(branchId); }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY te.start_date DESC";
    const res = await query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id, name: r.name, examType: r.exam_type,
      classId: r.class_id, className: r.class_name,
      sectionId: r.section_id, sectionName: r.section_name,
      academicYearId: r.academic_year_id,
      startDate: r.start_date, endDate: r.end_date, status: r.status,
    }));
  } catch { return []; }
}

export async function createTermExamDB(data: { name: string; examType: string; classId: string; sectionId?: string; academicYearId: string; startDate: string; endDate: string }) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  try {
    const { nanoid } = await import("nanoid");
    const id = `tx-${nanoid(8)}`;
    await query(
      `INSERT INTO term_exams (id, name, exam_type, class_id, section_id, academic_year_id, start_date, end_date, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, data.name, data.examType, data.classId, data.sectionId || null, data.academicYearId, data.startDate, data.endDate, "Scheduled"]
    );
    return { id, ...data, status: "Scheduled" };
  } catch { return null; }
}

export async function updateTermExamStatusDB(id: string, status: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try { await query("UPDATE term_exams SET status = $1 WHERE id = $2", [status, id]); } catch {}
}

export async function updateTermExamDB(id: string, data: { name?: string; examType?: string; classId?: string; sectionId?: string; startDate?: string; endDate?: string }) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return false;
  const isOnline = await checkDbConnection();
  if (!isOnline) return false;
  try {
    const fields: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { fields.push(`name = $${params.length + 1}`); params.push(data.name); }
    if (data.examType !== undefined) { fields.push(`exam_type = $${params.length + 1}`); params.push(data.examType); }
    if (data.classId !== undefined) { fields.push(`class_id = $${params.length + 1}`); params.push(data.classId); }
    if (data.sectionId !== undefined) { fields.push(`section_id = $${params.length + 1}`); params.push(data.sectionId || null); }
    if (data.startDate !== undefined) { fields.push(`start_date = $${params.length + 1}`); params.push(data.startDate); }
    if (data.endDate !== undefined) { fields.push(`end_date = $${params.length + 1}`); params.push(data.endDate); }
    if (fields.length === 0) return false;
    params.push(id);
    await query(`UPDATE term_exams SET ${fields.join(', ')} WHERE id = $${params.length}`, params);
    return true;
  } catch { return false; }
}

export async function deleteTermExamDB(id: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try {
    const subjRes = await query("SELECT id FROM exam_subjects WHERE exam_id = $1", [id]);
    for (const row of subjRes.rows) {
      await query("DELETE FROM marks_entries WHERE exam_subject_id = $1", [row.id]);
    }
    await query("DELETE FROM exam_subjects WHERE exam_id = $1", [id]);
    await query("DELETE FROM results WHERE exam_id = $1", [id]);
    await query("DELETE FROM term_exams WHERE id = $1", [id]);
  } catch {}
}

// ── Exam Subjects ─────────────────────────────────────────────────────────────
export async function fetchExamSubjectsDB(examId: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query(
      `SELECT es.*, sub.name as subject_name, u.name as teacher_name
       FROM exam_subjects es
       JOIN subjects sub ON es.subject_id = sub.id
       LEFT JOIN users u ON es.teacher_id = u.id
       WHERE es.exam_id = $1`,
      [examId]
    );
    return res.rows.map((r: any) => ({
      id: r.id, examId: r.exam_id, subjectId: r.subject_id, subjectName: r.subject_name,
      totalMarks: r.total_marks, passingMarks: r.passing_marks,
      teacherId: r.teacher_id, teacherName: r.teacher_name,
    }));
  } catch { return []; }
}

export async function addExamSubjectDB(data: { examId: string; subjectId: string; totalMarks: number; passingMarks: number; teacherId?: number }) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  try {
    const { nanoid } = await import("nanoid");
    const id = `es-${nanoid(8)}`;
    await query(
      `INSERT INTO exam_subjects (id, exam_id, subject_id, total_marks, passing_marks, teacher_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, data.examId, data.subjectId, data.totalMarks, data.passingMarks, data.teacherId || null]
    );
    return { id, ...data };
  } catch { return null; }
}

export async function deleteExamSubjectDB(id: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try { await query("DELETE FROM exam_subjects WHERE id = $1", [id]); } catch {}
}

// ── Marks Entry ────────────────────────────────────────────────────────────────
export async function fetchMarksEntriesDB(examSubjectId: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query(
      `SELECT me.*, s.name as student_name FROM marks_entries me
       JOIN students s ON me.student_id = s.id
       WHERE me.exam_subject_id = $1 ORDER BY s.name`,
      [examSubjectId]
    );
    return res.rows.map((r: any) => ({
      id: r.id, examSubjectId: r.exam_subject_id,
      studentId: r.student_id, studentName: r.student_name,
      marksObtained: r.marks_obtained, grade: r.grade, remarks: r.remarks,
    }));
  } catch { return []; }
}

// Marks changing after a report card was generated must not leave that card
// silently stale — flag it so the report-cards UI can surface a
// "regenerate" prompt instead of quietly serving outdated numbers.
async function flagReportCardStaleDB(studentId: string, examSubjectId: string): Promise<void> {
  try {
    await query(
      `UPDATE report_cards SET needs_regeneration = true
       WHERE student_id = $1
         AND academic_year_id = (
           SELECT te.academic_year_id FROM exam_subjects es JOIN term_exams te ON te.id = es.exam_id WHERE es.id = $2
         )`,
      [studentId, examSubjectId]
    );
  } catch {}
}

export async function upsertMarksEntryDB(data: { examSubjectId: string; studentId: string; marksObtained: number; grade?: string; remarks?: string }) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  const actor: AuditActor = { userId: auth.session.userId, name: auth.session.name, role: auth.session.role };
  try {
    const { nanoid } = await import("nanoid");
    const existing = await query(
      "SELECT id, marks_obtained, grade, remarks FROM marks_entries WHERE exam_subject_id = $1 AND student_id = $2",
      [data.examSubjectId, data.studentId]
    );
    if (existing.rows.length > 0) {
      const prev = existing.rows[0];
      await query(
        "UPDATE marks_entries SET marks_obtained = $1, grade = $2, remarks = $3 WHERE id = $4",
        [data.marksObtained, data.grade || null, data.remarks || null, prev.id]
      );
      await logAudit({
        actor, action: 'UPDATE', entityType: 'marks_entry', entityId: prev.id,
        summary: `Updated marks for student ${data.studentId} (subject ${data.examSubjectId}): ${prev.marks_obtained} → ${data.marksObtained}`,
        before: { marksObtained: prev.marks_obtained, grade: prev.grade, remarks: prev.remarks },
        after: { marksObtained: data.marksObtained, grade: data.grade ?? null, remarks: data.remarks ?? null },
      });
      await flagReportCardStaleDB(data.studentId, data.examSubjectId);
      return { id: prev.id, ...data };
    }
    const id = `me-${nanoid(8)}`;
    await query(
      `INSERT INTO marks_entries (id, exam_subject_id, student_id, marks_obtained, grade, remarks) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, data.examSubjectId, data.studentId, data.marksObtained, data.grade || null, data.remarks || null]
    );
    await logAudit({
      actor, action: 'CREATE', entityType: 'marks_entry', entityId: id,
      summary: `Entered marks for student ${data.studentId} (subject ${data.examSubjectId}): ${data.marksObtained}`,
      after: { marksObtained: data.marksObtained, grade: data.grade ?? null, remarks: data.remarks ?? null },
    });
    await flagReportCardStaleDB(data.studentId, data.examSubjectId);
    return { id, ...data };
  } catch { return null; }
}

export async function submitMarksForSubjectDB(examSubjectId: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try {
    const entries = await fetchMarksEntriesDB(examSubjectId);
    const examSubjects = await query("SELECT exam_id FROM exam_subjects WHERE id = $1", [examSubjectId]);
    if (!examSubjects.rows.length) return;
    const examId = examSubjects.rows[0].exam_id;

    // Get exam class/section info
    const examInfo = await query("SELECT class_id, section_id FROM term_exams WHERE id = $1", [examId]);
    const classId = examInfo.rows[0]?.class_id || null;
    const sectionId = examInfo.rows[0]?.section_id || null;

    for (const e of entries) {
      const existingResult = await query(
        "SELECT id FROM results WHERE exam_id = $1 AND student_id = $2",
        [examId, e.studentId]
      );
      const fullMarksRes = await query("SELECT total_marks FROM exam_subjects WHERE exam_id = $1", [examId]);
      const totalMarks = fullMarksRes.rows.reduce((sum: number, r: any) => sum + r.total_marks, 0);
      const allEntries = await query(
        "SELECT SUM(marks_obtained) as obtained FROM marks_entries WHERE exam_subject_id IN (SELECT id FROM exam_subjects WHERE exam_id = $1) AND student_id = $2",
        [examId, e.studentId]
      );
      const obtained = parseInt(allEntries.rows[0]?.obtained) || 0;
      const percentage = totalMarks > 0 ? Math.round((obtained / totalMarks) * 10000) / 100 : 0;
      const gradeInfo = await computeGradeFromDB(percentage);

      if (existingResult.rows.length > 0) {
        await query(
          "UPDATE results SET total_marks = $1, obtained_marks = $2, percentage = $3, grade = $4, class_id = $5, section_id = $6, status = 'Submitted' WHERE id = $7",
          [totalMarks, obtained, percentage, gradeInfo.grade, classId, sectionId, existingResult.rows[0].id]
        );
      } else {
        const { nanoid } = await import("nanoid");
        const id = `res-${nanoid(8)}`;
        await query(
          `INSERT INTO results (id, exam_id, student_id, total_marks, obtained_marks, percentage, grade, class_id, section_id, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, examId, e.studentId, totalMarks, obtained, percentage, gradeInfo.grade, classId, sectionId, "Submitted"]
        );
      }
    }

    // Auto-compute section positions after submission
    await computeSectionPositionsDB(examId);
  } catch {}
}

// ── Section Position Calculation ─────────────────────────────────────────────

export async function computeSectionPositionsDB(examId: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try {
    // Get all results for this exam, grouped by section
    const resultsRes = await query(
      `SELECT r.id, r.student_id, r.percentage, r.section_id
       FROM results r WHERE r.exam_id = $1`,
      [examId]
    );
    if (!resultsRes.rows.length) return;

    // Group by section_id
    const sectionGroups: Record<string, any[]> = {};
    const noSection: any[] = [];
    for (const r of resultsRes.rows) {
      if (r.section_id) {
        if (!sectionGroups[r.section_id]) sectionGroups[r.section_id] = [];
        sectionGroups[r.section_id].push(r);
      } else {
        noSection.push(r);
      }
    }

    // If no sections, treat all as one group
    const groups = Object.keys(sectionGroups).length > 0 ? sectionGroups : { "__all__": noSection };

    for (const [, groupResults] of Object.entries(groups)) {
      // Sort by percentage DESC
      groupResults.sort((a: any, b: any) => parseFloat(b.percentage) - parseFloat(a.percentage));
      const total = groupResults.length;
      for (let i = 0; i < groupResults.length; i++) {
        await query(
          "UPDATE results SET section_position = $1, section_total = $2 WHERE id = $3",
          [i + 1, total, groupResults[i].id]
        );
      }
    }
  } catch {}
}

// ── Results ────────────────────────────────────────────────────────────────────
export async function fetchResultsDB(examId: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const branchId = scopeBranch(auth.session);
    const res = await query(
      `SELECT r.*, s.name as student_name, s.admission_number
       FROM results r
       JOIN students s ON r.student_id = s.id
       WHERE r.exam_id = $1 ${branchId ? 'AND s.branch_id = $2' : ''}
       ORDER BY r.percentage DESC`,
      branchId ? [examId, branchId] : [examId]
    );
    return res.rows.map((r: any) => ({
      id: r.id, examId: r.exam_id, studentId: r.student_id,
      studentName: r.student_name, admissionNumber: r.admission_number,
      totalMarks: r.total_marks, obtainedMarks: r.obtained_marks,
      percentage: parseFloat(r.percentage), grade: r.grade,
      sectionPosition: r.section_position, sectionTotal: r.section_total,
      classId: r.class_id, sectionId: r.section_id,
      status: r.status,
    }));
  } catch { return []; }
}

export async function publishExamResultsDB(examId: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try {
    await query(
      "UPDATE results SET status = 'Published' WHERE exam_id = $1 AND status IN ('Approved', 'Reviewed')",
      [examId]
    );
    await query("UPDATE term_exams SET status = 'Published' WHERE id = $1", [examId]);

    await logAudit({
      actor: { userId: auth.session.userId, name: auth.session.name, role: auth.session.role },
      action: 'UPDATE',
      entityType: 'exam_results',
      entityId: examId,
      summary: `Published results for exam ${examId}`,
      after: { status: 'Published' },
    });

    const examRes = await query(
      `SELECT te.name, te.class_id, c.name as class_name
       FROM term_exams te
       LEFT JOIN classes c ON te.class_id = c.id
       WHERE te.id = $1`,
      [examId]
    );
    const examRow = examRes.rows[0] || {};
    const examName = examRow.name || "Exam";
    const className = examRow.class_name || "";
    const classId = examRow.class_id || "";
    const today = new Date().toISOString().split("T")[0];
    const { nanoid } = await import("nanoid");
    const { addNotificationDB } = await import("@/app/actions/db");

    // Class-scoped: query active students in this class
    const studentRes = await query(
      `SELECT id, email, parent_email FROM students WHERE class_id = $1 AND status = 'Active'`,
      [classId]
    );

    const emailedStudents = new Set<string>();
    const emailedParents = new Set<string>();

    for (const s of studentRes.rows) {
      if (s.email && !emailedStudents.has(s.email)) {
        emailedStudents.add(s.email);
        await addNotificationDB({ id: `notif-${nanoid(8)}`, title: "Results Published", message: `Your results for ${className} — ${examName} are now available.`, date: today, recipientRole: "STUDENT", recipientEmail: s.email, read: false });
      }
      if (s.parent_email && !emailedParents.has(s.parent_email)) {
        emailedParents.add(s.parent_email);
        await addNotificationDB({ id: `notif-${nanoid(8)}`, title: "Results Published", message: `Results for ${className} — ${examName} published. Check your ward's performance.`, date: today, recipientRole: "PARENT", recipientEmail: s.parent_email, read: false });
      }
    }

    // Teacher notification (role-wide with class context)
    await addNotificationDB({ id: `notif-${nanoid(8)}`, title: "Results Published", message: `${className} — ${examName} results are now published.`, date: today, recipientRole: "TEACHER", read: false });
  } catch {}
}

// ── Report Cards ───────────────────────────────────────────────────────────────
export async function fetchReportCardsDB(academicYearId?: string, studentId?: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    let sql = `SELECT rc.*, s.name as student_name, s.admission_number, ay.name as academic_year_name
               FROM report_cards rc
               JOIN students s ON rc.student_id = s.id
               JOIN academic_years ay ON rc.academic_year_id = ay.id`;
    const conditions: string[] = [];
    const params: string[] = [];
    if (academicYearId) { conditions.push(`rc.academic_year_id = $${params.length + 1}`); params.push(academicYearId); }
    if (studentId) { conditions.push(`rc.student_id = $${params.length + 1}`); params.push(studentId); }
    const branchId = scopeBranch(auth.session);
    if (branchId) { conditions.push(`s.branch_id = $${params.length + 1}`); params.push(branchId); }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY rc.generated_at DESC";
    const res = await query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id, studentId: r.student_id, studentName: r.student_name,
      admissionNumber: r.admission_number,
      academicYearId: r.academic_year_id, academicYearName: r.academic_year_name,
      className: r.class_name || "", sectionName: r.section_name || "",
      examResults: r.exam_results, generatedAt: r.generated_at,
      totalPercentage: parseFloat(r.total_percentage) || 0,
      overallGrade: r.overall_grade, classPosition: r.class_position,
      classTotal: r.class_total, remarks: r.remarks,
      needsRegeneration: !!r.needs_regeneration,
    }));
  } catch { return []; }
}

export async function generateReportCardDB(studentId: string, academicYearId: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  try {
    const { nanoid } = await import("nanoid");

    // Get student info + class/section from enrollments
    const studentRes = await query(
      `SELECT s.name, s.admission_number, s.class, s.section,
              e.class_id, e.section_id,
              c.name as enrolled_class_name, sec.name as enrolled_section_name
       FROM students s
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.academic_year_id = $2
       LEFT JOIN classes c ON e.class_id = c.id
       LEFT JOIN sections sec ON e.section_id = sec.id
       WHERE s.id = $1`,
      [studentId, academicYearId]
    );
    const student = studentRes.rows[0] || {};

    const classId = student.class_id || null;
    const sectionId = student.section_id || null;
    const className = student.enrolled_class_name || student.class || "";
    const sectionName = student.enrolled_section_name || student.section || "";

    const exams = await query(
      `SELECT te.id, te.name, te.status FROM term_exams te
       WHERE te.academic_year_id = $1 AND te.status = 'Published'`,
      [academicYearId]
    );
    const examResults: any[] = [];
    let grandTotalMarks = 0;
    let grandObtained = 0;
    for (const exam of exams.rows) {
      const result = await query(
        "SELECT total_marks, obtained_marks, percentage, section_position, section_total, grade FROM results WHERE exam_id = $1 AND student_id = $2",
        [exam.id, studentId]
      );
      if (result.rows.length === 0) continue;
      const r = result.rows[0];
      const subjectsData = await query(
        `SELECT sub.name as subject_name, me.marks_obtained, es.total_marks, es.passing_marks, me.grade
         FROM marks_entries me
         JOIN exam_subjects es ON me.exam_subject_id = es.id
         JOIN subjects sub ON es.subject_id = sub.id
         WHERE es.exam_id = $1 AND me.student_id = $2`,
        [exam.id, studentId]
      );

      const subjects = [];
      for (const s of subjectsData.rows) {
        const pct = s.total_marks > 0 ? (s.marks_obtained / s.total_marks) * 100 : 0;
        const gradeInfo = await computeGradeFromDB(pct);
        subjects.push({
          subjectName: s.subject_name,
          marksObtained: s.marks_obtained,
          totalMarks: s.total_marks,
          passingMarks: s.passing_marks,
          percentage: Math.round(pct * 100) / 100,
          grade: gradeInfo.grade,
          points: gradeInfo.points,
          isPass: gradeInfo.isPass,
        });
      }

      examResults.push({
        examId: exam.id, examName: exam.name,
        subjects,
        totalObtained: r.obtained_marks,
        totalMarks: r.total_marks,
        percentage: parseFloat(r.percentage),
        grade: r.grade,
        sectionPosition: r.section_position,
        sectionTotal: r.section_total,
      });
      grandTotalMarks += r.total_marks;
      grandObtained += r.obtained_marks;
    }
    const totalPercentage = grandTotalMarks > 0 ? Math.round((grandObtained / grandTotalMarks) * 10000) / 100 : 0;
    const gradeInfo = await computeGradeFromDB(totalPercentage);
    const overallGrade = gradeInfo.grade;
    const id = `rc-${nanoid(8)}`;

    // Compute class position — filter by student's enrolled class
    const allResultsForYear = classId
      ? await query(
          `SELECT r.student_id, r.percentage FROM results r
           JOIN term_exams te ON r.exam_id = te.id
           JOIN enrollments e ON r.student_id = e.student_id AND e.class_id = $2
           WHERE te.academic_year_id = $1 AND te.status = 'Published'`,
          [academicYearId, classId]
        )
      : await query(
          `SELECT r.student_id, r.percentage FROM results r
           JOIN term_exams te ON r.exam_id = te.id
           WHERE te.academic_year_id = $1 AND te.status = 'Published'`,
          [academicYearId]
        );
    const studentAvgs: Record<string, number[]> = {};
    for (const row of allResultsForYear.rows) {
      if (!studentAvgs[row.student_id]) studentAvgs[row.student_id] = [];
      studentAvgs[row.student_id].push(parseFloat(row.percentage));
    }
    const avgs = Object.entries(studentAvgs).map(([sid, pcts]) => ({
      studentId: sid,
      avg: pcts.reduce((a, b) => a + b, 0) / pcts.length,
    })).sort((a, b) => b.avg - a.avg);
    const classPosition = avgs.findIndex(a => a.studentId === studentId) + 1 || null;
    const classTotal = avgs.length || null;

    await query(
      `INSERT INTO report_cards (id, student_id, academic_year_id, exam_results, generated_at, total_percentage, overall_grade, class_position, class_total, class_name, section_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, studentId, academicYearId, JSON.stringify(examResults), new Date().toISOString().split("T")[0], totalPercentage, overallGrade, classPosition, classTotal, className || null, sectionName || null]
    );
    return {
      id, studentId, studentName: student.name || "", admissionNumber: student.admission_number || "",
      className, sectionName, academicYearId,
      examResults, generatedAt: new Date().toISOString().split("T")[0],
      totalPercentage, overallGrade, classPosition, classTotal,
    };
  } catch (e) { logServerError("academic-core", "generateReportCardDB error:", e); return null; }
}

export async function generateBatchReportCardsDB(academicYearId: string, classId?: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return { generated: 0 };
  const isOnline = await checkDbConnection();
  if (!isOnline) return { generated: 0 };
  try {
    let sql = `SELECT DISTINCT s.id, s.name FROM students s`;
    const params: string[] = [];
    const conditions: string[] = [];
    if (classId) { conditions.push(`s.class_id = $${params.length + 1}`); params.push(classId); }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    const studentRes = await query(sql, params);
    let count = 0;
    for (const row of studentRes.rows) {
      const rc = await generateReportCardDB(row.id, academicYearId);
      if (rc) count++;
    }
    return { generated: count };
  } catch { return { generated: 0 }; }
}

export async function regenerateReportCardDB(id: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  try {
    const existing = await query("SELECT student_id, academic_year_id FROM report_cards WHERE id = $1", [id]);
    if (existing.rows.length === 0) return null;
    const { student_id, academic_year_id } = existing.rows[0];
    const { nanoid } = await import("nanoid");

    const studentRes = await query(
      `SELECT s.name, s.admission_number, s.class, s.section,
              e.class_id, e.section_id,
              c.name as enrolled_class_name, sec.name as enrolled_section_name
       FROM students s
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.academic_year_id = $2
       LEFT JOIN classes c ON e.class_id = c.id
       LEFT JOIN sections sec ON e.section_id = sec.id
       WHERE s.id = $1`,
      [student_id, academic_year_id]
    );
    const student = studentRes.rows[0] || {};

    const classId = student.class_id || null;
    const className = student.enrolled_class_name || student.class || "";
    const sectionName = student.enrolled_section_name || student.section || "";

    const exams = await query(
      `SELECT te.id, te.name, te.status FROM term_exams te
       WHERE te.academic_year_id = $1 AND te.status = 'Published'`,
      [academic_year_id]
    );
    const examResults: any[] = [];
    let grandTotalMarks = 0;
    let grandObtained = 0;
    for (const exam of exams.rows) {
      const result = await query(
        "SELECT total_marks, obtained_marks, percentage, section_position, section_total, grade FROM results WHERE exam_id = $1 AND student_id = $2",
        [exam.id, student_id]
      );
      if (result.rows.length === 0) continue;
      const r = result.rows[0];
      const subjectsData = await query(
        `SELECT sub.name as subject_name, me.marks_obtained, es.total_marks, es.passing_marks, me.grade
         FROM marks_entries me
         JOIN exam_subjects es ON me.exam_subject_id = es.id
         JOIN subjects sub ON es.subject_id = sub.id
         WHERE es.exam_id = $1 AND me.student_id = $2`,
        [exam.id, student_id]
      );

      const subjects = [];
      for (const s of subjectsData.rows) {
        const pct = s.total_marks > 0 ? (s.marks_obtained / s.total_marks) * 100 : 0;
        const gradeInfo = await computeGradeFromDB(pct);
        subjects.push({
          subjectName: s.subject_name,
          marksObtained: s.marks_obtained,
          totalMarks: s.total_marks,
          passingMarks: s.passing_marks,
          percentage: Math.round(pct * 100) / 100,
          grade: gradeInfo.grade,
          points: gradeInfo.points,
          isPass: gradeInfo.isPass,
        });
      }

      examResults.push({
        examId: exam.id, examName: exam.name,
        subjects,
        totalObtained: r.obtained_marks,
        totalMarks: r.total_marks,
        percentage: parseFloat(r.percentage),
        grade: r.grade,
        sectionPosition: r.section_position,
        sectionTotal: r.section_total,
      });
      grandTotalMarks += r.total_marks;
      grandObtained += r.obtained_marks;
    }
    const totalPercentage = grandTotalMarks > 0 ? Math.round((grandObtained / grandTotalMarks) * 10000) / 100 : 0;
    const gradeInfo = await computeGradeFromDB(totalPercentage);
    const overallGrade = gradeInfo.grade;

    const allResultsForYear = classId
      ? await query(
          `SELECT r.student_id, r.percentage FROM results r
           JOIN term_exams te ON r.exam_id = te.id
           JOIN enrollments e ON r.student_id = e.student_id AND e.class_id = $2
           WHERE te.academic_year_id = $1 AND te.status = 'Published'`,
          [academic_year_id, classId]
        )
      : await query(
          `SELECT r.student_id, r.percentage FROM results r
           JOIN term_exams te ON r.exam_id = te.id
           WHERE te.academic_year_id = $1 AND te.status = 'Published'`,
          [academic_year_id]
        );
    const studentAvgs: Record<string, number[]> = {};
    for (const row of allResultsForYear.rows) {
      if (!studentAvgs[row.student_id]) studentAvgs[row.student_id] = [];
      studentAvgs[row.student_id].push(parseFloat(row.percentage));
    }
    const avgs = Object.entries(studentAvgs).map(([sid, pcts]) => ({
      studentId: sid,
      avg: pcts.reduce((a, b) => a + b, 0) / pcts.length,
    })).sort((a, b) => b.avg - a.avg);
    const classPosition = avgs.findIndex(a => a.studentId === student_id) + 1 || null;
    const classTotal = avgs.length || null;

    await query(
      `UPDATE report_cards
       SET exam_results = $1, generated_at = $2, total_percentage = $3, overall_grade = $4, class_position = $5, class_total = $6, class_name = $7, section_name = $8, needs_regeneration = false
       WHERE id = $9`,
      [JSON.stringify(examResults), new Date().toISOString().split("T")[0], totalPercentage, overallGrade, classPosition, classTotal, className || null, sectionName || null, id]
    );
    return {
      id, studentId: student_id, studentName: student.name || "", admissionNumber: student.admission_number || "",
      className, sectionName, academicYearId: academic_year_id,
      examResults, generatedAt: new Date().toISOString().split("T")[0],
      totalPercentage, overallGrade, classPosition, classTotal,
    };
  } catch { return null; }
}

export async function updateReportCardRemarksDB(id: string, remarks: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return false;
  const isOnline = await checkDbConnection();
  if (!isOnline) return false;
  try {
    await query("UPDATE report_cards SET remarks = $1 WHERE id = $2", [remarks, id]);
    return true;
  } catch { return false; }
}

// ── Student Term Results ─────────────────────────────────────────────────────

export async function fetchStudentTermResultsDB(studentId: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query(
      `SELECT r.*, te.name as exam_name, te.exam_type, te.start_date, te.end_date
       FROM results r
       JOIN term_exams te ON r.exam_id = te.id
       WHERE r.student_id = $1 AND te.status = 'Published'
       ORDER BY te.start_date DESC`,
      [studentId]
    );
    return res.rows.map((r: any) => ({
      id: r.id, examId: r.exam_id, studentId: r.student_id,
      examName: r.exam_name, examType: r.exam_type,
      startDate: r.start_date, endDate: r.end_date,
      totalMarks: r.total_marks, obtainedMarks: r.obtained_marks,
      percentage: parseFloat(r.percentage), grade: r.grade,
      sectionPosition: r.section_position, sectionTotal: r.section_total,
      status: r.status,
    }));
  } catch { return []; }
}

// School-wide results overview for /reports — reads the real relational
// `results` table (populated by exam publish), not the legacy unused `exams`
// demo array that `/reports` previously read from.
export async function fetchSchoolResultsOverviewDB() {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const branchId = scopeBranch(auth.session);
    const res = await query(
      `SELECT r.student_id, s.name as student_name, r.percentage, r.grade,
              c.name as class_name, sec.name as section_name
       FROM results r
       JOIN students s ON s.id = r.student_id
       LEFT JOIN classes c ON c.id = r.class_id
       LEFT JOIN sections sec ON sec.id = r.section_id
       ${branchId ? 'WHERE s.branch_id = $1' : ''}`,
      branchId ? [branchId] : []
    );
    return res.rows.map((r: any) => ({
      studentId: r.student_id, studentName: r.student_name,
      percentage: parseFloat(r.percentage) || 0, grade: r.grade,
      className: r.class_name, sectionName: r.section_name,
    }));
  } catch { return []; }
}

// School-wide attendance overview for /reports — reads the real relational
// attendance_records/attendance_sessions tables (what /attendance actually
// writes to), not the legacy unused `attendance` demo table.
export async function fetchSchoolAttendanceOverviewDB() {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const branchId = scopeBranch(auth.session);
    const res = await query(
      `SELECT ar.status, c.name as class_name
       FROM attendance_records ar
       JOIN attendance_sessions ases ON ases.id = ar.session_id
       LEFT JOIN classes c ON c.id = ases.class_id
       ${branchId ? 'WHERE c.branch_id = $1' : ''}`,
      branchId ? [branchId] : []
    );
    return res.rows.map((r: any) => ({ status: r.status, className: r.class_name || 'Unassigned' }));
  } catch { return []; }
}

export async function fetchStudentReportCardsDB(studentId: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query(
      `SELECT rc.*, ay.name as academic_year_name
       FROM report_cards rc
       JOIN academic_years ay ON rc.academic_year_id = ay.id
       WHERE rc.student_id = $1
       ORDER BY rc.generated_at DESC`,
      [studentId]
    );
    return res.rows.map((r: any) => ({
      id: r.id, studentId: r.student_id,
      academicYearId: r.academic_year_id, academicYearName: r.academic_year_name,
      examResults: r.exam_results, generatedAt: r.generated_at,
      totalPercentage: parseFloat(r.total_percentage) || 0,
      overallGrade: r.overall_grade, classPosition: r.class_position, remarks: r.remarks,
    }));
  } catch { return []; }
}

// ── Attendance ─────────────────────────────────────────────────────────────────
export async function fetchAttendanceByClassDateDB(className: string, section: string, date: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query(
      "SELECT * FROM attendance WHERE class = $1 AND section = $2 AND date = $3",
      [className, section, date]
    );
    return res.rows.map((r: any) => ({
      id: r.id, studentId: r.student_id, studentName: r.student_name,
      class: r.class, section: r.section, date: r.date, status: r.status,
    }));
  } catch { return []; }
}

export async function saveAttendanceBatchDB(records: { studentId: string; studentName: string; class: string; section: string; date: string; status: string; subject?: string }[]) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try {
    const beforeByStudent: Record<string, string | null> = {};
    for (const r of records) {
      const existing = await query(
        "SELECT id, status FROM attendance WHERE student_id = $1 AND date = $2 AND class = $3 AND section = $4",
        [r.studentId, r.date, r.class, r.section]
      );
      if (existing.rows.length > 0) {
        beforeByStudent[r.studentId] = existing.rows[0].status;
        await query("UPDATE attendance SET status = $1 WHERE id = $2", [r.status, existing.rows[0].id]);
      } else {
        beforeByStudent[r.studentId] = null;
        const { nanoid } = await import("nanoid");
        await query(
          "INSERT INTO attendance (id, student_id, student_name, class, section, date, status) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [`att-${nanoid(8)}`, r.studentId, r.studentName, r.class, r.section, r.date, r.status]
        );
      }
    }

    const first = records[0];
    await logAudit({
      actor: { userId: auth.session.userId, name: auth.session.name, role: auth.session.role },
      action: 'UPDATE',
      entityType: 'attendance',
      entityId: first ? `${first.class}/${first.section}/${first.date}` : 'batch',
      summary: `Saved attendance for ${records.length} student(s)${first ? ` — ${first.class} ${first.section} on ${first.date}` : ''}`,
      before: beforeByStudent,
      after: Object.fromEntries(records.map(r => [r.studentId, r.status])),
    });
  } catch {}
}

// ── Attendance Module ───────────────────────────────────────────────────────────
export async function createAttendanceSessionDB(data: {
  academicYearId: string; classId: string; sectionId: string; date: string; takenBy?: string;
}) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  try {
    const existing = await query(
      "SELECT id FROM attendance_sessions WHERE class_id=$1 AND section_id=$2 AND date=$3",
      [data.classId, data.sectionId, data.date]
    );
    if (existing.rows.length > 0) return existing.rows[0].id;
    const { nanoid } = await import("nanoid");
    const id = `as-${nanoid(8)}`;
    await query(
      `INSERT INTO attendance_sessions (id, academic_year_id, class_id, section_id, date, taken_by, status) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, data.academicYearId, data.classId, data.sectionId, data.date, data.takenBy || null, 'Completed']
    );
    return id;
  } catch { return null; }
}

export async function fetchAttendanceSessionsDB(classId?: string, sectionId?: string, date?: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    let sql = `SELECT asess.*, c.name as class_name, sec.name as section_name
               FROM attendance_sessions asess
               JOIN classes c ON asess.class_id = c.id
               JOIN sections sec ON asess.section_id = sec.id`;
    const conditions: string[] = [];
    const params: string[] = [];
    if (classId) { conditions.push(`asess.class_id = $${params.length + 1}`); params.push(classId); }
    if (sectionId) { conditions.push(`asess.section_id = $${params.length + 1}`); params.push(sectionId); }
    if (date) { conditions.push(`asess.date = $${params.length + 1}`); params.push(date); }
    const branchId = scopeBranch(auth.session);
    if (branchId) { conditions.push(`c.branch_id = $${params.length + 1}`); params.push(branchId); }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY asess.date DESC";
    const res = await query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id, academicYearId: r.academic_year_id,
      classId: r.class_id, className: r.class_name,
      sectionId: r.section_id, sectionName: r.section_name,
      date: r.date, takenBy: r.taken_by, status: r.status,
    }));
  } catch { return []; }
}

export async function saveAttendanceRecordsDB(sessionId: string, records: { studentId: string; status: string; remarks?: string }[]) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try {
    const { nanoid } = await import("nanoid");
    const before = await query("SELECT student_id, status, remarks FROM attendance_records WHERE session_id=$1", [sessionId]);
    const beforeByStudent = new Map(before.rows.map((r: any) => [r.student_id, { status: r.status, remarks: r.remarks }]));

    for (const r of records) {
      const existing = await query("SELECT id FROM attendance_records WHERE session_id=$1 AND student_id=$2", [sessionId, r.studentId]);
      if (existing.rows.length > 0) {
        await query("UPDATE attendance_records SET status=$1, remarks=$2 WHERE id=$3", [r.status, r.remarks || null, existing.rows[0].id]);
      } else {
        const id = `ar-${nanoid(8)}`;
        await query(
          "INSERT INTO attendance_records (id, session_id, student_id, status, remarks) VALUES ($1,$2,$3,$4,$5)",
          [id, sessionId, r.studentId, r.status, r.remarks || null]
        );
      }
    }

    await logAudit({
      actor: { userId: auth.session.userId, name: auth.session.name, role: auth.session.role },
      action: 'UPDATE',
      entityType: 'attendance_session',
      entityId: sessionId,
      summary: `Saved attendance for ${records.length} student(s) in session ${sessionId}`,
      before: Object.fromEntries(beforeByStudent),
      after: Object.fromEntries(records.map(r => [r.studentId, { status: r.status, remarks: r.remarks ?? null }])),
    });

    // Newly-marked absences only — don't re-alert a parent every time the
    // teacher re-saves an already-absent record. Fire-and-forget through the
    // notification service: it enforces the opt-in gate and approved-template
    // check itself, so a not-yet-configured/opted-out parent is a normal
    // no-op here, never something attendance-saving needs to know about.
    const newlyAbsent = records.filter(r => r.status === "Absent" && beforeByStudent.get(r.studentId)?.status !== "Absent");
    if (newlyAbsent.length > 0) {
      query(
        `SELECT id, name, parent_name FROM students WHERE id = ANY($1::text[])`,
        [newlyAbsent.map(r => r.studentId)]
      ).then(res => {
        const today = new Date().toISOString().split("T")[0];
        for (const student of res.rows) {
          notificationService.send({
            type: "STUDENT_ABSENCE",
            recipientType: "PARENT",
            recipientId: student.id,
            channel: "WHATSAPP",
            data: { parentName: student.parent_name || "Parent/Guardian", studentName: student.name, date: today },
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  } catch {}
}

export async function fetchAttendanceRecordsDB(sessionId: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query(
      `SELECT ar.*, s.name as student_name FROM attendance_records ar
       JOIN students s ON ar.student_id = s.id
       WHERE ar.session_id = $1 ORDER BY s.name`,
      [sessionId]
    );
    return res.rows.map((r: any) => ({
      id: r.id, sessionId: r.session_id,
      studentId: r.student_id, studentName: r.student_name,
      status: r.status, remarks: r.remarks,
    }));
  } catch { return []; }
}

export async function getAttendanceSummaryDB(studentId: string, academicYearId: string) {
  const auth = await requireSession();
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  try {
    const res = await query(
      `SELECT ar.status, COUNT(*) as count FROM attendance_records ar
       JOIN attendance_sessions asess ON ar.session_id = asess.id
       WHERE ar.student_id = $1 AND asess.academic_year_id = $2
       GROUP BY ar.status`,
      [studentId, academicYearId]
    );
    const summary: Record<string, number> = { Present: 0, Absent: 0, Late: 0, Leave: 0, "Half Day": 0 };
    let total = 0;
    for (const r of res.rows) {
      summary[r.status] = parseInt(r.count);
      total += parseInt(r.count);
    }
    const present = summary["Present"] + summary["Late"] + summary["Half Day"] * 0.5;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    return { ...summary, total, percentage };
  } catch { return null; }
}

export async function fetchAttendanceDatesDB(classId: string, sectionId: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query(
      "SELECT DISTINCT date FROM attendance_sessions WHERE class_id=$1 AND section_id=$2 ORDER BY date DESC",
      [classId, sectionId]
    );
    return res.rows.map((r: any) => r.date);
  } catch { return []; }
}

export async function fetchAttendanceHistoryDB(
  classId: string, sectionId: string, startDate: string, endDate: string
) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query(
      `SELECT ar.*, asess.date, s.name as student_name
       FROM attendance_records ar
       JOIN attendance_sessions asess ON ar.session_id = asess.id
       JOIN students s ON ar.student_id = s.id
       WHERE asess.class_id=$1 AND asess.section_id=$2
         AND asess.date >= $3 AND asess.date <= $4
       ORDER BY asess.date, s.name`,
      [classId, sectionId, startDate, endDate]
    );
    return res.rows.map((r: any) => ({
      id: r.id, sessionId: r.session_id,
      studentId: r.student_id, studentName: r.student_name,
      status: r.status, remarks: r.remarks, date: r.date,
    }));
  } catch { return []; }
}

export async function fetchStudentAttendanceHistoryDB(studentId: string, academicYearId: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query(
      `SELECT ar.*, asess.date, s.name as student_name
       FROM attendance_records ar
       JOIN attendance_sessions asess ON ar.session_id = asess.id
       JOIN students s ON ar.student_id = s.id
       WHERE ar.student_id=$1 AND asess.academic_year_id=$2
       ORDER BY asess.date DESC`,
      [studentId, academicYearId]
    );
    return res.rows.map((r: any) => ({
      id: r.id, sessionId: r.session_id,
      studentId: r.student_id, studentName: r.student_name,
      status: r.status, remarks: r.remarks, date: r.date,
    }));
  } catch { return []; }
}

// ── Timetable Module ────────────────────────────────────────────────────────────
export async function fetchRoomsDB() {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query("SELECT * FROM rooms ORDER BY building, room_no");
    return res.rows.map((r: any) => ({ id: r.id, roomNo: r.room_no, capacity: r.capacity, building: r.building }));
  } catch { return []; }
}

export async function createRoomDB(data: { roomNo: string; capacity: number; building?: string }) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  try {
    const { nanoid } = await import("nanoid");
    const id = `rm-${nanoid(8)}`;
    await query("INSERT INTO rooms (id, room_no, capacity, building) VALUES ($1,$2,$3,$4)",
      [id, data.roomNo, data.capacity, data.building || null]);
    return { id, ...data };
  } catch { return null; }
}

export async function deleteRoomDB(id: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try { await query("DELETE FROM rooms WHERE id=$1", [id]); } catch {}
}

export async function fetchTimeSlotsDB() {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query("SELECT * FROM time_slots ORDER BY start_time");
    return res.rows.map((r: any) => ({ id: r.id, startTime: r.start_time, endTime: r.end_time, periodName: r.period_name }));
  } catch { return []; }
}

export async function createTimeSlotDB(data: { startTime: string; endTime: string; periodName?: string }) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  try {
    const { nanoid } = await import("nanoid");
    const id = `ts-${nanoid(8)}`;
    await query("INSERT INTO time_slots (id, start_time, end_time, period_name) VALUES ($1,$2,$3,$4)",
      [id, data.startTime, data.endTime, data.periodName || null]);
    return { id, ...data };
  } catch { return null; }
}

export async function createTimetableDB(data: {
  academicYearId: string; classId: string; sectionId: string;
  subjectId: string; teacherId: number; roomId: string;
  dayOfWeek: string; timeSlotId: string;
}) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  const isOnline = await checkDbConnection();
  if (!isOnline) return { error: "Database offline" };
  try {
    // Conflict checks
    const [teacherConflict, roomConflict, sectionConflict] = await Promise.all([
      query(
        `SELECT id FROM timetables WHERE teacher_id=$1 AND day_of_week=$2 AND time_slot_id=$3 AND id != 'new'`,
        [data.teacherId, data.dayOfWeek, data.timeSlotId]
      ),
      query(
        `SELECT id FROM timetables WHERE room_id=$1 AND day_of_week=$2 AND time_slot_id=$3 AND id != 'new'`,
        [data.roomId, data.dayOfWeek, data.timeSlotId]
      ),
      query(
        `SELECT id FROM timetables WHERE class_id=$1 AND section_id=$2 AND day_of_week=$3 AND time_slot_id=$4 AND id != 'new'`,
        [data.classId, data.sectionId, data.dayOfWeek, data.timeSlotId]
      ),
    ]);

    if (teacherConflict.rows.length > 0) return { error: "Teacher already has a class during this time slot" };
    if (roomConflict.rows.length > 0) return { error: "Room is already booked during this time slot" };
    if (sectionConflict.rows.length > 0) return { error: "Section already has a subject during this time slot" };

    const { nanoid } = await import("nanoid");
    const id = `tt-${nanoid(8)}`;
    await query(
      `INSERT INTO timetables (id, academic_year_id, class_id, section_id, subject_id, teacher_id, room_id, day_of_week, time_slot_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, data.academicYearId, data.classId, data.sectionId, data.subjectId, data.teacherId, data.roomId, data.dayOfWeek, data.timeSlotId]
    );
    return { id };
  } catch { return { error: "Failed to create timetable entry" }; }
}

export async function fetchTimetablesDB(classId?: string, sectionId?: string, teacherId?: number, dayOfWeek?: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    let sql = `SELECT tt.*, c.name as class_name, sec.name as section_name,
               sub.name as subject_name, u.name as teacher_name, rm.room_no,
               ts.start_time, ts.end_time, ts.period_name
               FROM timetables tt
               JOIN classes c ON tt.class_id = c.id
               JOIN sections sec ON tt.section_id = sec.id
               JOIN subjects sub ON tt.subject_id = sub.id
               JOIN users u ON tt.teacher_id = u.id
               JOIN rooms rm ON tt.room_id = rm.id
               JOIN time_slots ts ON tt.time_slot_id = ts.id`;
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (classId) { conditions.push(`tt.class_id = $${params.length + 1}`); params.push(classId); }
    if (sectionId) { conditions.push(`tt.section_id = $${params.length + 1}`); params.push(sectionId); }
    if (teacherId) { conditions.push(`tt.teacher_id = $${params.length + 1}`); params.push(teacherId); }
    if (dayOfWeek) { conditions.push(`tt.day_of_week = $${params.length + 1}`); params.push(dayOfWeek); }
    const branchId = scopeBranch(auth.session);
    if (branchId) { conditions.push(`c.branch_id = $${params.length + 1}`); params.push(branchId); }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY tt.day_of_week, ts.start_time";
    const res = await query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id, academicYearId: r.academic_year_id,
      classId: r.class_id, className: r.class_name,
      sectionId: r.section_id, sectionName: r.section_name,
      subjectId: r.subject_id, subjectName: r.subject_name,
      teacherId: r.teacher_id, teacherName: r.teacher_name,
      roomId: r.room_id, roomNo: r.room_no,
      dayOfWeek: r.day_of_week,
      timeSlotId: r.time_slot_id, startTime: r.start_time, endTime: r.end_time, periodName: r.period_name,
    }));
  } catch { return []; }
}

export async function deleteTimetableEntryDB(id: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try { await query("DELETE FROM timetables WHERE id=$1", [id]); } catch {}
}

// ── Exam Schedules ──────────────────────────────────────────────────────────────
export async function createExamScheduleDB(data: {
  examId: string; classId: string; sectionId: string; subjectId: string;
  examDate: string; startTime?: string; endTime?: string; roomId?: string;
}) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  try {
    const { nanoid } = await import("nanoid");
    const id = `es-${nanoid(8)}`;
    await query(
      `INSERT INTO exam_schedules (id, exam_id, class_id, section_id, subject_id, exam_date, start_time, end_time, room_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, data.examId, data.classId, data.sectionId, data.subjectId, data.examDate, data.startTime || null, data.endTime || null, data.roomId || null]
    );
    return { id, ...data };
  } catch { return null; }
}

export async function fetchExamSchedulesDB(examId?: string, classId?: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    let sql = `SELECT es.*, c.name as class_name, sec.name as section_name,
               sub.name as subject_name, rm.room_no
               FROM exam_schedules es
               JOIN classes c ON es.class_id = c.id
               JOIN sections sec ON es.section_id = sec.id
               JOIN subjects sub ON es.subject_id = sub.id
               LEFT JOIN rooms rm ON es.room_id = rm.id`;
    const conditions: string[] = [];
    const params: string[] = [];
    if (examId) { conditions.push(`es.exam_id = $${params.length + 1}`); params.push(examId); }
    if (classId) { conditions.push(`es.class_id = $${params.length + 1}`); params.push(classId); }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY es.exam_date, es.start_time";
    const res = await query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id, examId: r.exam_id,
      classId: r.class_id, className: r.class_name,
      sectionId: r.section_id, sectionName: r.section_name,
      subjectId: r.subject_id, subjectName: r.subject_name,
      examDate: r.exam_date, startTime: r.start_time, endTime: r.end_time,
      roomId: r.room_id, roomNo: r.room_no,
    }));
  } catch { return []; }
}

export async function deleteExamScheduleDB(id: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try { await query("DELETE FROM exam_schedules WHERE id=$1", [id]); } catch {}
}

// ── Result Details ──────────────────────────────────────────────────────────────
export async function saveResultDetailsDB(resultId: string, details: { subjectId: string; obtainedMarks: number; remarks?: string }[]) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try {
    const { nanoid } = await import("nanoid");
    await query("DELETE FROM result_details WHERE result_id=$1", [resultId]);
    for (const d of details) {
      const id = `rd-${nanoid(8)}`;
      await query(
        "INSERT INTO result_details (id, result_id, subject_id, obtained_marks, remarks) VALUES ($1,$2,$3,$4,$5)",
        [id, resultId, d.subjectId, d.obtainedMarks, d.remarks || null]
      );
    }
  } catch {}
}

export async function fetchResultDetailsDB(resultId: string) {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query(
      `SELECT rd.*, sub.name as subject_name FROM result_details rd
       JOIN subjects sub ON rd.subject_id = sub.id
       WHERE rd.result_id = $1`,
      [resultId]
    );
    return res.rows.map((r: any) => ({
      id: r.id, resultId: r.result_id,
      subjectId: r.subject_id, subjectName: r.subject_name,
      obtainedMarks: parseFloat(r.obtained_marks), remarks: r.remarks,
    }));
  } catch { return []; }
}

export async function updateResultStatusDB(resultId: string, status: string, userId?: string) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  try {
    const setFields = ["status = $1"];
    const params: (string | number | null)[] = [status];
    if (status === "Reviewed" && userId) { setFields.push("reviewed_by = $2"); params.push(userId); }
    if (status === "Approved" && userId) { setFields.push("approved_by = $2"); params.push(userId); }
    params.push(resultId);
    await query(`UPDATE results SET ${setFields.join(", ")} WHERE id = $${params.length}`, params);
  } catch {}
}

// ── Exam Analytics ─────────────────────────────────────────────────────────────

export interface ExamAnalytics {
  totalStudents: number;
  appeared: number;
  passed: number;
  failed: number;
  averagePercent: number;
  highestPercent: number;
  lowestPercent: number;
  subjectWise: Array<{
    subjectName: string;
    totalMarks: number;
    averageMarks: number;
    averagePercent: number;
    passRate: number;
    highestMarks: number;
    lowestMarks: number;
  }>;
  gradeDistribution: Array<{ grade: string; count: number }>;
  topPerformers: Array<{ studentId: string; studentName: string; percentage: number; grade: string; position: number }>;
  bottomPerformers: Array<{ studentId: string; studentName: string; percentage: number; grade: string; position: number }>;
}

export async function fetchExamAnalyticsDB(examId: string): Promise<ExamAnalytics> {
  const empty: ExamAnalytics = {
    totalStudents: 0, appeared: 0, passed: 0, failed: 0,
    averagePercent: 0, highestPercent: 0, lowestPercent: 0,
    subjectWise: [], gradeDistribution: [], topPerformers: [], bottomPerformers: [],
  };
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return empty;
  const isOnline = await checkDbConnection();
  if (!isOnline) return empty;
  try {
    const resultsRes = await query(
      `SELECT r.*, s.name as student_name
       FROM results r
       JOIN students s ON r.student_id = s.id
       WHERE r.exam_id = $1`,
      [examId]
    );
    const rows = resultsRes.rows;
    if (rows.length === 0) return empty;

    const appeared = rows.length;
    const percentages = rows.map((r: any) => parseFloat(r.percentage));
    // Pass/fail must follow the school's actual grade scale (grade_scales.is_pass)
    // rather than assuming "F" is always the only failing grade — a custom
    // scale where e.g. "D" also fails would otherwise be misreported here.
    const gradeScaleRes = await query("SELECT grade, is_pass FROM grade_scales");
    const isPassByGrade: Record<string, boolean> = {};
    gradeScaleRes.rows.forEach((g: any) => { isPassByGrade[g.grade] = g.is_pass; });
    const passed = rows.filter((r: any) => {
      const g = r.grade;
      if (!g) return false;
      return g in isPassByGrade ? isPassByGrade[g] : g !== "F";
    }).length;

    const avgPct = percentages.reduce((a: number, b: number) => a + b, 0) / appeared;
    const top = [...rows].sort((a: any, b: any) => parseFloat(b.percentage) - parseFloat(a.percentage));
    const sorted = [...rows].sort((a: any, b: any) => parseFloat(a.percentage) - parseFloat(b.percentage));

    const gradeMap: Record<string, number> = {};
    rows.forEach((r: any) => {
      const g = r.grade || "N/A";
      gradeMap[g] = (gradeMap[g] || 0) + 1;
    });
    const gradeDistribution = Object.entries(gradeMap).map(([grade, count]) => ({ grade, count }));

    const subjectWiseRes = await query(
      `SELECT es.id as exam_subject_id, sub.name as subject_name, es.total_marks, es.passing_marks,
              me.marks_obtained, me.student_id
       FROM exam_subjects es
       JOIN subjects sub ON es.subject_id = sub.id
       LEFT JOIN marks_entries me ON me.exam_subject_id = es.id
       WHERE es.exam_id = $1`,
      [examId]
    );
    const subjectMap: Record<string, {
      subjectName: string; totalMarks: number; passingMarks: number; marks: number[];
    }> = {};
    subjectWiseRes.rows.forEach((r: any) => {
      const key = r.exam_subject_id;
      if (!subjectMap[key]) subjectMap[key] = {
        subjectName: r.subject_name, totalMarks: parseInt(r.total_marks),
        passingMarks: parseInt(r.passing_marks), marks: [],
      };
      if (r.marks_obtained !== null) subjectMap[key].marks.push(parseFloat(r.marks_obtained));
    });

    const subjectWise = Object.values(subjectMap).map(s => {
      const n = s.marks.length || 1;
      const avg = s.marks.reduce((a: number, b: number) => a + b, 0) / n;
      const passCount = s.marks.filter(m => m >= s.passingMarks).length;
      return {
        subjectName: s.subjectName, totalMarks: s.totalMarks,
        averageMarks: Math.round(avg * 10) / 10,
        averagePercent: s.totalMarks > 0 ? Math.round((avg / s.totalMarks) * 1000) / 10 : 0,
        passRate: s.marks.length > 0 ? Math.round((passCount / s.marks.length) * 1000) / 10 : 0,
        highestMarks: s.marks.length > 0 ? Math.max(...s.marks) : 0,
        lowestMarks: s.marks.length > 0 ? Math.min(...s.marks) : 0,
      };
    });

    const mapPerformer = (r: any, idx: number) => ({
      studentId: r.student_id, studentName: r.student_name,
      percentage: parseFloat(r.percentage), grade: r.grade || "N/A",
      position: r.section_position || idx + 1,
    });

    return {
      totalStudents: appeared,
      appeared,
      passed,
      failed: appeared - passed,
      averagePercent: Math.round(avgPct * 10) / 10,
      highestPercent: percentages.length > 0 ? Math.max(...percentages) : 0,
      lowestPercent: percentages.length > 0 ? Math.min(...percentages) : 0,
      subjectWise,
      gradeDistribution,
      topPerformers: top.slice(0, 5).map((r, i) => mapPerformer(r, i)),
      bottomPerformers: sorted.slice(0, 5).map((r, i) => mapPerformer(r, i)),
    };
  } catch { return empty; }
}

// ── Global search ────────────────────────────────────────────────────────────

export interface GlobalSearchResult {
  type: 'student' | 'teacher' | 'class';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

// Students carry PII (parent contacts, admission numbers), so only staff can
// search the student directory; students/parents can still find classes and
// teachers by name.
export async function globalSearchDB(rawQuery: string): Promise<GlobalSearchResult[]> {
  const auth = await requireSession();
  if ('error' in auth) return [];
  const q = rawQuery.trim();
  if (q.length < 2) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  const role = auth.session.role;
  const like = `%${q}%`;

  try {
    const results: GlobalSearchResult[] = [];

    if (role === 'ADMIN' || role === 'TEACHER') {
      const students = await query(
        `SELECT id, name, class, section, admission_number FROM students
         WHERE name ILIKE $1 OR admission_number ILIKE $1
         ORDER BY name LIMIT 6`,
        [like]
      );
      for (const r of students.rows) {
        results.push({
          type: 'student',
          id: r.id,
          title: r.name,
          subtitle: [r.class, r.section].filter(Boolean).join(' · ') || r.admission_number || 'Student',
          href: `/academics/students`,
        });
      }

      const teachers = await query(
        `SELECT id, name, email FROM users WHERE role = 'TEACHER' AND name ILIKE $1 ORDER BY name LIMIT 6`,
        [like]
      );
      for (const r of teachers.rows) {
        results.push({
          type: 'teacher',
          id: String(r.id),
          title: r.name,
          subtitle: r.email,
          href: `/teachers`,
        });
      }
    }

    const classes = await query(
      `SELECT id, name, grade_level FROM classes WHERE name ILIKE $1 OR grade_level ILIKE $1 ORDER BY name LIMIT 6`,
      [like]
    );
    for (const r of classes.rows) {
      results.push({
        type: 'class',
        id: r.id,
        title: r.name,
        subtitle: r.grade_level || 'Class',
        href: `/classes`,
      });
    }

    return results;
  } catch {
    return [];
  }
}

// ── Class-wise Book Library (PDF, base64-in-TEXT — same convention as
// course_materials.url) — used by Examinations' Book Library, the AI
// Question Generator, and surfaced read-only in LMS materials. ────────────
export interface ClassBook {
  id: string; classId: string; className?: string; subjectId: string | null; subjectName?: string;
  title: string; author: string | null; fileName: string | null; pdfData: string;
  uploadedByName: string | null; createdAt: string; isActive: boolean;
}

export async function fetchClassBooksDB(classId?: string, subjectId?: string): Promise<ClassBook[]> {
  const auth = await requireSession();
  if ('error' in auth) return [];
  try {
    let sql = `SELECT cb.*, c.name as class_name, sub.name as subject_name
               FROM class_books cb
               JOIN classes c ON c.id = cb.class_id
               LEFT JOIN subjects sub ON sub.id = cb.subject_id
               WHERE cb.is_active = true`;
    const params: string[] = [];
    if (classId) { params.push(classId); sql += ` AND cb.class_id = $${params.length}`; }
    if (subjectId) { params.push(subjectId); sql += ` AND cb.subject_id = $${params.length}`; }
    sql += ` ORDER BY cb.created_at DESC`;
    const res = await query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id, classId: r.class_id, className: r.class_name, subjectId: r.subject_id, subjectName: r.subject_name,
      title: r.title, author: r.author, fileName: r.file_name, pdfData: r.pdf_data,
      uploadedByName: r.uploaded_by_name, createdAt: r.created_at, isActive: r.is_active,
    }));
  } catch { return []; }
}

export async function uploadClassBookDB(data: { classId: string; subjectId?: string | null; title: string; author?: string; fileName: string; pdfData: string }): Promise<{ error?: string; id?: string }> {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return { error: auth.error };
  try {
    const { nanoid } = await import("nanoid");
    const id = `book-${nanoid(8)}`;
    await query(
      `INSERT INTO class_books (id, class_id, subject_id, title, author, file_name, pdf_data, uploaded_by_user_id, uploaded_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, data.classId, data.subjectId || null, data.title, data.author || null, data.fileName, data.pdfData,
       auth.session.userId, auth.session.name]
    );
    return { id };
  } catch (e) { logServerError("academic-core", "uploadClassBookDB error:", e); return { error: "Failed to upload book." }; }
}

export async function deleteClassBookDB(id: string): Promise<{ error?: string }> {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return { error: auth.error };
  try { await query("UPDATE class_books SET is_active = false WHERE id = $1", [id]); return {}; }
  catch { return { error: "Failed to delete book." }; }
}

// ── AI Question Bank (generated from a class_books PDF, reviewed before use) ──
export interface QuestionBankItem {
  id: string; bookId: string; classId: string; subjectId: string | null;
  questionType: 'MCQ' | 'ShortAnswer' | 'LongAnswer'; questionText: string;
  options: string[]; correctAnswer: string; marks: number; difficulty: string;
  status: 'draft' | 'approved'; generatedByAi: boolean; createdAt: string;
}

export async function fetchQuestionBankDB(bookId?: string): Promise<QuestionBankItem[]> {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return [];
  try {
    let sql = `SELECT * FROM question_bank`;
    const params: string[] = [];
    if (bookId) { params.push(bookId); sql += ` WHERE book_id = $${params.length}`; }
    sql += ` ORDER BY created_at DESC`;
    const res = await query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id, bookId: r.book_id, classId: r.class_id, subjectId: r.subject_id,
      questionType: r.question_type, questionText: r.question_text,
      options: r.options || [], correctAnswer: r.correct_answer, marks: r.marks,
      difficulty: r.difficulty, status: r.status, generatedByAi: r.generated_by_ai, createdAt: r.created_at,
    }));
  } catch { return []; }
}

export async function saveQuestionBankItemsDB(items: Omit<QuestionBankItem, 'id' | 'status' | 'createdAt'>[]): Promise<{ error?: string; count?: number }> {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return { error: auth.error };
  try {
    const { nanoid } = await import("nanoid");
    for (const item of items) {
      const id = `qb-${nanoid(8)}`;
      await query(
        `INSERT INTO question_bank (id, book_id, class_id, subject_id, question_type, question_text, options, correct_answer, marks, difficulty, status, generated_by_ai, created_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,$12)`,
        [id, item.bookId, item.classId, item.subjectId || null, item.questionType, item.questionText,
         JSON.stringify(item.options || []), item.correctAnswer, item.marks, item.difficulty,
         item.generatedByAi, auth.session.userId]
      );
    }
    return { count: items.length };
  } catch (e) { logServerError("academic-core", "saveQuestionBankItemsDB error:", e); return { error: "Failed to save questions." }; }
}

export async function updateQuestionBankItemDB(id: string, data: Partial<Pick<QuestionBankItem, 'questionText' | 'options' | 'correctAnswer' | 'marks' | 'status'>>): Promise<{ error?: string }> {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return { error: auth.error };
  try {
    const fields: string[] = []; const vals: any[] = []; let i = 1;
    if (data.questionText !== undefined) { fields.push(`question_text=$${i++}`); vals.push(data.questionText); }
    if (data.options !== undefined) { fields.push(`options=$${i++}`); vals.push(JSON.stringify(data.options)); }
    if (data.correctAnswer !== undefined) { fields.push(`correct_answer=$${i++}`); vals.push(data.correctAnswer); }
    if (data.marks !== undefined) { fields.push(`marks=$${i++}`); vals.push(data.marks); }
    if (data.status !== undefined) { fields.push(`status=$${i++}`); vals.push(data.status); }
    if (!fields.length) return {};
    vals.push(id);
    await query(`UPDATE question_bank SET ${fields.join(',')} WHERE id=$${i}`, vals);
    return {};
  } catch { return { error: "Failed to update question." }; }
}

export async function deleteQuestionBankItemDB(id: string): Promise<{ error?: string }> {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return { error: auth.error };
  try { await query("DELETE FROM question_bank WHERE id=$1", [id]); return {}; }
  catch { return { error: "Failed to delete question." }; }
}

// Loads the selected book's PDF and calls the AI flow, saving results as
// draft question-bank items for review before Approve.
export async function generateQuestionsFromBookDB(bookId: string, params: { topicHint?: string; mcqCount: number; shortAnswerCount: number; difficulty: 'Easy' | 'Medium' | 'Hard' }): Promise<{ error?: string; count?: number }> {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return { error: auth.error };
  try {
    const bookRes = await query('SELECT cb.*, sub.name as subject_name FROM class_books cb LEFT JOIN subjects sub ON sub.id = cb.subject_id WHERE cb.id=$1', [bookId]);
    if (bookRes.rows.length === 0) return { error: 'Book not found.' };
    const book = bookRes.rows[0];
    const { generateQuestionsFromBook } = await import('@/ai/flows/generate-questions-from-book');
    const result = await generateQuestionsFromBook({
      bookPdfDataUrl: book.pdf_data,
      subjectName: book.subject_name || book.title,
      topicHint: params.topicHint,
      mcqCount: params.mcqCount,
      shortAnswerCount: params.shortAnswerCount,
      difficulty: params.difficulty,
    });
    const saveRes = await saveQuestionBankItemsDB(result.questions.map(q => ({
      bookId, classId: book.class_id, subjectId: book.subject_id,
      questionType: q.type, questionText: q.questionText, options: q.options,
      correctAnswer: q.correctAnswer, marks: q.marks, difficulty: params.difficulty,
      generatedByAi: true,
    })));
    return saveRes;
  } catch (e: any) {
    logServerError("academic-core", "generateQuestionsFromBookDB error:", e);
    if (e?.status === 'UNAVAILABLE' || e?.code === 503) {
      return { error: 'The AI service is currently experiencing high demand and did not respond after several retries. Please try again in a minute.' };
    }
    return { error: 'AI generation failed. Please try again.' };
  }
}

// Pushes approved question-bank items into an online exam's own question
// bank (online_exam_questions) — the two-way bridge between "questions AI
// generated from a textbook" and "questions a student actually answers."
export async function addQuestionBankItemsToOnlineExamDB(examId: string, itemIds: string[]): Promise<{ error?: string; count?: number }> {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return { error: auth.error };
  try {
    const { nanoid } = await import("nanoid");
    let count = 0;
    for (const itemId of itemIds) {
      const res = await query("SELECT * FROM question_bank WHERE id=$1 AND status='approved'", [itemId]);
      if (res.rows.length === 0) continue;
      const q = res.rows[0];
      const type = q.question_type === 'MCQ' ? 'MCQ' : q.question_type === 'ShortAnswer' ? 'ShortAnswer' : 'Essay';
      await query(
        `INSERT INTO online_exam_questions (id, exam_id, type, question, options, correct_answer, marks) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [`oeq-${nanoid(8)}`, examId, type, q.question_text, JSON.stringify(q.options || []), q.correct_answer, q.marks]
      );
      count++;
    }
    return { count };
  } catch (e) { logServerError("academic-core", "addQuestionBankItemsToOnlineExamDB error:", e); return { error: "Failed to add questions to exam." }; }
}
