import { getWhatsAppConfig, isWhatsAppConfigured } from "./config";
import { logServerError } from "@/lib/error-log";
import type { NotificationProvider, TemplateMessageInput, SendResult, MessageStatus } from "./types";

const REQUEST_TIMEOUT_MS = 10000;

/** Last-4-digits-only, for logging — never log a full phone number or the access token. */
function redactPhone(phone: string): string {
  return phone.length > 4 ? `***${phone.slice(-4)}` : "***";
}

/** Official Meta WhatsApp Cloud API client. No WhatsApp Web automation, no
 *  unofficial libraries — a plain authenticated HTTPS call to Meta's Graph
 *  API, same integration shape as the JazzCash/EasyPaisa gateway clients
 *  already in this codebase (src/lib/payment-gateways.ts): real, spec-accurate,
 *  and inert (isWhatsAppConfigured() === false) until credentials are set. */
export class WhatsAppProvider implements NotificationProvider {
  async sendTemplateMessage(input: TemplateMessageInput): Promise<SendResult> {
    if (!isWhatsAppConfigured()) {
      return { error: "WhatsApp Cloud API is not configured for this school yet." };
    }
    const config = getWhatsAppConfig();
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

    const body = {
      messaging_product: "whatsapp",
      to: input.to.replace(/^\+/, ""), // Meta expects the number without the leading +
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        ...(input.components ? { components: input.components } : {}),
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        const errorMessage = data?.error?.message || `WhatsApp API request failed (${res.status})`;
        const errorCode = data?.error?.code ? String(data.error.code) : undefined;
        logServerError("whatsapp", `sendTemplateMessage failed to=${redactPhone(input.to)} template=${input.templateName}:`, errorMessage);
        return { error: errorMessage, errorCode };
      }

      const metaMessageId: string | undefined = data.messages?.[0]?.id;
      console.log(`[whatsapp] sendTemplateMessage to=${redactPhone(input.to)} template=${input.templateName} result=ok id=${metaMessageId}`);
      return { metaMessageId };
    } catch (err) {
      clearTimeout(timeout);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const message = isAbort ? "WhatsApp API request timed out." : err instanceof Error ? err.message : "Failed to reach WhatsApp API.";
      logServerError("whatsapp", `sendTemplateMessage error to=${redactPhone(input.to)} template=${input.templateName}:`, message);
      return { error: message };
    }
  }

  /** Real status arrives via the delivery-status webhook (Phase 2), not polling.
   *  This satisfies the NotificationProvider interface now so callers can be
   *  written against it before the webhook exists. */
  async getMessageStatus(_messageId: string): Promise<MessageStatus> {
    return { status: "sent" };
  }
}

export const whatsAppProvider = new WhatsAppProvider();
