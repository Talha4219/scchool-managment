"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppState } from "@/lib/state-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { Plus, Search, Users, BookOpen, UserCheck, GraduationCap, Trash2, X, ShieldAlert, AlertTriangle, Download } from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";
import {
  fetchAcademicYearsDB, fetchClassesDB, fetchAllSectionsDB, fetchSectionsByClassDB,
  fetchTeacherAssignmentsDB, createTeacherAssignmentDB, deleteTeacherAssignmentDB,
} from "@/app/actions/academic-core";
import {
  fetchUsersDB, createTeacherWithProfileDB, fetchAllTeacherProfilesDB, updateTeacherStatusDB,
  fetchPayScalesDB, createPayScaleDB,
  fetchTeacherQualificationsDB, addTeacherQualificationDB, deleteTeacherQualificationDB,
  fetchTeacherCompetenciesDB, addTeacherCompetencyDB, deleteTeacherCompetencyDB,
  type TeacherProfile, type PayScale, type TeacherQualification, type TeacherSubjectCompetency,
} from "@/app/actions/features";
import type { AcademicYear, ClassItem, SectionItem, TeacherClassSubject, TeacherRecord } from "@/lib/types";

type DraftQualification = { degreeTitle: string; institution: string; yearCompleted: string; specialization: string };
type DraftCompetency = { subjectId: string; classId: string };

export default function TeachersPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { can, loaded: permsLoaded } = usePermission();
  const { subjects } = useAppState();

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [activeYearId, setActiveYearId] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [profiles, setProfiles] = useState<Record<number, TeacherProfile>>({});
  const [payScales, setPayScales] = useState<PayScale[]>([]);
  const [assignments, setAssignments] = useState<TeacherClassSubject[]>([]);
  const [competencies, setCompetencies] = useState<TeacherSubjectCompetency[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Add Teacher dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addStep, setAddStep] = useState<"profile" | "qualifications" | "competency">("profile");
  const [addForm, setAddForm] = useState({
    name: "", email: "", password: "", phone: "", cnic: "",
    employeeId: "", employmentType: "fulltime", designation: "", payScaleId: "",
    specialization: "", qualification: "", experienceYears: "", joiningDate: "", address: "",
  });
  const [draftQualifications, setDraftQualifications] = useState<DraftQualification[]>([{ degreeTitle: "", institution: "", yearCompleted: "", specialization: "" }]);
  const [draftCompetencies, setDraftCompetencies] = useState<DraftCompetency[]>([{ subjectId: "", classId: "" }]);
  const [adding, setAdding] = useState(false);

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ teacherId: "", classId: "", sectionId: "", subjectId: "" });
  const [confirmOverride, setConfirmOverride] = useState<null | { teacherId: number; classId: string; sectionId: string; subjectId: string }>(null);

  // New pay scale inline
  const [newScaleLabel, setNewScaleLabel] = useState("");

  const loadContext = useCallback(async () => {
    setLoading(true);
    const years = await fetchAcademicYearsDB();
    setAcademicYears(years);
    const active = years.find(y => y.isActive) || years[0];
    if (active) {
      setActiveYearId(active.id);
      setClasses(await fetchClassesDB(active.id));
    }
    const [users, allProfiles, scales, allCompetencies] = await Promise.all([
      fetchUsersDB(), fetchAllTeacherProfilesDB(), fetchPayScalesDB(), fetchTeacherCompetenciesDB(),
    ]);
    setPayScales(scales);
    setCompetencies(allCompetencies);
    const dbTeachers: TeacherRecord[] = (users as any[]).filter(u => u.role === "TEACHER").map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
    if (dbTeachers.length === 0) {
      const fallbackSections = await fetchAllSectionsDB();
      const names = fallbackSections
        .map(s => s.teacherName)
        .filter((name): name is string => !!name && name.trim() !== "")
        .filter((name, i, arr) => arr.indexOf(name) === i)
        .map((name, i) => ({ id: -(i + 1), name, email: "", role: "TEACHER" }));
      setTeachers(names);
    } else {
      setTeachers(dbTeachers);
      setProfiles(Object.fromEntries(allProfiles.map(p => [p.userId, p])));
    }
    setLoading(false);
  }, []);

  const loadAssignments = useCallback(async () => {
    if (!activeYearId) return;
    setAssignments(await fetchTeacherAssignmentsDB(undefined, activeYearId));
  }, [activeYearId]);

  useEffect(() => { loadContext(); }, [loadContext]);
  useEffect(() => { loadAssignments(); }, [loadAssignments]);
  useEffect(() => {
    if (assignForm.classId) fetchSectionsByClassDB(assignForm.classId).then(setSections);
  }, [assignForm.classId]);

  const resetAddForm = () => {
    setAddForm({ name: "", email: "", password: "", phone: "", cnic: "", employeeId: "", employmentType: "fulltime", designation: "", payScaleId: "", specialization: "", qualification: "", experienceYears: "", joiningDate: "", address: "" });
    setDraftQualifications([{ degreeTitle: "", institution: "", yearCompleted: "", specialization: "" }]);
    setDraftCompetencies([{ subjectId: "", classId: "" }]);
    setAddStep("profile");
  };

  const handleAddTeacher = async () => {
    if (!addForm.name || !addForm.email || !addForm.password) {
      toast({ title: "Name, email and password are required", variant: "destructive" }); return;
    }
    const validQualifications = draftQualifications.filter(q => q.degreeTitle.trim());
    if (validQualifications.length === 0) {
      toast({ title: "At least one qualification is required", variant: "destructive" });
      setAddStep("qualifications");
      return;
    }
    setAdding(true);
    const res = await createTeacherWithProfileDB(addForm.name, addForm.email, addForm.password, {
      phone: addForm.phone, cnic: addForm.cnic, specialization: addForm.specialization,
      qualification: addForm.qualification, experienceYears: parseInt(addForm.experienceYears) || 0,
      joiningDate: addForm.joiningDate, address: addForm.address, profilePhoto: null, degreePhoto: null,
      employeeId: addForm.employeeId || null, employmentType: addForm.employmentType as any,
      status: "active", payScaleId: addForm.payScaleId || null, designation: addForm.designation || null,
    });
    if (res.error || !res.userId) { setAdding(false); toast({ title: res.error || "Failed to create teacher", variant: "destructive" }); return; }

    await Promise.all(validQualifications.map(q => addTeacherQualificationDB({
      teacherId: res.userId!, degreeTitle: q.degreeTitle, institution: q.institution,
      yearCompleted: parseInt(q.yearCompleted) || null, specialization: q.specialization || null, certificateFilePath: null,
    })));
    const validCompetencies = draftCompetencies.filter(c => c.subjectId && c.classId);
    await Promise.all(validCompetencies.map(c => addTeacherCompetencyDB(res.userId!, c.subjectId, c.classId)));

    setAdding(false);
    setAddOpen(false);
    resetAddForm();
    loadContext();
    toast({ title: "Teacher added" });
  };

  const handleAssign = async (override = false) => {
    if (!assignForm.teacherId || !assignForm.classId || !assignForm.sectionId || !assignForm.subjectId) {
      toast({ title: "Fill all fields", variant: "destructive" }); return;
    }
    const res = await createTeacherAssignmentDB({
      teacherId: parseInt(assignForm.teacherId),
      classId: assignForm.classId,
      sectionId: assignForm.sectionId,
      subjectId: assignForm.subjectId,
      academicYearId: activeYearId,
      override,
    });
    if ((res as any)?.error === "not_competent") {
      setConfirmOverride({
        teacherId: parseInt(assignForm.teacherId), classId: assignForm.classId,
        sectionId: assignForm.sectionId, subjectId: assignForm.subjectId,
      });
      return;
    }
    setAssignOpen(false);
    setConfirmOverride(null);
    setAssignForm({ teacherId: "", classId: "", sectionId: "", subjectId: "" });
    loadAssignments();
    toast({ title: "Teacher assigned" });
  };

  const handleConfirmOverride = async () => {
    if (!confirmOverride) return;
    await createTeacherAssignmentDB({ ...confirmOverride, academicYearId: activeYearId, override: true });
    setConfirmOverride(null);
    setAssignOpen(false);
    setAssignForm({ teacherId: "", classId: "", sectionId: "", subjectId: "" });
    loadAssignments();
    toast({ title: "Teacher assigned (competency override logged)" });
  };

  const handleUnassign = async (id: string) => {
    const ok = await confirm({
      title: "Remove this assignment?",
      description: "The teacher will no longer be assigned to this class/subject. This can be re-added later, but any related timetable entries will need to be reassigned.",
    });
    if (!ok) return;
    await deleteTeacherAssignmentDB(id);
    loadAssignments();
    toast({ title: "Assignment removed" });
  };

  const handleDeactivate = async (teacherId: number, teacherName: string) => {
    const ok = await confirm({
      title: `Deactivate ${teacherName}?`,
      description: "They will immediately lose portal access. Their class assignments and records are kept and can be restored by reactivating them.",
      confirmLabel: "Deactivate",
    });
    if (!ok) return;
    const res = await updateTeacherStatusDB(teacherId, "inactive");
    if (res.error) {
      toast({ title: res.error, variant: "destructive" });
      return;
    }
    loadContext();
    toast({ title: "Teacher deactivated" });
  };

  const handleReactivate = async (teacherId: number) => {
    await updateTeacherStatusDB(teacherId, "active");
    loadContext();
    toast({ title: "Teacher reactivated" });
  };

  const handleAddPayScale = async () => {
    if (!newScaleLabel.trim()) return;
    const res = await createPayScaleDB(newScaleLabel.trim(), payScales.length);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    setNewScaleLabel("");
    const scales = await fetchPayScalesDB();
    setPayScales(scales);
    if (res.id) setAddForm(f => ({ ...f, payScaleId: res.id! }));
  };

  const payScaleLabel = (id: string | null) => payScales.find(p => p.id === id)?.label || null;

  const teacherAssignments = teachers.map(t => ({
    ...t,
    subjects: assignments.filter(a => a.teacherId === t.id),
    profile: profiles[t.id] as TeacherProfile | undefined,
    competent: competencies.filter(c => c.teacherId === t.id),
  }));

  const filtered = teacherAssignments.filter(t => {
    if (!t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && (t.profile?.status || "active") !== statusFilter) return false;
    if (subjectFilter !== "all" && !t.competent.some(c => c.subjectId === subjectFilter)) return false;
    if (classFilter !== "all" && !t.competent.some(c => c.classId === classFilter)) return false;
    return true;
  });

  const assignSubjectClassCompetent = useMemo(() => {
    if (!assignForm.teacherId || !assignForm.classId || !assignForm.subjectId) return true;
    return competencies.some(c => c.teacherId === parseInt(assignForm.teacherId) && c.subjectId === assignForm.subjectId && c.classId === assignForm.classId);
  }, [assignForm, competencies]);

  // Narrow the Subject picker to this teacher's declared competencies for the
  // selected class — "the subject selected for the teacher is its subject."
  // Falls back to the full subject list if the teacher has no competencies
  // declared yet, so onboarding gaps don't block assignment entirely.
  const assignTeacherSubjectIds = useMemo(() => {
    if (!assignForm.teacherId) return null;
    const teacherId = parseInt(assignForm.teacherId);
    const relevant = assignForm.classId
      ? competencies.filter(c => c.teacherId === teacherId && c.classId === assignForm.classId)
      : competencies.filter(c => c.teacherId === teacherId);
    if (relevant.length === 0) return null;
    return new Set(relevant.map(c => c.subjectId));
  }, [assignForm.teacherId, assignForm.classId, competencies]);

  const assignSubjectOptions = assignTeacherSubjectIds
    ? subjects.filter(s => assignTeacherSubjectIds.has(s.id))
    : subjects;

  if (!permsLoaded) return null;
  if (!can("teachers.view")) return <Unauthorized />;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-7 w-40 mb-2" /><Skeleton className="h-4 w-64" /></div>
          <div className="flex gap-2"><Skeleton className="h-10 w-40 rounded-md" /><Skeleton className="h-10 w-36 rounded-md" /></div>
        </div>
        <Skeleton className="h-10 max-w-sm rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="border-[#E5E7EB]">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div><Skeleton className="h-4 w-28 mb-1" /><Skeleton className="h-3 w-36" /></div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-5 w-20 rounded-full mb-2" />
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-8 w-full rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="dashboard-heading !text-2xl">Teachers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage teachers, qualifications, subject competency, and class assignments</p>
        </div>
        <div className="flex gap-2">
          <Select value={activeYearId} onValueChange={setActiveYearId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>{academicYears.map(y => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Teacher
          </Button>
          <Button onClick={() => setAssignOpen(true)}>
            <UserCheck className="h-4 w-4 mr-1" /> Assign Teacher
          </Button>
        </div>
      </div>

      {/* Search + Filters — "who can cover this class" */}
      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search teachers..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Qualified subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any subject</SelectItem>
            {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Qualified grade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any grade</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_leave">On Leave</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => {
          exportToCsv("teachers", ["Name", "Email", "Phone", "Status", "Subjects Assigned"],
            filtered.map(t => [t.name, t.email, t.phone || "", t.profile?.status || "active", t.subjects.map(s => s.subjectName).join("; ")]));
        }}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      {/* Teacher Cards with Assignments */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No teachers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => {
            const status = t.profile?.status || "active";
            return (
              <Card key={t.id} className="border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="font-semibold text-primary text-sm">{t.name.charAt(0)}</span>
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{t.name}</h3>
                        <p className="text-xs text-muted-foreground">{t.email}</p>
                        {t.profile?.employeeId && <p className="text-[10px] text-muted-foreground font-mono">ID: {t.profile.employeeId}</p>}
                      </div>
                    </div>
                    <Badge variant={status === "active" ? "default" : status === "on_leave" ? "secondary" : "outline"} className="text-[10px] shrink-0">
                      {status === "on_leave" ? "On Leave" : status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {t.profile?.designation && <Badge variant="secondary" className="text-xs">{t.profile.designation}</Badge>}
                    {payScaleLabel(t.profile?.payScaleId || null) && <Badge variant="outline" className="text-xs">{payScaleLabel(t.profile?.payScaleId || null)}</Badge>}
                  </div>

                  {t.competent.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] text-muted-foreground font-medium mb-1">Qualified to teach</p>
                      <div className="flex flex-wrap gap-1">
                        {t.competent.slice(0, 4).map(c => (
                          <span key={c.id} className="text-[10px] bg-secondary/70 text-secondary-foreground rounded-full px-2 py-0.5">
                            {c.subjectName} · {c.className}
                          </span>
                        ))}
                        {t.competent.length > 4 && <span className="text-[10px] text-muted-foreground">+{t.competent.length - 4} more</span>}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1 mb-2">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{t.subjects.length} assignment{t.subjects.length !== 1 ? "s" : ""}</span>
                  </div>
                  {t.subjects.length > 0 ? (
                    <div className="space-y-1">
                      {t.subjects.map(a => (
                        <div key={a.id} className="flex items-center justify-between bg-secondary/50 rounded px-2 py-1.5 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <GraduationCap className="h-3 w-3 text-primary shrink-0" />
                            <span className="font-medium truncate">{a.subjectName}</span>
                            <span className="text-muted-foreground truncate">— {a.className} / {a.sectionName}</span>
                          </div>
                          <button onClick={() => handleUnassign(a.id)} className="text-destructive/70 hover:text-destructive ml-1 shrink-0">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No assignments yet</p>
                  )}

                  {t.id > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      {status === "inactive" ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={() => handleReactivate(t.id)}>Reactivate</Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs w-full text-destructive hover:text-destructive" onClick={() => handleDeactivate(t.id, t.name)}>
                          Deactivate
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Teacher Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetAddForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add New Teacher</DialogTitle></DialogHeader>

          <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 mb-1">
            {(["profile", "qualifications", "competency"] as const).map(step => (
              <button key={step} onClick={() => setAddStep(step)}
                className={`flex-1 text-xs font-semibold rounded-md py-1.5 capitalize transition-colors ${addStep === step ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                {step === "profile" ? "1. Profile" : step === "qualifications" ? "2. Qualifications" : "3. Competency"}
              </button>
            ))}
          </div>

          {addStep === "profile" && (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name *</Label><Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>Employee ID</Label><Input value={addForm.employeeId} onChange={e => setAddForm(f => ({ ...f, employeeId: e.target.value }))} placeholder="Auto-suggested if blank" /></div>
              </div>
              <div><Label>Email *</Label><Input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Password *</Label><Input type="password" value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Phone</Label><Input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><Label>CNIC</Label><Input value={addForm.cnic} onChange={e => setAddForm(f => ({ ...f, cnic: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Employment Type</Label>
                  <Select value={addForm.employmentType} onValueChange={v => setAddForm(f => ({ ...f, employmentType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fulltime">Full-time</SelectItem>
                      <SelectItem value="parttime">Part-time</SelectItem>
                      <SelectItem value="visiting">Visiting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Joining Date</Label><Input type="date" value={addForm.joiningDate} onChange={e => setAddForm(f => ({ ...f, joiningDate: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Designation</Label><Input value={addForm.designation} onChange={e => setAddForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g. Senior Physics Teacher" /></div>
                <div>
                  <Label>Pay Scale</Label>
                  <Select value={addForm.payScaleId} onValueChange={v => setAddForm(f => ({ ...f, payScaleId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select scale" /></SelectTrigger>
                    <SelectContent>
                      {payScales.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                      <div className="flex items-center gap-1 p-1.5 border-t border-border mt-1">
                        <Input value={newScaleLabel} onChange={e => setNewScaleLabel(e.target.value)} placeholder="New scale e.g. BPS-17" className="h-7 text-xs" onClick={e => e.stopPropagation()} />
                        <Button type="button" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); handleAddPayScale(); }}>Add</Button>
                      </div>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Address</Label><Input value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="flex justify-end"><Button size="sm" onClick={() => setAddStep("qualifications")}>Next: Qualifications</Button></div>
            </div>
          )}

          {addStep === "qualifications" && (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              <p className="text-xs text-muted-foreground">At least one qualification is required.</p>
              {draftQualifications.map((q, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2 relative">
                  {draftQualifications.length > 1 && (
                    <button className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                      onClick={() => setDraftQualifications(list => list.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Degree Title *</Label><Input className="h-8 text-sm" value={q.degreeTitle} placeholder="e.g. B.Ed" onChange={e => setDraftQualifications(list => list.map((x, idx) => idx === i ? { ...x, degreeTitle: e.target.value } : x))} /></div>
                    <div><Label className="text-xs">Institution</Label><Input className="h-8 text-sm" value={q.institution} onChange={e => setDraftQualifications(list => list.map((x, idx) => idx === i ? { ...x, institution: e.target.value } : x))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Year Completed</Label><Input className="h-8 text-sm" type="number" value={q.yearCompleted} onChange={e => setDraftQualifications(list => list.map((x, idx) => idx === i ? { ...x, yearCompleted: e.target.value } : x))} /></div>
                    <div><Label className="text-xs">Specialization</Label><Input className="h-8 text-sm" value={q.specialization} onChange={e => setDraftQualifications(list => list.map((x, idx) => idx === i ? { ...x, specialization: e.target.value } : x))} /></div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setDraftQualifications(list => [...list, { degreeTitle: "", institution: "", yearCompleted: "", specialization: "" }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Qualification
              </Button>
              <div className="flex justify-between">
                <Button variant="ghost" size="sm" onClick={() => setAddStep("profile")}>Back</Button>
                <Button size="sm" onClick={() => setAddStep("competency")}>Next: Competency</Button>
              </div>
            </div>
          )}

          {addStep === "competency" && (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              <p className="text-xs text-muted-foreground">Subjects &amp; grade levels this teacher is qualified to teach — independent of this year's actual assignment.</p>
              {draftCompetencies.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={c.subjectId} onValueChange={v => setDraftCompetencies(list => list.map((x, idx) => idx === i ? { ...x, subjectId: v } : x))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Subject" /></SelectTrigger>
                    <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={c.classId} onValueChange={v => setDraftCompetencies(list => list.map((x, idx) => idx === i ? { ...x, classId: v } : x))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Grade" /></SelectTrigger>
                    <SelectContent>{classes.map(cl => <SelectItem key={cl.id} value={cl.id}>{cl.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {draftCompetencies.length > 1 && (
                    <button className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => setDraftCompetencies(list => list.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setDraftCompetencies(list => [...list, { subjectId: "", classId: "" }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
              </Button>
              <div className="flex justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={() => setAddStep("qualifications")}>Back</Button>
                <Button onClick={handleAddTeacher} disabled={adding}>{adding ? "Adding..." : "Save Teacher"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Teacher to Class</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Teacher</Label>
              <Select value={assignForm.teacherId} onValueChange={v => setAssignForm({ ...assignForm, teacherId: v, subjectId: "" })}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Class</Label>
              <Select value={assignForm.classId} onValueChange={v => setAssignForm({ ...assignForm, classId: v, sectionId: "", subjectId: "" })}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Section</Label>
              <Select value={assignForm.sectionId} onValueChange={v => setAssignForm({ ...assignForm, sectionId: v })}>
                <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Subject</Label>
              <Select value={assignForm.subjectId} onValueChange={v => setAssignForm({ ...assignForm, subjectId: v })}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>{assignSubjectOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              {assignTeacherSubjectIds && (
                <p className="text-[11px] text-muted-foreground mt-1">Showing only subjects this teacher is qualified to teach in this class.</p>
              )}
            </div>
            {!assignSubjectClassCompetent && (
              <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 p-2.5">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">This teacher isn't declared competent for this subject/grade. You'll be asked to confirm an override.</p>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={() => handleAssign(false)}>Assign</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Competency override confirmation */}
      <Dialog open={!!confirmOverride} onOpenChange={(o) => !o && setConfirmOverride(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-warning" /> Confirm Competency Override</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This teacher hasn't been declared qualified for this subject/grade combination. Assigning anyway will be recorded as an admin override on this assignment.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOverride(null)}>Cancel</Button>
            <Button onClick={handleConfirmOverride}>Assign Anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
