"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Plus, PenSquare, CheckCircle, Eye, FileText, GraduationCap, BarChart3, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { fetchAcademicYearsDB, fetchTermExamsDB, fetchReportCardsDB } from "@/app/actions/academic-core";
import type { AcademicYear, TermExam } from "@/lib/types";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function ExamsDashboardPage() {
  const { can, loaded } = usePermission();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [activeYearId, setActiveYearId] = useState("");
  const [exams, setExams] = useState<TermExam[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);

  const examTypeColors: Record<string, string> = {
    MidTerm: "bg-blue-100 text-blue-700", Final: "bg-purple-100 text-purple-700",
    Monthly: "bg-green-100 text-green-700", Quiz: "bg-yellow-100 text-yellow-700",
  };

  const loadContext = useCallback(async () => {
    const years = await fetchAcademicYearsDB();
    setAcademicYears(years);
    const active = years.find(y => y.isActive) || years[0];
    if (active) setActiveYearId(active.id);
  }, []);

  useEffect(() => { loadContext(); }, [loadContext]);

  useEffect(() => {
    if (!activeYearId) return;
    fetchTermExamsDB(activeYearId).then(setExams);
    fetchReportCardsDB(activeYearId).then(setReportCards);
  }, [activeYearId]);

  if (!loaded) return <PageSkeleton />;
  if (!can("exams.dashboard")) return <Unauthorized />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Examinations</h1>
          <p className="text-sm text-[#64748B] mt-1">Manage exams, enter marks, publish results and generate report cards</p>
        </div>
        <div className="flex gap-2">
          <Select value={activeYearId} onValueChange={setActiveYearId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>{academicYears.map(y => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent>
          </Select>
          <Link href="/exams/manage">
            <Button><Plus className="h-4 w-4 mr-1" /> New Exam</Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="elevated" className="relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#2563EB]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className="p-5 relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF6FF]">
                <GraduationCap className="h-6 w-6 text-[#2563EB]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0F172A]"><AnimatedCounter value={exams.length} /></p>
                <p className="text-xs text-[#64748B]">Total Exams</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#22C55E]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className="p-5 relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
                <CheckCircle className="h-6 w-6 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0F172A]">
                  <AnimatedCounter value={exams.filter(e => e.status === "Published").length} />
                </p>
                <p className="text-xs text-[#64748B]">Published</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F59E0B]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className="p-5 relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
                <Clock className="h-6 w-6 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0F172A]">
                  <AnimatedCounter value={exams.filter(e => e.status === "Scheduled" || e.status === "Ongoing").length} />
                </p>
                <p className="text-xs text-[#64748B]">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className="p-5 relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50">
                <FileText className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0F172A]"><AnimatedCounter value={reportCards.length} /></p>
                <p className="text-xs text-[#64748B]">Report Cards</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Recent Exams + Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recent Exams */}
        <Card className="md:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <h3 className="font-semibold text-[#0F172A]">Recent Exams</h3>
            <Link href="/exams/manage" className="text-sm text-[#2563EB] hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {exams.length > 0 ? (
              <div className="space-y-3">
                {exams.slice(0, 5).map(exam => (
                  <div key={exam.id} className="flex items-center justify-between py-2 border-b border-[#F1F5F9] last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge className={examTypeColors[exam.examType] || ""}>{exam.examType}</Badge>
                      <span className="text-sm font-medium text-[#0F172A]">{exam.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={exam.status === "Published" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                        {exam.status}
                      </Badge>
                      <div className="flex gap-1">
                        <Link href={`/exams/marks?examId=${exam.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"><PenSquare className="h-3 w-3" /> Marks</Button>
                        </Link>
                        <Link href={`/exams/results?examId=${exam.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"><Eye className="h-3 w-3" /> Results</Button>
                        </Link>
                        <Link href={`/exams/analytics?examId=${exam.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"><BarChart3 className="h-3 w-3" /> Analytics</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#94A3B8] text-center py-4">No exams yet</p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2"><h3 className="font-semibold text-[#0F172A]">Quick Actions</h3></CardHeader>
          <CardContent className="space-y-2">
            <Link href="/exams/manage" className="block">
              <Button variant="outline" className="w-full h-auto py-3 flex items-center gap-3 justify-start rounded-xl">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF6FF]"><Plus className="h-4 w-4 text-[#2563EB]" /></div>
                <span className="text-sm font-medium">Manage Exams</span>
              </Button>
            </Link>
            <Link href="/exams/marks" className="block">
              <Button variant="outline" className="w-full h-auto py-3 flex items-center gap-3 justify-start rounded-xl">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50"><PenSquare className="h-4 w-4 text-[#22C55E]" /></div>
                <span className="text-sm font-medium">Marks Entry</span>
              </Button>
            </Link>
            <Link href="/exams/results" className="block">
              <Button variant="outline" className="w-full h-auto py-3 flex items-center gap-3 justify-start rounded-xl">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50"><Eye className="h-4 w-4 text-[#F59E0B]" /></div>
                <span className="text-sm font-medium">Results</span>
              </Button>
            </Link>
            <Link href="/exams/report-cards" className="block">
              <Button variant="outline" className="w-full h-auto py-3 flex items-center gap-3 justify-start rounded-xl">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50"><FileText className="h-4 w-4 text-violet-500" /></div>
                <span className="text-sm font-medium">Report Cards</span>
              </Button>
            </Link>
            <Link href="/exams/analytics" className="block">
              <Button variant="outline" className="w-full h-auto py-3 flex items-center gap-3 justify-start rounded-xl">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-50"><BarChart3 className="h-4 w-4 text-pink-500" /></div>
                <span className="text-sm font-medium">Analytics</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
