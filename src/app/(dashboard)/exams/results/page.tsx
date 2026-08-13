"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Eye, ArrowLeft, Download } from "lucide-react";
import { motion } from "framer-motion";
import {
  fetchAcademicYearsDB,
  fetchTermExamsDB,
  fetchResultsDB, updateResultStatusDB, publishExamResultsDB,
  fetchGradeScalesDB, computeSectionPositionsDB,
} from "@/app/actions/academic-core";
import type { AcademicYear, TermExam, GradeScaleItem } from "@/lib/types";
import { downloadCSV } from "@/lib/csv-export";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";

function computeGrade(percentage: number, gradeScale: GradeScaleItem[]): string {
  const sorted = [...gradeScale].sort((a, b) => b.minPercentage - a.minPercentage);
  for (const g of sorted) {
    if (percentage >= g.minPercentage && percentage <= g.maxPercentage) return g.grade;
  }
  return "F";
}

export default function ExamResultsPage() {
  const { can, loaded } = usePermission();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const initialExamId = searchParams.get("examId") || "";

  const [activeYearId, setActiveYearId] = useState("");
  const [exams, setExams] = useState<TermExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState(initialExamId);
  const [results, setResults] = useState<any[]>([]);
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

  const loadResults = useCallback(async () => {
    if (!selectedExamId) return;
    const data = await fetchResultsDB(selectedExamId);
    const sorted = [...data].sort((a, b) => b.percentage - a.percentage);
    setResults(sorted.map((r, i) => ({ ...r, sectionPosition: i + 1, sectionTotal: sorted.length })));
  }, [selectedExamId]);

  useEffect(() => { loadResults(); }, [loadResults]);

  if (!loaded) return <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading...</div>;
  if (!can("exams.results")) return <Unauthorized />;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/exams" className="p-2 hover:bg-slate-100 rounded-lg transition"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Results</h1>
          <p className="text-sm text-[#64748B] mt-1">Review, approve and publish exam results</p>
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <Select value={selectedExamId} onValueChange={setSelectedExamId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Select exam" /></SelectTrigger>
          <SelectContent>{exams.map(ex => <SelectItem key={ex.id} value={ex.id}>{ex.name} ({ex.className})</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" variant="secondary" onClick={loadResults}>Refresh</Button>
        <Button size="sm" variant="outline" onClick={async () => {
          await computeSectionPositionsDB(selectedExamId);
          loadResults();
          toast({ title: "Positions recomputed" });
        }}>Recompute Positions</Button>
        <Button size="sm" variant="outline" onClick={async () => {
          for (const res of results) {
            if (res.status === "Submitted") await updateResultStatusDB(res.id, "Reviewed");
          }
          loadResults();
          toast({ title: "All results reviewed" });
        }}>Review All</Button>
        <Button size="sm" variant="outline" onClick={async () => {
          for (const res of results) {
            if (res.status === "Reviewed") await updateResultStatusDB(res.id, "Approved");
          }
          loadResults();
          toast({ title: "All results approved" });
        }}>Approve All</Button>
        <Button size="sm" onClick={async () => {
          await publishExamResultsDB(selectedExamId);
          loadResults();
          toast({ title: "Results published" });
        }}>Publish</Button>
        <Button size="sm" variant="outline" onClick={() => {
          const exam = exams.find(e => e.id === selectedExamId);
          const rows = results.map((res, i) => ({
            "#": i + 1, "Student": res.studentName, "Total Marks": res.totalMarks,
            "Obtained": res.obtainedMarks, "Percentage": res.percentage,
            "Grade": res.grade || "", "Position": res.sectionPosition || "", "Status": res.status,
          }));
          downloadCSV(rows, `results-${exam?.name || selectedExamId}`);
          toast({ title: "Results exported to CSV" });
        }}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
      </div>

      {results.length > 0 ? (
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((res, i) => {
                  const grade = computeGrade(res.percentage, gradeScale);
                  const statusColors: Record<string, string> = {
                    Submitted: "bg-slate-100 text-slate-700", Reviewed: "bg-blue-100 text-blue-700",
                    Approved: "bg-emerald-100 text-emerald-700", Published: "bg-violet-100 text-violet-700",
                  };
                  return (
                    <TableRow key={res.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-500">{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{res.studentName}</div>
                        {res.admissionNumber && <div className="text-xs text-slate-400">{res.admissionNumber}</div>}
                      </TableCell>
                      <TableCell>{res.obtainedMarks}/{res.totalMarks}</TableCell>
                      <TableCell>{res.percentage}%</TableCell>
                      <TableCell>
                        <Badge className={grade === "F" ? "bg-red-100 text-red-700" : grade.startsWith("A") ? "bg-emerald-100 text-emerald-700" : ""}>
                          {grade}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {res.sectionPosition ? (
                          <span className="text-sm font-medium">{res.sectionPosition}<span className="text-slate-400">/{res.sectionTotal}</span></span>
                        ) : <span className="text-slate-400">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[res.status] || "bg-slate-100 text-slate-700"}>{res.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {res.status === "Submitted" && (
                            <Button size="sm" variant="outline" className="h-6 text-xs"
                              onClick={async () => { await updateResultStatusDB(res.id, "Reviewed"); loadResults(); }}>Review</Button>
                          )}
                          {res.status === "Reviewed" && (
                            <Button size="sm" variant="outline" className="h-6 text-xs text-emerald-600"
                              onClick={async () => { await updateResultStatusDB(res.id, "Approved"); loadResults(); }}>Approve</Button>
                          )}
                          {res.status === "Approved" && (
                            <Button size="sm" variant="outline" className="h-6 text-xs text-violet-600"
                              onClick={async () => { await updateResultStatusDB(res.id, "Published"); loadResults(); }}>Publish</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 text-[#94A3B8]">
          <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Select an exam to view results</p>
        </div>
      )}
    </motion.div>
  );
}
