"use client";

import { useState, useEffect, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, PenSquare, GraduationCap, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import {
  fetchAcademicYearsDB, fetchClassesDB, fetchSectionsByClassDB,
  fetchTermExamsDB, createTermExamDB, updateTermExamDB, updateTermExamStatusDB, deleteTermExamDB,
  fetchExamSubjectsDB, addExamSubjectDB, deleteExamSubjectDB,
} from "@/app/actions/academic-core";
import type { AcademicYear, ClassItem, SectionItem, TermExam, ExamSubjectItem } from "@/lib/types";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";

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

  const [createExamOpen, setCreateExamOpen] = useState(false);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [editExamOpen, setEditExamOpen] = useState(false);
  const [deleteExamTarget, setDeleteExamTarget] = useState<TermExam | null>(null);
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState<{ id: string; subjectName: string } | null>(null);

  const [newExam, setNewExam] = useState({ name: "", examType: "MidTerm", classId: "", sectionId: "", startDate: "", endDate: "" });
  const [newExamSubject, setNewExamSubject] = useState({ subjectId: "", totalMarks: "100", passingMarks: "33" });
  const [editExam, setEditExam] = useState({ id: "", name: "", examType: "MidTerm", classId: "", sectionId: "", startDate: "", endDate: "" });

  const examTypeColors: Record<string, string> = {
    MidTerm: "bg-blue-100 text-blue-700", Final: "bg-purple-100 text-purple-700",
    Monthly: "bg-green-100 text-green-700", Quiz: "bg-yellow-100 text-yellow-700",
  };

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
      const exam = exams.find(e => e.id === selectedExamId);
      if (exam) fetchSectionsByClassDB(exam.classId).then(setSections);
    }
  }, [selectedExamId, exams]);

  const handleCreateExam = async () => {
    if (!newExam.name || !newExam.classId || !newExam.startDate || !newExam.endDate) {
      toast({ title: "Fill required fields", variant: "destructive" }); return;
    }
    const exam = await createTermExamDB({ ...newExam, academicYearId: activeYearId });
    if (exam) {
      setCreateExamOpen(false);
      setNewExam({ name: "", examType: "MidTerm", classId: "", sectionId: "", startDate: "", endDate: "" });
      loadExams();
      setSelectedExamId(exam.id);
      toast({ title: "Exam created" });
    }
  };

  const handleAddSubject = async () => {
    if (!newExamSubject.subjectId || !newExamSubject.totalMarks) {
      toast({ title: "Fill all fields", variant: "destructive" }); return;
    }
    await addExamSubjectDB({
      examId: selectedExamId,
      subjectId: newExamSubject.subjectId,
      totalMarks: parseInt(newExamSubject.totalMarks),
      passingMarks: parseInt(newExamSubject.passingMarks),
    });
    setAddSubjectOpen(false);
    setNewExamSubject({ subjectId: "", totalMarks: "100", passingMarks: "33" });
    const subs = await fetchExamSubjectsDB(selectedExamId);
    setExamSubjects(subs);
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
    if (!deleteSubjectTarget) return;
    await deleteExamSubjectDB(deleteSubjectTarget.id);
    const subs = await fetchExamSubjectsDB(selectedExamId);
    setExamSubjects(subs);
    setDeleteSubjectTarget(null);
    toast({ title: "Subject removed" });
  };

  if (!loaded) return <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading...</div>;
  if (!can("exams.manage")) return <Unauthorized />;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/exams" className="p-2 hover:bg-slate-100 rounded-lg transition"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">Manage Exams</h1>
            <p className="text-sm text-[#64748B] mt-1">Create, edit and manage exams and their subjects</p>
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
        <div className="text-center py-12 text-[#94A3B8]">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No exams yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exams.map(exam => (
            <Card key={exam.id} className={`border-[#E5E7EB] cursor-pointer transition-colors ${selectedExamId === exam.id ? 'ring-2 ring-[#2563EB]' : ''}`}
              onClick={() => setSelectedExamId(exam.id)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={examTypeColors[exam.examType] || ""}>{exam.examType}</Badge>
                    <span className="font-medium">{exam.name}</span>
                  </div>
                  <Badge>{exam.status}</Badge>
                </div>
                <div className="text-xs text-[#64748B] space-y-1">
                  <p>Class: {exam.className} {exam.sectionName ? `/ ${exam.sectionName}` : ""}</p>
                  <p>{exam.startDate} → {exam.endDate}</p>
                </div>
                {selectedExamId === exam.id && (
                  <div className="flex gap-1 mt-3 pt-3 border-t border-[#E5E7EB]">
                    <Button size="sm" variant="outline" className="text-xs h-7"
                      onClick={(e) => { e.stopPropagation(); fetchSectionsByClassDB(exam.classId).then(setSections); setEditExam({ id: exam.id, name: exam.name, examType: exam.examType, classId: exam.classId, sectionId: exam.sectionId || "", startDate: exam.startDate, endDate: exam.endDate }); setEditExamOpen(true); }}>
                      <PenSquare className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7"
                      onClick={async (e) => { e.stopPropagation(); await updateTermExamStatusDB(exam.id, "Ongoing"); loadExams(); }}>
                      Mark Ongoing
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7"
                      onClick={async (e) => { e.stopPropagation(); await updateTermExamStatusDB(exam.id, "Completed"); loadExams(); }}>
                      Mark Completed
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7 text-red-500"
                      onClick={(e) => { e.stopPropagation(); setDeleteExamTarget(exam); }}>
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedExamId && (
        <Card className="border-[#E5E7EB]">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <h3 className="font-medium text-sm">Subjects in this Exam</h3>
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setAddSubjectOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Subject
            </Button>
          </CardHeader>
          <CardContent>
            {examSubjects.length === 0 ? (
              <p className="text-sm text-[#94A3B8] text-center py-4">No subjects added yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {examSubjects.map(es => (
                  <Badge key={es.id} variant="outline" className="flex items-center gap-1 py-1.5">
                    {es.subjectName}
                    <span className="text-[#94A3B8]">({es.totalMarks} marks)</span>
                    {es.teacherName && <span className="text-[#94A3B8]">—{es.teacherName}</span>}
                    <button onClick={() => setDeleteSubjectTarget({ id: es.id, subjectName: es.subjectName || "this subject" })}
                      className="ml-1 hover:text-red-500">×</button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
                <SelectContent>
                  <SelectItem value="MidTerm">Mid Term</SelectItem>
                  <SelectItem value="Final">Final</SelectItem>
                  <SelectItem value="Monthly">Monthly Test</SelectItem>
                  <SelectItem value="Quiz">Quiz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Class</Label>
              <Select value={newExam.classId} onValueChange={v => setNewExam({ ...newExam, classId: v })}>
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
          <DialogFooter><Button onClick={handleCreateExam}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addSubjectOpen} onOpenChange={setAddSubjectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Subject to Exam</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Subject</Label>
              <Select value={newExamSubject.subjectId} onValueChange={v => setNewExamSubject({ ...newExamSubject, subjectId: v })}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Total Marks</Label><Input type="number" value={newExamSubject.totalMarks} onChange={e => setNewExamSubject({ ...newExamSubject, totalMarks: e.target.value })} /></div>
              <div><Label>Passing Marks</Label><Input type="number" value={newExamSubject.passingMarks} onChange={e => setNewExamSubject({ ...newExamSubject, passingMarks: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddSubject}>Add</Button></DialogFooter>
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
                <SelectContent>
                  <SelectItem value="MidTerm">Mid Term</SelectItem>
                  <SelectItem value="Final">Final</SelectItem>
                  <SelectItem value="Monthly">Monthly Test</SelectItem>
                  <SelectItem value="Quiz">Quiz</SelectItem>
                </SelectContent>
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
