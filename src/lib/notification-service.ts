import { query } from "@/lib/db";
import { normalizeToE164 } from "@/lib/whatsapp/phone";
import { createWhatsAppNotification, createWhatsAppMessage } from "@/lib/whatsapp/notification-store";
import { enqueueJob } from "@/lib/whatsapp/queue";

// The seam business modules call through — attendance/fees/exams/PTM never
// touch WhatsAppProvider or Meta's API directly (see academic-core.ts /
// payments.ts, which this replaces in Phase 4). Keeping this channel-agnostic
// in shape (channel: "WHATSAPP" today) means an EmailProvider/SmsProvider can
// be added later without callers changing.

export type NotificationType =
  | "STUDENT_ABSENCE" | "FEE_REMINDER" | "FEE_OVERDUE" | "EXAM_REMINDER"
  | "PTM_REMINDER" | "SCHOOL_ANNOUNCEMENT" | "TEACHER_MEETING" | "EVENT_REMINDER" | "TEST_MESSAGE";

export interface SendNotificationInput {
  type: NotificationType;
  recipientType: "PARENT" | "TEACHER";
  /** studentId for PARENT (their contact lives on the student record), teacher user id for TEACHER. */
  recipientId: string;
  channel: "WHATSAPP";
  data: Record<string, string>;
  createdByUserId?: number;
  /** Future send time. Omit to queue for immediate processing (still async —
   *  see the note on send() below, this is never a synchronous Meta call). */
  scheduledAt?: Date;
}

export interface SendNotificationResult {
  error?: string;
  notificationId?: string;
  /** Set once the queue worker actually sends it — never present immediately
   *  from send() itself now that sends are queued, not synchronous. */
  metaMessageId?: string;
}

async function resolveRecipient(recipientType: "PARENT" | "TEACHER", recipientId: string): Promise<
  { error: string } | { phone: string | null; optedIn: boolean }
> {
  if (recipientType === "PARENT") {
    const res = await query(`SELECT parent_phone, whatsapp_opt_in FROM students WHERE id=$1`, [recipientId]);
    if (res.rows.length === 0) return { error: "Student not found." };
    return { phone: res.rows[0].parent_phone, optedIn: res.rows[0].whatsapp_opt_in === true };
  }
  const res = await query(`SELECT phone, whatsapp_opt_in FROM teacher_profiles WHERE user_id=$1`, [recipientId]);
  if (res.rows.length === 0) return { error: "Teacher profile not found." };
  return { phone: res.rows[0].phone, optedIn: res.rows[0].whatsapp_opt_in === true };
}

async function resolveApprovedTemplate(type: NotificationType): Promise<
  { error: string } | { id: string; metaTemplateName: string; language: string; variables: string[] }
> {
  const res = await query(`SELECT id, meta_template_name, language, status, variables FROM whatsapp_templates WHERE name=$1`, [type]);
  if (res.rows.length === 0) return { error: `No template configured for ${type}.` };
  const t = res.rows[0];
  if (t.status !== "APPROVED") {
    return { error: `Template "${type}" is not approved yet (status: ${t.status}) — not sending an unapproved business-initiated message.` };
  }
  const variables: string[] = typeof t.variables === "string" ? JSON.parse(t.variables) : (t.variables || []);
  return { id: t.id, metaTemplateName: t.meta_template_name, language: t.language, variables };
}

export const notificationService = {
  /** Never throws. Never calls Meta synchronously — every valid send is
   *  queued (notification_jobs) and picked up by the queue worker
   *  (processQueueBatch, run via cron or the admin "Process Queue Now"
   *  button), per the "don't send large batches synchronously from a
   *  request handler" requirement. A whatsapp_notifications row is always
   *  written, even for a send that's blocked before queuing (opt-out / no
   *  approved template are common, expected outcomes, not bugs). */
  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    const template = await resolveApprovedTemplate(input.type);
    if ("error" in template) {
      const notificationId = await createWhatsAppNotification({
        recipientType: input.recipientType, recipientId: input.recipientId, notificationType: input.type,
        createdByUserId: input.createdByUserId,
      });
      await query(`UPDATE whatsapp_notifications SET status='CANCELLED', error_message=$1, updated_at=NOW() WHERE id=$2`, [template.error, notificationId]);
      return { error: template.error, notificationId };
    }

    const recipient = await resolveRecipient(input.recipientType, input.recipientId);
    if ("error" in recipient) return { error: recipient.error };

    const notificationId = await createWhatsAppNotification({
      recipientType: input.recipientType, recipientId: input.recipientId, notificationType: input.type,
      templateId: template.id, createdByUserId: input.createdByUserId,
    });

    if (!recipient.optedIn) {
      const msg = "Recipient has not opted in to WhatsApp notifications.";
      await query(`UPDATE whatsapp_notifications SET status='CANCELLED', error_message=$1, updated_at=NOW() WHERE id=$2`, [msg, notificationId]);
      return { error: msg, notificationId };
    }

    const normalizedPhone = normalizeToE164(recipient.phone);
    if (!normalizedPhone) {
      const msg = "No valid phone number on file for this recipient.";
      await query(`UPDATE whatsapp_notifications SET status='FAILED', failed_at=NOW(), error_message=$1, updated_at=NOW() WHERE id=$2`, [msg, notificationId]);
      return { error: msg, notificationId };
    }

    const messageId = await createWhatsAppMessage({
      notificationId, phoneNumber: normalizedPhone, templateName: template.metaTemplateName, templateLanguage: template.language,
    });

    const components = template.variables.length > 0
      ? [{ type: "body" as const, parameters: template.variables.map(v => ({ type: "text" as const, text: input.data[v] ?? "" })) }]
      : undefined;

    await enqueueJob({
      notificationId, messageId, phoneNumber: normalizedPhone,
      templateName: template.metaTemplateName, templateLanguage: template.language,
      components, scheduledAt: input.scheduledAt,
    });
    await query(
      `UPDATE whatsapp_notifications SET status='QUEUED', scheduled_at=$1, updated_at=NOW() WHERE id=$2`,
      [input.scheduledAt || null, notificationId]
    );

    return { notificationId };
  },
};
