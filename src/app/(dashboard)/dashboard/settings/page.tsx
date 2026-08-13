"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Settings2, Search, ChevronRight, Check, X, Save, RotateCcw,
  LayoutDashboard, LayoutGrid, Palette, BarChart3, Bell, Zap, Cpu,
  Sun, Moon, Monitor, GripVertical, Pin,
  Plus, Star, Download, Upload, Hash, Clock, Sparkles,
  Users, Wallet, CalendarCheck, BookOpen, Calendar,
  Activity, UserPlus, LogOut, ShoppingCart, Megaphone,
  RefreshCw, Volume2, Columns3, Columns4,
  PanelLeft, PanelRight, PanelTop,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const NAV_ITEMS = [
  { id: "general", icon: Settings2, label: "General" },
  { id: "widgets", icon: LayoutGrid, label: "Widgets" },
  { id: "layout", icon: LayoutDashboard, label: "Layout" },
  { id: "appearance", icon: Palette, label: "Appearance" },
  { id: "cards", icon: Sparkles, label: "Cards" },
  { id: "charts", icon: BarChart3, label: "Charts" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "shortcuts", icon: Zap, label: "Quick Actions" },
  { id: "advanced", icon: Cpu, label: "Advanced" },
];

const ACCENTS = [
  { id: "blue", color: "#2563EB", label: "Blue" },
  { id: "green", color: "#22C55E", label: "Green" },
  { id: "purple", color: "#8B5CF6", label: "Purple" },
  { id: "orange", color: "#F97316", label: "Orange" },
  { id: "red", color: "#EF4444", label: "Red" },
  { id: "slate", color: "#475569", label: "Slate" },
];

const FONTS = [
  { id: "inter", label: "Inter", stack: "'Inter', sans-serif" },
  { id: "sf", label: "SF Pro", stack: "'SF Pro Display', -apple-system, sans-serif" },
  { id: "poppins", label: "Poppins", stack: "'Poppins', sans-serif" },
  { id: "manrope", label: "Manrope", stack: "'Manrope', sans-serif" },
];

const THEMES = [
  { id: "light", icon: Sun, label: "Light" },
  { id: "dark", icon: Moon, label: "Dark" },
  { id: "system", icon: Monitor, label: "System" },
];

const PRESETS = [
  { id: "minimal", label: "Minimal", desc: "Clean & simple", icon: "◻️" },
  { id: "executive", label: "Executive", desc: "Data-first view", icon: "📊" },
  { id: "school", label: "School", desc: "Balanced overview", icon: "🏫" },
  { id: "finance", label: "Finance", desc: "Financial focus", icon: "💰" },
  { id: "teacher", label: "Teacher", desc: "Classroom view", icon: "👨‍🏫" },
  { id: "principal", label: "Principal", desc: "Full oversight", icon: "🎓" },
];

const ALL_WIDGETS = [
  { id: "stats", label: "Student Statistics", icon: Users, color: "bg-blue-500" },
  { id: "revenue", label: "Revenue", icon: Wallet, color: "bg-green-500" },
  { id: "attendance", label: "Attendance", icon: CalendarCheck, color: "bg-indigo-500" },
  { id: "classes", label: "Today's Classes", icon: BookOpen, color: "bg-purple-500" },
  { id: "exams", label: "Upcoming Exams", icon: Calendar, color: "bg-orange-500" },
  { id: "activities", label: "Recent Activities", icon: Activity, color: "bg-rose-500" },
  { id: "calendar", label: "Calendar", icon: CalendarCheck, color: "bg-teal-500" },
  { id: "payroll", label: "Payroll Summary", icon: Wallet, color: "bg-emerald-500" },
  { id: "inventory", label: "Inventory", icon: ShoppingCart, color: "bg-cyan-500" },
];

const WIDGET_SIZES = ["small", "medium", "large", "full"] as const;

const CARD_STYLES = [
  { id: "flat", label: "Flat", preview: "bg-white border" },
  { id: "glass", label: "Glass", preview: "bg-white/70 backdrop-blur border border-white/20" },
  { id: "elevated", label: "Elevated", preview: "bg-white shadow-lg border-0" },
  { id: "minimal", label: "Minimal", preview: "bg-transparent border-0" },
  { id: "apple", label: "Apple Style", preview: "bg-white rounded-2xl shadow-sm border-0" },
];

const KPI_STYLES = [
  { id: "minimal", label: "Minimal", color: "bg-slate-50" },
  { id: "premium", label: "Premium", color: "bg-gradient-to-br from-indigo-50 to-blue-50" },
  { id: "financial", label: "Financial", color: "bg-gradient-to-br from-green-50 to-emerald-50" },
  { id: "enterprise", label: "Enterprise", color: "bg-gradient-to-br from-violet-50 to-purple-50" },
];

const CHART_STYLES = ["bar", "line", "area", "donut", "mixed"] as const;

const DEFAULT_ALERTS = [
  { id: "fee", label: "Fee Due", enabled: true },
  { id: "birthday", label: "Today's Birthday", enabled: true },
  { id: "admission", label: "New Admission", enabled: false },
  { id: "leave", label: "Teacher Leave", enabled: true },
  { id: "payroll", label: "Payroll Pending", enabled: false },
  { id: "exams", label: "Upcoming Exams", enabled: true },
];

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="border border-slate-200/80 shadow-sm">
      <div className="p-5 pb-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <CardContent className="p-5 pt-2">{children}</CardContent>
    </Card>
  );
}

function SettingRow({ label, tooltip, children }: { label: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function RadioGroup({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5 bg-slate-100 p-0.5 rounded-lg">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${value === o.value ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ColorCircle({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-8 h-8 rounded-full transition-all ${active ? "ring-2 ring-offset-2 ring-indigo-500 scale-110" : "hover:scale-105"}`} style={{ backgroundColor: color }}>
      {active && <Check className="h-4 w-4 text-white mx-auto mt-[3px]" />}
    </button>
  );
}

export default function DashboardSettingsPage() {
  const { toast } = useToast();
  const [activeNav, setActiveNav] = useState("general");
  const [searchQuery, setSearchQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const [settings, setSettings] = useState({
    dashboardName: "My School Dashboard",
    landingPage: "dashboard",
    refresh: "off",
    welcomeBanner: true,

    visibleWidgets: ["stats", "revenue", "attendance", "classes", "exams", "activities", "calendar"] as string[],
    widgetSizes: {} as Record<string, string>,
    widgetOrder: ["stats", "revenue", "attendance", "classes", "exams", "activities", "calendar"],

    density: "comfortable",
    cardStyle: "glass",
    borderRadius: 16,
    gridColumns: 3,
    spacing: "normal",

    theme: "light",
    accent: "blue",
    sidebarStyle: "expanded",
    navigation: "sidebar",
    font: "inter",

    hoverLift: true,
    glowEffect: true,
    animatedCounter: true,
    rippleEffect: false,
    showTrend: true,
    showComparison: false,
    showSparkline: true,
    showIcon: true,
    showStatusBadge: true,
    kpiStyle: "minimal",

    defaultChart: "bar",
    chartAnimation: "normal",
    showLegends: true,
    showTooltips: true,
    showGridLines: true,
    showLabels: true,
    positiveColor: "#22C55E",
    negativeColor: "#EF4444",

    alerts: DEFAULT_ALERTS,
    notificationPosition: "top-right",
    notificationSound: true,

    quickActions: ["New Student", "Collect Fee", "Add Teacher", "Mark Attendance", "New Exam", "Reports"],
    fabEnabled: true,

    virtualizedTables: true,
    lazyLoading: true,
    cacheWidgets: true,
    reduceAnimations: false,
  });

  const set = (k: string, v: unknown) => { setSettings(p => ({ ...p, [k]: v })); setDirty(true); };

  const toggleWidget = (id: string) => {
    setSettings(p => ({
      ...p,
      visibleWidgets: p.visibleWidgets.includes(id)
        ? p.visibleWidgets.filter(x => x !== id)
        : [...p.visibleWidgets, id],
    }));
    setDirty(true);
  };

  const reorderWidgets = (order: string[]) => {
    setSettings(p => ({ ...p, widgetOrder: order }));
    setDirty(true);
  };

  const toggleAlert = (id: string) => {
    setSettings(p => ({
      ...p,
      alerts: p.alerts.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a),
    }));
    setDirty(true);
  };

  const applyPreset = (presetId: string) => {
    setActivePreset(presetId);
    const presets: Record<string, Partial<typeof settings>> = {
      minimal: { cardStyle: "minimal", density: "compact", gridColumns: 4, showTrend: false, showSparkline: false, glowEffect: false, visibleWidgets: ["stats", "attendance", "exams"] },
      executive: { cardStyle: "elevated", density: "compact", gridColumns: 4, chartAnimation: "fast", kpiStyle: "enterprise", showComparison: true, visibleWidgets: ["stats", "revenue", "attendance", "exams", "activities"] },
      school: { cardStyle: "glass", density: "comfortable", gridColumns: 3, kpiStyle: "premium", welcomeBanner: true, visibleWidgets: ["stats", "revenue", "attendance", "classes", "exams", "activities", "calendar"] },
      finance: { cardStyle: "elevated", density: "compact", gridColumns: 3, defaultChart: "area", kpiStyle: "financial", showComparison: true, visibleWidgets: ["stats", "revenue", "payroll", "activities"] },
      teacher: { cardStyle: "flat", density: "comfortable", gridColumns: 2, kpiStyle: "minimal", visibleWidgets: ["stats", "attendance", "classes", "exams", "activities", "calendar"] },
      principal: { cardStyle: "apple", density: "spacious", gridColumns: 3, kpiStyle: "premium", showTrend: true, showSparkline: true, visibleWidgets: ["stats", "revenue", "attendance", "classes", "exams", "activities", "calendar", "payroll"] },
    };
    const p = presets[presetId];
    if (p) { setSettings(s => ({ ...s, ...p, widgetOrder: p.visibleWidgets || s.widgetOrder })); }
    toast({ title: `"${PRESETS.find(x => x.id === presetId)?.label}" preset applied` });
  };

  const filteredNav = searchQuery
    ? NAV_ITEMS.filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : NAV_ITEMS;

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    setDirty(false);
    toast({ title: "Dashboard settings saved", description: "Your workspace has been updated." });
  };

  const handleReset = () => {
    setDirty(false);
    toast({ title: "Changes discarded" });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "dashboard-settings.json"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Dashboard settings exported" });
  };

  const configPct = useMemo(() => {
    let done = 0; const total = 8;
    if (settings.dashboardName) done++;
    if (settings.visibleWidgets.length >= 3) done++;
    if (settings.theme) done++;
    if (settings.accent) done++;
    if (settings.font) done++;
    if (settings.cardStyle) done++;
    if (settings.defaultChart) done++;
    if (settings.kpiStyle) done++;
    return Math.round((done / total) * 100);
  }, [settings]);

  const displayTab = searchQuery && filteredNav.length > 0 ? filteredNav[0].id : activeNav;

  return (
    <div className="flex gap-6">
      {/* Left Nav */}
      <aside className="hidden lg:flex flex-col w-44 shrink-0 gap-1 pt-1">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="pl-8 h-9 text-sm rounded-xl bg-slate-100 border-0 focus:bg-white transition" />
        </div>
        {filteredNav.map(item => {
          const Icon = item.icon;
          const isActive = item.id === activeNav;
          return (
            <button key={item.id} onClick={() => { setActiveNav(item.id); setSearchQuery(""); }}
              className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
              <Icon className={`h-4 w-4 ${isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-500"}`} />
              <span>{item.label}</span>
              {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto text-indigo-400" />}
            </button>
          );
        })}
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-6">
      {/* Search + Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-indigo-500" />
            Dashboard Settings
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Customize your workspace, widgets, appearance and layout.</p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <Badge className="bg-slate-100 text-slate-500 border-0 text-xs">
            <Clock className="h-3 w-3 mr-1" /> Last saved 2 min ago
          </Badge>
        </div>
      </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search dashboard settings..." className="pl-9 h-10 rounded-xl bg-slate-100 border-0 focus:bg-white transition" />
        </div>

        {/* Config Progress */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-600">Dashboard Personalization</span>
              <span className="font-semibold text-indigo-600">{configPct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700" style={{ width: `${configPct}%` }} />
            </div>
          </div>
        </div>

        {/* Presets */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quick Presets</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => applyPreset(p.id)}
                className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition ${activePreset === p.id ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                <span className="text-base">{p.icon}</span>
                <div className="text-left">
                  <p className="font-medium">{p.label}</p>
                  <p className="text-[10px] text-slate-400">{p.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = item.id === activeNav;
            return (
              <button key={item.id} onClick={() => setActiveNav(item.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${isActive ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"}`}>
                <Icon className="h-3.5 w-3.5" /> {item.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div key={displayTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-5">

            {/* ── GENERAL ── */}
            {displayTab === "general" && (
              <>
                <SectionCard title="Dashboard Name">
                  <Input value={settings.dashboardName} onChange={e => set("dashboardName", e.target.value)} className="rounded-xl max-w-sm" />
                </SectionCard>

                <SectionCard title="Default Landing Page" description="Which page users see after login">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg">
                    {[
                      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                      { id: "students", label: "Students", icon: Users },
                      { id: "teachers", label: "Teachers", icon: UserPlus },
                      { id: "finance", label: "Finance", icon: Wallet },
                      { id: "exams", label: "Examination", icon: BookOpen },
                      { id: "hr", label: "HR", icon: Users },
                    ].map(page => {
                      const Icon = page.icon;
                      return (
                        <button key={page.id} onClick={() => set("landingPage", page.id)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${settings.landingPage === page.id ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                          <Icon className="h-4 w-4" /> {page.label}
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard title="Dashboard Refresh">
                  <div className="flex gap-2">
                    {[
                      { id: "off", label: "Off" },
                      { id: "30", label: "30 sec" },
                      { id: "60", label: "1 min" },
                      { id: "300", label: "5 min" },
                    ].map(r => (
                      <button key={r.id} onClick={() => set("refresh", r.id)}
                        className={`px-4 py-2 rounded-xl border text-sm font-medium transition ${settings.refresh === r.id ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-600"}`}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Welcome Banner">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium text-slate-700">Show Welcome Banner</p><p className="text-xs text-slate-400">Display greeting message on dashboard</p></div>
                    <Switch checked={settings.welcomeBanner} onCheckedChange={(v: boolean) => set("welcomeBanner", v)} />
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── WIDGETS ── */}
            {displayTab === "widgets" && (
              <>
                <SectionCard title="Visible Widgets" description="Toggle which widgets appear on your dashboard">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ALL_WIDGETS.map(w => {
                      const Icon = w.icon;
                      const visible = settings.visibleWidgets.includes(w.id);
                      return (
                        <button key={w.id} onClick={() => toggleWidget(w.id)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${visible ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                          <div className={`w-8 h-8 rounded-lg ${w.color} flex items-center justify-center`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <span className="flex-1 text-left">{w.label}</span>
                          <div className={`w-5 h-5 rounded border flex items-center justify-center ${visible ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
                            {visible && <Check className="h-3 w-3 text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard title="Widget Order" description="Drag to reorder dashboard widgets">
                  <Reorder.Group axis="y" values={settings.widgetOrder} onReorder={reorderWidgets} className="space-y-1">
                    {settings.widgetOrder.map(id => {
                      const w = ALL_WIDGETS.find(x => x.id === id);
                      if (!w) return null;
                      const Icon = w.icon;
                      return (
                        <Reorder.Item key={id} value={id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-white cursor-grab active:cursor-grabbing">
                          <GripVertical className="h-4 w-4 text-slate-300" />
                          <div className={`w-6 h-6 rounded-lg ${w.color} flex items-center justify-center`}>
                            <Icon className="h-3 w-3 text-white" />
                          </div>
                          <span className="flex-1 text-sm font-medium text-slate-700">{w.label}</span>
                          <Pin className="h-3.5 w-3.5 text-slate-300" />
                        </Reorder.Item>
                      );
                    })}
                  </Reorder.Group>
                </SectionCard>

                <SectionCard title="Widget Size">
                  <div className="space-y-3">
                    {settings.visibleWidgets.slice(0, 3).map(id => {
                      const w = ALL_WIDGETS.find(x => x.id === id);
                      if (!w) return null;
                      const current = (settings.widgetSizes[id] as string) || "medium";
                      return (
                        <div key={id} className="flex items-center gap-3">
                          <span className="text-sm text-slate-600 w-36">{w.label}</span>
                          <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                            {WIDGET_SIZES.map(sz => (
                              <button key={sz} onClick={() => set("widgetSizes", { ...settings.widgetSizes, [id]: sz })}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition ${current === sz ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
                                {sz}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── LAYOUT ── */}
            {displayTab === "layout" && (
              <>
                <SectionCard title="Dashboard Density">
                  <div className="flex gap-2">
                    {[
                      { id: "comfortable", label: "Comfortable", icon: Columns4 },
                      { id: "compact", label: "Compact", icon: Columns3 },
                      { id: "spacious", label: "Spacious", icon: LayoutDashboard },
                    ].map(d => {
                      const Icon = d.icon;
                      return (
                        <button key={d.id} onClick={() => set("density", d.id)}
                          className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition ${settings.density === d.id ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                          <Icon className="h-4 w-4" /> {d.label}
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard title="Card Style">
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {CARD_STYLES.map(cs => (
                      <button key={cs.id} onClick={() => set("cardStyle", cs.id)}
                        className={`shrink-0 w-28 rounded-xl border-2 p-3 text-left transition ${settings.cardStyle === cs.id ? "border-indigo-500" : "border-slate-200 hover:border-slate-300"}`}>
                        <div className={`h-12 rounded-lg mb-2 ${cs.preview}`}>
                          <div className="flex gap-1 p-2">
                            <div className="w-2 h-2 rounded-full bg-slate-300" />
                            <div className="w-2 h-2 rounded-full bg-slate-200" />
                          </div>
                          <div className="px-2 space-y-1">
                            <div className="h-1.5 w-3/4 rounded bg-slate-200" />
                            <div className="h-1 w-1/2 rounded bg-slate-100" />
                          </div>
                        </div>
                        <span className="text-xs font-medium text-slate-700">{cs.label}</span>
                      </button>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Border Radius">
                  <div className="flex items-center gap-3">
                    <Slider value={[settings.borderRadius]} onValueChange={([v]: number[]) => set("borderRadius", v)} min={0} max={32} step={1} className="flex-1" />
                    <span className="text-sm font-semibold text-indigo-600 w-8">{settings.borderRadius}px</span>
                  </div>
                </SectionCard>

                <SectionCard title="Grid">
                  <div className="flex gap-2">
                    {[2, 3, 4].map(n => (
                      <button key={n} onClick={() => set("gridColumns", n)}
                        className={`w-12 h-12 rounded-xl border text-sm font-bold transition ${settings.gridColumns === n ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-500"}`}>
                        {n}
                      </button>
                    ))}
                    <button onClick={() => set("gridColumns", 0)}
                      className={`px-4 rounded-xl border text-sm font-medium transition ${settings.gridColumns === 0 ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-500"}`}>
                      Auto
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="Card Spacing">
                  <RadioGroup
                    options={[
                      { value: "compact", label: "Compact" },
                      { value: "normal", label: "Normal" },
                      { value: "wide", label: "Wide" },
                    ]}
                    value={settings.spacing} onChange={(v: string) => set("spacing", v)} />
                </SectionCard>
              </>
            )}

            {/* ── APPEARANCE ── */}
            {displayTab === "appearance" && (
              <>
                <SectionCard title="Theme">
                  <div className="flex gap-2">
                    {THEMES.map(t => {
                      const Icon = t.icon;
                      return (
                        <button key={t.id} onClick={() => set("theme", t.id)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition ${settings.theme === t.id ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                          <Icon className="h-4 w-4" /> {t.label}
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard title="Accent Color">
                  <div className="flex gap-2.5">
                    {ACCENTS.map(a => (
                      <ColorCircle key={a.id} color={a.color} active={settings.accent === a.id} onClick={() => set("accent", a.id)} />
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Sidebar Style">
                  <div className="flex gap-2">
                    {[
                      { id: "expanded", label: "Expanded", icon: PanelLeft },
                      { id: "compact", label: "Compact", icon: PanelRight },
                      { id: "floating", label: "Floating", icon: LayoutDashboard },
                      { id: "icons", label: "Icon Only", icon: PanelLeft },
                    ].map(s => {
                      const Icon = s.icon;
                      return (
                        <button key={s.id} onClick={() => set("sidebarStyle", s.id)}
                          className={`flex-1 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition ${settings.sidebarStyle === s.id ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                          <Icon className="h-3.5 w-3.5" /> {s.label}
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard title="Navigation">
                  <RadioGroup
                    options={[
                      { value: "sidebar", label: "Left Sidebar" },
                      { value: "top", label: "Top Nav" },
                      { value: "hybrid", label: "Hybrid" },
                    ]}
                    value={settings.navigation} onChange={(v: string) => set("navigation", v)} />
                </SectionCard>

                <SectionCard title="Font">
                  <div className="flex gap-2">
                    {FONTS.map(f => (
                      <button key={f.id} onClick={() => set("font", f.id)}
                        className={`flex-1 px-4 py-2.5 rounded-xl border text-center transition ${settings.font === f.id ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200 hover:border-slate-300"}`}
                        style={{ fontFamily: f.stack }}>
                        <p className="text-sm font-medium text-slate-700">{f.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Aa</p>
                      </button>
                    ))}
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── CARDS ── */}
            {displayTab === "cards" && (
              <>
                <SectionCard title="Card Animation">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "hoverLift", label: "Hover Lift" },
                      { key: "glowEffect", label: "Glow Effect" },
                      { key: "animatedCounter", label: "Animated Counter" },
                      { key: "rippleEffect", label: "Ripple Effect" },
                    ].map(a => (
                      <div key={a.key} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                        <span className="text-sm text-slate-700">{a.label}</span>
                        <Switch checked={(settings as any)[a.key]} onCheckedChange={(v: boolean) => set(a.key, v)} />
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Card Information" description="What each KPI card displays">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "showTrend", label: "Trend %" },
                      { key: "showComparison", label: "Comparison" },
                      { key: "showSparkline", label: "Sparkline" },
                      { key: "showIcon", label: "Icon" },
                      { key: "showStatusBadge", label: "Status Badge" },
                    ].map(info => (
                      <div key={info.key} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                        <span className="text-sm text-slate-700">{info.label}</span>
                        <Switch checked={(settings as any)[info.key]} onCheckedChange={(v: boolean) => set(info.key, v)} />
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="KPI Style">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {KPI_STYLES.map(kpi => (
                      <button key={kpi.id} onClick={() => set("kpiStyle", kpi.id)}
                        className={`rounded-xl border-2 p-3 transition ${settings.kpiStyle === kpi.id ? "border-indigo-500" : "border-slate-200 hover:border-slate-300"}`}>
                        <div className={`h-14 rounded-lg mb-2 ${kpi.color} p-2 flex items-center justify-center`}>
                          <div className="text-center">
                            <div className="text-lg font-bold text-slate-700">1,285</div>
                            <div className="text-[10px] text-green-600">↑ 12%</div>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-slate-600">{kpi.label}</span>
                      </button>
                    ))}
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── CHARTS ── */}
            {displayTab === "charts" && (
              <>
                <SectionCard title="Default Chart Style">
                  <div className="flex gap-2">
                    {CHART_STYLES.map(cs => (
                      <button key={cs} onClick={() => set("defaultChart", cs)}
                        className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium capitalize transition ${settings.defaultChart === cs ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                        {cs}
                      </button>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Animation Speed">
                  <RadioGroup
                    options={[
                      { value: "fast", label: "Fast" },
                      { value: "normal", label: "Normal" },
                      { value: "slow", label: "Slow" },
                    ]}
                    value={settings.chartAnimation} onChange={(v: string) => set("chartAnimation", v)} />
                </SectionCard>

                <SectionCard title="Chart Elements">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "showLegends", label: "Legends" },
                      { key: "showTooltips", label: "Tooltips" },
                      { key: "showGridLines", label: "Grid Lines" },
                      { key: "showLabels", label: "Labels" },
                    ].map(el => (
                      <div key={el.key} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                        <span className="text-sm text-slate-700">{el.label}</span>
                        <Switch checked={(settings as any)[el.key]} onCheckedChange={(v: boolean) => set(el.key, v)} />
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Trend Colors">
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">Positive</span>
                      <input type="color" value={settings.positiveColor} onChange={e => set("positiveColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">Negative</span>
                      <input type="color" value={settings.negativeColor} onChange={e => set("negativeColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                    </div>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── NOTIFICATIONS ── */}
            {displayTab === "notifications" && (
              <>
                <SectionCard title="Dashboard Alerts" description="Choose which alerts appear on your dashboard">
                  <div className="space-y-1">
                    {settings.alerts.map(a => (
                      <div key={a.id} className="flex items-center justify-between py-2">
                        <span className="text-sm text-slate-700">{a.label}</span>
                        <Switch checked={a.enabled} onCheckedChange={() => toggleAlert(a.id)} />
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Notification Position">
                  <div className="flex gap-2">
                    {[
                      { id: "top-right", label: "Top Right", icon: PanelTop },
                      { id: "bottom-right", label: "Bottom Right", icon: PanelRight },
                      { id: "top-center", label: "Top Center", icon: PanelTop },
                    ].map(pos => {
                      const Icon = pos.icon;
                      return (
                        <button key={pos.id} onClick={() => set("notificationPosition", pos.id)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition ${settings.notificationPosition === pos.id ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-600"}`}>
                          <Icon className="h-4 w-4" /> {pos.label}
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard title="Notification Sound">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Volume2 className="h-4 w-4 text-slate-400" /><div><p className="text-sm font-medium text-slate-700">Enable Notification Sound</p></div></div>
                    <Switch checked={settings.notificationSound} onCheckedChange={(v: boolean) => set("notificationSound", v)} />
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── SHORTCUTS ── */}
            {displayTab === "shortcuts" && (
              <>
                <SectionCard title="Quick Actions" description="Drag to reorder shortcuts">
                  <Reorder.Group axis="y" values={settings.quickActions} onReorder={(v: string[]) => { set("quickActions", v); setDirty(true); }} className="space-y-1">
                    {settings.quickActions.map((action, i) => (
                      <Reorder.Item key={action} value={action} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-white cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-4 w-4 text-slate-300" />
                        <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center"><span className="text-xs font-bold text-indigo-600">{i + 1}</span></div>
                        <span className="flex-1 text-sm font-medium text-slate-700">{action}</span>
                        <Plus className="h-3.5 w-3.5 text-slate-300" />
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                </SectionCard>

                <SectionCard title="Floating Action">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium text-slate-700">Floating Action Button</p><p className="text-xs text-slate-400">Quick access to common tasks</p></div>
                    <Switch checked={settings.fabEnabled} onCheckedChange={(v: boolean) => set("fabEnabled", v)} />
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── ADVANCED ── */}
            {displayTab === "advanced" && (
              <>
                <SectionCard title="Performance Mode">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "virtualizedTables", label: "Virtualized Tables" },
                      { key: "lazyLoading", label: "Lazy Loading" },
                      { key: "cacheWidgets", label: "Cache Widgets" },
                      { key: "reduceAnimations", label: "Reduce Animations" },
                    ].map(p => (
                      <div key={p.key} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                        <span className="text-sm text-slate-700">{p.label}</span>
                        <Switch checked={(settings as any)[p.key]} onCheckedChange={(v: boolean) => set(p.key, v)} />
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Data Management">
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={() => { setDirty(false); toast({ title: "Layout restored to default" }); }} className="rounded-xl"><RotateCcw className="h-4 w-4 mr-1.5" /> Restore Default Layout</Button>
                    <Button variant="outline" onClick={handleExport} className="rounded-xl"><Download className="h-4 w-4 mr-1.5" /> Export Settings</Button>
                    <Button variant="outline" className="rounded-xl"><Upload className="h-4 w-4 mr-1.5" /> Import JSON</Button>
                  </div>
                </SectionCard>
              </>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Sticky Save Bar */}
        <AnimatePresence>
          {dirty && (
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              className="sticky bottom-4 z-50 border border-slate-200 bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-sm font-medium text-slate-700">Unsaved Changes</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleReset} className="rounded-xl text-slate-500"><RotateCcw className="h-4 w-4 mr-1.5" /> Discard</Button>
                <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200">
                  {saving ? "Saving..." : <><Save className="h-4 w-4 mr-1.5" /> Save Changes</>}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Live Preview */}
      <aside className="hidden xl:flex flex-col w-56 shrink-0 gap-4 pt-1">
        <div className="sticky top-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" /> Live Preview
          </p>
          <div className={`rounded-2xl border overflow-hidden ${settings.theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}
            style={{ fontFamily: FONTS.find(f => f.id === settings.font)?.stack || "inherit" }}>
            <div className={`px-3 py-2 flex items-center justify-between border-b ${settings.theme === "dark" ? "border-slate-700" : "border-slate-100"}`}>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-lg bg-indigo-100 flex items-center justify-center"><LayoutDashboard className="h-3 w-3 text-indigo-600" /></div>
                <span className={`text-[10px] font-semibold ${settings.theme === "dark" ? "text-white" : "text-slate-800"}`}>
                  {settings.dashboardName.length > 14 ? settings.dashboardName.slice(0, 14) + "..." : settings.dashboardName}
                </span>
              </div>
              <div className={`text-[8px] px-1.5 py-0.5 rounded ${settings.theme === "dark" ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
                {settings.theme === "dark" ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              </div>
            </div>
            <div className="p-3 space-y-2.5">
              {settings.welcomeBanner && (
                <div className={`text-[9px] font-medium px-2 py-1.5 rounded-lg ${settings.theme === "dark" ? "bg-slate-800 text-slate-300" : "bg-indigo-50 text-indigo-600"}`}>
                  👋 Good Morning, Admin
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {settings.visibleWidgets.slice(0, 4).map(id => {
                  const w = ALL_WIDGETS.find(x => x.id === id);
                  if (!w) return null;
                  const Icon = w.icon;
                  return (
                    <div key={id} className={`px-2 py-2 rounded-xl ${settings.cardStyle === "glass" ? "bg-white/70 backdrop-blur border" : settings.cardStyle === "elevated" ? "bg-white shadow-sm" : settings.cardStyle === "minimal" ? "bg-transparent" : "bg-white border"} ${settings.theme === "dark" ? "bg-slate-800 border-slate-700" : ""}`}
                      style={{ borderRadius: settings.borderRadius > 0 ? `${settings.borderRadius}px` : undefined }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className={`w-4 h-4 rounded ${w.color} flex items-center justify-center`}>
                          <Icon className="h-2.5 w-2.5 text-white" />
                        </div>
                        {settings.showTrend && <span className="text-[7px] font-medium text-green-600">↑12%</span>}
                      </div>
                      <p className={`text-[11px] font-bold ${settings.theme === "dark" ? "text-white" : "text-slate-800"}`}>
                        {id === "stats" ? "1,285" : id === "revenue" ? "$25.2K" : id === "attendance" ? "94%" : id === "classes" ? "12" : "—"}
                      </p>
                      <p className={`text-[7px] ${settings.theme === "dark" ? "text-slate-400" : "text-slate-400"}`}>{w.label}</p>
                    </div>
                  );
                })}
              </div>
              {settings.visibleWidgets.includes("revenue") && (
                <div className={`h-8 rounded-lg flex items-end gap-0.5 px-1 py-1 ${settings.theme === "dark" ? "bg-slate-800" : "bg-slate-50"}`}>
                  {[40, 55, 35, 70, 50, 80, 65].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-sm" style={{
                      height: `${h}%`,
                      backgroundColor: ACCENTS.find(a => a.id === settings.accent)?.color || "#2563EB",
                      opacity: 0.4 + (i / 7) * 0.6,
                    }} />
                  ))}
                </div>
              )}
              {settings.visibleWidgets.includes("calendar") && (
                <div className={`grid grid-cols-7 gap-0.5 ${settings.theme === "dark" ? "text-slate-400" : "text-slate-400"}`}>
                  {["M", "T", "W", "T", "F", "S", "S"].map(d => (
                    <span key={d} className="text-center text-[6px] font-medium">{d}</span>
                  ))}
                  {Array.from({ length: 7 }).map((_, i) => (
                    <span key={i} className={`text-center text-[7px] ${i === 2 ? (settings.theme === "dark" ? "bg-indigo-500 text-white" : "bg-indigo-600 text-white") : ""} rounded-full w-3 h-3 mx-auto`} />
                  ))}
                </div>
              )}
            </div>
            <div className={`px-3 py-1.5 border-t flex justify-between ${settings.theme === "dark" ? "border-slate-700" : "border-slate-100"}`}>
              <span className={`text-[7px] ${settings.theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>{settings.gridColumns} col · {settings.spacing}</span>
              <span className="text-[7px] text-indigo-400">{settings.defaultChart}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
