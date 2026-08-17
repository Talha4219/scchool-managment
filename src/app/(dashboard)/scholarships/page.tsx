"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppState } from "@/lib/state-context";
import { useStudents } from "@/lib/students-context";
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
  fetchScholarshipsDB, createScholarshipDB, applyScholarshipDB, approveScholarshipDB,
} from "@/app/actions/features";
import type { Scholarship, ScholarshipApplication, FinancialAid } from "@/lib/types";
import {
  BadgePercent, Users, Award, Plus, CheckCircle2, XCircle, Clock,
  DollarSign, BookOpen, GraduationCap, UserCheck, Search, Eye,
} from "lucide-react";

const SCHOLARSHIP_TYPE_COLORS: Record<string, string> = {
  Merit: "bg-blue-50 text-blue-700 border-blue-200",
  "Need-based": "bg-purple-50 text-purple-700 border-purple-200",
  Sports: "bg-green-50 text-green-700 border-green-200",
  Special: "bg-amber-50 text-amber-700 border-amber-200",
};

const APP_STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-green-50 text-green-700 border-green-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
};

function formatCurrency(n: number) {
  return "Rs. " + n.toLocaleString();
}

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ScholarshipsPage() {
  const { activeRole, schoolInfo } = useAppState();
  const { students } = useStudents();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [applications, setApplications] = useState<ScholarshipApplication[]>([]);
  const [financialAid, setFinancialAid] = useState<FinancialAid[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [scholarshipForm, setScholarshipForm] = useState({
    name: "", type: "Merit" as Scholarship["type"], amount: "",
    totalSlots: "", eligibilityCriteria: "",
  });
  const [applyForm, setApplyForm] = useState({
    scholarshipId: "", studentId: "", academicScore: "",
    familyIncome: "", supportingDocs: "",
  });
  const [appFilter, setAppFilter] = useState<string>("All");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchScholarshipsDB();
    setScholarships(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredApps = applications.filter(a => appFilter === "All" || a.status === appFilter);

  const totalSlots = scholarships.reduce((s, sch) => s + sch.totalSlots, 0);
  const availableSlots = scholarships.reduce((s, sch) => s + sch.availableSlots, 0);
  const totalAwarded = scholarships.reduce((s, sch) => s + (sch.totalSlots - sch.availableSlots) * sch.amount, 0);

  const handleCreateScholarship = async () => {
    if (!scholarshipForm.name || !scholarshipForm.amount || !scholarshipForm.totalSlots) {
      toast({ title: "Name, Amount and Slots are required.", variant: "destructive" }); return;
    }
    const slots = Number(scholarshipForm.totalSlots);
    const res = await createScholarshipDB({
      name: scholarshipForm.name, type: scholarshipForm.type,
      amount: Number(scholarshipForm.amount), totalSlots: slots,
      availableSlots: slots, eligibilityCriteria: scholarshipForm.eligibilityCriteria, isActive: true,
    });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Scholarship program created." });
    setCreateOpen(false);
    setScholarshipForm({ name: "", type: "Merit", amount: "", totalSlots: "", eligibilityCriteria: "" });
    load();
  };

  const handleApply = async () => {
    if (!applyForm.scholarshipId || !applyForm.studentId) {
      toast({ title: "Select scholarship and student.", variant: "destructive" }); return;
    }
    const sch = scholarships.find(s => s.id === applyForm.scholarshipId);
    if (!sch) return;
    const student = students.find(s => s.id === applyForm.studentId);
    if (!student) return;
    const res = await applyScholarshipDB({
      scholarshipId: sch.id, scholarshipName: sch.name,
      studentId: student.id, studentName: student.name,
      applyingForClass: `${student.class}-${student.section}`,
      academicScore: Number(applyForm.academicScore) || 0,
      familyIncome: Number(applyForm.familyIncome) || 0,
      supportingDocs: applyForm.supportingDocs,
      status: "Pending", appliedAt: new Date().toISOString().split("T")[0], approvedBy: "",
    });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    const newApp: ScholarshipApplication = {
      id: `sa_${Date.now()}`, scholarshipId: sch.id, scholarshipName: sch.name,
      studentId: student.id, studentName: student.name,
      applyingForClass: `${student.class}-${student.section}`,
      academicScore: Number(applyForm.academicScore) || 0,
      familyIncome: Number(applyForm.familyIncome) || 0,
      supportingDocs: applyForm.supportingDocs,
      status: "Pending", appliedAt: new Date().toISOString().split("T")[0], approvedBy: "",
    };
    setApplications(prev => [newApp, ...prev]);
    setApplyOpen(false);
    setApplyForm({ scholarshipId: "", studentId: "", academicScore: "", familyIncome: "", supportingDocs: "" });
    toast({ title: "Application submitted." });
  };

  const handleApprove = async (app: ScholarshipApplication) => {
    const res = await approveScholarshipDB(app.id, activeRole || "Admin");
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: "Approved" as const } : a));
    setScholarships(prev => prev.map(s => s.id === app.scholarshipId ? { ...s, availableSlots: s.availableSlots - 1 } : s));
    setFinancialAid(prev => [...prev, {
      id: `fa_${Date.now()}`, studentId: app.studentId, studentName: app.studentName,
      aidType: "Scholarship", amount: scholarships.find(s => s.id === app.scholarshipId)?.amount ?? 0,
      duration: "Academic Year", status: "Active" as const, approvedAt: new Date().toISOString().split("T")[0],
    }]);
    toast({ title: "Scholarship approved.", description: `${app.studentName} has been awarded.` });
  };

  const handleReject = (app: ScholarshipApplication) => {
    setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: "Rejected" as const } : a));
    toast({ title: "Application rejected." });
  };

  if (!permsLoaded) return null;
  if (!can("scholarships.view")) return <Unauthorized />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Scholarships & Financial Aid</h1>
          <p className="text-muted-foreground mt-1">Manage scholarship programs and student applications for {schoolInfo.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
                <UserCheck className="h-4 w-4" /> Apply
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md border-secondary">
              <DialogHeader>
                <DialogTitle className="font-headline font-bold text-primary">Apply for Scholarship</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Scholarship Program</Label>
                  <Select value={applyForm.scholarshipId} onValueChange={v => setApplyForm(f => ({ ...f, scholarshipId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select program..." /></SelectTrigger>
                    <SelectContent>
                      {scholarships.filter(s => s.isActive && s.availableSlots > 0).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.availableSlots} slots)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select value={applyForm.studentId} onValueChange={v => setApplyForm(f => ({ ...f, studentId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select student..." /></SelectTrigger>
                    <SelectContent>
                      {students.filter(s => s.status === "Active").map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name} — {s.class}-{s.section}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Academic Score (%)</Label>
                    <Input type="number" min="0" max="100" value={applyForm.academicScore}
                      onChange={e => setApplyForm(f => ({ ...f, academicScore: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Family Income (Rs.)</Label>
                    <Input type="number" min="0" value={applyForm.familyIncome}
                      onChange={e => setApplyForm(f => ({ ...f, familyIncome: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Supporting Docs (optional)</Label>
                  <Textarea rows={2} value={applyForm.supportingDocs}
                    onChange={e => setApplyForm(f => ({ ...f, supportingDocs: e.target.value }))}
                    placeholder="Links, file references..." />
                </div>
              </div>
              <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancel</Button>
                <Button className="bg-primary hover:bg-primary/90" onClick={handleApply}>Submit Application</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 gap-2"><Plus className="h-4 w-4" /> New Program</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md border-secondary">
              <DialogHeader>
                <DialogTitle className="font-headline font-bold text-primary">Create Scholarship Program</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Program Name</Label>
                  <Input value={scholarshipForm.name}
                    onChange={e => setScholarshipForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Merit Scholarship 2025" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={scholarshipForm.type} onValueChange={v => setScholarshipForm(f => ({ ...f, type: v as Scholarship["type"] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Merit", "Need-based", "Sports", "Special"].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (Rs.)</Label>
                    <Input type="number" min="0" value={scholarshipForm.amount}
                      onChange={e => setScholarshipForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Slots</Label>
                    <Input type="number" min="1" value={scholarshipForm.totalSlots}
                      onChange={e => setScholarshipForm(f => ({ ...f, totalSlots: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Eligibility Criteria</Label>
                  <Textarea rows={3} value={scholarshipForm.eligibilityCriteria}
                    onChange={e => setScholarshipForm(f => ({ ...f, eligibilityCriteria: e.target.value }))}
                    placeholder="Describe eligibility..." />
                </div>
              </div>
              <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button className="bg-primary hover:bg-primary/90" onClick={handleCreateScholarship}>Create Program</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-none shadow-sm bg-[#0B1B3D] text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-white/10"><BadgePercent className="h-6 w-6" /></div>
              <div>
                <p className="text-white/60 text-sm font-medium">Scholarships</p>
                <h3 className="text-2xl font-bold">{scholarships.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-50"><Users className="h-6 w-6 text-blue-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Available Slots</p>
                <h3 className="text-2xl font-bold">{availableSlots} <span className="text-xs text-muted-foreground font-normal">/ {totalSlots}</span></h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-50"><Award className="h-6 w-6 text-green-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Total Awarded</p>
                <h3 className="text-2xl font-bold">{formatCurrency(totalAwarded)}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-50"><Clock className="h-6 w-6 text-amber-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Pending Apps</p>
                <h3 className="text-2xl font-bold">{applications.filter(a => a.status === "Pending").length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="programs">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="programs" className="gap-2"><BadgePercent className="h-4 w-4" /> Programs</TabsTrigger>
          <TabsTrigger value="applications" className="gap-2">
            <Users className="h-4 w-4" /> Applications
            {applications.filter(a => a.status === "Pending").length > 0 && (
              <Badge className="ml-1 h-5 px-1.5 bg-amber-500 text-white text-[10px]">{applications.filter(a => a.status === "Pending").length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="financial-aid" className="gap-2"><DollarSign className="h-4 w-4" /> Financial Aid</TabsTrigger>
        </TabsList>

        <TabsContent value="programs">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">Scholarship Programs</CardTitle>
              <CardDescription>Active and available scholarship opportunities</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold py-4">Program Name</TableHead>
                    <TableHead className="font-bold">Type</TableHead>
                    <TableHead className="font-bold text-right">Amount</TableHead>
                    <TableHead className="font-bold text-center">Slots</TableHead>
                    <TableHead className="font-bold">Eligibility</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <>{[1,2,3,4].map(i => <TableRow key={i}>{[32,16,20,16,24,16].map((w,j) => <TableCell key={j} className={j===2?"text-right":j===5?"text-center":""}><Skeleton className={`h-4 w-${w}`} /></TableCell>)}</TableRow>)}</>
                  ) : scholarships.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No scholarship programs yet.</TableCell></TableRow>
                  ) : scholarships.map(s => (
                    <TableRow key={s.id} className="hover:bg-secondary/5 transition-colors">
                      <TableCell className="font-semibold text-primary">{s.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${SCHOLARSHIP_TYPE_COLORS[s.type] ?? ""} border-0 text-xs`}>{s.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(s.amount)}</TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold">{s.availableSlots}</span>
                        <span className="text-muted-foreground text-xs"> / {s.totalSlots}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{s.eligibilityCriteria || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={s.isActive ? "bg-green-100 text-green-700 border-none" : "bg-gray-100 text-gray-700 border-none"}>
                          {s.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 border-b border-secondary/50">
              <div>
                <CardTitle className="text-lg">Scholarship Applications</CardTitle>
                <CardDescription>Review and manage student applications</CardDescription>
              </div>
              <div className="flex gap-1 flex-wrap">
                {["All", "Pending", "Approved", "Rejected"].map(s => (
                  <Button key={s} size="sm" variant={appFilter === s ? "default" : "outline"}
                    className={`h-7 text-xs ${appFilter === s ? "bg-primary" : ""}`}
                    onClick={() => setAppFilter(s)}>{s}</Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold py-4">Student</TableHead>
                    <TableHead className="font-bold">Program</TableHead>
                    <TableHead className="font-bold text-right">Score</TableHead>
                    <TableHead className="font-bold text-right">Income</TableHead>
                    <TableHead className="font-bold">Applied</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApps.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No applications found.</TableCell></TableRow>
                  ) : filteredApps.map(a => (
                    <TableRow key={a.id} className="hover:bg-secondary/5 transition-colors">
                      <TableCell className="font-semibold text-primary">{a.studentName}</TableCell>
                      <TableCell className="text-sm">{a.scholarshipName}</TableCell>
                      <TableCell className="text-right font-medium">{a.academicScore}%</TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">{formatCurrency(a.familyIncome)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(a.appliedAt)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`${APP_STATUS_COLORS[a.status] ?? ""} text-xs`}>{a.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {a.status === "Pending" && (activeRole === "ADMIN" || activeRole === "PRINCIPAL") && (
                          <div className="flex items-center gap-1">
                            <Button size="sm" className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleApprove(a)}><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-600 border-red-300 hover:bg-red-50"
                              onClick={() => handleReject(a)}><XCircle className="h-3.5 w-3.5" /></Button>
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

        <TabsContent value="financial-aid">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">Financial Aid Records</CardTitle>
              <CardDescription>Tracked financial assistance disbursements</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold py-4">Student</TableHead>
                    <TableHead className="font-bold">Aid Type</TableHead>
                    <TableHead className="font-bold text-right">Amount</TableHead>
                    <TableHead className="font-bold">Duration</TableHead>
                    <TableHead className="font-bold">Approved</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financialAid.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No financial aid records.</TableCell></TableRow>
                  ) : financialAid.map(f => (
                    <TableRow key={f.id} className="hover:bg-secondary/5 transition-colors">
                      <TableCell className="font-semibold text-primary">{f.studentName}</TableCell>
                      <TableCell className="text-sm">{f.aidType}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(f.amount)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.duration}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(f.approvedAt)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={
                          f.status === "Active" ? "bg-green-100 text-green-700 border-none" :
                          f.status === "Completed" ? "bg-blue-100 text-blue-700 border-none" :
                          "bg-gray-100 text-gray-700 border-none"
                        }>{f.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
