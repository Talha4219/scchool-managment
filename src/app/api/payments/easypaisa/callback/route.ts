import { NextRequest, NextResponse } from "next/server";
import { verifyEasyPaisaCallback } from "@/lib/payment-gateways";
import { completeOnlinePaymentAction } from "@/app/actions/payments";

// EasyPaisa POSTs the result to postBackURL. Field names for the response
// status vary slightly by merchant integration tier — this checks the two
// most commonly documented success markers ("status"="0000"/"success");
// confirm the exact field against the bank's final integration PDF before
// going live and adjust the `success` check below if needed.
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  try {
    const form = await req.formData();
    const fields: Record<string, string> = {};
    form.forEach((v, k) => { fields[k] = String(v); });

    const verified = verifyEasyPaisaCallback(fields);
    const txnRef = fields.orderRefNum || "";
    const statusField = (fields.status || fields.responseCode || "").toLowerCase();
    const success = verified && (statusField === "0000" || statusField === "success" || statusField === "0");

    if (txnRef) {
      await completeOnlinePaymentAction(txnRef, "easypaisa", success, fields);
    }

    const status = !verified ? "invalid" : success ? "success" : "failed";
    return NextResponse.redirect(`${origin}/fees/payment-result?status=${status}&txnRef=${encodeURIComponent(txnRef)}&gateway=easypaisa`);
  } catch (err) {
    console.error("EasyPaisa callback error:", err);
    return NextResponse.redirect(`${origin}/fees/payment-result?status=error&gateway=easypaisa`);
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.redirect(`${req.nextUrl.origin}/fees/payment-result?status=pending&gateway=easypaisa`);
}
