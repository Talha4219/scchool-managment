"use client";

import { useMemo, useState, useEffect } from "react";
import { useAppState } from "@/lib/state-context";
import { useStudents } from "@/lib/students-context";
import { formatDatePK } from "@/lib/date-format";
import {
  fetchAcademicYearsDB, fetchClassesDB, fetchEnrollmentsDB,
  fetchSchoolResultsOverviewDB, fetchSchoolAttendanceOverviewDB,
} from "@/app/actions/academic-core";
import { fetchUsersDB } from "@/app/actions/features";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart3, TrendingUp, TrendingDown, Users, GraduationCap, DollarSign,
  CalendarCheck, Download, FileText, PieChart, LineChart, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart as ReLineChart, Line, PieChart as RePieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = ["#4f46e5", "#7c3aed", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#6366f1"];
const STATUS_COLORS: Record<string, string> = {
  Paid: "bg-green-50 text-green-700 border-green-200",
  Unpaid: "bg-blue-50 text-blue-700 border-blue-200",
  Overdue: "bg-red-50 text-red-700 border-red-200",
  Partial: "bg-amber-50 text-amber-700 border-amber-200",
};

function StatCard({ icon: Icon, label, value, sub, trend, trendUp }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; trend?: number; trendUp?: boolean;
}) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="p-2.5 rounded-xl bg-indigo-50">
            <Icon className="h-5 w-5 text-indigo-600" />
          </div>
          {trend !== undefined && (
            <span className={`flex items-center gap-1 text-xs font-semibold ${trendUp ? "text-green-600" : "text-red-600"}`}>
              {trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {trend}%
            </span>
          )}
        </div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3">{label}</p>
        <h3 className="text-2xl font-bold mt-0.5 text-primary">{value}</h3>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function getGrade(avg: number) {
  if (avg >= 90) return { grade: "A+", color: "text-green-700 bg-green-50" };
  if (avg >= 80) return { grade: "A", color: "text-blue-700 bg-blue-50" };
  if (avg >= 70) return { grade: "B+", color: "text-indigo-700 bg-indigo-50" };
  if (avg >= 60) return { grade: "B", color: "text-amber-700 bg-amber-50" };
  if (avg >= 50) return { grade: "C", color: "text-orange-700 bg-orange-50" };
  return { grade: "F", color: "text-red-700 bg-red-50" };
}

export default function ReportsPage() {
  const {
    schoolInfo, feeRecords, applications,
  } = useAppState();
  const { students } = useStudents();
  const { can, loaded: permsLoaded } = usePermission();

  // Real relational data — the legacy `classes`/`exams`/`attendance` arrays from
  // useAppState are dead demo state (always 0 rows for `exams`/`class_sections`
  // on a real DB) that never reflected what /classes, /exams, /attendance
  // actually write to. This page now reads the same relational tables those
  // pages use.
  const [teacherCount, setTeacherCount] = useState(0);
  const [activeClasses, setActiveClasses] = useState(0);
  const [enrollments, setEnrollments] = useState<{ className: string }[]>([]);
  const [resultsOverview, setResultsOverview] = useState<{ studentId: string; studentName: string; percentage: number; className: string | null }[]>([]);
  const [attendanceOverview, setAttendanceOverview] = useState<{ status: string; className: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsersDB().then(u => setTeacherCount((u as any[]).filter(x => x.role === "TEACHER").length));
    fetchAcademicYearsDB().then(years => {
      const active = years.find(y => y.isActive) || years[0];
      if (active) fetchClassesDB(active.id).then(cls => setActiveClasses(cls.length));
    });
    fetchEnrollmentsDB().then(setEnrollments);
    fetchSchoolResultsOverviewDB().then(setResultsOverview);
    Promise.all([fetchSchoolAttendanceOverviewDB()]).then(([att]) => {
      setAttendanceOverview(att);
      setLoading(false);
    });
  }, []);

  const activeStudents = useMemo(() => students.filter(s => s.status === "Active"), [students]);

  const totalRevenue = useMemo(() =>
    feeRecords.filter(f => f.status === "Paid").reduce((s, f) => s + f.amount, 0),
  [feeRecords]);

  const attendanceRate = useMemo(() => {
    if (attendanceOverview.length === 0) return 0;
    const present = attendanceOverview.filter(a => a.status === "Present" || a.status === "Late" || a.status === "Half Day").length;
    return Math.round((present / attendanceOverview.length) * 100);
  }, [attendanceOverview]);

  const admissionRate = useMemo(() => {
    if (applications.length === 0) return 0;
    const approved = applications.filter(a => a.status === "Approved").length;
    return Math.round((approved / applications.length) * 100);
  }, [applications]);

  const studentTrend = students.length > 0 ? Math.round((activeStudents.length / students.length) * 100) : 0;
  const lastMonthTotal = feeRecords.filter(f => f.month === "May").reduce((s, f) => s + f.amount, 0);
  const currentMonthTotal = feeRecords.filter(f => f.month === "June").reduce((s, f) => s + f.amount, 0);
  const revenueTrend = lastMonthTotal > 0 ? Math.round(((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) : 0;
  const admissionTrendPct = applications.length > 0 ? Math.round((applications.filter(a => a.status === "Approved" || a.status === "Under Review").length / applications.length) * 100) : 0;

  const studentsByClass = useMemo(() => {
    const map: Record<string, number> = {};
    enrollments.forEach(e => {
      map[e.className] = (map[e.className] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [enrollments]);

  const monthlyFeeCollection = useMemo(() => {
    const map: Record<string, number> = {};
    feeRecords.filter(f => f.status === "Paid").forEach(f => {
      const month = f.month || f.paymentDate?.slice(0, 7) || "Unknown";
      map[month] = (map[month] || 0) + f.amount;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount }));
  }, [feeRecords]);

  const studentPerformance = useMemo(() => {
    const byStudent = new Map<string, { name: string; className: string; scores: number[] }>();
    for (const r of resultsOverview) {
      const entry = byStudent.get(r.studentId) || { name: r.studentName, className: r.className || "—", scores: [] };
      entry.scores.push(r.percentage);
      byStudent.set(r.studentId, entry);
    }
    return Array.from(byStudent.values()).map(s => {
      const avg = Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length);
      return { name: s.name, class: s.className, subjects: `${s.scores.length} exam${s.scores.length !== 1 ? "s" : ""}`, avgScore: avg, ...getGrade(avg) };
    }).sort((a, b) => b.avgScore - a.avgScore).map((item, i) => ({ ...item, position: i + 1 }));
  }, [resultsOverview]);

  const examDistribution = useMemo(() => {
    const ranges = [
      { range: "90-100", min: 90, max: 100, count: 0 },
      { range: "80-89", min: 80, max: 89, count: 0 },
      { range: "70-79", min: 70, max: 79, count: 0 },
      { range: "60-69", min: 60, max: 69, count: 0 },
      { range: "50-59", min: 50, max: 59, count: 0 },
      { range: "Below 50", min: 0, max: 49, count: 0 },
    ];
    resultsOverview.forEach(r => {
      const idx = ranges.findIndex(rg => r.percentage >= rg.min && r.percentage <= rg.max);
      if (idx >= 0) ranges[idx].count++;
    });
    return ranges;
  }, [resultsOverview]);

  const attendanceByClass = useMemo(() => {
    const map: Record<string, { present: number; total: number }> = {};
    attendanceOverview.forEach(a => {
      const key = a.className;
      if (!map[key]) map[key] = { present: 0, total: 0 };
      map[key].total++;
      if (a.status === "Present" || a.status === "Late" || a.status === "Half Day") map[key].present++;
    });
    return Object.entries(map).map(([name, val]) => ({
      name,
      rate: val.total > 0 ? Math.round((val.present / val.total) * 100) : 0,
    }));
  }, [attendanceOverview]);

  const feeStatusPie = useMemo(() => {
    const paid = feeRecords.filter(f => f.status === "Paid").reduce((s, f) => s + f.amount, 0);
    const unpaid = feeRecords.filter(f => f.status === "Unpaid").reduce((s, f) => s + f.amount, 0);
    const overdue = feeRecords.filter(f => f.status === "Overdue").reduce((s, f) => s + f.amount, 0);
    const partial = feeRecords.filter(f => f.status === "Partial").reduce((s, f) => s + (f.amountPaid || 0), 0);
    return [
      { name: "Paid", value: paid },
      { name: "Unpaid", value: unpaid },
      { name: "Overdue", value: overdue },
      { name: "Partial", value: partial },
    ].filter(d => d.value > 0);
  }, [feeRecords]);

  const monthlyFeeTrend = useMemo(() => {
    const map: Record<string, { paid: number; total: number }> = {};
    feeRecords.forEach(f => {
      const month = f.month || "Unknown";
      if (!map[month]) map[month] = { paid: 0, total: 0 };
      map[month].total += f.amount;
      if (f.status === "Paid") map[month].paid += f.amount;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, val]) => ({
      month,
      collected: val.paid,
      pending: val.total - val.paid,
    }));
  }, [feeRecords]);

  const feeTableData = useMemo(() =>
    feeRecords.slice(0, 15).map(f => ({
      ...f,
      netDue: Math.max(0, f.amount - (f.discount || 0) - (f.amountPaid || 0)),
    })),
  [feeRecords]);

  const applicationFunnel = useMemo(() => {
    const total = applications.length;
    const underReview = applications.filter(a => a.status === "Under Review").length;
    const approved = applications.filter(a => a.status === "Approved").length;
    const rejected = applications.filter(a => a.status === "Rejected").length;
    return [
      { stage: "Total Applications", count: total },
      { stage: "Under Review", count: underReview },
      { stage: "Approved", count: approved },
      { stage: "Rejected", count: rejected },
    ];
  }, [applications]);

  const admissionTrend = useMemo(() => {
    const map: Record<string, number> = {};
    applications.filter(a => a.status === "Approved").forEach(a => {
      const month = a.submittedAt?.slice(0, 7) || "Unknown";
      map[month] = (map[month] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
  }, [applications]);

  const applicationTableData = useMemo(() => applications.slice(0, 15), [applications]);

  if (!permsLoaded) return null;
  if (!can("reports.view")) return <Unauthorized />;

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="border-none shadow-sm">
              <CardContent className="p-5">
                <Skeleton className="h-10 w-10 rounded-xl mb-3" />
                <Skeleton className="h-3 w-20 mb-1.5" />
                <Skeleton className="h-6 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2].map(i => (
            <Card key={i} className="border-none shadow-sm">
              <CardHeader><Skeleton className="h-4 w-56" /></CardHeader>
              <CardContent><Skeleton className="h-[300px] w-full rounded-md" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">{schoolInfo.name} · Comprehensive analytics dashboard</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
            <Download className="h-4 w-4" /> Export Report
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-2"><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="academic" className="gap-2"><GraduationCap className="h-4 w-4" /> Academic</TabsTrigger>
          <TabsTrigger value="financial" className="gap-2"><DollarSign className="h-4 w-4" /> Financial</TabsTrigger>
          <TabsTrigger value="admissions" className="gap-2"><FileText className="h-4 w-4" /> Admissions</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════ OVERVIEW ═══ */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard icon={Users} label="Total Students" value={students.length} sub={`${activeStudents.length} active`} trend={studentTrend} trendUp />
            <StatCard icon={GraduationCap} label="Teachers" value={teacherCount} sub="on staff" />
            <StatCard icon={Activity} label="Active Classes" value={activeClasses} />
            <StatCard icon={DollarSign} label="Total Revenue" value={`Rs. ${totalRevenue.toLocaleString()}`} trend={revenueTrend > 0 ? revenueTrend : 0} trendUp={revenueTrend >= 0} />
            <StatCard icon={CalendarCheck} label="Attendance Rate" value={`${attendanceRate}%`} />
            <StatCard icon={FileText} label="Admission Rate" value={`${admissionRate}%`} trend={admissionTrendPct} trendUp />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-indigo-500" /> Student Distribution by Class
                </CardTitle>
                <CardDescription>Number of students per class</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie data={studentsByClass} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                      {studentsByClass.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" /> Monthly Fee Collection
                </CardTitle>
                <CardDescription>Revenue trend by month</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyFeeCollection}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════════════ ACADEMIC ═══ */}
        <TabsContent value="academic" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-none shadow-sm lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-indigo-500" /> Student Performance Overview
                  </CardTitle>
                  <CardDescription>Top performing students</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs border-primary text-primary hover:bg-primary/5">
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-secondary/20">
                    <TableRow>
                      <TableHead className="font-bold">#</TableHead>
                      <TableHead className="font-bold">Student</TableHead>
                      <TableHead className="font-bold">Class</TableHead>
                      <TableHead className="font-bold">Subjects</TableHead>
                      <TableHead className="font-bold text-right">Avg Score</TableHead>
                      <TableHead className="font-bold text-center">Grade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentPerformance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No performance data available.</TableCell>
                      </TableRow>
                    ) : studentPerformance.slice(0, 10).map(s => (
                      <TableRow key={s.name + s.position} className="hover:bg-secondary/5">
                        <TableCell className="text-muted-foreground font-mono text-xs">{s.position}</TableCell>
                        <TableCell className="font-semibold text-primary">{s.name}</TableCell>
                        <TableCell className="text-sm">{s.class}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{s.subjects}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{s.avgScore}</TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${s.color}`}>{s.grade}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" /> Exam Results Distribution
                </CardTitle>
                <CardDescription>Score ranges across all exams</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={examDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-500" /> Attendance by Class
                </CardTitle>
                <CardDescription>Average attendance percentage</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={attendanceByClass} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} fontSize={12} tickFormatter={v => `${v}%`} />
                    <YAxis type="category" dataKey="name" fontSize={12} width={100} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="rate" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════ FINANCIAL ═══ */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={DollarSign} label="Total Revenue" value={`Rs. ${totalRevenue.toLocaleString()}`} sub="from fee collections" />
            <StatCard icon={TrendingUp} label="Total Invoiced" value={`Rs. ${feeRecords.reduce((s, f) => s + f.amount, 0).toLocaleString()}`} />
            <StatCard icon={TrendingUp} label="Collection Rate" value={`${feeRecords.length > 0 ? Math.round((feeRecords.filter(f => f.status === "Paid").length / feeRecords.length) * 100) : 0}%`} />
            <StatCard icon={TrendingDown} label="Outstanding" value={`Rs. ${feeRecords.filter(f => f.status !== "Paid").reduce((s, f) => s + Math.max(0, f.amount - (f.discount || 0) - (f.amountPaid || 0)), 0).toLocaleString()}`} sub="pending collection" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-indigo-500" /> Fee Collection Status
                </CardTitle>
                <CardDescription>Distribution by payment status</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie data={feeStatusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: Rs. ${value.toLocaleString()}`}>
                      {feeStatusPie.map((_, i) => (
                        <Cell key={i} fill={["#10b981", "#f59e0b", "#ef4444", "#8b5cf6"][i % 4]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-indigo-500" /> Monthly Fee Collection Trend
                </CardTitle>
                <CardDescription>Collected vs pending by month</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ReLineChart data={monthlyFeeTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </ReLineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-500" /> Fee Records Summary
                </CardTitle>
                <CardDescription>Recent fee records overview</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs border-primary text-primary hover:bg-primary/5">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold">Voucher</TableHead>
                    <TableHead className="font-bold">Student</TableHead>
                    <TableHead className="font-bold">Month</TableHead>
                    <TableHead className="font-bold text-right">Amount</TableHead>
                    <TableHead className="font-bold text-right">Net Due</TableHead>
                    <TableHead className="font-bold">Due Date</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feeTableData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No fee records found.</TableCell>
                    </TableRow>
                  ) : feeTableData.map(f => (
                    <TableRow key={f.id} className="hover:bg-secondary/5">
                      <TableCell className="font-mono text-xs font-bold text-primary">{f.voucherId}</TableCell>
                      <TableCell className="font-semibold text-primary">{f.studentName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.month || "—"}</TableCell>
                      <TableCell className="text-right font-bold text-primary">Rs. {f.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold">Rs. {f.netDue.toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{f.dueDate ? formatDatePK(f.dueDate) : "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={STATUS_COLORS[f.status] || ""}>{f.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════════ ADMISSIONS ═══ */}
        <TabsContent value="admissions" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-500" /> Application Funnel
                </CardTitle>
                <CardDescription>Admission pipeline overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {applicationFunnel.map((item, i) => {
                    const maxCount = Math.max(...applicationFunnel.map(f => f.count), 1);
                    const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    return (
                      <div key={item.stage}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-semibold text-primary">{item.stage}</span>
                          <span className="font-bold text-primary">{item.count}</span>
                        </div>
                        <div className="w-full h-2.5 bg-secondary/30 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: ["#4f46e5", "#f59e0b", "#10b981", "#ef4444"][i],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" /> Admission Trend by Month
                </CardTitle>
                <CardDescription>Approved admissions per month</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={admissionTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-500" /> Applications Table
                </CardTitle>
                <CardDescription>Recent admission applications</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs border-primary text-primary hover:bg-primary/5">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold">App ID</TableHead>
                    <TableHead className="font-bold">Applicant</TableHead>
                    <TableHead className="font-bold">Class</TableHead>
                    <TableHead className="font-bold">Submitted</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applicationTableData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No applications found.</TableCell>
                    </TableRow>
                  ) : applicationTableData.map(a => (
                    <TableRow key={a.id} className="hover:bg-secondary/5">
                      <TableCell className="font-mono text-xs font-bold text-primary">{a.applicationId}</TableCell>
                      <TableCell className="font-semibold text-primary">{a.firstName} {a.lastName}</TableCell>
                      <TableCell>{a.applyingForClass}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.submittedAt ? formatDatePK(a.submittedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={
                          a.status === "Approved" ? "bg-green-50 text-green-700 border-green-200" :
                          a.status === "Rejected" ? "bg-red-50 text-red-700 border-red-200" :
                          a.status === "Under Review" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-blue-50 text-blue-700 border-blue-200"
                        }>{a.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
