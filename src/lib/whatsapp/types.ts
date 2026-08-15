// Provider abstraction — the notification service (Phase 3) calls through
// this interface, never a specific vendor's SDK/API directly. WhatsAppProvider
// is the only implementation today; a future EmailProvider/SmsProvider would
// implement the same shape without the caller changing.

export interface TemplateMessageInput {
  /** E.164 format, e.g. +923001234567 — normalize with normalizeToE164() before calling. */
  to: string;
  /** Meta-approved template name (not arbitrary free text). */
  templateName: string;
  /** e.g. "en_US" */
  languageCode: string;
  components?: { type: "body"; parameters: { type: "text"; text: string }[] }[];
}

export interface SendResult {
  error?: string;
  errorCode?: string;
  metaMessageId?: string;
}

export interface MessageStatus {
  status: "sent" | "delivered" | "read" | "failed";
  errorCode?: string;
}

export interface NotificationProvider {
  sendTemplateMessage(input: TemplateMessageInput): Promise<SendResult>;
  getMessageStatus(messageId: string): Promise<MessageStatus>;
}
