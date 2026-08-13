"use client";

import { useState, useEffect, useMemo } from "react";
import { useAppState } from "@/lib/state-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings2, Sliders, BarChart3, FileText, GraduationCap,
  TrendingUp, CalendarCheck, Bell, Shield, Cpu, Search,
  ChevronRight, Check, X, Plus, Pencil, Trash2, Save, RotateCcw,
  Download, Upload, Copy, AlertTriangle, Clock, GripVertical,
  Moon, Sun, Palette, QrCode, Signature, Eye, Smartphone,
  Mail, MessageSquare, Globe, Zap, Percent,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";

const NAV_ITEMS = [
  { id: "general", icon: Settings2, label: "General" },
  { id: "grading", icon: GraduationCap, label: "Grading" },
  { id: "marks", icon: Sliders, label: "Marks" },
  { id: "results", icon: BarChart3, label: "Results" },
  { id: "report-card", icon: FileText, label: "Report Card" },
  { id: "promotion", icon: TrendingUp, label: "Promotion" },
  { id: "attendance", icon: CalendarCheck, label: "Attendance" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "security", icon: Shield, label: "Security" },
  { id: "advanced", icon: Cpu, label: "Advanced" },
];

const TIE_SUBJECTS = ["English", "Mathematics", "Science", "Urdu", "Islamiat"];

const GRADE_COLORS = ["#3B82F6", "#22C55E", "#EAB308", "#F97316", "#EF4444"];

const THEMES = [
  { id: "classic", label: "Classic", bg: "bg-white border-2 border-slate-200", text: "text-slate-800" },
  { id: "modern", label: "Modern", bg: "bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200", text: "text-indigo-900" },
  { id: "apple", label: "Apple", bg: "bg-zinc-50 border-2 border-zinc-200", text: "text-zinc-900" },
  { id: "cambridge", label: "Cambridge", bg: "bg-[#F5F0E8] border-2 border-[#D4C5A9]", text: "text-[#5C4A2A]" },
  { id: "minimal", label: "Minimal", bg: "bg-white border-2 border-slate-100", text: "text-slate-700" },
  { id: "dark", label: "Dark", bg: "bg-slate-900 border-2 border-slate-700", text: "text-white" },
];

const GRADE_SAMPLE = [
  { grade: "A+", min: 90, max: 100, color: "bg-blue-500" },
  { grade: "A", min: 80, max: 89, color: "bg-emerald-500" },
  { grade: "B", min: 70, max: 79, color: "bg-yellow-500" },
  { grade: "C", min: 60, max: 69, color: "bg-orange-500" },
  { grade: "D", min: 50, max: 59, color: "bg-red-500" },
  { grade: "F", min: 0, max: 49, color: "bg-red-700" },
];

function SectionCard({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`border border-slate-200/80 shadow-sm ${className || ""}`}>
      <div className="p-5 pb-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <CardContent className="p-5 pt-2">{children}</CardContent>
    </Card>
  );
}

function Pill({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${active ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
      {children}
    </button>
  );
}

function ToggleGroup({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(o => (
        <Pill key={o.value} active={value === o.value} onClick={() => onChange(o.value)}>{o.label}</Pill>
      ))}
    </div>
  );
}

function SettingRow({ label, tooltip, children }: { label: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {tooltip && (
          <TooltipProvider><Tooltip delayDuration={200}>
            <TooltipTrigger><div className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center cursor-help">?</div></TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">{tooltip}</TooltipContent>
          </Tooltip></TooltipProvider>
        )}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function ConfigScore({ items }: { items: { label: string; done: boolean }[] }) {
  const pct = Math.round((items.filter(i => i.done).length / items.length) * 100);
  return (
    <Card className="border-green-200/60 bg-gradient-to-br from-green-50 to-emerald-50/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Configuration Score</span>
          <span className="text-2xl font-bold text-green-600">{pct}%</span>
        </div>
        <div className="h-2 bg-green-200/60 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 space-y-1">
          {items.map(i => (
            <div key={i.label} className="flex items-center gap-2 text-xs">
              {i.done ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-slate-300" />}
              <span className={i.done ? "text-green-700" : "text-slate-400"}>{i.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GradeCard({ grade, min, max, color, onEdit, onDelete }: { grade: string; min: number; max: number; color: string; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="relative group rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center text-white font-bold text-sm mb-2`}>{grade}</div>
      <div className="text-xs text-slate-500">{min}% — {max}%</div>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1 rounded-md hover:bg-slate-100 text-slate-400"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} className="p-1 rounded-md hover:bg-red-50 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

function ThemeCard({ theme, active, onClick }: { theme: typeof THEMES[0]; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative rounded-2xl p-4 ${theme.bg} ${theme.text} min-w-[120px] text-left transition-all ${active ? "ring-2 ring-indigo-500 ring-offset-2" : "hover:ring-1 hover:ring-slate-300"}`}>
      {active && <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center"><Check className="h-3 w-3 text-white" /></div>}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-current opacity-20" />
        <div className="w-16 h-2 rounded-full bg-current opacity-10" />
      </div>
      <div className="space-y-1.5 mb-3">
        <div className="w-full h-1.5 rounded-full bg-current opacity-10" />
        <div className="w-3/4 h-1.5 rounded-full bg-current opacity-10" />
        <div className="w-1/2 h-1.5 rounded-full bg-current opacity-10" />
      </div>
      <div className="flex gap-1">
        <div className="w-2 h-2 rounded-full bg-current opacity-20" />
        <div className="w-2 h-2 rounded-full bg-current opacity-10" />
        <div className="w-2 h-2 rounded-full bg-current opacity-10" />
      </div>
      <span className="text-xs font-medium mt-2 block">{theme.label}</span>
    </button>
  );
}

function NotificationRow({ label, icon: Icon, checked, onChange }: { label: string; icon: any; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" />
        <span className="text-sm text-slate-700">{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function ExamSettingsPage() {
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();
  const { schoolInfo } = useAppState();
  const [activeNav, setActiveNav] = useState("general");
  const [searchQuery, setSearchQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    academicYear: schoolInfo.academicYear || "2026-2027",
    defaultExam: "Monthly Test",
    multipleExams: true,
    parallelExams: true,
    passingPercentage: 40,
    marksFormat: "decimal" as "decimal" | "whole",
    timezone: "Asia/Karachi",

    maxMarks: 100,
    passingMarks: 40,
    autoCalcPercentage: true,
    roundPercentage: "nearest",
    allowDecimalMarks: false,
    graceMarks: false,
    maxGraceMarks: 5,
    internalWeight: { assignments: 20, attendance: 10, exam: 70 },

    rankingMethod: "total" as "total" | "gpa" | "percentage",
    tieSubjects: ["English", "Mathematics", "Science"],
    generatePosition: true,
    showRankOnCard: true,
    hideFailed: false,
    autoPublish: "approval" as "immediate" | "approval" | "manual",

    reportTheme: "modern",
    visibleSections: ["attendance", "remarks", "ranking", "gpa"] as string[],
    principalSign: true,
    teacherSign: true,
    controllerSign: false,
    qrVerify: true,

    promotionRule: "all" as "all" | "gpa",
    minGpa: 2.5,
    maxFailed: 1,
    autoPromote: false,
    repeatAuto: false,

    attendanceWeight: 10,
    minAttendance: 75,
    blockResult: true,

    editMarksRole: "admin" as "admin" | "teacher" | "coordinator",
    requireApproval: true,
    auditLogs: true,
    lockAfterPublish: true,
  });

  const [grades, setGrades] = useState(GRADE_SAMPLE);
  const [previewMarks, setPreviewMarks] = useState("92");
  const [notifications, setNotifications] = useState({
    parentResult: true,
    teacherMarks: true,
    studentSchedule: true,
    portal: true,
    email: false,
    sms: false,
    whatsapp: false,
  });

  const set = (k: string, v: any) => { setSettings(prev => ({ ...prev, [k]: v })); setDirty(true); };

  const configItems = useMemo(() => [
    { label: "Grades Configured", done: grades.length >= 4 },
    { label: "Passing % Set", done: settings.passingPercentage > 0 },
    { label: "Marks Format Set", done: true },
    { label: "Ranking Method Set", done: true },
    { label: "Report Card Theme", done: true },
    { label: "Promotion Enabled", done: settings.promotionRule === "all" || settings.minGpa > 0 },
  ], [grades.length, settings.passingPercentage, settings.promotionRule, settings.minGpa]);

  const filteredNav = searchQuery
    ? NAV_ITEMS.filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : NAV_ITEMS;

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    setDirty(false);
    toast({ title: "Settings saved successfully", description: "Examination configuration has been updated." });
  };

  const handleReset = () => {
    setDirty(false);
    toast({ title: "Changes discarded" });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ settings, grades, notifications }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "exam-settings.json"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Configuration exported" });
  };

  const gradePreview = useMemo(() => {
    const m = parseFloat(previewMarks);
    if (isNaN(m)) return null;
    const found = [...grades].sort((a, b) => b.min - a.min).find(g => m >= g.min && m <= g.max);
    return found || null;
  }, [previewMarks, grades]);

  const toggleSection = (s: string) => {
    setSettings(prev => ({
      ...prev,
      visibleSections: prev.visibleSections.includes(s)
        ? prev.visibleSections.filter(x => x !== s)
        : [...prev.visibleSections, s],
    }));
    setDirty(true);
  };

  const displayTab = searchQuery && filteredNav.length > 0 ? filteredNav[0].id : activeNav;

  if (!permsLoaded) return null;
  if (!can("exams.settings")) return <Unauthorized />;

  return (
    <div className="flex gap-6">
      {/* Left Sidebar */}
      <aside className="hidden lg:flex flex-col w-52 shrink-0 gap-1 pt-2">
        <div className="mb-4 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search settings..."
            className="pl-8 h-9 text-sm rounded-xl bg-slate-100 border-0 focus:bg-white transition"
          />
        </div>
        {filteredNav.map(item => {
          const Icon = item.icon;
          const isActive = item.id === activeNav;
          return (
            <button key={item.id} onClick={() => { setActiveNav(item.id); setSearchQuery(""); }}
              className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
              <Icon className={`h-4 w-4 ${isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-500"}`} />
              <span>{item.label}</span>
              {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto text-indigo-400" />}
            </button>
          );
        })}
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <button onClick={() => setSearchQuery("")} className="hover:text-slate-600 transition">Examination</button>
              <ChevronRight className="h-3 w-3" />
              <span className="text-slate-700 font-medium">Settings</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-3">
              <Settings2 className="h-6 w-6 text-indigo-500" />
              Examination Settings
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Configure grading, marks, results, report cards and promotion rules</p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <div className="text-right text-xs text-slate-400">
              <p className="font-medium text-slate-500">Last Updated</p>
              <p>Today 2:14 PM</p>
            </div>
          </div>
        </div>

        {/* Mobile Search + Tabs */}
        <div className="lg:hidden">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search settings..." className="pl-9 h-10 rounded-xl bg-slate-100 border-0" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = item.id === activeNav;
              return (
                <button key={item.id} onClick={() => setActiveNav(item.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${isActive ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Panels */}
        <AnimatePresence mode="wait">
          <motion.div key={activeNav} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-5">

            {/* ── GENERAL ── */}
            {displayTab === "general" && (
              <>
                <SectionCard title="Academic Session" description="Select the current academic year and default exam type">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-500 font-medium">Academic Year</Label>
                      <select value={settings.academicYear} onChange={e => set("academicYear", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-400 focus:border-transparent">
                        {["2024-2025", "2025-2026", "2026-2027", "2027-2028"].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 font-medium">Default Exam</Label>
                      <select value={settings.defaultExam} onChange={e => set("defaultExam", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-400 focus:border-transparent">
                        {["Monthly Test", "Mid Term", "Final", "Quiz", "Weekly Test"].map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Exam Mode">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm font-medium text-slate-700">Enable Multiple Exams</p><p className="text-xs text-slate-400">Allow scheduling multiple exams simultaneously</p></div>
                      <Switch checked={settings.multipleExams} onCheckedChange={(v: boolean) => set("multipleExams", v)} />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm font-medium text-slate-700">Allow Parallel Exams</p><p className="text-xs text-slate-400">Students can take exams in parallel sessions</p></div>
                      <Switch checked={settings.parallelExams} onCheckedChange={(v: boolean) => set("parallelExams", v)} />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Passing Criteria">
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-slate-500 font-medium">Default Passing Percentage</Label>
                        <span className="text-lg font-semibold text-indigo-600">{settings.passingPercentage}%</span>
                      </div>
                      <Slider value={[settings.passingPercentage]} onValueChange={([v]: number[]) => set("passingPercentage", v)} min={0} max={100} step={1} />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>0%</span><span>100%</span></div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm font-medium text-slate-700">Marks Format</p></div>
                      <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                        <button onClick={() => set("marksFormat", "decimal")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${settings.marksFormat === "decimal" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>Decimal</button>
                        <button onClick={() => set("marksFormat", "whole")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${settings.marksFormat === "whole" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>Whole Numbers</button>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm font-medium text-slate-700">Time Zone</p><p className="text-xs text-slate-400">Auto-detected</p></div>
                      <Badge className="bg-slate-100 text-slate-600 border-0">{settings.timezone}</Badge>
                    </div>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── GRADING ── */}
            {displayTab === "grading" && (
              <>
                <SectionCard title="Grade Scale" description="Define grade boundaries for the academic year">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {grades.map((g, i) => (
                      <GradeCard key={g.grade} grade={g.grade} min={g.min} max={g.max} color={g.color} />
                    ))}
                    <button className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-indigo-300 hover:bg-indigo-50/50 transition group">
                      <Plus className="h-6 w-6 group-hover:text-indigo-500" />
                      <span className="text-xs font-medium group-hover:text-indigo-500">Add Grade</span>
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="Grade Preview" description="Type a marks value to see the corresponding grade in real-time">
                  <div className="flex items-end gap-6">
                    <div className="flex-1 max-w-[160px]">
                      <Label className="text-xs text-slate-500 font-medium mb-1.5 block">Marks</Label>
                      <Input value={previewMarks} onChange={e => setPreviewMarks(e.target.value)} type="number" className="text-center text-lg h-12 rounded-xl" />
                    </div>
                    <div className="flex items-center gap-3 pb-1">
                      <ChevronRight className="h-5 w-5 text-slate-300" />
                      <div className={`text-center px-5 py-2 rounded-xl text-lg font-bold ${gradePreview ? "bg-indigo-50 text-indigo-700" : "bg-slate-50 text-slate-400"}`}>
                        {gradePreview ? gradePreview.grade : "—"}
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="GPA Scale">
                  <div className="flex gap-3">
                    {[
                      { label: "4.0", sub: "Standard" },
                      { label: "5.0", sub: "Weighted" },
                      { label: "10", sub: "European" },
                      { label: "Custom", sub: "Define" },
                    ].map(gpa => (
                      <button key={gpa.label}
                        className="flex-1 rounded-xl border border-slate-200 bg-white p-3 text-center hover:border-indigo-300 hover:shadow-sm transition">
                        <p className="text-lg font-bold text-slate-800">{gpa.label}</p>
                        <p className="text-[11px] text-slate-400">{gpa.sub}</p>
                      </button>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Grade Colors">
                  <div className="flex gap-3 flex-wrap">
                    {grades.map((g, i) => (
                      <div key={g.grade} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: GRADE_COLORS[i % GRADE_COLORS.length] }} />
                        <span className="text-sm font-medium text-slate-700">{g.grade}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── MARKS ── */}
            {displayTab === "marks" && (
              <>
                <SectionCard title="Marks Configuration">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-500 font-medium mb-1.5 block">Maximum Marks</Label>
                      <div className="relative">
                        <Input type="number" value={settings.maxMarks} onChange={e => set("maxMarks", parseInt(e.target.value) || 0)} className="pr-8 rounded-xl" />
                        <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 font-medium mb-1.5 block">Passing Marks</Label>
                      <Input type="number" value={settings.passingMarks} onChange={e => set("passingMarks", parseInt(e.target.value) || 0)} className="rounded-xl" />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Calculation">
                  <SettingRow label="Auto Calculate Percentage" tooltip="Automatically calculate percentage from obtained marks">
                    <Switch checked={settings.autoCalcPercentage} onCheckedChange={(v: boolean) => set("autoCalcPercentage", v)} />
                  </SettingRow>
                  <Separator />
                  <SettingRow label="Round Percentage" tooltip="How percentage values are rounded">
                    <select value={settings.roundPercentage} onChange={e => set("roundPercentage", e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700">
                      <option value="nearest">Nearest Integer</option>
                      <option value="up">Round Up</option>
                      <option value="down">Round Down</option>
                      <option value="none">No Rounding</option>
                    </select>
                  </SettingRow>
                  <Separator />
                  <SettingRow label="Allow Decimal Marks" tooltip="Allow fractional marks in exam entries">
                    <Switch checked={settings.allowDecimalMarks} onCheckedChange={(v: boolean) => set("allowDecimalMarks", v)} />
                  </SettingRow>
                  <Separator />
                  <SettingRow label="Grace Marks" tooltip="Allow extra marks for borderline cases">
                    <Switch checked={settings.graceMarks} onCheckedChange={(v: boolean) => set("graceMarks", v)} />
                  </SettingRow>
                  {settings.graceMarks && (
                    <div className="mt-2 pl-4">
                      <Label className="text-xs text-slate-500 font-medium">Maximum Grace Marks</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Slider value={[settings.maxGraceMarks]} onValueChange={([v]: number[]) => set("maxGraceMarks", v)} min={0} max={20} step={1} className="flex-1" />
                        <span className="text-sm font-semibold text-indigo-600 w-8">{settings.maxGraceMarks}</span>
                      </div>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Internal Assessment Weight" description="Distribution of marks across assessment categories">
                  <div className="space-y-3">
                    {[
                      { key: "assignments", label: "Assignments", color: "bg-blue-500" },
                      { key: "attendance", label: "Attendance", color: "bg-green-500" },
                      { key: "exam", label: "Exam", color: "bg-indigo-500" },
                    ].map(({ key, label: lbl, color }) => (
                      <div key={key}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-700">{lbl}</span>
                          <span className="font-semibold text-slate-800">{(settings.internalWeight as any)[key]}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${(settings.internalWeight as any)[key]}%` }} />
                        </div>
                        <input type="range" min={0} max={100} value={(settings.internalWeight as any)[key]}
                          onChange={e => set("internalWeight", { ...settings.internalWeight, [key]: parseInt(e.target.value) })}
                          className="w-full mt-1 accent-indigo-600" />
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── RESULTS ── */}
            {displayTab === "results" && (
              <>
                <SectionCard title="Ranking">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-slate-500 font-medium mb-2 block">Ranking Method</Label>
                      <ToggleGroup
                        options={[
                          { label: "Total Marks", value: "total" },
                          { label: "GPA", value: "gpa" },
                          { label: "Percentage", value: "percentage" },
                        ]}
                        value={settings.rankingMethod} onChange={v => set("rankingMethod", v)} />
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-xs text-slate-500 font-medium mb-2 block">Tie Break Priority (drag to reorder)</Label>
                      <div className="space-y-1 max-w-md">
                        {settings.tieSubjects.map((s, i) => (
                          <div key={s} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700">
                            <GripVertical className="h-4 w-4 text-slate-300" />
                            <span className="flex-1">{s}</span>
                            <Badge className="bg-slate-100 text-slate-500 border-0">{i + 1}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <SettingRow label="Generate Student Position" tooltip="Calculate and store rank for each student">
                      <Switch checked={settings.generatePosition} onCheckedChange={(v: boolean) => set("generatePosition", v)} />
                    </SettingRow>
                    <Separator />
                    <SettingRow label="Show Rank on Report Card">
                      <Switch checked={settings.showRankOnCard} onCheckedChange={(v: boolean) => set("showRankOnCard", v)} />
                    </SettingRow>
                    <Separator />
                    <SettingRow label="Hide Failed Students from Ranking">
                      <Switch checked={settings.hideFailed} onCheckedChange={(v: boolean) => set("hideFailed", v)} />
                    </SettingRow>
                  </div>
                </SectionCard>

                <SectionCard title="Publishing">
                  <div>
                    <Label className="text-xs text-slate-500 font-medium mb-2 block">Auto Publish Result</Label>
                    <div className="grid grid-cols-3 gap-2 max-w-md">
                      {[
                        { value: "immediate", label: "Immediate", desc: "Publish right away" },
                        { value: "approval", label: "After Approval", desc: "Requires sign-off" },
                        { value: "manual", label: "Manual", desc: "Publish manually" },
                      ].map(opt => (
                        <button key={opt.value} onClick={() => set("autoPublish", opt.value)}
                          className={`rounded-xl border p-3 text-left transition ${settings.autoPublish === opt.value ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                          <p className="text-sm font-semibold">{opt.label}</p>
                          <p className="text-[11px] text-current opacity-60 mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── REPORT CARD ── */}
            {displayTab === "report-card" && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                <div className="lg:col-span-3 space-y-5">
                  <SectionCard title="Report Card Theme">
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {THEMES.map(t => (
                        <ThemeCard key={t.id} theme={t} active={settings.reportTheme === t.id} onClick={() => set("reportTheme", t.id)} />
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Visible Sections" description="Choose what appears on the report card">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "attendance", label: "Attendance" },
                        { key: "remarks", label: "Remarks" },
                        { key: "ranking", label: "Ranking" },
                        { key: "gpa", label: "GPA" },
                        { key: "qr", label: "QR Code" },
                        { key: "signatures", label: "Signatures" },
                        { key: "parent", label: "Parent Remarks" },
                      ].map(s => (
                        <button key={s.key} onClick={() => toggleSection(s.key)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition ${settings.visibleSections.includes(s.key) ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${settings.visibleSections.includes(s.key) ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
                            {settings.visibleSections.includes(s.key) && <Check className="h-3 w-3 text-white" />}
                          </div>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Signatures">
                    <div className="space-y-3">
                      <SettingRow label="Principal Signature">
                        <Switch checked={settings.principalSign} onCheckedChange={(v: boolean) => set("principalSign", v)} />
                      </SettingRow>
                      <SettingRow label="Class Teacher Signature">
                        <Switch checked={settings.teacherSign} onCheckedChange={(v: boolean) => set("teacherSign", v)} />
                      </SettingRow>
                      <SettingRow label="Controller Signature">
                        <Switch checked={settings.controllerSign} onCheckedChange={(v: boolean) => set("controllerSign", v)} />
                      </SettingRow>
                    </div>
                  </SectionCard>

                  <SectionCard title="QR Code Verification">
                    <SettingRow label="Enable QR Verification" tooltip="Parents can scan QR to verify report card authenticity">
                      <Switch checked={settings.qrVerify} onCheckedChange={(v: boolean) => set("qrVerify", v)} />
                    </SettingRow>
                  </SectionCard>
                </div>

                {/* Live Preview */}
                <div className="lg:col-span-2">
                  <div className="sticky top-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Live Preview</p>
                    <div className={`rounded-2xl p-5 border ${THEMES.find(t => t.id === settings.reportTheme)?.bg || "bg-white border-slate-200"}`}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center"><GraduationCap className="h-4 w-4 text-indigo-600" /></div>
                        <div>
                          <p className="text-xs font-bold">SCHOOL NAME</p>
                          <p className="text-[10px] opacity-60">Report Card — 2026</p>
                        </div>
                      </div>
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between text-xs"><span>Student Name</span><span className="font-medium">John Doe</span></div>
                        <div className="flex justify-between text-xs"><span>Class</span><span className="font-medium">Grade 10-A</span></div>
                      </div>
                      <Separator className="my-2" />
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span>English</span><span className="font-medium">85%</span></div>
                        <div className="flex justify-between"><span>Mathematics</span><span className="font-medium">92%</span></div>
                        <div className="flex justify-between"><span>Science</span><span className="font-medium">78%</span></div>
                      </div>
                      {settings.visibleSections.includes("attendance") && (
                        <><Separator className="my-2" /><div className="flex justify-between text-xs"><span>Attendance</span><span className="font-medium text-green-600">95%</span></div></>
                      )}
                      {settings.visibleSections.includes("gpa") && (
                        <><Separator className="my-2" /><div className="flex justify-between text-xs"><span>GPA</span><span className="font-medium text-indigo-600">3.8</span></div></>
                      )}
                      {settings.visibleSections.includes("ranking") && (
                        <><Separator className="my-2" /><div className="flex justify-between text-xs"><span>Rank</span><span className="font-medium">3 / 42</span></div></>
                      )}
                      {settings.visibleSections.includes("qr") && (
                        <div className="mt-3 flex justify-center">
                          <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 flex items-center justify-center"><QrCode className="h-6 w-6 text-slate-400" /></div>
                        </div>
                      )}
                      {settings.visibleSections.includes("signatures") && (
                        <div className="mt-3 flex justify-between text-[10px] text-slate-400">
                          {settings.principalSign && <span>________________<br/>Principal</span>}
                          {settings.teacherSign && <span>________________<br/>Teacher</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── PROMOTION ── */}
            {displayTab === "promotion" && (
              <>
                <SectionCard title="Promotion Rules">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-slate-500 font-medium mb-2 block">Promotion Criteria</Label>
                      <div className="flex gap-2 max-w-md">
                        {[
                          { value: "all", label: "Pass All Subjects" },
                          { value: "gpa", label: "Minimum GPA" },
                        ].map(opt => (
                          <button key={opt.value} onClick={() => set("promotionRule", opt.value as any)}
                            className={`flex-1 rounded-xl border p-3 text-center text-sm font-medium transition ${settings.promotionRule === opt.value ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-600"}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {settings.promotionRule === "gpa" && (
                      <div>
                        <Label className="text-xs text-slate-500 font-medium mb-1.5 block">Minimum GPA</Label>
                        <div className="flex items-center gap-3 max-w-xs">
                          <Slider value={[settings.minGpa * 10]} onValueChange={([v]: number[]) => set("minGpa", v / 10)} min={0} max={50} step={1} />
                          <span className="text-lg font-bold text-indigo-600 w-10">{settings.minGpa.toFixed(1)}</span>
                        </div>
                      </div>
                    )}
                    <Separator />
                    <div>
                      <Label className="text-xs text-slate-500 font-medium mb-1.5 block">Maximum Failed Subjects Allowed</Label>
                      <div className="flex gap-2">
                        {[0, 1, 2, 3].map(n => (
                          <button key={n} onClick={() => set("maxFailed", n)}
                            className={`w-10 h-10 rounded-xl border text-sm font-bold transition ${settings.maxFailed === n ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-500"}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Automation">
                  <SettingRow label="Auto Promote" tooltip="Automatically promote students who meet the criteria">
                    <Switch checked={settings.autoPromote} onCheckedChange={(v: boolean) => set("autoPromote", v)} />
                  </SettingRow>
                  <Separator />
                  <SettingRow label="Repeat Class Automatically" tooltip="Automatically enroll failing students in the same class">
                    <Switch checked={settings.repeatAuto} onCheckedChange={(v: boolean) => set("repeatAuto", v)} />
                  </SettingRow>
                </SectionCard>
              </>
            )}

            {/* ── ATTENDANCE ── */}
            {displayTab === "attendance" && (
              <>
                <SectionCard title="Attendance Weight" description="How much attendance contributes to overall assessment">
                  <div className="flex gap-3">
                    {[0, 5, 10, 20].map(w => (
                      <button key={w} onClick={() => set("attendanceWeight", w)}
                        className={`flex-1 rounded-xl border p-4 text-center transition ${settings.attendanceWeight === w ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200 hover:border-slate-300"}`}>
                        <p className={`text-xl font-bold ${settings.attendanceWeight === w ? "text-indigo-600" : "text-slate-700"}`}>{w}%</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Weight</p>
                      </button>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Minimum Attendance Requirements">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-slate-500 font-medium">Minimum Attendance %</Label>
                        <span className="text-lg font-semibold text-indigo-600">{settings.minAttendance}%</span>
                      </div>
                      <Slider value={[settings.minAttendance]} onValueChange={([v]: number[]) => set("minAttendance", v)} min={0} max={100} step={1} />
                    </div>
                    <Separator />
                    <SettingRow label="Block Result Below Minimum" tooltip="Prevent result generation for students below minimum attendance">
                      <Switch checked={settings.blockResult} onCheckedChange={(v: boolean) => set("blockResult", v)} />
                    </SettingRow>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── NOTIFICATIONS ── */}
            {displayTab === "notifications" && (
              <>
                <SectionCard title="Notification Preferences" description="Who gets notified and how">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recipients</p>
                    <NotificationRow label="Result Published — Parents" icon={GraduationCap} checked={notifications.parentResult} onChange={v => setNotifications(p => ({ ...p, parentResult: v }))} />
                    <NotificationRow label="Marks Pending — Teachers" icon={Bell} checked={notifications.teacherMarks} onChange={v => setNotifications(p => ({ ...p, teacherMarks: v }))} />
                    <NotificationRow label="Exam Schedule — Students" icon={CalendarCheck} checked={notifications.studentSchedule} onChange={v => setNotifications(p => ({ ...p, studentSchedule: v }))} />
                  </div>
                  <Separator className="my-3" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Delivery Channels</p>
                    <NotificationRow label="Portal" icon={Globe} checked={notifications.portal} onChange={v => setNotifications(p => ({ ...p, portal: v }))} />
                    <NotificationRow label="Email" icon={Mail} checked={notifications.email} onChange={v => setNotifications(p => ({ ...p, email: v }))} />
                    <NotificationRow label="SMS" icon={MessageSquare} checked={notifications.sms} onChange={v => setNotifications(p => ({ ...p, sms: v }))} />
                    <NotificationRow label="WhatsApp" icon={Smartphone} checked={notifications.whatsapp} onChange={v => setNotifications(p => ({ ...p, whatsapp: v }))} />
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── SECURITY ── */}
            {displayTab === "security" && (
              <>
                <SectionCard title="Access Control">
                  <SettingRow label="Edit Marks After Submission" tooltip="Who can modify marks once submitted">
                    <select value={settings.editMarksRole} onChange={e => set("editMarksRole", e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700">
                      <option value="admin">Admin Only</option>
                      <option value="coordinator">Coordinator + Admin</option>
                      <option value="teacher">Teacher + Above</option>
                    </select>
                  </SettingRow>
                  <Separator />
                  <SettingRow label="Require Approval Workflow" tooltip="Marks require approval before finalization">
                    <Switch checked={settings.requireApproval} onCheckedChange={(v: boolean) => set("requireApproval", v)} />
                  </SettingRow>
                  {settings.requireApproval && (
                    <div className="mt-3 pl-4 flex items-center gap-3 text-xs text-slate-500">
                      <span className="px-2 py-1 rounded bg-slate-100 font-medium text-slate-700">Teacher</span>
                      <ChevronRight className="h-3 w-3" />
                      <span className="px-2 py-1 rounded bg-slate-100 font-medium text-slate-700">Coordinator</span>
                      <ChevronRight className="h-3 w-3" />
                      <span className="px-2 py-1 rounded bg-indigo-100 font-medium text-indigo-700">Principal</span>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Audit & Locking">
                  <SettingRow label="Audit Logs" tooltip="Track all changes to marks and results">
                    <Switch checked={settings.auditLogs} onCheckedChange={(v: boolean) => set("auditLogs", v)} />
                  </SettingRow>
                  <Separator />
                  <SettingRow label="Lock Marks Automatically" tooltip="Prevent changes after results are published">
                    <Switch checked={settings.lockAfterPublish} onCheckedChange={(v: boolean) => set("lockAfterPublish", v)} />
                  </SettingRow>
                </SectionCard>
              </>
            )}

            {/* ── ADVANCED ── */}
            {displayTab === "advanced" && (
              <>
                <SectionCard title="Data Management">
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={handleExport} className="rounded-xl"><Download className="h-4 w-4 mr-1.5" /> Export Configuration</Button>
                    <Button variant="outline" className="rounded-xl"><Upload className="h-4 w-4 mr-1.5" /> Import JSON</Button>
                    <Button variant="outline" className="rounded-xl"><Copy className="h-4 w-4 mr-1.5" /> Clone from 2025-2026</Button>
                  </div>
                </SectionCard>

                <SectionCard title="Danger Zone" className="border-red-200 bg-red-50/30">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-red-100">
                      <div className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-red-400" />
                        <div><p className="text-sm font-medium text-slate-700">Delete All Exam Records</p><p className="text-xs text-slate-400">Permanently remove all exams and marks</p></div>
                      </div>
                      <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 rounded-xl">Delete All</Button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-red-100">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        <div><p className="text-sm font-medium text-slate-700">Archive Current Session</p><p className="text-xs text-slate-400">Archive exams, marks and results for record keeping</p></div>
                      </div>
                      <Button size="sm" variant="outline" className="rounded-xl">Archive</Button>
                    </div>
                  </div>
                </SectionCard>
              </>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Right Sidebar — Config Score */}
        <div className="lg:hidden">
          <ConfigScore items={configItems} />
        </div>
      </div>

      {/* Right Sidebar Desktop */}
      <aside className="hidden xl:flex flex-col w-56 shrink-0 gap-4 pt-2">
        <ConfigScore items={configItems} />
        <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50/30">
          <CardContent className="p-4">
            <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Tips</h4>
            <div className="space-y-1.5">
              {[
                "Set grade boundaries carefully",
                "Enable audit logs for compliance",
                "Configure report card theme first",
              ].map(tip => (
                <div key={tip} className="flex items-start gap-1.5 text-xs text-amber-800">
                  <Zap className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </aside>

      {/* Sticky Save Bar */}
      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/80 backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-sm font-medium text-slate-700">Unsaved Changes</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleReset} className="rounded-xl text-slate-500"><RotateCcw className="h-4 w-4 mr-1.5" /> Discard</Button>
                <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200">
                  {saving ? <><Clock className="h-4 w-4 mr-1.5 animate-spin" /> Saving...</> : <><Save className="h-4 w-4 mr-1.5" /> Save Changes</>}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
