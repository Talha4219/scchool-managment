"use client";

import { useState, useMemo, useEffect } from "react";
import { useAppState } from "@/lib/state-context";
import { formatDatePK } from "@/lib/date-format";
import { useStudents } from "@/lib/students-context";
import { getSession } from "@/app/actions/auth";
import { fetchEnrollmentsDB } from "@/app/actions/academic-core";
import { useActiveAcademicYearId, useClasses, useSections } from "@/hooks/use-academic-data";
import { fetchFeePaymentHistoryDB, type FeePaymentHistoryEntry } from "@/app/actions/db";
import { fetchGatewayAvailabilityAction, initiateFeePaymentAction, isFeeReminderChannelConfigured, sendFeeReminderAction, sendOverdueFeeRemindersAction, type Gateway } from "@/app/actions/payments";
import { exportToCsv } from "@/lib/export-csv";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CreditCard, Plus, FileText, Download, CheckCircle, Clock, Calendar,
  DollarSign, Building, Loader2, CheckCircle2, AlertTriangle, Bell,
  Tag, Percent, Users, Filter, X, BarChart3, Printer, Eye, RefreshCw,
  Receipt, Pencil, Trash2, Layers, ToggleLeft, ToggleRight, User,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import type { FeeRecord, FeeStructure, VoucherLineItem } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  Paid:    "bg-green-50 text-green-700 border-green-200",
  Unpaid:  "bg-blue-50 text-blue-700 border-blue-200",
  Overdue: "bg-red-50 text-red-700 border-red-200",
  Partial: "bg-amber-50 text-amber-700 border-amber-200",
};

function netDue(v: FeeRecord) {
  return Math.max(0, v.amount - (v.discount || 0) - (v.amountPaid || 0));
}

function daysOverdue(dueDate: string) {
  const today = new Date();
  const due = new Date(dueDate);
  const diff = Math.floor((today.getTime() - due.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

function formatDate(dateStr?: string) {
  return formatDatePK(dateStr);
}

export default function FeesPage() {
  const {
    feeRecords, generateFeeVouchers, payFeeVoucher, applyDiscount,
    recordPartialPayment, sendFeeReminders, updateFeePayment, regenerateVoucher,
    schoolInfo,
    feeCategories, feeStructures, addFeeStructure, updateFeeStructure, deleteFeeStructure,
  } = useAppState();
  const { students } = useStudents();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { can, loaded: permsLoaded } = usePermission();

  // Real logged-in role/email — NOT the legacy `activeRole` demo role-switcher
  // (that state defaults to "ADMIN" and is never synced to the actual session,
  // which was letting real students see the full admin fee ledger/controls).
  const [activeRole, setSessionRole] = useState<"ADMIN" | "TEACHER" | "STUDENT" | "PARENT" | "EMPLOYEE" | "OWNER" | "PRINCIPAL" | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  useEffect(() => {
    getSession().then(s => { setSessionRole((s?.role as any) ?? null); setSessionEmail(s?.email ?? null); });
  }, []);

  const [smsChannelConfigured, setSmsChannelConfigured] = useState(false);
  useEffect(() => { isFeeReminderChannelConfigured().then(setSmsChannelConfigured); }, []);

  // ── Relational roster (real Academic Year → Class → Section) ────────────────
  const { activeYearId: relYearId } = useActiveAcademicYearId();
  const { classes: relClasses } = useClasses(relYearId || undefined);
  const [relClassId, setRelClassId] = useState("");
  const { sections: relSections } = useSections(relClassId || undefined);
  const [relSectionId, setRelSectionId] = useState("");
  useEffect(() => { setRelSectionId(""); }, [relClassId]);

  // ── Generate dialog ──────────────────────────────────────────────────────
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [genTarget, setGenTarget] = useState<"ALL" | "CLASS" | "STUDENT">("ALL");
  const [generateData, setGenerateData] = useState({
    classFilter: "ALL",
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 10).toISOString().split("T")[0],
    month: new Date().toISOString().slice(0, 7),
    feeType: "Tuition Fee",
  });
  const [genStudentId, setGenStudentId] = useState<string>("");
  const [genLineItems, setGenLineItems] = useState<{ description: string; amount: string }[]>([
    { description: "Tuition Fee", amount: "3000" },
  ]);
  const genTotal = genLineItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  // ── Status filter ────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<"All" | "Paid" | "Unpaid" | "Overdue" | "Partial">("All");

  // ── Checkout dialog ──────────────────────────────────────────────────────
  const [checkoutVoucher, setCheckoutVoucher] = useState<FeeRecord | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<"details" | "processing" | "success">("details");
  const [gatewayAvailability, setGatewayAvailability] = useState<{ jazzcash: boolean; easypaisa: boolean; onelink: boolean }>({ jazzcash: false, easypaisa: false, onelink: false });
  const [payingWith, setPayingWith] = useState<Gateway | null>(null);
  const [payError, setPayError] = useState("");
  useEffect(() => { fetchGatewayAvailabilityAction().then(setGatewayAvailability); }, []);

  // ── Discount dialog ──────────────────────────────────────────────────────
  const [discountTarget, setDiscountTarget] = useState<FeeRecord | null>(null);
  const [discountForm, setDiscountForm] = useState({ type: "fixed", value: "", reason: "" });

  // ── Partial payment dialog ───────────────────────────────────────────────
  const [partialTarget, setPartialTarget] = useState<FeeRecord | null>(null);
  const [partialForm, setPartialForm] = useState({ amount: "", method: "Cash" });

  // ── Update payment dialog ────────────────────────────────────────────────
  const [updatePayTarget, setUpdatePayTarget] = useState<FeeRecord | null>(null);
  const [updatePayForm, setUpdatePayForm] = useState({ method: "Cash", date: "" });

  // ── Regenerate dialog ────────────────────────────────────────────────────
  const [regenTarget, setRegenTarget] = useState<FeeRecord | null>(null);
  const [regenData, setRegenData] = useState({ month: "", dueDate: "" });
  const [regenItems, setRegenItems] = useState<{ description: string; amount: string }[]>([
    { description: "Monthly Fee", amount: "3000" },
  ]);
  const regenTotal = regenItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  // ── Fee Structure dialogs ────────────────────────────────────────────────
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null);
  const [structureForm, setStructureForm] = useState({
    name: "", assignedClass: "ALL", assignedClassId: "", isActive: true,
    lineItems: [{ description: "", amount: "" }],
  });

  // ── Defaulters ───────────────────────────────────────────────────────────
  const [selectedDefaulters, setSelectedDefaulters] = useState<Set<string>>(new Set());

  // ── Derived data ─────────────────────────────────────────────────────────
  const myStudent = students.find(s => s.email === sessionEmail && s.status === "Active");
  // A parent is scoped to their own wards (students whose parent_email matches
  // the logged-in session) — never the whole school ledger.
  const wardStudentIds = useMemo(
    () => activeRole === "PARENT" ? new Set(students.filter(s => s.parentEmail === sessionEmail).map(s => s.id)) : null,
    [students, activeRole, sessionEmail]
  );
  const isScoped = activeRole === "STUDENT" || activeRole === "PARENT";
  // OWNER gets the same admin bypass everywhere else in the app (usePermission's
  // can() treats ADMIN/PRINCIPAL/OWNER identically) — this page's own role
  // checks had hardcoded only ADMIN/PRINCIPAL, so an Owner account couldn't see
  // the Generate Vouchers button or any other admin fee action.
  const isFeesAdmin = activeRole === "ADMIN" || activeRole === "PRINCIPAL" || activeRole === "OWNER";

  const scopedFees = useMemo(() => {
    if (activeRole === "STUDENT") return feeRecords.filter(f => f.studentId === myStudent?.id);
    if (activeRole === "PARENT") return feeRecords.filter(f => wardStudentIds?.has(f.studentId));
    return feeRecords;
  }, [feeRecords, activeRole, myStudent, wardStudentIds]);

  const displayVouchers = useMemo(() => {
    return statusFilter === "All" ? scopedFees : scopedFees.filter(f => f.status === statusFilter);
  }, [scopedFees, statusFilter]);

  const defaulters = useMemo(() =>
    feeRecords.filter(f => f.status === "Unpaid" || f.status === "Overdue" || f.status === "Partial"),
    [feeRecords]
  );

  const totalCollected = feeRecords.filter(f => f.status === "Paid").reduce((s, f) => s + f.amount, 0);
  const pendingDues    = feeRecords.filter(f => f.status !== "Paid").reduce((s, f) => s + netDue(f), 0);
  const paidCount      = feeRecords.filter(f => f.status === "Paid").length;
  const overdueCount   = feeRecords.filter(f => f.status === "Overdue").length;

  const monthlyReport = useMemo(() => {
    const groups: Record<string, { paid: number; unpaid: number; count: number; paidCount: number }> = {};
    feeRecords.forEach(f => {
      const key = f.month || "Unspecified";
      if (!groups[key]) groups[key] = { paid: 0, unpaid: 0, count: 0, paidCount: 0 };
      groups[key].count++;
      if (f.status === "Paid") {
        groups[key].paid += f.amount;
        groups[key].paidCount++;
      } else {
        groups[key].unpaid += netDue(f);
      }
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [feeRecords]);

  // ── Line item helpers ─────────────────────────────────────────────────────
  const addLineItem = () => setGenLineItems(prev => [...prev, { description: "", amount: "" }]);
  const removeLineItem = (idx: number) => setGenLineItems(prev => prev.filter((_, i) => i !== idx));
  const updateLineItem = (idx: number, field: "description" | "amount", val: string) =>
    setGenLineItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));

  const addRegenItem = () => setRegenItems(prev => [...prev, { description: "", amount: "" }]);
  const removeRegenItem = (idx: number) => setRegenItems(prev => prev.filter((_, i) => i !== idx));
  const updateRegenItem = (idx: number, field: "description" | "amount", val: string) =>
    setRegenItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));

  const addStructureLineItem = () =>
    setStructureForm(prev => ({ ...prev, lineItems: [...prev.lineItems, { description: "", amount: "" }] }));
  const removeStructureLineItem = (idx: number) =>
    setStructureForm(prev => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== idx) }));
  const updateStructureLineItem = (idx: number, field: "description" | "amount", val: string) =>
    setStructureForm(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => i === idx ? { ...item, [field]: val } : item),
    }));

  // ── Auto-fill from fee structure ─────────────────────────────────────────
  const autoFillFromStructure = (classId: string) => {
    const match = feeStructures.find(fs =>
      fs.isActive && (fs.assignedClassId === classId || fs.assignedClass === "ALL")
    );
    if (match && match.lineItems.length > 0) {
      setGenLineItems(match.lineItems.map(li => ({ description: li.description, amount: String(li.amount) })));
      toast({ title: "Auto-filled", description: `Loaded line items from "${match.name}".` });
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generateData.dueDate || !generateData.month) {
      toast({ title: "Validation Error", description: "Month and Due Date are required.", variant: "destructive" });
      return;
    }
    if (genTarget === "STUDENT" && !genStudentId) {
      toast({ title: "Validation Error", description: "Please select a student.", variant: "destructive" });
      return;
    }
    if (genTarget === "CLASS" && !relClassId) {
      toast({ title: "Validation Error", description: "Please select a class.", variant: "destructive" });
      return;
    }
    const validItems = genLineItems.filter(i => i.description.trim() && Number(i.amount) > 0);
    if (validItems.length === 0) {
      toast({ title: "Validation Error", description: "Add at least one fee item.", variant: "destructive" });
      return;
    }
    const items: VoucherLineItem[] = validItems.map(i => ({ description: i.description.trim(), amount: Number(i.amount) }));

    let roster: { studentIds: string[]; classId: string; sectionId?: string; academicYearId: string } | undefined;
    let targetClassName = "";
    if (genTarget === "CLASS") {
      const enrollments = await fetchEnrollmentsDB(relYearId, relClassId);
      const filtered = relSectionId ? enrollments.filter(e => e.sectionId === relSectionId) : enrollments;
      roster = { studentIds: filtered.map(e => e.studentId), classId: relClassId, sectionId: relSectionId || undefined, academicYearId: relYearId };
      targetClassName = relClasses.find(c => c.id === relClassId)?.name || "";
      if (roster.studentIds.length === 0) {
        toast({ title: "No Students Found", description: "That class/section has no enrolled students.", variant: "destructive" });
        return;
      }
    }

    generateFeeVouchers(
      genTarget === "CLASS" ? targetClassName : "ALL",
      genTotal,
      generateData.dueDate,
      undefined,
      generateData.month,
      generateData.feeType,
      items,
      genTarget === "STUDENT" ? genStudentId : undefined,
      roster,
    );
    setIsGenerateOpen(false);
    setGenLineItems([{ description: generateData.feeType, amount: "3000" }]);
    setGenTarget("ALL");
    setGenStudentId("");
    setRelClassId("");
    const targetLabel = genTarget === "STUDENT"
      ? students.find(s => s.id === genStudentId)?.name || "student"
      : genTarget === "CLASS" ? `${targetClassName}${relSectionId ? ` - ${relSections.find(s => s.id === relSectionId)?.name}` : ""} (${roster?.studentIds.length} students)` : "all students";
    toast({ title: "Vouchers Generated", description: `Fee vouchers for ${generateData.month} created for ${targetLabel}. Total: Rs. ${genTotal.toLocaleString()}` });
  };

  const handleMarkPaidDirect = async (v: FeeRecord) => {
    const res = await payFeeVoucher(v.id, "Cash/Direct Transfer");
    if (res.error) { toast({ title: "Payment Failed", description: res.error, variant: "destructive" }); return; }
    toast({ title: "Voucher Updated", description: "Marked as Paid via direct transfer." });
  };

  // Redirects the browser to the gateway's hosted checkout page — the gateway
  // itself collects card/wallet details, never this app. Completion happens
  // via the signed server-to-server callback (src/app/api/payments/*), not
  // anything the client reports back.
  const handlePayWithGateway = async (gateway: Gateway) => {
    if (!checkoutVoucher) return;
    setPayError("");
    setPayingWith(gateway);
    setCheckoutStep("processing");
    const res = await initiateFeePaymentAction(checkoutVoucher.id, gateway);
    if (res.error || !res.actionUrl || !res.fields) {
      setCheckoutStep("details");
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

  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountForm.value || !discountForm.reason) {
      toast({ title: "Validation Error", description: "Discount amount and reason are required.", variant: "destructive" });
      return;
    }
    const base = discountTarget!.amount;
    const discount = discountForm.type === "percent"
      ? (base * Number(discountForm.value)) / 100
      : Number(discountForm.value);
    if (discount > base) {
      toast({ title: "Error", description: "Discount cannot exceed the full amount.", variant: "destructive" });
      return;
    }
    const res = await applyDiscount(discountTarget!.id, discount, discountForm.reason);
    if (res.error) { toast({ title: "Discount Rejected", description: res.error, variant: "destructive" }); return; }
    setDiscountTarget(null);
    setDiscountForm({ type: "fixed", value: "", reason: "" });
    toast({ title: "Discount Applied", description: `Rs. ${discount.toLocaleString()} discount applied.` });
  };

  const handlePartialPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(partialForm.amount);
    const remaining = netDue(partialTarget!);
    if (!amt || amt <= 0 || amt > remaining) {
      toast({ title: "Validation Error", description: `Amount must be between Rs. 1 and Rs. ${remaining.toLocaleString()}.`, variant: "destructive" });
      return;
    }
    const res = await recordPartialPayment(partialTarget!.id, amt, partialForm.method);
    if (res.error) { toast({ title: "Payment Rejected", description: res.error, variant: "destructive" }); return; }
    setPartialTarget(null);
    setPartialForm({ amount: "", method: "Cash" });
    toast({ title: "Partial Payment Recorded", description: `Rs. ${amt.toLocaleString()} recorded.` });
  };

  const handleUpdatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatePayForm.method || !updatePayForm.date) {
      toast({ title: "Validation Error", description: "Payment method and date are required.", variant: "destructive" });
      return;
    }
    updateFeePayment(updatePayTarget!.id, updatePayForm.method, updatePayForm.date);
    toast({ title: "Payment Updated", description: `Payment details updated for ${updatePayTarget!.voucherId}.` });
    setUpdatePayTarget(null);
  };

  const handleRegenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regenData.month || !regenData.dueDate) {
      toast({ title: "Validation Error", description: "Month and due date are required.", variant: "destructive" });
      return;
    }
    const validItems = regenItems.filter(i => i.description.trim() && Number(i.amount) > 0);
    if (validItems.length === 0) {
      toast({ title: "Validation Error", description: "Add at least one fee item.", variant: "destructive" });
      return;
    }
    const items: VoucherLineItem[] = validItems.map(i => ({ description: i.description.trim(), amount: Number(i.amount) }));
    regenerateVoucher(regenTarget!.id, regenData.month, regenData.dueDate, items);
    toast({ title: "Voucher Regenerated", description: `${regenTarget!.voucherId} has been regenerated for ${regenData.month}.` });
    setRegenTarget(null);
  };

  const handleSendReminders = async () => {
    if (selectedDefaulters.size === 0) {
      toast({ title: "No Selection", description: "Select at least one defaulter.", variant: "destructive" });
      return;
    }
    const ids = Array.from(selectedDefaulters);
    sendFeeReminders(ids); // in-app notification, always fires

    // Real SMS/WhatsApp to the parent's phone, only when a gateway is configured —
    // the in-app notification above doesn't reach anyone who isn't already logged
    // into the portal, which is exactly who a fee reminder needs to reach.
    if (smsChannelConfigured) {
      let sent = 0;
      for (const id of ids) {
        const res = await sendFeeReminderAction(id);
        if (!res.error) sent++;
      }
      toast({ title: "Reminders Sent", description: `In-app notice sent to ${ids.length} student(s); SMS/WhatsApp delivered to ${sent} parent(s) with a phone number on file.` });
    } else {
      toast({ title: "Reminders Sent", description: `In-app notice dispatched to ${ids.length} student(s). Configure an SMS/WhatsApp gateway in Settings to also text parents directly.` });
    }
    setSelectedDefaulters(new Set());
  };

  const toggleDefaulter = (id: string) => {
    setSelectedDefaulters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllDefaulters = () => {
    if (selectedDefaulters.size === defaulters.length) {
      setSelectedDefaulters(new Set());
    } else {
      setSelectedDefaulters(new Set(defaulters.map(d => d.id)));
    }
  };

  const handleDownloadChallan = (voucher: FeeRecord) => {
    const student = students.find(s => s.id === voucher.studentId);
    const rollNumber = student?.admissionNumber || voucher.studentId;
    const win = window.open("", "_blank", "width=680,height=900");
    if (!win) return;
    const schoolName = schoolInfo.name || "School";
    const schoolAddress = schoolInfo.address || "";
    const schoolPhone = (schoolInfo as any).phone || "";
    const issueDate = formatDate(voucher.issueDate || new Date().toISOString().split("T")[0]);
    const dueDate = formatDate(voucher.dueDate);
    const net = netDue(voucher);
    const lineItemsHTML = (voucher.lineItems && voucher.lineItems.length > 0
      ? voucher.lineItems
      : [{ description: voucher.feeType || "Fee", amount: voucher.amount }]
    ).map(item => `
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #eee;">${item.description}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:right;">Rs. ${item.amount.toLocaleString()}</td>
      </tr>`).join("");
    const discountRow = (voucher.discount || 0) > 0
      ? `<tr style="color:#166534;"><td style="padding:9px 12px;border-bottom:1px solid #eee;">Discount${voucher.discountReason ? " (" + voucher.discountReason + ")" : ""}</td><td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:right;">- Rs. ${(voucher.discount || 0).toLocaleString()}</td></tr>`
      : "";
    const paidRow = (voucher.amountPaid || 0) > 0
      ? `<tr style="color:#92400e;"><td style="padding:9px 12px;border-bottom:1px solid #eee;">Amount Paid</td><td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:right;">- Rs. ${(voucher.amountPaid || 0).toLocaleString()}</td></tr>`
      : "";
    const statusColor = { Paid: "#166534", Unpaid: "#1d4ed8", Overdue: "#991b1b", Partial: "#92400e" }[voucher.status] || "#111";
    const statusBg = { Paid: "#dcfce7", Unpaid: "#dbeafe", Overdue: "#fee2e2", Partial: "#fef3c7" }[voucher.status] || "#f3f4f6";
    const generated = formatDatePK(new Date());

    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Fee Voucher — ${voucher.voucherId}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; background:#f5f5f5; padding:30px; color:#111; }
  .voucher { background:#fff; max-width:600px; margin:0 auto; border:1px solid #ddd; border-radius:8px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }
  .header { background:#0B1B3D; color:#fff; padding:28px 32px; text-align:center; }
  .school-name { font-size:22px; font-weight:700; letter-spacing:.5px; }
  .school-address { font-size:11px; color:rgba(255,255,255,.7); margin-top:4px; }
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
    ${schoolAddress ? `<div class="school-address">${schoolAddress}${schoolPhone ? " · " + schoolPhone : ""}</div>` : ""}
    <div class="voucher-title">FEE PAYMENT VOUCHER</div>
    <div class="voucher-no">Voucher No: ${voucher.voucherId}${voucher.month ? " &nbsp;·&nbsp; " + voucher.month : ""}</div>
  </div>
  <div class="info-section">
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Student Name</span><span class="info-value">${voucher.studentName}</span></div>
      <div class="info-item"><span class="info-label">Admission / Roll No.</span><span class="info-value">${rollNumber}</span></div>
      <div class="info-item"><span class="info-label">Class / Batch</span><span class="info-value">${voucher.className || student?.class || "—"}</span></div>
      <div class="info-item"><span class="info-label">Fee Type</span><span class="info-value">${voucher.feeType || "General Fee"}</span></div>
      <div class="info-item"><span class="info-label">Issue Date</span><span class="info-value">${issueDate}</span></div>
      <div class="info-item"><span class="info-label">Due Date</span><span class="info-value" style="color:#dc2626;">${dueDate}</span></div>
    </div>
  </div>
  <div class="breakdown-section">
    <div class="section-title">Fee Breakdown</div>
    <table class="fee-table">
      <thead><tr><th>Description</th><th style="text-align:right;">Amount</th></tr></thead>
      <tbody>${lineItemsHTML}${discountRow}${paidRow}</tbody>
      <tfoot><tr class="total-row"><td>Total Amount Due</td><td>Rs. ${net.toLocaleString()}</td></tr></tfoot>
    </table>
  </div>
  <div class="status-section">
    <span style="font-size:12px;color:#555;">Payment Status</span>
    <span class="status-badge" style="background:${statusBg};color:${statusColor};">${voucher.status.toUpperCase()}</span>
  </div>
  <div class="instructions">
    <p><strong>Payment Instructions:</strong><br>Pay before the due date to avoid late charges. After payment, submit a copy of this voucher to the accounts office.</p>
    ${voucher.status === "Paid" && voucher.paymentMethod ? `<p style="margin-top:6px;color:#166534;"><strong>Payment received via ${voucher.paymentMethod}</strong>${voucher.paymentDate ? " on " + formatDate(voucher.paymentDate) : ""}.</p>` : ""}
  </div>
  <div class="footer"><span>${schoolName}</span><span>Generated: ${generated}</span></div>
</div>
<button class="print-btn" onclick="window.print()">&#128424; Print / Save as PDF</button>
</body></html>`);
    win.document.close();
  };

  const handleGenerateReceipt = async (voucher: FeeRecord) => {
    if (voucher.status !== "Paid" && voucher.status !== "Partial") {
      toast({ title: "Cannot Generate Receipt", description: "Payment must be recorded first.", variant: "destructive" });
      return;
    }
    const history: FeePaymentHistoryEntry[] = await fetchFeePaymentHistoryDB(voucher.id);
    const student = students.find(s => s.id === voucher.studentId);
    const rollNumber = student?.admissionNumber || voucher.studentId;
    const win = window.open("", "_blank", "width=680,height=850");
    if (!win) return;
    const schoolName = schoolInfo.name || "School";
    const schoolAddress = schoolInfo.address || "";
    const paidAmount = voucher.status === "Paid" ? netDue(voucher) + (voucher.amountPaid || 0) : (voucher.amountPaid || 0);
    const receiptNo = `RCP-${voucher.voucherId.replace("FV-", "")}`;
    const payDate = formatDate(voucher.paymentDate || new Date().toISOString().split("T")[0]);
    const generated = formatDatePK(new Date());
    const payments = history.filter(h => h.type === "payment");
    const historyHTML = payments.length > 1 ? `
  <div class="info-section">
    <div class="info-label" style="margin-bottom:8px;">Payment History</div>
    <table style="width:100%;border-collapse:collapse;">
      ${payments.map(p => `
      <tr>
        <td style="padding:6px 0;font-size:12px;color:#333;">${formatDate(p.paymentDate || undefined)}</td>
        <td style="padding:6px 0;font-size:12px;color:#666;">${p.method || "—"}</td>
        <td style="padding:6px 0;font-size:12px;font-weight:700;text-align:right;color:#166534;">Rs. ${p.amount.toLocaleString()}</td>
      </tr>`).join("")}
    </table>
  </div>` : "";

    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Payment Receipt — ${receiptNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; background:#f5f5f5; padding:30px; color:#111; }
  .receipt { background:#fff; max-width:600px; margin:0 auto; border:1px solid #ddd; border-radius:8px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }
  .header { background:#166534; color:#fff; padding:28px 32px; text-align:center; }
  .school-name { font-size:22px; font-weight:700; }
  .receipt-title { margin-top:14px; display:inline-block; border:1.5px solid rgba(255,255,255,.5); padding:5px 22px; font-size:13px; font-weight:700; letter-spacing:3px; border-radius:3px; }
  .receipt-no { font-size:12px; color:rgba(255,255,255,.8); margin-top:8px; }
  .checkmark { font-size:40px; margin-bottom:8px; }
  .info-section { padding:20px 32px; border-bottom:1px solid #eee; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .info-item { display:flex; flex-direction:column; gap:2px; }
  .info-label { font-size:10px; color:#888; font-weight:600; text-transform:uppercase; letter-spacing:.5px; }
  .info-value { font-size:13px; font-weight:600; color:#111; }
  .amount-section { padding:24px 32px; text-align:center; background:#f0fdf4; }
  .amount-label { font-size:11px; color:#166534; font-weight:700; text-transform:uppercase; letter-spacing:1px; }
  .amount-value { font-size:32px; font-weight:800; color:#166534; margin-top:6px; }
  .method-badge { display:inline-block; margin-top:8px; padding:4px 16px; background:#dcfce7; color:#166534; border-radius:20px; font-size:12px; font-weight:700; }
  .footer { background:#f8f9fa; padding:12px 32px; border-top:1px solid #eee; display:flex; justify-content:space-between; font-size:10px; color:#999; }
  .print-btn { display:block; margin:20px auto 0; padding:10px 36px; background:#166534; color:#fff; border:none; border-radius:6px; font-size:13px; cursor:pointer; font-weight:600; }
  @media print { .print-btn { display:none; } body { padding:0; background:#fff; } .receipt { box-shadow:none; border:none; } }
</style></head><body>
<div class="receipt">
  <div class="header">
    <div class="checkmark">✓</div>
    <div class="school-name">${schoolName}</div>
    ${schoolAddress ? `<div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:4px;">${schoolAddress}</div>` : ""}
    <div class="receipt-title">PAYMENT RECEIPT</div>
    <div class="receipt-no">Receipt No: ${receiptNo} &nbsp;·&nbsp; Voucher: ${voucher.voucherId}</div>
  </div>
  <div class="info-section">
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Student Name</span><span class="info-value">${voucher.studentName}</span></div>
      <div class="info-item"><span class="info-label">Admission / Roll No.</span><span class="info-value">${rollNumber}</span></div>
      <div class="info-item"><span class="info-label">Class / Batch</span><span class="info-value">${voucher.className || student?.class || "—"}</span></div>
      <div class="info-item"><span class="info-label">Fee Month</span><span class="info-value">${voucher.month || "—"}</span></div>
      <div class="info-item"><span class="info-label">Payment Date</span><span class="info-value" style="color:#166534;">${payDate}</span></div>
      <div class="info-item"><span class="info-label">Fee Type</span><span class="info-value">${voucher.feeType || "General Fee"}</span></div>
    </div>
  </div>${historyHTML}
  <div class="amount-section">
    <div class="amount-label">Amount Received</div>
    <div class="amount-value">Rs. ${(voucher.status === "Paid" ? voucher.amount - (voucher.discount || 0) : (voucher.amountPaid || 0)).toLocaleString()}</div>
    <div class="method-badge">Paid via ${voucher.paymentMethod || "—"}</div>
  </div>
  <div class="footer"><span>${schoolName}</span><span>Generated: ${generated}</span></div>
</div>
<button class="print-btn" onclick="window.print()">&#128424; Print Receipt</button>
</body></html>`);
    win.document.close();
  };

  // ── Fee Structure handlers ────────────────────────────────────────────────
  const openAddStructure = () => {
    setEditingStructure(null);
    setStructureForm({ name: "", assignedClass: "ALL", assignedClassId: "", isActive: true, lineItems: [{ description: "", amount: "" }] });
    setStructureDialogOpen(true);
  };

  const openEditStructure = (fs: FeeStructure) => {
    setEditingStructure(fs);
    setStructureForm({
      name: fs.name,
      assignedClass: fs.assignedClass,
      assignedClassId: fs.assignedClassId || "",
      isActive: fs.isActive,
      lineItems: fs.lineItems.map(li => ({ description: li.description, amount: String(li.amount) })),
    });
    setStructureDialogOpen(true);
  };

  const handleSaveStructure = (e: React.FormEvent) => {
    e.preventDefault();
    if (!structureForm.name.trim()) {
      toast({ title: "Validation Error", description: "Structure name is required.", variant: "destructive" });
      return;
    }
    const validItems = structureForm.lineItems.filter(i => i.description.trim() && Number(i.amount) > 0);
    if (validItems.length === 0) {
      toast({ title: "Validation Error", description: "Add at least one fee item.", variant: "destructive" });
      return;
    }
    const lineItems: VoucherLineItem[] = validItems.map(i => ({ description: i.description.trim(), amount: Number(i.amount) }));
    const totalAmount = lineItems.reduce((s, i) => s + i.amount, 0);
    const assignedClassName = structureForm.assignedClassId
      ? relClasses.find(c => c.id === structureForm.assignedClassId)?.name || "ALL"
      : "ALL";
    if (editingStructure) {
      updateFeeStructure({ ...editingStructure, name: structureForm.name.trim(), assignedClass: assignedClassName, assignedClassId: structureForm.assignedClassId || undefined, lineItems, totalAmount, isActive: structureForm.isActive });
      toast({ title: "Structure Updated", description: `"${structureForm.name}" saved.` });
    } else {
      addFeeStructure({ name: structureForm.name.trim(), assignedClass: assignedClassName, assignedClassId: structureForm.assignedClassId || undefined, lineItems, totalAmount, isActive: structureForm.isActive });
      toast({ title: "Structure Created", description: `"${structureForm.name}" added.` });
    }
    setStructureDialogOpen(false);
  };

  const structureTotal = structureForm.lineItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  if (!permsLoaded) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-7 w-40 mb-2" /><Skeleton className="h-4 w-64" /></div>
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1"><Skeleton className="h-6 w-16 mb-1" /><Skeleton className="h-3 w-20" /></div>
            </CardContent></Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!can("fees.view")) return <Unauthorized />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">
            {isScoped ? "My Fees" : "Fee Management"}
          </h1>
          {!isScoped && (
            <p className="text-muted-foreground mt-1">Monthly vouchers, structures, discounts, partial payments, and reports.</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isScoped && (
            <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
              <Download className="h-4 w-4" /> Download Report
            </Button>
          )}
          {(isFeesAdmin) && (
            <Dialog open={isGenerateOpen} onOpenChange={(open) => {
              setIsGenerateOpen(open);
              if (open) setGenLineItems([{ description: generateData.feeType, amount: "3000" }]);
            }}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 gap-2">
                  <Plus className="h-4 w-4" /> Generate Vouchers
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg border-secondary">
                <form onSubmit={handleGenerate}>
                  <DialogHeader>
                    <DialogTitle className="font-headline font-bold text-primary">Generate Monthly Fee Vouchers</DialogTitle>
                    <DialogDescription>Bulk-create fee vouchers with itemised breakdown.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="month">Month</Label>
                        <Input id="month" type="month" value={generateData.month}
                          onChange={e => setGenerateData({ ...generateData, month: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dueDate">Due Date</Label>
                        <Input id="dueDate" type="date" value={generateData.dueDate}
                          onChange={e => setGenerateData({ ...generateData, dueDate: e.target.value })} />
                      </div>
                    </div>

                    {/* Generate For */}
                    <div className="space-y-2">
                      <Label>Generate For</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["ALL", "CLASS", "STUDENT"] as const).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => { setGenTarget(t); setGenStudentId(""); }}
                            className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${genTarget === t ? "bg-primary text-white border-primary" : "border-secondary text-muted-foreground hover:border-primary/50"}`}
                          >
                            {t === "ALL" ? "All Students" : t === "CLASS" ? "Specific Class" : "Individual"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {genTarget === "CLASS" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="classFilter">Class</Label>
                          <Select value={relClassId} onValueChange={val => { setRelClassId(val); autoFillFromStructure(val); }}>
                            <SelectTrigger id="classFilter"><SelectValue placeholder="Select class..." /></SelectTrigger>
                            <SelectContent>
                              {relClasses.map(cls => (
                                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sectionFilter">Section</Label>
                          <Select value={relSectionId} onValueChange={setRelSectionId} disabled={!relClassId}>
                            <SelectTrigger id="sectionFilter"><SelectValue placeholder="All sections" /></SelectTrigger>
                            <SelectContent>
                              {relSections.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {genTarget === "STUDENT" && (
                      <div className="space-y-2">
                        <Label htmlFor="genStudent">Student</Label>
                        <Select value={genStudentId} onValueChange={setGenStudentId}>
                          <SelectTrigger id="genStudent"><SelectValue placeholder="Select student..." /></SelectTrigger>
                          <SelectContent>
                            {students.filter(s => s.status === "Active").map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name} — {s.class}-{s.section}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="feeType">Fee Category</Label>
                        <Select value={generateData.feeType} onValueChange={val => {
                          setGenerateData({ ...generateData, feeType: val });
                          setGenLineItems(prev => prev.map((item, i) => i === 0 ? { ...item, description: val } : item));
                        }}>
                          <SelectTrigger id="feeType"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {feeCategories.filter(fc => fc.isActive).map(fc => (
                              <SelectItem key={fc.id} value={fc.name}>{fc.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="feeStructure">Load from Structure</Label>
                        <Select onValueChange={val => {
                          const fs = feeStructures.find(f => f.id === val);
                          if (fs) {
                            setGenLineItems(fs.lineItems.map(li => ({ description: li.description, amount: String(li.amount) })));
                            toast({ title: "Loaded", description: `Line items from "${fs.name}".` });
                          }
                        }}>
                          <SelectTrigger id="feeStructure"><SelectValue placeholder="Optional…" /></SelectTrigger>
                          <SelectContent>
                            {feeStructures.filter(fs => fs.isActive).map(fs => (
                              <SelectItem key={fs.id} value={fs.id}>{fs.name} ({fs.assignedClass})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Fee Line Items */}
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-primary" /> Fee Line Items
                      </Label>
                      <div className="space-y-2">
                        {genLineItems.map((item, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <Input placeholder="Description" value={item.description}
                              onChange={e => updateLineItem(idx, "description", e.target.value)}
                              className="flex-1 h-9 text-sm" />
                            <div className="relative w-32">
                              <span className="absolute left-3 top-2 text-xs text-muted-foreground font-medium">Rs.</span>
                              <Input type="number" placeholder="0" value={item.amount}
                                onChange={e => updateLineItem(idx, "amount", e.target.value)}
                                className="pl-9 h-9 text-sm" min="0" />
                            </div>
                            {genLineItems.length > 1 && (
                              <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeLineItem(idx)}>
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={addLineItem} className="gap-1 h-8 text-xs border-dashed">
                        <Plus className="h-3 w-3" /> Add Item
                      </Button>
                      {genTotal > 0 && (
                        <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg border border-primary/20">
                          <span className="text-sm font-semibold text-primary">Voucher Total</span>
                          <span className="text-base font-bold text-primary">Rs. {genTotal.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                    <Button type="button" variant="outline" onClick={() => setIsGenerateOpen(false)}>Cancel</Button>
                    <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={genTotal === 0}>
                      Generate Vouchers
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* KPI Cards — school-wide totals, staff only */}
      {!isScoped && (
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-none shadow-sm bg-[#0B1B3D] text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-white/10"><CreditCard className="h-6 w-6" /></div>
              <div>
                <p className="text-white/60 text-sm font-medium">Total Collected</p>
                <h3 className="text-2xl font-bold">Rs. {totalCollected.toLocaleString()}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-100"><Clock className="h-6 w-6 text-orange-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Pending Dues</p>
                <h3 className="text-2xl font-bold">Rs. {pendingDues.toLocaleString()}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100"><CheckCircle className="h-6 w-6 text-green-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Settled</p>
                <h3 className="text-2xl font-bold">
                  {paidCount} <span className="text-xs text-muted-foreground font-normal">/ {feeRecords.length}</span>
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-100"><AlertTriangle className="h-6 w-6 text-red-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Defaulters</p>
                <h3 className="text-2xl font-bold">{defaulters.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Scoped (student/parent): Current Voucher Card */}
      {isScoped && (() => {
        const myFees = scopedFees;
        const current = myFees.find(f => f.status !== "Paid") || myFees[myFees.length - 1];
        if (!current) return null;
        const net = netDue(current);
        return (
          <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-primary flex items-center gap-2">
                <FileText className="h-5 w-5" /> Current Fee Voucher
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-xs text-muted-foreground font-medium">Voucher No.</p><p className="font-bold text-primary font-mono">{current.voucherId}</p></div>
                  <div><p className="text-xs text-muted-foreground font-medium">Month</p><p className="font-semibold">{current.month || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground font-medium">Amount Due</p><p className="font-bold text-lg text-primary">Rs. {net.toLocaleString()}</p></div>
                  <div><p className="text-xs text-muted-foreground font-medium">Due Date</p><p className="font-semibold text-red-600">{formatDate(current.dueDate)}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={STATUS_COLORS[current.status] || ""}>{current.status}</Badge>
                  <Button size="sm" variant="outline" className="gap-1.5 text-primary border-primary hover:bg-primary/5" onClick={() => handleDownloadChallan(current)}>
                    <Eye className="h-3.5 w-3.5" /> View
                  </Button>
                  <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90" onClick={() => handleDownloadChallan(current)}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Tabs */}
      <Tabs defaultValue="vouchers">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="vouchers" className="gap-2"><FileText className="h-4 w-4" /> Voucher Ledger</TabsTrigger>
          {(isFeesAdmin) && (
            <TabsTrigger value="structures" className="gap-2"><Layers className="h-4 w-4" /> Fee Structures</TabsTrigger>
          )}
          {(isFeesAdmin) && (
            <TabsTrigger value="defaulters" className="gap-2">
              <Users className="h-4 w-4" /> Defaulters
              {defaulters.length > 0 && <Badge className="ml-1 h-5 px-1.5 bg-red-500 text-white text-[10px]">{defaulters.length}</Badge>}
            </TabsTrigger>
          )}
          {(isFeesAdmin) && (
            <TabsTrigger value="reports" className="gap-2"><BarChart3 className="h-4 w-4" /> Reports</TabsTrigger>
          )}
        </TabsList>

        {/* ── Voucher Ledger Tab ── */}
        <TabsContent value="vouchers">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-lg">Voucher Ledger</CardTitle>
                <CardDescription>Fee invoices for {schoolInfo.name}</CardDescription>
              </div>
              <div className="flex gap-1 flex-wrap items-center">
                {(["All", "Paid", "Unpaid", "Partial", "Overdue"] as const).map(s => (
                  <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"}
                    className={`h-7 text-xs ${statusFilter === s ? "bg-primary" : ""}`}
                    onClick={() => setStatusFilter(s)}>
                    {s}
                  </Button>
                ))}
                {!isScoped && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
                    exportToCsv("fee-ledger", ["Voucher", "Student", "Class", "Fee Type", "Month", "Amount", "Discount", "Net Due", "Due Date", "Status"],
                      displayVouchers.map(v => [v.voucherId, v.studentName, v.className || "", v.feeType || "", v.month || "", v.amount, v.discount || 0, netDue(v), v.dueDate, v.status]));
                    toast({ title: "Fee ledger exported" });
                  }}>
                    <Download className="h-3 w-3" /> Export
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold py-4">Voucher</TableHead>
                    <TableHead className="font-bold">Student</TableHead>
                    <TableHead className="font-bold">Month / Type</TableHead>
                    <TableHead className="font-bold text-right">Amount</TableHead>
                    <TableHead className="font-bold text-right">Net Due</TableHead>
                    <TableHead className="font-bold">Due Date</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="w-[260px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayVouchers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No fee invoices match the current filter.</TableCell>
                    </TableRow>
                  ) : (
                    displayVouchers.map(v => {
                      const net = netDue(v);
                      return (
                        <TableRow key={v.id} className="hover:bg-secondary/5 transition-colors">
                          <TableCell className="font-mono text-xs font-bold text-primary">{v.voucherId}</TableCell>
                          <TableCell className="font-semibold text-primary">
                            <div>{v.studentName}</div>
                            {v.className && <div className="text-[10px] text-muted-foreground">{v.className}</div>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div>{v.month || "—"}</div>
                            {v.feeType && <div className="text-[10px] text-primary/60">{v.feeType}</div>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-bold text-primary">Rs. {v.amount.toLocaleString()}</div>
                            {(v.discount || 0) > 0 && (
                              <div className="text-[10px] text-green-600 flex items-center justify-end gap-0.5">
                                <Tag className="h-2.5 w-2.5" /> -Rs. {v.discount!.toLocaleString()}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">Rs. {net.toLocaleString()}</TableCell>
                          <TableCell className="text-muted-foreground font-medium text-xs">{formatDate(v.dueDate)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={STATUS_COLORS[v.status] || ""}>
                              {v.status}{v.status === "Partial" && v.amountPaid ? ` (${v.amountPaid.toLocaleString()})` : ""}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              {v.status !== "Paid" && isScoped && (
                                <Button onClick={() => { setCheckoutVoucher(v); setCheckoutStep("details"); }}
                                  size="sm" className="h-7 bg-accent hover:bg-accent/90 gap-1 font-bold text-white text-xs">
                                  <CreditCard className="h-3 w-3" /> Pay
                                </Button>
                              )}
                              {(isFeesAdmin) && v.status !== "Paid" && (
                                <>
                                  <Button onClick={() => handleMarkPaidDirect(v)} size="sm" variant="outline"
                                    className="h-7 text-primary border-primary hover:bg-primary/5 gap-1 text-xs">
                                    <CheckCircle2 className="h-3 w-3" /> Paid
                                  </Button>
                                  <Button onClick={() => { setPartialTarget(v); setPartialForm({ amount: "", method: "Cash" }); }}
                                    size="sm" variant="outline" className="h-7 gap-1 text-xs text-amber-600 border-amber-300 hover:bg-amber-50">
                                    <DollarSign className="h-3 w-3" /> Partial
                                  </Button>
                                  <Button onClick={() => { setDiscountTarget(v); setDiscountForm({ type: "fixed", value: "", reason: "" }); }}
                                    size="sm" variant="outline" className="h-7 gap-1 text-xs text-green-600 border-green-300 hover:bg-green-50">
                                    <Percent className="h-3 w-3" /> Disc
                                  </Button>
                                </>
                              )}
                              {(isFeesAdmin) && (
                                <Button onClick={() => {
                                  setRegenTarget(v);
                                  setRegenData({ month: v.month || new Date().toISOString().slice(0, 7), dueDate: v.dueDate });
                                  setRegenItems(v.lineItems && v.lineItems.length > 0
                                    ? v.lineItems.map(li => ({ description: li.description, amount: String(li.amount) }))
                                    : [{ description: v.feeType || "Monthly Fee", amount: String(v.amount) }]);
                                }}
                                  size="sm" variant="ghost" className="h-7 gap-1 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                  title="Regenerate Voucher">
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              )}
                              {(v.status === "Paid" || v.status === "Partial") && (
                                <Button onClick={() => handleGenerateReceipt(v)} size="sm" variant="ghost"
                                  className="h-7 gap-1 text-xs text-green-600 hover:text-green-700 hover:bg-green-50" title="Generate Receipt">
                                  <Receipt className="h-3 w-3" />
                                </Button>
                              )}
                              {v.status === "Paid" && (isFeesAdmin) && (
                                <Button onClick={() => {
                                  setUpdatePayTarget(v);
                                  setUpdatePayForm({ method: v.paymentMethod || "Cash", date: v.paymentDate || "" });
                                }}
                                  size="sm" variant="ghost" className="h-7 gap-1 text-xs text-blue-600 hover:bg-blue-50" title="Update Payment">
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                              {v.status === "Paid" && !isScoped && (
                                <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1 py-1">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> {v.paymentMethod || "Direct"}
                                </span>
                              )}
                              <Button onClick={() => handleDownloadChallan(v)} size="sm" variant="ghost"
                                className="h-7 gap-1 text-xs" title="View / Download Voucher">
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Fee Structures Tab ── */}
        {(isFeesAdmin) && (
          <TabsContent value="structures">
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><Layers className="h-5 w-5 text-primary" /> Fee Structures</CardTitle>
                  <CardDescription>Templates defining fee line items per class. Used when generating vouchers.</CardDescription>
                </div>
                <Button onClick={openAddStructure} className="bg-primary hover:bg-primary/90 gap-2">
                  <Plus className="h-4 w-4" /> New Structure
                </Button>
              </CardHeader>
              <CardContent>
                {feeStructures.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">
                    <Layers className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="font-medium">No fee structures yet.</p>
                    <p className="text-xs mt-1">Create a structure to auto-fill line items when generating vouchers.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {feeStructures.map(fs => (
                      <div key={fs.id} className={`rounded-xl border p-4 transition-all ${fs.isActive ? "border-primary/20 bg-white shadow-sm" : "border-secondary bg-secondary/10 opacity-60"}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-bold text-primary text-sm">{fs.name}</h3>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-[10px] px-2 py-0 h-4">{fs.assignedClass}</Badge>
                              {fs.isActive
                                ? <Badge variant="outline" className="text-[10px] px-2 py-0 h-4 bg-green-50 text-green-700 border-green-200">Active</Badge>
                                : <Badge variant="outline" className="text-[10px] px-2 py-0 h-4 bg-gray-50 text-gray-500 border-gray-200">Inactive</Badge>}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditStructure(fs)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50" onClick={async () => {
                              const ok = await confirm({
                                title: `Delete "${fs.name}"?`,
                                description: "This fee structure will no longer be available for generating new vouchers. This cannot be undone.",
                              });
                              if (!ok) return;
                              deleteFeeStructure(fs.id);
                              toast({ title: "Deleted", description: `"${fs.name}" removed.` });
                            }}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                        <div className="space-y-1 mb-3">
                          {fs.lineItems.map((li, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{li.description}</span>
                              <span className="font-semibold text-primary">Rs. {li.amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-secondary/50">
                          <span className="text-xs font-bold text-primary">Total: Rs. {fs.totalAmount.toLocaleString()}</span>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-primary"
                            onClick={() => { updateFeeStructure({ ...fs, isActive: !fs.isActive }); }}>
                            {fs.isActive ? <><ToggleRight className="h-3 w-3" /> Deactivate</> : <><ToggleLeft className="h-3 w-3" /> Activate</>}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Defaulters Tab ── */}
        {(isFeesAdmin) && (
          <TabsContent value="defaulters">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" /> Defaulter List</CardTitle>
                  <CardDescription>Students with outstanding fee balances.</CardDescription>
                </div>
                <Button onClick={handleSendReminders} disabled={selectedDefaulters.size === 0} className="gap-2 bg-primary hover:bg-primary/90">
                  <Bell className="h-4 w-4" /> Send Reminders
                  {selectedDefaulters.size > 0 && <Badge className="ml-1 bg-white text-primary text-xs">{selectedDefaulters.size}</Badge>}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-secondary/20">
                    <TableRow>
                      <TableHead className="w-10 py-4">
                        <Checkbox checked={defaulters.length > 0 && selectedDefaulters.size === defaulters.length} onCheckedChange={toggleAllDefaulters} />
                      </TableHead>
                      <TableHead className="font-bold">Student</TableHead>
                      <TableHead className="font-bold">Voucher</TableHead>
                      <TableHead className="font-bold">Month</TableHead>
                      <TableHead className="font-bold text-right">Net Due</TableHead>
                      <TableHead className="font-bold">Due Date</TableHead>
                      <TableHead className="font-bold text-center">Days Overdue</TableHead>
                      <TableHead className="font-bold text-center">Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {defaulters.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
                          <p className="font-medium">No defaulters — all fees are settled!</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      defaulters.map(v => {
                        const days = daysOverdue(v.dueDate);
                        const net = netDue(v);
                        return (
                          <TableRow key={v.id} className={`hover:bg-secondary/5 transition-colors ${selectedDefaulters.has(v.id) ? "bg-primary/5" : ""}`}>
                            <TableCell><Checkbox checked={selectedDefaulters.has(v.id)} onCheckedChange={() => toggleDefaulter(v.id)} /></TableCell>
                            <TableCell className="font-semibold text-primary">{v.studentName}</TableCell>
                            <TableCell className="font-mono text-xs font-bold text-primary">{v.voucherId}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{v.month || "—"}</TableCell>
                            <TableCell className="text-right font-bold text-red-600">Rs. {net.toLocaleString()}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{formatDate(v.dueDate)}</TableCell>
                            <TableCell className="text-center">
                              {days > 0 ? (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">{days}d overdue</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Not yet due</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={STATUS_COLORS[v.status] || ""}>{v.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => handleDownloadChallan(v)} title="Download Voucher">
                                <Download className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Reports Tab ── */}
        {(isFeesAdmin) && (
          <TabsContent value="reports">
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">Total Vouchers</p>
                    <p className="text-2xl font-bold text-primary">{feeRecords.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">{paidCount} paid · {feeRecords.length - paidCount} pending</p>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-green-50">
                  <CardContent className="p-5">
                    <p className="text-xs text-green-700 font-semibold uppercase tracking-wide mb-1">Collected</p>
                    <p className="text-2xl font-bold text-green-700">Rs. {totalCollected.toLocaleString()}</p>
                    <p className="text-xs text-green-600 mt-1">{paidCount} vouchers paid</p>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-orange-50">
                  <CardContent className="p-5">
                    <p className="text-xs text-orange-700 font-semibold uppercase tracking-wide mb-1">Outstanding</p>
                    <p className="text-2xl font-bold text-orange-700">Rs. {pendingDues.toLocaleString()}</p>
                    <p className="text-xs text-orange-600 mt-1">{feeRecords.length - paidCount} vouchers pending</p>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-red-50">
                  <CardContent className="p-5">
                    <p className="text-xs text-red-700 font-semibold uppercase tracking-wide mb-1">Overdue</p>
                    <p className="text-2xl font-bold text-red-700">{overdueCount}</p>
                    <p className="text-xs text-red-600 mt-1">vouchers past due date</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-primary flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Monthly Collection Report
                  </CardTitle>
                  <CardDescription>Fee collection summary grouped by month</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-secondary/20">
                      <TableRow>
                        <TableHead className="font-bold py-4">Month</TableHead>
                        <TableHead className="font-bold text-center">Total Vouchers</TableHead>
                        <TableHead className="font-bold text-right">Collected</TableHead>
                        <TableHead className="font-bold text-right">Outstanding</TableHead>
                        <TableHead className="font-bold text-center">Collection Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyReport.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No fee data available.</TableCell></TableRow>
                      ) : (
                        monthlyReport.map(([month, data]) => {
                          const rate = data.count > 0 ? Math.round((data.paidCount / data.count) * 100) : 0;
                          return (
                            <TableRow key={month} className="hover:bg-secondary/5">
                              <TableCell className="font-semibold text-primary">{month}</TableCell>
                              <TableCell className="text-center">
                                <span className="text-sm">{data.count}</span>
                                <span className="text-xs text-muted-foreground ml-1">({data.paidCount} paid)</span>
                              </TableCell>
                              <TableCell className="text-right font-bold text-green-700">Rs. {data.paid.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-bold text-red-600">Rs. {data.unpaid.toLocaleString()}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${rate}%` }} />
                                  </div>
                                  <span className="text-xs font-semibold text-muted-foreground">{rate}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* ── Checkout Dialog ── */}
      <Dialog open={!!checkoutVoucher} onOpenChange={() => setCheckoutVoucher(null)}>
        <DialogContent className="max-w-md border-secondary">
          {checkoutVoucher && (
            <div>
              <DialogHeader>
                <DialogTitle className="font-headline font-bold text-primary flex items-center gap-2">
                  <Building className="h-5 w-5 text-accent" /> Checkout Portal
                </DialogTitle>
                <DialogDescription>Settle balance for {checkoutVoucher.studentName} · {checkoutVoucher.voucherId}</DialogDescription>
              </DialogHeader>
              {checkoutStep === "details" && (
                <div className="space-y-4 py-4">
                  <div className="p-4 bg-secondary/30 rounded-lg space-y-2 text-sm border font-medium text-primary">
                    <div className="flex justify-between"><span className="text-muted-foreground">Gross Amount:</span><span>Rs. {checkoutVoucher.amount.toLocaleString()}</span></div>
                    {(checkoutVoucher.discount || 0) > 0 && <div className="flex justify-between text-green-600"><span>Discount:</span><span>-Rs. {checkoutVoucher.discount!.toLocaleString()}</span></div>}
                    {(checkoutVoucher.amountPaid || 0) > 0 && <div className="flex justify-between text-amber-600"><span>Already Paid:</span><span>-Rs. {checkoutVoucher.amountPaid!.toLocaleString()}</span></div>}
                    <div className="flex justify-between border-t pt-2 font-bold"><span>Total Due:</span><span className="text-accent">Rs. {netDue(checkoutVoucher).toLocaleString()}</span></div>
                  </div>

                  {payError && (
                    <div role="alert" className="flex items-start gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {payError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Choose how to pay</Label>
                    <button
                      type="button"
                      disabled={!gatewayAvailability.onelink}
                      onClick={() => handlePayWithGateway("onelink")}
                      className="w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <CreditCard className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">OneLink</p>
                        <p className="text-[11px] text-muted-foreground">
                          {gatewayAvailability.onelink ? "Pay from any bank, via 1LINK OneLink" : "Not set up by the school yet"}
                        </p>
                      </div>
                    </button>
                    {!gatewayAvailability.onelink && (
                      <p className="text-[11px] text-muted-foreground pt-1">
                        Online payment isn't available yet — please pay at the school office in the meantime.
                      </p>
                    )}
                  </div>

                  <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                    <Button type="button" variant="outline" onClick={() => setCheckoutVoucher(null)}>Cancel</Button>
                  </DialogFooter>
                </div>
              )}
              {checkoutStep === "processing" && (
                <div className="py-12 flex flex-col items-center space-y-4 text-center">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <p className="text-sm font-semibold text-primary">
                    Redirecting to OneLink...
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Apply Discount Dialog ── */}
      <Dialog open={!!discountTarget} onOpenChange={() => setDiscountTarget(null)}>
        <DialogContent className="max-w-md border-secondary">
          {discountTarget && (
            <form onSubmit={handleApplyDiscount}>
              <DialogHeader>
                <DialogTitle className="font-headline font-bold text-primary flex items-center gap-2"><Tag className="h-5 w-5 text-green-600" /> Apply Discount</DialogTitle>
                <DialogDescription>{discountTarget.studentName} · {discountTarget.voucherId} · Gross: Rs. {discountTarget.amount.toLocaleString()}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select value={discountForm.type} onValueChange={val => setDiscountForm({ ...discountForm, type: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Amount (Rs.)</SelectItem>
                      <SelectItem value="percent">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{discountForm.type === "fixed" ? "Discount Amount (Rs.)" : "Discount Percentage (%)"}</Label>
                  <div className="relative">
                    {discountForm.type === "fixed"
                      ? <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-medium">Rs.</span>
                      : <Percent className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />}
                    <Input type="number" min="0" max={discountForm.type === "percent" ? "100" : String(discountTarget.amount)}
                      step="0.01" value={discountForm.value}
                      onChange={e => setDiscountForm({ ...discountForm, value: e.target.value })}
                      className="pl-10" placeholder="0" />
                  </div>
                  {discountForm.value && (
                    <p className="text-xs text-muted-foreground">
                      Net after discount: Rs. {Math.max(0, (discountTarget.amount - (discountForm.type === "percent"
                        ? (discountTarget.amount * Number(discountForm.value)) / 100
                        : Number(discountForm.value)))).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea placeholder="e.g. Sibling discount, Merit scholarship..." value={discountForm.reason}
                    onChange={e => setDiscountForm({ ...discountForm, reason: e.target.value })} rows={2} />
                </div>
              </div>
              <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                <Button type="button" variant="outline" onClick={() => setDiscountTarget(null)}>Cancel</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">Apply Discount</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Partial Payment Dialog ── */}
      <Dialog open={!!partialTarget} onOpenChange={() => setPartialTarget(null)}>
        <DialogContent className="max-w-md border-secondary">
          {partialTarget && (
            <form onSubmit={handlePartialPayment}>
              <DialogHeader>
                <DialogTitle className="font-headline font-bold text-primary flex items-center gap-2"><DollarSign className="h-5 w-5 text-amber-600" /> Record Partial Payment</DialogTitle>
                <DialogDescription>{partialTarget.studentName} · {partialTarget.voucherId} · Remaining: Rs. {netDue(partialTarget).toLocaleString()}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm space-y-1">
                  <div className="flex justify-between text-amber-800"><span>Gross Amount:</span><span>Rs. {partialTarget.amount.toLocaleString()}</span></div>
                  {(partialTarget.discount || 0) > 0 && <div className="flex justify-between text-green-700"><span>Discount:</span><span>-Rs. {partialTarget.discount!.toLocaleString()}</span></div>}
                  {(partialTarget.amountPaid || 0) > 0 && <div className="flex justify-between text-amber-700"><span>Previously Paid:</span><span>Rs. {partialTarget.amountPaid!.toLocaleString()}</span></div>}
                  <div className="flex justify-between font-bold border-t border-amber-200 pt-1 text-amber-900"><span>Balance Due:</span><span>Rs. {netDue(partialTarget).toLocaleString()}</span></div>
                </div>
                <div className="space-y-2">
                  <Label>Amount Being Paid (Rs.)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-medium">Rs.</span>
                    <Input type="number" min="1" max={netDue(partialTarget)} step="1" value={partialForm.amount}
                      onChange={e => setPartialForm({ ...partialForm, amount: e.target.value })} className="pl-10" placeholder="0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={partialForm.method} onValueChange={val => setPartialForm({ ...partialForm, method: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Online">Online</SelectItem>
                      <SelectItem value="JazzCash">JazzCash</SelectItem>
                      <SelectItem value="EasyPaisa">EasyPaisa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                <Button type="button" variant="outline" onClick={() => setPartialTarget(null)}>Cancel</Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white">Record Payment</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Update Payment Dialog ── */}
      <Dialog open={!!updatePayTarget} onOpenChange={() => setUpdatePayTarget(null)}>
        <DialogContent className="max-w-sm border-secondary">
          {updatePayTarget && (
            <form onSubmit={handleUpdatePayment}>
              <DialogHeader>
                <DialogTitle className="font-headline font-bold text-primary flex items-center gap-2"><Pencil className="h-5 w-5 text-blue-600" /> Update Payment</DialogTitle>
                <DialogDescription>{updatePayTarget.studentName} · {updatePayTarget.voucherId}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={updatePayForm.method} onValueChange={val => setUpdatePayForm({ ...updatePayForm, method: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Online">Online</SelectItem>
                      <SelectItem value="JazzCash">JazzCash</SelectItem>
                      <SelectItem value="EasyPaisa">EasyPaisa</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={updatePayForm.date} onChange={e => setUpdatePayForm({ ...updatePayForm, date: e.target.value })} />
                </div>
              </div>
              <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                <Button type="button" variant="outline" onClick={() => setUpdatePayTarget(null)}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Update Payment</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Regenerate Voucher Dialog ── */}
      <Dialog open={!!regenTarget} onOpenChange={() => setRegenTarget(null)}>
        <DialogContent className="max-w-md border-secondary">
          {regenTarget && (
            <form onSubmit={handleRegenerate}>
              <DialogHeader>
                <DialogTitle className="font-headline font-bold text-primary flex items-center gap-2"><RefreshCw className="h-5 w-5 text-purple-600" /> Regenerate Voucher</DialogTitle>
                <DialogDescription>{regenTarget.studentName} · {regenTarget.voucherId} — Updates fee details and resets status to Unpaid.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[65vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Month</Label>
                    <Input type="month" value={regenData.month} onChange={e => setRegenData({ ...regenData, month: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>New Due Date</Label>
                    <Input type="date" value={regenData.dueDate} onChange={e => setRegenData({ ...regenData, dueDate: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Fee Line Items</Label>
                  <div className="space-y-2">
                    {regenItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input placeholder="Description" value={item.description}
                          onChange={e => updateRegenItem(idx, "description", e.target.value)}
                          className="flex-1 h-9 text-sm" />
                        <div className="relative w-32">
                          <span className="absolute left-3 top-2 text-xs text-muted-foreground font-medium">Rs.</span>
                          <Input type="number" placeholder="0" value={item.amount}
                            onChange={e => updateRegenItem(idx, "amount", e.target.value)}
                            className="pl-9 h-9 text-sm" min="0" />
                        </div>
                        {regenItems.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-500 hover:bg-red-50" onClick={() => removeRegenItem(idx)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addRegenItem} className="gap-1 h-8 text-xs border-dashed">
                    <Plus className="h-3 w-3" /> Add Item
                  </Button>
                  {regenTotal > 0 && (
                    <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <span className="text-sm font-semibold text-purple-700">New Total</span>
                      <span className="text-base font-bold text-purple-700">Rs. {regenTotal.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                <Button type="button" variant="outline" onClick={() => setRegenTarget(null)}>Cancel</Button>
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white" disabled={regenTotal === 0}>
                  Regenerate
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Fee Structure Add/Edit Dialog ── */}
      <Dialog open={structureDialogOpen} onOpenChange={setStructureDialogOpen}>
        <DialogContent className="max-w-lg border-secondary">
          <form onSubmit={handleSaveStructure}>
            <DialogHeader>
              <DialogTitle className="font-headline font-bold text-primary flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" /> {editingStructure ? "Edit Fee Structure" : "New Fee Structure"}
              </DialogTitle>
              <DialogDescription>Define a reusable fee template with line items for a class or all students.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Structure Name</Label>
                  <Input placeholder="e.g. Grade 10 Monthly Fee" value={structureForm.name}
                    onChange={e => setStructureForm({ ...structureForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Assigned Class</Label>
                  <Select value={structureForm.assignedClassId || "ALL"} onValueChange={val => setStructureForm({ ...structureForm, assignedClassId: val === "ALL" ? "" : val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Classes</SelectItem>
                      {relClasses.map(cls => <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={structureForm.isActive ? "active" : "inactive"} onValueChange={val => setStructureForm({ ...structureForm, isActive: val === "active" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Fee Line Items</Label>
                <div className="space-y-2">
                  {structureForm.lineItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input placeholder="Description (e.g. Tuition Fee)" value={item.description}
                        onChange={e => updateStructureLineItem(idx, "description", e.target.value)}
                        className="flex-1 h-9 text-sm" />
                      <div className="relative w-32">
                        <span className="absolute left-3 top-2 text-xs text-muted-foreground font-medium">Rs.</span>
                        <Input type="number" placeholder="0" value={item.amount}
                          onChange={e => updateStructureLineItem(idx, "amount", e.target.value)}
                          className="pl-9 h-9 text-sm" min="0" />
                      </div>
                      {structureForm.lineItems.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-500 hover:bg-red-50" onClick={() => removeStructureLineItem(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addStructureLineItem} className="gap-1 h-8 text-xs border-dashed">
                  <Plus className="h-3 w-3" /> Add Item
                </Button>
                {structureTotal > 0 && (
                  <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <span className="text-sm font-semibold text-primary">Total Amount</span>
                    <span className="text-base font-bold text-primary">Rs. {structureTotal.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
              <Button type="button" variant="outline" onClick={() => setStructureDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={structureTotal === 0}>
                {editingStructure ? "Save Changes" : "Create Structure"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
