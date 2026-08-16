"use server";

import { getSession } from "./auth";
import { query } from "@/lib/db";
import { whatsAppProvider } from "@/lib/whatsapp/client";
import { normalizeToE164 } from "@/lib/whatsapp/phone";
import { isWhatsAppConfigured } from "@/lib/whatsapp/config";
import type { SendResult } from "@/lib/whatsapp/types";
import {
  createWhatsAppNotification, createWhatsAppMessage, markMessageSent, markMessageFailed,
  fetchRecentWhatsAppNotifications, type WhatsAppNotificationRecord,
} from "@/lib/whatsapp/notification-store";

export async function fetchWhatsAppStatusAction(): Promise<{ configured: boolean }> {
  return { configured: isWhatsAppConfigured() };
}

// Admin test-send: proves the Meta Cloud API path end-to-end, and — as of
// Phase 2 — persists a whatsapp_notifications/whatsapp_messages row so the
// webhook has something real to update. recipientType "ADMIN" / recipientId
// = the admin's own session id, since a test send isn't tied to a real
// parent/teacher/student record.
// variablesCsv: comma-separated values for the template's {{1}}, {{2}}, ...
// body placeholders, e.g. "Mr. Khan, Ali Khan, 16 Aug 2026" for a 3-variable
// template. Templates with variables fail with Meta error 131008 ("Required
// parameter is missing") if sent with no components at all, which is exactly
// what this test tool did before — it only worked for zero-variable templates
// like hello_world.
export async function sendWhatsAppTestMessageAction(to: string, templateName: string, variablesCsv?: string): Promise<SendResult> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "Only admins can send WhatsApp test messages." };

  const normalized = normalizeToE164(to);
  if (!normalized) return { error: "Enter a valid phone number, e.g. 03001234567 or +923001234567." };
  const trimmedTemplate = templateName.trim();
  if (!trimmedTemplate) return { error: "Template name is required." };

  // The template's real approved language on Meta can differ from our
  // default (e.g. plain "en" vs "en_US") — use the catalog's value when this
  // template is one of ours, matching the language notificationService.send()
  // would actually use, instead of always hardcoding en_US.
  const catalogRes = await query(`SELECT language FROM whatsapp_templates WHERE meta_template_name=$1`, [trimmedTemplate]);
  const languageCode = catalogRes.rows[0]?.language || "en_US";

  const variables = (variablesCsv || "").split(",").map(v => v.trim()).filter(Boolean);
  const components = variables.length > 0
    ? [{ type: "body" as const, parameters: variables.map(text => ({ type: "text" as const, text })) }]
    : undefined;

  const notificationId = await createWhatsAppNotification({
    recipientType: "ADMIN",
    recipientId: String(session.userId),
    notificationType: "TEST_MESSAGE",
    createdByUserId: session.userId,
  });
  const messageId = await createWhatsAppMessage({
    notificationId, phoneNumber: normalized, templateName: trimmedTemplate, templateLanguage: languageCode,
  });

  const result = await whatsAppProvider.sendTemplateMessage({
    to: normalized,
    templateName: trimmedTemplate,
    languageCode,
    components,
  });

  if (result.error) {
    await markMessageFailed(messageId, notificationId, result.errorCode, result.error);
  } else if (result.metaMessageId) {
    await markMessageSent(messageId, notificationId, result.metaMessageId);
  }

  return result;
}

export async function fetchRecentWhatsAppNotificationsAction(): Promise<WhatsAppNotificationRecord[]> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return [];
  return fetchRecentWhatsAppNotifications(10);
}
