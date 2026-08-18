import { query } from "@/lib/db";
import { logServerError } from "@/lib/error-log";

// Plain DB-access module (not a "use server" actions file) — shared by the
// send path (src/app/actions/whatsapp-admin.ts, and later the notification
// service) and the webhook route handler, since both need to read/write the
// same whatsapp_notifications / whatsapp_messages rows without going through
// a server-action RPC boundary.

export type NotificationStatus = "QUEUED" | "PROCESSING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "CANCELLED";

export async function createWhatsAppNotification(params: {
  recipientType: "PARENT" | "TEACHER" | "STUDENT" | "ADMIN" | "PRINCIPAL";
  recipientId: string;
  notificationType: string;
  templateId?: string;
  createdByUserId?: number;
}): Promise<string> {
  const id = `wan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await query(
    `INSERT INTO whatsapp_notifications (id, recipient_type, recipient_id, notification_type, template_id, created_by_user_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,'QUEUED')`,
    [id, params.recipientType, params.recipientId, params.notificationType, params.templateId || null, params.createdByUserId || null]
  );
  return id;
}

export async function createWhatsAppMessage(params: {
  notificationId: string;
  phoneNumber: string;
  templateName: string;
  templateLanguage: string;
}): Promise<string> {
  const id = `wam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await query(
    `INSERT INTO whatsapp_messages (id, notification_id, phone_number, template_name, template_language, status)
     VALUES ($1,$2,$3,$4,$5,'QUEUED')`,
    [id, params.notificationId, params.phoneNumber, params.templateName, params.templateLanguage]
  );
  return id;
}

export async function markMessageSent(messageId: string, notificationId: string, metaMessageId: string): Promise<void> {
  await query(`UPDATE whatsapp_messages SET status='SENT', meta_message_id=$1, updated_at=NOW() WHERE id=$2`, [metaMessageId, messageId]);
  await query(`UPDATE whatsapp_notifications SET status='SENT', sent_at=NOW(), updated_at=NOW() WHERE id=$1`, [notificationId]);
}

export async function markMessageFailed(messageId: string, notificationId: string, errorCode: string | undefined, errorMessage: string): Promise<void> {
  await query(`UPDATE whatsapp_messages SET status='FAILED', error_code=$1, error_message=$2, updated_at=NOW() WHERE id=$3`, [errorCode || null, errorMessage, messageId]);
  await query(`UPDATE whatsapp_notifications SET status='FAILED', failed_at=NOW(), error_code=$1, error_message=$2, updated_at=NOW() WHERE id=$3`, [errorCode || null, errorMessage, notificationId]);
}

const META_STATUS_TO_TIMESTAMP_COLUMN: Record<string, string> = {
  sent: "sent_at",
  delivered: "delivered_at",
  read: "read_at",
  failed: "failed_at",
};

/** Called from the webhook when Meta reports a delivery-status change for a
 *  message this app sent. Looks the message up by Meta's own message id
 *  (unique-indexed) — never trusts anything else in the payload as identity. */
export async function updateStatusFromWebhook(
  metaMessageId: string, metaStatus: "sent" | "delivered" | "read" | "failed",
  errorCode?: string, errorMessage?: string
): Promise<{ updated: boolean }> {
  try {
    const msgRes = await query(`SELECT id, notification_id, status FROM whatsapp_messages WHERE meta_message_id=$1`, [metaMessageId]);
    if (msgRes.rows.length === 0) return { updated: false };
    const message = msgRes.rows[0];

    // Statuses only move forward (sent -> delivered -> read); a delayed/out-of-order
    // "sent" webhook arriving after we already recorded "read" must not regress it.
    const order = ["QUEUED", "PROCESSING", "SENT", "DELIVERED", "READ"];
    const newStatus = metaStatus.toUpperCase();
    if (metaStatus !== "failed" && order.indexOf(newStatus) <= order.indexOf(message.status)) {
      return { updated: false };
    }

    const column = META_STATUS_TO_TIMESTAMP_COLUMN[metaStatus];
    await query(
      `UPDATE whatsapp_messages SET status=$1, error_code=$2, error_message=$3, updated_at=NOW() WHERE id=$4`,
      [newStatus, errorCode || null, errorMessage || null, message.id]
    );
    await query(
      `UPDATE whatsapp_notifications SET status=$1, ${column}=NOW(), error_code=$2, error_message=$3, updated_at=NOW() WHERE id=$4`,
      [newStatus, errorCode || null, errorMessage || null, message.notification_id]
    );
    return { updated: true };
  } catch (err) {
    logServerError("whatsapp-webhook", "updateStatusFromWebhook error:", err);
    return { updated: false };
  }
}

export interface WhatsAppNotificationRecord {
  id: string;
  recipientType: string;
  recipientId: string;
  notificationType: string;
  status: NotificationStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  phoneNumber: string | null;
  templateName: string | null;
  metaMessageId: string | null;
}

export async function fetchRecentWhatsAppNotifications(limit = 20): Promise<WhatsAppNotificationRecord[]> {
  const res = await query(
    `SELECT n.*, m.phone_number, m.template_name, m.meta_message_id
     FROM whatsapp_notifications n
     LEFT JOIN whatsapp_messages m ON m.notification_id = n.id
     ORDER BY n.created_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows.map(r => ({
    id: r.id, recipientType: r.recipient_type, recipientId: r.recipient_id, notificationType: r.notification_type,
    status: r.status, scheduledAt: r.scheduled_at, sentAt: r.sent_at, deliveredAt: r.delivered_at, readAt: r.read_at,
    failedAt: r.failed_at, errorCode: r.error_code, errorMessage: r.error_message, createdAt: r.created_at,
    phoneNumber: r.phone_number, templateName: r.template_name, metaMessageId: r.meta_message_id,
  }));
}
