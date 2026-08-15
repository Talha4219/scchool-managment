"use server";

import { query } from "@/lib/db";
import { getSession } from "./auth";
import { logAudit } from "@/lib/audit";
import { notificationService, type NotificationType } from "@/lib/notification-service";
import type { SendNotificationResult } from "@/lib/notification-service";
import { processQueueBatch, fetchQueueStats, type QueueStats } from "@/lib/whatsapp/queue";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

// ── Templates ────────────────────────────────────────────────────────────────

export interface WhatsAppTemplateRecord {
  id: string; name: string; metaTemplateName: string; language: string; category: string;
  status: string; description: string | null; variables: string[]; updatedAt: string;
}

export async function fetchWhatsAppTemplatesAction(): Promise<WhatsAppTemplateRecord[]> {
  if (!(await requireAdmin())) return [];
  const res = await query(`SELECT * FROM whatsapp_templates ORDER BY name`);
  return res.rows.map(r => ({
    id: r.id, name: r.name, metaTemplateName: r.meta_template_name, language: r.language, category: r.category,
    status: r.status, description: r.description, variables: typeof r.variables === "string" ? JSON.parse(r.variables) : r.variables,
    updatedAt: r.updated_at,
  }));
}

// Admin marks a template APPROVED once it's genuinely been approved in Meta
// Business Manager — this app cannot verify that itself (Meta doesn't expose
// template review status over a simple API call meant for this flow), so the
// admin is asserting reality, same trust boundary as marking any other
// external verification complete.
export async function updateWhatsAppTemplateStatusAction(
  templateId: string, status: "PENDING" | "APPROVED" | "REJECTED" | "DISABLED", metaTemplateName?: string
): Promise<{ error?: string }> {
  const session = await requireAdmin();
  if (!session) return { error: "Only admins can manage WhatsApp templates." };
  await query(
    `UPDATE whatsapp_templates SET status=$1, meta_template_name=COALESCE($2, meta_template_name), updated_at=NOW() WHERE id=$3`,
    [status, metaTemplateName || null, templateId]
  );
  await logAudit({
    actor: { userId: session.userId, name: session.name, role: session.role },
    action: "UPDATE", entityType: "whatsapp_template", entityId: templateId,
    summary: `Set WhatsApp template ${templateId} status to ${status}`,
  });
  return {};
}

// ── Opt-in / opt-out ─────────────────────────────────────────────────────────

// Recorded by an admin on the parent's behalf (consent obtained via an
// admission/consent form, or verbally confirmed) — mirrors how every other
// consent-adjacent field on the student record (portal password, status) is
// already admin-managed in this ERP. Disables notifications without deleting
// the phone number, per spec — whatsapp_opt_in flips to false, parent_phone stays.
export async function setStudentWhatsAppOptInAction(studentId: string, optIn: boolean, phone?: string): Promise<{ error?: string }> {
  const session = await requireAdmin();
  if (!session) return { error: "Only admins can change WhatsApp consent." };
  await query(
    `UPDATE students SET
       whatsapp_opt_in=$1,
       whatsapp_opt_in_at = CASE WHEN $1 THEN NOW() ELSE whatsapp_opt_in_at END,
       whatsapp_opt_out_at = CASE WHEN NOT $1 THEN NOW() ELSE whatsapp_opt_out_at END,
       parent_phone = COALESCE(NULLIF($2, ''), parent_phone)
     WHERE id=$3`,
    [optIn, phone ?? "", studentId]
  );
  return {};
}

export async function setTeacherWhatsAppOptInAction(userId: number, optIn: boolean, phone?: string): Promise<{ error?: string }> {
  const session = await requireAdmin();
  if (!session) return { error: "Only admins can change WhatsApp consent." };
  await query(
    `UPDATE teacher_profiles SET
       whatsapp_opt_in=$1,
       whatsapp_opt_in_at = CASE WHEN $1 THEN NOW() ELSE whatsapp_opt_in_at END,
       whatsapp_opt_out_at = CASE WHEN NOT $1 THEN NOW() ELSE whatsapp_opt_out_at END,
       phone = COALESCE(NULLIF($2, ''), phone)
     WHERE user_id=$3`,
    [optIn, phone ?? "", userId]
  );
  return {};
}

export async function fetchStudentWhatsAppPrefsAction(studentId: string): Promise<{ phone: string | null; optIn: boolean } | null> {
  const session = await getSession();
  if (!session) return null;
  const res = await query(`SELECT parent_phone, whatsapp_opt_in FROM students WHERE id=$1`, [studentId]);
  if (res.rows.length === 0) return null;
  return { phone: res.rows[0].parent_phone, optIn: res.rows[0].whatsapp_opt_in === true };
}

// ── Admin test-send through the real notification service (not the raw
//    client) — proves template resolution + opt-in gate + persistence all
//    work together, not just the Meta API call in isolation (Phase 1/2 already
//    proved that part). ──────────────────────────────────────────────────────
export async function sendTestNotificationAction(
  type: NotificationType, recipientType: "PARENT" | "TEACHER", recipientId: string, data: Record<string, string>
): Promise<SendNotificationResult> {
  const session = await requireAdmin();
  if (!session) return { error: "Only admins can send test notifications." };
  return notificationService.send({ type, recipientType, recipientId, channel: "WHATSAPP", data, createdByUserId: session.userId });
}

// ── Queue ────────────────────────────────────────────────────────────────────

export async function fetchWhatsAppQueueStatsAction(): Promise<QueueStats> {
  if (!(await requireAdmin())) return { pending: 0, processing: 0, completed: 0, failed: 0, deadLetter: 0 };
  return fetchQueueStats();
}

// Manual trigger for the same worker function the cron endpoint calls —
// useful in dev (no cron configured yet) and as a visible "process now"
// escape hatch for an admin who doesn't want to wait for the next tick.
export async function processWhatsAppQueueNowAction(): Promise<{ claimed: number; sent: number; failed: number; retried: number }> {
  if (!(await requireAdmin())) return { claimed: 0, sent: 0, failed: 0, retried: 0 };
  return processQueueBatch(20);
}

// ── Notification History ────────────────────────────────────────────────────

export interface NotificationHistoryEntry {
  id: string;
  recipientType: string;
  recipientId: string;
  recipientName: string | null;
  notificationType: string;
  status: string;
  phoneNumber: string | null;
  templateName: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export async function fetchWhatsAppNotificationHistoryAction(filters?: {
  status?: string; notificationType?: string; limit?: number;
}): Promise<NotificationHistoryEntry[]> {
  if (!(await requireAdmin())) return [];
  const conditions: string[] = [];
  const params: any[] = [];
  if (filters?.status) { params.push(filters.status); conditions.push(`n.status = $${params.length}`); }
  if (filters?.notificationType) { params.push(filters.notificationType); conditions.push(`n.notification_type = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(filters?.limit ?? 100, 300);
  params.push(limit);

  const res = await query(
    `SELECT n.*, m.phone_number, m.template_name,
            CASE WHEN n.recipient_type = 'PARENT' THEN (SELECT name FROM students WHERE id = n.recipient_id)
                 ELSE (SELECT name FROM users WHERE id::text = n.recipient_id) END as recipient_name
     FROM whatsapp_notifications n
     LEFT JOIN whatsapp_messages m ON m.notification_id = n.id
     ${where}
     ORDER BY n.created_at DESC LIMIT $${params.length}`,
    params
  );
  return res.rows.map(r => ({
    id: r.id, recipientType: r.recipient_type, recipientId: r.recipient_id, recipientName: r.recipient_name,
    notificationType: r.notification_type, status: r.status, phoneNumber: r.phone_number, templateName: r.template_name,
    scheduledAt: r.scheduled_at, sentAt: r.sent_at, deliveredAt: r.delivered_at, readAt: r.read_at, failedAt: r.failed_at,
    errorMessage: r.error_message, createdAt: r.created_at,
  }));
}

// ── Send Notification (audience picker) ─────────────────────────────────────

export interface BulkSendResult {
  queued: number;
  skipped: number;
  errors: string[];
}

// Resolves a class+section into its actively-enrolled students' parents, or
// "ALL_TEACHERS", and calls notificationService.send() once per recipient —
// each call is its own audit row and its own queue job, so a partial failure
// (one parent not opted in) never blocks the rest of the batch.
export async function sendBulkNotificationAction(params: {
  type: NotificationType;
  audience: { kind: "CLASS"; classId: string; sectionId?: string } | { kind: "ALL_TEACHERS" } | { kind: "STUDENT"; studentId: string } | { kind: "TEACHER"; userId: number };
  data: Record<string, string>;
  scheduledAt?: string;
}): Promise<BulkSendResult> {
  const session = await requireAdmin();
  if (!session) return { queued: 0, skipped: 0, errors: ["Only admins can send notifications."] };

  const scheduledAt = params.scheduledAt ? new Date(params.scheduledAt) : undefined;
  const result: BulkSendResult = { queued: 0, skipped: 0, errors: [] };

  let recipients: { recipientType: "PARENT" | "TEACHER"; recipientId: string; name: string }[] = [];

  if (params.audience.kind === "STUDENT") {
    const res = await query(`SELECT id, name FROM students WHERE id=$1`, [params.audience.studentId]);
    recipients = res.rows.map(r => ({ recipientType: "PARENT" as const, recipientId: r.id, name: r.name }));
  } else if (params.audience.kind === "TEACHER") {
    const res = await query(`SELECT user_id, (SELECT name FROM users WHERE id = tp.user_id) as name FROM teacher_profiles tp WHERE user_id=$1`, [params.audience.userId]);
    recipients = res.rows.map(r => ({ recipientType: "TEACHER" as const, recipientId: String(r.user_id), name: r.name }));
  } else if (params.audience.kind === "CLASS") {
    const res = await query(
      `SELECT s.id, s.name FROM enrollments e JOIN students s ON s.id = e.student_id
       WHERE e.class_id=$1 AND e.status='Active' ${params.audience.sectionId ? "AND e.section_id=$2" : ""}`,
      params.audience.sectionId ? [params.audience.classId, params.audience.sectionId] : [params.audience.classId]
    );
    recipients = res.rows.map(r => ({ recipientType: "PARENT" as const, recipientId: r.id, name: r.name }));
  } else if (params.audience.kind === "ALL_TEACHERS") {
    const res = await query(`SELECT tp.user_id, u.name FROM teacher_profiles tp JOIN users u ON u.id = tp.user_id`);
    recipients = res.rows.map(r => ({ recipientType: "TEACHER" as const, recipientId: String(r.user_id), name: r.name }));
  }

  if (recipients.length === 0) {
    return { queued: 0, skipped: 0, errors: ["No recipients matched this audience selection."] };
  }

  for (const r of recipients) {
    const sendResult = await notificationService.send({
      type: params.type, recipientType: r.recipientType, recipientId: r.recipientId, channel: "WHATSAPP",
      data: params.data, createdByUserId: session.userId, scheduledAt,
    });
    if (sendResult.error) {
      result.skipped++;
      result.errors.push(`${r.name}: ${sendResult.error}`);
    } else {
      result.queued++;
    }
  }

  return result;
}
