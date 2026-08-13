"use server";

import { query, checkDbConnection } from '../../lib/db';
import { initializeDatabase } from '../../lib/db-init';
import type { AdmissionApplication, StudentRecord } from '../../lib/types';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { checkSectionCapacityDB } from './academic-core';
import { getSession } from './auth';

export async function getSchoolInfoAction(): Promise<{ name: string; academicYear: string }> {
  try {
    const isOnline = await checkDbConnection();
    if (!isOnline) return { name: "Scholarly Central", academicYear: "2026-2027" };
    const res = await query('SELECT name, academic_year FROM school_info LIMIT 1');
    if (res.rows.length === 0) return { name: "Scholarly Central", academicYear: "2026-2027" };
    return { name: res.rows[0].name, academicYear: res.rows[0].academic_year };
  } catch {
    return { name: "Scholarly Central", academicYear: "2026-2027" };
  }
}

export async function submitAdmissionApplicationAction(
  data: Omit<AdmissionApplication, 'id' | 'applicationId' | 'submittedAt' | 'status' | 'adminNotes'>
): Promise<{ applicationId: string; submittedAt: string }> {
  const id = `app_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const year = new Date().getFullYear();
  const serial = String(Math.floor(Math.random() * 9000) + 1000);
  const applicationId = `APP-${year}-${serial}`;
  const submittedAt = new Date().toISOString().split('T')[0];

  let passwordHash: string | null = null;
  if (data.parentPortalPassword) {
    passwordHash = await bcrypt.hash(data.parentPortalPassword, 12);
  }

  try {
    const isOnline = await checkDbConnection();
    if (isOnline) {
      await initializeDatabase();
      await query(
        `INSERT INTO admission_applications
         (id, application_id, submitted_at, status, first_name, last_name, date_of_birth,
          gender, nationality, blood_group, applying_for_class, previous_school, previous_grade,
          parent_name, parent_relation, parent_phone, parent_email, parent_cnic, address, city,
          parent_portal_password_hash, profile_photo, previous_result_filename)
         VALUES ($1,$2,$3,'Pending',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        [
          id, applicationId, submittedAt,
          data.firstName, data.lastName, data.dateOfBirth,
          data.gender, data.nationality, data.bloodGroup || null,
          data.applyingForClass, data.previousSchool || null, data.previousGrade || null,
          data.parentName, data.parentRelation, data.parentPhone, data.parentEmail,
          data.parentCNIC || null, data.address, data.city,
          passwordHash,
          data.profilePhoto || null,
          data.previousResultFilename || null,
        ]
      );
    }
  } catch (err) {
    console.error("Failed to save application to DB", err);
  }

  return { applicationId, submittedAt };
}

export async function approveAdmissionWithAccountsDB(
  appId: string,
  classId?: string,
  sectionId?: string
): Promise<{ error?: string; studentRecord?: StudentRecord }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (session.role !== 'ADMIN') return { error: 'Only admins can approve admissions.' };
  try {
    const appRes = await query('SELECT * FROM admission_applications WHERE id=$1', [appId]);
    if (appRes.rows.length === 0) return { error: 'Application not found' };
    const app = appRes.rows[0];

    // Check section capacity before enrolling
    if (sectionId) {
      const cap = await checkSectionCapacityDB(sectionId);
      if (!cap.ok) return { error: cap.error };
    }

    // Generate student identifiers
    const countRes = await query('SELECT COUNT(*) FROM students');
    const count = parseInt(countRes.rows[0].count, 10);
    const studentId = `s${Date.now()}`;
    const year = new Date().getFullYear();
    const admissionNumber = `ADM-${year}-${String(count + 1).padStart(3, '0')}`;
    const studentEmail = `${admissionNumber.toLowerCase().replace(/-/g, '')}@student.school.edu`;

    // Generate a random temporary password for the student
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const tempPassword = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const studentPasswordHash = await bcrypt.hash(tempPassword, 12);

    // Resolve class & section (kept for backward compatibility in student record display)
    let className = app.applying_for_class;
    let sectionName = 'A';
    if (classId) {
      try {
        const clsRes = await query('SELECT name FROM classes WHERE id=$1', [classId]);
        if (clsRes.rows.length > 0) className = clsRes.rows[0].name;
      } catch { /* keep original */ }
    }
    if (sectionId) {
      try {
        const secRes = await query('SELECT name FROM sections WHERE id=$1', [sectionId]);
        if (secRes.rows.length > 0) sectionName = secRes.rows[0].name;
      } catch { /* keep default */ }
    }

    // Create student record — `class` and `section` kept for legacy page compatibility
    await query(
      `INSERT INTO students (id, name, admission_number, class, section, parent_name, status, parent_email, email, student_portal_password, profile_photo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (admission_number) DO NOTHING`,
      [studentId, `${app.first_name} ${app.last_name}`, admissionNumber,
       className, sectionName, app.parent_name, 'Active',
       app.parent_email, studentEmail, tempPassword,
       app.profile_photo || null]
    );

    // Create enrollment record (new academic-core system)
    if (classId) {
      try {
        const yearRes = await query('SELECT id FROM academic_years WHERE is_active=true LIMIT 1');
        const yearId = yearRes.rows[0]?.id || '';
        if (yearId) {
          const rollRes = await query('SELECT COALESCE(MAX(roll_number),0)+1 as next FROM enrollments WHERE class_id=$1', [classId]);
          const rollNumber = parseInt(rollRes.rows[0]?.next || '1', 10);
          const { nanoid } = await import('nanoid');
          const enrollId = `enr-${nanoid(8)}`;
          await query(
            `INSERT INTO enrollments (id, student_id, class_id, section_id, academic_year_id, roll_number, status)
             VALUES ($1,$2,$3,$4,$5,$6,'Active')`,
            [enrollId, studentId, classId, sectionId || null, yearId, rollNumber]
          );
        }
      } catch { /* enrollment creation is best-effort */ }
    }

    // Always create the student user account with the generated credentials
    const existingStudent = await prisma.user.findUnique({ where: { email: studentEmail } });
    if (!existingStudent) {
      await prisma.user.create({
        data: {
          name: `${app.first_name} ${app.last_name}`,
          email: studentEmail,
          passwordHash: studentPasswordHash,
          role: 'STUDENT',
        },
      });
    }

    // Create parent user account if a portal password was set during application
    if (app.parent_portal_password_hash) {
      const existingParent = await prisma.user.findUnique({ where: { email: app.parent_email } });
      if (!existingParent) {
        await prisma.user.create({
          data: {
            name: app.parent_name,
            email: app.parent_email,
            passwordHash: app.parent_portal_password_hash,
            role: 'PARENT',
          },
        });
      }
    }

    // Create/update parent record
    const parentId = `p${Date.now()}`;
    const existingParentRec = await query('SELECT id, student_ids FROM parents WHERE email=$1', [app.parent_email]);
    if (existingParentRec.rows.length > 0) {
      const existing = existingParentRec.rows[0];
      const ids: string[] = JSON.parse(existing.student_ids || '[]');
      if (!ids.includes(studentId)) {
        ids.push(studentId);
        await query('UPDATE parents SET student_ids=$1 WHERE id=$2', [JSON.stringify(ids), existing.id]);
      }
    } else {
      await query(
        `INSERT INTO parents (id, name, email, phone, student_ids, status) VALUES ($1,$2,$3,$4,$5,'Active')`,
        [parentId, app.parent_name, app.parent_email, app.parent_phone, JSON.stringify([studentId])]
      );
    }

    // Mark application approved
    await query("UPDATE admission_applications SET status='Approved' WHERE id=$1", [appId]);

    return {
      studentRecord: {
        id: studentId,
        name: `${app.first_name} ${app.last_name}`,
        admissionNumber,
        class: className,
        section: sectionName,
        parentName: app.parent_name,
        status: 'Active',
        email: studentEmail,
        parentEmail: app.parent_email,
        profilePhoto: app.profile_photo || undefined,
      },
    };
  } catch (err) {
    console.error('approveAdmissionWithAccountsDB error', err);
    return { error: 'Failed to approve admission' };
  }
}

export async function bulkApproveAdmissionsDB(
  appIds: string[],
  classId: string,
  sectionId?: string,
): Promise<{ approved: number; errors: string[] }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return { approved: 0, errors: ['Only admins can approve admissions.'] };
  const approved: string[] = [];
  const errors: string[] = [];

  for (const appId of appIds) {
    const result = await approveAdmissionWithAccountsDB(appId, classId, sectionId);
    if (result.error) {
      errors.push(`${appId}: ${result.error}`);
    } else {
      approved.push(appId);
    }
  }

  return { approved: approved.length, errors };
}
