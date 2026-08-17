"use server";

// Student document checklist (Birth Certificate, CNIC/B-Form, Leaving
// Certificate, Photograph) — ADMIN-only view/upload/delete, mirroring
// staff-attendance.ts's auth/error conventions (requireRole, try/catch
// swallow-to-empty, nanoid-prefixed IDs, logAudit on mutations).

import { query, checkDbConnection } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { nanoid } from "nanoid";
import { requireRole } from "@/lib/auth-scope";

export interface StudentDocumentRecord {
  id: string; studentId: string; documentType: string;
  fileName: string | null; fileData: string; uploadedAt: string; uploadedBy: string | null;
}

function mapRow(r: any): StudentDocumentRecord {
  return {
    id: r.id, studentId: r.student_id, documentType: r.document_type,
    fileName: r.file_name, fileData: r.file_data, uploadedAt: r.uploaded_at, uploadedBy: r.uploaded_by,
  };
}

export async function fetchStudentDocumentsDB(studentId: string): Promise<StudentDocumentRecord[]> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query(`SELECT * FROM student_documents WHERE student_id=$1 ORDER BY document_type`, [studentId]);
    return res.rows.map(mapRow);
  } catch { return []; }
}

export async function uploadStudentDocumentDB(
  studentId: string, documentType: string, fileName: string, fileData: string
): Promise<{ success: boolean; message?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { success: false, message: auth.error };
  try {
    const existing = await query(`SELECT id FROM student_documents WHERE student_id=$1 AND document_type=$2`, [studentId, documentType]);
    if (existing.rows.length > 0) {
      await query(
        `UPDATE student_documents SET file_name=$1, file_data=$2, uploaded_at=NOW(), uploaded_by=$3 WHERE id=$4`,
        [fileName, fileData, auth.session.name, existing.rows[0].id]
      );
    } else {
      await query(
        `INSERT INTO student_documents (id, student_id, document_type, file_name, file_data, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6)`,
        [`sdoc-${nanoid(10)}`, studentId, documentType, fileName, fileData, auth.session.name]
      );
    }
    await logAudit({
      actor: { userId: auth.session.userId, name: auth.session.name, role: auth.session.role },
      action: 'UPDATE', entityType: 'student_document', entityId: studentId, summary: `Uploaded ${documentType} for student`,
    });
    return { success: true };
  } catch (e: any) { return { success: false, message: e.message || 'Failed to upload document.' }; }
}

export async function deleteStudentDocumentDB(id: string): Promise<{ success: boolean; message?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { success: false, message: auth.error };
  try {
    await query(`DELETE FROM student_documents WHERE id=$1`, [id]);
    await logAudit({
      actor: { userId: auth.session.userId, name: auth.session.name, role: auth.session.role },
      action: 'DELETE', entityType: 'student_document', entityId: id, summary: `Deleted a student document`,
    });
    return { success: true };
  } catch (e: any) { return { success: false, message: e.message || 'Failed to delete document.' }; }
}
