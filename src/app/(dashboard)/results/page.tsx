"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppState } from "@/lib/state-context";
import { useStudents } from "@/lib/students-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { fetchStudentTermResultsDB, fetchStudentReportCardsDB, fetchGradeScalesDB, fetchTermExamsDB } from "@/app/actions/academic-core";
import { getSession } from "@/app/actions/auth";
import { ReportCard } from "@/components/report-card";
import type { GradeScaleItem } from "@/lib/types";
import {
  Lock, BarChart3, CheckCircle2, Clock,
  Trophy, Printer, FileText, GraduationCap, ArrowRight, Users,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

// This page is the real, single results pipeline (term_exams/exam_subjects/
// marks_entries/results/report_cards via academic-core.ts). The legacy
// exam_sessions/exam_marks/class_compilations/result_positions pipeline in
// features.ts (string-keyed by class/subject name, no FK, no auth) has been
// retired from this page — exam/results management for Admin now lives
// entirely in /exams (manage, marks, results, report-cards, analytics),
// which already implements this correctly.

function rankSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function getGradeFromScale(pct: number, gradeScale: GradeScaleItem[]): string {
  const sorted = [...gradeScale].sort((a, b) => b.minPercentage - a.minPercentage);
  for (const g of sorted) {
    if (pct >= g.minPercentage && pct <= g.maxPercentage) return g.grade;
  }
  return "F";
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEACHER VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function TeacherResultsView() {
  const [publishedExams, setPublishedExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTermExamsDB().then(exams => {
      setPublishedExams(exams.filter(e => e.status === "Published"));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 bg-secondary/10 rounded-xl border flex items-center gap-4">
        <div className="h-11 w-11 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-bold text-primary text-base">Results Published</p>
          <p className="text-xs text-muted-foreground">{publishedExams.length} exam(s) with published results</p>
        </div>
        <Button asChild size="sm" variant="outline" className="ml-auto gap-1.5">
          <Link href="/exams/results">Manage in Examinations <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {publishedExams.map((exam) => (
          <Card key={exam.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <p className="font-bold text-primary text-sm">{exam.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{exam.className} · {exam.startDate}</p>
              <Badge className="mt-2 bg-emerald-100 text-emerald-700 text-xs">Published</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      {publishedExams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Clock className="h-12 w-12 text-muted-foreground/40" />
          <p className="font-semibold text-primary">No Published Results</p>
          <p className="text-sm text-muted-foreground">Results will appear here once published in Examinations.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARENT VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function ParentResultsView() {
  const { students } = useStudents();
  const [wardsData, setWardsData] = useState<{ ward: any; termResults: any[]; reportCards: any[] }[]>([]);
  const [gradeScale, setGradeScale] = useState<GradeScaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rcTarget, setRcTarget] = useState<{ rc: any; ward: any } | null>(null);

  useEffect(() => {
    getSession().then(async (s) => {
      if (!s?.email) { setLoading(false); return; }
      const wards = students.filter(st => st.parentEmail === s.email && st.status === "Active");
      if (wards.length === 0) { setLoading(false); return; }
      const gs = await fetchGradeScalesDB();
      setGradeScale(gs);
      const results = await Promise.all(wards.map(async (ward) => {
        const [terms, rcs] = await Promise.all([
          fetchStudentTermResultsDB(ward.id),
          fetchStudentReportCardsDB(ward.id),
        ]);
        return { ward, termResults: terms, reportCards: rcs };
      }));
      setWardsData(results);
      setLoading(false);
    });
  }, [students]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (wardsData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <Users className="h-12 w-12 text-muted-foreground/40" />
        <p className="font-semibold text-primary">No Wards Found</p>
        <p className="text-sm text-muted-foreground max-w-sm">No students are linked to your account. Contact admin to link your children.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {wardsData.map(({ ward, termResults, reportCards }) => {
        const totalResults = termResults.length + reportCards.length;
        return (
          <div key={ward.id} className="space-y-4">
            <div className="p-4 bg-secondary/10 rounded-xl border flex items-center gap-4">
              <div className="h-11 w-11 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-primary text-base">{ward.name}</p>
                <p className="text-xs text-muted-foreground">{ward.class} – Section {ward.section} · Adm. No: {ward.admissionNumber}</p>
              </div>
              {totalResults > 0 && (
                <div className="ml-auto text-right">
                  <p className="text-xs text-muted-foreground">Results</p>
                  <p className="text-xl font-black text-primary">{totalResults}</p>
                </div>
              )}
            </div>

            {termResults.length > 0 && (
              <div className="space-y-3 ml-4">
                {termResults.map((res: any) => {
                  const pct = res.percentage ?? 0;
                  const passed = pct >= 40;
                  const grade = getGradeFromScale(pct, gradeScale);
                  return (
                    <Card key={res.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${passed ? "bg-emerald-50 border-2 border-emerald-200" : "bg-red-50 border-2 border-red-200"}`}>
                            <span className={`text-lg font-black ${grade === "F" ? "text-red-600" : "text-emerald-600"}`}>{grade}</span>
                            <span className={`text-[9px] font-semibold ${passed ? "text-emerald-600" : "text-red-600"}`}>{passed ? "PASS" : "FAIL"}</span>
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-primary text-sm">{res.examName}</span>
                              <Badge className="bg-blue-100 text-blue-700 text-[10px]">{res.examType}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% ({res.obtainedMarks}/{res.totalMarks})</p>
                            {res.sectionPosition && (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Trophy className="h-3 w-3 text-yellow-500" />Section {rankSuffix(res.sectionPosition)}/{res.sectionTotal}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {reportCards.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-4">
                {reportCards.map((rc: any) => (
                  <Card key={rc.id} className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setRcTarget({ rc, ward })}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-primary text-sm">{rc.academicYearName}</span>
                        <Badge className={(rc.overallGrade || "F") === "F" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>{rc.overallGrade || "F"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Average: {rc.totalPercentage?.toFixed(1)}%</p>
                      <Button size="sm" variant="outline" className="w-full mt-2 gap-1.5"><Printer className="h-3.5 w-3.5" />View & Print</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {totalResults === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4 ml-4">No published results yet</p>
            )}
          </div>
        );
      })}

      <Dialog open={!!rcTarget} onOpenChange={() => setRcTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Report Card — {rcTarget?.ward.name}</DialogTitle></DialogHeader>
          {rcTarget && (
            <ReportCard
              studentName={rcTarget.ward.name}
              admissionNumber={rcTarget.ward.admissionNumber}
              className={rcTarget.ward.class}
              sectionName={rcTarget.ward.section}
              academicYearName={rcTarget.rc.academicYearName || ""}
              examResults={rcTarget.rc.examResults || []}
              totalPercentage={rcTarget.rc.totalPercentage || 0}
              overallGrade={rcTarget.rc.overallGrade || "F"}
              classPosition={rcTarget.rc.classPosition}
              generatedAt={rcTarget.rc.generatedAt || new Date().toISOString().split("T")[0]}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function StudentResultsView() {
  const { students } = useStudents();
  const [termResults, setTermResults] = useState<any[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [gradeScale, setGradeScale] = useState<GradeScaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("exams");
  const [rcTarget, setRcTarget] = useState<any>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => { getSession().then(s => setSessionEmail(s?.email ?? null)); }, []);

  const myStudent = sessionEmail
    ? students.find(s => s.email === sessionEmail && s.status === "Active") || null
    : null;

  useEffect(() => {
    if (!myStudent) { setLoading(false); return; }
    Promise.all([
      fetchStudentTermResultsDB(myStudent.id),
      fetchStudentReportCardsDB(myStudent.id),
      fetchGradeScalesDB(),
    ]).then(([terms, rcs, gs]) => {
      setTermResults(terms);
      setReportCards(rcs);
      setGradeScale(gs);
      setLoading(false);
    });
  }, [myStudent?.id]);

  if (!myStudent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <GraduationCap className="h-12 w-12 text-muted-foreground/40" />
        <p className="font-semibold text-primary">No Student Profile Found</p>
        <p className="text-sm text-muted-foreground">Contact admin to link your account.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="p-4 bg-secondary/10 rounded-xl border flex items-center gap-4">
        <div className="h-11 w-11 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-bold text-primary text-base">{myStudent.name}</p>
          <p className="text-xs text-muted-foreground">{myStudent.class} – Section {myStudent.section} · Adm. No: {myStudent.admissionNumber}</p>
        </div>
        {(termResults.length + reportCards.length) > 0 && (
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">Results Available</p>
            <p className="text-xl font-black text-primary">{termResults.length + reportCards.length}</p>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="exams" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />Exam Results
            {termResults.length > 0 && <Badge className="ml-1 bg-blue-100 text-blue-700 text-xs">{termResults.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="report-cards" className="gap-1.5">
            <FileText className="h-4 w-4" />Report Cards
            {reportCards.length > 0 && <Badge className="ml-1 bg-emerald-100 text-emerald-700 text-xs">{reportCards.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exams" className="space-y-4 mt-4">
          {termResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/40" />
              <p className="font-semibold text-primary">No Exam Results Yet</p>
              <p className="text-sm text-muted-foreground max-w-sm">Your exam results will appear here once published by admin.</p>
            </div>
          ) : (
            termResults.map((res) => {
              const passed = res.percentage >= 40;
              return (
                <Card key={res.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-5">
                      <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 ${passed ? "bg-emerald-50 border-2 border-emerald-200" : "bg-red-50 border-2 border-red-200"}`}>
                        <span className={`text-xl font-black ${getGradeFromScale(res.percentage, gradeScale) === "F" ? "text-red-600" : "text-emerald-600"}`}>
                          {getGradeFromScale(res.percentage, gradeScale)}
                        </span>
                        <span className={`text-xs font-semibold ${passed ? "text-emerald-600" : "text-red-600"}`}>{passed ? "PASS" : "FAIL"}</span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-primary">{res.examName}</span>
                          <Badge className="bg-blue-100 text-blue-700 text-xs">{res.examType}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="font-semibold text-primary text-sm">{res.percentage.toFixed(1)}% ({res.obtainedMarks}/{res.totalMarks})</span>
                          {res.sectionPosition && (
                            <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-yellow-500" />Section {rankSuffix(res.sectionPosition)}/{res.sectionTotal}</span>
                          )}
                          {res.grade && (
                            <Badge className={res.grade === "F" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>{res.grade}</Badge>
                          )}
                        </div>
                        {res.startDate && (
                          <p className="text-xs text-muted-foreground">{res.startDate} {res.endDate ? `→ ${res.endDate}` : ""}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="report-cards" className="space-y-4 mt-4">
          {reportCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40" />
              <p className="font-semibold text-primary">No Report Cards Yet</p>
              <p className="text-sm text-muted-foreground max-w-sm">Your report cards will appear here once generated by admin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reportCards.map(rc => (
                <Card key={rc.id} className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setRcTarget(rc)}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="font-bold text-primary">{rc.academicYearName}</span>
                      </div>
                      <Badge className={(rc.overallGrade || "F") === "F" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>{rc.overallGrade || "F"}</Badge>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex justify-between"><span>Average:</span><span className="font-semibold text-primary">{rc.totalPercentage?.toFixed(1)}%</span></div>
                      {rc.classPosition && (
                        <div className="flex justify-between"><span>Class Position:</span><span className="font-semibold text-primary">{rankSuffix(rc.classPosition)}</span></div>
                      )}
                      <div className="flex justify-between"><span>Generated:</span><span className="font-semibold text-primary">{rc.generatedAt}</span></div>
                    </div>
                    <Button size="sm" variant="outline" className="w-full mt-3 gap-1.5"><Printer className="h-3.5 w-3.5" />View & Print</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!rcTarget} onOpenChange={() => setRcTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Report Card — {myStudent.name}</DialogTitle></DialogHeader>
          {rcTarget && (
            <ReportCard
              studentName={myStudent.name}
              admissionNumber={myStudent.admissionNumber}
              className={myStudent.class}
              sectionName={myStudent.section}
              academicYearName={rcTarget.academicYearName || ""}
              examResults={rcTarget.examResults || []}
              totalPercentage={rcTarget.totalPercentage || 0}
              overallGrade={rcTarget.overallGrade || "F"}
              classPosition={rcTarget.classPosition}
              generatedAt={rcTarget.generatedAt || new Date().toISOString().split("T")[0]}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function ResultsPage() {
  const { activeRole } = useAppState();
  const { can, loaded: permsLoaded } = usePermission();

  if (!permsLoaded) return null;
  if (!can("results.view")) return <Unauthorized />;

  if (activeRole === "STUDENT") {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">My Results</h1>
          <p className="text-muted-foreground mt-1">Your published result cards</p>
        </div>
        <StudentResultsView />
      </motion.div>
    );
  }

  if (activeRole === "PARENT") {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Ward Results</h1>
          <p className="text-muted-foreground mt-1">Results for your children</p>
        </div>
        <ParentResultsView />
      </motion.div>
    );
  }

  if (activeRole === "TEACHER") {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Class Results</h1>
          <p className="text-muted-foreground mt-1">Published exam results overview</p>
        </div>
        <TeacherResultsView />
      </motion.div>
    );
  }

  if ((activeRole === "ADMIN" || activeRole === "PRINCIPAL")) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Results</h1>
          <p className="text-muted-foreground mt-1">Exam and result management now lives in Examinations</p>
        </div>
        <Card className="border-none shadow-sm">
          <CardContent className="p-8 flex flex-col items-center text-center gap-3">
            <FileText className="h-12 w-12 text-primary/60" />
            <p className="font-semibold text-primary">Manage exams, marks, and published results from Examinations</p>
            <p className="text-sm text-muted-foreground max-w-md">Creating exams, entering marks, publishing results, generating report cards, and analytics all live under one place now — no separate "sessions" workflow.</p>
            <div className="flex gap-2 mt-2">
              <Button asChild size="sm"><Link href="/exams/manage">Manage Exams</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/exams/results">View Results</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/exams/report-cards">Report Cards</Link></Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Lock className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-bold text-primary">Access Restricted</h2>
    </motion.div>
  );
}
