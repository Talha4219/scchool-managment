"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAppState } from "@/lib/state-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PenSquare, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import {
  fetchAcademicYearsDB, fetchSectionsByClassDB,
  fetchEnrollmentsDB,
  fetchTermExamsDB,
  fetchExamSubjectsDB,
  fetchMarksEntriesDB, upsertMarksEntryDB, submitMarksForSubjectDB,
  fetchGradeScalesDB,
} from "@/app/actions/academic-core";
import type { AcademicYear, TermExam, ExamSubjectItem, MarksEntry, Enrollment, GradeScaleItem } from "@/lib/types";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { PageSkeleton } from "@/components/ui/page-skeleton";

function computeGrade(percentage: number, gradeScale: GradeScaleItem[]): string {
  const sorted = [...gradeScale].sort((a, b) => b.minPercentage - a.minPercentage);
  for (const g of sorted) {
    if (percentage >= g.minPercentage && percentage <= g.maxPercentage) return g.grade;
  }
  return "F";
}

export default function MarksEntryPage() {
  const { can, loaded } = usePermission();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const initialExamId = searchParams.get("examId") || "";

  const [activeYearId, setActiveYearId] = useState("");
  const [exams, setExams] = useState<TermExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState(initialExamId);
  const [examSubjects, setExamSubjects] = useState<ExamSubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [marksEntries, setMarksEntries] = useState<MarksEntry[]>([]);
  const [marksInput, setMarksInput] = useState<Record<string, string>>({});
  const [remarksInput, setRemarksInput] = useState<Record<string, string>>({});
  const [savingMarks, setSavingMarks] = useState(false);
  const [submittingMarks, setSubmittingMarks] = useState(false);
  const [gradeScale, setGradeScale] = useState<GradeScaleItem[]>([]);

  useEffect(() => {
    (async () => {
      const years = await fetchAcademicYearsDB();
      const active = years.find(y => y.isActive) || years[0];
      if (active) setActiveYearId(active.id);
      setGradeScale(await fetchGradeScalesDB());
    })();
  }, []);

  const loadExams = useCallback(async () => {
    if (!activeYearId) return;
    setExams(await fetchTermExamsDB(activeYearId));
  }, [activeYearId]);

  useEffect(() => { loadExams(); }, [loadExams]);

  useEffect(() => {
    if (selectedExamId) {
      fetchExamSubjectsDB(selectedExamId).then(setExamSubjects);
      const exam = exams.find(e => e.id === selectedExamId);
      if (exam) {
        fetchSectionsByClassDB(exam.classId).then(() => {});
        fetchEnrollmentsDB(activeYearId, exam.classId).then(allEnrs => {
          setEnrollments(exam.sectionId ? allEnrs.filter(e => e.sectionId === exam.sectionId) : allEnrs);
        });
      }
    }
  }, [selectedExamId, exams, activeYearId]);

  useEffect(() => {
    if (selectedSubjectId) {
      fetchMarksEntriesDB(selectedSubjectId).then(entries => {
        setMarksEntries(entries);
        const map: Record<string, string> = {};
        const remarksMap: Record<string, string> = {};
        entries.forEach(e => { map[e.studentId] = String(e.marksObtained); remarksMap[e.studentId] = e.remarks || ""; });
        setMarksInput(map);
        setRemarksInput(remarksMap);
      });
    }
  }, [selectedSubjectId]);

  const handleSaveMarks = async () => {
    setSavingMarks(true);
    let count = 0;
    for (const [studentId, marksStr] of Object.entries(marksInput)) {
      const marks = parseInt(marksStr);
      if (isNaN(marks)) continue;
      await upsertMarksEntryDB({ examSubjectId: selectedSubjectId, studentId, marksObtained: marks, remarks: remarksInput[studentId] || undefined });
      count++;
    }
    const entries = await fetchMarksEntriesDB(selectedSubjectId);
    setMarksEntries(entries);
    setSavingMarks(false);
    toast({ title: `Saved ${count} marks` });
  };

  const handleSubmitMarks = async () => {
    setSubmittingMarks(true);
    await handleSaveMarks();
    await submitMarksForSubjectDB(selectedSubjectId);
    setSubmittingMarks(false);
    toast({ title: "Marks submitted for review" });
  };

  const currentSubject = examSubjects.find(es => es.id === selectedSubjectId);
  const totalMarks = currentSubject?.totalMarks || 100;
  const passingMarks = currentSubject?.passingMarks || 33;

  if (!loaded) return <PageSkeleton />;
  if (!can("exams.marks")) return <Unauthorized />;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/exams" className="p-2 hover:bg-slate-100 rounded-lg transition"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Marks Entry</h1>
          <p className="text-sm text-[#64748B] mt-1">Enter and submit marks for exam subjects</p>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <Select value={selectedExamId} onValueChange={setSelectedExamId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Select exam" /></SelectTrigger>
          <SelectContent>{exams.map(ex => <SelectItem key={ex.id} value={ex.id}>{ex.name} ({ex.className})</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Select subject" /></SelectTrigger>
          <SelectContent>
            {examSubjects.map(es => (
              <SelectItem key={es.id} value={es.id}>{es.subjectName} ({es.totalMarks} marks)</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedExamId && examSubjects.length > 0 && (
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600">Subject Completion</span>
              <span className="text-xs text-slate-500">
                {examSubjects.filter(es => marksEntries.some(me => me.examSubjectId === es.id && me.marksObtained > 0)).length}/{examSubjects.length} subjects filled
              </span>
            </div>
            <div className="flex gap-1.5">
              {examSubjects.map(es => {
                const hasEntries = marksEntries.some(me => me.examSubjectId === es.id && me.marksObtained > 0);
                const isSelected = es.id === selectedSubjectId;
                return (
                  <button key={es.id} onClick={() => setSelectedSubjectId(es.id)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      isSelected ? "bg-blue-600 text-white" : hasEntries ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}>
                    {es.subjectName}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedSubjectId ? (
        (() => {
          const filledCount = enrollments.filter(enr => {
            const val = marksInput[enr.studentId];
            return val !== undefined && val !== "" && !isNaN(parseInt(val));
          }).length;
          const overCount = enrollments.filter(enr => {
            const val = parseInt(marksInput[enr.studentId] || "0");
            return !isNaN(val) && val > totalMarks;
          }).length;
          const avgMarks = enrollments.length > 0
            ? enrollments.reduce((sum, enr) => sum + (parseInt(marksInput[enr.studentId] || "0") || 0), 0) / enrollments.length
            : 0;

          return (
            <>
              <div className="flex gap-3 items-center flex-wrap">
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveMarks} disabled={savingMarks}>
                    {savingMarks ? <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" /> : null}
                    Save Marks
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleSubmitMarks} disabled={savingMarks || submittingMarks}>
                    {submittingMarks ? <div className="h-3.5 w-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin mr-1" /> : null}
                    Submit Marks
                  </Button>
                </div>
                <div className="flex gap-3 text-xs text-slate-500">
                  <span>{filledCount}/{enrollments.length} entered</span>
                  {overCount > 0 && <span className="text-red-500 font-medium">{overCount} exceed max!</span>}
                  {enrollments.length > 0 && <span>Avg: {avgMarks.toFixed(1)}</span>}
                </div>
                <div className="ml-auto text-xs text-slate-400">Max: {totalMarks} | Pass: {passingMarks}</div>
              </div>

              <Card className="border-[#E5E7EB]">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Roll</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead className="w-28">Marks</TableHead>
                        <TableHead className="w-16">%</TableHead>
                        <TableHead className="w-16">Grade</TableHead>
                        <TableHead className="w-16">Result</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrollments.map((enr, idx) => {
                        const marksStr = marksInput[enr.studentId] || "";
                        const marks = parseInt(marksStr);
                        const isOverLimit = !isNaN(marks) && marks > totalMarks;
                        const pct = !isNaN(marks) && totalMarks > 0 ? (marks / totalMarks) * 100 : 0;
                        const grade = !isNaN(marks) ? computeGrade(pct, gradeScale) : null;
                        const isPass = grade ? gradeScale.find(g => g.grade === grade)?.isPass !== false : null;

                        return (
                          <TableRow key={enr.studentId} className={isOverLimit ? "bg-red-50" : ""}>
                            <TableCell className="text-slate-400 text-xs">{idx + 1}</TableCell>
                            <TableCell className="text-slate-500 text-xs">{enr.rollNumber}</TableCell>
                            <TableCell className="font-medium text-sm">{enr.studentName}</TableCell>
                            <TableCell>
                              <Input type="number" min={0} max={totalMarks}
                                className={`h-8 w-24 text-sm ${isOverLimit ? "border-red-400 bg-red-50 focus-visible:ring-red-400" : ""}`}
                                value={marksStr}
                                onChange={e => setMarksInput(prev => ({ ...prev, [enr.studentId]: e.target.value }))} />
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {!isNaN(marks) && totalMarks > 0 ? `${pct.toFixed(0)}%` : "—"}
                            </TableCell>
                            <TableCell>
                              {grade ? (
                                <Badge className={`${grade === "F" ? "bg-red-100 text-red-700" : grade.startsWith("A") ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"} text-xs`}>
                                  {grade}
                                </Badge>
                              ) : <span className="text-slate-300">—</span>}
                            </TableCell>
                            <TableCell>
                              {isPass !== null ? (
                                <span className={`text-xs font-medium ${isPass ? "text-emerald-600" : "text-red-600"}`}>
                                  {isPass ? "Pass" : "Fail"}
                                </span>
                              ) : <span className="text-slate-300">—</span>}
                            </TableCell>
                            <TableCell>
                              <Input className="h-8 text-sm" placeholder="Optional note"
                                value={remarksInput[enr.studentId] || ""}
                                onChange={e => setRemarksInput(prev => ({ ...prev, [enr.studentId]: e.target.value }))} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {enrollments.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-[#94A3B8]">No students enrolled</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          );
        })()
      ) : (
        <div className="text-center py-12 text-[#94A3B8]">
          <PenSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Select an exam and subject to enter marks</p>
        </div>
      )}
    </motion.div>
  );
}
