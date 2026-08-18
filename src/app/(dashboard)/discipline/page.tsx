"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppState } from "@/lib/state-context";
import { formatDatePK } from "@/lib/date-format";
import { useStudents } from "@/lib/students-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { fetchIncidentsDB, createIncidentDB, updateIncidentStatusDB } from "@/app/actions/features";
import type { IncidentReport, CounselingRecord, DisciplinaryAction } from "@/lib/types";
import {
  Shield, AlertTriangle, Plus, Search, CheckCircle2, ArrowRight,
  RotateCcw, XCircle, User, Calendar, MapPin, Eye, ThumbsUp, ThumbsDown,
} from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  Low: "bg-green-50 text-green-700 border-green-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  Critical: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-50 text-blue-700 border-blue-200",
  Investigating: "bg-amber-50 text-amber-700 border-amber-200",
  Resolved: "bg-green-50 text-green-700 border-green-200",
  Closed: "bg-gray-50 text-gray-700 border-gray-200",
};

const INCIDENT_TYPES = [
  "Bullying", "Fighting", "Cheating", "Disrespect", "Vandalism",
  "Truancy", "Cyber Misconduct", "Substance Abuse", "Harassment",
  "Uniform Violation", "Disruption", "Other",
];

const STATUS_FLOW: Record<string, string[]> = {
  Open: ["Investigating"],
  Investigating: ["Resolved", "Open"],
  Resolved: ["Closed", "Investigating"],
  Closed: ["Open"],
};

function formatDate(d: string) {
  return formatDatePK(d);
}

export default function DisciplinePage() {
  const { activeRole, schoolInfo } = useAppState();
  const { students } = useStudents();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [counselingRecords, setCounselingRecords] = useState<CounselingRecord[]>([]);
  const [behaviorHistory, setBehaviorHistory] = useState<{
    id: string; studentId: string; studentName: string;
    entryDate: string; behaviorType: "Positive" | "Negative";
    description: string; recordedBy: string; points: number;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    studentId: "", incidentType: "", description: "", severity: "Medium" as IncidentReport["severity"],
    location: "", witnesses: "",
  });
  const [statusUpdateTarget, setStatusUpdateTarget] = useState<IncidentReport | null>(null);
  const [actionForm, setActionForm] = useState({ actionTaken: "" });
  const [incidentFilter, setIncidentFilter] = useState<string>("All");
  const [counselForm, setCounselForm] = useState({
    studentId: "", type: "Behavioral", notes: "", outcome: "", followUpDate: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchIncidentsDB();
    setIncidents(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredIncidents = incidentFilter === "All" ? incidents : incidents.filter(i => i.status === incidentFilter);

  const totalIncidents = incidents.length;
  const criticalCount = incidents.filter(i => i.severity === "Critical").length;
  const highCount = incidents.filter(i => i.severity === "High").length;
  const pendingAction = incidents.filter(i => i.status === "Open" || i.status === "Investigating").length;
  const positivePoints = behaviorHistory.filter(b => b.behaviorType === "Positive").reduce((s, b) => s + b.points, 0);
  const negativePoints = behaviorHistory.filter(b => b.behaviorType === "Negative").reduce((s, b) => s + b.points, 0);

  const handleCreateIncident = async () => {
    if (!form.studentId || !form.incidentType || !form.description) {
      toast({ title: "Student, type and description are required.", variant: "destructive" }); return;
    }
    const student = students.find(s => s.id === form.studentId);
    if (!student) return;
    const res = await createIncidentDB({
      studentId: student.id, studentName: student.name,
      class: `${student.class}-${student.section}`,
      reportedBy: activeRole || "Admin",
      incidentDate: new Date().toISOString().split("T")[0],
      incidentType: form.incidentType, description: form.description,
      severity: form.severity, location: form.location, witnesses: form.witnesses,
      status: "Open", actionTaken: "", resolvedAt: "",
    });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Incident reported." });
    setCreateOpen(false);
    setForm({ studentId: "", incidentType: "", description: "", severity: "Medium", location: "", witnesses: "" });
    load();
  };

  const handleUpdateStatus = async () => {
    if (!statusUpdateTarget) return;
    const status = statusUpdateTarget.status;
    const res = await updateIncidentStatusDB(
      statusUpdateTarget.id,
      status === "Open" ? "Investigating" :
      status === "Investigating" ? "Resolved" :
      status === "Resolved" ? "Closed" : "Open",
      actionForm.actionTaken
    );
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: `Status updated to ${
      status === "Open" ? "Investigating" :
      status === "Investigating" ? "Resolved" :
      status === "Resolved" ? "Closed" : "Open"
    }.` });
    setStatusUpdateTarget(null);
    setActionForm({ actionTaken: "" });
    load();
  };

  const handleAddCounseling = () => {
    if (!counselForm.studentId || !counselForm.notes) {
      toast({ title: "Student and notes required.", variant: "destructive" }); return;
    }
    const student = students.find(s => s.id === counselForm.studentId);
    if (!student) return;
    const record: CounselingRecord = {
      id: `cr_${Date.now()}`, studentId: student.id, studentName: student.name,
      counselorName: activeRole || "Admin",
      sessionDate: new Date().toISOString().split("T")[0],
      type: counselForm.type as CounselingRecord["type"],
      notes: counselForm.notes, outcome: counselForm.outcome,
      followUpDate: counselForm.followUpDate,
    };
    setCounselingRecords(prev => [record, ...prev]);
    setCounselForm({ studentId: "", type: "Behavioral", notes: "", outcome: "", followUpDate: "" });
    toast({ title: "Counseling session recorded." });
  };

  const handleAddBehavior = (type: "Positive" | "Negative") => {
    const studentId = prompt("Student ID:");
    if (!studentId) return;
    const student = students.find(s => s.id === studentId);
    if (!student) { toast({ title: "Student not found.", variant: "destructive" }); return; }
    const desc = prompt("Description:");
    if (!desc) return;
    const pts = parseInt(prompt("Points:") || "1", 10);
    setBehaviorHistory(prev => [{
      id: `bh_${Date.now()}`, studentId: student.id, studentName: student.name,
      entryDate: new Date().toISOString().split("T")[0],
      behaviorType: type, description: desc, recordedBy: activeRole || "Admin", points: isNaN(pts) ? 1 : pts,
    }, ...prev]);
    toast({ title: `${type} behavior point recorded.` });
  };

  const getNextStatus = (status: string) => {
    const flow: Record<string, string> = {
      Open: "Investigating",
      Investigating: "Resolved",
      Resolved: "Closed",
      Closed: "Open",
    };
    return flow[status] || "Open";
  };

  const getStatusAction = (status: string) => {
    const labels: Record<string, string> = {
      Open: "Start Investigation",
      Investigating: "Mark Resolved",
      Resolved: "Close",
      Closed: "Reopen",
    };
    return labels[status] || "Update";
  };

  if (!permsLoaded) return null;
  if (!can("discipline.view")) return <Unauthorized />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Discipline & Behavior</h1>
          <p className="text-muted-foreground mt-1">Incident reporting, counseling, and behavior tracking for {schoolInfo.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2 border-green-400 text-green-700 hover:bg-green-50"
            onClick={() => handleAddBehavior("Positive")}>
            <ThumbsUp className="h-4 w-4" /> +Positive
          </Button>
          <Button variant="outline" className="gap-2 border-red-400 text-red-700 hover:bg-red-50"
            onClick={() => handleAddBehavior("Negative")}>
            <ThumbsDown className="h-4 w-4" /> +Negative
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 gap-2"><Plus className="h-4 w-4" /> Report Incident</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg border-secondary">
              <DialogHeader>
                <DialogTitle className="font-headline font-bold text-primary">Report an Incident</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select value={form.studentId} onValueChange={v => setForm(f => ({ ...f, studentId: v }))}>
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
                    <Label>Incident Type</Label>
                    <Select value={form.incidentType} onValueChange={v => setForm(f => ({ ...f, incidentType: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {INCIDENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Severity</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["Low", "Medium", "High", "Critical"] as const).map(s => (
                        <button key={s} type="button"
                          onClick={() => setForm(f => ({ ...f, severity: s }))}
                          className={`py-1.5 px-2 rounded-lg border text-xs font-semibold transition-all ${form.severity === s ? "bg-primary text-white border-primary" : "border-secondary text-muted-foreground hover:border-primary/50"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea rows={3} value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Detailed incident description..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input value={form.location}
                      onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="e.g. Classroom, Playground..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Witnesses</Label>
                    <Input value={form.witnesses}
                      onChange={e => setForm(f => ({ ...f, witnesses: e.target.value }))}
                      placeholder="Names (comma separated)" />
                  </div>
                </div>
              </div>
              <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button className="bg-primary hover:bg-primary/90" onClick={handleCreateIncident}>Submit Report</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-none shadow-sm bg-[#0B1B3D] text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-white/10"><Shield className="h-6 w-6" /></div>
              <div>
                <p className="text-white/60 text-sm font-medium">Total Incidents</p>
                <h3 className="text-2xl font-bold">{totalIncidents}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-50"><AlertTriangle className="h-6 w-6 text-red-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Critical / High</p>
                <h3 className="text-2xl font-bold">{criticalCount + highCount}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-50"><ArrowRight className="h-6 w-6 text-amber-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Pending Action</p>
                <h3 className="text-2xl font-bold">{pendingAction}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-50"><CheckCircle2 className="h-6 w-6 text-green-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Behavior Points</p>
                <h3 className="text-2xl font-bold">
                  <span className="text-green-700">+{positivePoints}</span>
                  <span className="text-xs mx-1">/</span>
                  <span className="text-red-700">-{negativePoints}</span>
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="incidents">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="incidents" className="gap-2"><Shield className="h-4 w-4" /> Incidents</TabsTrigger>
          <TabsTrigger value="counseling" className="gap-2"><User className="h-4 w-4" /> Counseling</TabsTrigger>
          <TabsTrigger value="behavior" className="gap-2">
            {positivePoints >= negativePoints ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />} Behavior
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incidents">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 border-b border-secondary/50">
              <div>
                <CardTitle className="text-lg">Incident Reports</CardTitle>
                <CardDescription>Track and manage disciplinary incidents</CardDescription>
              </div>
              <div className="flex gap-1 flex-wrap">
                {["All", "Open", "Investigating", "Resolved", "Closed"].map(s => (
                  <Button key={s} size="sm" variant={incidentFilter === s ? "default" : "outline"}
                    className={`h-7 text-xs ${incidentFilter === s ? "bg-primary" : ""}`}
                    onClick={() => setIncidentFilter(s)}>{s}</Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold py-4">Student</TableHead>
                    <TableHead className="font-bold">Type</TableHead>
                    <TableHead className="font-bold">Severity</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Location</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="font-bold w-[160px]">Action Taken</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <>{[1,2,3,4].map(i => <TableRow key={i}>{[28,16,16,16,16,16,24,8].map((w,j) => <TableCell key={j} className={j===7?"text-right":""}><Skeleton className={`h-4 w-${w}`} /></TableCell>)}</TableRow>)}</>
                  ) : filteredIncidents.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No incidents found.</TableCell></TableRow>
                  ) : filteredIncidents.map(inc => (
                    <TableRow key={inc.id} className="hover:bg-secondary/5 transition-colors">
                      <TableCell>
                        <div className="font-semibold text-primary">{inc.studentName}</div>
                        <div className="text-[10px] text-muted-foreground">{inc.class}</div>
                      </TableCell>
                      <TableCell className="text-sm">{inc.incidentType}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${SEVERITY_COLORS[inc.severity] ?? ""} border-0 text-xs`}>{inc.severity}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(inc.incidentDate)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{inc.location || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`${STATUS_COLORS[inc.status] ?? ""} text-xs`}>{inc.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{inc.actionTaken || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                            onClick={() => {
                              setStatusUpdateTarget(inc);
                              setActionForm({ actionTaken: actionForm.actionTaken || inc.actionTaken });
                            }}>
                            <ArrowRight className="h-3 w-3" /> {getStatusAction(inc.status)}
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

        <TabsContent value="counseling">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 border-b border-secondary/50">
              <div>
                <CardTitle className="text-lg">Counseling Records</CardTitle>
                <CardDescription>Student counseling and guidance sessions</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90"><Plus className="h-4 w-4" /> Add Session</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md border-secondary">
                  <DialogHeader>
                    <DialogTitle className="font-headline font-bold text-primary">Record Counseling Session</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Student</Label>
                      <Select value={counselForm.studentId} onValueChange={v => setCounselForm(f => ({ ...f, studentId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select student..." /></SelectTrigger>
                        <SelectContent>
                          {students.filter(s => s.status === "Active").map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name} — {s.class}-{s.section}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Session Type</Label>
                      <Select value={counselForm.type} onValueChange={v => setCounselForm(f => ({ ...f, type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Academic", "Behavioral", "Career", "Personal"].map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea rows={3} value={counselForm.notes}
                        onChange={e => setCounselForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Session notes..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Outcome (optional)</Label>
                      <Textarea rows={2} value={counselForm.outcome}
                        onChange={e => setCounselForm(f => ({ ...f, outcome: e.target.value }))}
                        placeholder="Outcome of the session..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Follow-up Date (optional)</Label>
                      <Input type="date" value={counselForm.followUpDate}
                        onChange={e => setCounselForm(f => ({ ...f, followUpDate: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                    <Button variant="outline" onClick={() => setCounselForm({ studentId: "", type: "Behavioral", notes: "", outcome: "", followUpDate: "" })}>Cancel</Button>
                    <Button className="bg-primary hover:bg-primary/90" onClick={handleAddCounseling}>Save Session</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold py-4">Student</TableHead>
                    <TableHead className="font-bold">Type</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Counselor</TableHead>
                    <TableHead className="font-bold">Notes</TableHead>
                    <TableHead className="font-bold">Outcome</TableHead>
                    <TableHead className="font-bold">Follow-up</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {counselingRecords.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No counseling records yet.</TableCell></TableRow>
                  ) : counselingRecords.map(r => (
                    <TableRow key={r.id} className="hover:bg-secondary/5 transition-colors">
                      <TableCell className="font-semibold text-primary">{r.studentName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          r.type === "Academic" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          r.type === "Behavioral" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          r.type === "Career" ? "bg-purple-50 text-purple-700 border-purple-200" :
                          "bg-green-50 text-green-700 border-green-200"
                        }>{r.type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(r.sessionDate)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.counselorName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{r.notes}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{r.outcome || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.followUpDate ? formatDate(r.followUpDate) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 border-b border-secondary/50">
              <div>
                <CardTitle className="text-lg">Behavior History</CardTitle>
                <CardDescription>Positive and negative behavior point tracking</CardDescription>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1 text-green-700 font-semibold"><ThumbsUp className="h-4 w-4" /> +{positivePoints}</span>
                <span className="flex items-center gap-1 text-red-700 font-semibold"><ThumbsDown className="h-4 w-4" /> -{negativePoints}</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold py-4">Student</TableHead>
                    <TableHead className="font-bold">Type</TableHead>
                    <TableHead className="font-bold">Description</TableHead>
                    <TableHead className="font-bold text-center">Points</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Recorded By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {behaviorHistory.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No behavior records yet. Use the +Positive or +Negative buttons above to log behavior.</TableCell></TableRow>
                  ) : behaviorHistory.map(b => (
                    <TableRow key={b.id} className="hover:bg-secondary/5 transition-colors">
                      <TableCell className="font-semibold text-primary">{b.studentName}</TableCell>
                      <TableCell>
                        <Badge className={
                          b.behaviorType === "Positive" ? "bg-green-100 text-green-700 border-none" : "bg-red-100 text-red-700 border-none"
                        }>
                          {b.behaviorType === "Positive" ? <ThumbsUp className="h-3 w-3 mr-1" /> : <ThumbsDown className="h-3 w-3 mr-1" />}
                          {b.behaviorType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{b.description}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold text-lg ${b.behaviorType === "Positive" ? "text-green-700" : "text-red-700"}`}>
                          {b.behaviorType === "Positive" ? "+" : "-"}{b.points}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(b.entryDate)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.recordedBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status Update Dialog */}
      <Dialog open={!!statusUpdateTarget} onOpenChange={() => setStatusUpdateTarget(null)}>
        <DialogContent className="max-w-md border-secondary">
          {statusUpdateTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="font-headline font-bold text-primary">Update Incident Status</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Student</p>
                    <p className="font-semibold text-primary">{statusUpdateTarget.studentName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Current Status</p>
                    <Badge variant="outline" className={`${STATUS_COLORS[statusUpdateTarget.status] ?? ""} text-xs`}>{statusUpdateTarget.status}</Badge>
                  </div>
                </div>
                <div className="text-sm">
                  <p className="text-xs text-muted-foreground font-medium">Next Status</p>
                  <p className="font-bold text-primary">{getNextStatus(statusUpdateTarget.status)}</p>
                </div>
                {(statusUpdateTarget.status === "Investigating" || statusUpdateTarget.status === "Open") && (
                  <div className="space-y-2">
                    <Label>Action Taken</Label>
                    <Textarea rows={3} value={actionForm.actionTaken}
                      onChange={e => setActionForm(f => ({ ...f, actionTaken: e.target.value }))}
                      placeholder="Describe action taken..." />
                  </div>
                )}
              </div>
              <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                <Button variant="outline" onClick={() => setStatusUpdateTarget(null)}>Cancel</Button>
                <Button className="bg-primary hover:bg-primary/90" onClick={handleUpdateStatus}>
                  {getStatusAction(statusUpdateTarget.status)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
