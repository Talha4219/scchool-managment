import { NextRequest, NextResponse } from "next/server";
import { verifyJazzCashCallback } from "@/lib/payment-gateways";
import { completeOnlinePaymentAction } from "@/app/actions/payments";

// JazzCash POSTs the transaction result to this URL (pp_ReturnURL) as
// application/x-www-form-urlencoded. pp_ResponseCode "000" means success;
// everything else is a decline/failure. The pp_SecureHash on the callback
// itself is verified before anything is trusted or written to the ledger.
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  try {
    const form = await req.formData();
    const fields: Record<string, string> = {};
    form.forEach((v, k) => { fields[k] = String(v); });

    const verified = verifyJazzCashCallback(fields);
    const txnRef = fields.pp_TxnRefNo || "";
    const success = verified && fields.pp_ResponseCode === "000";

    if (txnRef) {
      await completeOnlinePaymentAction(txnRef, "jazzcash", success, fields);
    }

    const status = !verified ? "invalid" : success ? "success" : "failed";
    return NextResponse.redirect(`${origin}/fees/payment-result?status=${status}&txnRef=${encodeURIComponent(txnRef)}&gateway=jazzcash`);
  } catch (err) {
    console.error("JazzCash callback error:", err);
    return NextResponse.redirect(`${origin}/fees/payment-result?status=error&gateway=jazzcash`);
  }
}

// Some gateway sandboxes verify the return URL with a GET first.
export async function GET(req: NextRequest) {
  return NextResponse.redirect(`${req.nextUrl.origin}/fees/payment-result?status=pending&gateway=jazzcash`);
}
