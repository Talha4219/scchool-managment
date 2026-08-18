"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/app/actions/auth";
import {
  fetchBranchByIdDB, updateBranchDB, assignPrincipalDB, fetchUnassignedPrincipalsDB,
  fetchBranchMetricsDB, fetchAtRiskStudentsListDB,
  type BranchRecord, type BranchComparisonRow, type AtRiskStudent,
} from "@/app/actions/branches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Unauthorized } from "@/components/unauthorized";
import { ArrowLeft, Building2, Users, GraduationCap, Wallet, CalendarCheck, Save, Check } from "lucide-react";

const RS = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

const labelCls = "text-xs font-medium text-muted-foreground mb-1 block";

export default function BranchProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const branchId = params.id;

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [isOwnerViewer, setIsOwnerViewer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState<BranchRecord | null>(null);
  const [metrics, setMetrics] = useState<BranchComparisonRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    name: "", code: "", address: "", phone: "", email: "",
    establishedDate: "", capacity: "", gradeLevels: "", shift: "",
  });

  const [assignOpen, setAssignOpen] = useState(false);
  const [unassignedPrincipals, setUnassignedPrincipals] = useState<{ id: number; name: string; email: string }[]>([]);
  const [selectedPrincipalId, setSelectedPrincipalId] = useState("");

  const [atRiskOpen, setAtRiskOpen] = useState(false);
  const [atRiskList, setAtRiskList] = useState<AtRiskStudent[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [b, m] = await Promise.all([fetchBranchByIdDB(branchId), fetchBranchMetricsDB(branchId)]);
    if (b) {
      setBranch(b);
      setForm({
        name: b.name, code: b.code || "", address: b.address || "", phone: b.phone || "",
        email: b.email || "", establishedDate: b.establishedDate || "",
        capacity: b.capacity !== null ? String(b.capacity) : "", gradeLevels: b.gradeLevels || "", shift: b.shift || "",
      });
    }
    setMetrics(m);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    getSession().then(s => {
      const ok = s?.role === "OWNER" || (s?.role === "PRINCIPAL" && s.branchId === branchId);
      setAuthorized(!!ok);
      setIsOwnerViewer(s?.role === "OWNER");
      if (ok) load();
    });
  }, [branchId, load]);

  const handleSave = async () => {
    setSaving(true);
    const res = await updateBranchDB(branchId, {
      name: form.name, code: form.code || undefined, address: form.address || undefined,
      phone: form.phone || undefined, email: form.email || undefined,
      establishedDate: form.establishedDate || undefined,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      gradeLevels: form.gradeLevels || undefined, shift: form.shift || undefined,
    });
    setSaving(false);
    if (res.error) { toast({ title: "Failed to save", description: res.error, variant: "destructive" }); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  };

  const toggleActive = async () => {
    if (!branch) return;
    const res = await updateBranchDB(branchId, { isActive: !branch.isActive });
    if (res.error) { toast({ title: "Failed to update status", description: res.error, variant: "destructive" }); return; }
    toast({ title: !branch.isActive ? "Branch activated" : "Branch deactivated" });
    load();
  };

  const openAssign = async () => {
    setSelectedPrincipalId("");
    setUnassignedPrincipals(await fetchUnassignedPrincipalsDB());
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedPrincipalId) return;
    const res = await assignPrincipalDB(branchId, parseInt(selectedPrincipalId, 10));
    if (res.error) { toast({ title: "Failed to assign principal", description: res.error, variant: "destructive" }); return; }
    toast({ title: "Principal assigned" });
    setAssignOpen(false);
    load();
  };

  const openAtRisk = async () => {
    setAtRiskList(await fetchAtRiskStudentsListDB(branchId));
    setAtRiskOpen(true);
  };

  if (authorized === false) return <Unauthorized />;
  if (loading || authorized === null) return <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>;
  if (!branch) return <p className="text-sm text-muted-foreground text-center py-12">Branch not found.</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push(isOwnerViewer ? "/owner" : "/settings")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-10 w-10 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{branch.name}</h1>
            <p className="text-xs text-muted-foreground">{branch.code || "No code"}</p>
          </div>
          <Badge variant={branch.isActive ? "default" : "secondary"}>{branch.isActive ? "Active" : "Inactive"}</Badge>
        </div>
        {isOwnerViewer && (
          <Button variant="outline" size="sm" onClick={toggleActive}>
            {branch.isActive ? "Deactivate Branch" : "Activate Branch"}
          </Button>
        )}
      </div>

      {/* Snapshot metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border"><CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="h-3.5 w-3.5" /> Students</div>
            <p className="text-xl font-bold text-foreground">{metrics.studentCount}</p>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><GraduationCap className="h-3.5 w-3.5" /> Staff</div>
            <p className="text-xl font-bold text-foreground">{metrics.staffCount}</p>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Wallet className="h-3.5 w-3.5" /> Fees Collected</div>
            <p className="text-xl font-bold text-foreground">{RS(metrics.feeCollectedThisTerm)}</p>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><CalendarCheck className="h-3.5 w-3.5" /> Attendance</div>
            <p className="text-xl font-bold text-foreground">{metrics.attendanceRatePct !== null ? `${metrics.attendanceRatePct}%` : "—"}</p>
          </CardContent></Card>
        </div>
      )}

      {metrics && (metrics.outstandingAmount > 0 || metrics.openIncidents > 0) && (
        <div className="flex flex-wrap gap-3 text-xs">
          {metrics.outstandingAmount > 0 && (
            <span className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700">{RS(metrics.outstandingAmount)} outstanding fees</span>
          )}
          {metrics.openIncidents > 0 && (
            <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700">{metrics.openIncidents} open discipline incident{metrics.openIncidents === 1 ? "" : "s"}</span>
          )}
        </div>
      )}

      {/* Leadership */}
      <Card className="border-border">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Principal</p>
            <p className="text-xs text-muted-foreground mt-0.5">{branch.principalName || "Unassigned"}</p>
          </div>
          {isOwnerViewer && (
            <Button variant="outline" size="sm" onClick={openAssign}>
              {branch.principalName ? "Reassign" : "Assign Principal"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* At-risk students shortcut */}
      {metrics && (
        <Card className="border-border">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Academic At-Risk Students</p>
              <p className="text-xs text-muted-foreground mt-0.5">Students scoring below 40% across exams</p>
            </div>
            <Button variant="ghost" size="sm" onClick={openAtRisk}>View List</Button>
          </CardContent>
        </Card>
      )}

      {/* Profile / edit form */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Branch Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label className={labelCls}>Branch Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label className={labelCls}>Branch Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. NORTH" /></div>
            <div><Label className={labelCls}>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label className={labelCls}>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="sm:col-span-2"><Label className={labelCls}>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div><Label className={labelCls}>Established Date</Label><Input type="date" value={form.establishedDate} onChange={e => setForm(f => ({ ...f, establishedDate: e.target.value }))} /></div>
            <div><Label className={labelCls}>Capacity</Label><Input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="e.g. 1200" /></div>
            <div><Label className={labelCls}>Grade Levels Offered</Label><Input value={form.gradeLevels} onChange={e => setForm(f => ({ ...f, gradeLevels: e.target.value }))} placeholder="e.g. Nursery – Grade 10" /></div>
            <div><Label className={labelCls}>Shift</Label><Input value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))} placeholder="e.g. Morning" /></div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className={saved ? "bg-success hover:bg-success/90" : ""}>
              {saved ? <><Check className="h-4 w-4 mr-1" /> Saved!</> : <><Save className="h-4 w-4 mr-1" /> Save Changes</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Assign Principal Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign Principal — {branch.name}</DialogTitle></DialogHeader>
          <Select value={selectedPrincipalId} onValueChange={setSelectedPrincipalId}>
            <SelectTrigger><SelectValue placeholder="Select a Principal-role user" /></SelectTrigger>
            <SelectContent>
              {unassignedPrincipals.map(p => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.email})</SelectItem>
              ))}
              {unassignedPrincipals.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">No unassigned Principal-role users. Create one under Users first.</div>
              )}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!selectedPrincipalId}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* At-Risk Students Dialog */}
      <Dialog open={atRiskOpen} onOpenChange={setAtRiskOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>At-Risk Students — {branch.name}</DialogTitle></DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-1.5">
            {atRiskList.map(s => (
              <div key={s.studentId} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span className="text-foreground">{s.studentName} <span className="text-muted-foreground">· {s.className}</span></span>
                <span className="text-red-600 font-medium">{s.percentage}%</span>
              </div>
            ))}
            {atRiskList.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No at-risk students.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtRiskOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
