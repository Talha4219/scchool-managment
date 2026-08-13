"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchOnlinePaymentByTxnRefAction, type OnlinePaymentRecord } from "@/app/actions/payments";

const STATUS_COPY: Record<string, { icon: typeof CheckCircle2; color: string; title: string; body: string }> = {
  success: { icon: CheckCircle2, color: "text-green-600 bg-green-50", title: "Payment successful", body: "Your fee voucher has been marked paid. A receipt notification has been sent to your account." },
  failed: { icon: XCircle, color: "text-red-600 bg-red-50", title: "Payment failed", body: "The gateway declined or cancelled this transaction. No amount was deducted from the voucher. You can try again." },
  invalid: { icon: AlertTriangle, color: "text-amber-600 bg-amber-50", title: "Couldn't verify this payment", body: "The response from the payment gateway couldn't be verified. If you were charged, contact the school office with your transaction reference." },
  pending: { icon: Loader2, color: "text-blue-600 bg-blue-50", title: "Payment pending", body: "We haven't received a final result from the gateway yet. Refresh in a moment, or check Fees for the current status." },
  error: { icon: AlertTriangle, color: "text-red-600 bg-red-50", title: "Something went wrong", body: "We couldn't process the payment result. If you were charged, contact the school office with your transaction reference." },
};

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "pending";
  const txnRef = searchParams.get("txnRef") || "";
  const gateway = searchParams.get("gateway") || "";
  const [record, setRecord] = useState<OnlinePaymentRecord | null>(null);

  useEffect(() => {
    if (txnRef) fetchOnlinePaymentByTxnRefAction(txnRef).then(setRecord);
  }, [txnRef]);

  const copy = STATUS_COPY[status] || STATUS_COPY.error;
  const Icon = copy.icon;

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <Card className="max-w-md w-full border-none shadow-lg">
        <CardContent className="p-8 text-center">
          <div className={`h-16 w-16 rounded-full ${copy.color} flex items-center justify-center mx-auto mb-5`}>
            <Icon className={`h-8 w-8 ${status === "pending" ? "animate-spin" : ""}`} />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">{copy.title}</h1>
          <p className="text-sm text-muted-foreground mb-6">{copy.body}</p>

          {(txnRef || gateway) && (
            <div className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3 mb-6 text-left space-y-1">
              {gateway && <div className="flex justify-between"><span>Gateway</span><span className="font-medium capitalize">{gateway}</span></div>}
              {txnRef && <div className="flex justify-between"><span>Reference</span><span className="font-mono">{txnRef}</span></div>}
              {record && <div className="flex justify-between"><span>Amount</span><span className="font-medium">Rs. {record.amount.toLocaleString()}</span></div>}
            </div>
          )}

          <Link href="/fees">
            <Button className="w-full gap-2"><ArrowLeft className="h-4 w-4" /> Back to Fees</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense fallback={null}>
      <PaymentResultContent />
    </Suspense>
  );
}
