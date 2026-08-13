"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppState } from "@/lib/state-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
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
import { Plus, Trash2, UploadCloud, AlertTriangle, ShieldAlert, Settings, Copy, ArrowUp, ArrowDown } from "lucide-react";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import type { AcademicYear, ClassItem, SectionItem } from "@/lib/types";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function TimetablePage() {
  const { can, loaded } = usePermission();
  const { subjects, students } = useAppState();
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
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subjectId: "", teacherId: "", dayOfWeek: "Monday", periodId: "", room: "" });
  const [pendingOverride, setPendingOverride] = useState<typeof form | null>(null);

  // Manage Periods dialog
  const [periodsOpen, setPeriodsOpen] = useState(false);
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

    if (sessionRole === "ADMIN") {
      if (classId && sectionId && activeYearId) {
        data = await fetchTimetableDB(undefined, undefined, { classId, sectionId, academicYearId: activeYearId, status: "all" });
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
  const selectedPeriod = useMemo(() => periods.find(p => p.id === form.periodId), [periods, form.periodId]);

  const isCompetent = useMemo(() => {
    if (!form.teacherId || !form.subjectId || !classId) return true;
    return competencies.some(c => c.teacherId === parseInt(form.teacherId) && c.subjectId === form.subjectId && c.classId === classId);
  }, [form.teacherId, form.subjectId, classId, competencies]);

  const submitEntry = async (f: typeof form, override: boolean) => {
    const teacher = teachers.find(t => String(t.id) === f.teacherId);
    const subject = subjects.find(s => s.id === f.subjectId);
    const cls = classes.find(c => c.id === classId);
    const period = periods.find(p => p.id === f.periodId);
    if (!teacher || !subject || !cls || !period) { toast({ title: "Fill all required fields.", variant: "destructive" }); return; }

    const res = await createTimetableEntryDB({
      className: cls.name, subjectName: subject.name, teacherName: teacher.name,
      dayOfWeek: f.dayOfWeek, startTime: period.startTime, endTime: period.endTime, room: f.room || null,
      classId, sectionId, subjectId: f.subjectId, teacherId: teacher.id, academicYearId: activeYearId,
      assignedByUserId: sessionUserId || undefined,
    }, { competencyOverride: override });

    if (res.needsCompetencyOverride) { setPendingOverride(f); return; }
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }

    toast({ title: "Slot added (draft)." });
    setOpen(false);
    setPendingOverride(null);
    setForm({ subjectId: "", teacherId: "", dayOfWeek: "Monday", periodId: "", room: "" });
    load();
  };

  const handleCreate = () => {
    if (!classId || !sectionId) { toast({ title: "Select a class and section first.", variant: "destructive" }); return; }
    if (!form.periodId) { toast({ title: "Select a period.", variant: "destructive" }); return; }
    submitEntry(form, false);
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
  const handleAddPeriod = async () => {
    if (!periodForm.label || !activeYearId) return;
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

  const getCell = (day: string, periodId: string) => entries.filter(e => {
    const p = periods.find(pp => pp.startTime === e.startTime && pp.endTime === e.endTime);
    return e.dayOfWeek === day && p?.id === periodId;
  });
  const hasDraft = entries.some(e => e.status === "draft");

  if (!loaded) return <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading...</div>;
  if (!can("timetable.view")) return <Unauthorized />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Timetable</h1>
          <p className="text-muted-foreground mt-1">
            {sessionRole === "ADMIN" ? "Build and publish each section's weekly schedule" : "Weekly class schedule"}
          </p>
        </div>
        {sessionRole === "ADMIN" && (
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

            {classId && sectionId && (
              <>
                <Button variant="outline" className="gap-2" onClick={() => { setCopyResult(null); setCopyOpen(true); }}>
                  <Copy className="h-4 w-4" /> Copy From...
                </Button>
                <Button variant="outline" className="gap-2" disabled={!hasDraft} onClick={handlePublish}>
                  <UploadCloud className="h-4 w-4" /> Publish
                </Button>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" disabled={teachingPeriods.length === 0}><Plus className="h-4 w-4" />Add Slot</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Timetable Slot</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label>Subject *</Label>
                          <Select value={form.subjectId} onValueChange={v => setForm(f => ({ ...f, subjectId: v }))}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1"><Label>Teacher *</Label>
                          <Select value={form.teacherId} onValueChange={v => setForm(f => ({ ...f, teacherId: v }))}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      {!isCompetent && (
                        <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 p-2.5">
                          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                          <p className="text-xs text-foreground">This teacher isn't declared competent for this subject/grade. You'll be asked to confirm an override.</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label>Day</Label>
                          <Select value={form.dayOfWeek} onValueChange={v => setForm(f => ({ ...f, dayOfWeek: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1"><Label>Period *</Label>
                          <Select value={form.periodId} onValueChange={v => setForm(f => ({ ...f, periodId: v }))}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{teachingPeriods.map(p => <SelectItem key={p.id} value={p.id}>{p.label} ({p.startTime}-{p.endTime})</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1"><Label>Room (optional)</Label><Input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="e.g. Room 101" /></div>
                    </div>
                    <DialogFooter><Button onClick={handleCreate}>Add Slot</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        )}
      </div>

      {sessionRole === "ADMIN" && (!classId || !sectionId) && (
        <p className="text-sm text-muted-foreground">Select a class and section above to build its timetable.</p>
      )}

      {sessionRole === "ADMIN" && classId && sectionId && teachingPeriods.length === 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 p-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">No periods defined for this academic year yet. Click <strong>Manage Periods</strong> above to set up the bell schedule before adding slots.</p>
        </div>
      )}

      {sessionRole === "ADMIN" && classId && sectionId && (
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
                        return (
                          <td key={d} className="p-2 align-top">
                            {cells.map(e => (
                              <div key={e.id} className={`border rounded-lg p-2 mb-1 relative group ${e.status === "draft" ? "bg-warning/10 border-warning/30" : "bg-primary/10 border-primary/20"}`}>
                                <div className="flex items-center gap-1">
                                  <p className="font-semibold text-primary text-xs">{e.subjectName}</p>
                                  {e.status === "draft" && <span className="text-[8px] uppercase font-bold text-warning">Draft</span>}
                                </div>
                                <p className="text-[10px] text-muted-foreground">{e.className}</p>
                                <p className="text-[10px] text-muted-foreground">{e.teacherName}</p>
                                {e.room && <p className="text-[10px] text-muted-foreground">{e.room}</p>}
                                {sessionRole === "ADMIN" && (
                                  <button onClick={() => handleDelete(e.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ))}
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
            <Button onClick={() => pendingOverride && submitEntry(pendingOverride, true)}>Add Anyway</Button>
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
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={periodForm.isBreak} onChange={e => setPeriodForm(f => ({ ...f, isBreak: e.target.checked }))} className="accent-primary" />
              This is a break (not assignable)
            </label>
            <Button size="sm" className="w-full" onClick={handleAddPeriod}><Plus className="h-3.5 w-3.5 mr-1" /> Add Period</Button>
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
    </div>
  );
}
