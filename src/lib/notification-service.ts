import { query } from "@/lib/db";
import { normalizeToE164 } from "@/lib/whatsapp/phone";
import { createWhatsAppNotification, createWhatsAppMessage, markMessageSent, markMessageFailed } from "@/lib/whatsapp/notification-store";
import { enqueueJob } from "@/lib/whatsapp/queue";
import { whatsAppProvider } from "@/lib/whatsapp/client";

// The seam business modules call through — attendance/fees/exams/PTM never
// touch WhatsAppProvider or Meta's API directly (see academic-core.ts /
// payments.ts, which this replaces in Phase 4). Keeping this channel-agnostic
// in shape (channel: "WHATSAPP" today) means an EmailProvider/SmsProvider can
// be added later without callers changing.

export type NotificationType =
  | "STUDENT_ABSENCE" | "FEE_REMINDER" | "FEE_OVERDUE" | "EXAM_REMINDER"
  | "PTM_REMINDER" | "SCHOOL_ANNOUNCEMENT" | "TEACHER_MEETING" | "EVENT_REMINDER" | "TEST_MESSAGE"
  | "SUBSTITUTION_APPROVAL";

export interface SendNotificationInput {
  type: NotificationType;
  recipientType: "PARENT" | "TEACHER" | "PRINCIPAL";
  /** studentId for PARENT (their contact lives on the student record), user id (as a string) for TEACHER/PRINCIPAL. */
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

// WhatsApp notifications are mandatory for every recipient — no opt-out.
// This only resolves a phone number now; whatsapp_opt_in columns still exist
// in the DB (harmless) but are no longer read or enforced here.
async function resolveRecipient(recipientType: "PARENT" | "TEACHER" | "PRINCIPAL", recipientId: string): Promise<
  { error: string } | { phone: string | null }
> {
  if (recipientType === "PARENT") {
    const res = await query(`SELECT parent_phone FROM students WHERE id=$1`, [recipientId]);
    if (res.rows.length === 0) return { error: "Student not found." };
    return { phone: res.rows[0].parent_phone };
  }
  if (recipientType === "PRINCIPAL") {
    // Principals don't have a teacher_profiles row — contact lives directly
    // on users (see also ADMIN/OWNER, which could reuse this same path).
    const res = await query(`SELECT phone FROM users WHERE id=$1`, [recipientId]);
    if (res.rows.length === 0) return { error: "Principal not found." };
    return { phone: res.rows[0].phone };
  }
  const res = await query(`SELECT phone FROM teacher_profiles WHERE user_id=$1`, [recipientId]);
  if (res.rows.length === 0) return { error: "Teacher profile not found." };
  return { phone: res.rows[0].phone };
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

  /** Free-form text — no Meta template, no approval wait, sent synchronously
   *  (not queued, unlike send() above) since it's a single message, not a
   *  batch. Only deliverable within Meta's 24h customer-service window; a
   *  recipient who hasn't messaged the business number recently will get a
   *  rejection from Meta, surfaced here as {error}. Use send() with an
   *  approved template for anything that needs to reach someone outside
   *  that window. */
  async sendFreeText(input: { type: NotificationType; recipientType: "PARENT" | "TEACHER" | "PRINCIPAL"; recipientId: string; message: string; createdByUserId?: number }): Promise<SendNotificationResult> {
    const recipient = await resolveRecipient(input.recipientType, input.recipientId);
    if ("error" in recipient) return { error: recipient.error };

    const notificationId = await createWhatsAppNotification({
      recipientType: input.recipientType, recipientId: input.recipientId, notificationType: input.type,
      createdByUserId: input.createdByUserId,
    });

    const normalizedPhone = normalizeToE164(recipient.phone);
    if (!normalizedPhone) {
      const msg = "No valid phone number on file for this recipient.";
      await query(`UPDATE whatsapp_notifications SET status='FAILED', failed_at=NOW(), error_message=$1, updated_at=NOW() WHERE id=$2`, [msg, notificationId]);
      return { error: msg, notificationId };
    }

    const messageId = await createWhatsAppMessage({
      notificationId, phoneNumber: normalizedPhone, templateName: "(free text)", templateLanguage: "n/a",
    });

    const result = await whatsAppProvider.sendTextMessage(normalizedPhone, input.message);
    if (result.error) {
      await markMessageFailed(messageId, notificationId, result.errorCode, result.error);
      return { error: result.error, notificationId };
    }
    await markMessageSent(messageId, notificationId, result.metaMessageId!);
    return { notificationId, metaMessageId: result.metaMessageId };
  },

  /** Try free text first (instant, no template needed); if that fails —
   *  most commonly because the recipient's 24h conversation window with the
   *  business number is closed — fall back to the approved Meta template for
   *  this NotificationType (see send() above). The two message bodies differ
   *  because they're different delivery mechanisms: free text is one
   *  arbitrary string, a template fills fixed {{n}} placeholders from
   *  templateData. Requires a whatsapp_templates row with this type
   *  APPROVED, or the fallback itself fails the same way send() normally
   *  does (see resolveApprovedTemplate). */
  async sendFreeTextWithTemplateFallback(input: {
    type: NotificationType;
    recipientType: "PARENT" | "TEACHER" | "PRINCIPAL";
    recipientId: string;
    message: string;
    templateData: Record<string, string>;
    createdByUserId?: number;
  }): Promise<SendNotificationResult & { usedTemplate?: boolean }> {
    const freeTextResult = await this.sendFreeText({
      type: input.type, recipientType: input.recipientType, recipientId: input.recipientId,
      message: input.message, createdByUserId: input.createdByUserId,
    });
    if (!freeTextResult.error) return { ...freeTextResult, usedTemplate: false };

    const templateResult = await this.send({
      type: input.type, recipientType: input.recipientType, recipientId: input.recipientId,
      channel: "WHATSAPP", data: input.templateData, createdByUserId: input.createdByUserId,
    });
    return { ...templateResult, usedTemplate: true };
  },
};
