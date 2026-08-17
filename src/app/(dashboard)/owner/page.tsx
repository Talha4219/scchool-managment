"use client";

import { useState, useEffect, useCallback } from "react";
import { getSession } from "@/app/actions/auth";
import {
  fetchBranchSummariesDB, fetchBranchComparisonDB, fetchOwnerAlertsDB,
  fetchAttendanceTrendDB, fetchChronicAbsenteesDB, fetchFeeAgingDB,
  fetchStaffCoverageTodayDB, fetchAtRiskStudentsSummaryDB, fetchAtRiskStudentsListDB,
  fetchLowStockItemsDB,
  createBranchDB, assignPrincipalDB, fetchUnassignedPrincipalsDB,
  type BranchSummary, type BranchComparisonRow, type OwnerAlert, type AttendanceTrendPoint,
  type ChronicAbsentee, type FeeAgingRow, type StaffCoverageRow, type AtRiskSummaryRow,
  type AtRiskStudent, type LowStockItem,
} from "@/app/actions/branches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Unauthorized } from "@/components/unauthorized";
import {
  Building2, Users, GraduationCap, Wallet, CalendarCheck, Plus, Crown,
  AlertTriangle, AlertCircle, CheckCircle2, ArrowUpDown, Package, FileWarning,
} from "lucide-react";

const RS = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

function statusDot(pct: number | null, goodAt = 95, warnAt = 88) {
  if (pct === null) return "bg-muted-foreground/30";
  if (pct >= goodAt) return "bg-green-500";
  if (pct >= warnAt) return "bg-amber-500";
  return "bg-red-500";
}

export default function OwnerDashboardPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [comparison, setComparison] = useState<BranchComparisonRow[]>([]);
  const [alerts, setAlerts] = useState<OwnerAlert[]>([]);
  const [trend, setTrend] = useState<AttendanceTrendPoint[]>([]);
  const [absentees, setAbsentees] = useState<ChronicAbsentee[]>([]);
  const [feeAging, setFeeAging] = useState<FeeAgingRow[]>([]);
  const [coverage, setCoverage] = useState<StaffCoverageRow[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskSummaryRow[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);

  const [sortKey, setSortKey] = useState<keyof BranchComparisonRow>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const [atRiskDialogBranch, setAtRiskDialogBranch] = useState<{ id: string; name: string } | null>(null);
  const [atRiskList, setAtRiskList] = useState<AtRiskStudent[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", code: "", address: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBranchId, setAssignBranchId] = useState("");
  const [unassignedPrincipals, setUnassignedPrincipals] = useState<{ id: number; name: string; email: string }[]>([]);
  const [selectedPrincipalId, setSelectedPrincipalId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [b, c, a, t, ab, fa, cov, risk, ls] = await Promise.all([
      fetchBranchSummariesDB(), fetchBranchComparisonDB(), fetchOwnerAlertsDB(),
      fetchAttendanceTrendDB(), fetchChronicAbsenteesDB(), fetchFeeAgingDB(),
      fetchStaffCoverageTodayDB(), fetchAtRiskStudentsSummaryDB(),
      fetchLowStockItemsDB(),
    ]);
    setBranches(b); setComparison(c); setAlerts(a); setTrend(t); setAbsentees(ab);
    setFeeAging(fa); setCoverage(cov); setAtRisk(risk); setLowStock(ls);
    setLoading(false);
  }, []);

  useEffect(() => {
    getSession().then(s => {
      setIsOwner(s?.role === "OWNER");
      if (s?.role === "OWNER") load();
      else setLoading(false);
    });
  }, [load]);

  const handleCreate = async () => {
    if (!createForm.name) { toast({ title: "Branch name is required", variant: "destructive" }); return; }
    setSaving(true);
    const res = await createBranchDB(createForm);
    setSaving(false);
    if (res.error) { toast({ title: "Failed to create branch", description: res.error, variant: "destructive" }); return; }
    toast({ title: "Branch created" });
    setCreateOpen(false);
    setCreateForm({ name: "", code: "", address: "", phone: "" });
    load();
  };

  const openAssign = async (branchId: string) => {
    setAssignBranchId(branchId);
    setSelectedPrincipalId("");
    setUnassignedPrincipals(await fetchUnassignedPrincipalsDB());
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedPrincipalId) return;
    const res = await assignPrincipalDB(assignBranchId, parseInt(selectedPrincipalId, 10));
    if (res.error) { toast({ title: "Failed to assign principal", description: res.error, variant: "destructive" }); return; }
    toast({ title: "Principal assigned" });
    setAssignOpen(false);
    load();
  };

  const openAtRisk = async (branchId: string, branchName: string) => {
    setAtRiskDialogBranch({ id: branchId, name: branchName });
    setAtRiskList(await fetchAtRiskStudentsListDB(branchId));
  };

  const handleSort = (key: keyof BranchComparisonRow) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  if (isOwner === false) return <Unauthorized />;

  const totals = branches.reduce(
    (acc, b) => ({
      students: acc.students + b.studentCount,
      staff: acc.staff + b.staffCount,
      fees: acc.fees + b.feeCollectedThisTerm,
    }),
    { students: 0, staff: 0, fees: 0 }
  );
  const overallAttendance = (() => {
    const rated = branches.filter(b => b.attendanceRatePct !== null);
    if (!rated.length) return null;
    return Math.round(rated.reduce((s, b) => s + (b.attendanceRatePct as number), 0) / rated.length);
  })();
  const totalOutstanding = comparison.reduce((s, b) => s + b.outstandingAmount, 0);

  const sortedComparison = [...comparison].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === "string" && typeof bv === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const criticalAlerts = alerts.filter(a => a.severity === "critical");
  const warningAlerts = alerts.filter(a => a.severity === "warning");
  const positiveAlerts = alerts.filter(a => a.severity === "positive");

  const maxAgingTotal = Math.max(1, ...feeAging.map(r => r.bucket0to30 + r.bucket31to60 + r.bucket61to90 + r.bucket90plus));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" /> Owner Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">Cross-branch overview across every campus.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Branch
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>
      ) : branches.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No branches yet — add one to get started.</p>
      ) : (
        <>
          {/* 1. Executive Snapshot */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { icon: Building2, label: "Schools", value: String(branches.length), color: "text-[#2563EB]", bg: "bg-[#EFF6FF]" },
              { icon: GraduationCap, label: "Students", value: totals.students.toLocaleString(), color: "text-[#2563EB]", bg: "bg-[#EFF6FF]" },
              { icon: Users, label: "Staff", value: totals.staff.toLocaleString(), color: "text-green-600", bg: "bg-[#F0FDF4]" },
              { icon: CalendarCheck, label: "Attendance", value: overallAttendance !== null ? `${overallAttendance}%` : "—", color: "text-purple-600", bg: "bg-purple-50" },
              { icon: Wallet, label: "Collected (Term)", value: RS(totals.fees), color: "text-amber-600", bg: "bg-amber-50" },
              { icon: FileWarning, label: "Outstanding", value: RS(totalOutstanding), color: "text-red-600", bg: "bg-red-50" },
            ].map((k, i) => (
              <Card key={i} className="border-border">
                <CardContent className="p-3 flex items-center gap-2.5">
                  <div className={`h-9 w-9 rounded-lg ${k.bg} flex items-center justify-center shrink-0`}><k.icon className={`h-4 w-4 ${k.color}`} /></div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-foreground leading-tight truncate">{k.value}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">{k.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 2. Attention Required */}
          {alerts.length > 0 && (
            <Card className="border-border">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Attention Required</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    {criticalAlerts.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                        <p><span className="font-medium text-foreground">{a.branchName}:</span> <span className="text-muted-foreground">{a.message}</span></p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {warningAlerts.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <p><span className="font-medium text-foreground">{a.branchName}:</span> <span className="text-muted-foreground">{a.message}</span></p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {positiveAlerts.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                        <p><span className="font-medium text-foreground">{a.branchName}:</span> <span className="text-muted-foreground">{a.message}</span></p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 3. School-by-School Comparison */}
          <Card className="border-border">
            <CardContent className="p-0">
              <div className="p-4 pb-0"><h3 className="text-sm font-semibold text-foreground">School-by-School Comparison</h3></div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {([
                        ["name", "School"], ["studentCount", "Students"], ["attendanceRatePct", "Attendance"],
                        ["teacherAttendanceRatePct", "Teacher Att."], ["feeCollectionPct", "Fee %"],
                        ["outstandingAmount", "Outstanding"], ["newAdmissionsThisMonth", "New Admissions"], ["openIncidents", "Incidents"],
                      ] as [keyof BranchComparisonRow, string][]).map(([key, label]) => (
                        <TableHead key={key} className="cursor-pointer select-none" onClick={() => handleSort(key)}>
                          <span className="inline-flex items-center gap-1">{label} <ArrowUpDown className="h-3 w-3 opacity-50" /></span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedComparison.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell>{b.studentCount}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${statusDot(b.attendanceRatePct)}`} />
                            {b.attendanceRatePct !== null ? `${b.attendanceRatePct}%` : "—"}
                          </span>
                        </TableCell>
                        <TableCell>{b.teacherAttendanceRatePct !== null ? `${b.teacherAttendanceRatePct}%` : "—"}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${statusDot(b.feeCollectionPct, 95, 80)}`} />
                            {b.feeCollectionPct !== null ? `${b.feeCollectionPct}%` : "—"}
                          </span>
                        </TableCell>
                        <TableCell className={b.outstandingAmount > 500000 ? "text-red-600 font-medium" : ""}>{RS(b.outstandingAmount)}</TableCell>
                        <TableCell>{b.newAdmissionsThisMonth}</TableCell>
                        <TableCell className={b.openIncidents > 0 ? "text-amber-600 font-medium" : ""}>{b.openIncidents}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* 4. Attendance + Finance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Attendance — Last 7 Days</h3>
                {trend.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No attendance recorded in the last 7 days.</p>
                ) : (
                  <div className="flex items-end gap-1.5 h-20">
                    {trend.map((t, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-[#EFF6FF] rounded-t" style={{ height: `${Math.max(4, (t.ratePct ?? 0))}%` }} />
                        <span className="text-[9px] text-muted-foreground">{t.date.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-medium text-foreground mb-1.5">Chronic Absenteeism (3+ days this week)</p>
                  {absentees.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No chronic absentees this week.</p>
                  ) : (
                    <div className="space-y-1">
                      {absentees.slice(0, 5).map(a => (
                        <div key={a.studentId} className="flex items-center justify-between text-xs">
                          <span className="text-foreground">{a.studentName} <span className="text-muted-foreground">· {a.branchName}</span></span>
                          <span className="text-red-600 font-medium">{a.absentDays} days</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Fee Aging by Branch</h3>
                {feeAging.every(r => r.bucket0to30 + r.bucket31to60 + r.bucket61to90 + r.bucket90plus === 0) ? (
                  <p className="text-xs text-muted-foreground">No outstanding fee balances.</p>
                ) : (
                  <div className="space-y-3">
                    {feeAging.map(r => {
                      const total = r.bucket0to30 + r.bucket31to60 + r.bucket61to90 + r.bucket90plus;
                      return (
                        <div key={r.branchId}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-foreground">{r.branchName}</span>
                            <span className="text-muted-foreground">{RS(total)}</span>
                          </div>
                          <div className="h-2.5 rounded-full overflow-hidden flex bg-muted" style={{ width: "100%" }}>
                            {total > 0 && <>
                              <div className="bg-green-400" style={{ width: `${(r.bucket0to30 / maxAgingTotal) * 100}%` }} title={`0-30d: ${RS(r.bucket0to30)}`} />
                              <div className="bg-amber-400" style={{ width: `${(r.bucket31to60 / maxAgingTotal) * 100}%` }} title={`31-60d: ${RS(r.bucket31to60)}`} />
                              <div className="bg-orange-500" style={{ width: `${(r.bucket61to90 / maxAgingTotal) * 100}%` }} title={`61-90d: ${RS(r.bucket61to90)}`} />
                              <div className="bg-red-600" style={{ width: `${(r.bucket90plus / maxAgingTotal) * 100}%` }} title={`90+d: ${RS(r.bucket90plus)}`} />
                            </>}
                          </div>
                          {r.bucket90plus > 0 && <p className="text-[11px] text-red-600 mt-0.5">{RS(r.bucket90plus)} overdue 90+ days</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 5. Staff Coverage + Academic At-Risk */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border">
              <CardContent className="p-4 space-y-2.5">
                <h3 className="text-sm font-semibold text-foreground">Staff Coverage Today</h3>
                {coverage.map(c => (
                  <div key={c.branchId} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{c.branchName}</span>
                    <span className={c.teachersAbsentToday > 0 || c.unfilledSubstitutionsToday > 0 ? "text-amber-600" : "text-muted-foreground"}>
                      {c.teachersAbsentToday} absent · {c.unfilledSubstitutionsToday} uncovered
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 space-y-2.5">
                <h3 className="text-sm font-semibold text-foreground">Students at Academic Risk (&lt;40%)</h3>
                {atRisk.map(r => (
                  <div key={r.branchId} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{r.branchName}</span>
                    {r.count > 0 ? (
                      <button className="text-red-600 font-medium hover:underline" onClick={() => openAtRisk(r.branchId, r.branchName)}>{r.count} students</button>
                    ) : (
                      <span className="text-muted-foreground">0 students</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* 6. Inventory */}
          <Card className="border-border">
            <CardContent className="p-4 space-y-2.5">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Package className="h-4 w-4" /> Low Stock Items</h3>
              {lowStock.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing below minimum stock level.</p>
              ) : (
                <div className="space-y-1.5">
                  {lowStock.slice(0, 6).map(i => (
                    <div key={i.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{i.name}</span>
                      <span className="text-red-600">{i.quantity}/{i.minStockLevel} {i.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Branch management */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map(b => (
              <Card key={b.id} className="border-border">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.code || "—"}</p>
                      </div>
                    </div>
                    <Badge variant={b.isActive ? "default" : "secondary"}>{b.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Principal: <span className="font-medium text-foreground">{b.principalName || "Unassigned"}</span></p>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openAssign(b.id)}>
                      {b.principalName ? "Reassign" : "Assign"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create Branch Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Branch</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. North Campus" /></div>
            <div><Label>Code</Label><Input value={createForm.code} onChange={e => setCreateForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. NORTH" /></div>
            <div><Label>Address</Label><Input value={createForm.address} onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !createForm.name}>{saving ? "Creating…" : "Create Branch"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Principal Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign Principal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {unassignedPrincipals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unassigned PRINCIPAL-role users found. Create a user with the PRINCIPAL role first (Settings → Users).</p>
            ) : (
              <Select value={selectedPrincipalId} onValueChange={setSelectedPrincipalId}>
                <SelectTrigger><SelectValue placeholder="Select a principal" /></SelectTrigger>
                <SelectContent>
                  {unassignedPrincipals.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.email})</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!selectedPrincipalId}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* At-Risk Students Dialog */}
      <Dialog open={!!atRiskDialogBranch} onOpenChange={o => { if (!o) setAtRiskDialogBranch(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>At-Risk Students — {atRiskDialogBranch?.name}</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Class</TableHead><TableHead>Score</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {atRiskList.map(s => (
                  <TableRow key={s.studentId}>
                    <TableCell>{s.studentName}</TableCell>
                    <TableCell>{s.className}</TableCell>
                    <TableCell className="text-red-600 font-medium">{s.percentage}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtRiskDialogBranch(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
