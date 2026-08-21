"use server";

import { query, checkDbConnection } from '../../lib/db';
import { initializeDatabase } from '../../lib/db-init';
import { getSession } from './auth';
import { logAudit } from '../../lib/audit';
import { logServerError } from '../../lib/error-log';
import {
  SchoolInfo, StudentRecord, ClassSection, Section, Subject, FeeCategory,
  AcademicTerm, FeeRecord, AttendanceRecord, ExamRecord, NotificationRecord,
  AdmissionApplication, FeeStructure,
} from '../../lib/types';
// Every mutation in this file runs behind one of these — role gating used to live
// only in the React components that called them, so a raw request to the server
// action endpoint bypassed it entirely. See audit finding "Three core server-action
// files have zero session/role checks".
import { requireRole, scopeBranch, withinBranch } from '../../lib/auth-scope';

// Helper to convert db rows to frontend objects
const mapRowToSchoolInfo = (row: any): SchoolInfo => ({
  name: row.name,
  registrationNumber: row.registration_number,
  address: row.address,
  contactEmail: row.contact_email,
  academicYear: row.academic_year,
  phone: row.phone || undefined,
  website: row.website || undefined,
  principal: row.principal || undefined,
  logoUrl: row.logo_url || undefined,
  foundingYear: row.founding_year || undefined,
  currency: row.currency || undefined,
  timezone: row.timezone || undefined,
});

const mapRowToStudent = (row: any): StudentRecord => ({
  id: row.id,
  name: row.name,
  admissionNumber: row.admission_number,
  class: row.class, // DEPRECATED — use enrollments table
  section: row.section, // DEPRECATED — use enrollments table
  parentName: row.parent_name,
  status: row.status as any,
  parentEmail: row.parent_email,
  email: row.email,
  profilePhoto: row.profile_photo,
});

const mapRowToClass = (row: any): ClassSection => ({
  id: row.id,
  name: row.name,
  capacity: row.capacity,
  teacherName: row.teacher_name,
});

const mapRowToSection = (row: any): Section => ({
  id: row.id,
  name: row.name,
  classId: row.class_id,
  capacity: row.capacity,
  teacherName: row.teacher_name,
  group: row.section_group,
});

const mapRowToSubject = (row: any): Subject => ({
  id: row.id,
  name: row.name,
  code: row.code,
  gradeLevel: row.grade_level,
  teacherName: row.teacher_name,
  isElective: row.is_elective,
});

const mapRowToFeeCategory = (row: any): FeeCategory => ({
  id: row.id,
  name: row.name,
  description: row.description,
  defaultAmount: row.default_amount,
  frequency: row.frequency as any,
  isActive: row.is_active,
});

const mapRowToFeeStructure = (row: any): FeeStructure => ({
  id: row.id,
  name: row.name,
  assignedClass: row.assigned_class,
  lineItems: row.line_items
    ? (typeof row.line_items === "string" ? JSON.parse(row.line_items) : row.line_items)
    : [],
  totalAmount: row.total_amount,
  isActive: row.is_active,
});

const mapRowToAcademicTerm = (row: any): AcademicTerm => ({
  id: row.id,
  name: row.name,
  startDate: row.start_date,
  endDate: row.end_date,
  isActive: row.is_active,
});

const mapRowToFeeRecord = (row: any): FeeRecord => ({
  id: row.id,
  studentId: row.student_id,
  studentName: row.student_name,
  amount: row.amount,
  dueDate: row.due_date,
  status: row.status as any,
  voucherId: row.voucher_id,
  paymentMethod: row.payment_method,
  paymentDate: row.payment_date,
  discount: row.discount ?? 0,
  discountReason: row.discount_reason,
  amountPaid: row.amount_paid ?? 0,
  month: row.month,
  feeType: row.fee_type,
  issueDate: row.issue_date,
  className: row.class_name,
  lineItems: row.line_items
    ? (typeof row.line_items === "string" ? JSON.parse(row.line_items) : row.line_items)
    : [],
});

const mapRowToAttendance = (row: any): AttendanceRecord => ({
  id: row.id,
  studentId: row.student_id,
  studentName: row.student_name,
  class: row.class,
  section: row.section,
  date: row.date,
  status: row.status as any,
});

const mapRowToExam = (row: any): ExamRecord => ({
  id: row.id,
  examName: row.exam_name,
  subject: row.subject,
  className: row.class_name,
  date: row.date,
  commonStrengths: row.common_strengths,
  commonWeaknesses: row.common_weaknesses,
  studentResults: row.student_results,
});

const mapRowToApplication = (row: any): AdmissionApplication => ({
  id: row.id,
  applicationId: row.application_id,
  submittedAt: row.submitted_at,
  status: row.status as any,
  firstName: row.first_name,
  lastName: row.last_name,
  dateOfBirth: row.date_of_birth,
  gender: row.gender as any,
  nationality: row.nationality,
  bloodGroup: row.blood_group,
  applyingForClass: row.applying_for_class,
  previousSchool: row.previous_school,
  previousGrade: row.previous_grade,
  parentName: row.parent_name,
  parentRelation: row.parent_relation,
  parentPhone: row.parent_phone,
  parentEmail: row.parent_email,
  parentCNIC: row.parent_cnic,
  address: row.address,
  city: row.city,
  adminNotes: row.admin_notes,
  profilePhoto: row.profile_photo,
});

const mapRowToNotification = (row: any): NotificationRecord => ({
  id: row.id,
  title: row.title,
  message: row.message,
  date: row.date,
  recipientRole: row.recipient_role as any,
  recipientEmail: row.recipient_email,
  read: row.read,
});

// Guard so initializeDatabase only runs once per module lifetime
let _dbInitialized = false;

// Fetch all state
export async function fetchDBState() {
  const session = await getSession();
  if (!session) return null;

  const isOnline = await checkDbConnection();
  if (!isOnline) {
    return null;
  }

  if (!_dbInitialized) {
    await initializeDatabase();
    _dbInitialized = true;
  }

  try {
    // Multi-branch scoping: OWNER (or a legacy pre-branch session) sees
    // everything; every other role only sees rows belonging to their branch.
    // fee_records/attendance don't carry their own branch_id — they're
    // scoped indirectly via a student-id subquery against the students
    // table, which does.
    const branchId = scopeBranch(session);
    const [
      schoolRes, studentsRes, classesRes, sectionsRes, subjectsRes,
      feeCatRes, feeStrRes, termsRes, feeRecRes, attRes, examRes, notifRes, appsRes,
    ] = await Promise.all([
      query('SELECT name, registration_number, address, contact_email, academic_year, phone, website, principal, logo_url, founding_year, currency, timezone FROM school_info LIMIT 1'),
      branchId ? query('SELECT id, name, admission_number, class, section, parent_name, status, parent_email, email, profile_photo FROM students WHERE branch_id=$1', [branchId]) : query('SELECT id, name, admission_number, class, section, parent_name, status, parent_email, email, profile_photo FROM students'),
      branchId ? query('SELECT id, name, grade_level, academic_year_id, branch_id, is_graduating FROM classes WHERE branch_id=$1', [branchId]) : query('SELECT id, name, grade_level, academic_year_id, branch_id, is_graduating FROM classes'),
      branchId
        ? query('SELECT sec.id, sec.name, sec.class_id, sec.capacity, sec.teacher_name, sec.section_group FROM sections sec JOIN classes c ON c.id = sec.class_id WHERE c.branch_id=$1', [branchId])
        : query('SELECT id, name, class_id, capacity, teacher_name, section_group FROM sections'),
      branchId
        ? query('SELECT id, name, code, grade_level, teacher_name, is_elective FROM subjects WHERE branch_id=$1', [branchId])
        : query('SELECT id, name, code, grade_level, teacher_name, is_elective FROM subjects'),
      query('SELECT id, name, description, default_amount, frequency, is_active FROM fee_categories'),
      query('SELECT id, name, assigned_class, line_items, total_amount, is_active FROM fee_structures').catch(() => ({ rows: [] })),
      query('SELECT id, name, start_date, end_date, is_active FROM academic_terms'),
      branchId
        ? query('SELECT id, student_id, student_name, amount, due_date, status, voucher_id, payment_method, payment_date, discount, discount_reason, amount_paid, month, fee_type, issue_date, class_name, line_items FROM fee_records WHERE student_id IN (SELECT id FROM students WHERE branch_id=$1)', [branchId])
        : query('SELECT id, student_id, student_name, amount, due_date, status, voucher_id, payment_method, payment_date, discount, discount_reason, amount_paid, month, fee_type, issue_date, class_name, line_items FROM fee_records'),
      branchId
        ? query('SELECT id, student_id, student_name, class, section, date, status FROM attendance WHERE student_id IN (SELECT id FROM students WHERE branch_id=$1)', [branchId])
        : query('SELECT id, student_id, student_name, class, section, date, status FROM attendance'),
      branchId
        ? query('SELECT id, exam_name, subject, class_name, date, common_strengths, common_weaknesses, student_results FROM exams WHERE branch_id=$1', [branchId])
        : query('SELECT id, exam_name, subject, class_name, date, common_strengths, common_weaknesses, student_results FROM exams'),
      query('SELECT id, title, message, date, recipient_role, recipient_email, read FROM notifications'),
      branchId
        ? query('SELECT id, application_id, submitted_at, status, first_name, last_name, date_of_birth, gender, nationality, blood_group, applying_for_class, previous_school, previous_grade, parent_name, parent_relation, parent_phone, parent_email, parent_cnic, address, city, admin_notes, profile_photo FROM admission_applications WHERE branch_id=$1 ORDER BY submitted_at DESC', [branchId]).catch(() => ({ rows: [] }))
        : query('SELECT id, application_id, submitted_at, status, first_name, last_name, date_of_birth, gender, nationality, blood_group, applying_for_class, previous_school, previous_grade, parent_name, parent_relation, parent_phone, parent_email, parent_cnic, address, city, admin_notes, profile_photo FROM admission_applications ORDER BY submitted_at DESC').catch(() => ({ rows: [] })),
    ]);

    return {
      schoolInfo: schoolRes.rows.length > 0 ? mapRowToSchoolInfo(schoolRes.rows[0]) : null,
      students: studentsRes.rows.map(mapRowToStudent),
      classes: classesRes.rows.map(mapRowToClass),
      sections: sectionsRes.rows.map(mapRowToSection),
      subjects: subjectsRes.rows.map(mapRowToSubject),
      feeCategories: feeCatRes.rows.map(mapRowToFeeCategory),
      feeStructures: feeStrRes.rows.map(mapRowToFeeStructure),
      academicTerms: termsRes.rows.map(mapRowToAcademicTerm),
      feeRecords: feeRecRes.rows.map(mapRowToFeeRecord),
      attendance: attRes.rows.map(mapRowToAttendance),
      exams: examRes.rows.map(mapRowToExam),
      notifications: notifRes.rows.map(mapRowToNotification),
      applications: appsRes.rows.map(mapRowToApplication),
    };
  } catch (err) {
    logServerError("db", "Failed to fetch state from DB", err);
    return null;
  }
}

// Write Operations
export async function updateSchoolInfoDB(info: SchoolInfo) {
  const auth = await requireRole('ADMIN', 'OWNER');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  await query(
    `UPDATE school_info SET name=$1, registration_number=$2, address=$3, contact_email=$4, academic_year=$5,
     phone=$6, website=$7, principal=$8, logo_url=$9, founding_year=$10, currency=$11, timezone=$12`,
    [
      info.name, info.registrationNumber, info.address, info.contactEmail, info.academicYear,
      info.phone || null, info.website || null, info.principal || null, info.logoUrl || null,
      info.foundingYear || null, info.currency || null, info.timezone || null,
    ]
  );
}

export async function addStudentDB(st: StudentRecord) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;

  // NOTE: `class` and `section` columns are DEPRECATED — use enrollments table for grade/section assignment
  await query(
    `INSERT INTO students (id, name, admission_number, class, section, parent_name, status, parent_email, email, profile_photo, branch_id, dob, gender, address, guardian_relation, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      st.id, st.name, st.admissionNumber, st.class, st.section, st.parentName, st.status, st.parentEmail, st.email, st.profilePhoto || null, scopeBranch(auth.session),
      st.dateOfBirth || null, st.gender || null, st.address || null, st.guardianRelation || null, st.phone || null,
    ]
  );
  return st;
}

export async function updateStudentDB(st: StudentRecord) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;

  if (auth.session.role === 'TEACHER') {
    // A class teacher may edit contact/profile fields for students in their
    // own section — never class/section/status/admission number, which stay
    // admin-only so a class teacher can't smuggle a transfer or withdrawal
    // through the profile-edit form.
    const check = await query(
      `SELECT 1 FROM enrollments e JOIN sections sec ON sec.id = e.section_id
       WHERE e.student_id=$1 AND e.status='Active' AND sec.class_teacher_id=$2 LIMIT 1`,
      [st.id, auth.session.userId]
    );
    if (check.rows.length === 0) return;
    await query(
      `UPDATE students SET parent_name=$1, parent_email=$2, email=$3, profile_photo=$4,
         dob=$5, gender=$6, address=$7, guardian_relation=$8, phone=$9
       WHERE id=$10`,
      [
        st.parentName, st.parentEmail, st.email, st.profilePhoto || null,
        st.dateOfBirth || null, st.gender || null, st.address || null, st.guardianRelation || null, st.phone || null,
        st.id,
      ]
    );
    return;
  }

  const target = await query("SELECT branch_id FROM students WHERE id = $1", [st.id]);
  if (target.rows.length === 0 || !withinBranch(auth.session, target.rows[0].branch_id)) return;

  await query(
    `UPDATE students SET name=$1, class=$2, section=$3, parent_name=$4, status=$5, parent_email=$6, email=$7, admission_number=$8, profile_photo=$9,
       dob=$10, gender=$11, address=$12, guardian_relation=$13, phone=$14
     WHERE id=$15`,
    [
      st.name, st.class, st.section, st.parentName, st.status, st.parentEmail, st.email, st.admissionNumber, st.profilePhoto || null,
      st.dateOfBirth || null, st.gender || null, st.address || null, st.guardianRelation || null, st.phone || null,
      st.id,
    ]
  );
}

export async function resetStudentPasswordDB(email: string, newPassword: string): Promise<{ error?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  const isOnline = await checkDbConnection();
  if (!isOnline) return { error: 'Database offline' };
  try {
    const { prisma } = await import('../../lib/prisma');
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { error: 'No portal account found for this email' };
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return {};
  } catch { return { error: 'Failed to reset password' }; }
}

export async function deleteStudentDB(id: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  const target = await query("SELECT branch_id FROM students WHERE id=$1", [id]);
  if (target.rows.length === 0 || !withinBranch(auth.session, target.rows[0].branch_id)) return;
  await query(`DELETE FROM students WHERE id=$1`, [id]);
}

export async function addClassDB(c: ClassSection) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  await query(`INSERT INTO classes (id, name, capacity, teacher_name, branch_id) VALUES ($1, $2, $3, $4, $5)`, [c.id, c.name, c.capacity, c.teacherName, scopeBranch(auth.session)]);
  return c;
}

export async function updateClassDB(c: ClassSection) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  const target = await query('SELECT branch_id FROM classes WHERE id=$1', [c.id]);
  if (target.rows.length === 0 || !withinBranch(auth.session, target.rows[0].branch_id)) return;
  await query(`UPDATE classes SET name=$1, capacity=$2, teacher_name=$3 WHERE id=$4`, [c.name, c.capacity, c.teacherName, c.id]);
}

export async function deleteClassDB(id: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  const target = await query('SELECT branch_id FROM classes WHERE id=$1', [id]);
  if (target.rows.length === 0 || !withinBranch(auth.session, target.rows[0].branch_id)) return;
  await query(`DELETE FROM classes WHERE id=$1`, [id]);
}

export async function addSubjectDB(s: Subject) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  await query(`INSERT INTO subjects (id, name, code, grade_level, teacher_name, is_elective, branch_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [s.id, s.name, s.code, s.gradeLevel, s.teacherName || null, s.isElective, scopeBranch(auth.session)]);
  return s;
}

export async function updateSubjectDB(s: Subject) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  const target = await query('SELECT branch_id FROM subjects WHERE id=$1', [s.id]);
  if (target.rows.length === 0 || !withinBranch(auth.session, target.rows[0].branch_id)) return;
  await query(`UPDATE subjects SET name=$1, code=$2, grade_level=$3, teacher_name=$4, is_elective=$5 WHERE id=$6`, [s.name, s.code, s.gradeLevel, s.teacherName || null, s.isElective, s.id]);
}

export async function deleteSubjectDB(id: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  const target = await query('SELECT branch_id FROM subjects WHERE id=$1', [id]);
  if (target.rows.length === 0 || !withinBranch(auth.session, target.rows[0].branch_id)) return;
  await query(`DELETE FROM subjects WHERE id=$1`, [id]);
}

export async function addFeeCategoryDB(fc: FeeCategory) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  await query(`INSERT INTO fee_categories (id, name, description, default_amount, frequency, is_active) VALUES ($1, $2, $3, $4, $5, $6)`, [fc.id, fc.name, fc.description, fc.defaultAmount, fc.frequency, fc.isActive]);
  return fc;
}

export async function updateFeeCategoryDB(fc: FeeCategory) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  await query(`UPDATE fee_categories SET name=$1, description=$2, default_amount=$3, frequency=$4, is_active=$5 WHERE id=$6`, [fc.name, fc.description, fc.defaultAmount, fc.frequency, fc.isActive, fc.id]);
}

export async function deleteFeeCategoryDB(id: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  await query(`DELETE FROM fee_categories WHERE id=$1`, [id]);
}

export async function addAcademicTermDB(t: AcademicTerm) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  await query(`INSERT INTO academic_terms (id, name, start_date, end_date, is_active) VALUES ($1, $2, $3, $4, $5)`, [t.id, t.name, t.startDate, t.endDate, t.isActive]);
  return t;
}

export async function updateAcademicTermDB(t: AcademicTerm) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  await query(`UPDATE academic_terms SET name=$1, start_date=$2, end_date=$3, is_active=$4 WHERE id=$5`, [t.name, t.startDate, t.endDate, t.isActive, t.id]);
}

export async function setActiveTermDB(id: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  await query(`UPDATE academic_terms SET is_active = false`);
  await query(`UPDATE academic_terms SET is_active = true WHERE id=$1`, [id]);
}

export async function generateFeeVouchersDB(newRecords: FeeRecord[]) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;

  for (const rec of newRecords) {
    await query(
      `INSERT INTO fee_records (id, student_id, student_name, amount, due_date, status, voucher_id, month, fee_type, issue_date, class_name, line_items, class_id, section_id, academic_year_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [rec.id, rec.studentId, rec.studentName, rec.amount, rec.dueDate, rec.status, rec.voucherId,
       rec.month || null, rec.feeType || null, rec.issueDate || null, rec.className || null,
       JSON.stringify(rec.lineItems || []), rec.classId || null, rec.sectionId || null, rec.academicYearId || null]
    );
  }
  return newRecords;
}

export async function applyFeeDiscountDB(voucherId: string, discount: number, reason: string): Promise<{ error?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  const isOnline = await checkDbConnection();
  if (!isOnline) return { error: "Database offline." };
  try {
    const feeRes = await query("SELECT amount, amount_paid, discount, discount_reason, student_name, voucher_id FROM fee_records WHERE id=$1", [voucherId]);
    if (feeRes.rows.length === 0) return { error: "Voucher not found." };
    const fee = feeRes.rows[0];
    const netDue = (fee.amount || 0) - (fee.amount_paid || 0);
    if (discount > netDue + 0.01) {
      return { error: `Discount cannot exceed the remaining due amount (Rs. ${netDue.toLocaleString()}).` };
    }
    await query(`UPDATE fee_records SET discount=$1, discount_reason=$2 WHERE id=$3`, [discount, reason, voucherId]);
    // Discount changes the net due — status may now resolve to Paid if payments already cover it.
    await recomputeFeeStatusDB(voucherId);

    await logAudit({
      actor: { userId: auth.session.userId, name: auth.session.name, role: auth.session.role },
      action: 'UPDATE',
      entityType: 'fee_discount',
      entityId: voucherId,
      summary: `Applied discount of Rs. ${discount.toLocaleString()} to ${fee.student_name || 'voucher'} (${fee.voucher_id || voucherId})${reason ? ` — ${reason}` : ''}`,
      before: { discount: fee.discount ?? 0, discountReason: fee.discount_reason ?? null },
      after: { discount, discountReason: reason || null },
    });

    return {};
  } catch (err) { logServerError("db", err); return { error: "Failed to apply discount." }; }
}

export interface AuditLogEntry {
  id: string;
  actorName: string;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

// Compliance audit trail — admin-only. Supports filtering by entity type and
// a free-text search over the summary/actor, newest first.
export async function fetchAuditLogDB(filters?: { entityType?: string; search?: string; limit?: number }): Promise<AuditLogEntry[]> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    if (filters?.entityType) {
      params.push(filters.entityType);
      conditions.push(`entity_type = $${params.length}`);
    }
    if (filters?.search) {
      params.push(`%${filters.search}%`);
      conditions.push(`(summary ILIKE $${params.length} OR actor_name ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters?.limit ?? 200, 500);
    params.push(limit);
    const res = await query(
      `SELECT id, actor_name, actor_role, action, entity_type, entity_id, summary, before_data, after_data, created_at
       FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      actorName: r.actor_name || 'Unknown',
      actorRole: r.actor_role,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      summary: r.summary,
      before: r.before_data,
      after: r.after_data,
      createdAt: r.created_at,
    }));
  } catch (err) { logServerError("db", err); return []; }
}

// Recomputes amount_paid/status/payment_method/payment_date on fee_records from the
// fee_payments ledger — the ledger is the source of truth, these are a read cache.
async function recomputeFeeStatusDB(feeRecordId: string) {
  const feeRes = await query("SELECT amount, discount FROM fee_records WHERE id=$1", [feeRecordId]);
  if (feeRes.rows.length === 0) return;
  const fee = feeRes.rows[0];
  const sumRes = await query(
    `SELECT COALESCE(SUM(CASE WHEN type='refund' THEN -amount ELSE amount END),0) as total FROM fee_payments WHERE fee_record_id=$1`,
    [feeRecordId]
  );
  const totalPaid = parseFloat(sumRes.rows[0].total) || 0;
  const netDue = (fee.amount || 0) - (fee.discount || 0);
  const status = totalPaid <= 0 ? "Unpaid" : totalPaid >= netDue - 0.01 ? "Paid" : "Partial";
  const lastRes = await query(
    `SELECT method, payment_date FROM fee_payments WHERE fee_record_id=$1 AND type='payment' ORDER BY created_at DESC LIMIT 1`,
    [feeRecordId]
  );
  const last = lastRes.rows[0];
  await query(
    `UPDATE fee_records SET amount_paid=$1, status=$2, payment_method=$3, payment_date=$4 WHERE id=$5`,
    [totalPaid, status, last?.method || null, last?.payment_date || null, feeRecordId]
  );
}

// Core ledger writer. Not session-gated itself — callers are responsible for
// establishing their own authorization before calling this:
//   - recordFeePaymentDB (below) requires an ADMIN session.
//   - the JazzCash/EasyPaisa gateway callbacks (src/app/api/payments/*) are
//     server-to-server requests with no user session at all; their authority
//     comes from a verified HMAC signature on the gateway's callback payload,
//     checked before this is ever called.
export async function writeFeePaymentLedgerEntryDB(
  feeRecordId: string, amount: number, method: string, date: string,
  recordedByUserId?: number, type: "payment" | "refund" = "payment"
): Promise<{ error?: string }> {
  const isOnline = await checkDbConnection();
  if (!isOnline) return { error: "Database offline." };
  if (!amount || amount <= 0) return { error: "Amount must be greater than zero." };
  try {
    const feeRes = await query("SELECT amount, discount FROM fee_records WHERE id=$1", [feeRecordId]);
    if (feeRes.rows.length === 0) return { error: "Voucher not found." };
    const fee = feeRes.rows[0];

    if (type === "payment") {
      const sumRes = await query(
        `SELECT COALESCE(SUM(CASE WHEN type='refund' THEN -amount ELSE amount END),0) as total FROM fee_payments WHERE fee_record_id=$1`,
        [feeRecordId]
      );
      const totalPaid = parseFloat(sumRes.rows[0].total) || 0;
      const netDue = (fee.amount || 0) - (fee.discount || 0);
      if (totalPaid + amount > netDue + 0.01) {
        return { error: `Amount exceeds the remaining balance (Rs. ${(netDue - totalPaid).toLocaleString()} due).` };
      }
    }

    const id = `fp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    await query(
      `INSERT INTO fee_payments (id, fee_record_id, amount, method, payment_date, type, recorded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, feeRecordId, amount, method || null, date, type, recordedByUserId || null]
    );
    await recomputeFeeStatusDB(feeRecordId);

    // Single choke point for every fee payment (admin-recorded AND the JazzCash/
    // EasyPaisa gateway callbacks route through here), so this is the one place
    // that needs an audit entry to cover the whole category — not each caller.
    let actor: { userId: number; name: string; role: string } | null = null;
    if (recordedByUserId) {
      const userRes = await query(`SELECT name, role FROM users WHERE id=$1`, [recordedByUserId]);
      if (userRes.rows.length > 0) actor = { userId: recordedByUserId, name: userRes.rows[0].name, role: userRes.rows[0].role };
    }
    await logAudit({
      actor,
      action: type === "refund" ? 'UPDATE' : 'CREATE',
      entityType: 'fee_payment',
      entityId: feeRecordId,
      summary: `${type === "refund" ? "Refunded" : "Recorded payment of"} Rs. ${amount.toLocaleString()} via ${method || "unspecified method"} for voucher ${feeRecordId}${!recordedByUserId ? " (online gateway)" : ""}`,
      after: { amount, method, date, type },
    });

    return {};
  } catch (err) { logServerError("db", err); return { error: "Failed to record payment." }; }
}

// Shared ledger writer behind payFeeVoucherDB/recordPartialPaymentDB — every payment
// (full or partial) becomes its own fee_payments row; fee_records is recomputed after.
export async function recordFeePaymentDB(
  feeRecordId: string, amount: number, method: string, date: string,
  recordedByUserId?: number, type: "payment" | "refund" = "payment"
): Promise<{ error?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  // Callers reached through this wrapper (payFeeVoucherDB, recordPartialPaymentDB)
  // don't carry a userId parameter of their own — default to the admin session
  // already established above so the audit trail always has a real actor instead
  // of falling through to the "online gateway" no-session case in the ledger writer.
  return writeFeePaymentLedgerEntryDB(feeRecordId, amount, method, date, recordedByUserId ?? auth.session.userId, type);
}

// One student's fee vouchers (not the per-voucher payment ledger below) —
// backs the Fees tab on the student profile page. Branch-scoped indirectly
// via the student row itself, same trust boundary as reading their other
// profile data through fetchStudentProfileDB.
export async function fetchStudentFeeRecordsDB(studentId: string): Promise<FeeRecord[]> {
  const session = await getSession();
  if (!session) return [];
  try {
    const res = await query("SELECT * FROM fee_records WHERE student_id=$1 ORDER BY due_date DESC", [studentId]);
    return res.rows.map(mapRowToFeeRecord);
  } catch { return []; }
}

export interface FeePaymentHistoryEntry {
  id: string; amount: number; method: string | null; paymentDate: string | null;
  type: "payment" | "refund"; createdAt: string;
}

export async function fetchFeePaymentHistoryDB(feeRecordId: string): Promise<FeePaymentHistoryEntry[]> {
  const session = await getSession();
  if (!session) return [];
  try {
    const res = await query(
      "SELECT * FROM fee_payments WHERE fee_record_id=$1 ORDER BY created_at ASC",
      [feeRecordId]
    );
    return res.rows.map(r => ({
      id: r.id, amount: parseFloat(r.amount), method: r.method, paymentDate: r.payment_date,
      type: r.type, createdAt: r.created_at,
    }));
  } catch { return []; }
}

export async function recordPartialPaymentDB(voucherId: string, amountPaid: number, paymentMethod: string): Promise<{ error?: string }> {
  const today = new Date().toISOString().split("T")[0];
  return recordFeePaymentDB(voucherId, amountPaid, paymentMethod, today);
}

export async function payFeeVoucherDB(voucherId: string, paymentMethod: string): Promise<{ error?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { error: auth.error };
  const isOnline = await checkDbConnection();
  if (!isOnline) return { error: "Database offline." };
  const feeRes = await query("SELECT amount, discount, amount_paid FROM fee_records WHERE id=$1", [voucherId]);
  if (feeRes.rows.length === 0) return { error: "Voucher not found." };
  const fee = feeRes.rows[0];
  const netDue = (fee.amount || 0) - (fee.discount || 0) - (fee.amount_paid || 0);
  if (netDue <= 0) return {};
  const today = new Date().toISOString().split("T")[0];
  return recordFeePaymentDB(voucherId, netDue, paymentMethod, today);
}

export async function saveAttendanceDB(records: AttendanceRecord[]) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  if (records.length === 0) return records;

  const date       = records[0].date;
  const studentIds = records.map(r => r.studentId);

  // Remove stale records for these students on this date before inserting
  await query(
    `DELETE FROM attendance WHERE date = $1 AND student_id = ANY($2::text[])`,
    [date, studentIds]
  );

  for (const r of records) {
    await query(
      `INSERT INTO attendance (id, student_id, student_name, class, section, date, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [r.id, r.studentId, r.studentName, r.class, r.section, r.date, r.status]
    );
  }
  return records;
}

export async function saveExamResultsDB(exam: ExamRecord) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  await query(`INSERT INTO exams (id, exam_name, subject, class_name, date, common_strengths, common_weaknesses, student_results, branch_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [exam.id, exam.examName, exam.subject, exam.className, exam.date, exam.commonStrengths, exam.commonWeaknesses, JSON.stringify(exam.studentResults), scopeBranch(auth.session)]);
  return exam.id;
}

export async function updateExamAIResultsDB(examId: string, strengths: string, weaknesses: string, studentRecs: { studentName: string; recommendations: string }[]) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  // Get exam
  const res = await query(`SELECT student_results, branch_id FROM exams WHERE id=$1`, [examId]);
  if (res.rows.length === 0) return;
  if (!withinBranch(auth.session, res.rows[0].branch_id)) return;
  const results = res.rows[0].student_results;
  
  // Update recommendations
  const updatedResults = results.map((r: any) => {
    const rec = studentRecs.find((sr) => sr.studentName === r.studentName);
    return rec ? { ...r, recommendations: rec.recommendations } : r;
  });

  await query(`UPDATE exams SET common_strengths=$1, common_weaknesses=$2, student_results=$3 WHERE id=$4`,
    [strengths, weaknesses, JSON.stringify(updatedResults), examId]);
}

export async function addNotificationDB(notif: NotificationRecord) {
  const auth = await requireRole('ADMIN', 'TEACHER');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  await query(`INSERT INTO notifications (id, title, message, date, recipient_role, recipient_email, read) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [notif.id, notif.title, notif.message, notif.date, notif.recipientRole, notif.recipientEmail || null, notif.read]);
  return notif;
}

export async function markNotificationReadDB(id: string) {
  const session = await getSession();
  if (!session) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  // Ownership check: only the notification's own recipient (by role, and by email
  // when the notification is targeted at a specific person) may mark it read.
  const res = await query('SELECT recipient_role, recipient_email FROM notifications WHERE id=$1', [id]);
  const notif = res.rows[0];
  if (!notif) return;
  if (notif.recipient_role !== session.role) return;
  if (notif.recipient_email && notif.recipient_email !== session.email) return;
  await query(`UPDATE notifications SET read=true WHERE id=$1`, [id]);
}

export async function updateApplicationStatusDB(id: string, status: string, notes?: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  await query(
    `UPDATE admission_applications SET status=$1, admin_notes=$2 WHERE id=$3`,
    [status, notes || null, id]
  );
}

export async function addFeeStructureDB(fs: FeeStructure) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return null;
  const isOnline = await checkDbConnection();
  if (!isOnline) return null;
  await query(
    `INSERT INTO fee_structures (id, name, assigned_class, assigned_class_id, line_items, total_amount, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [fs.id, fs.name, fs.assignedClass, fs.assignedClassId || null, JSON.stringify(fs.lineItems), fs.totalAmount, fs.isActive]
  );
  return fs;
}

export async function updateFeeStructureDB(fs: FeeStructure) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  await query(
    `UPDATE fee_structures SET name=$1, assigned_class=$2, assigned_class_id=$3, line_items=$4, total_amount=$5, is_active=$6 WHERE id=$7`,
    [fs.name, fs.assignedClass, fs.assignedClassId || null, JSON.stringify(fs.lineItems), fs.totalAmount, fs.isActive, fs.id]
  );
}

export async function deleteFeeStructureDB(id: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  await query(`DELETE FROM fee_structures WHERE id=$1`, [id]);
}

export async function updateFeePaymentDB(voucherId: string, method: string, date: string) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  const v = await query(
    `SELECT s.branch_id AS branch_id FROM fee_records fr JOIN students s ON s.id = fr.student_id WHERE fr.id = $1`,
    [voucherId]
  );
  if (v.rows.length === 0 || !withinBranch(auth.session, v.rows[0].branch_id)) return;
  await query(
    `UPDATE fee_records SET payment_method=$1, payment_date=$2 WHERE id=$3`,
    [method, date, voucherId]
  );
}

export async function regenerateVoucherDB(voucherId: string, month: string, dueDate: string, amount: number, lineItems: any[]) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return;
  const isOnline = await checkDbConnection();
  if (!isOnline) return;
  // Regenerating resets the voucher — clear its old payment ledger so history doesn't
  // bleed into the new billing cycle.
  await query(`DELETE FROM fee_payments WHERE fee_record_id=$1`, [voucherId]);
  await query(
    `UPDATE fee_records SET month=$1, due_date=$2, amount=$3, line_items=$4, status='Unpaid', payment_method=NULL, payment_date=NULL, discount=0, discount_reason=NULL, amount_paid=0 WHERE id=$5`,
    [month, dueDate, amount, JSON.stringify(lineItems), voucherId]
  );
}
