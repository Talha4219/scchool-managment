import { NextRequest, NextResponse } from "next/server";
import { verifyOneLinkCallback } from "@/lib/payment-gateways";
import { completeOnlinePaymentAction } from "@/app/actions/payments";

// PLACEHOLDER — field names (ol_TxnRefNo, ol_ResponseCode, "000" = success)
// mirror the JazzCash contract and are NOT confirmed against a real 1LINK
// OneLink integration guide. Update once merchant docs are available; see
// the comment block above the OneLink section in src/lib/payment-gateways.ts.
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  try {
    const form = await req.formData();
    const fields: Record<string, string> = {};
    form.forEach((v, k) => { fields[k] = String(v); });

    const verified = verifyOneLinkCallback(fields);
    const txnRef = fields.ol_TxnRefNo || "";
    const success = verified && fields.ol_ResponseCode === "000";

    if (txnRef) {
      await completeOnlinePaymentAction(txnRef, "onelink", success, fields);
    }

    const status = !verified ? "invalid" : success ? "success" : "failed";
    return NextResponse.redirect(`${origin}/fees/payment-result?status=${status}&txnRef=${encodeURIComponent(txnRef)}&gateway=onelink`);
  } catch (err) {
    console.error("OneLink callback error:", err);
    return NextResponse.redirect(`${origin}/fees/payment-result?status=error&gateway=onelink`);
  }
}

// Some gateway sandboxes verify the return URL with a GET first.
export async function GET(req: NextRequest) {
  return NextResponse.redirect(`${req.nextUrl.origin}/fees/payment-result?status=pending&gateway=onelink`);
}
