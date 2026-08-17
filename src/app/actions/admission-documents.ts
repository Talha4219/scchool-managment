"use server";

// Admission-application document checklist (Birth Certificate, CNIC/B-Form,
// Leaving Certificate, Photograph) — ADMIN-only view/upload/delete, mirroring
// student-documents.ts exactly, just keyed by application_id instead of
// student_id (the applicant isn't a student yet).

import { query, checkDbConnection } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { nanoid } from "nanoid";
import { requireRole } from "@/lib/auth-scope";

export interface AdmissionDocumentRecord {
  id: string; applicationId: string; documentType: string;
  fileName: string | null; fileData: string; uploadedAt: string; uploadedBy: string | null;
}

function mapRow(r: any): AdmissionDocumentRecord {
  return {
    id: r.id, applicationId: r.application_id, documentType: r.document_type,
    fileName: r.file_name, fileData: r.file_data, uploadedAt: r.uploaded_at, uploadedBy: r.uploaded_by,
  };
}

export async function fetchAdmissionDocumentsDB(applicationId: string): Promise<AdmissionDocumentRecord[]> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return [];
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query(`SELECT * FROM admission_documents WHERE application_id=$1 ORDER BY document_type`, [applicationId]);
    return res.rows.map(mapRow);
  } catch { return []; }
}

export async function uploadAdmissionDocumentDB(
  applicationId: string, documentType: string, fileName: string, fileData: string
): Promise<{ success: boolean; message?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { success: false, message: auth.error };
  try {
    const existing = await query(`SELECT id FROM admission_documents WHERE application_id=$1 AND document_type=$2`, [applicationId, documentType]);
    if (existing.rows.length > 0) {
      await query(
        `UPDATE admission_documents SET file_name=$1, file_data=$2, uploaded_at=NOW(), uploaded_by=$3 WHERE id=$4`,
        [fileName, fileData, auth.session.name, existing.rows[0].id]
      );
    } else {
      await query(
        `INSERT INTO admission_documents (id, application_id, document_type, file_name, file_data, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6)`,
        [`adoc-${nanoid(10)}`, applicationId, documentType, fileName, fileData, auth.session.name]
      );
    }
    await logAudit({
      actor: { userId: auth.session.userId, name: auth.session.name, role: auth.session.role },
      action: 'UPDATE', entityType: 'admission_document', entityId: applicationId, summary: `Uploaded ${documentType} for admission application`,
    });
    return { success: true };
  } catch (e: any) { return { success: false, message: e.message || 'Failed to upload document.' }; }
}

export async function deleteAdmissionDocumentDB(id: string): Promise<{ success: boolean; message?: string }> {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return { success: false, message: auth.error };
  try {
    await query(`DELETE FROM admission_documents WHERE id=$1`, [id]);
    await logAudit({
      actor: { userId: auth.session.userId, name: auth.session.name, role: auth.session.role },
      action: 'DELETE', entityType: 'admission_document', entityId: id, summary: `Deleted an admission document`,
    });
    return { success: true };
  } catch (e: any) { return { success: false, message: e.message || 'Failed to delete document.' }; }
}
