"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppState } from "@/lib/state-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import {
  fetchEmployeesDB, fetchSalaryStructuresDB, createSalaryStructureDB,
  fetchPayslipsDB, generatePayslipDB,
} from "@/app/actions/features";
import type { EmployeeRecord, SalaryStructure, Payslip, PayrollAllowance, PayrollDeduction } from "@/lib/types";
import {
  Wallet, FileText, Clock, Plus, Search, DollarSign, PiggyBank,
  Receipt, Banknote, Loader2, Lock, X, Eye, Download,
} from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";

const statusBadge: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-800",
  Generated: "bg-blue-100 text-blue-800",
  Paid: "bg-green-100 text-green-800",
  Active: "bg-green-100 text-green-800",
  Inactive: "bg-gray-100 text-gray-800",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function StatCard({ label, value, icon: Icon, iconBg, iconColor }: {
  label: string; value: string | number; icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-xl ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
          <h3 className="text-2xl font-bold mt-0.5 text-primary">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}

function AllowanceRow({ item, index, onChange, onRemove }: {
  item: PayrollAllowance; index: number;
  onChange: (i: number, f: Partial<PayrollAllowance>) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 space-y-1">
        <Label className="text-xs">Name</Label>
        <Input value={item.name} onChange={e => onChange(index, { name: e.target.value })} placeholder="e.g. HRA" />
      </div>
      <div className="w-28 space-y-1">
        <Label className="text-xs">Amount</Label>
        <Input type="number" value={item.amount} onChange={e => onChange(index, { amount: Number(e.target.value) })} />
      </div>
      <div className="w-28 space-y-1">
        <Label className="text-xs">Type</Label>
        <Select value={item.type} onValueChange={v => onChange(index, { type: v as "Fixed" | "Percentage" })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Fixed">Fixed</SelectItem>
            <SelectItem value="Percentage">Percentage</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="button" variant="ghost" size="icon" className="text-red-500 shrink-0" onClick={() => onRemove(index)}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function DeductionRow({ item, index, onChange, onRemove }: {
  item: PayrollDeduction; index: number;
  onChange: (i: number, f: Partial<PayrollDeduction>) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 space-y-1">
        <Label className="text-xs">Name</Label>
        <Input value={item.name} onChange={e => onChange(index, { name: e.target.value })} placeholder="e.g. Tax" />
      </div>
      <div className="w-28 space-y-1">
        <Label className="text-xs">Amount</Label>
        <Input type="number" value={item.amount} onChange={e => onChange(index, { amount: Number(e.target.value) })} />
      </div>
      <div className="w-28 space-y-1">
        <Label className="text-xs">Type</Label>
        <Select value={item.type} onValueChange={v => onChange(index, { type: v as "Fixed" | "Percentage" })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Fixed">Fixed</SelectItem>
            <SelectItem value="Percentage">Percentage</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="button" variant="ghost" size="icon" className="text-red-500 shrink-0" onClick={() => onRemove(index)}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SalaryStructureDialog({ open, onOpenChange, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (data: Omit<SalaryStructure, "id">) => Promise<void>;
}) {
  const blank = {
    name: "", employeeId: 0, employeeName: "", basicSalary: 0,
    allowances: [] as PayrollAllowance[], deductions: [] as PayrollDeduction[],
    totalSalary: 0, isActive: true,
  };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(blank); }, [open]);

  const calcTotal = (b: number, al: PayrollAllowance[], de: PayrollDeduction[]) => {
    const totalAll = al.reduce((s, a) => a.type === "Fixed" ? s + a.amount : s + (b * a.amount / 100), 0);
    const totalDed = de.reduce((s, d) => d.type === "Fixed" ? s + d.amount : s + (b * d.amount / 100), 0);
    return b + totalAll - totalDed;
  };

  const setBasic = (v: number) => {
    const newForm = { ...form, basicSalary: v };
    newForm.totalSalary = calcTotal(v, newForm.allowances, newForm.deductions);
    setForm(newForm);
  };

  const setAllowance = (i: number, f: Partial<PayrollAllowance>) => {
    const al = [...form.allowances];
    al[i] = { ...al[i], ...f };
    const newForm = { ...form, allowances: al };
    newForm.totalSalary = calcTotal(newForm.basicSalary, al, newForm.deductions);
    setForm(newForm);
  };

  const addAllowance = () => setForm(p => {
    const al = [...p.allowances, { name: "", amount: 0, type: "Fixed" as const }];
    return { ...p, allowances: al, totalSalary: calcTotal(p.basicSalary, al, p.deductions) };
  });

  const removeAllowance = (i: number) => setForm(p => {
    const al = p.allowances.filter((_, idx) => idx !== i);
    return { ...p, allowances: al, totalSalary: calcTotal(p.basicSalary, al, p.deductions) };
  });

  const setDeduction = (i: number, f: Partial<PayrollDeduction>) => {
    const de = [...form.deductions];
    de[i] = { ...de[i], ...f };
    const newForm = { ...form, deductions: de };
    newForm.totalSalary = calcTotal(newForm.basicSalary, newForm.allowances, de);
    setForm(newForm);
  };

  const addDeduction = () => setForm(p => {
    const de = [...p.deductions, { name: "", amount: 0, type: "Fixed" as const }];
    return { ...p, deductions: de, totalSalary: calcTotal(p.basicSalary, p.allowances, de) };
  });

  const removeDeduction = (i: number) => setForm(p => {
    const de = p.deductions.filter((_, idx) => idx !== i);
    return { ...p, deductions: de, totalSalary: calcTotal(p.basicSalary, p.allowances, de) };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSubmit(form as Omit<SalaryStructure, "id">);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Salary Structure</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Structure Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Employee Name</Label>
              <Input value={form.employeeName} onChange={e => setForm(p => ({ ...p, employeeName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input type="number" value={form.employeeId || ""} onChange={e => setForm(p => ({ ...p, employeeId: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label>Basic Salary</Label>
              <Input type="number" value={form.basicSalary || ""} onChange={e => setBasic(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Allowances</Label>
              <Button type="button" size="sm" variant="outline" onClick={addAllowance}>
                <Plus className="h-3 w-3 mr-1" />Add
              </Button>
            </div>
            <div className="space-y-2">
              {form.allowances.map((a, i) => (
                <AllowanceRow key={i} item={a} index={i} onChange={setAllowance} onRemove={removeAllowance} />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Deductions</Label>
              <Button type="button" size="sm" variant="outline" onClick={addDeduction}>
                <Plus className="h-3 w-3 mr-1" />Add
              </Button>
            </div>
            <div className="space-y-2">
              {form.deductions.map((d, i) => (
                <DeductionRow key={i} item={d} index={i} onChange={setDeduction} onRemove={removeDeduction} />
              ))}
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Salary</p>
            <p className="text-2xl font-bold text-primary">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(form.totalSalary)}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GeneratePayslipDialog({ open, onOpenChange, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (data: Omit<Payslip, "id">) => Promise<void>;
}) {
  const [employeeName, setEmployeeName] = useState("");
  const [employeeId, setEmployeeId] = useState(0);
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [basicSalary, setBasicSalary] = useState(0);
  const [allowances, setAllowances] = useState<PayrollAllowance[]>([]);
  const [deductions, setDeductions] = useState<PayrollDeduction[]>([]);
  const [taxAmount, setTaxAmount] = useState(0);
  const [overtimePay, setOvertimePay] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEmployeeName("");
      setEmployeeId(0);
      setMonth(MONTHS[new Date().getMonth()]);
      setYear(new Date().getFullYear());
      setBasicSalary(0);
      setAllowances([]);
      setDeductions([]);
      setTaxAmount(0);
      setOvertimePay(0);
    }
  }, [open]);

  const totalAllowances = allowances.reduce((s, a) => a.type === "Fixed" ? s + a.amount : s + (basicSalary * a.amount / 100), 0);
  const totalDeductions = deductions.reduce((s, d) => d.type === "Fixed" ? s + d.amount : s + (basicSalary * d.amount / 100), 0);
  const grossPay = basicSalary + totalAllowances;
  const netPay = grossPay - totalDeductions - taxAmount + overtimePay;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSubmit({
      employeeId, employeeName, month, year, basicSalary, allowances, deductions,
      grossPay, totalDeductions, netPay, taxAmount, overtimePay,
      status: "Generated", generatedAt: new Date().toISOString().split("T")[0],
    });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Payslip</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Employee Name</Label>
              <Input value={employeeName} onChange={e => setEmployeeName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input type="number" value={employeeId || ""} onChange={e => setEmployeeId(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Basic Salary</Label>
              <Input type="number" value={basicSalary || ""} onChange={e => setBasicSalary(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Tax Amount</Label>
              <Input type="number" value={taxAmount || ""} onChange={e => setTaxAmount(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Overtime Pay</Label>
              <Input type="number" value={overtimePay || ""} onChange={e => setOvertimePay(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Allowances</Label>
            {allowances.map((a, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={a.name} onChange={e => {
                    const al = [...allowances]; al[i] = { ...al[i], name: e.target.value }; setAllowances(al);
                  }} />
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <Input type="number" value={a.amount || ""} onChange={e => {
                    const al = [...allowances]; al[i] = { ...al[i], amount: Number(e.target.value) }; setAllowances(al);
                  }} />
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={a.type} onValueChange={v => {
                    const al = [...allowances]; al[i] = { ...al[i], type: v as "Fixed" | "Percentage" }; setAllowances(al);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fixed">Fixed</SelectItem>
                      <SelectItem value="Percentage">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="ghost" size="icon" className="text-red-500" onClick={() => setAllowances(allowances.filter((_, idx) => idx !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setAllowances([...allowances, { name: "", amount: 0, type: "Fixed" }])}>
              <Plus className="h-3 w-3 mr-1" />Add Allowance
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Deductions</Label>
            {deductions.map((d, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={d.name} onChange={e => {
                    const de = [...deductions]; de[i] = { ...de[i], name: e.target.value }; setDeductions(de);
                  }} />
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <Input type="number" value={d.amount || ""} onChange={e => {
                    const de = [...deductions]; de[i] = { ...de[i], amount: Number(e.target.value) }; setDeductions(de);
                  }} />
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={d.type} onValueChange={v => {
                    const de = [...deductions]; de[i] = { ...de[i], type: v as "Fixed" | "Percentage" }; setDeductions(de);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fixed">Fixed</SelectItem>
                      <SelectItem value="Percentage">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="ghost" size="icon" className="text-red-500" onClick={() => setDeductions(deductions.filter((_, idx) => idx !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setDeductions([...deductions, { name: "", amount: 0, type: "Fixed" }])}>
              <Plus className="h-3 w-3 mr-1" />Add Deduction
            </Button>
          </div>

          <div className="bg-secondary/30 rounded-lg p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span>Basic Salary</span><span className="font-medium">{basicSalary.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Total Allowances</span><span className="font-medium text-green-600">+{totalAllowances.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Gross Pay</span><span className="font-medium">{grossPay.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Total Deductions</span><span className="font-medium text-red-600">-{totalDeductions.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Tax</span><span className="font-medium text-red-600">-{taxAmount.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Overtime</span><span className="font-medium text-green-600">+{overtimePay.toLocaleString()}</span></div>
            <div className="border-t pt-1 flex justify-between font-bold text-base">
              <span>Net Pay</span><span className="text-primary">{netPay.toLocaleString()}</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PayslipDetailsDialog({ payslip, open, onOpenChange }: {
  payslip: Payslip | null; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  if (!payslip) return null;
  const totalAllowances = payslip.allowances.reduce((s, a) => a.type === "Fixed" ? s + a.amount : s + (payslip.basicSalary * a.amount / 100), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Payslip Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Employee:</span> <span className="font-medium">{payslip.employeeName}</span></div>
            <div><span className="text-muted-foreground">Period:</span> <span className="font-medium">{payslip.month} {payslip.year}</span></div>
            <div><span className="text-muted-foreground">Status:</span> <Badge className={statusBadge[payslip.status]}>{payslip.status}</Badge></div>
            <div><span className="text-muted-foreground">Generated:</span> <span className="font-medium">{payslip.generatedAt}</span></div>
          </div>

          <div className="border-t pt-3">
            <h4 className="font-semibold text-sm mb-2">Allowances</h4>
            {payslip.allowances.length === 0 ? (
              <p className="text-xs text-muted-foreground">None</p>
            ) : (
              <div className="space-y-1 text-sm">
                {payslip.allowances.map((a, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{a.name} ({a.type})</span>
                    <span className="text-green-600">+{a.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-3">
            <h4 className="font-semibold text-sm mb-2">Deductions</h4>
            {payslip.deductions.length === 0 ? (
              <p className="text-xs text-muted-foreground">None</p>
            ) : (
              <div className="space-y-1 text-sm">
                {payslip.deductions.map((d, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{d.name} ({d.type})</span>
                    <span className="text-red-600">-{d.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Basic Salary</span><span>{payslip.basicSalary.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Total Allowances</span><span className="text-green-600">+{totalAllowances.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Gross Pay</span><span className="font-medium">{payslip.grossPay.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Total Deductions</span><span className="text-red-600">-{payslip.totalDeductions.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Tax</span><span className="text-red-600">-{payslip.taxAmount.toLocaleString()}</span></div>
            {payslip.overtimePay > 0 && (
              <div className="flex justify-between"><span>Overtime</span><span className="text-green-600">+{payslip.overtimePay.toLocaleString()}</span></div>
            )}
            <div className="border-t pt-1 flex justify-between font-bold text-base">
              <span>Net Pay</span><span className="text-primary">{payslip.netPay.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PayrollPage() {
  const { activeRole } = useAppState();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();

  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [viewPayslip, setViewPayslip] = useState<Payslip | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [strs, pslips] = await Promise.all([fetchSalaryStructuresDB(), fetchPayslipsDB()]);
    setStructures(strs);
    setPayslips(pslips);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateStructure = async (data: Omit<SalaryStructure, "id">) => {
    const res = await createSalaryStructureDB(data);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Salary structure created." });
    setStructureDialogOpen(false);
    load();
  };

  const handleGeneratePayslip = async (data: Omit<Payslip, "id">) => {
    const res = await generatePayslipDB(data);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Payslip generated." });
    setGenerateDialogOpen(false);
    load();
  };

  const filteredStructures = structures.filter(s =>
    s.employeeName.toLowerCase().includes(search.toLowerCase())
  );
  const filteredPayslips = payslips.filter(p =>
    p.employeeName.toLowerCase().includes(search.toLowerCase())
  );

  const totalPayroll = structures.reduce((s, st) => s + st.totalSalary, 0);
  const activeStructures = structures.filter(s => s.isActive).length;
  const pendingPayslips = payslips.filter(p => p.status === "Draft").length;

  const currency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (!permsLoaded) return null;
  if (!can("payroll.view")) return <Unauthorized />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Payroll Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage salary structures and payslips</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Payroll" value={currency(totalPayroll)} icon={Wallet} iconBg="bg-green-100" iconColor="text-green-600" />
        <StatCard label="Active Structures" value={activeStructures} icon={FileText} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard label="Pending Payslips" value={pendingPayslips} icon={Clock} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
        <StatCard label="Total Payslips" value={payslips.length} icon={Receipt} iconBg="bg-purple-100" iconColor="text-purple-600" />
      </div>

      <Tabs defaultValue="structures" className="space-y-4">
        <TabsList>
          <TabsTrigger value="structures">Salary Structures</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
        </TabsList>

        <TabsContent value="structures" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search structures..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Dialog open={structureDialogOpen} onOpenChange={setStructureDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Create Structure</Button>
              </DialogTrigger>
              <SalaryStructureDialog
                open={structureDialogOpen}
                onOpenChange={setStructureDialogOpen}
                onSubmit={handleCreateStructure}
              />
            </Dialog>
          </div>

          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Basic Salary</TableHead>
                    <TableHead>Allowances</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStructures.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {loading ? <><Skeleton className="h-4 w-24 mx-auto" /><Skeleton className="h-3 w-16 mx-auto mt-1" /></> : "No salary structures found."}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredStructures.map(st => (
                    <TableRow key={st.id}>
                      <TableCell className="font-medium">{st.employeeName}</TableCell>
                      <TableCell>{currency(st.basicSalary)}</TableCell>
                      <TableCell>
                        {st.allowances.map((a, i) => (
                          <span key={i} className="text-xs text-green-600 block">{a.name}: +{a.amount} ({a.type})</span>
                        ))}
                        {st.allowances.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                      </TableCell>
                      <TableCell>
                        {st.deductions.map((d, i) => (
                          <span key={i} className="text-xs text-red-600 block">{d.name}: -{d.amount} ({d.type})</span>
                        ))}
                        {st.deductions.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                      </TableCell>
                      <TableCell className="font-bold">{currency(st.totalSalary)}</TableCell>
                      <TableCell>
                        <Badge className={statusBadge[st.isActive ? "Active" : "Inactive"]}>
                          {st.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payslips" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search payslips..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                exportToCsv("payslips", ["Employee", "Month", "Year", "Basic Salary", "Gross Pay", "Deductions", "Net Pay", "Status"],
                  filteredPayslips.map(p => [p.employeeName, p.month, p.year, p.basicSalary, p.grossPay, p.totalDeductions, p.netPay, p.status]));
              }}>
                <Download className="mr-2 h-4 w-4" />Export
              </Button>
              <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />Generate Payslip</Button>
                </DialogTrigger>
                <GeneratePayslipDialog
                  open={generateDialogOpen}
                  onOpenChange={setGenerateDialogOpen}
                  onSubmit={handleGeneratePayslip}
                />
              </Dialog>
            </div>
          </div>

          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Basic</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayslips.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {loading ? <><Skeleton className="h-4 w-24 mx-auto" /><Skeleton className="h-3 w-16 mx-auto mt-1" /></> : "No payslips found."}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredPayslips.map(ps => (
                    <TableRow key={ps.id}>
                      <TableCell className="font-medium">{ps.employeeName}</TableCell>
                      <TableCell className="text-sm">{ps.month} {ps.year}</TableCell>
                      <TableCell>{currency(ps.basicSalary)}</TableCell>
                      <TableCell>{currency(ps.grossPay)}</TableCell>
                      <TableCell>{currency(ps.totalDeductions)}</TableCell>
                      <TableCell>{currency(ps.taxAmount)}</TableCell>
                      <TableCell className="font-bold">{currency(ps.netPay)}</TableCell>
                      <TableCell>
                        <Badge className={statusBadge[ps.status]}>{ps.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => { setViewPayslip(ps); setViewDialogOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <PayslipDetailsDialog payslip={viewPayslip} open={viewDialogOpen} onOpenChange={setViewDialogOpen} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
