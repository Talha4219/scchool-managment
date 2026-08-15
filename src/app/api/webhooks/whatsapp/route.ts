import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, type WhatsAppWebhookPayload } from "@/lib/whatsapp/webhook";
import { updateStatusFromWebhook } from "@/lib/whatsapp/notification-store";
import { logServerError } from "@/lib/error-log";

// Meta's one-time webhook verification handshake: it GETs this URL with
// hub.mode=subscribe, hub.verify_token=<what you set in the App Dashboard>,
// and hub.challenge=<random string>. Echoing the challenge back confirms
// ownership; anything else (wrong token) must be rejected outright.
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Delivery-status and incoming-message events. Never trusted without a valid
// signature (verifyWebhookSignature) once WHATSAPP_APP_SECRET is configured.
// Always responds 200 quickly — Meta retries with backoff on non-2xx, and a
// slow/failing webhook can get the subscription throttled or disabled.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    logServerError("whatsapp-webhook", "Rejected webhook POST with invalid signature");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const status of change.value?.statuses ?? []) {
          const errorCode = status.errors?.[0]?.code ? String(status.errors[0].code) : undefined;
          const errorMessage = status.errors?.[0]?.title;
          await updateStatusFromWebhook(status.id, status.status, errorCode, errorMessage);
        }
        // Incoming user messages (replies, opt-out keywords like "STOP") land in
        // change.value.messages — Phase 3 wires these into opt-out handling.
        // Not persisted yet; intentionally not silently dropped without a log
        // trail so a future gap is visible, not invisible.
        if ((change.value?.messages?.length ?? 0) > 0) {
          console.log(`[whatsapp-webhook] received ${change.value!.messages!.length} inbound message(s) — opt-out handling lands in Phase 3`);
        }
      }
    }
  } catch (err) {
    logServerError("whatsapp-webhook", "Error processing webhook payload:", err);
    // Still 200 — Meta doesn't need to retry a payload we've already logged;
    // retrying won't fix a parsing/logic error on our side.
  }

  return new NextResponse("OK", { status: 200 });
}
