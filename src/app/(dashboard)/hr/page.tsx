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
import { useConfirm } from "@/components/ui/confirm-dialog";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import {
  fetchEmployeesDB, createStaffEmployeeDB, updateEmployeeDB, deleteEmployeeDB, fetchStaffDirectoryDB,
  fetchLeaveRequestsDB, createLeaveRequestDB, approveLeaveDB, rejectLeaveDB,
  fetchPerformanceEvaluationsDB, createPerformanceEvaluationDB,
} from "@/app/actions/features";
import type { EmployeeRecord, LeaveRequest, PerformanceEvaluation } from "@/lib/types";
import {
  Users, Briefcase, CalendarCheck, Clock, Plus, Search, CheckCircle2, XCircle,
  Lock, Mail, Phone, Building, UserCircle, BadgeCheck, Loader2, Star, FileText, Download, Pencil, Trash2,
} from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";

const LEAVE_TYPES = ["Sick", "Casual", "Annual", "Maternity", "Paternity", "Unpaid"] as const;
const EMPLOYMENT_TYPES = ["Permanent", "Contract", "Probation", "Intern"] as const;
const STATUS_OPTIONS = ["Active", "Inactive", "Resigned", "Terminated"] as const;

type StaffOption = { userId: number; name: string; role: string; department: string; designation: string; payScaleId: string | null };

const statusBadge: Record<string, string> = {
  Active: "bg-green-100 text-green-800",
  Inactive: "bg-gray-100 text-gray-800",
  Resigned: "bg-orange-100 text-orange-800",
  Terminated: "bg-red-100 text-red-800",
  Pending: "bg-yellow-100 text-yellow-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
};

const leaveTypeColors: Record<string, string> = {
  Sick: "bg-pink-100 text-pink-800",
  Casual: "bg-blue-100 text-blue-800",
  Annual: "bg-purple-100 text-purple-800",
  Maternity: "bg-rose-100 text-rose-800",
  Paternity: "bg-indigo-100 text-indigo-800",
  Unpaid: "bg-gray-100 text-gray-800",
};

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

function EmployeeDialog({
  open, onOpenChange, onSubmit, initial,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; password: string } & Omit<EmployeeRecord, "id" | "userId" | "name" | "email">) => Promise<void>;
  initial?: EmployeeRecord;
}) {
  const blank = {
    name: "", email: "", password: "", phone: "", department: "", designation: "",
    employmentType: "Permanent" as const, joiningDate: "", cnic: "", address: "",
    emergencyContact: "", emergencyPhone: "", qualification: "", experience: 0,
    status: "Active" as const, bankName: "", bankAccount: "", profilePhoto: "", payScaleId: null as string | null,
  };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial ? ({ ...initial, password: "" } as typeof blank) : blank);
  }, [open, initial]);

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSubmit(form as any);
    setSaving(false);
  };

  const fields = [
    { col: "col-span-2", label: "Full Name", key: "name", type: "text", disabled: !!initial },
    { col: "", label: "Email", key: "email", type: "email", disabled: !!initial },
    ...(!initial ? [{ col: "", label: "Password", key: "password", type: "password" }] : []),
    { col: "", label: "Phone", key: "phone", type: "text" },
    { col: "", label: "Department", key: "department", type: "text" },
    { col: "", label: "Designation", key: "designation", type: "text" },
    { col: "", label: "Employment Type", key: "employmentType", type: "select", options: [...EMPLOYMENT_TYPES] },
    { col: "", label: "Joining Date", key: "joiningDate", type: "date" },
    { col: "", label: "CNIC", key: "cnic", type: "text" },
    { col: "col-span-2", label: "Address", key: "address", type: "text" },
    { col: "", label: "Emergency Contact", key: "emergencyContact", type: "text" },
    { col: "", label: "Emergency Phone", key: "emergencyPhone", type: "text" },
    { col: "", label: "Qualification", key: "qualification", type: "text" },
    { col: "", label: "Experience (years)", key: "experience", type: "number" },
    { col: "", label: "Status", key: "status", type: "select", options: [...STATUS_OPTIONS] },
    { col: "", label: "Bank Name", key: "bankName", type: "text" },
    { col: "", label: "Bank Account", key: "bankAccount", type: "text" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Employee" : "Add Employee"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {fields.map(f => (
              <div key={f.key} className={f.col}>
                <Label>{f.label}</Label>
                {f.type === "select" ? (
                  <Select value={form[f.key as keyof typeof form] as string} onValueChange={v => set(f.key, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(f.options as string[]).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={f.type}
                    disabled={(f as any).disabled}
                    value={form[f.key as keyof typeof form] as string | number}
                    onChange={e => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          {!initial && <p className="text-xs text-muted-foreground">This creates a real login account for this staff member.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initial ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeaveRequestDialog({ open, onOpenChange, onSubmit, staff }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (data: Omit<LeaveRequest, "id">) => Promise<void>;
  staff: StaffOption[];
}) {
  const blank = {
    employeeId: 0, employeeName: "", leaveType: "Sick" as const,
    startDate: "", endDate: "", totalDays: 1, reason: "",
    status: "Pending" as const, approvedBy: "", appliedAt: new Date().toISOString().split("T")[0],
  };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(blank); }, [open]);

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId) return;
    setSaving(true);
    await onSubmit(form as Omit<LeaveRequest, "id">);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Staff Member</Label>
            <Select value={form.employeeId ? String(form.employeeId) : ""} onValueChange={v => {
              const s = staff.find(x => x.userId === Number(v));
              set("employeeId", Number(v)); set("employeeName", s?.name || "");
            }}>
              <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
              <SelectContent>
                {staff.map(s => <SelectItem key={s.userId} value={String(s.userId)}>{s.name} — {s.department}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Leave Type</Label>
            <Select value={form.leaveType} onValueChange={v => set("leaveType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Total Days</Label>
            <Input type="number" min={1} value={form.totalDays} onChange={e => set("totalDays", Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={form.reason} onChange={e => set("reason", e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.employeeId}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EvaluationDialog({ open, onOpenChange, onSubmit, staff }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (data: Omit<PerformanceEvaluation, "id">) => Promise<void>;
  staff: StaffOption[];
}) {
  const blank = {
    employeeId: 0, employeeName: "", evaluatorName: "", evaluationDate: new Date().toISOString().split("T")[0],
    rating: 3, feedback: "", goals: "", overallScore: 0,
  };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(blank); }, [open]);
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId) return;
    setSaving(true);
    await onSubmit(form as Omit<PerformanceEvaluation, "id">);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Performance Evaluation</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Staff Member</Label>
            <Select value={form.employeeId ? String(form.employeeId) : ""} onValueChange={v => {
              const s = staff.find(x => x.userId === Number(v));
              set("employeeId", Number(v)); set("employeeName", s?.name || "");
            }}>
              <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
              <SelectContent>
                {staff.map(s => <SelectItem key={s.userId} value={String(s.userId)}>{s.name} — {s.department}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Evaluator Name</Label>
            <Input value={form.evaluatorName} onChange={e => set("evaluatorName", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Evaluation Date</Label>
              <Input type="date" value={form.evaluationDate} onChange={e => set("evaluationDate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Rating (1-5)</Label>
              <Input type="number" min={1} max={5} value={form.rating} onChange={e => set("rating", Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Overall Score (%)</Label>
            <Input type="number" min={0} max={100} value={form.overallScore} onChange={e => set("overallScore", Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Feedback</Label>
            <Textarea value={form.feedback} onChange={e => set("feedback", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Goals</Label>
            <Textarea value={form.goals} onChange={e => set("goals", e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.employeeId}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PerformanceCard({ ev: evData }: { ev: PerformanceEvaluation }) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-semibold">{evData.employeeName}</h4>
            <p className="text-xs text-muted-foreground">Evaluator: {evData.evaluatorName}</p>
            <p className="text-xs text-muted-foreground">{evData.evaluationDate}</p>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-bold">{evData.rating}/5</span>
          </div>
        </div>
        <div className="mt-2 text-sm">
          <p><span className="font-medium">Score:</span> {evData.overallScore}%</p>
          <p className="text-muted-foreground mt-1">{evData.feedback}</p>
          {evData.goals && <p className="text-muted-foreground mt-1"><span className="font-medium">Goals:</span> {evData.goals}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function HRPage() {
  const { activeRole } = useAppState();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { can, loaded: permsLoaded } = usePermission();

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [evaluations, setEvaluations] = useState<PerformanceEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | undefined>(undefined);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [evalDialogOpen, setEvalDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [emps, leaves, evals, staffList] = await Promise.all([
      fetchEmployeesDB(), fetchLeaveRequestsDB(), fetchPerformanceEvaluationsDB(), fetchStaffDirectoryDB(),
    ]);
    setEmployees(emps);
    setLeaveRequests(leaves);
    setEvaluations(evals);
    setStaff(staffList);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateEmployee = async (data: { name: string; email: string; password: string } & Omit<EmployeeRecord, "id" | "userId" | "name" | "email">) => {
    const { name, email, password, ...rest } = data;
    const res = await createStaffEmployeeDB(name, email, password, rest);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Employee created." });
    setEmployeeDialogOpen(false);
    load();
  };

  const handleUpdateEmployee = async (data: { name: string; email: string; password: string } & Omit<EmployeeRecord, "id" | "userId" | "name" | "email">) => {
    if (!editingEmployee) return;
    const { name, email, password, ...rest } = data;
    const res = await updateEmployeeDB(editingEmployee.userId, rest);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Employee updated." });
    setEmployeeDialogOpen(false);
    setEditingEmployee(undefined);
    load();
  };

  const handleDeleteEmployee = async (emp: EmployeeRecord) => {
    const ok = await confirm({ title: "Remove staff member?", description: `This removes ${emp.name}'s HR record. Their login and any teaching profile are not affected.` });
    if (!ok) return;
    const res = await deleteEmployeeDB(emp.userId);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Staff member removed." });
    load();
  };

  const handleApplyLeave = async (data: Omit<LeaveRequest, "id">) => {
    const res = await createLeaveRequestDB(data);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Leave request submitted." });
    setLeaveDialogOpen(false);
    load();
  };

  const handleApproveLeave = async (id: string) => {
    const res = await approveLeaveDB(id, "Admin");
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Leave approved." });
    load();
  };

  const handleRejectLeave = async (id: string) => {
    const res = await rejectLeaveDB(id);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Leave rejected." });
    load();
  };

  const handleAddEvaluation = async (data: Omit<PerformanceEvaluation, "id">) => {
    const res = await createPerformanceEvaluationDB(data);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Evaluation recorded." });
    setEvalDialogOpen(false);
    load();
  };

  const filteredEmps = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase())
  );

  const totalEmployees = employees.length;
  const departments = [...new Set(employees.map(e => e.department))].length;
  const onLeave = leaveRequests.filter(l => l.status === "Approved").length;
  const pendingApprovals = leaveRequests.filter(l => l.status === "Pending").length;

  if (!permsLoaded) return null;
  if (!can("hr.view")) return <Unauthorized />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">HR Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage employees, leave, and performance</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Employees" value={totalEmployees} icon={Users} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard label="Departments" value={departments} icon={Building} iconBg="bg-purple-100" iconColor="text-purple-600" />
        <StatCard label="On Leave" value={onLeave} icon={CalendarCheck} iconBg="bg-orange-100" iconColor="text-orange-600" />
        <StatCard label="Pending Approvals" value={pendingApprovals} icon={Clock} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
      </div>

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="leave">Leave Management</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                exportToCsv("employees", ["Name", "Email", "Phone", "Department", "Designation", "Type", "Joining Date"],
                  filteredEmps.map(e => [e.name, e.email, e.phone, e.department, e.designation, e.employmentType, e.joiningDate]));
              }}>
                <Download className="mr-2 h-4 w-4" />Export
              </Button>
              <Button onClick={() => { setEditingEmployee(undefined); setEmployeeDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />Add Employee
              </Button>
              <EmployeeDialog
                open={employeeDialogOpen}
                onOpenChange={(o) => { setEmployeeDialogOpen(o); if (!o) setEditingEmployee(undefined); }}
                onSubmit={editingEmployee ? handleUpdateEmployee : handleCreateEmployee}
                initial={editingEmployee}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Teachers are added via the Teachers module and appear here automatically — no need to re-add them.</p>

          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmps.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {loading ? <><Skeleton className="h-4 w-24 mx-auto" /><Skeleton className="h-3 w-16 mx-auto mt-1" /></> : "No employees found."}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredEmps.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3" />{emp.email}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />{emp.phone}
                        </span>
                      </TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell>{emp.designation}</TableCell>
                      <TableCell><Badge variant="outline">{emp.employmentType}</Badge></TableCell>
                      <TableCell className="text-sm">{emp.joiningDate}</TableCell>
                      <TableCell>
                        <Badge className={statusBadge[emp.status]}>{emp.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditingEmployee(emp); setEmployeeDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteEmployee(emp)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Leave Requests</h2>
            <Button onClick={() => setLeaveDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Apply Leave</Button>
            <LeaveRequestDialog
              open={leaveDialogOpen}
              onOpenChange={setLeaveDialogOpen}
              onSubmit={handleApplyLeave}
              staff={staff}
            />
          </div>

          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No leave requests.</TableCell>
                    </TableRow>
                  )}
                  {leaveRequests.map(lr => (
                    <TableRow key={lr.id}>
                      <TableCell className="font-medium">{lr.employeeName}</TableCell>
                      <TableCell>
                        <Badge className={leaveTypeColors[lr.leaveType]}>{lr.leaveType}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{lr.startDate}</TableCell>
                      <TableCell className="text-sm">{lr.endDate}</TableCell>
                      <TableCell>{lr.totalDays}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{lr.reason}</TableCell>
                      <TableCell>
                        <Badge className={statusBadge[lr.status]}>{lr.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {lr.status === "Pending" && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handleApproveLeave(lr.id)}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleRejectLeave(lr.id)}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Performance Evaluations</h2>
            <Button onClick={() => setEvalDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Record Evaluation</Button>
            <EvaluationDialog
              open={evalDialogOpen}
              onOpenChange={setEvalDialogOpen}
              onSubmit={handleAddEvaluation}
              staff={staff}
            />
          </div>
          {evaluations.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mb-3" />
                <p>No evaluations yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {evaluations.map(ev => (
                <PerformanceCard key={ev.id} ev={ev} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
