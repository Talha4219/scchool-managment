"use server";

import { getSession } from "./auth";
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
export async function sendWhatsAppTestMessageAction(to: string, templateName: string): Promise<SendResult> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "Only admins can send WhatsApp test messages." };

  const normalized = normalizeToE164(to);
  if (!normalized) return { error: "Enter a valid phone number, e.g. 03001234567 or +923001234567." };
  if (!templateName.trim()) return { error: "Template name is required." };

  const notificationId = await createWhatsAppNotification({
    recipientType: "ADMIN",
    recipientId: String(session.userId),
    notificationType: "TEST_MESSAGE",
    createdByUserId: session.userId,
  });
  const messageId = await createWhatsAppMessage({
    notificationId, phoneNumber: normalized, templateName: templateName.trim(), templateLanguage: "en_US",
  });

  const result = await whatsAppProvider.sendTemplateMessage({
    to: normalized,
    templateName: templateName.trim(),
    languageCode: "en_US",
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
