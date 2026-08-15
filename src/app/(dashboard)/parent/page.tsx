"use client";

import { useEffect, useState } from "react";
import { getParentPortalData, type ParentPortalData, type ParentPortalChild } from "@/app/actions/features";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarCheck, CreditCard, BarChart3, Megaphone, GraduationCap,
  CheckCircle2, XCircle, Clock, AlertCircle, KeyRound, Copy, Check,
  ChevronDown, ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/hooks/use-language";

// ── Copy Button ───────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="ml-2 p-1 rounded hover:bg-white/20 transition-colors" title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-300" /> : <Copy className="h-3.5 w-3.5 text-white/70" />}
    </button>
  );
}

// ── Child Selector ────────────────────────────────────────────────────────────

function ChildSelector({ kids, selectedIdx, onSelect }: {
  kids: ParentPortalChild[]; selectedIdx: number; onSelect: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = kids[selectedIdx];
  if (kids.length <= 1) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-3 bg-white border border-secondary rounded-xl px-4 py-2.5 shadow-sm hover:border-primary/40 transition-colors w-full sm:w-auto"
      >
        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-sm">
          {selected.name.charAt(0)}
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-primary">{selected.name}</p>
          <p className="text-xs text-muted-foreground">{selected.class} – Section {selected.section}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground ml-2 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-secondary rounded-xl shadow-lg overflow-hidden min-w-[220px]">
          {kids.map((child, i) => (
            <button
              key={child.id}
              onClick={() => { onSelect(i); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors text-left ${i === selectedIdx ? "bg-secondary/10" : ""}`}
            >
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-sm">
                {child.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">{child.name}</p>
                <p className="text-xs text-muted-foreground">{child.class} – {child.section}</p>
              </div>
              {i === selectedIdx && <Check className="h-4 w-4 text-primary ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ParentDashboard() {
  const { t } = useLanguage();
  const [data,         setData]         = useState<ParentPortalData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [selectedIdx,  setSelectedIdx]  = useState(0);

  useEffect(() => {
    getParentPortalData().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!data || data.children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="p-4 bg-purple-50 rounded-full">
          <GraduationCap className="h-10 w-10 text-purple-600" />
        </div>
        <h2 className="text-xl font-bold text-primary">{t("parent.noChildren")}</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          {t("parent.noChildrenHint")}
        </p>
      </div>
    );
  }

  const child = data.children[selectedIdx] ?? data.children[0];

  // Attendance for selected child
  const childAtt      = data.attendance.filter(a => a.studentId === child.id);
  const present       = childAtt.filter(a => a.status === "Present").length;
  const late          = childAtt.filter(a => a.status === "Late").length;
  const absent        = childAtt.filter(a => a.status === "Absent").length;
  const totalDays     = childAtt.length;
  const attPct        = totalDays > 0 ? Math.round(((present + late) / totalDays) * 100) : 0;

  // Fees for selected child
  const childFees     = data.feeRecords.filter(f => f.studentId === child.id);
  const unpaidFees    = childFees.filter(f => f.status === "Unpaid" || f.status === "Overdue");
  const unpaidAmt     = unpaidFees.reduce((s, f) => s + f.amount, 0);

  // Exams for selected child — build per-subject latest score
  const subjectResults: { subject: string; examName: string; score: number; date: string }[] = [];
  const seen = new Set<string>();
  [...data.exams].reverse().forEach(ex => {
    const result = ex.studentResults.find((r: any) => r.studentId === child.id);
    if (result && !seen.has(ex.subject)) {
      seen.add(ex.subject);
      subjectResults.push({ subject: ex.subject, examName: ex.examName, score: result.score, date: ex.date });
    }
  });
  const latestOverallScore = subjectResults.length > 0
    ? Math.round(subjectResults.reduce((s, r) => s + r.score, 0) / subjectResults.length)
    : null;

  const priorityColor: Record<string, string> = {
    urgent: "border-l-red-500", high: "border-l-orange-400", normal: "border-l-primary/30",
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header + Child Selector */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">{t("parent.portalTitle")}</h1>
          <p className="text-muted-foreground mt-1">{t("parent.welcomeMsg")}</p>
        </div>
        <ChildSelector kids={data.children} selectedIdx={selectedIdx} onSelect={setSelectedIdx} />
      </div>

      {/* Child Info Banner */}
      <Card className="border-none shadow-sm bg-gradient-to-r from-purple-600 to-purple-700 text-white">
        <CardContent className="p-6 flex items-center gap-5">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold shrink-0">
            {child.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-xs uppercase tracking-widest font-semibold">{t("parent.yourChild")}</p>
            <h2 className="text-xl font-bold">{child.name}</h2>
            <div className="flex flex-wrap gap-3 mt-1 text-white/80 text-xs font-medium">
              <span>{child.class} – Section {child.section}</span>
              <span>·</span>
              <span className="font-mono">{child.admissionNumber}</span>
            </div>
          </div>
          <Badge className={`text-xs px-3 py-1 shrink-0 ${child.status === "Active" ? "bg-green-400/20 text-green-100 border-green-300/30" : "bg-red-400/20 text-red-100"}`}>
            {child.status}
          </Badge>
        </CardContent>
      </Card>

      {/* Student Login Credentials */}
      {(child.email || child.studentPortalPassword) && (
        <Card className="border-none shadow-sm bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="h-4 w-4 text-indigo-200" />
              <p className="text-indigo-200 text-xs uppercase tracking-widest font-semibold">{t("parent.studentLogin")}</p>
            </div>
            <p className="text-white/70 text-xs mb-3">{t("parent.studentLoginHint")}</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white/10 rounded-lg px-4 py-2.5">
                <div>
                  <p className="text-white/60 text-[10px] uppercase tracking-wider font-semibold">{t("common.email")}</p>
                  <p className="text-white font-mono text-sm font-medium">{child.email}</p>
                </div>
                <CopyButton value={child.email} />
              </div>
              {child.studentPortalPassword && (
                <div className="flex items-center justify-between bg-white/10 rounded-lg px-4 py-2.5">
                  <div>
                    <p className="text-white/60 text-[10px] uppercase tracking-wider font-semibold">{t("parent.tempPassword")}</p>
                    <p className="text-white font-mono text-sm font-medium tracking-widest">{child.studentPortalPassword}</p>
                  </div>
                  <CopyButton value={child.studentPortalPassword} />
                </div>
              )}
            </div>
            <p className="text-indigo-300 text-[10px] mt-3">{t("parent.passwordChangeHint")}</p>
          </CardContent>
        </Card>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/parent/attendance">
          <Card className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-2.5 bg-blue-50 rounded-xl shrink-0">
                <CalendarCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-primary">{attPct}%</p>
                <p className="text-xs text-muted-foreground font-medium">{t("parent.attendance")}</p>
                <p className="text-[10px] text-muted-foreground">{present + late}/{totalDays} days</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/parent/results">
          <Card className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-2.5 bg-orange-50 rounded-xl shrink-0">
                <BarChart3 className="h-5 w-5 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-primary">
                  {latestOverallScore !== null ? `${latestOverallScore}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground font-medium">{t("parent.avgScore")}</p>
                <p className="text-[10px] text-muted-foreground">{data.exams.length} {t("parent.exams")}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/parent/fees">
          <Card className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-2.5 rounded-xl shrink-0 ${unpaidAmt > 0 ? "bg-red-50" : "bg-green-50"}`}>
                <CreditCard className={`h-5 w-5 ${unpaidAmt > 0 ? "text-red-600" : "text-green-600"}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-2xl font-bold ${unpaidAmt > 0 ? "text-red-600" : "text-green-600"}`}>
                  {unpaidAmt > 0 ? `$${unpaidAmt}` : t("parent.clear")}
                </p>
                <p className="text-xs text-muted-foreground font-medium">{t("parent.outstanding")}</p>
                <p className="text-[10px] text-muted-foreground">{unpaidFees.length} {t("parent.pending")}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 bg-purple-50 rounded-xl shrink-0">
              <Megaphone className="h-5 w-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-primary">{data.announcements.length}</p>
              <p className="text-xs text-muted-foreground font-medium">{t("parent.announcements")}</p>
              <p className="text-[10px] text-muted-foreground">{t("parent.recentNotices")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Three-column: Attendance | Academic Performance | Fee Summary */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Attendance Breakdown */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-blue-500" /> {t("parent.attendance")}
              </CardTitle>
              <Link href="/parent/attendance">
                <Button variant="ghost" size="sm" className="text-accent h-7 p-0 text-xs hover:bg-transparent">
                  {t("common.details")} <ArrowUpRight className="h-3 w-3 ml-0.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-4xl font-black text-primary">{attPct}%</p>
              <p className="text-xs text-muted-foreground mt-1">{totalDays} {t("parent.daysRecorded")}</p>
            </div>
            {totalDays > 0 && <Progress value={attPct} className="h-2" />}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-green-50 rounded-lg">
                <p className="text-lg font-bold text-green-700">{present}</p>
                <div className="flex items-center justify-center gap-1 text-green-600 font-medium">
                  <CheckCircle2 className="h-3 w-3" /> {t("common.present")}
                </div>
              </div>
              <div className="p-2 bg-red-50 rounded-lg">
                <p className="text-lg font-bold text-red-700">{absent}</p>
                <div className="flex items-center justify-center gap-1 text-red-600 font-medium">
                  <XCircle className="h-3 w-3" /> {t("common.absent")}
                </div>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <p className="text-lg font-bold text-amber-700">{late}</p>
                <div className="flex items-center justify-center gap-1 text-amber-600 font-medium">
                  <Clock className="h-3 w-3" /> {t("common.late")}
                </div>
              </div>
            </div>

            {/* Last 10 attendance tiles */}
            {childAtt.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2">{t("parent.recentDays")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {childAtt.slice(0, 10).map(a => (
                    <div key={a.id} title={`${a.date}: ${a.status}`}
                      className={`w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold border
                        ${a.status === "Present" ? "bg-green-50 border-green-200 text-green-700" :
                          a.status === "Absent"  ? "bg-red-50 border-red-200 text-red-700" :
                          a.status === "Late"    ? "bg-amber-50 border-amber-200 text-amber-700" :
                          "bg-gray-50 border-gray-200 text-gray-500"}`}>
                      {a.date.slice(8)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Academic Performance */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-orange-500" /> {t("parent.academicPerformance")}
              </CardTitle>
              <Link href="/parent/results">
                <Button variant="ghost" size="sm" className="text-accent h-7 p-0 text-xs hover:bg-transparent">
                  {t("parent.fullReport")} <ArrowUpRight className="h-3 w-3 ml-0.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {subjectResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {t("parent.noResults")}
              </div>
            ) : (
              <div className="divide-y">
                {subjectResults.slice(0, 5).map(r => (
                  <div key={r.subject} className="p-3.5 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary">{r.subject}</p>
                      <p className="text-xs text-muted-foreground">{r.examName} · {r.date}</p>
                      <div className="mt-1.5">
                        <Progress
                          value={r.score}
                          className={`h-1.5 ${r.score >= 75 ? "[&>div]:bg-green-500" : r.score >= 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"}`}
                        />
                      </div>
                    </div>
                    <div className={`text-xl font-black ml-4 shrink-0 ${r.score >= 75 ? "text-green-600" : r.score >= 50 ? "text-amber-600" : "text-red-600"}`}>
                      {r.score}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fee Summary */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-500" /> {t("parent.feeSummary")}
              </CardTitle>
              <Link href="/parent/fees">
                <Button variant="ghost" size="sm" className="text-accent h-7 p-0 text-xs hover:bg-transparent">
                  {t("parent.history")} <ArrowUpRight className="h-3 w-3 ml-0.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {childFees.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">{t("parent.noFeeRecords")}</div>
            ) : (
              <>
                {unpaidFees.length === 0 ? (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
                    <p className="text-xs font-semibold text-green-800">{t("parent.allFeesCleared")}</p>
                  </div>
                ) : (
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-orange-800">Rs. {unpaidAmt} {t("parent.outstandingVoucher")}</p>
                      <p className="text-[10px] text-orange-700">{unpaidFees.length} {t("parent.unpaidVouchers")}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {childFees.slice(0, 4).map(f => (
                    <div key={f.id} className="flex items-center justify-between p-2.5 bg-secondary/20 rounded-lg text-xs">
                      <div>
                        <p className="font-semibold text-primary">{f.feeType || "Fee"}{f.month ? ` · ${f.month}` : ""}</p>
                        <p className="text-muted-foreground">{t("parent.due")}: {f.dueDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">Rs. {f.amount}</p>
                        <Badge className={`text-[10px] border-none mt-0.5 ${
                          f.status === "Paid" ? "bg-green-100 text-green-800" :
                          f.status === "Overdue" ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"
                        }`}>{f.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Announcements */}
      {data.announcements.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-purple-500" /> {t("parent.announcements")}
              </CardTitle>
              <Link href="/announcements">
                <Button variant="ghost" size="sm" className="text-accent h-7 p-0 text-xs hover:bg-transparent">
                  {t("common.viewAll")} →
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.announcements.slice(0, 3).map(a => (
              <div key={a.id} className={`p-3 bg-secondary/20 rounded-lg border-l-4 ${priorityColor[a.priority] ?? "border-l-primary/30"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm text-primary">{a.title}</p>
                  {a.priority === "urgent" && <Badge className="bg-red-100 text-red-700 border-none text-[10px] shrink-0">{t("parent.urgent")}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{a.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{a.date}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/parent/attendance", icon: CalendarCheck, label: t("parent.quickActions.viewAttendance"), color: "hover:border-blue-300 hover:bg-blue-50" },
          { href: "/parent/results",   icon: BarChart3,     label: t("parent.quickActions.viewResults"),    color: "hover:border-orange-300 hover:bg-orange-50" },
          { href: "/parent/fees",      icon: CreditCard,    label: t("parent.quickActions.viewFees"),       color: "hover:border-red-300 hover:bg-red-50" },
          { href: "/announcements",    icon: Megaphone,     label: t("parent.announcements"),                color: "hover:border-purple-300 hover:bg-purple-50" },
        ].map(item => (
          <Link key={item.href} href={item.href}>
            <Card className={`border shadow-sm cursor-pointer transition-all duration-200 ${item.color}`}>
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <item.icon className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs font-semibold text-primary">{item.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
