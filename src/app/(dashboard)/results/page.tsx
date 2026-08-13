"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppState } from "@/lib/state-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import {
  publishExamDB,
  fetchExamSessionsDB, fetchClassCompilationsDB, fetchResultPositionsDB,
  publishSessionDB, fetchPublishedResultsForStudentDB,
} from "@/app/actions/features";
import { fetchStudentTermResultsDB, fetchStudentReportCardsDB, fetchGradeScalesDB } from "@/app/actions/academic-core";
import { getSession } from "@/app/actions/auth";
import { ReportCard } from "@/components/report-card";
import type { ExamRecord, ExamSession, ClassCompilation, ResultPosition, GradeScaleItem } from "@/lib/types";
import {
  Search, Eye, Globe, EyeOff, Lock, BarChart3, CheckCircle2, Clock, Sparkles,
  Trophy, Medal, Printer, FileText, GraduationCap, ArrowRight, Info, Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";

// ── Grade helpers ─────────────────────────────────────────────────────────────
function getGradeFromScale(pct: number, gradeScale: GradeScaleItem[]): { label: string; colorClass: string } {
  const sorted = [...gradeScale].sort((a, b) => b.minPercentage - a.minPercentage);
  for (const g of sorted) {
    if (pct >= g.minPercentage && pct <= g.maxPercentage) {
      const isFail = !g.isPass;
      return { label: g.grade, colorClass: isFail ? "text-red-700" : g.grade.startsWith("A") ? "text-green-700" : "text-blue-600" };
    }
  }
  return { label: "F", colorClass: "text-red-700" };
}

// Fallback for components that haven't loaded grade scale yet
function getGrade(pct: number): { label: string; colorClass: string } {
  if (pct >= 90) return { label: "A+", colorClass: "text-green-700" };
  if (pct >= 80) return { label: "A",  colorClass: "text-green-600" };
  if (pct >= 70) return { label: "B+", colorClass: "text-blue-700" };
  if (pct >= 60) return { label: "B",  colorClass: "text-blue-600" };
  if (pct >= 50) return { label: "C",  colorClass: "text-orange-600" };
  if (pct >= 40) return { label: "D",  colorClass: "text-orange-700" };
  return { label: "F", colorClass: "text-red-700" };
}

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

const PASS_THRESHOLD = 40;

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT CARD  (printable)
// ═══════════════════════════════════════════════════════════════════════════════
interface ResultCardProps {
  position: ResultPosition;
  session: ExamSession;
  studentName: string;
  admissionNumber: string;
  className: string;
  teacherName?: string;
  schoolName: string;
  printId?: string;
  gradeScale?: GradeScaleItem[];
}

function ResultCard({ position, session, studentName, admissionNumber, className, teacherName, schoolName, printId, gradeScale }: ResultCardProps) {
  const passed = position.percentage >= PASS_THRESHOLD;
  const overallGrade = gradeScale ? getGradeFromScale(position.percentage, gradeScale) : getGrade(position.percentage);

  return (
    <div id={printId} className="bg-white rounded-lg border-2 border-primary/20 overflow-hidden font-sans">
      {/* School header */}
      <div className="bg-primary text-white text-center py-5 px-6">
        <div className="flex items-center justify-center gap-2 mb-1">
          <GraduationCap className="h-6 w-6" />
          <h2 className="text-xl font-black tracking-wide uppercase">{schoolName}</h2>
        </div>
        <p className="text-xs text-white/70 uppercase tracking-[0.25em] font-semibold mt-1">Student Result Card</p>
        <p className="text-sm text-white/90 font-semibold mt-1">{session.name} &mdash; {session.term}</p>
      </div>

      {/* Student details */}
      <div className="grid grid-cols-2 border-b border-primary/10">
        {[
          { label: "Student Name",   value: studentName || "—" },
          { label: "Admission No.",  value: admissionNumber || "—" },
          { label: "Class / Section", value: className },
          { label: "Academic Year",  value: session.createdAt?.slice(0, 4) || new Date().getFullYear().toString() },
        ].map((f, i) => (
          <div key={f.label} className={`p-3 ${i % 2 === 0 ? "border-r" : ""} border-b border-primary/10`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{f.label}</p>
            <p className="text-sm font-bold text-primary mt-0.5">{f.value}</p>
          </div>
        ))}
      </div>

      {/* Subject marks table */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-secondary/20">
            <th className="py-2.5 px-3 text-left text-xs font-bold text-primary border-b border-primary/10">Subject</th>
            <th className="py-2.5 px-3 text-center text-xs font-bold text-primary border-b border-primary/10">Obtained</th>
            <th className="py-2.5 px-3 text-center text-xs font-bold text-primary border-b border-primary/10">Max</th>
            <th className="py-2.5 px-3 text-center text-xs font-bold text-primary border-b border-primary/10">%</th>
            <th className="py-2.5 px-3 text-center text-xs font-bold text-primary border-b border-primary/10">Grade</th>
          </tr>
        </thead>
        <tbody>
          {session.subjects.map(subject => {
            const entry = position.subjectScores.find(s => s.subject === subject);
            const score = entry?.score ?? 0;
            const subMax = session.totalMarks;
            const subPct = subMax > 0 && entry ? Math.round((score / subMax) * 100) : 0;
            const g = entry ? (gradeScale ? getGradeFromScale(subPct, gradeScale) : getGrade(subPct)) : { label: "—", colorClass: "text-muted-foreground" };
            return (
              <tr key={subject} className="border-b border-primary/5 hover:bg-secondary/5">
                <td className="py-2 px-3 font-medium text-primary">{subject}</td>
                <td className="py-2 px-3 text-center font-mono font-bold">{entry ? score : <span className="text-muted-foreground text-xs">N/A</span>}</td>
                <td className="py-2 px-3 text-center text-muted-foreground">{subMax}</td>
                <td className="py-2 px-3 text-center text-sm">{entry ? `${subPct}%` : "—"}</td>
                <td className="py-2 px-3 text-center"><span className={`text-sm font-bold ${g.colorClass}`}>{g.label}</span></td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-secondary/20 border-t-2 border-primary/20">
            <td className="py-3 px-3 font-black text-primary text-sm">TOTAL</td>
            <td className="py-3 px-3 text-center font-black text-primary text-base">{position.totalMarks}</td>
            <td className="py-3 px-3 text-center text-muted-foreground font-semibold">{position.maxPossible}</td>
            <td className="py-3 px-3 text-center font-black text-primary">{position.percentage.toFixed(1)}%</td>
            <td className="py-3 px-3 text-center"><span className={`text-sm font-black ${overallGrade.colorClass}`}>{overallGrade.label}</span></td>
          </tr>
        </tfoot>
      </table>

      {/* Position + Result row */}
      <div className="grid grid-cols-3 border-t border-primary/10">
        <div className="col-span-2 p-4 border-r border-primary/10 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Class Positions</p>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
            <span className="text-sm font-bold text-primary">Section: {rankSuffix(position.sectionPosition)} out of {position.sectionTotal} students</span>
          </div>
          <div className="flex items-center gap-2">
            <Medal className="h-4 w-4 text-blue-500 shrink-0" />
            <span className="text-sm font-bold text-primary">Grade ({position.gradeName}): {rankSuffix(position.gradePosition)} out of {position.gradeTotal} students</span>
          </div>
        </div>
        <div className={`p-4 flex flex-col items-center justify-center ${passed ? "bg-green-50" : "bg-red-50"}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Result</p>
          <span className={`text-3xl font-black ${passed ? "text-green-700" : "text-red-700"}`}>{passed ? "PASS" : "FAIL"}</span>
          <span className={`text-xs font-semibold mt-0.5 ${passed ? "text-green-600" : "text-red-600"}`}>{position.percentage.toFixed(1)}% overall</span>
        </div>
      </div>

      {/* Signature footer */}
      <div className="border-t border-primary/10 p-4 grid grid-cols-2 gap-6 bg-secondary/5">
        <div className="space-y-1">
          <div className="border-b-2 border-dashed border-muted-foreground/30 h-7" />
          <p className="text-[10px] text-muted-foreground text-center">{teacherName ? `Class Teacher: ${teacherName}` : "Class Teacher Signature"}</p>
        </div>
        <div className="space-y-1">
          <div className="border-b-2 border-dashed border-muted-foreground/30 h-7" />
          <p className="text-[10px] text-muted-foreground text-center">Principal Signature</p>
        </div>
        <p className="col-span-2 text-[10px] text-muted-foreground text-center -mt-3">
          Date Issued: {position.calculatedAt || new Date().toISOString().split("T")[0]}
          {" · "}This is a computer-generated result card.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT CARD DIALOG  (with print)
// ═══════════════════════════════════════════════════════════════════════════════
function ResultCardDialog({ position, session, studentName, admissionNumber, className, teacherName, open, onClose, gradeScale }: {
  position: ResultPosition; session: ExamSession;
  studentName: string; admissionNumber: string;
  className: string; teacherName?: string;
  open: boolean; onClose: () => void;
  gradeScale?: GradeScaleItem[];
}) {
  const { schoolInfo } = useAppState();

  const handlePrint = () => {
    document.getElementById("__rp_print_s")?.remove();
    const s = document.createElement("style");
    s.id = "__rp_print_s";
    s.textContent = `
      @media print {
        @page { margin: 8mm; size: A4 portrait; }
        body * { visibility: hidden !important; }
        #__rp_card, #__rp_card * { visibility: visible !important; }
        #__rp_card { position: fixed !important; inset: 0 !important; background: white !important; z-index: 99999 !important; padding: 16px !important; }
      }
    `;
    document.head.appendChild(s);
    window.print();
    s.remove();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-4 pb-3 border-b flex-row items-center justify-between gap-4">
          <DialogTitle className="text-sm font-semibold">Result Card — {studentName}</DialogTitle>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0 mr-8" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" />Print / Save PDF
          </Button>
        </DialogHeader>
        <div className="p-5">
          <ResultCard
            printId="__rp_card"
            position={position}
            session={session}
            studentName={studentName}
            admissionNumber={admissionNumber}
            className={className}
            teacherName={teacherName}
            schoolName={schoolInfo?.name || "Scholarly Central School"}
            gradeScale={gradeScale}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — Session Results Panel
// ═══════════════════════════════════════════════════════════════════════════════
function AdminSessionResultsPanel() {
  const { classes, students, schoolInfo } = useAppState();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [compilations, setCompilations] = useState<ClassCompilation[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ session: ExamSession; className: string } | null>(null);
  const [previewPositions, setPreviewPositions] = useState<ResultPosition[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cardTarget, setCardTarget] = useState<{ position: ResultPosition; session: ExamSession } | null>(null);
  const [gradeScale, setGradeScale] = useState<GradeScaleItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, c, gs] = await Promise.all([fetchExamSessionsDB(), fetchClassCompilationsDB(), fetchGradeScalesDB()]);
    setSessions(s);
    setCompilations(c);
    setGradeScale(gs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const compilationStatus = (session: ExamSession) => {
    const comps = compilations.filter(c => c.sessionId === session.id);
    const approved = comps.filter(c => c.status === "approved").length;
    const total = session.classes.length;
    return { approved, total, allApproved: total > 0 && approved === total };
  };

  const handlePublish = async (session: ExamSession, publish: boolean) => {
    setPublishing(session.id);
    const res = await publishSessionDB(session.id, publish);
    setPublishing(null);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: publish ? `"${session.name}" published — students can view their result cards.` : `"${session.name}" unpublished.` });
    load();
  };

  const handlePreview = async (session: ExamSession, cls: string) => {
    setPreview({ session, className: cls });
    setPreviewLoading(true);
    setPreviewPositions([]);
    const pos = await fetchResultPositionsDB(session.id, cls);
    setPreviewPositions(pos);
    setPreviewLoading(false);
  };

  const getTeacher = (cls: string) => classes.find(c => c.name === cls)?.teacherName;
  const getAdmission = (studentId: string) => students.find(s => s.id === studentId)?.admissionNumber ?? "";

  // Show all sessions (active ones might still be ready if all comps approved)
  const allSessions = sessions;
  const publishedCount = sessions.filter(s => s.status === "published").length;
  const readyCount = sessions.filter(s => {
    if (s.status === "published") return false;
    const { allApproved } = compilationStatus(s);
    return allApproved;
  }).length;

  if (loading) return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="p-4 rounded-xl border"><Skeleton className="h-3 w-24 mb-2" /><Skeleton className="h-7 w-12" /></div>)}
      </div>
      {[1,2].map(i => <Card key={i} className="border-none shadow-sm"><CardHeader className="pb-3 border-b"><div className="flex items-start justify-between"><div><Skeleton className="h-5 w-40 mb-2" /><Skeleton className="h-3 w-56" /></div><Skeleton className="h-6 w-20 rounded" /></div></CardHeader><CardContent className="p-4"><div className="flex gap-2">{[1,2,3].map(j => <Skeleton key={j} className="h-16 w-24 rounded-lg" />)}</div></CardContent></Card>)}
    </div>
  );

  if (allSessions.length === 0) {
    return (
      <Card className="border-none shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/40" />
          <p className="font-semibold text-primary">No Exam Sessions</p>
          <p className="text-sm text-muted-foreground max-w-sm">Create exam sessions in the Exams page and complete the approval workflow first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Sessions", value: sessions.length, color: "blue" },
          { label: "Ready to Publish", value: readyCount, color: "orange" },
          { label: "Published", value: publishedCount, color: "green" },
        ].map(s => (
          <div key={s.label} className={`p-4 rounded-xl border bg-${s.color}-50 border-${s.color}-100`}>
            <p className={`text-xs font-semibold text-${s.color}-600`}>{s.label}</p>
            <p className="text-2xl font-bold text-primary mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Session cards */}
      {allSessions.map(session => {
        const { approved, total, allApproved } = compilationStatus(session);
        const isPublished = session.status === "published";
        const approvedComps = compilations.filter(c => c.sessionId === session.id && c.status === "approved");

        return (
          <Card key={session.id} className="border-none shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="text-base">{session.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{session.term} · {session.subjects.length} subjects · {session.totalMarks} marks each</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {isPublished && (
                    <Badge className="bg-green-100 text-green-700 border-0 gap-1">
                      <Globe className="h-3 w-3" />Published
                    </Badge>
                  )}
                  {!isPublished && allApproved && (
                    <Badge className="bg-blue-100 text-blue-700 border-0">Ready to Publish</Badge>
                  )}
                  {!isPublished && !allApproved && (
                    <Badge className="bg-orange-100 text-orange-700 border-0">
                      {approved}/{total} classes approved
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant={isPublished ? "outline" : "default"}
                    disabled={publishing === session.id || (!isPublished && !allApproved)}
                    onClick={() => handlePublish(session, !isPublished)}
                    className="gap-1.5"
                  >
                    {isPublished
                      ? <><EyeOff className="h-3.5 w-3.5" />Unpublish</>
                      : <><Globe className="h-3.5 w-3.5" />Publish</>}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {session.classes.map(cls => {
                  const hasPositions = approvedComps.some(c => c.className === cls);
                  const isActive = preview?.session.id === session.id && preview.className === cls;
                  return (
                    <button
                      key={cls}
                      disabled={!hasPositions}
                      onClick={() => hasPositions && handlePreview(session, cls)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                        hasPositions
                          ? isActive
                            ? "bg-primary text-white border-primary"
                            : "bg-green-50 border-green-200 text-green-800 hover:bg-green-100 cursor-pointer"
                          : "bg-secondary/20 border-secondary/40 text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      {hasPositions
                        ? <><CheckCircle2 className="h-3 w-3 text-green-600" />{cls}<ArrowRight className="h-3 w-3 ml-0.5" /></>
                        : <><Clock className="h-3 w-3" />{cls}</>}
                    </button>
                  );
                })}
              </div>
              {approvedComps.length > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />Click an approved class to preview its result positions.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Positions preview table */}
      {preview && (
        <Card className="border-2 border-primary/20 shadow-sm animate-in fade-in duration-200">
          <CardHeader className="pb-3 border-b bg-secondary/10">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Result Preview: {preview.session.name} — {preview.className}
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
                onClick={() => { setPreview(null); setPreviewPositions([]); }}>×</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {previewLoading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="flex items-center gap-4"><Skeleton className="h-4 w-12" /><Skeleton className="h-4 w-32 flex-1" /><Skeleton className="h-4 w-12 text-center" /><Skeleton className="h-4 w-12 text-center" /><Skeleton className="h-4 w-16 text-center" /><Skeleton className="h-4 w-16 text-center" /><Skeleton className="h-5 w-16 rounded text-right" /></div>)}</div>
            ) : previewPositions.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No positions computed for this class.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/10">
                    <TableHead className="font-bold text-xs py-2.5 w-16">Rank</TableHead>
                    <TableHead className="font-bold text-xs py-2.5">Student</TableHead>
                    <TableHead className="font-bold text-center text-xs py-2.5">Total/{previewPositions[0]?.maxPossible}</TableHead>
                    <TableHead className="font-bold text-center text-xs py-2.5">%</TableHead>
                    <TableHead className="font-bold text-center text-xs py-2.5">Grade</TableHead>
                    <TableHead className="font-bold text-center text-xs py-2.5">Grade Rank</TableHead>
                    <TableHead className="font-bold text-xs py-2.5 text-right">Card</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewPositions.map((pos, i) => {
                    const g = gradeScale.length > 0 ? getGradeFromScale(pos.percentage, gradeScale) : getGrade(pos.percentage);
                    return (
                      <TableRow key={pos.id} className={i === 0 ? "bg-yellow-50/60" : "hover:bg-secondary/5"}>
                        <TableCell className="py-2">
                          {i === 0 && <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">1st</span>}
                          {i === 1 && <span className="text-xs font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">2nd</span>}
                          {i === 2 && <span className="text-xs font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">3rd</span>}
                          {i > 2 && <span className="text-xs text-muted-foreground">{rankSuffix(i + 1)}</span>}
                        </TableCell>
                        <TableCell className="py-2 font-semibold text-sm text-primary">{pos.studentName}</TableCell>
                        <TableCell className="py-2 text-center font-bold text-sm">{pos.totalMarks}</TableCell>
                        <TableCell className="py-2 text-center">
                          <span className={`text-xs font-bold ${pos.percentage >= 75 ? "text-green-700" : pos.percentage >= 50 ? "text-orange-600" : "text-red-600"}`}>
                            {pos.percentage.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-center"><span className={`text-sm font-bold ${g.colorClass}`}>{g.label}</span></TableCell>
                        <TableCell className="py-2 text-center text-xs text-muted-foreground">{pos.gradePosition}/{pos.gradeTotal}</TableCell>
                        <TableCell className="py-2 text-right">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                            onClick={() => setCardTarget({ position: pos, session: preview.session })}>
                            <Eye className="h-3 w-3" />View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Admin preview of a student's result card */}
      {cardTarget && preview && (
        <ResultCardDialog
          position={cardTarget.position}
          session={cardTarget.session}
          studentName={cardTarget.position.studentName}
          admissionNumber={getAdmission(cardTarget.position.studentId)}
          className={preview.className}
          teacherName={getTeacher(preview.className)}
          open={!!cardTarget}
          onClose={() => setCardTarget(null)}
          gradeScale={gradeScale}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — Legacy Results Panel (unchanged from before)
// ═══════════════════════════════════════════════════════════════════════════════
function AdminLegacyResultsPanel() {
  const { exams, classes } = useAppState();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [publishedFilter, setPublishedFilter] = useState("ALL");
  const [reviewExam, setReviewExam] = useState<ExamRecord | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  const filtered = exams.filter(ex => {
    const matchSearch = ex.examName.toLowerCase().includes(search.toLowerCase()) ||
      ex.subject.toLowerCase().includes(search.toLowerCase()) ||
      ex.className.toLowerCase().includes(search.toLowerCase());
    const matchClass = classFilter === "ALL" || ex.className === classFilter;
    const matchPublished = publishedFilter === "ALL" ||
      (publishedFilter === "Published" && ex.published) ||
      (publishedFilter === "Pending" && !ex.published);
    return matchSearch && matchClass && matchPublished;
  });

  const handleTogglePublish = async (exam: ExamRecord) => {
    setPublishing(exam.id);
    const res = await publishExamDB(exam.id, !exam.published);
    setPublishing(null);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: exam.published ? "Results unpublished." : "Results published." });
    exam.published = !exam.published;
  };

  const getAvg = (ex: ExamRecord) => {
    if (!ex.studentResults.length) return "—";
    return (ex.studentResults.reduce((s, r) => s + r.score, 0) / ex.studentResults.length).toFixed(1);
  };

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-wrap items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Legacy Exam Results</CardTitle>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-48" />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={publishedFilter} onValueChange={setPublishedFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="Published">Published</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/10">
                <TableHead className="font-bold">Exam Name</TableHead>
                <TableHead className="font-bold">Subject</TableHead>
                <TableHead className="font-bold">Class</TableHead>
                <TableHead className="font-bold text-center">Students</TableHead>
                <TableHead className="font-bold text-center">Avg Score</TableHead>
                <TableHead className="font-bold text-center">Status</TableHead>
                <TableHead className="font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0
                ? <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No results found.</TableCell></TableRow>
                : filtered.map(ex => (
                  <TableRow key={ex.id} className="hover:bg-secondary/5">
                    <TableCell className="font-semibold text-primary">{ex.examName}</TableCell>
                    <TableCell className="text-muted-foreground">{ex.subject}</TableCell>
                    <TableCell><span className="text-xs px-2 py-0.5 bg-secondary rounded font-bold">{ex.className}</span></TableCell>
                    <TableCell className="text-center font-mono text-sm">{ex.studentResults.length}</TableCell>
                    <TableCell className="text-center font-bold text-sm">{getAvg(ex)}</TableCell>
                    <TableCell className="text-center">
                      {ex.published
                        ? <Badge className="bg-green-100 text-green-700 border-0 gap-1"><CheckCircle2 className="h-3 w-3" />Published</Badge>
                        : <Badge className="bg-orange-100 text-orange-700 border-0 gap-1"><Clock className="h-3 w-3" />Pending</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setReviewExam(ex)}>
                          <Eye className="h-3 w-3" />Review
                        </Button>
                        <Button size="sm" variant={ex.published ? "outline" : "default"} className="h-7 text-xs gap-1"
                          disabled={publishing === ex.id} onClick={() => handleTogglePublish(ex)}>
                          {ex.published ? <><EyeOff className="h-3 w-3" />Unpublish</> : <><Globe className="h-3 w-3" />Publish</>}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!reviewExam} onOpenChange={o => !o && setReviewExam(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{reviewExam?.examName} — {reviewExam?.subject}</DialogTitle></DialogHeader>
          {reviewExam && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3 text-sm">
                {[{ label: "Class", value: reviewExam.className }, { label: "Date", value: reviewExam.date }, { label: "Avg Score", value: `${getAvg(reviewExam)} / 100` }].map(f => (
                  <div key={f.label} className="p-3 bg-secondary/15 rounded-lg">
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className="font-bold text-primary">{f.value}</p>
                  </div>
                ))}
              </div>
              {(reviewExam.commonStrengths || reviewExam.commonWeaknesses) && (
                <div className="grid grid-cols-2 gap-3">
                  {reviewExam.commonStrengths && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs font-bold text-green-700 mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" />Common Strengths</p>
                      <p className="text-xs text-green-800 leading-relaxed">{reviewExam.commonStrengths}</p>
                    </div>
                  )}
                  {reviewExam.commonWeaknesses && (
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                      <p className="text-xs font-bold text-orange-700 mb-1">Areas to Improve</p>
                      <p className="text-xs text-orange-800 leading-relaxed">{reviewExam.commonWeaknesses}</p>
                    </div>
                  )}
                </div>
              )}
              <div>
                <h4 className="text-sm font-bold mb-2">Student Scores</h4>
                <div className="divide-y border rounded-lg overflow-hidden">
                  {reviewExam.studentResults.length === 0
                    ? <div className="p-4 text-center text-xs text-muted-foreground">No scores recorded.</div>
                    : reviewExam.studentResults.map((r, i) => (
                      <div key={i} className="p-3 flex items-center justify-between hover:bg-secondary/5">
                        <div>
                          <p className="text-sm font-semibold text-primary">{r.studentName}</p>
                          {r.detailedBreakdown && <p className="text-xs text-muted-foreground mt-0.5">{r.detailedBreakdown}</p>}
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <span className={`font-bold text-lg ${r.score >= 75 ? "text-green-700" : r.score >= 50 ? "text-orange-600" : "text-red-600"}`}>{r.score}</span>
                          <span className="text-xs text-muted-foreground">/100</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewExam(null)}>Close</Button>
            {reviewExam && (
              <Button variant={reviewExam.published ? "outline" : "default"}
                disabled={publishing === reviewExam.id}
                onClick={() => { handleTogglePublish(reviewExam); setReviewExam(null); }}>
                {reviewExam.published ? <><EyeOff className="h-4 w-4 mr-1" />Unpublish</> : <><Globe className="h-4 w-4 mr-1" />Publish Results</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARENT VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function ParentResultsView() {
  const { students, classes, schoolInfo } = useAppState();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [wardsData, setWardsData] = useState<{ ward: any; termResults: any[]; sessionResults: { session: ExamSession; position: ResultPosition }[] }[]>([]);
  const [gradeScale, setGradeScale] = useState<GradeScaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardTarget, setCardTarget] = useState<{ session: ExamSession; position: ResultPosition; wardName: string } | null>(null);

  const getGradeFromScale = useCallback((pct: number): string => {
    const sorted = [...gradeScale].sort((a, b) => b.minPercentage - a.minPercentage);
    for (const g of sorted) {
      if (pct >= g.minPercentage && pct <= g.maxPercentage) return g.grade;
    }
    return "F";
  }, [gradeScale]);

  useEffect(() => {
    getSession().then(async (s) => {
      if (!s?.email) { setLoading(false); return; }
      setSessionEmail(s.email);
      const wards = students.filter(st => st.parentEmail === s.email && st.status === "Active");
      if (wards.length === 0) { setLoading(false); return; }
      const gs = await fetchGradeScalesDB();
      setGradeScale(gs);
      const results = await Promise.all(wards.map(async (ward) => {
        const [terms, sessions] = await Promise.all([
          fetchStudentTermResultsDB(ward.id),
          fetchPublishedResultsForStudentDB(ward.id, `${ward.class}-${ward.section}`),
        ]);
        return { ward, termResults: terms, sessionResults: sessions };
      }));
      setWardsData(results);
      setLoading(false);
    });
  }, [students]);

  const getTeacher = (cls: string) => classes.find(c => c.name === cls)?.teacherName;

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
      {wardsData.map(({ ward, termResults, sessionResults }) => {
        const totalResults = termResults.length + sessionResults.length;
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
                  const grade = getGradeFromScale(pct);
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

            {sessionResults.length > 0 && (
              <div className="space-y-3 ml-4">
                {sessionResults.map(({ session, position }) => {
                  const passed = position.percentage >= PASS_THRESHOLD;
                  return (
                    <Card key={session.id} className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setCardTarget({ session, position, wardName: ward.name })}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${passed ? "bg-green-50 border-2 border-green-200" : "bg-red-50 border-2 border-red-200"}`}>
                            <span className={`text-lg font-black ${getGrade(position.percentage).colorClass}`}>{getGrade(position.percentage).label}</span>
                            <span className={`text-[9px] font-semibold ${passed ? "text-green-600" : "text-red-600"}`}>{passed ? "PASS" : "FAIL"}</span>
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <span className="font-bold text-primary text-sm">{session.name}</span>
                            <p className="text-xs text-muted-foreground">{position.percentage.toFixed(1)}% ({position.totalMarks}/{position.maxPossible})</p>
                          </div>
                          <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={e => { e.stopPropagation(); setCardTarget({ session, position, wardName: ward.name }); }}>
                            <FileText className="h-3 w-3" />Card
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {totalResults === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4 ml-4">No published results yet</p>
            )}
          </div>
        );
      })}

      {cardTarget && (
        <ResultCardDialog
          position={cardTarget.position}
          session={cardTarget.session}
          studentName={cardTarget.wardName}
          admissionNumber=""
          className=""
          open={!!cardTarget}
          onClose={() => setCardTarget(null)}
          gradeScale={gradeScale}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEACHER VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function TeacherResultsView() {
  const { classes, subjects, students, exams } = useAppState();

  const publishedExams = exams.filter((e: any) => e.status === "Published");

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
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {publishedExams.map((exam: any) => (
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
          <p className="text-sm text-muted-foreground">Results will appear here once published by admin.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function StudentResultsView() {
  const { students, classes, schoolInfo } = useAppState();
  const [sessionResults, setSessionResults] = useState<{ session: ExamSession; position: ResultPosition }[]>([]);
  const [termResults, setTermResults] = useState<any[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [gradeScale, setGradeScale] = useState<GradeScaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("exams");
  const [cardTarget, setCardTarget] = useState<{ session: ExamSession; position: ResultPosition } | null>(null);
  const [rcTarget, setRcTarget] = useState<any>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => { getSession().then(s => setSessionEmail(s?.email ?? null)); }, []);

  const myStudent = sessionEmail
    ? students.find(s => s.email === sessionEmail && s.status === "Active") || null
    : null;

  const getGradeFromScale = useCallback((pct: number): string => {
    const sorted = [...gradeScale].sort((a, b) => b.minPercentage - a.minPercentage);
    for (const g of sorted) {
      if (pct >= g.minPercentage && pct <= g.maxPercentage) return g.grade;
    }
    return "F";
  }, [gradeScale]);

  useEffect(() => {
    if (!myStudent) { setLoading(false); return; }
    Promise.all([
      fetchPublishedResultsForStudentDB(myStudent.id, `${myStudent.class}-${myStudent.section}`),
      fetchStudentTermResultsDB(myStudent.id),
      fetchStudentReportCardsDB(myStudent.id),
      fetchGradeScalesDB(),
    ]).then(([sessions, terms, rcs, gs]) => {
      setSessionResults(sessions);
      setTermResults(terms);
      setReportCards(rcs);
      setGradeScale(gs);
      setLoading(false);
    });
  }, [myStudent?.id]);

  const getTeacher = (cls: string) => classes.find(c => c.name === cls)?.teacherName;

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

  const totalResults = sessionResults.length + termResults.length;

  return (
    <div className="space-y-5">
      {/* Student header */}
      <div className="p-4 bg-secondary/10 rounded-xl border flex items-center gap-4">
        <div className="h-11 w-11 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-bold text-primary text-base">{myStudent.name}</p>
          <p className="text-xs text-muted-foreground">{myStudent.class} – Section {myStudent.section} · Adm. No: {myStudent.admissionNumber}</p>
        </div>
        {totalResults > 0 && (
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">Results Available</p>
            <p className="text-xl font-black text-primary">{totalResults}</p>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="exams" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />Exam Results
            {termResults.length > 0 && <Badge className="ml-1 bg-blue-100 text-blue-700 text-xs">{termResults.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-1.5">
            <Trophy className="h-4 w-4" />Session Results
            {sessionResults.length > 0 && <Badge className="ml-1 bg-amber-100 text-amber-700 text-xs">{sessionResults.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="report-cards" className="gap-1.5">
            <FileText className="h-4 w-4" />Report Cards
            {reportCards.length > 0 && <Badge className="ml-1 bg-emerald-100 text-emerald-700 text-xs">{reportCards.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Term Exam Results ─────────────────────────────────────── */}
        <TabsContent value="exams" className="space-y-4 mt-4">
          {termResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/40" />
              <p className="font-semibold text-primary">No Exam Results Yet</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Your exam results will appear here once published by admin.
              </p>
            </div>
          ) : (
            termResults.map((res) => {
              const passed = res.percentage >= 40;
              return (
                <Card key={res.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-5">
                      <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 ${passed ? "bg-emerald-50 border-2 border-emerald-200" : "bg-red-50 border-2 border-red-200"}`}>
                        <span className={`text-xl font-black ${getGradeFromScale(res.percentage) === "F" ? "text-red-600" : "text-emerald-600"}`}>
                          {getGradeFromScale(res.percentage)}
                        </span>
                        <span className={`text-xs font-semibold ${passed ? "text-emerald-600" : "text-red-600"}`}>
                          {passed ? "PASS" : "FAIL"}
                        </span>
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

        {/* ── Session Results ─────────────────────────────────────── */}
        <TabsContent value="sessions" className="space-y-4 mt-4">
          {sessionResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground/40" />
              <p className="font-semibold text-primary">No Session Results Yet</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Your session result cards will appear here once published.
              </p>
            </div>
          ) : (
            sessionResults.map(({ session, position }) => {
              const grade = getGrade(position.percentage);
              const passed = position.percentage >= PASS_THRESHOLD;
              return (
                <Card key={session.id} className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setCardTarget({ session, position })}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-5">
                      <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 ${passed ? "bg-green-50 border-2 border-green-200" : "bg-red-50 border-2 border-red-200"}`}>
                        <span className={`text-xl font-black ${grade.colorClass}`}>{grade.label}</span>
                        <span className={`text-xs font-semibold ${passed ? "text-green-600" : "text-red-600"}`}>
                          {passed ? "PASS" : "FAIL"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-primary">{session.name}</span>
                          <span className="text-xs bg-secondary/30 text-primary px-2 py-0.5 rounded font-medium">{session.term}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="font-semibold text-primary text-sm">{position.percentage.toFixed(1)}% ({position.totalMarks}/{position.maxPossible})</span>
                          <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-yellow-500" />Section {rankSuffix(position.sectionPosition)}/{position.sectionTotal}</span>
                          <span className="flex items-center gap-1"><Medal className="h-3 w-3 text-blue-500" />Grade {rankSuffix(position.gradePosition)}/{position.gradeTotal}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {position.subjectScores.map(ss => {
                            const pct = session.totalMarks > 0 ? Math.round((ss.score / session.totalMarks) * 100) : 0;
                            const g = getGrade(pct);
                            return (
                              <span key={ss.subject} className="text-xs bg-secondary/20 px-2 py-0.5 rounded font-medium">
                                {ss.subject}: {ss.score} <span className={`font-bold ${g.colorClass}`}>({g.label})</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={e => { e.stopPropagation(); setCardTarget({ session, position }); }}>
                        <FileText className="h-3.5 w-3.5" />View Card
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── Report Cards ─────────────────────────────────────── */}
        <TabsContent value="report-cards" className="space-y-4 mt-4">
          {reportCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40" />
              <p className="font-semibold text-primary">No Report Cards Yet</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Your report cards will appear here once generated by admin.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reportCards.map(rc => (
                <Card key={rc.id} className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setRcTarget(rc)}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="font-bold text-primary">{rc.academicYearName}</span>
                      </div>
                      <Badge className={(rc.overallGrade || "F") === "F" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>
                        {rc.overallGrade || "F"}
                      </Badge>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Average:</span>
                        <span className="font-semibold text-primary">{rc.totalPercentage?.toFixed(1)}%</span>
                      </div>
                      {rc.classPosition && (
                        <div className="flex justify-between">
                          <span>Class Position:</span>
                          <span className="font-semibold text-primary">{rankSuffix(rc.classPosition)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Generated:</span>
                        <span className="font-semibold text-primary">{rc.generatedAt}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="w-full mt-3 gap-1.5">
                      <Printer className="h-3.5 w-3.5" />View & Print
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Session Result Card Dialog */}
      {cardTarget && (
        <ResultCardDialog
          position={cardTarget.position}
          session={cardTarget.session}
          studentName={myStudent.name}
          admissionNumber={myStudent.admissionNumber}
          className={`${myStudent.class}-${myStudent.section}`}
          teacherName={getTeacher(`${myStudent.class}-${myStudent.section}`)}
          open={!!cardTarget}
          onClose={() => setCardTarget(null)}
          gradeScale={gradeScale}
        />
      )}

      {/* Report Card Dialog */}
      <Dialog open={!!rcTarget} onOpenChange={() => setRcTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Card — {myStudent.name}</DialogTitle>
          </DialogHeader>
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
  const { activeRole, exams } = useAppState();
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

  if (activeRole === "ADMIN") {
    const publishedLegacy = exams.filter(e => e.published).length;
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Results Management</h1>
          <p className="text-muted-foreground mt-1">Publish session results and manage legacy exam records</p>
        </div>
        <Tabs defaultValue="sessions">
          <TabsList>
            <TabsTrigger value="sessions" className="gap-2">
              <Trophy className="h-4 w-4" />Session Results
            </TabsTrigger>
            <TabsTrigger value="legacy" className="gap-2">
              <BarChart3 className="h-4 w-4" />Legacy Results
              {publishedLegacy > 0 && (
                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full text-xs font-bold ml-1">{publishedLegacy}</span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sessions" className="mt-5"><AdminSessionResultsPanel /></TabsContent>
          <TabsContent value="legacy" className="mt-5"><AdminLegacyResultsPanel /></TabsContent>
        </Tabs>
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
