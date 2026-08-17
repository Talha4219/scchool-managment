"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAppState } from "@/lib/state-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  ArrowLeft, Camera, Pencil, Plus, Trash2, ShieldAlert, AlertTriangle,
  BookOpen, GraduationCap, FileText, Ban, CheckCircle2,
} from "lucide-react";
import {
  fetchTeacherProfileDB, updateTeacherProfileDB, updateTeacherStatusDB, fetchPayScalesDB,
  fetchTeacherQualificationsDB, addTeacherQualificationDB, deleteTeacherQualificationDB,
  fetchTeacherCompetenciesDB, addTeacherCompetencyDB, deleteTeacherCompetencyDB,
  fetchUsersDB, fetchLeaveRequestsDB,
  type TeacherProfile, type PayScale, type TeacherQualification, type TeacherSubjectCompetency,
} from "@/app/actions/features";
import {
  fetchAcademicYearsDB, fetchClassesDB, fetchSectionsByClassDB,
  fetchTeacherAssignmentsDB, createTeacherAssignmentDB, deleteTeacherAssignmentDB,
} from "@/app/actions/academic-core";
import type { AcademicYear, ClassItem, SectionItem, TeacherClassSubject, LeaveRequest } from "@/lib/types";
import { formatDatePK } from "@/lib/date-format";

export default function TeacherProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const confirm = useConfirm();
  const { can, loaded: permsLoaded } = usePermission();
  const { subjects } = useAppState();
  const teacherId = Number(params?.id);

  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [payScales, setPayScales] = useState<PayScale[]>([]);
  const [qualifications, setQualifications] = useState<TeacherQualification[]>([]);
  const [competencies, setCompetencies] = useState<TeacherSubjectCompetency[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [activeYearId, setActiveYearId] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [assignments, setAssignments] = useState<TeacherClassSubject[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "qualifications" | "classes" | "leave">("overview");

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: "", cnic: "", specialization: "", qualification: "", experienceYears: 0,
    joiningDate: "", address: "", employeeId: "", employmentType: "fulltime",
    designation: "", payScaleId: "",
  });
  const [saving, setSaving] = useState(false);

  const [qualForm, setQualForm] = useState({ degreeTitle: "", institution: "", yearCompleted: "", specialization: "", certificateFilePath: null as string | null });
  const [addingQual, setAddingQual] = useState(false);

  const [compForm, setCompForm] = useState({ subjectId: "", classId: "" });

  const [assignForm, setAssignForm] = useState({ classId: "", sectionId: "", subjectId: "" });
  const [assigning, setAssigning] = useState(false);
  // sectionId: null means "Whole Class" — apply the override to every section in one go.
  const [confirmOverride, setConfirmOverride] = useState<null | { classId: string; sectionId: string | null; subjectId: string }>(null);

  // silent=true skips the full-page skeleton — used after in-tab mutations
  // (add/remove competency, assign, etc.) so the page doesn't unmount its
  // content and snap the scroll position back to the top on every edit.
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!teacherId) return;
    if (!opts?.silent) setLoading(true);
    const [users, p, scales, quals, comps, leaves] = await Promise.all([
      fetchUsersDB(), fetchTeacherProfileDB(teacherId), fetchPayScalesDB(),
      fetchTeacherQualificationsDB(teacherId), fetchTeacherCompetenciesDB(teacherId),
      fetchLeaveRequestsDB(teacherId),
    ]);
    const u = (users as any[]).find(x => x.id === teacherId);
    setTeacherName(u?.name || "Unknown Teacher");
    setTeacherEmail(u?.email || "");
    setProfile(p);
    setPayScales(scales);
    setQualifications(quals);
    setCompetencies(comps);
    setLeaveRequests(leaves);
    if (p) {
      setEditForm({
        phone: p.phone, cnic: p.cnic, specialization: p.specialization, qualification: p.qualification,
        experienceYears: p.experienceYears, joiningDate: p.joiningDate || "", address: p.address,
        employeeId: p.employeeId || "", employmentType: p.employmentType, designation: p.designation || "",
        payScaleId: p.payScaleId || "",
      });
    }
    const years = await fetchAcademicYearsDB();
    setAcademicYears(years);
    const active = years.find(y => y.isActive) || years[0];
    if (active) {
      setActiveYearId(active.id);
      setClasses(await fetchClassesDB(active.id));
      setAssignments(await fetchTeacherAssignmentsDB(teacherId, active.id));
    }
    setLoading(false);
  }, [teacherId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (assignForm.classId) fetchSectionsByClassDB(assignForm.classId).then(setSections);
  }, [assignForm.classId]);

  const payScaleLabel = (id: string | null) => payScales.find(p => p.id === id)?.label || null;

  const handlePhotoUpload = (field: "profilePhoto" | "degreePhoto") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await updateTeacherProfileDB(teacherId, { [field]: reader.result as string });
      if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
      toast({ title: field === "profilePhoto" ? "Profile photo updated" : "Degree photo updated" });
      load({ silent: true });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    const res = await updateTeacherProfileDB(teacherId, {
      ...editForm,
      experienceYears: Number(editForm.experienceYears) || 0,
      employeeId: editForm.employeeId || null,
      designation: editForm.designation || null,
      payScaleId: editForm.payScaleId || null,
      employmentType: editForm.employmentType as any,
    });
    setSaving(false);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    setEditOpen(false);
    toast({ title: "Profile updated" });
    load({ silent: true });
  };

  const handleStatusChange = async (status: "active" | "on_leave" | "inactive") => {
    if (status === "inactive") {
      const ok = await confirm({ title: "Deactivate teacher?", description: "This teacher will no longer be assignable to new classes." });
      if (!ok) return;
    }
    const res = await updateTeacherStatusDB(teacherId, status);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Status updated" });
    load({ silent: true });
  };

  const handleQualCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setQualForm(f => ({ ...f, certificateFilePath: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleAddQualification = async () => {
    if (!qualForm.degreeTitle) { toast({ title: "Degree title is required", variant: "destructive" }); return; }
    setAddingQual(true);
    const res = await addTeacherQualificationDB({
      teacherId, degreeTitle: qualForm.degreeTitle, institution: qualForm.institution,
      yearCompleted: qualForm.yearCompleted ? Number(qualForm.yearCompleted) : null,
      specialization: qualForm.specialization || null, certificateFilePath: qualForm.certificateFilePath,
    });
    setAddingQual(false);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    setQualForm({ degreeTitle: "", institution: "", yearCompleted: "", specialization: "", certificateFilePath: null });
    toast({ title: "Qualification added" });
    load({ silent: true });
  };

  const handleDeleteQualification = async (id: string) => {
    const ok = await confirm({ title: "Delete qualification?", description: "This cannot be undone." });
    if (!ok) return;
    await deleteTeacherQualificationDB(id);
    toast({ title: "Qualification deleted" });
    load({ silent: true });
  };

  const handleAddCompetency = async () => {
    if (!compForm.subjectId || !compForm.classId) { toast({ title: "Select subject and class", variant: "destructive" }); return; }
    const dup = competencies.some(c => c.subjectId === compForm.subjectId && c.classId === compForm.classId);
    if (dup) { toast({ title: "Already declared for this subject and grade.", variant: "destructive" }); return; }
    await addTeacherCompetencyDB(teacherId, compForm.subjectId, compForm.classId);
    setCompForm({ subjectId: "", classId: "" });
    toast({ title: "Competency added" });
    load({ silent: true });
  };

  const handleDeleteCompetency = async (id: string) => {
    await deleteTeacherCompetencyDB(id);
    toast({ title: "Competency removed" });
    load({ silent: true });
  };

  const assignSubjectClassCompetent = useMemo(() => {
    if (!assignForm.classId || !assignForm.subjectId) return true;
    return competencies.some(c => c.subjectId === assignForm.subjectId && c.classId === assignForm.classId);
  }, [assignForm, competencies]);

  const assignTeacherSubjectIds = useMemo(() => {
    const relevant = assignForm.classId
      ? competencies.filter(c => c.classId === assignForm.classId)
      : competencies;
    if (relevant.length === 0) return null;
    return new Set(relevant.map(c => c.subjectId));
  }, [assignForm.classId, competencies]);

  const assignSubjectOptions = assignTeacherSubjectIds
    ? subjects.filter(s => assignTeacherSubjectIds.has(s.id))
    : subjects;

  // Grouped for the redesigned cards — one heading per subject/class instead
  // of a flat list, so a teacher with a dozen+ entries stays scannable.
  const competenciesBySubject = useMemo(() => {
    const map = new Map<string, { subjectName: string; items: TeacherSubjectCompetency[] }>();
    for (const c of competencies) {
      if (!map.has(c.subjectId)) map.set(c.subjectId, { subjectName: c.subjectName || c.subjectId, items: [] });
      map.get(c.subjectId)!.items.push(c);
    }
    return Array.from(map.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [competencies]);

  const assignmentsByClass = useMemo(() => {
    const map = new Map<string, { className: string; items: TeacherClassSubject[] }>();
    for (const a of assignments) {
      if (!map.has(a.classId)) map.set(a.classId, { className: a.className, items: [] });
      map.get(a.classId)!.items.push(a);
    }
    return Array.from(map.values()).sort((a, b) => a.className.localeCompare(b.className));
  }, [assignments]);

  // Sections of the currently-picked class that don't already have this exact
  // subject assignment — used both to size the "Whole Class" batch and to skip
  // sections a second "Whole Class" click would otherwise try to re-create.
  const pendingWholeClassSections = useCallback((classId: string, subjectId: string) => {
    return sections.filter(s => !assignments.some(a => a.classId === classId && a.sectionId === s.id && a.subjectId === subjectId));
  }, [sections, assignments]);

  const handleAssign = async (override = false) => {
    if (!assignForm.classId || !assignForm.sectionId || !assignForm.subjectId) {
      toast({ title: "Fill all fields", variant: "destructive" }); return;
    }

    if (assignForm.sectionId === "__ALL__") {
      if (!override && !assignSubjectClassCompetent) {
        setConfirmOverride({ classId: assignForm.classId, sectionId: null, subjectId: assignForm.subjectId });
        return;
      }
      const targets = pendingWholeClassSections(assignForm.classId, assignForm.subjectId);
      if (targets.length === 0) {
        toast({ title: "Every section already has this assignment." });
        return;
      }
      setAssigning(true);
      let created = 0;
      for (const s of targets) {
        const res = await createTeacherAssignmentDB({
          teacherId, classId: assignForm.classId, sectionId: s.id,
          subjectId: assignForm.subjectId, academicYearId: activeYearId, override: true,
        });
        if (!(res as any)?.error) created++;
      }
      setAssigning(false);
      setConfirmOverride(null);
      setAssignForm({ classId: "", sectionId: "", subjectId: "" });
      toast({ title: `Assigned to ${created} section${created === 1 ? "" : "s"}` });
      load({ silent: true });
      return;
    }

    const res = await createTeacherAssignmentDB({
      teacherId, classId: assignForm.classId, sectionId: assignForm.sectionId,
      subjectId: assignForm.subjectId, academicYearId: activeYearId, override,
    });
    if ((res as any)?.error === "not_competent") {
      setConfirmOverride({ classId: assignForm.classId, sectionId: assignForm.sectionId, subjectId: assignForm.subjectId });
      return;
    }
    setConfirmOverride(null);
    setAssignForm({ classId: "", sectionId: "", subjectId: "" });
    toast({ title: "Assigned" });
    load({ silent: true });
  };

  const handleConfirmOverride = async () => {
    if (!confirmOverride) return;
    if (confirmOverride.sectionId === null) {
      await handleAssign(true);
      return;
    }
    await createTeacherAssignmentDB({ teacherId, ...confirmOverride, sectionId: confirmOverride.sectionId, academicYearId: activeYearId, override: true });
    setConfirmOverride(null);
    setAssignForm({ classId: "", sectionId: "", subjectId: "" });
    toast({ title: "Assigned (competency override logged)" });
    load({ silent: true });
  };

  const handleDeleteAssignment = async (id: string) => {
    const ok = await confirm({ title: "Remove assignment?", description: "This cannot be undone." });
    if (!ok) return;
    await deleteTeacherAssignmentDB(id);
    toast({ title: "Assignment removed" });
    load({ silent: true });
  };

  if (!permsLoaded) return null;
  if (!can("teachers.view")) return <Unauthorized />;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/teachers")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <p className="text-sm text-muted-foreground">Teacher not found.</p>
      </div>
    );
  }

  const status = profile.status;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/teachers")}><ArrowLeft className="h-4 w-4 mr-1" /> Back to Teachers</Button>

      <Card className="border-border">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start gap-5">
            <div className="relative shrink-0">
              {profile.profilePhoto ? (
                <img src={profile.profilePhoto} alt={teacherName} className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="font-semibold text-primary text-2xl">{teacherName.charAt(0)}</span>
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-card border border-border flex items-center justify-center cursor-pointer hover:bg-secondary">
                <Camera className="h-3.5 w-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload("profilePhoto")} />
              </label>
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="dashboard-heading !text-2xl">{teacherName}</h1>
                <Badge variant={status === "active" ? "default" : status === "on_leave" ? "secondary" : "outline"}>
                  {status === "on_leave" ? "On Leave" : status.charAt(0).toUpperCase() + status.slice(1)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{teacherEmail}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.designation && <Badge variant="secondary" className="text-xs">{profile.designation}</Badge>}
                {payScaleLabel(profile.payScaleId) && <Badge variant="outline" className="text-xs">{payScaleLabel(profile.payScaleId)}</Badge>}
                {!!profile.experienceYears && <Badge variant="outline" className="text-xs">{profile.experienceYears} yr{profile.experienceYears !== 1 ? "s" : ""} experience</Badge>}
                {profile.employeeId && <Badge variant="outline" className="text-xs font-mono">ID: {profile.employeeId}</Badge>}
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit Details</Button>
              {status !== "active" && <Button size="sm" variant="outline" onClick={() => handleStatusChange("active")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Set Active</Button>}
              {status !== "on_leave" && <Button size="sm" variant="outline" onClick={() => handleStatusChange("on_leave")}>Set On Leave</Button>}
              {status !== "inactive" && <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleStatusChange("inactive")}><Ban className="h-3.5 w-3.5 mr-1" /> Deactivate</Button>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 w-fit">
        {([
          { key: "overview", label: "Overview" },
          { key: "qualifications", label: "Qualifications & Documents" },
          { key: "classes", label: "Classes & Competency" },
          { key: "leave", label: "Leave" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-xs font-semibold rounded-md px-3 py-1.5 transition-colors ${tab === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-sm">Contact & Employment</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Phone</p><p>{profile.phone || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">CNIC</p><p>{profile.cnic || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Specialization</p><p>{profile.specialization || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Qualification Summary</p><p>{profile.qualification || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Joining Date</p><p>{formatDatePK(profile.joiningDate)}</p></div>
            <div><p className="text-xs text-muted-foreground">Employment Type</p><p className="capitalize">{profile.employmentType}</p></div>
            <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Address</p><p>{profile.address || "—"}</p></div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Degree Photo</p>
              {profile.degreePhoto ? (
                <img src={profile.degreePhoto} alt="Degree" className="h-20 rounded border border-border object-cover" />
              ) : <p className="text-sm text-muted-foreground">Not uploaded</p>}
              <label className="text-xs text-primary cursor-pointer mt-1 inline-block">
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload("degreePhoto")} />
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "qualifications" && (
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader><CardTitle className="text-sm">Add Qualification</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Degree Title *</Label><Input className="h-8 text-sm" value={qualForm.degreeTitle} placeholder="e.g. B.Ed" onChange={e => setQualForm(f => ({ ...f, degreeTitle: e.target.value }))} /></div>
                <div><Label className="text-xs">Institution</Label><Input className="h-8 text-sm" value={qualForm.institution} onChange={e => setQualForm(f => ({ ...f, institution: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Year Completed</Label><Input className="h-8 text-sm" type="number" value={qualForm.yearCompleted} onChange={e => setQualForm(f => ({ ...f, yearCompleted: e.target.value }))} /></div>
                <div><Label className="text-xs">Specialization</Label><Input className="h-8 text-sm" value={qualForm.specialization} onChange={e => setQualForm(f => ({ ...f, specialization: e.target.value }))} /></div>
              </div>
              <div>
                <Label className="text-xs">Certificate</Label>
                <Input type="file" accept="image/*,.pdf" className="h-8 text-sm" onChange={handleQualCertUpload} />
                {qualForm.certificateFilePath && <p className="text-[11px] text-muted-foreground mt-1">File selected — will be saved with this qualification.</p>}
              </div>
              <Button size="sm" onClick={handleAddQualification} disabled={addingQual}><Plus className="h-3.5 w-3.5 mr-1" /> {addingQual ? "Adding..." : "Add Qualification"}</Button>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {qualifications.length === 0 && <p className="text-sm text-muted-foreground">No qualifications recorded yet.</p>}
            {qualifications.map(q => (
              <Card key={q.id} className="border-border">
                <CardContent className="py-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{q.degreeTitle}{q.institution ? ` — ${q.institution}` : ""}</p>
                      <p className="text-xs text-muted-foreground">
                        {q.yearCompleted ? `Completed ${q.yearCompleted}` : "Year unknown"}{q.specialization ? ` · ${q.specialization}` : ""}
                      </p>
                      {q.certificateFilePath && (
                        <a href={q.certificateFilePath} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View certificate</a>
                      )}
                    </div>
                  </div>
                  <button className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDeleteQualification(q.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "classes" && (
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Declared Competencies</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-2 rounded-lg border border-dashed border-border/70 p-3">
                <div className="flex-1 space-y-1"><Label className="text-xs text-muted-foreground">Subject</Label>
                  <Select value={compForm.subjectId} onValueChange={v => setCompForm(f => ({ ...f, subjectId: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1"><Label className="text-xs text-muted-foreground">Grade</Label>
                  <Select value={compForm.classId} onValueChange={v => setCompForm(f => ({ ...f, classId: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select grade" /></SelectTrigger>
                    <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button size="sm" className="shrink-0" disabled={!compForm.subjectId || !compForm.classId} onClick={handleAddCompetency}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
              {competencies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No competencies declared yet.</p>
                  <p className="text-xs mt-0.5">A competency covers every section of that grade automatically — no need to repeat it per section.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {competenciesBySubject.map(group => (
                    <div key={group.subjectName} className="flex items-start gap-3 rounded-lg bg-secondary/20 px-3 py-2">
                      <p className="text-xs font-semibold text-foreground w-28 shrink-0 pt-0.5">{group.subjectName}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.items.map(c => (
                          <Badge key={c.id} variant="secondary" className="text-xs gap-1">
                            {c.className}
                            <button onClick={() => handleDeleteCompetency(c.id)} aria-label={`Remove ${group.subjectName} · ${c.className}`}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="h-4 w-4" /> Class & Subject Assignments</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg border border-dashed border-border/70 p-3">
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Class</Label>
                  <Select value={assignForm.classId} onValueChange={v => setAssignForm({ classId: v, sectionId: "", subjectId: "" })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Section</Label>
                  <Select value={assignForm.sectionId} onValueChange={v => setAssignForm(f => ({ ...f, sectionId: v }))} disabled={!assignForm.classId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select section" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ALL__" className="font-semibold text-primary">Whole Class (all sections)</SelectItem>
                      {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Subject</Label>
                  <Select value={assignForm.subjectId} onValueChange={v => setAssignForm(f => ({ ...f, subjectId: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>{assignSubjectOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {!assignSubjectClassCompetent && (
                <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 p-2.5">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground">This teacher isn't declared competent for this subject/grade. You'll be asked to confirm an override.</p>
                </div>
              )}
              <Button
                size="sm"
                disabled={!assignForm.classId || !assignForm.sectionId || !assignForm.subjectId || assigning}
                onClick={() => handleAssign(false)}
              >
                {assigning ? "Assigning..." : assignForm.sectionId === "__ALL__" ? "Assign to All Sections" : "Assign"}
              </Button>

              {assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No assignments for the active academic year.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {assignmentsByClass.map(group => (
                    <div key={group.className} className="flex items-start gap-3 rounded-lg bg-secondary/20 px-3 py-2">
                      <p className="text-xs font-semibold text-foreground w-28 shrink-0 pt-0.5">{group.className}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.items.map(a => (
                          <Badge key={a.id} variant="secondary" className="text-xs gap-1">
                            {a.subjectName} — {a.sectionName}
                            <button onClick={() => handleDeleteAssignment(a.id)} aria-label={`Remove ${a.subjectName} · ${group.className} ${a.sectionName}`}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "leave" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-sm">Leave History</CardTitle></CardHeader>
          <CardContent>
            {leaveRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave requests recorded for this teacher.</p>
            ) : (
              <div className="space-y-2">
                {leaveRequests.map(lr => (
                  <div key={lr.id} className="flex items-center justify-between border border-border rounded-md px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{lr.leaveType} — {formatDatePK(lr.startDate)} to {formatDatePK(lr.endDate)}</p>
                      <p className="text-xs text-muted-foreground">{lr.totalDays} day(s){lr.reason ? ` · ${lr.reason}` : ""}</p>
                    </div>
                    <Badge variant={lr.status === "Approved" ? "default" : lr.status === "Rejected" ? "outline" : "secondary"}>{lr.status}</Badge>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">Approve/reject pending requests from HR &gt; Leave Management. This teacher can also apply for leave from their own Profile page.</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Details Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Teacher Details</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>CNIC</Label><Input value={editForm.cnic} onChange={e => setEditForm(f => ({ ...f, cnic: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Specialization</Label><Input value={editForm.specialization} onChange={e => setEditForm(f => ({ ...f, specialization: e.target.value }))} /></div>
              <div><Label>Qualification Summary</Label><Input value={editForm.qualification} onChange={e => setEditForm(f => ({ ...f, qualification: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Experience (years)</Label><Input type="number" value={editForm.experienceYears} onChange={e => setEditForm(f => ({ ...f, experienceYears: Number(e.target.value) }))} /></div>
              <div><Label>Joining Date</Label><Input type="date" value={editForm.joiningDate} onChange={e => setEditForm(f => ({ ...f, joiningDate: e.target.value }))} /></div>
            </div>
            <div><Label>Address</Label><Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Employee ID</Label><Input value={editForm.employeeId} onChange={e => setEditForm(f => ({ ...f, employeeId: e.target.value }))} /></div>
              <div><Label>Employment Type</Label>
                <Select value={editForm.employmentType} onValueChange={v => setEditForm(f => ({ ...f, employmentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fulltime">Full-time</SelectItem>
                    <SelectItem value="parttime">Part-time</SelectItem>
                    <SelectItem value="visiting">Visiting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Designation</Label><Input value={editForm.designation} onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g. Senior Physics Teacher" /></div>
              <div>
                <Label>BPS Grade</Label>
                <Select value={editForm.payScaleId} onValueChange={v => setEditForm(f => ({ ...f, payScaleId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                  <SelectContent>{payScales.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
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
