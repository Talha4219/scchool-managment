"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppState } from "@/lib/state-context";
import { formatDatePK } from "@/lib/date-format";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import {
  fetchAccountEntriesDB, createAccountEntryDB, fetchBudgetAllocationsDB,
} from "@/app/actions/features";
import type { AccountEntry, BudgetAllocation } from "@/lib/types";
import {
  DollarSign, TrendingUp, TrendingDown, PiggyBank, Plus, Receipt,
  ArrowUpDown, Wallet, Building2, Banknote, Landmark, BanknoteIcon, Download,
} from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";

const CATEGORIES = [
  "Tuition Fees", "Admission Fees", "Transport Fees", "Library Fees",
  "Lab Fees", "Sports Fees", "Hostel Fees", "Exam Fees",
  "Salaries", "Utilities", "Maintenance", "Supplies",
  "Equipment", "Travel", "Marketing", "Other",
];

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Credit Card", "Online Payment", "Mobile Wallet"];

function formatCurrency(n: number) {
  return "Rs. " + n.toLocaleString();
}

function formatDate(d: string) {
  // formatDatePK reads YYYY-MM-DD strings via regex, never through
  // `new Date()` + local getters — so it's inherently immune to the
  // server/client timezone hydration mismatch that a UTC-pinned
  // toLocaleDateString call was previously guarding against here.
  return formatDatePK(d);
}

const entryTypeConfig = {
  Income: { class: "bg-green-50 text-green-700 border-green-200", icon: TrendingUp },
  Expense: { class: "bg-red-50 text-red-700 border-red-200", icon: TrendingDown },
};

export default function AccountingPage() {
  const { activeRole, schoolInfo } = useAppState();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();
  const [entries, setEntries] = useState<AccountEntry[]>([]);
  const [budgets, setBudgets] = useState<BudgetAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"All" | "Income" | "Expense">("All");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    type: "Income" as "Income" | "Expense",
    category: "", description: "", amount: "",
    paymentMethod: "Cash", reference: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [entriesData, budgetsData] = await Promise.all([
      fetchAccountEntriesDB(),
      fetchBudgetAllocationsDB(),
    ]);
    setEntries(entriesData);
    setBudgets(budgetsData);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayEntries = typeFilter === "All" ? entries : entries.filter(e => e.type === typeFilter);

  const totalIncome = entries.filter(e => e.type === "Income").reduce((s, e) => s + e.amount, 0);
  const totalExpenses = entries.filter(e => e.type === "Expense").reduce((s, e) => s + e.amount, 0);
  const netBalance = totalIncome - totalExpenses;
  const totalAllocated = budgets.reduce((s, b) => s + b.allocatedAmount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spentAmount, 0);
  const budgetUtilization = totalAllocated > 0 ? ((totalSpent / totalAllocated) * 100).toFixed(1) : "0.0";

  const handleCreate = async () => {
    if (!form.category || !form.description || !form.amount || Number(form.amount) <= 0) {
      toast({ title: "All fields required.", variant: "destructive" }); return;
    }
    const res = await createAccountEntryDB({
      date: new Date().toISOString().split("T")[0],
      type: form.type, category: form.category, description: form.description,
      amount: Number(form.amount), paymentMethod: form.paymentMethod,
      reference: form.reference, createdBy: activeRole || "Admin",
    });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: `${form.type} entry recorded.` });
    setCreateOpen(false);
    setForm({ type: "Income", category: "", description: "", amount: "", paymentMethod: "Cash", reference: "" });
    load();
  };

  if (!permsLoaded) return null;
  if (!can("accounting.view")) return <Unauthorized />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Accounting</h1>
          <p className="text-muted-foreground mt-1">Financial tracking, income/expense management for {schoolInfo.name}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 gap-2"><Plus className="h-4 w-4" /> Add Entry</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg border-secondary">
            <DialogHeader>
              <DialogTitle className="font-headline font-bold text-primary">New Account Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Income", "Expense"] as const).map(t => (
                      <button key={t} type="button"
                        onClick={() => setForm(f => ({ ...f, type: t }))}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${form.type === t ? "bg-primary text-white border-primary" : "border-secondary text-muted-foreground hover:border-primary/50"}`}>
                        {t === "Income" ? <TrendingUp className="h-3.5 w-3.5 inline mr-1" /> : <TrendingDown className="h-3.5 w-3.5 inline mr-1" />}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Entry description..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (Rs.)</Label>
                  <Input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reference (optional)</Label>
                <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Invoice/Receipt #" />
              </div>
            </div>
            <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="bg-primary hover:bg-primary/90" onClick={handleCreate}>Record Entry</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-none shadow-sm bg-[#0B1B3D] text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-white/10"><TrendingUp className="h-6 w-6 text-green-300" /></div>
              <div>
                <p className="text-white/60 text-sm font-medium">Total Income</p>
                <h3 className="text-2xl font-bold">{formatCurrency(totalIncome)}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-50"><TrendingDown className="h-6 w-6 text-red-500" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Total Expenses</p>
                <h3 className="text-2xl font-bold">{formatCurrency(totalExpenses)}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${netBalance >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                <PiggyBank className={`h-6 w-6 ${netBalance >= 0 ? "text-green-600" : "text-red-600"}`} />
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Net Balance</p>
                <h3 className={`text-2xl font-bold ${netBalance >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(netBalance)}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-indigo-50"><Building2 className="h-6 w-6 text-indigo-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Budget Utilized</p>
                <h3 className="text-2xl font-bold">{budgetUtilization}%</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="transactions" className="gap-2"><Receipt className="h-4 w-4" /> Transactions</TabsTrigger>
          <TabsTrigger value="budget" className="gap-2"><Building2 className="h-4 w-4" /> Budget</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 border-b border-secondary/50">
              <div>
                <CardTitle className="text-lg">Account Entries</CardTitle>
                <CardDescription>All income and expense records</CardDescription>
              </div>
              <div className="flex gap-1 flex-wrap items-center">
                {(["All", "Income", "Expense"] as const).map(s => (
                  <Button key={s} size="sm" variant={typeFilter === s ? "default" : "outline"}
                    className={`h-7 text-xs ${typeFilter === s ? "bg-primary" : ""}`}
                    onClick={() => setTypeFilter(s)}>{s}</Button>
                ))}
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
                  exportToCsv("account-entries", ["Date", "Type", "Category", "Description", "Amount", "Payment Method", "Reference", "Created By"],
                    displayEntries.map(e => [e.date, e.type, e.category, e.description, e.amount, e.paymentMethod, e.reference, e.createdBy]));
                }}>
                  <Download className="h-3 w-3" /> Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold py-4">Date</TableHead>
                    <TableHead className="font-bold">Type</TableHead>
                    <TableHead className="font-bold">Category</TableHead>
                    <TableHead className="font-bold">Description</TableHead>
                    <TableHead className="font-bold text-right">Amount</TableHead>
                    <TableHead className="font-bold">Payment</TableHead>
                    <TableHead className="font-bold">Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <>{[1,2,3,4].map(i => <TableRow key={i}>{[24,16,20,40,20,16,20].map((w,j) => <TableCell key={j} className={j===4?"text-right":""}><Skeleton className={`h-4 w-${w}`} /></TableCell>)}</TableRow>)}</>
                  ) : displayEntries.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No entries found.</TableCell></TableRow>
                  ) : displayEntries.map(e => {
                    const cfg = entryTypeConfig[e.type];
                    const Icon = cfg?.icon;
                    return (
                      <TableRow key={e.id} className="hover:bg-secondary/5 transition-colors">
                        <TableCell className="text-xs text-muted-foreground font-mono">{formatDate(e.date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${cfg?.class ?? ""} border-0 text-xs`}>
                            {Icon && <Icon className="h-3 w-3 mr-1" />}{e.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{e.category}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{e.description}</TableCell>
                        <TableCell className={`text-right font-bold ${e.type === "Income" ? "text-green-700" : "text-red-700"}`}>
                          {formatCurrency(e.amount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.paymentMethod}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{e.reference || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">Budget Allocations</CardTitle>
              <CardDescription>Department-wise budget planning and utilization</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold py-4">Department</TableHead>
                    <TableHead className="font-bold">Category</TableHead>
                    <TableHead className="font-bold text-right">Allocated</TableHead>
                    <TableHead className="font-bold text-right">Spent</TableHead>
                    <TableHead className="font-bold text-right">Remaining</TableHead>
                    <TableHead className="font-bold">Utilization</TableHead>
                    <TableHead className="font-bold">Fiscal Year</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No budget allocations found.</TableCell></TableRow>
                  ) : budgets.map(b => {
                    const remaining = b.allocatedAmount - b.spentAmount;
                    const pct = b.allocatedAmount > 0 ? ((b.spentAmount / b.allocatedAmount) * 100).toFixed(1) : "0";
                    const pctNum = parseFloat(pct);
                    return (
                      <TableRow key={b.id} className="hover:bg-secondary/5 transition-colors">
                        <TableCell className="font-semibold text-primary">{b.department}</TableCell>
                        <TableCell className="text-muted-foreground">{b.category}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(b.allocatedAmount)}</TableCell>
                        <TableCell className="text-right font-bold text-orange-600">{formatCurrency(b.spentAmount)}</TableCell>
                        <TableCell className={`text-right font-bold ${remaining >= 0 ? "text-green-700" : "text-red-700"}`}>
                          {formatCurrency(remaining)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pctNum > 90 ? "bg-red-500" : pctNum > 70 ? "bg-orange-500" : "bg-green-500"}`}
                                style={{ width: `${Math.min(pctNum, 100)}%` }} />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{b.fiscalYear}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
