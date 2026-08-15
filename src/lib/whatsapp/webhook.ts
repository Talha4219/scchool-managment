import { createHmac, timingSafeEqual } from "crypto";

/** Verifies Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw request
 *  body, keyed with the App Secret) so the webhook never trusts a payload that
 *  didn't genuinely come from Meta. Returns true if WHATSAPP_APP_SECRET isn't
 *  set — that's a deliberately loud "unverified" state for local dev before
 *  the secret is configured, never acceptable in production (see the .env
 *  comment next to WHATSAPP_APP_SECRET). */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

// Meta's webhook payload shape for WhatsApp Business Account events (statuses
// + incoming messages). Only the fields this app reads are typed — the real
// payload has more we don't need yet.
export interface WhatsAppWebhookPayload {
  entry?: {
    changes?: {
      value?: {
        statuses?: {
          id: string; // Meta message id
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
          errors?: { code: number; title: string }[];
        }[];
        messages?: {
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }[];
      };
    }[];
  }[];
}
