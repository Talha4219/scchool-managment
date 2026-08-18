"use client";

import { useEffect, useState } from "react";
import { getParentPortalData, type ParentPortalData } from "@/app/actions/features";
import { formatDatePK } from "@/lib/date-format";
import { fetchGatewayAvailabilityAction, initiateFeePaymentAction, type Gateway } from "@/app/actions/payments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CreditCard, CheckCircle2, AlertCircle, Clock, Download, Printer, Loader2, AlertTriangle } from "lucide-react";
import type { FeeRecord } from "@/lib/types";
import { useLanguage } from "@/hooks/use-language";

const STATUS_STYLE: Record<string, string> = {
  Paid:    "bg-green-100 text-green-700",
  Unpaid:  "bg-red-100 text-red-700",
  Overdue: "bg-red-100 text-red-700",
  Partial: "bg-amber-100 text-amber-700",
};

function formatDate(dateStr?: string) {
  return formatDatePK(dateStr);
}

function netDue(f: FeeRecord) {
  return Math.max(0, f.amount - (f.discount || 0) - (f.amountPaid || 0));
}

function openVoucherWindow(f: FeeRecord, schoolName: string) {
  const win = window.open("", "_blank", "width=680,height=900");
  if (!win) return;
  const issueDate = formatDate(f.issueDate || new Date().toISOString().split("T")[0]);
  const dueDate = formatDate(f.dueDate);
  const net = netDue(f);
  const lineItemsHTML = (f.lineItems && f.lineItems.length > 0
    ? f.lineItems
    : [{ description: f.feeType || "Fee", amount: f.amount }]
  ).map(item => `
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid #eee;">${item.description}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:right;">Rs. ${item.amount.toLocaleString()}</td>
    </tr>`).join("");
  const discountRow = (f.discount || 0) > 0
    ? `<tr style="color:#166534;"><td style="padding:9px 12px;border-bottom:1px solid #eee;">Discount</td><td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:right;">- Rs. ${(f.discount || 0).toLocaleString()}</td></tr>`
    : "";
  const statusColor = { Paid: "#166534", Unpaid: "#1d4ed8", Overdue: "#991b1b", Partial: "#92400e" }[f.status] || "#111";
  const statusBg = { Paid: "#dcfce7", Unpaid: "#dbeafe", Overdue: "#fee2e2", Partial: "#fef3c7" }[f.status] || "#f3f4f6";
  const generated = formatDatePK(new Date());

  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Fee Voucher — ${f.voucherId}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; background:#f5f5f5; padding:30px; color:#111; }
  .voucher { background:#fff; max-width:600px; margin:0 auto; border:1px solid #ddd; border-radius:8px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }
  .header { background:#0B1B3D; color:#fff; padding:28px 32px; text-align:center; }
  .school-name { font-size:22px; font-weight:700; letter-spacing:.5px; }
  .voucher-title { margin-top:14px; display:inline-block; border:1.5px solid rgba(255,255,255,.5); padding:5px 22px; font-size:13px; font-weight:700; letter-spacing:3px; border-radius:3px; }
  .voucher-no { font-size:12px; color:rgba(255,255,255,.7); margin-top:8px; }
  .info-section { padding:20px 32px; border-bottom:1px solid #eee; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .info-item { display:flex; flex-direction:column; gap:2px; }
  .info-label { font-size:10px; color:#888; font-weight:600; text-transform:uppercase; letter-spacing:.5px; }
  .info-value { font-size:13px; font-weight:600; color:#111; }
  .breakdown-section { padding:20px 32px; }
  .section-title { font-size:11px; font-weight:700; color:#666; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; }
  .fee-table { width:100%; border-collapse:collapse; border:1px solid #eee; border-radius:6px; overflow:hidden; }
  .fee-table th { background:#f8f9fa; padding:9px 12px; text-align:left; font-size:11px; font-weight:700; color:#555; text-transform:uppercase; letter-spacing:.5px; }
  .fee-table th:last-child { text-align:right; }
  .total-row td { background:#0B1B3D; color:#fff; padding:12px; font-size:14px; font-weight:700; border:none; }
  .total-row td:last-child { text-align:right; }
  .status-section { padding:16px 32px; border-top:1px solid #eee; display:flex; align-items:center; justify-content:space-between; }
  .status-badge { display:inline-block; padding:5px 18px; border-radius:20px; font-size:12px; font-weight:700; letter-spacing:1px; }
  .instructions { padding:16px 32px; background:#fffbeb; border-top:1px solid #fef3c7; }
  .instructions p { font-size:11px; color:#78350f; line-height:1.6; }
  .footer { background:#f8f9fa; padding:12px 32px; border-top:1px solid #eee; display:flex; justify-content:space-between; font-size:10px; color:#999; }
  .print-btn { display:block; margin:20px auto 0; padding:10px 36px; background:#0B1B3D; color:#fff; border:none; border-radius:6px; font-size:13px; cursor:pointer; font-weight:600; }
  @media print { .print-btn { display:none; } body { padding:0; background:#fff; } .voucher { box-shadow:none; border:none; } }
</style></head><body>
<div class="voucher">
  <div class="header">
    <div class="school-name">${schoolName}</div>
    <div class="voucher-title">FEE PAYMENT VOUCHER</div>
    <div class="voucher-no">Voucher No: ${f.voucherId}${f.month ? " &nbsp;·&nbsp; " + f.month : ""}</div>
  </div>
  <div class="info-section">
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Student Name</span>
        <span class="info-value">${f.studentName}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Class / Batch</span>
        <span class="info-value">${f.className || "—"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Issue Date</span>
        <span class="info-value">${issueDate}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Due Date</span>
        <span class="info-value" style="color:#dc2626;">${dueDate}</span>
      </div>
    </div>
  </div>
  <div class="breakdown-section">
    <div class="section-title">Fee Breakdown</div>
    <table class="fee-table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHTML}
        ${discountRow}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td>Total Amount Due</td>
          <td>Rs. ${net.toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div class="status-section">
    <span style="font-size:12px;color:#555;">Payment Status</span>
    <span class="status-badge" style="background:${statusBg};color:${statusColor};">${f.status.toUpperCase()}</span>
  </div>
  <div class="instructions">
    <p><strong>Payment Instructions:</strong><br>
    Pay before the due date to avoid late charges. After payment, submit a copy of this voucher to the accounts office.</p>
    ${f.status === "Paid" && f.paymentMethod ? `<p style="margin-top:6px;color:#166534;"><strong>Payment received via ${f.paymentMethod}</strong>${f.paymentDate ? " on " + formatDate(f.paymentDate) : ""}.</p>` : ""}
  </div>
  <div class="footer">
    <span>${schoolName}</span>
    <span>Generated: ${generated}</span>
  </div>
</div>
<button class="print-btn" onclick="window.print()">&#128424; Print / Save as PDF</button>
</body></html>`);
  win.document.close();
}

export default function ParentFeesPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<ParentPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [gatewayAvailability, setGatewayAvailability] = useState<{ jazzcash: boolean; easypaisa: boolean }>({ jazzcash: false, easypaisa: false });
  const [payVoucher, setPayVoucher] = useState<FeeRecord | null>(null);
  const [payingWith, setPayingWith] = useState<Gateway | null>(null);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    getParentPortalData().then(d => { setData(d); setLoading(false); });
    fetchGatewayAvailabilityAction().then(setGatewayAvailability);
  }, []);

  const handlePayWithGateway = async (gateway: Gateway) => {
    if (!payVoucher) return;
    setPayError("");
    setPayingWith(gateway);
    const res = await initiateFeePaymentAction(payVoucher.id, gateway);
    if (res.error || !res.actionUrl || !res.fields) {
      setPayingWith(null);
      setPayError(res.error || "Failed to start payment.");
      return;
    }
    const form = document.createElement("form");
    form.method = "POST";
    form.action = res.actionUrl;
    Object.entries(res.fields).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  };

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  const fees = data?.feeRecords ?? [];
  const schoolName = "School"; // parent portal doesn't have schoolInfo in context
  const totalDue = fees.filter(f => f.status !== "Paid").reduce((s, f) => s + netDue(f), 0);
  const totalPaid = fees.filter(f => f.status === "Paid").reduce((s, f) => s + f.amount, 0);
  const unpaidCount = fees.filter(f => f.status === "Unpaid" || f.status === "Overdue").length;

  // Latest unpaid voucher for the "current voucher" highlight
  const currentVoucher = fees.find(f => f.status !== "Paid") || fees[0];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">{t("parentFees.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("parentFees.subtitle")}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-red-50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-xl">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">Rs. {totalDue.toLocaleString()}</p>
              <p className="text-xs text-red-500 font-medium">{t("parentFees.totalOutstanding")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-green-50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">Rs. {totalPaid.toLocaleString()}</p>
              <p className="text-xs text-green-500 font-medium">{t("parentFees.totalPaid")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{fees.length}</p>
              <p className="text-xs text-muted-foreground font-medium">Total vouchers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Voucher highlight */}
      {currentVoucher && currentVoucher.status !== "Paid" && (
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">Current Voucher</p>
                <p className="font-mono font-bold text-primary">{currentVoucher.voucherId}</p>
                <p className="text-2xl font-bold text-primary mt-1">Rs. {netDue(currentVoucher).toLocaleString()}</p>
                <p className="text-xs text-red-600 font-medium mt-0.5">Due: {formatDate(currentVoucher.dueDate)}</p>
              </div>
              <div className="flex gap-2">
                <Badge className={`${STATUS_STYLE[currentVoucher.status] ?? ""} border-none h-7`}>
                  {currentVoucher.status}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-primary border-primary hover:bg-primary/5"
                  onClick={() => openVoucherWindow(currentVoucher, schoolName)}
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-primary hover:bg-primary/90"
                  onClick={() => { setPayError(""); setPayingWith(null); setPayVoucher(currentVoucher); }}
                >
                  <CreditCard className="h-3.5 w-3.5" /> Pay Online
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fee Table */}
      <Card className="border-none shadow-sm">
        <CardHeader className="border-b border-secondary/50">
          <CardTitle className="text-base font-bold text-primary flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Fee History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {fees.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No fee records found.</div>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/20">
                <TableRow>
                  <TableHead className="font-bold">Voucher</TableHead>
                  <TableHead className="font-bold">Type</TableHead>
                  <TableHead className="font-bold">Month</TableHead>
                  <TableHead className="font-bold">Amount</TableHead>
                  <TableHead className="font-bold">Due Date</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                  <TableHead className="font-bold text-center">Voucher</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fees.map(f => (
                  <TableRow key={f.id} className="hover:bg-secondary/10">
                    <TableCell className="font-mono text-xs font-bold text-primary">{f.voucherId}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.feeType ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.month ?? "—"}</TableCell>
                    <TableCell className="font-semibold">Rs. {netDue(f).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(f.dueDate)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`${STATUS_STYLE[f.status] ?? "bg-gray-100 text-gray-700"} border-none`}>
                        {f.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {f.status !== "Paid" && (
                          <Button
                            size="sm"
                            className="h-7 gap-1 text-xs bg-primary hover:bg-primary/90"
                            onClick={() => { setPayError(""); setPayingWith(null); setPayVoucher(f); }}
                          >
                            <CreditCard className="h-3 w-3" /> Pay
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-primary hover:bg-primary/5"
                          onClick={() => openVoucherWindow(f, schoolName)}
                          title="View / Print Voucher"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-primary hover:bg-primary/5"
                          onClick={() => openVoucherWindow(f, schoolName)}
                          title="Download Voucher"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pay Online Dialog */}
      <Dialog open={!!payVoucher} onOpenChange={o => !o && setPayVoucher(null)}>
        <DialogContent className="max-w-md">
          {payVoucher && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Pay Online</DialogTitle>
                <DialogDescription>{payVoucher.voucherId} · {payVoucher.studentName}</DialogDescription>
              </DialogHeader>
              {payingWith ? (
                <div className="py-10 flex flex-col items-center gap-3 text-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm font-semibold text-primary">Redirecting to {payingWith === "jazzcash" ? "JazzCash" : "EasyPaisa"}...</p>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="p-4 bg-secondary/30 rounded-lg text-sm border font-medium text-primary flex justify-between">
                    <span className="text-muted-foreground">Amount Due</span>
                    <span className="font-bold text-accent">Rs. {netDue(payVoucher).toLocaleString()}</span>
                  </div>
                  {payError && (
                    <div role="alert" className="flex items-start gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {payError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={!gatewayAvailability.jazzcash}
                      onClick={() => handlePayWithGateway("jazzcash")}
                      className="w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="h-9 w-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0"><CreditCard className="h-4 w-4 text-red-600" /></div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">JazzCash</p>
                        <p className="text-[11px] text-muted-foreground">{gatewayAvailability.jazzcash ? "Mobile wallet or card" : "Not set up by the school yet"}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={!gatewayAvailability.easypaisa}
                      onClick={() => handlePayWithGateway("easypaisa")}
                      className="w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0"><CreditCard className="h-4 w-4 text-green-600" /></div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">EasyPaisa</p>
                        <p className="text-[11px] text-muted-foreground">{gatewayAvailability.easypaisa ? "Mobile wallet or card" : "Not set up by the school yet"}</p>
                      </div>
                    </button>
                    {!gatewayAvailability.jazzcash && !gatewayAvailability.easypaisa && (
                      <p className="text-[11px] text-muted-foreground pt-1">Online payment isn't available yet — please pay at the school office in the meantime.</p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setPayVoucher(null)}>Cancel</Button>
                  </DialogFooter>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
