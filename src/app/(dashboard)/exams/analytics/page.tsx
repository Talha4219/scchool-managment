"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import {
  fetchAcademicYearsDB,
  fetchTermExamsDB,
  fetchExamAnalyticsDB,
} from "@/app/actions/academic-core";
import type { AcademicYear, TermExam } from "@/lib/types";
import type { ExamAnalytics } from "@/app/actions/academic-core";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";

export default function AnalyticsPage() {
  const { can, loaded } = usePermission();  const { toast } = useToast();
  const searchParams = useSearchParams();
  const initialExamId = searchParams.get("examId") || "";

  const [activeYearId, setActiveYearId] = useState("");
  const [exams, setExams] = useState<TermExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState(initialExamId);
  const [analytics, setAnalytics] = useState<ExamAnalytics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const years = await fetchAcademicYearsDB();
      const active = years.find(y => y.isActive) || years[0];
      if (active) setActiveYearId(active.id);
    })();
  }, []);

  const loadExams = useCallback(async () => {
    if (!activeYearId) return;
    setExams(await fetchTermExamsDB(activeYearId));
  }, [activeYearId]);

  useEffect(() => { loadExams(); }, [loadExams]);

  useEffect(() => {
    if (selectedExamId) {
      setLoading(true);
      fetchExamAnalyticsDB(selectedExamId).then(a => { setAnalytics(a); setLoading(false); });
    }
  }, [selectedExamId]);

  if (!loaded) return <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading...</div>;
  if (!can("exams.analytics")) return <Unauthorized />;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/exams" className="p-2 hover:bg-slate-100 rounded-lg transition"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Analytics</h1>
          <p className="text-sm text-[#64748B] mt-1">Exam performance analytics and insights</p>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <Select value={selectedExamId} onValueChange={setSelectedExamId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Select exam" /></SelectTrigger>
          <SelectContent>{exams.map(ex => <SelectItem key={ex.id} value={ex.id}>{ex.name} ({ex.className})</SelectItem>)}</SelectContent>
        </Select>
        {selectedExamId && (
          <Button size="sm" variant="outline" onClick={() => {
            fetchExamAnalyticsDB(selectedExamId).then(a => { setAnalytics(a); toast({ title: "Analytics refreshed" }); });
          }}>Refresh</Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : analytics ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-[#E5E7EB]">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-[#1E293B]">{analytics.appeared}</p>
                <p className="text-xs text-[#64748B]">Students</p>
              </CardContent>
            </Card>
            <Card className="border-[#E5E7EB]">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{analytics.passed}</p>
                <p className="text-xs text-[#64748B]">Passed ({analytics.appeared > 0 ? Math.round(analytics.passed / analytics.appeared * 100) : 0}%)</p>
              </CardContent>
            </Card>
            <Card className="border-[#E5E7EB]">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-[#2563EB]">{analytics.averagePercent}%</p>
                <p className="text-xs text-[#64748B]">Average</p>
              </CardContent>
            </Card>
            <Card className="border-[#E5E7EB]">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-violet-600">{analytics.highestPercent}%</p>
                <p className="text-xs text-[#64748B]">Highest</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analytics.gradeDistribution.length > 0 && (
              <Card className="border-[#E5E7EB]">
                <CardHeader><p className="text-sm font-semibold text-[#1E293B]">Grade Distribution</p></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.gradeDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {(analytics.passed + analytics.failed) > 0 && (
              <Card className="border-[#E5E7EB]">
                <CardHeader><p className="text-sm font-semibold text-[#1E293B]">Pass / Fail</p></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: "Passed", count: analytics.passed, fill: "#10B981" },
                        { name: "Failed", count: analytics.failed, fill: "#EF4444" },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {[0, 1].map(i => <Cell key={i} fill={i === 0 ? "#10B981" : "#EF4444"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {analytics.subjectWise.length > 0 && (
              <Card className="border-[#E5E7EB] md:col-span-2">
                <CardHeader><p className="text-sm font-semibold text-[#1E293B]">Subject Performance</p></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.subjectWise.map(s => ({ name: s.subjectName, "Avg %": s.averagePercent, "Pass Rate": s.passRate }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Avg %" fill="#2563EB" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Pass Rate" fill="#10B981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {analytics.subjectWise.length > 0 && (
            <Card className="border-[#E5E7EB]">
              <CardHeader><p className="text-sm font-semibold text-[#1E293B]">Subject Details</p></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead><TableHead>Max Marks</TableHead><TableHead>Avg Marks</TableHead>
                      <TableHead>Avg %</TableHead><TableHead>Highest</TableHead><TableHead>Lowest</TableHead><TableHead>Pass Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.subjectWise.map(s => (
                      <TableRow key={s.subjectName}>
                        <TableCell className="font-medium">{s.subjectName}</TableCell>
                        <TableCell>{s.totalMarks}</TableCell><TableCell>{s.averageMarks}</TableCell>
                        <TableCell>{s.averagePercent}%</TableCell>
                        <TableCell className="text-emerald-600">{s.highestMarks}</TableCell>
                        <TableCell className="text-red-500">{s.lowestMarks}</TableCell>
                        <TableCell>
                          <Badge className={s.passRate >= 80 ? "bg-emerald-100 text-emerald-700" : s.passRate >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}>
                            {s.passRate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analytics.topPerformers.length > 0 && (
              <Card className="border-[#E5E7EB]">
                <CardHeader><p className="text-sm font-semibold text-[#1E293B]">Top 5 Performers</p></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Student</TableHead><TableHead>%</TableHead><TableHead>Grade</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {analytics.topPerformers.map((p, i) => (
                        <TableRow key={p.studentId}>
                          <TableCell className="text-[#94A3B8]">{i + 1}</TableCell>
                          <TableCell className="font-medium">{p.studentName}</TableCell>
                          <TableCell className="text-emerald-600 font-semibold">{p.percentage}%</TableCell>
                          <TableCell><Badge className={p.grade === "F" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>{p.grade}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
            {analytics.bottomPerformers.length > 0 && (
              <Card className="border-[#E5E7EB]">
                <CardHeader><p className="text-sm font-semibold text-[#1E293B]">Bottom 5 Performers</p></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Student</TableHead><TableHead>%</TableHead><TableHead>Grade</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {analytics.bottomPerformers.map((p, i) => (
                        <TableRow key={p.studentId}>
                          <TableCell className="text-[#94A3B8]">{i + 1}</TableCell>
                          <TableCell className="font-medium">{p.studentName}</TableCell>
                          <TableCell className="text-red-500 font-semibold">{p.percentage}%</TableCell>
                          <TableCell><Badge className={p.grade === "F" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>{p.grade}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-[#94A3B8]">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Select an exam to view analytics</p>
        </div>
      )}
    </motion.div>
  );
}
