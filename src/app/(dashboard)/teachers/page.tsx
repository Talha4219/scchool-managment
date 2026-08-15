"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { Plus, Search, Users, BookOpen, UserCheck, GraduationCap, X, ShieldAlert, AlertTriangle, Download } from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";
import {
  fetchAcademicYearsDB, fetchClassesDB, fetchAllSectionsDB, fetchSectionsByClassDB,
  fetchTeacherAssignmentsDB, createTeacherAssignmentDB,
} from "@/app/actions/academic-core";
import {
  fetchUsersDB, createTeacherWithProfileDB, fetchAllTeacherProfilesDB,
  fetchPayScalesDB, fetchTeacherCompetenciesDB,
  type TeacherProfile, type PayScale, type TeacherSubjectCompetency,
} from "@/app/actions/features";
import type { AcademicYear, ClassItem, SectionItem, TeacherClassSubject, TeacherRecord } from "@/lib/types";

export default function TeachersPage() {
  const { toast } = useToast();
  const router = useRouter();
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

  // Add Teacher dialog — deliberately minimal (name/email/password/contact/
  // employment basics only). Qualifications, competencies, photos, and every
  // other detail are filled in on the teacher's profile page right after
  // creation — real onboarding fills in a staff file over days, not upfront.
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", email: "", password: "", phone: "",
    employeeId: "", employmentType: "fulltime", joiningDate: "",
  });
  const [adding, setAdding] = useState(false);

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ teacherId: "", classId: "", sectionId: "", subjectId: "" });
  const [confirmOverride, setConfirmOverride] = useState<null | { teacherId: number; classId: string; sectionId: string; subjectId: string }>(null);

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
    setAddForm({ name: "", email: "", password: "", phone: "", employeeId: "", employmentType: "fulltime", joiningDate: "" });
  };

  const handleAddTeacher = async () => {
    if (!addForm.name || !addForm.email || !addForm.password) {
      toast({ title: "Name, email and password are required", variant: "destructive" }); return;
    }
    setAdding(true);
    const res = await createTeacherWithProfileDB(addForm.name, addForm.email, addForm.password, {
      phone: addForm.phone, cnic: "", specialization: "", qualification: "", experienceYears: 0,
      joiningDate: addForm.joiningDate, address: "", profilePhoto: null, degreePhoto: null,
      employeeId: addForm.employeeId || null, employmentType: addForm.employmentType as any,
      status: "active", payScaleId: null, designation: null,
    });
    setAdding(false);
    if (res.error || !res.userId) { toast({ title: res.error || "Failed to create teacher", variant: "destructive" }); return; }

    setAddOpen(false);
    resetAddForm();
    toast({ title: "Teacher added — complete their profile next." });
    router.push(`/teachers/${res.userId}`);
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
            const clickable = t.id > 0;
            return (
              <Card
                key={t.id}
                className={`border-border transition-colors ${clickable ? "cursor-pointer hover:border-primary/40 hover:shadow-sm" : ""}`}
                onClick={() => clickable && router.push(`/teachers/${t.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {t.profile?.profilePhoto ? (
                        <img src={t.profile.profilePhoto} alt={t.name} className="h-10 w-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="font-semibold text-primary text-sm">{t.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground truncate">{t.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                        {t.profile?.employeeId && <p className="text-[10px] text-muted-foreground font-mono">ID: {t.profile.employeeId}</p>}
                      </div>
                    </div>
                    <Badge variant={status === "active" ? "default" : status === "on_leave" ? "secondary" : "outline"} className="text-[10px] shrink-0">
                      {status === "on_leave" ? "On Leave" : status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {t.profile?.designation && <Badge variant="secondary" className="text-xs">{t.profile.designation}</Badge>}
                    {payScaleLabel(t.profile?.payScaleId || null) && <Badge variant="outline" className="text-xs">{payScaleLabel(t.profile?.payScaleId || null)}</Badge>}
                    {!!t.profile?.experienceYears && (
                      <Badge variant="outline" className="text-xs">{t.profile.experienceYears} yr{t.profile.experienceYears !== 1 ? "s" : ""} exp.</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {t.subjects.length} class assignment{t.subjects.length !== 1 ? "s" : ""}</span>
                    <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> {t.competent.length} competenc{t.competent.length !== 1 ? "ies" : "y"}</span>
                  </div>
                  {clickable && (
                    <Button size="sm" variant="outline" className="h-7 text-xs w-full mt-3" onClick={e => { e.stopPropagation(); router.push(`/teachers/${t.id}`); }}>
                      View Profile
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Teacher Dialog — deliberately just the essentials; everything
          else (qualifications, competencies, photo, address, designation,
          pay scale) is filled in on the teacher's profile page right after. */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetAddForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add New Teacher</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Employee ID</Label><Input value={addForm.employeeId} onChange={e => setAddForm(f => ({ ...f, employeeId: e.target.value }))} placeholder="Optional" /></div>
            </div>
            <div><Label>Email *</Label><Input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Password *</Label><Input type="password" value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} /></div>
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
            <p className="text-xs text-muted-foreground">Qualifications, subject competency, designation, pay scale, and photo are added on their profile page next.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTeacher} disabled={adding}>{adding ? "Adding..." : "Add Teacher"}</Button>
          </DialogFooter>
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
