"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAppState } from "@/lib/state-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Plus, PenSquare, GraduationCap, ArrowLeft, MoreVertical, Trash2, Search, CircleDot, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import {
  fetchAcademicYearsDB, fetchClassesDB, fetchSectionsByClassDB,
  fetchTermExamsDB, createTermExamDB, updateTermExamDB, updateTermExamStatusDB, deleteTermExamDB,
  fetchExamSubjectsDB, addExamSubjectDB, deleteExamSubjectDB,
  fetchExamSchedulesDB,
} from "@/app/actions/academic-core";
import type { AcademicYear, ClassItem, SectionItem, TermExam, ExamSubjectItem } from "@/lib/types";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { DatesheetCard } from "../datesheet-card";

const EXAM_TYPES = [
  { value: "MidTerm", label: "Mid Term" },
  { value: "Final", label: "Final" },
  { value: "Monthly", label: "Monthly Test" },
  { value: "Quiz", label: "Quiz" },
];

const STATUS_STYLES: Record<string, string> = {
  Scheduled: "bg-slate-100 text-slate-600",
  Ongoing: "bg-blue-100 text-blue-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Published: "bg-purple-100 text-purple-700",
};

export default function ManageExamsPage() {
  const { can, loaded } = usePermission();
  const { toast } = useToast();
  const { subjects } = useAppState();
  const searchParams = useSearchParams();
  const initialExamId = searchParams.get("examId") || "";

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [activeYearId, setActiveYearId] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [exams, setExams] = useState<TermExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState(initialExamId);
  const [examSubjects, setExamSubjects] = useState<ExamSubjectItem[]>([]);
  const [examSearch, setExamSearch] = useState("");

  const [createExamOpen, setCreateExamOpen] = useState(false);
  const [editExamOpen, setEditExamOpen] = useState(false);
  const [deleteExamTarget, setDeleteExamTarget] = useState<TermExam | null>(null);
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState<{ id: string; subjectName: string } | null>(null);

  const [newExam, setNewExam] = useState({ name: "", examType: "MidTerm", classId: "", sectionId: "", startDate: "", endDate: "" });
  // Inline "add a row" form, same pattern as the Datesheet grid below — no
  // modal to open, no context switch, just pick a subject and hit Enter.
  const [subjectForm, setSubjectForm] = useState({ subjectId: "", totalMarks: "100", passingMarks: "33" });
  const [addingSubject, setAddingSubject] = useState(false);
  const [editExam, setEditExam] = useState({ id: "", name: "", examType: "MidTerm", classId: "", sectionId: "", startDate: "", endDate: "" });
  const [datesheet, setDatesheet] = useState<Awaited<ReturnType<typeof fetchExamSchedulesDB>>>([]);

  const loadContext = useCallback(async () => {
    const years = await fetchAcademicYearsDB();
    setAcademicYears(years);
    const active = years.find(y => y.isActive) || years[0];
    if (active) {
      setActiveYearId(active.id);
      const cls = await fetchClassesDB(active.id);
      setClasses(cls);
    }
  }, []);

  useEffect(() => { loadContext(); }, [loadContext]);

  const loadExams = useCallback(async () => {
    if (!activeYearId) return;
    setExams(await fetchTermExamsDB(activeYearId));
  }, [activeYearId]);

  useEffect(() => { loadExams(); }, [loadExams]);

  useEffect(() => {
    if (selectedExamId) {
      fetchExamSubjectsDB(selectedExamId).then(setExamSubjects);
      fetchExamSchedulesDB(selectedExamId).then(setDatesheet);
      const exam = exams.find(e => e.id === selectedExamId);
      if (exam) fetchSectionsByClassDB(exam.classId).then(setSections);
    } else {
      setExamSubjects([]);
      setDatesheet([]);
    }
  }, [selectedExamId, exams]);

  // First exam loaded, or the very first one created, becomes the selection
  // automatically — landing on this page should never show an empty detail
  // pane when there's clearly something to look at.
  useEffect(() => {
    if (!selectedExamId && exams.length > 0) setSelectedExamId(exams[0].id);
  }, [exams, selectedExamId]);

  const selectedExam = exams.find(e => e.id === selectedExamId) || null;
  const availableSubjects = useMemo(
    () => subjects.filter(s => !examSubjects.some(es => es.subjectId === s.id)),
    [subjects, examSubjects]
  );
  const totalMarksSum = examSubjects.reduce((sum, es) => sum + (es.totalMarks || 0), 0);
  const scheduledSubjectCount = new Set(datesheet.map(d => d.subjectId)).size;

  const filteredExams = examSearch.trim()
    ? exams.filter(e => (e.name + " " + e.examType + " " + (e.className || "")).toLowerCase().includes(examSearch.trim().toLowerCase()))
    : exams;

  const handleCreateExam = async () => {
    if (!newExam.name || !newExam.classId || !newExam.startDate || !newExam.endDate) {
      toast({ title: "Fill required fields", variant: "destructive" }); return;
    }
    const exam = await createTermExamDB({ ...newExam, academicYearId: activeYearId });
    if (exam) {
      setCreateExamOpen(false);
      setNewExam({ name: "", examType: "MidTerm", classId: "", sectionId: "", startDate: "", endDate: "" });
      await loadExams();
      setSelectedExamId(exam.id);
      toast({ title: "Exam created — add its subjects below" });
    } else {
      toast({ title: "Failed to create exam", variant: "destructive" });
    }
  };

  const handleAddSubject = async () => {
    if (!selectedExamId || !subjectForm.subjectId || !subjectForm.totalMarks) {
      toast({ title: "Pick a subject", variant: "destructive" }); return;
    }
    setAddingSubject(true);
    await addExamSubjectDB({
      examId: selectedExamId,
      subjectId: subjectForm.subjectId,
      totalMarks: parseInt(subjectForm.totalMarks),
      passingMarks: parseInt(subjectForm.passingMarks),
    });
    setExamSubjects(await fetchExamSubjectsDB(selectedExamId));
    setAddingSubject(false);
    // Reset to the next unused subject so repeated Enter presses walk
    // straight down the subject list.
    setSubjectForm({ subjectId: "", totalMarks: "100", passingMarks: "33" });
    toast({ title: "Subject added" });
  };

  const handleEditExam = async () => {
    if (!editExam.name || !editExam.classId || !editExam.startDate || !editExam.endDate) {
      toast({ title: "Fill required fields", variant: "destructive" }); return;
    }
    const ok = await updateTermExamDB(editExam.id, {
      name: editExam.name, examType: editExam.examType,
      classId: editExam.classId, sectionId: editExam.sectionId || undefined,
      startDate: editExam.startDate, endDate: editExam.endDate,
    });
    if (ok) { setEditExamOpen(false); loadExams(); toast({ title: "Exam updated" }); }
    else { toast({ title: "Failed to update exam", variant: "destructive" }); }
  };

  const confirmDeleteExam = async () => {
    if (!deleteExamTarget) return;
    await deleteTermExamDB(deleteExamTarget.id);
    if (selectedExamId === deleteExamTarget.id) setSelectedExamId("");
    setDeleteExamTarget(null);
    loadExams();
    toast({ title: "Exam deleted" });
  };

  const confirmDeleteSubject = async () => {
    if (!deleteSubjectTarget || !selectedExamId) return;
    await deleteExamSubjectDB(deleteSubjectTarget.id);
    setExamSubjects(await fetchExamSubjectsDB(selectedExamId));
    setDeleteSubjectTarget(null);
    toast({ title: "Subject removed" });
  };

  if (!loaded) return <PageSkeleton />;
  if (!can("exams.manage")) return <Unauthorized />;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/exams" className="p-2 hover:bg-slate-100 rounded-lg transition"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">Manage Exams</h1>
            <p className="text-sm text-[#64748B] mt-1">Create an exam, add its subjects, then set the datesheet</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={activeYearId} onValueChange={setActiveYearId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>{academicYears.map(y => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => setCreateExamOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Exam</Button>
        </div>
      </div>

      {exams.length === 0 ? (
        <div className="text-center py-16 text-[#94A3B8] border border-dashed border-[#E5E7EB] rounded-xl">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="mb-3">No exams yet for this year.</p>
          <Button size="sm" onClick={() => setCreateExamOpen(true)}><Plus className="h-4 w-4 mr-1" /> Create your first exam</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
          {/* Exam list — compact rows, one click to select, no buried actions */}
          <Card className="border-[#E5E7EB] lg:sticky lg:top-4">
            <CardHeader className="pb-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <Input value={examSearch} onChange={e => setExamSearch(e.target.value)} placeholder="Search exams..." className="h-8 pl-8 text-sm" />
              </div>
            </CardHeader>
            <CardContent className="p-2 space-y-1 max-h-[70vh] overflow-y-auto">
              {filteredExams.length === 0 && <p className="text-xs text-[#94A3B8] text-center py-4">No matches</p>}
              {filteredExams.map(exam => (
                <button
                  key={exam.id}
                  onClick={() => setSelectedExamId(exam.id)}
                  className={`w-full text-left rounded-lg p-2.5 transition-colors border ${
                    selectedExamId === exam.id ? "bg-[#EFF6FF] border-[#BFDBFE]" : "border-transparent hover:bg-[#F8FAFC]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{exam.name}</span>
                    <Badge className={`${STATUS_STYLES[exam.status] || ""} text-[10px] shrink-0`}>{exam.status}</Badge>
                  </div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5 flex items-center gap-1.5">
                    <span>{exam.examType}</span>·<span>{exam.className}{exam.sectionName ? ` / ${exam.sectionName}` : ""}</span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Detail pane for the selected exam */}
          <div className="space-y-5 min-w-0">
            {selectedExam && (
              <>
                <Card className="border-[#E5E7EB]">
                  <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-semibold text-[#0F172A]">{selectedExam.name}</h2>
                        <Badge className={STATUS_STYLES[selectedExam.status] || ""}>{selectedExam.status}</Badge>
                      </div>
                      <p className="text-sm text-[#64748B] mt-1">
                        {selectedExam.examType} · {selectedExam.className}{selectedExam.sectionName ? ` / ${selectedExam.sectionName}` : " / All sections"} · {selectedExam.startDate} → {selectedExam.endDate}
                      </p>
                      <p className="text-xs text-[#94A3B8] mt-1.5">
                        {examSubjects.length} subject{examSubjects.length === 1 ? "" : "s"} · {totalMarksSum} total marks · {scheduledSubjectCount}/{examSubjects.length} scheduled
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="text-xs h-8"
                        onClick={() => { fetchSectionsByClassDB(selectedExam.classId).then(setSections); setEditExam({ id: selectedExam.id, name: selectedExam.name, examType: selectedExam.examType, classId: selectedExam.classId, sectionId: selectedExam.sectionId || "", startDate: selectedExam.startDate, endDate: selectedExam.endDate }); setEditExamOpen(true); }}>
                        <PenSquare className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => updateTermExamStatusDB(selectedExam.id, "Ongoing").then(loadExams)}>
                            <CircleDot className="h-3.5 w-3.5 mr-2" /> Mark Ongoing
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateTermExamStatusDB(selectedExam.id, "Completed").then(loadExams)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Mark Completed
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => setDeleteExamTarget(selectedExam)}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Exam
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#E5E7EB]">
                  <CardHeader className="pb-2">
                    <h3 className="font-medium text-sm">Subjects</h3>
                  </CardHeader>
                  <CardContent className="p-0">
                    {examSubjects.length === 0 && (
                      <p className="text-sm text-[#94A3B8] text-center py-4">No subjects yet — add the first one below.</p>
                    )}
                    {examSubjects.length > 0 && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-[#F8FAFC]">
                            <th className="p-2.5 text-left text-xs font-semibold text-[#64748B]">Subject</th>
                            <th className="p-2.5 text-left text-xs font-semibold text-[#64748B] w-28">Total Marks</th>
                            <th className="p-2.5 text-left text-xs font-semibold text-[#64748B] w-28">Passing</th>
                            <th className="p-2.5 text-left text-xs font-semibold text-[#64748B]">Teacher</th>
                            <th className="p-2.5 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {examSubjects.map(es => (
                            <tr key={es.id} className="border-b last:border-b-0 hover:bg-[#FAFBFC] group">
                              <td className="p-2.5 font-medium">{es.subjectName}</td>
                              <td className="p-2.5 text-[#64748B]">{es.totalMarks}</td>
                              <td className="p-2.5 text-[#64748B]">{es.passingMarks}</td>
                              <td className="p-2.5 text-[#94A3B8]">{es.teacherName || "—"}</td>
                              <td className="p-2.5">
                                <button
                                  onClick={() => setDeleteSubjectTarget({ id: es.id, subjectName: es.subjectName || "this subject" })}
                                  className="p-1 rounded hover:bg-[#FEE2E2] opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Remove"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {/* Inline add row — pick a subject, hit Enter, it's added
                        and ready for the next one, no dialog in the way. */}
                    <div className="p-3 border-t flex flex-wrap items-end gap-2 bg-[#FAFBFC]">
                      <div className="flex-1 min-w-[160px] space-y-1">
                        <Label className="text-xs">Subject</Label>
                        <Select value={subjectForm.subjectId} onValueChange={v => setSubjectForm(f => ({ ...f, subjectId: v }))}>
                          <SelectTrigger className="h-9"><SelectValue placeholder={availableSubjects.length === 0 ? "All subjects added" : "Select subject"} /></SelectTrigger>
                          <SelectContent>{availableSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="w-24 space-y-1">
                        <Label className="text-xs">Total</Label>
                        <Input type="number" className="h-9" value={subjectForm.totalMarks} onChange={e => setSubjectForm(f => ({ ...f, totalMarks: e.target.value }))} />
                      </div>
                      <div className="w-24 space-y-1">
                        <Label className="text-xs">Passing</Label>
                        <Input type="number" className="h-9" value={subjectForm.passingMarks} onChange={e => setSubjectForm(f => ({ ...f, passingMarks: e.target.value }))} />
                      </div>
                      <Button size="sm" className="h-9" disabled={!subjectForm.subjectId || addingSubject} onClick={handleAddSubject}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> {addingSubject ? "Adding..." : "Add"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {examSubjects.length > 0 && (
                  <DatesheetCard
                    exam={selectedExam}
                    examSubjects={examSubjects}
                    sections={sections}
                    datesheet={datesheet}
                    onDatesheetChange={setDatesheet}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={createExamOpen} onOpenChange={setCreateExamOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Exam</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Exam Name</Label><Input value={newExam.name} onChange={e => setNewExam({ ...newExam, name: e.target.value })} placeholder="e.g. Mid Term 2026" /></div>
            <div><Label>Type</Label>
              <Select value={newExam.examType} onValueChange={v => setNewExam({ ...newExam, examType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXAM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Class</Label>
              <Select value={newExam.classId} onValueChange={v => { setNewExam({ ...newExam, classId: v, sectionId: "" }); fetchSectionsByClassDB(v).then(setSections); }}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Section (optional)</Label>
              <Select value={newExam.sectionId || ""} onValueChange={v => setNewExam({ ...newExam, sectionId: v === "ALL" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="All sections" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Sections</SelectItem>
                  {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Start Date</Label><Input type="date" value={newExam.startDate} onChange={e => setNewExam({ ...newExam, startDate: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={newExam.endDate} onChange={e => setNewExam({ ...newExam, endDate: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateExamOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateExam}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editExamOpen} onOpenChange={setEditExamOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Exam</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Exam Name</Label><Input value={editExam.name} onChange={e => setEditExam({ ...editExam, name: e.target.value })} /></div>
            <div><Label>Type</Label>
              <Select value={editExam.examType} onValueChange={v => setEditExam({ ...editExam, examType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXAM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Class</Label>
              <Select value={editExam.classId} onValueChange={v => { setEditExam({ ...editExam, classId: v, sectionId: "" }); fetchSectionsByClassDB(v).then(setSections); }}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Section (optional)</Label>
              <Select value={editExam.sectionId || ""} onValueChange={v => setEditExam({ ...editExam, sectionId: v === "ALL" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="All sections" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Sections</SelectItem>
                  {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Start Date</Label><Input type="date" value={editExam.startDate} onChange={e => setEditExam({ ...editExam, startDate: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={editExam.endDate} onChange={e => setEditExam({ ...editExam, endDate: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExamOpen(false)}>Cancel</Button>
            <Button onClick={handleEditExam}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteExamTarget} onOpenChange={() => setDeleteExamTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Exam</DialogTitle></DialogHeader>
          <p className="text-sm text-[#64748B]">Are you sure you want to delete <strong>{deleteExamTarget?.name}</strong>? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteExamTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteExam}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteSubjectTarget} onOpenChange={() => setDeleteSubjectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove Subject</DialogTitle></DialogHeader>
          <p className="text-sm text-[#64748B]">Remove <strong>{deleteSubjectTarget?.subjectName}</strong> from this exam? Any marks entered for this subject will also be removed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSubjectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteSubject}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
