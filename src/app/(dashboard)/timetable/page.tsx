"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppState } from "@/lib/state-context";
import { useStudents } from "@/lib/students-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  fetchTimetableDB, createTimetableEntryDB, deleteTimetableEntryDB, publishTimetableDB, copyTimetableDB,
  fetchUsersDB, fetchTeacherCompetenciesDB,
  fetchPeriodSlotsDB, createPeriodSlotDB, updatePeriodSlotDB, deletePeriodSlotDB,
  type TimetableEntry, type TeacherSubjectCompetency, type PeriodSlot, type CopyTimetableSkip,
} from "@/app/actions/features";
import {
  fetchAcademicYearsDB, fetchClassesDB, fetchSectionsByClassDB, fetchEnrollmentsDB,
} from "@/app/actions/academic-core";
import { getSession } from "@/app/actions/auth";
import { fetchSubstitutionsForDateDB, type SubstitutionRecord } from "@/app/actions/substitutions";
import { isValidTimeRange } from "@/lib/validation";
import { Plus, Trash2, UploadCloud, AlertTriangle, ShieldAlert, Settings, Copy, ArrowUp, ArrowDown, Repeat, Users } from "lucide-react";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import type { AcademicYear, ClassItem, SectionItem } from "@/lib/types";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function TimetablePage() {
  const { can, loaded } = usePermission();
  const { subjects } = useAppState();
  const { students } = useStudents();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<number | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [activeYearId, setActiveYearId] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [competencies, setCompetencies] = useState<TeacherSubjectCompetency[]>([]);
  const [periods, setPeriods] = useState<PeriodSlot[]>([]);

  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  // School-wide active entries for the year — powers the teacher workload
  // panel and the cross-class double-booking warning in the add popover
  // (the section-scoped `entries` above can't see a teacher's other classes).
  const [allEntries, setAllEntries] = useState<TimetableEntry[]>([]);
  const [todaySubs, setTodaySubs] = useState<SubstitutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ subjectId: "", teacherId: "", room: "" });
  const [openCell, setOpenCell] = useState<{ day: string; periodId: string } | null>(null);
  const [showRoomInput, setShowRoomInput] = useState(false);
  const [pendingOverride, setPendingOverride] = useState<{ form: typeof form; day: string; periodId: string } | null>(null);

  // Manage Periods dialog
  const [periodsOpen, setPeriodsOpen] = useState(false);
  const [workloadOpen, setWorkloadOpen] = useState(false);
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [periodForm, setPeriodForm] = useState({ label: "", startTime: "08:00", endTime: "08:45", isBreak: false });

  // Copy From dialog
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySourceClassId, setCopySourceClassId] = useState("");
  const [copySourceSectionId, setCopySourceSectionId] = useState("");
  const [copySourceSections, setCopySourceSections] = useState<SectionItem[]>([]);
  const [copyResult, setCopyResult] = useState<{ copied: number; skipped: CopyTimetableSkip[] } | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    getSession().then(s => { setSessionRole(s?.role ?? null); setSessionUserId(s?.userId ?? null); setSessionEmail(s?.email ?? null); });
  }, []);

  useEffect(() => {
    fetchAcademicYearsDB().then(years => {
      setAcademicYears(years);
      const active = years.find(y => y.isActive) || years[0];
      if (active) setActiveYearId(active.id);
    });
    fetchUsersDB().then(u => setTeachers((u as any[]).filter(x => x.role === "TEACHER")));
    fetchTeacherCompetenciesDB().then(setCompetencies);
  }, []);

  useEffect(() => {
    if (activeYearId) {
      fetchClassesDB(activeYearId).then(setClasses);
      fetchPeriodSlotsDB(activeYearId).then(setPeriods);
    }
  }, [activeYearId]);

  const reloadPeriods = useCallback(() => { if (activeYearId) fetchPeriodSlotsDB(activeYearId).then(setPeriods); }, [activeYearId]);

  useEffect(() => {
    if (classId) fetchSectionsByClassDB(classId).then(setSections);
    else setSections([]);
    setSectionId("");
  }, [classId]);

  useEffect(() => {
    if (copySourceClassId) fetchSectionsByClassDB(copySourceClassId).then(setCopySourceSections);
    else setCopySourceSections([]);
    setCopySourceSectionId("");
  }, [copySourceClassId]);

  const load = useCallback(async () => {
    if (!sessionRole) return;
    setLoading(true);
    let data: TimetableEntry[] = [];

    if ((sessionRole === "ADMIN" || sessionRole === "PRINCIPAL" || sessionRole === "OWNER")) {
      if (classId && sectionId && activeYearId) {
        data = await fetchTimetableDB(undefined, undefined, { classId, sectionId, academicYearId: activeYearId, status: "all" });
      }
      if (activeYearId) {
        fetchTimetableDB(undefined, undefined, { academicYearId: activeYearId, status: "active" }).then(setAllEntries);
      }
    } else if (sessionRole === "TEACHER" && sessionUserId) {
      data = await fetchTimetableDB(undefined, undefined, { teacherId: sessionUserId, status: "active" });
    } else if (sessionRole === "STUDENT" && sessionEmail) {
      const match = students.find(s => s.email === sessionEmail && s.status === "Active");
      if (match) {
        const enr = await fetchEnrollmentsDB(undefined, undefined, match.id);
        const mine = enr[0];
        if (mine) data = await fetchTimetableDB(undefined, undefined, { classId: mine.classId, sectionId: mine.sectionId ?? undefined, status: "active" });
      }
    }
    setEntries(data);
    setLoading(false);
  }, [sessionRole, sessionUserId, sessionEmail, classId, sectionId, activeYearId, students]);

  useEffect(() => { load(); }, [load]);

  const teachingPeriods = useMemo(() => periods.filter(p => !p.isBreak), [periods]);

  const isCompetent = useMemo(() => {
    if (!form.teacherId || !form.subjectId || !classId) return true;
    return competencies.some(c => c.teacherId === parseInt(form.teacherId) && c.subjectId === form.subjectId && c.classId === classId);
  }, [form.teacherId, form.subjectId, classId, competencies]);

  const resetForm = () => { setForm({ subjectId: "", teacherId: "", room: "" }); setShowRoomInput(false); };

  const openAddCell = (day: string, periodId: string) => {
    resetForm();
    setOpenCell({ day, periodId });
  };

  // Auto-fills Teacher when exactly one competent teacher exists for this
  // subject+class — the common case, so admins usually never touch this field.
  const handleSubjectChange = (subjectId: string) => {
    const matches = competencies.filter(c => c.subjectId === subjectId && c.classId === classId);
    setForm(f => ({ ...f, subjectId, teacherId: matches.length === 1 ? String(matches[0].teacherId) : "" }));
  };

  // Once a subject is picked, narrow the Teacher list to only those declared
  // competent for it in this class — falls back to every teacher when no one
  // has been declared yet, so an admin can still assign (and gets the
  // existing override-confirmation flow) rather than being stuck.
  const competentTeacherIdsForForm = useMemo(() => {
    if (!form.subjectId || !classId) return null;
    const ids = new Set(competencies.filter(c => c.subjectId === form.subjectId && c.classId === classId).map(c => c.teacherId));
    return ids.size > 0 ? ids : null;
  }, [form.subjectId, classId, competencies]);

  const teacherOptionsForForm = competentTeacherIdsForForm
    ? teachers.filter(t => competentTeacherIdsForForm.has(t.id))
    : teachers;

  // Cross-class conflict check (the section-scoped `entries` can't see a
  // teacher's classes elsewhere) — server-side createTimetableEntryDB already
  // hard-blocks this on submit, this just surfaces it before the click so
  // admins aren't stopped by a surprise error after filling out the form.
  const conflictingEntry = useMemo(() => {
    if (!form.teacherId || !openCell) return null;
    const period = periods.find(p => p.id === openCell.periodId);
    if (!period) return null;
    const teacherIdNum = parseInt(form.teacherId);
    return allEntries.find(e =>
      e.teacherId === teacherIdNum && e.dayOfWeek === openCell.day &&
      e.startTime < period.endTime && e.endTime > period.startTime
    ) || null;
  }, [form.teacherId, openCell, periods, allEntries]);

  // Ranked by weekly period count with a per-day breakdown — includes every
  // teacher (even ones with zero periods this week) so under-utilization is
  // just as visible as overload.
  const teacherWorkload = useMemo(() => {
    const byDayInit = () => Object.fromEntries(DAYS.map(d => [d, 0])) as Record<string, number>;
    const map = new Map<number, { teacherId: number; name: string; total: number; byDay: Record<string, number> }>();
    for (const t of teachers) map.set(t.id, { teacherId: t.id, name: t.name, total: 0, byDay: byDayInit() });
    for (const e of allEntries) {
      if (e.teacherId == null) continue;
      if (!map.has(e.teacherId)) map.set(e.teacherId, { teacherId: e.teacherId, name: e.teacherName, total: 0, byDay: byDayInit() });
      const entry = map.get(e.teacherId)!;
      entry.total++;
      entry.byDay[e.dayOfWeek] = (entry.byDay[e.dayOfWeek] || 0) + 1;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [allEntries, teachers]);

  const avgWorkload = useMemo(() => teacherWorkload.length ? Math.round((teacherWorkload.reduce((s, t) => s + t.total, 0) / teacherWorkload.length) * 10) / 10 : 0, [teacherWorkload]);

  // Every pair of entries for the same teacher, same day, with overlapping
  // times — a real scheduling conflict regardless of which class/section is
  // currently open in the builder above. Grouped so a teacher triple-booked
  // at once shows as one row, not three separate pairs.
  const scheduleConflicts = useMemo(() => {
    const byTeacherDay = new Map<string, TimetableEntry[]>();
    for (const e of allEntries) {
      if (e.teacherId == null) continue;
      const key = `${e.teacherId}-${e.dayOfWeek}`;
      if (!byTeacherDay.has(key)) byTeacherDay.set(key, []);
      byTeacherDay.get(key)!.push(e);
    }
    const groups: { teacherName: string; day: string; entries: TimetableEntry[] }[] = [];
    for (const list of byTeacherDay.values()) {
      if (list.length < 2) continue;
      const used = new Set<string>();
      for (let i = 0; i < list.length; i++) {
        if (used.has(list[i].id)) continue;
        const group = [list[i]];
        for (let j = i + 1; j < list.length; j++) {
          if (used.has(list[j].id)) continue;
          if (list[i].startTime < list[j].endTime && list[i].endTime > list[j].startTime) {
            group.push(list[j]); used.add(list[j].id);
          }
        }
        if (group.length > 1) {
          used.add(list[i].id);
          groups.push({ teacherName: group[0].teacherName, day: group[0].dayOfWeek, entries: group.sort((a, b) => a.startTime.localeCompare(b.startTime)) });
        }
      }
    }
    return groups.sort((a, b) => a.day.localeCompare(b.day) || a.entries[0].startTime.localeCompare(b.entries[0].startTime));
  }, [allEntries]);

  const submitEntry = async (f: typeof form, day: string, periodId: string, override: boolean) => {
    const teacher = teachers.find(t => String(t.id) === f.teacherId);
    const subject = subjects.find(s => s.id === f.subjectId);
    const cls = classes.find(c => c.id === classId);
    const period = periods.find(p => p.id === periodId);
    if (!teacher || !subject || !cls || !period) { toast({ title: "Fill all required fields.", variant: "destructive" }); return; }

    const res = await createTimetableEntryDB({
      className: cls.name, subjectName: subject.name, teacherName: teacher.name,
      dayOfWeek: day, startTime: period.startTime, endTime: period.endTime, room: f.room || null,
      classId, sectionId, subjectId: f.subjectId, teacherId: teacher.id, academicYearId: activeYearId,
      assignedByUserId: sessionUserId || undefined,
    }, { competencyOverride: override });

    if (res.needsCompetencyOverride) { setPendingOverride({ form: f, day, periodId }); return; }
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }

    toast({ title: "Slot added (draft)." });
    setOpenCell(null);
    setPendingOverride(null);
    resetForm();
    load();
  };

  const handleCreate = (day: string, periodId: string) => {
    if (!form.subjectId || !form.teacherId) { toast({ title: "Pick a subject and teacher.", variant: "destructive" }); return; }
    submitEntry(form, day, periodId, false);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Remove this timetable entry?",
      description: "The class/subject/teacher slot will be cleared from the timetable. This cannot be undone.",
    });
    if (!ok) return;
    await deleteTimetableEntryDB(id);
    toast({ title: "Entry removed." });
    load();
  };

  const handlePublish = async () => {
    if (!classId || !sectionId || !activeYearId) return;
    const res = await publishTimetableDB(classId, sectionId, activeYearId, sessionUserId || undefined);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: `Published${res.count ? ` — ${res.count} slot(s) went live` : ""}.` });
    load();
  };

  // ── Manage Periods ──────────────────────────────────────────────────────────
  const periodTimeValid = isValidTimeRange(periodForm.startTime, periodForm.endTime);

  const handleAddPeriod = async () => {
    if (!periodForm.label || !activeYearId || !periodTimeValid) return;
    const nextNumber = periods.length > 0 ? Math.max(...periods.map(p => p.periodNumber)) + 1 : 1;
    const res = await createPeriodSlotDB({ academicYearId: activeYearId, periodNumber: nextNumber, ...periodForm });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    setPeriodForm({ label: "", startTime: "08:00", endTime: "08:45", isBreak: false });
    reloadPeriods();
  };

  const handleDeletePeriod = async (id: string) => {
    const ok = await confirm({
      title: "Delete this period?",
      description: "Any timetable entries already scheduled in this period slot will be affected. This cannot be undone.",
    });
    if (!ok) return;
    await deletePeriodSlotDB(id);
    reloadPeriods();
  };

  const handleMovePeriod = async (index: number, dir: -1 | 1) => {
    const target = periods[index + dir];
    const current = periods[index];
    if (!target) return;
    await Promise.all([
      updatePeriodSlotDB(current.id, { periodNumber: target.periodNumber }),
      updatePeriodSlotDB(target.id, { periodNumber: current.periodNumber }),
    ]);
    reloadPeriods();
  };

  // ── Copy From ────────────────────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!copySourceClassId || !copySourceSectionId || !classId || !sectionId) return;
    const targetCls = classes.find(c => c.id === classId);
    if (!targetCls) return;
    setCopying(true);
    const res = await copyTimetableDB(copySourceClassId, copySourceSectionId, classId, sectionId, targetCls.name, activeYearId, sessionUserId || undefined);
    setCopying(false);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    setCopyResult({ copied: res.copied || 0, skipped: res.skipped || [] });
    load();
  };

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    fetchSubstitutionsForDateDB(today).then(setTodaySubs);
  }, []);
  const subForEntry = (entryId: string) => todaySubs.find(s => s.timetableEntryId === entryId);

  const getCell = (day: string, periodId: string) => entries.filter(e => {
    const p = periods.find(pp => pp.startTime === e.startTime && pp.endTime === e.endTime);
    return e.dayOfWeek === day && p?.id === periodId;
  });
  const hasDraft = entries.some(e => e.status === "draft");

  if (!loaded) return <PageSkeleton />;
  if (!can("timetable.view")) return <Unauthorized />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Timetable</h1>
          <p className="text-muted-foreground mt-1">
            {(sessionRole === "ADMIN" || sessionRole === "PRINCIPAL" || sessionRole === "OWNER") ? "Build and publish each section's weekly schedule" : "Weekly class schedule"}
          </p>
        </div>
        {(sessionRole === "ADMIN" || sessionRole === "PRINCIPAL" || sessionRole === "OWNER") && (
          <div className="flex gap-2 items-center flex-wrap">
            <Select value={activeYearId} onValueChange={setActiveYearId}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>{academicYears.map(y => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={sectionId} onValueChange={setSectionId} disabled={!classId}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Section" /></SelectTrigger>
              <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>

            <Button variant="outline" size="icon" title="Manage Periods" onClick={() => setPeriodsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>

            {teacherWorkload.length > 0 && (
              <Button variant="outline" className="gap-2" onClick={() => setWorkloadOpen(true)}>
                <Users className="h-4 w-4" /> Workload
              </Button>
            )}

            {scheduleConflicts.length > 0 && (
              <Button variant="outline" className="gap-2 border-destructive/40 text-destructive hover:text-destructive" onClick={() => setConflictsOpen(true)}>
                <AlertTriangle className="h-4 w-4" /> Conflicts
                <Badge className="bg-destructive text-destructive-foreground h-5 min-w-5 px-1 justify-center">{scheduleConflicts.length}</Badge>
              </Button>
            )}

            {classId && sectionId && (
              <>
                <Button variant="outline" className="gap-2" onClick={() => { setCopyResult(null); setCopyOpen(true); }}>
                  <Copy className="h-4 w-4" /> Copy From...
                </Button>
                <Button variant="outline" className="gap-2" disabled={!hasDraft} onClick={handlePublish}>
                  <UploadCloud className="h-4 w-4" /> Publish
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {(sessionRole === "ADMIN" || sessionRole === "PRINCIPAL" || sessionRole === "OWNER") && (!classId || !sectionId) && (
        <p className="text-sm text-muted-foreground">Select a class and section above to build its timetable.</p>
      )}

      {(sessionRole === "ADMIN" || sessionRole === "PRINCIPAL" || sessionRole === "OWNER") && classId && sectionId && teachingPeriods.length === 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 p-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">No periods defined for this academic year yet. Click <strong>Manage Periods</strong> above to set up the bell schedule before adding slots.</p>
        </div>
      )}

      {(sessionRole === "ADMIN" || sessionRole === "PRINCIPAL" || sessionRole === "OWNER") && classId && sectionId && teachingPeriods.length > 0 && (
        <p className="text-xs text-muted-foreground">Click any empty cell below to add a slot.</p>
      )}

      {(sessionRole === "ADMIN" || sessionRole === "PRINCIPAL" || sessionRole === "OWNER") && classId && sectionId && (
        <div className="flex items-center gap-2 text-xs">
          {hasDraft
            ? <Badge variant="outline" className="border-warning/40 text-warning">Has unpublished draft slots</Badge>
            : entries.length > 0
              ? <Badge className="bg-success/15 text-success">Published</Badge>
              : <Badge variant="outline">Empty</Badge>}
        </div>
      )}

      {loading ? (
        <Card className="border-none shadow-sm overflow-auto"><CardContent className="p-4"><div className="space-y-3">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="flex gap-4"><Skeleton className="h-8 w-20 rounded shrink-0" />{[1, 2, 3, 4, 5].map(j => <Skeleton key={j} className="h-8 flex-1 rounded" />)}</div>)}</div></CardContent></Card>
      ) : periods.length === 0 ? (
        <Card className="border-none shadow-sm"><CardContent className="p-8 text-center text-sm text-muted-foreground">No period grid defined yet for this academic year.</CardContent></Card>
      ) : (
        <Card className="border-none shadow-sm overflow-auto">
          <CardContent className="p-0">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b bg-secondary/20">
                  <th className="p-3 text-left text-xs font-semibold text-muted-foreground w-28">Period</th>
                  {DAYS.map(d => <th key={d} className="p-3 text-left text-xs font-semibold text-muted-foreground">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {periods.map(p => (
                  p.isBreak ? (
                    <tr key={p.id} className="bg-secondary/30">
                      <td colSpan={DAYS.length + 1} className="px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {p.label} · {p.startTime}-{p.endTime}
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id} className="border-b hover:bg-secondary/10">
                      <td className="p-3 text-xs text-muted-foreground font-medium whitespace-nowrap">
                        <div className="font-semibold text-foreground">{p.label}</div>
                        {p.startTime}-{p.endTime}
                      </td>
                      {DAYS.map(d => {
                        const cells = getCell(d, p.id);
                        const isOpen = openCell?.day === d && openCell?.periodId === p.id;
                        return (
                          <td key={d} className="p-2 align-top group/cell">
                            {cells.map(e => {
                              const sub = subForEntry(e.id);
                              return (
                              <div key={e.id} className={`border rounded-lg p-2 mb-1 relative group ${e.status === "draft" ? "bg-warning/10 border-warning/30" : "bg-primary/10 border-primary/20"}`}>
                                <div className="flex items-center gap-1">
                                  <p className="font-semibold text-primary text-xs">{e.subjectName}</p>
                                  {e.status === "draft" && <span className="text-[8px] uppercase font-bold text-warning">Draft</span>}
                                </div>
                                <p className="text-[10px] text-muted-foreground">{e.className}</p>
                                <p className={`text-[10px] ${sub ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>{e.teacherName}</p>
                                {sub && (
                                  <p className={`text-[10px] font-semibold flex items-center gap-1 ${sub.status === "unfilled" ? "text-red-600" : "text-blue-600"}`}>
                                    <Repeat className="h-2.5 w-2.5" />
                                    {sub.substituteTeacherName || "Unfilled — needs cover"}
                                  </p>
                                )}
                                {e.room && <p className="text-[10px] text-muted-foreground">{e.room}</p>}
                                {(sessionRole === "ADMIN" || sessionRole === "PRINCIPAL" || sessionRole === "OWNER") && (
                                  <button onClick={() => handleDelete(e.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              );
                            })}
                            {cells.length === 0 && (sessionRole === "ADMIN" || sessionRole === "PRINCIPAL" || sessionRole === "OWNER") && classId && sectionId && (
                              <Popover open={isOpen} onOpenChange={(o) => !o && setOpenCell(null)}>
                                <PopoverTrigger asChild>
                                  <button
                                    onClick={() => openAddCell(d, p.id)}
                                    aria-label={`Add slot for ${d} ${p.label}`}
                                    className="w-full h-10 rounded-lg border border-dashed border-border/60 flex items-center justify-center text-muted-foreground/0 group-hover/cell:text-muted-foreground/50 hover:!text-primary hover:!border-primary/40 transition-colors"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-64"
                                  align="start"
                                  onInteractOutside={(e) => {
                                    // The Subject/Teacher <Select> dropdowns render into their own
                                    // Radix portal, which this Popover doesn't recognize as "inside"
                                    // itself — without this guard, picking an option closes the
                                    // popover instead of just updating the field.
                                    if ((e.target as HTMLElement).closest('[data-radix-popper-content-wrapper]')) {
                                      e.preventDefault();
                                    }
                                  }}
                                >
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-foreground">{d} · {p.label}</p>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Subject</Label>
                                      <Select value={form.subjectId} onValueChange={handleSubjectChange}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Teacher{competentTeacherIdsForForm && <span className="text-muted-foreground font-normal"> · competent only</span>}</Label>
                                      <Select value={form.teacherId} onValueChange={v => setForm(f => ({ ...f, teacherId: v }))}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent>{teacherOptionsForForm.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                    {!isCompetent && form.subjectId && form.teacherId && (
                                      <div className="flex items-start gap-1.5 rounded-md bg-warning/10 border border-warning/30 p-1.5">
                                        <AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-foreground">Not declared competent — you'll confirm an override.</p>
                                      </div>
                                    )}
                                    {conflictingEntry && (
                                      <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 border border-destructive/30 p-1.5">
                                        <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-foreground">Already teaching {conflictingEntry.className} {conflictingEntry.subjectName} at this time — pick another teacher.</p>
                                      </div>
                                    )}
                                    {showRoomInput ? (
                                      <Input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="Room (optional)" className="h-8 text-sm" />
                                    ) : (
                                      <button type="button" onClick={() => setShowRoomInput(true)} className="text-[11px] text-primary hover:underline">+ Room</button>
                                    )}
                                    <Button size="sm" className="w-full h-8" disabled={!form.subjectId || !form.teacherId || !!conflictingEntry} onClick={() => handleCreate(d, p.id)}>
                                      Add
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!pendingOverride} onOpenChange={(o) => !o && setPendingOverride(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-warning" /> Confirm Competency Override</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This teacher hasn't been declared qualified for this subject/grade. Adding the slot anyway will be recorded as an admin override.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingOverride(null)}>Cancel</Button>
            <Button onClick={() => pendingOverride && submitEntry(pendingOverride.form, pendingOverride.day, pendingOverride.periodId, true)}>Add Anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Periods */}
      <Dialog open={periodsOpen} onOpenChange={setPeriodsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Manage Periods — {academicYears.find(y => y.id === activeYearId)?.name}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">One bell schedule shared by every class/section this year.</p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {periods.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-2 rounded-lg border p-2 ${p.isBreak ? "bg-secondary/40 border-border" : "bg-card border-border"}`}>
                <div className="flex flex-col">
                  <button disabled={i === 0} className="disabled:opacity-20" onClick={() => handleMovePeriod(i, -1)}><ArrowUp className="h-3 w-3" /></button>
                  <button disabled={i === periods.length - 1} className="disabled:opacity-20" onClick={() => handleMovePeriod(i, 1)}><ArrowDown className="h-3 w-3" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{p.label} {p.isBreak && <span className="text-[9px] uppercase text-muted-foreground">(Break)</span>}</p>
                  <p className="text-[10px] text-muted-foreground">{p.startTime} - {p.endTime}</p>
                </div>
                <button onClick={() => handleDeletePeriod(p.id)} className="text-destructive/70 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {periods.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No periods yet — add the first one below.</p>}
          </div>
          <div className="rounded-lg border border-border p-3 space-y-2">
            <Input placeholder="Label, e.g. Period 1 or Lunch Break" value={periodForm.label} onChange={e => setPeriodForm(f => ({ ...f, label: e.target.value }))} className="h-8 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <Input type="time" value={periodForm.startTime} onChange={e => setPeriodForm(f => ({ ...f, startTime: e.target.value }))} className="h-8 text-sm" />
              <Input type="time" value={periodForm.endTime} onChange={e => setPeriodForm(f => ({ ...f, endTime: e.target.value }))} className="h-8 text-sm" />
            </div>
            {!periodTimeValid && <p className="text-xs text-destructive">End time must be after the start time.</p>}
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={periodForm.isBreak} onChange={e => setPeriodForm(f => ({ ...f, isBreak: e.target.checked }))} className="accent-primary" />
              This is a break (not assignable)
            </label>
            <Button size="sm" className="w-full" disabled={!periodForm.label || !periodTimeValid} onClick={handleAddPeriod}><Plus className="h-3.5 w-3.5 mr-1" /> Add Period</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Copy From */}
      <Dialog open={copyOpen} onOpenChange={(o) => { setCopyOpen(o); if (!o) setCopyResult(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Copy Timetable From Another Section</DialogTitle></DialogHeader>
          {!copyResult ? (
            <>
              <p className="text-xs text-muted-foreground">Copies the source section's full week into the currently selected class/section as drafts. Slots that fail a competency or scheduling check are skipped, not blocked.</p>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Source Class</Label>
                  <Select value={copySourceClassId} onValueChange={setCopySourceClassId}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Source Section</Label>
                  <Select value={copySourceSectionId} onValueChange={setCopySourceSectionId} disabled={!copySourceClassId}>
                    <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                    <SelectContent>{copySourceSections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCopyOpen(false)}>Cancel</Button>
                <Button disabled={!copySourceSectionId || copying} onClick={handleCopy}>{copying ? "Copying..." : "Copy"}</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground">Copied <strong>{copyResult.copied}</strong> slot(s) as drafts{copyResult.skipped.length > 0 ? `, skipped ${copyResult.skipped.length}:` : "."}</p>
              {copyResult.skipped.length > 0 && (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {copyResult.skipped.map((s, i) => (
                    <div key={i} className="rounded-lg bg-warning/10 border border-warning/30 p-2 text-xs">
                      <p className="font-semibold text-foreground">{s.subjectName} · {s.teacherName} · {s.dayOfWeek} {s.startTime}-{s.endTime}</p>
                      <p className="text-muted-foreground mt-0.5">{s.reason}</p>
                    </div>
                  ))}
                </div>
              )}
              <DialogFooter><Button onClick={() => setCopyOpen(false)}>Done</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Teacher Workload */}
      <Dialog open={workloadOpen} onOpenChange={setWorkloadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Teacher Workload</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            {teacherWorkload.length} teacher{teacherWorkload.length === 1 ? "" : "s"} · average {avgWorkload} period{avgWorkload === 1 ? "" : "s"}/week this year
          </p>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left text-xs font-semibold text-muted-foreground py-2 pr-2 w-8">#</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground py-2 pr-2">Teacher</th>
                  {DAYS.map(d => <th key={d} className="text-center text-xs font-semibold text-muted-foreground py-2 px-1 w-12">{d.slice(0, 3)}</th>)}
                  <th className="text-right text-xs font-semibold text-muted-foreground py-2 pl-2 w-14">Total</th>
                </tr>
              </thead>
              <tbody>
                {teacherWorkload.map((t, i) => (
                  <tr key={t.teacherId} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className={`py-2 pr-2 text-xs font-bold ${i === 0 && t.total > 0 ? "text-primary" : "text-muted-foreground"}`}>{i + 1}</td>
                    <td className="py-2 pr-2 text-foreground font-medium truncate max-w-[160px]">{t.name}</td>
                    {DAYS.map(d => {
                      const n = t.byDay[d];
                      const intensity = n === 0 ? "" : n <= 1 ? "bg-primary/15" : n <= 2 ? "bg-primary/35" : n <= 3 ? "bg-primary/55" : "bg-primary/80 text-primary-foreground";
                      return (
                        <td key={d} className="text-center py-2 px-1">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-semibold ${intensity || "text-muted-foreground/40"}`}>
                            {n || "—"}
                          </span>
                        </td>
                      );
                    })}
                    <td className="text-right pl-2 py-2">
                      <span className={`font-bold ${t.total === 0 ? "text-muted-foreground/50" : t.total > avgWorkload * 1.3 ? "text-destructive" : "text-foreground"}`}>{t.total}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground">Darker cells = more periods that day. Red totals are notably above the school average.</p>
        </DialogContent>
      </Dialog>

      {/* Schedule Conflicts */}
      <Dialog open={conflictsOpen} onOpenChange={setConflictsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Schedule Conflicts</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            {scheduleConflicts.length === 0
              ? "No teacher is double-booked anywhere in the published timetable."
              : `${scheduleConflicts.length} teacher${scheduleConflicts.length === 1 ? " is" : "s are"} scheduled in two places at once. Remove one of the colliding slots to resolve.`}
          </p>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {scheduleConflicts.map((g, i) => (
              <div key={i} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> {g.teacherName} · {g.day} · {g.entries[0].startTime}–{g.entries[g.entries.length - 1].endTime}
                </p>
                <div className="mt-2 space-y-1.5">
                  {g.entries.map(e => (
                    <div key={e.id} className="flex items-center justify-between text-xs bg-card border border-border rounded-md px-2.5 py-1.5">
                      <span className="text-foreground">{e.className} — {e.subjectName} <span className="text-muted-foreground">({e.startTime}-{e.endTime})</span></span>
                      <button
                        className="text-muted-foreground hover:text-destructive shrink-0 ml-2"
                        title="Remove this slot"
                        onClick={async () => { await handleDelete(e.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
