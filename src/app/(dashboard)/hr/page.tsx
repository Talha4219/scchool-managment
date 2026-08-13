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
  fetchEmployeesDB, createEmployeeDB,
  fetchLeaveRequestsDB, createLeaveRequestDB, approveLeaveDB, rejectLeaveDB,
} from "@/app/actions/features";
import type { EmployeeRecord, LeaveRequest, PerformanceEvaluation } from "@/lib/types";
import {
  Users, Briefcase, CalendarCheck, Clock, Plus, Search, CheckCircle2, XCircle,
  Lock, Mail, Phone, Building, UserCircle, BadgeCheck, Loader2, Star, FileText, Download,
} from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";

const LEAVE_TYPES = ["Sick", "Casual", "Annual", "Maternity", "Paternity", "Unpaid"] as const;
const EMPLOYMENT_TYPES = ["Permanent", "Contract", "Probation", "Intern"] as const;
const STATUS_OPTIONS = ["Active", "Inactive", "Resigned", "Terminated"] as const;

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
  onSubmit: (data: Omit<EmployeeRecord, "id">) => Promise<void>;
  initial?: EmployeeRecord;
}) {
  const blank = {
    userId: 0, name: "", email: "", phone: "", department: "", designation: "",
    employmentType: "Permanent" as const, joiningDate: "", cnic: "", address: "",
    emergencyContact: "", emergencyPhone: "", qualification: "", experience: 0,
    status: "Active" as const, bankName: "", bankAccount: "", profilePhoto: "",
  };
  const [form, setForm] = useState(initial ?? blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial ?? blank);
  }, [open, initial]);

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSubmit(form as Omit<EmployeeRecord, "id">);
    setSaving(false);
  };

  const fields = [
    { col: "col-span-2", label: "Full Name", key: "name", type: "text" },
    { col: "", label: "Email", key: "email", type: "email" },
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
                    value={form[f.key as keyof typeof form] as string | number}
                    onChange={e => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
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

function LeaveRequestDialog({ open, onOpenChange, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (data: Omit<LeaveRequest, "id">) => Promise<void>;
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
            <Label>Employee Name</Label>
            <Input value={form.employeeName} onChange={e => set("employeeName", e.target.value)} />
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
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
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
  const { can, loaded: permsLoaded } = usePermission();

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [evaluations] = useState<PerformanceEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [emps, leaves] = await Promise.all([fetchEmployeesDB(), fetchLeaveRequestsDB()]);
    setEmployees(emps);
    setLeaveRequests(leaves);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateEmployee = async (data: Omit<EmployeeRecord, "id">) => {
    const res = await createEmployeeDB(data);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Employee created." });
    setEmployeeDialogOpen(false);
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
              <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />Add Employee</Button>
                </DialogTrigger>
                <EmployeeDialog
                  open={employeeDialogOpen}
                  onOpenChange={setEmployeeDialogOpen}
                  onSubmit={handleCreateEmployee}
                />
              </Dialog>
            </div>
          </div>

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmps.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
            <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Apply Leave</Button>
              </DialogTrigger>
              <LeaveRequestDialog
                open={leaveDialogOpen}
                onOpenChange={setLeaveDialogOpen}
                onSubmit={handleApplyLeave}
              />
            </Dialog>
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
