"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { fetchAllSectionsDB } from "@/app/actions/academic-core";
import { useAppState } from "@/lib/state-context";
import { formatDatePK } from "@/lib/date-format";
import { useNotifications } from "@/lib/notifications-context";
import { useAttendance } from "@/lib/attendance-context";
import { useExams } from "@/lib/exams-context";
import { useStudents } from "@/lib/students-context";
import { getSession } from "@/app/actions/auth";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, UserCheck, Wallet, TrendingUp, TrendingDown, ArrowUpRight,
  CreditCard, BookOpen, GraduationCap, Megaphone, Sparkles,
  ClipboardList, CheckCircle2, CalendarCheck, BarChart3, Clock, XCircle, FileText,
  Plus, Bell, Upload, AlertTriangle, ChevronRight, UserPlus, Activity, Library, Building2,
  Download, CalendarDays, MessageSquare, Star, PartyPopper,
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
  AreaChart, Area,
} from "recharts";
import {
  fetchUsersDB, fetchAnnouncementsDB, fetchTimetableDB,
  fetchLeaveRequestsDB, approveLeaveDB, rejectLeaveDB, fetchLibraryBooksDB, fetchBookIssuesDB,
  fetchAssignmentsDB, fetchSubmissionsDB, fetchIncidentsDB,
  type Announcement, type Assignment, type AssignmentSubmission,
} from "@/app/actions/features";
import {
  fetchAcademicYearsDB, fetchClassesDB, fetchEnrollmentsDB,
  fetchReportCardsDB, fetchStudentTermResultsDB, fetchTermExamsDB,
  fetchMyTeachingSummaryDB,
} from "@/app/actions/academic-core";
import { fetchStaffAttendanceSummaryDB, fetchStaffAttendanceDB } from "@/app/actions/staff-attendance";
import { fetchSubstitutionsForDateDB, fetchPendingSubstitutionApprovalCountDB, type SubstitutionRecord } from "@/app/actions/substitutions";
import { useLanguage } from "@/hooks/use-language";
import useSWR from "swr";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ── Animated Counter ───────────────────────────────────────────────────────
function AnimatedCounter({ value, suffix = "", duration = 800 }: { value: number; suffix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let start = 0;
    const step = Math.ceil(value / (duration / 16)) || 1;
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);

  return <span ref={ref}>{display.toLocaleString()}{suffix}</span>;
}

// ── Soft KPI Card (Neo Soft UI style) ───────────────────────────────────────
function KpiCard({ label, value, sub, trend, icon: Icon, iconColor = "text-primary", valueColor, href }: {
  label: string; value: React.ReactNode; sub?: string; trend?: "up" | "down";
  icon: React.ElementType; iconColor?: string; valueColor?: string; href?: string;
}) {
  const inner = (
    <div className="soft-card p-5 h-full">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <h3 className={`text-[28px] font-bold leading-none ${valueColor || "text-foreground"}`}>{value}</h3>
      </div>
      {sub && (
        <p className={`text-[11px] mt-2 font-medium flex items-center gap-1 ${
          trend === "up" ? "text-warning" : trend === "down" ? "text-destructive" : "text-muted-foreground"
        }`}>
          {trend === "up" && <TrendingUp className="h-3 w-3" />}
          {trend === "down" && <TrendingDown className="h-3 w-3" />}
          {sub}
        </p>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function SoftCard({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`soft-card p-5 ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ── "School Today" summary bar + Action Required box (Admin/Principal/Owner) ──
// The one-screen answer to "is my school running well today, and where do I
// need to act?" — a condensed status bar (students/teachers/discipline/fees)
// plus a priority-sorted action list, both built from data the rest of the
// dashboard already has (no new tables). Intentionally excludes anything
// without a real data source yet (lesson-plan completion, maintenance
// tickets, counseling cases, vendor payments) rather than showing fake zeros.
type ActionPriority = "high" | "medium" | "low";
const ACTION_PRIORITY_STYLE: Record<ActionPriority, string> = {
  high: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100/70",
  medium: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/70",
  low: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/70",
};
const ACTION_PRIORITY_DOT: Record<ActionPriority, string> = {
  high: "bg-red-500", medium: "bg-amber-500", low: "bg-emerald-500",
};
const ACTION_PRIORITY_LABEL: Record<ActionPriority, string> = {
  high: "🔴 High", medium: "🟠 Medium", low: "🟢 Normal",
};

function SchoolTodayBar({
  totalStudents, presentCount, absentCount, lateCount,
  teacherIds, pendingAppsCount, pendingLeavesCount, paidFees, totalFees,
}: {
  totalStudents: number; presentCount: number; absentCount: number; lateCount: number;
  teacherIds: number[]; pendingAppsCount: number; pendingLeavesCount: number; paidFees: number; totalFees: number;
}) {
  const [teacherAtt, setTeacherAtt] = useState({ present: 0, absent: 0, late: 0 });
  const [disciplineOpen, setDisciplineOpen] = useState(0);
  const [pendingSubs, setPendingSubs] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchStaffAttendanceDB(todayISO()),
      fetchIncidentsDB(),
      fetchPendingSubstitutionApprovalCountDB(),
    ]).then(([staffAtt, incidents, subCount]) => {
      // staff_attendance covers every staff role — filter down to teachers
      // specifically so this card matches the "Teachers" label above it.
      const teacherIdSet = new Set(teacherIds);
      const teacherRows = staffAtt.filter(r => teacherIdSet.has(r.userId));
      setTeacherAtt({
        present: teacherRows.filter(r => r.status === "Present").length,
        absent: teacherRows.filter(r => r.status === "Absent").length,
        late: teacherRows.filter(r => r.status === "Late").length,
      });
      setDisciplineOpen(incidents.filter(r => r.status === "Open" || r.status === "Investigating").length);
      setPendingSubs(subCount);
      setLoaded(true);
    });
  }, [teacherIds]);

  const feePct = totalFees > 0 ? Math.round((paidFees / totalFees) * 100) : 0;

  const actionItems: { priority: ActionPriority; label: string; href: string }[] = [
    absentCount > 0 && { priority: "high", label: `${absentCount} student${absentCount > 1 ? "s" : ""} absent today`, href: "/attendance" },
    teacherAtt.absent > 0 && { priority: "high", label: `${teacherAtt.absent} teacher${teacherAtt.absent > 1 ? "s" : ""} absent — check substitute coverage`, href: "/attendance" },
    pendingSubs > 0 && { priority: "high", label: `${pendingSubs} substitution${pendingSubs > 1 ? "s" : ""} awaiting your approval`, href: "/attendance" },
    disciplineOpen > 0 && { priority: "medium", label: `${disciplineOpen} open discipline case${disciplineOpen > 1 ? "s" : ""}`, href: "/discipline" },
    pendingAppsCount > 0 && { priority: "medium", label: `${pendingAppsCount} admission application${pendingAppsCount > 1 ? "s" : ""} pending`, href: "/admissions" },
    pendingLeavesCount > 0 && { priority: "low", label: `${pendingLeavesCount} staff leave request${pendingLeavesCount > 1 ? "s" : ""} pending`, href: "/hr" },
  ].filter(Boolean) as { priority: ActionPriority; label: string; href: string }[];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-transparent to-transparent p-5">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">School Today — {fmtToday()}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <div>
            <p className="text-[11px] text-muted-foreground font-semibold mb-1">Students ({totalStudents})</p>
            <p className="text-sm font-bold">
              <span className="text-emerald-600">{presentCount} present</span>
              {" · "}<span className="text-red-600">{absentCount} absent</span>
              {lateCount > 0 && <>{" · "}<span className="text-amber-600">{lateCount} late</span></>}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-semibold mb-1">Teachers ({teacherIds.length})</p>
            {loaded ? (
              <p className="text-sm font-bold">
                <span className="text-emerald-600">{teacherAtt.present} present</span>
                {" · "}<span className="text-red-600">{teacherAtt.absent} absent</span>
                {teacherAtt.late > 0 && <>{" · "}<span className="text-amber-600">{teacherAtt.late} late</span></>}
              </p>
            ) : <div className="skeleton h-5 w-32" />}
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-semibold mb-1">Discipline</p>
            {loaded ? (
              <p className="text-sm font-bold">
                {disciplineOpen > 0 ? <span className="text-red-600">{disciplineOpen} open case{disciplineOpen > 1 ? "s" : ""}</span> : <span className="text-emerald-600">All clear</span>}
              </p>
            ) : <div className="skeleton h-5 w-20" />}
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-semibold mb-1">Fee Collection</p>
            <p className="text-sm font-bold">{feePct}%</p>
          </div>
        </div>
      </div>

      {loaded && actionItems.length > 0 && (
        <div className="rounded-2xl border p-5">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">🔴 Needs Your Attention</h2>
          <div className="space-y-2">
            {actionItems.map((item, i) => (
              <Link key={i} href={item.href} className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold transition-colors ${ACTION_PRIORITY_STYLE[item.priority]}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${ACTION_PRIORITY_DOT[item.priority]}`} />
                <span className="shrink-0 opacity-70">{ACTION_PRIORITY_LABEL[item.priority]}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Class Substitutions widget (Admin/Principal/Owner) ──────────────────────
// Separate from the Pending Approvals card by design: substitutions are a
// distinct, higher-frequency operational concern (daily, tied to today's
// timetable) from admissions/leave-request approvals. Also surfaces staff
// leave (applied or approved) since a leave is usually *why* a substitution
// exists — seeing both together answers "who's out and who's covering" in
// one place instead of two.
const SUB_STATUS_STYLE: Record<string, string> = {
  auto: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  manual_override: "bg-purple-100 text-purple-700",
  unfilled: "bg-red-100 text-red-700",
};
const SUB_STATUS_TEXT: Record<string, string> = {
  auto: "Pending Approval", confirmed: "Confirmed", manual_override: "Manual", unfilled: "Unfilled",
};

function SubstitutionsWidget({ leaveRequests, onLeaveUpdated }: { leaveRequests: any[]; onLeaveUpdated: () => void }) {
  const [subs, setSubs] = useState<SubstitutionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubstitutionsForDateDB(todayISO()).then(s => { setSubs(s); setLoading(false); });
  }, []);

  const relevantLeaves = leaveRequests.filter((l: any) => l.status === "Approved" || l.status === "Pending");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <SoftCard title="Class Substitutions (Today)" action={<Badge className="h-5 min-w-5 px-1.5 rounded-full text-[10px]">{subs.length}</Badge>}>
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
          ) : subs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No substitutions today</p>
          ) : (
            subs.map(s => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/40">
                <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0"><UserCheck className="h-3.5 w-3.5 text-blue-600" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate">{s.className} · {s.subjectName}</p>
                  <p className="text-[10px] text-muted-foreground">{s.originalTeacherName} → {s.substituteTeacherName || "unassigned"} · {s.startTime}-{s.endTime}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${SUB_STATUS_STYLE[s.status] || "bg-secondary text-muted-foreground"}`}>
                  {SUB_STATUS_TEXT[s.status] || s.status}
                </span>
              </div>
            ))
          )}
        </div>
        <Link href="/attendance">
          <Button variant="ghost" className="w-full h-9 text-xs font-semibold rounded-xl mt-3 text-primary hover:text-primary">View All Substitutions</Button>
        </Link>
      </SoftCard>

      <SoftCard title="Staff Leave" action={<Badge className="h-5 min-w-5 px-1.5 rounded-full text-[10px]">{relevantLeaves.length}</Badge>}>
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {relevantLeaves.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No leave applied or approved</p>
          ) : (
            relevantLeaves.map((l: any) => (
              <div key={l.id} className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/40">
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${l.status === "Approved" ? "bg-green-500/10" : "bg-warning/10"}`}>
                  <Clock className={`h-3.5 w-3.5 ${l.status === "Approved" ? "text-green-600" : "text-warning"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate">{l.employeeName}</p>
                  <p className="text-[10px] text-muted-foreground">{l.days || ""} {l.days === 1 ? "day" : "days"}{l.reason ? ` · ${l.reason}` : ""}</p>
                </div>
                {l.status === "Pending" ? (
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => approveLeaveDB(l.id, "Admin").then(onLeaveUpdated)}>Approve</Button>
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => rejectLeaveDB(l.id).then(onLeaveUpdated)}>Reject</Button>
                  </div>
                ) : (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-green-100 text-green-700">{l.status}</span>
                )}
              </div>
            ))
          )}
        </div>
      </SoftCard>
    </div>
  );
}

const quickActions = [
  { label: "Add Student", href: "/students", color: "from-[#2563EB] to-[#3B82F6]", icon: UserPlus },
  { label: "Attendance", href: "/attendance", color: "from-[#06B6D4] to-[#22D3EE]", icon: CalendarCheck },
  { label: "Fee Voucher", href: "/fees", color: "from-[#22C55E] to-[#4ADE80]", icon: CreditCard },
  { label: "Generate Result", href: "/exams/manage", color: "from-[#F59E0B] to-[#FBBF24]", icon: FileText },
  { label: "Add Teacher", href: "/teachers", color: "from-[#8B5CF6] to-[#A78BFA]", icon: UserCheck },
];

function SkeletonCard() {
  return <div className="soft-card p-5"><div className="skeleton h-8 w-8 rounded-full mb-4 ml-auto" /><div className="skeleton h-3 w-20 mb-2" /><div className="skeleton h-7 w-28 mb-2" /><div className="skeleton h-3 w-16" /></div>;
}

const fmtToday = () => {
  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday}, ${formatDatePK(now)}`;
};
const todayISO = () => new Date().toISOString().split("T")[0];

const ATT_STATUS_BADGE: Record<string, string> = {
  Present: "bg-green-100 text-green-700", Absent: "bg-red-100 text-red-700",
  Late: "bg-yellow-100 text-yellow-700", Leave: "bg-blue-100 text-blue-700", "Half Day": "bg-orange-100 text-orange-700",
};

// Self-service widget — a teacher's own attendance, distinct from the
// "My Classes' Attendance" KPI above it (which is their students', not theirs).
function MyClassesWidget() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchMyTeachingSummaryDB>> | null>(null);

  useEffect(() => { fetchMyTeachingSummaryDB().then(setSummary); }, []);

  if (!summary) return null;
  if (summary.classTeacherOf.length === 0 && summary.teaches.length === 0) return null;

  return (
    <SoftCard title="My Classes">
      <div className="space-y-3">
        {summary.classTeacherOf.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Class Teacher Of</p>
            <div className="flex flex-wrap gap-1.5">
              {summary.classTeacherOf.map(c => (
                <Badge key={c.sectionId} className="bg-primary/10 text-primary border-0">{c.className} – {c.sectionName}</Badge>
              ))}
            </div>
          </div>
        )}
        {summary.teaches.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Subjects You Teach</p>
            <div className="space-y-1.5">
              {summary.teaches.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{t.className} – {t.sectionName}</span>
                  <span className="text-muted-foreground">{t.subjectName}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SoftCard>
  );
}

function MyAttendanceWidget() {
  const [today, setToday] = useState<string | null>(null);
  const [percentage, setPercentage] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Dev-server action POSTs intermittently 503 under Turbopack; retry a
    // few times before giving up so a transient blip doesn't show as "no data".
    const withRetry = async <T,>(fn: () => Promise<T>, attempts = 5): Promise<T> => {
      let lastErr: unknown;
      for (let i = 0; i < attempts; i++) {
        try { return await fn(); } catch (err) {
          lastErr = err;
          if (i < attempts - 1) await new Promise(r => setTimeout(r, 600 * (i + 1)));
        }
      }
      throw lastErr;
    };

    getSession().then((s) => {
      if (!s || cancelled) return;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      // Independent fetches — a failure on one shouldn't discard a success on the other.
      withRetry(() => fetchStaffAttendanceSummaryDB(s.userId, monthStart, monthEnd))
        .then(summary => { if (!cancelled) setPercentage(summary.percentage); })
        .catch(() => {});
      withRetry(() => fetchStaffAttendanceDB(todayISO(), s.userId))
        .then(todayRecords => { if (!cancelled) setToday(todayRecords[0]?.status ?? null); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <SoftCard title="My Attendance" action={<Link href="/attendance" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">View History <ChevronRight className="h-3 w-3" /></Link>}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Today</p>
          <Badge className={`mt-1 border-0 ${today ? ATT_STATUS_BADGE[today] || "bg-secondary" : "bg-secondary text-muted-foreground"}`}>
            {today || "Not marked yet"}
          </Badge>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">This Month</p>
          <p className="text-xl font-bold text-foreground">{percentage === null ? "—" : `${percentage}%`}</p>
        </div>
      </div>
    </SoftCard>
  );
}

// Shows nothing when the teacher isn't covering anyone today — no empty-state
// clutter on a dashboard that's mostly zeros on a slow day already.
function CoveringTodayWidget() {
  const [items, setItems] = useState<{ id: string; className: string; subjectName: string; startTime: string; endTime: string }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSession().then(async (s) => {
      if (!s || cancelled) return;
      const { fetchSubstitutionsForDateDB } = await import("@/app/actions/substitutions");
      const subs = await fetchSubstitutionsForDateDB(todayISO(), { teacherId: s.userId });
      if (!cancelled) setItems(subs.map(sub => ({ id: sub.id, className: sub.className, subjectName: sub.subjectName, startTime: sub.startTime, endTime: sub.endTime })));
    });
    return () => { cancelled = true; };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <SoftCard title="Covering Today" action={<Badge variant="outline" className="text-[10px]">{items.length} period{items.length > 1 ? "s" : ""}</Badge>}>
      <div className="space-y-2">
        {items.map(i => (
          <div key={i.id} className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{i.className} · {i.subjectName}</span>
            <span className="text-xs text-muted-foreground">{i.startTime}–{i.endTime}</span>
          </div>
        ))}
      </div>
    </SoftCard>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { t } = useLanguage();
  const { activeRole, feeRecords, classes, subjects, schoolInfo, applications } = useAppState();
  const { notifications } = useNotifications();
  const { attendance } = useAttendance();
  const { exams } = useExams();
  const { students } = useStudents();
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [wardStudents, setWardStudents] = useState<any[]>([]);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<(AssignmentSubmission & { assignmentTitle: string })[]>([]);
  const [toGradeCount, setToGradeCount] = useState(0);
  const [myUpcomingExams, setMyUpcomingExams] = useState<any[]>([]);

  useEffect(() => {
    getSession().then(s => {
      setSessionRole(s?.role ?? null);
      setSessionEmail(s?.email ?? null);
      setSessionName(s?.name ?? null);
    });
  }, []);

  const myStudent = useMemo(() => students.find(s => s.email === sessionEmail && s.status === "Active"), [students, sessionEmail]);

  useEffect(() => {
    if (!sessionRole || !sessionEmail) return;
    if (sessionRole === "STUDENT" && myStudent) {
      fetchStudentTermResultsDB(myStudent.id).then(setStudentResults);
      fetchAssignmentsDB(myStudent.class).then(setMyAssignments);
      // "Upcoming Exams" needs the real relational TermExam data (scoped to the
      // student's own class), not the unused legacy `exams` demo array.
      fetchEnrollmentsDB(undefined, undefined, myStudent.id).then(enrollments => {
        const mine = enrollments[0];
        if (!mine) return;
        fetchTermExamsDB(mine.academicYearId, mine.classId).then(examList => {
          const today = todayISO();
          const upcoming = examList
            .filter((e: any) => e.startDate >= today)
            .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
          setMyUpcomingExams(upcoming.slice(0, 4));
        });
      });
    } else if (sessionRole === "PARENT") {
      const wards = students.filter(s => s.parentEmail === sessionEmail && s.status === "Active");
      setWardStudents(wards);
      if (wards.length > 0) {
        setSelectedWardId(prev => prev ?? wards[0].id);
        Promise.all(wards.map(w => fetchStudentTermResultsDB(w.id))).then(results => {
          setStudentResults(results.flat());
        });
      }
    } else if (sessionRole === "TEACHER" && sessionName) {
      fetchAssignmentsDB(undefined, sessionName).then(async (list) => {
        setMyAssignments(list);
        const recent = list.slice(0, 6);
        const subsByAssignment = await Promise.all(recent.map(a => fetchSubmissionsDB(a.id)));
        const flat = subsByAssignment.flatMap((subs, i) => subs.map(s => ({ ...s, assignmentTitle: recent[i].title })));
        flat.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
        setRecentSubmissions(flat.slice(0, 5));
        setToGradeCount(flat.filter(s => !s.grade).length);
      });
    }
  }, [sessionRole, sessionEmail, sessionName, students, myStudent]);

  // Bulk dashboard reference data, cached client-side (SWR) so repeat visits
  // to /dashboard within the dedupe window render instantly instead of
  // re-querying Postgres for the same 7 things every single navigation.
  const { data: dashData, isLoading: loading, mutate: refreshDashData } = useSWR(
    "dashboard-bulk",
    () => Promise.all([
      fetchUsersDB(),
      fetchAnnouncementsDB(),
      fetchTimetableDB(),
      fetchAcademicYearsDB(),
      fetchLeaveRequestsDB(),
      fetchLibraryBooksDB(),
      fetchBookIssuesDB(),
    ]).then(([u, a, t, yrs, leaves, books, issues]) => {
      const active = yrs.find((y: any) => y.isActive) || yrs[0];
      if (active) {
        fetchClassesDB(active.id).then(cls => {
          if (cls.length) fetchEnrollmentsDB(active.id, cls[0].id);
        });
      }
      return { users: u as any[], announcements: a, timetable: t, leaveRequests: leaves, libraryBooks: books, bookIssues: issues, academicYearName: active?.name || "" };
    }),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );
  const users = dashData?.users ?? [];
  const announcements = dashData?.announcements ?? [];
  const timetable = dashData?.timetable ?? [];
  const leaveRequests = dashData?.leaveRequests ?? [];
  const libraryBooks = dashData?.libraryBooks ?? [];
  const bookIssues = dashData?.bookIssues ?? [];
  const academicYearName = dashData?.academicYearName ?? "";
  const refreshLeaveRequests = () => refreshDashData();

  const teachers = users.filter(u => u.role === "TEACHER");
  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === "Active").length;
  const todayAtt = attendance.filter(a => a.date === todayISO());
  const presentCount = todayAtt.filter(a => a.status === "Present").length;
  const absentCount = todayAtt.filter(a => a.status === "Absent").length;
  const lateCount = todayAtt.filter(a => a.status === "Late").length;
  const attPct = todayAtt.length > 0 ? Math.round((presentCount / todayAtt.length) * 100) : 0;
  const totalFees = feeRecords.reduce((s, f) => s + f.amount, 0);
  const paidFees = feeRecords.filter(f => f.status === "Paid").reduce((s, f) => s + f.amount, 0);
  const pendingFeesCount = feeRecords.filter(f => f.status === "Unpaid").length;
  const pendingApps = applications.filter(a => a.status === "Pending" || a.status === "Under Review");

  const studentTrend = students.length > 0 ? Math.round((activeStudents / students.length) * 100) : 0;
  const lastMonthFees = feeRecords.filter(f => f.month === "May").reduce((s, f) => s + f.amount, 0);
  const currentMonthFees = feeRecords.filter(f => f.month === "June").reduce((s, f) => s + f.amount, 0);
  const feeTrend = lastMonthFees > 0 ? Math.round(((currentMonthFees - lastMonthFees) / lastMonthFees) * 100) : 0;
  const activeLeaves = leaveRequests.filter((l: any) => l.status === "Approved");
  const pendingLeaves = leaveRequests.filter((l: any) => l.status === "Pending");
  const recentNotifs = notifications.slice(0, 3);

  const totalClasses = classes.length;
  const [totalSections, setTotalSections] = useState(0);
  useEffect(() => { fetchAllSectionsDB().then(s => setTotalSections(s.length)); }, []);

  const totalBooks = libraryBooks.length;
  const totalIssues = bookIssues.length;
  const pendingReturns = bookIssues.filter((i: any) => i.status === "Issued").length;
  const todayTimetable = timetable.filter(t => t.dayOfWeek === DAY_NAMES[new Date().getDay()]);
  const myTodayTimetable = todayTimetable.filter(t => t.teacherName === sessionName);
  const recentExams = exams.slice(0, 4);

  // Enrollment trend (last 6 months, from admission applications)
  const enrollmentTrend = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-US", { month: "short" }) });
    }
    return months.map(m => {
      const count = applications.filter(a => {
        const d = new Date(a.submittedAt);
        return `${d.getFullYear()}-${d.getMonth()}` === m.key;
      }).length;
      return { month: m.label, applications: count };
    });
  }, [applications]);

  const selectedWard = wardStudents.find(w => w.id === selectedWardId) || wardStudents[0];
  const wardResults = studentResults.filter((r: any) => r.studentId === selectedWard?.id);
  const wardFees = feeRecords.filter(f => f.studentId === selectedWard?.id);
  const wardPendingFees = wardFees.filter(f => f.status !== "Paid").reduce((s, f) => s + (f.amount - (f.amountPaid || 0)), 0);
  const wardAttendance = attendance.filter(a => a.studentId === selectedWard?.id);
  const wardAttPct = wardAttendance.length > 0 ? Math.round((wardAttendance.filter(a => a.status === "Present").length / wardAttendance.length) * 100) : 0;
  const wardAvgPct = wardResults.length > 0 ? Math.round(wardResults.reduce((s: number, r: any) => s + (r.percentage || 0), 0) / wardResults.length) : 0;

  const myAttendance = myStudent ? attendance.filter(a => a.studentId === myStudent.id) : [];
  const myAttPct = myAttendance.length > 0 ? Math.round((myAttendance.filter(a => a.status === "Present").length / myAttendance.length) * 100) : 0;
  const myAvgPct = studentResults.length > 0 ? Math.round(studentResults.reduce((s: number, r: any) => s + (r.percentage || 0), 0) / studentResults.length) : 0;
  const myGpa = (myAvgPct / 100 * 4).toFixed(1);
  const myPendingHomework = myAssignments.filter(a => new Date(a.dueDate) >= new Date()).length;
  const myBookIssues = bookIssues.filter((b: any) => b.studentId === myStudent?.id && b.status !== "Returned");
  const myFeeRecords = feeRecords.filter(f => f.studentId === myStudent?.id);
  const myPendingFees = myFeeRecords.filter(f => f.status !== "Paid").reduce((s, f) => s + Math.max(0, f.amount - (f.discount || 0) - (f.amountPaid || 0)), 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-64 mb-2 rounded-lg" />
        <div className="skeleton h-4 w-96 mb-6 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2"><SkeletonCard /></div>
          <div><SkeletonCard /></div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════ STUDENT ═══════════════════════════════════
  if (sessionRole === "STUDENT") {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="dashboard-heading">{t("dash.myAcademicProfile")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {myStudent?.class || "—"} · Section {myStudent?.section || "—"}
            </p>
          </div>
          <Link href="/results">
            <Button size="sm" variant="outline" className="h-9 text-xs font-semibold rounded-xl">
              <Download className="h-3.5 w-3.5 mr-1.5" /> {t("dash.transcript")}
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard label={t("parent.attendance")} value={`${myAttPct}%`} sub={t("dash.overall")} trend="up" icon={CalendarCheck} iconColor="text-primary" />
          <KpiCard label={t("dash.currentGpa")} value={<>{myGpa}<span className="text-sm text-muted-foreground"> / 4.0</span></>} sub={`${t("dash.avgScore")} ${myAvgPct}%`} icon={GraduationCap} iconColor="text-info" />
          <KpiCard label={t("dash.pendingHomework")} value={myPendingHomework} sub={myPendingHomework > 0 ? t("dash.dueSoon") : t("dash.allCaughtUp")} icon={AlertTriangle} iconColor="text-warning" trend={myPendingHomework > 0 ? "down" : undefined} />
          <KpiCard label={t("dash.libraryBooks")} value={myBookIssues.length} sub={t("dash.currentlyIssued")} icon={Library} iconColor="text-success" href="/library" />
          <KpiCard label={t("dash.pendingFees")} value={`Rs.${myPendingFees.toLocaleString()}`} valueColor={myPendingFees > 0 ? "text-destructive" : undefined} sub={myPendingFees > 0 ? t("dash.dueSoon") : t("dash.allPaid")} trend={myPendingFees > 0 ? "down" : undefined} icon={CreditCard} iconColor="text-warning" href="/fees" />
        </div>

        {studentResults.length > 0 && (
          <SoftCard title={t("dash.myRecentResults")} action={<Link href="/results" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">{t("dash.viewAll")} <ChevronRight className="h-3 w-3" /></Link>}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {studentResults.slice(0, 6).map((r: any) => {
                const pct = r.percentage ?? 0;
                const passed = pct >= 40;
                return (
                  <div key={r.id} className={`rounded-2xl border p-4 ${passed ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-xs font-bold text-foreground">{r.examName}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{r.examType || t("dash.termExam")}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{passed ? t("dash.pass") : t("dash.fail")}</span>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-black text-foreground">{pct.toFixed(0)}<span className="text-sm">%</span></span>
                      <span className="text-xs font-bold mb-0.5 text-muted-foreground">{r.grade || "-"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </SoftCard>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SoftCard title={t("dash.announcements")} className="lg:col-span-2" action={<Link href="/announcements" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">{t("dash.viewAll")} <ChevronRight className="h-3 w-3" /></Link>}>
            <div className="space-y-2">
              {announcements.slice(0, 4).map(a => (
                <div key={a.id} className="p-3 rounded-2xl hover:bg-secondary/50 transition-colors">
                  <p className="text-xs font-semibold text-foreground">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{a.content}</p>
                </div>
              ))}
              {announcements.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">{t("dash.noAnnouncementsYet")}</p>}
            </div>
          </SoftCard>
          <SoftCard title={t("dash.upcomingExams")} action={<Link href="/exams" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">{t("dash.viewAll")} <ChevronRight className="h-3 w-3" /></Link>}>
            <div className="space-y-2">
              {myUpcomingExams.map((exam: any) => (
                <div key={exam.id} className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-secondary/50 transition-colors">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center"><FileText className="h-4 w-4 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{exam.name}</p>
                    <p className="text-[10px] text-muted-foreground">{exam.examType}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{exam.startDate}</Badge>
                </div>
              ))}
              {myUpcomingExams.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{t("dash.noUpcomingExams")}</p>}
            </div>
          </SoftCard>
        </div>
      </div>
    );
  }

  // ══════════════════════════════ TEACHER ════════════════════════════════════
  if (sessionRole === "TEACHER") {
    const published = exams.filter((e: any) => e.status === "Published").length;
    const pending = exams.filter((e: any) => e.status === "Draft" || e.status === "MarksEntered").length;
    const resultsChartData = [
      { name: "Published", value: published },
      { name: "Pending", value: pending },
      { name: "Total", value: exams.length },
    ];

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="dashboard-heading">{t("dash.welcomeBack")}, {sessionName || "Teacher"}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("dash.todaysAgenda")}, {fmtToday()}.</p>
          </div>
          <Link href="/classes">
            <Button size="sm" variant="outline" className="h-9 text-xs font-semibold rounded-xl">
              <Building2 className="h-3.5 w-3.5 mr-1.5" /> {t("dash.myClasses")}
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label={t("dash.todaysClasses")} value={myTodayTimetable.length} sub={myTodayTimetable[0] ? `${t("dash.firstClassAt")} ${myTodayTimetable[0].startTime}` : t("dash.noClassesToday")} icon={CalendarDays} iconColor="text-primary" />
          <KpiCard label={t("dash.avgAttendance")} value={`${attPct}%`} sub={t("dash.acrossSections")} trend="up" icon={CheckCircle2} iconColor="text-success" />
          <KpiCard label={t("dash.toGrade")} value={toGradeCount} sub={toGradeCount > 0 ? t("dash.submissionsWaiting") : t("dash.allGraded")} icon={ClipboardList} iconColor="text-warning" href="/assignments" />
          <KpiCard label={t("dash.upcomingExams")} value={recentExams.length} sub={t("dash.seeExamSchedule")} icon={FileText} iconColor="text-info" href="/exams" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <SoftCard title={t("dash.todaysSchedule")} action={<Link href="/timetable" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">{t("dash.viewFullCalendar")} <ChevronRight className="h-3 w-3" /></Link>}>
              {myTodayTimetable.length > 0 ? (
                <div className="relative pl-6 space-y-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-border">
                  {myTodayTimetable.map((slot: any) => (
                    <div key={slot.id} className="relative">
                      <span className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-primary border-2 border-card" />
                      <div className="rounded-2xl bg-secondary/40 p-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-foreground">{slot.subjectName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{slot.className} · {slot.startTime} - {slot.endTime}</p>
                        </div>
                        {slot.room && <Badge variant="outline" className="text-[10px] shrink-0">{t("dash.room")} {slot.room}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground text-center py-8">{t("dash.noClassesScheduled")}</p>}
            </SoftCard>

            <SoftCard title={t("dash.recentStudentActivity")}>
              <div className="space-y-2">
                {recentSubmissions.length > 0 ? recentSubmissions.map(s => (
                  <div key={s.id} className="flex items-start gap-3 p-3 rounded-2xl hover:bg-secondary/50 transition-colors">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Upload className="h-3.5 w-3.5 text-primary" /></div>
                    <div className="min-w-0">
                      <p className="text-xs text-foreground"><span className="font-bold">{s.studentName}</span> {t("dash.submitted")} <span className="font-semibold">{s.assignmentTitle}</span></p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.submittedAt}{!s.grade && ` · ${t("dash.needsGrading")}`}</p>
                    </div>
                  </div>
                )) : <p className="text-xs text-muted-foreground text-center py-6">{t("dash.noRecentSubmissions")}</p>}
              </div>
            </SoftCard>
          </div>

          <div className="space-y-4">
            <MyClassesWidget />
            <MyAttendanceWidget />
            <CoveringTodayWidget />
            <SoftCard title={t("dash.resultsOverview")} action={<Badge variant="outline" className="text-[10px]">{t("dash.thisTerm")}</Badge>}>
              <div className="h-[160px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resultsChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SoftCard>
            <SoftCard title={t("dash.quickActions")}>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/assignments" className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-secondary/50 hover:bg-secondary p-4 transition-colors">
                  <ClipboardList className="h-5 w-5 text-primary" /><span className="text-[11px] font-semibold text-foreground">{t("dash.newAssignment")}</span>
                </Link>
                <Link href="/announcements" className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-secondary/50 hover:bg-secondary p-4 transition-colors">
                  <Megaphone className="h-5 w-5 text-primary" /><span className="text-[11px] font-semibold text-foreground">{t("dash.postNotice")}</span>
                </Link>
                <Link href="/exams/manage" className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-secondary/50 hover:bg-secondary p-4 transition-colors">
                  <CalendarDays className="h-5 w-5 text-primary" /><span className="text-[11px] font-semibold text-foreground">{t("dash.scheduleExam")}</span>
                </Link>
                <Link href="/discipline" className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-secondary/50 hover:bg-secondary p-4 transition-colors">
                  <AlertTriangle className="h-5 w-5 text-primary" /><span className="text-[11px] font-semibold text-foreground">{t("dash.incidentReport")}</span>
                </Link>
              </div>
            </SoftCard>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════ PARENT ═════════════════════════════════════
  if (sessionRole === "PARENT" && wardStudents.length > 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="dashboard-heading">{t("dash.parentDashboard")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("dash.parentOverviewSub")}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {wardStudents.map(w => (
              <button key={w.id} onClick={() => setSelectedWardId(w.id)}
                className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  selectedWard?.id === w.id ? "bg-primary text-primary-foreground" : "bg-secondary/70 text-foreground hover:bg-secondary"
                }`}>
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold ${selectedWard?.id === w.id ? "bg-white/20" : "bg-primary/15 text-primary"}`}>{w.name.charAt(0)}</span>
                {w.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label={t("dash.currentAttendance")} value={`${wardAttPct}%`} sub={t("dash.overall")} trend="up" icon={CalendarCheck} iconColor="text-primary" />
          <KpiCard label={t("dash.averageGrade")} value={`${wardAvgPct}%`} sub={wardResults[0]?.grade ? `${t("dash.grade")} ${wardResults[0].grade}` : t("dash.noResultsYet")} icon={Star} iconColor="text-info" />
          <KpiCard label={t("dash.pendingFees")} value={`Rs.${wardPendingFees.toLocaleString()}`} sub={wardPendingFees > 0 ? t("dash.dueSoon") : t("dash.allPaid")} valueColor={wardPendingFees > 0 ? "text-destructive" : undefined} icon={CreditCard} iconColor="text-warning" href="/parent/fees" trend={wardPendingFees > 0 ? "down" : undefined} />
          <KpiCard label={t("dash.announcements")} value={announcements.length} sub={announcements[0]?.title?.slice(0, 24) || t("dash.noUpdates")} icon={Megaphone} iconColor="text-success" href="/announcements" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SoftCard title={t("dash.academicProgress")} className="lg:col-span-2">
            <div className="h-[280px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={wardResults.map((r: any) => ({ exam: r.examName, score: r.percentage ?? 0 }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="exam" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
              {wardResults.length === 0 && <p className="text-xs text-muted-foreground text-center -mt-32">{t("dash.noPublishedResults")}</p>}
            </div>
          </SoftCard>
          <SoftCard title={t("dash.feeStatus")}>
            <div className="space-y-3">
              {wardFees.slice(0, 3).map(f => {
                const pct = f.amount > 0 ? Math.round(((f.amountPaid || (f.status === "Paid" ? f.amount : 0)) / f.amount) * 100) : 0;
                return (
                  <div key={f.id} className="rounded-2xl bg-secondary/40 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-foreground">{f.month || f.feeType || "Fee"}</span>
                      <span className={`text-xs font-bold ${f.status === "Paid" ? "text-success" : "text-destructive"}`}>{f.status === "Paid" ? "100%" : `Rs.${f.amount}`}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
              {wardFees.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">{t("dash.noFeeRecords")}</p>}
              <Link href="/parent/fees">
                <Button className="w-full h-9 text-xs font-semibold rounded-xl mt-2">{t("dash.payNow")}</Button>
              </Link>
            </div>
          </SoftCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SoftCard title={t("dash.announcements")} action={<Link href="/announcements" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">{t("dash.viewAll")} <ChevronRight className="h-3 w-3" /></Link>}>
            <div className="space-y-2">
              {announcements.slice(0, 3).map(a => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-2xl hover:bg-secondary/50 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary">{a.authorName?.charAt(0) || "S"}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">{a.authorName || "School"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.content}</p>
                  </div>
                </div>
              ))}
              {announcements.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">{t("dash.noAnnouncementsYet")}</p>}
            </div>
          </SoftCard>
          <SoftCard title={t("dash.todaysSchedule")}>
            <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"><ClipboardList className="h-5 w-5 text-primary" /></div>
              <p className="text-xs text-muted-foreground max-w-xs">
                {selectedWard?.name} {t("dash.hasClassesToday").replace(
                  "{n}",
                  String(todayTimetable.filter((slot: any) => slot.className === selectedWard?.class).length)
                )}
              </p>
              <Link href="/timetable">
                <Button size="sm" variant="outline" className="h-8 text-xs font-semibold rounded-xl">{t("dash.viewFullSchedule")}</Button>
              </Link>
            </div>
          </SoftCard>
        </div>
      </div>
    );
  }

  // ══════════════════════════════ ADMIN (default) ════════════════════════════
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="dashboard-heading">{t("dash.systemOverview")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("dash.adminWelcomeSub")}</p>
        </div>
        <Badge variant="outline" className="h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> {academicYearName || t("dash.currentTerm")}
        </Badge>
      </div>

      <SchoolTodayBar
        totalStudents={totalStudents} presentCount={presentCount} absentCount={absentCount} lateCount={lateCount}
        teacherIds={teachers.map(t => t.id)}
        pendingAppsCount={pendingApps.length} pendingLeavesCount={pendingLeaves.length}
        paidFees={paidFees} totalFees={totalFees}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("dash.totalStudents")} value={<AnimatedCounter value={totalStudents} />} valueColor="text-primary" sub={`+${studentTrend}% ${t("dash.vsLastTerm")}`} trend="up" icon={Users} href="/students" />
        <KpiCard label={t("dash.totalTeachers")} value={<AnimatedCounter value={teachers.length} />} sub={t("dash.optimalStaffing")} icon={GraduationCap} href="/teachers" />
        <KpiCard label={t("dash.monthlyRevenue")} value={`Rs.${currentMonthFees.toLocaleString()}`} valueColor="text-warning" sub={`${feeTrend >= 0 ? "+" : ""}${feeTrend}% ${t("dash.vsLastMonth")}`} trend={feeTrend >= 0 ? "up" : "down"} icon={Wallet} href="/fees" />
        <KpiCard label={t("dash.overallAttendance")} value={`${attPct}%`} valueColor={attPct >= 90 ? "text-foreground" : "text-destructive"} sub={t("dash.vsLastWeek")} trend={attPct >= 90 ? "up" : "down"} icon={Activity} href="/attendance" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SoftCard title={t("dash.enrollmentTrends")} className="lg:col-span-2" action={
          <div className="flex gap-1 bg-secondary/60 rounded-xl p-1">
            <button className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-card shadow-sm text-foreground">{t("dash.sixMonths")}</button>
            <button className="px-3 py-1 text-[11px] font-semibold rounded-lg text-muted-foreground">{t("dash.oneYear")}</button>
          </div>
        }>
          <div className="h-[280px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={enrollmentTrend}>
                <defs>
                  <linearGradient id="enrollmentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "none", boxShadow: "0 8px 24px -8px rgba(30,41,82,0.25)" }} />
                <Area type="monotone" dataKey="applications" stroke="hsl(var(--primary))" strokeWidth={4} fill="url(#enrollmentFill)" dot={false} activeDot={{ r: 5, fill: "hsl(var(--primary))" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SoftCard>

        <SoftCard title={t("dash.pendingApprovals")} action={<Badge className="h-5 min-w-5 px-1.5 rounded-full text-[10px]">{pendingApps.length + pendingLeaves.length}</Badge>}>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {pendingApps.slice(0, 3).map(app => (
              <div key={app.id} className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/40">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><UserPlus className="h-3.5 w-3.5 text-primary" /></div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">{t("dash.newAdmission")}</p>
                  <p className="text-[10px] text-muted-foreground">{app.firstName} {app.lastName} ({app.applyingForClass})</p>
                </div>
              </div>
            ))}
            {pendingLeaves.slice(0, 2).map((l: any) => (
              <div key={l.id} className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/40">
                <div className="h-8 w-8 rounded-xl bg-warning/10 flex items-center justify-center shrink-0"><Clock className="h-3.5 w-3.5 text-warning" /></div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">{t("dash.staffLeaveRequest")}</p>
                  <p className="text-[10px] text-muted-foreground">{l.employeeName} · {l.days || ""} {t("dash.days")}</p>
                </div>
              </div>
            ))}
            {pendingApps.length + pendingLeaves.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">{t("dash.nothingPending")}</p>}
          </div>
          <Link href="/admissions">
            <Button variant="ghost" className="w-full h-9 text-xs font-semibold rounded-xl mt-3 text-primary hover:text-primary">{t("dash.viewAllApprovals")}</Button>
          </Link>
        </SoftCard>
      </div>

      {(sessionRole === "ADMIN" || sessionRole === "PRINCIPAL" || sessionRole === "OWNER") && (
        <SubstitutionsWidget leaveRequests={leaveRequests} onLeaveUpdated={refreshLeaveRequests} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SoftCard title={t("dash.recentAdmissions")} className="lg:col-span-2" action={<Link href="/admissions" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">{t("dash.viewAll")} <ChevronRight className="h-3 w-3" /></Link>}>
          <div className="space-y-1">
            {applications.slice(0, 4).map(app => (
              <div key={app.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-secondary/50 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{app.firstName?.charAt(0)}{app.lastName?.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{app.firstName} {app.lastName}</p>
                  <p className="text-[10px] text-muted-foreground">{app.applyingForClass} · {app.parentName}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{app.submittedAt}</span>
                <Badge className={`text-[10px] shrink-0 ${app.status === "Approved" ? "bg-success/15 text-success" : app.status === "Rejected" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>{app.status}</Badge>
              </div>
            ))}
            {applications.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">{t("dash.noAdmissionsYet")}</p>}
          </div>
        </SoftCard>

        <SoftCard title={t("dash.financialSummary")}>
          <div className="space-y-3">
            {[
              { label: t("dash.collected"), value: paidFees, color: "bg-success" },
              { label: t("dash.pending"), value: feeRecords.filter(f => f.status === "Unpaid").reduce((s, f) => s + f.amount, 0), color: "bg-warning" },
              { label: t("dash.overdue"), value: feeRecords.filter(f => f.status === "Overdue").reduce((s, f) => s + f.amount, 0), color: "bg-destructive" },
            ].map(row => {
              const pct = totalFees > 0 ? Math.round((row.value / totalFees) * 100) : 0;
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">{row.label}</span>
                    <span className="text-xs font-bold text-foreground">Rs.{row.value.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary/60 overflow-hidden"><div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div>
              <p className="text-[10px] text-muted-foreground font-medium">{t("dash.netBalance")}</p>
              <p className="text-lg font-bold text-success">+Rs.{(paidFees - pendingFeesCount * 0).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground font-medium">{t("dash.collectionRate")}</p>
              <p className="text-lg font-bold text-primary">{totalFees > 0 ? Math.round((paidFees / totalFees) * 100) : 0}%</p>
            </div>
          </div>
        </SoftCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KpiCard label={t("dash.library")} value={totalBooks} sub={`${totalIssues} ${t("dash.issued")}`} icon={Library} iconColor="text-info" href="/library" />
        <KpiCard label={t("dash.classesAndSections")} value={totalClasses} sub={`${totalSections} ${t("dash.sections")}`} icon={Building2} iconColor="text-primary" href="/classes" />
        <KpiCard label={t("dash.exams")} value={exams.length} sub={`${recentExams.length} ${t("dash.upcoming")}`} icon={FileText} iconColor="text-destructive" href="/exams" />
      </div>
    </div>
  );
}
