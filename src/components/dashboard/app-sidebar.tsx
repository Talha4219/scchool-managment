"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard, Users, UserCheck, GraduationCap, BookOpen,
  CalendarCheck, BarChart3, CreditCard, Megaphone, Settings,
  ClipboardList, Library, Star, Search, Plus,
  ChevronDown, LogOut, Moon, Sun, PanelLeftClose,
  PanelLeft, Sparkles, Home, FileText,
  Calculator, MessageSquare, PieChart, X,
  UserPlus, type LucideIcon, User, BookMarked,
  Briefcase, Package, Award,
  Radio, Presentation, HeartHandshake, ShieldCheck, History, Bus,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useAppState } from "@/lib/state-context";
import { useSidebarCollapse } from "@/app/(dashboard)/layout";
import { logout, getSession } from "@/app/actions/auth";
import { fetchRolePermissionsDB } from "@/app/actions/features";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useLanguage } from "@/hooks/use-language";

type NavItem = {
  icon: LucideIcon;
  label: string;
  href: string;
  badge?: number;
  children?: { label: string; href: string; permission?: string }[];
  permission?: string;
};

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Users, label: "Students", href: "/students", permission: "students.view" },
  { icon: UserPlus, label: "Admissions", href: "/admissions", permission: "admissions.view" },
  { icon: UserCheck, label: "Teachers", href: "/teachers", permission: "teachers.view" },
  {
    icon: BookOpen, label: "Academics", href: "/classes",
    children: [
      { label: "Grades", href: "/classes", permission: "classes.grades" },
      { label: "Students by Class", href: "/academics/students", permission: "classes.students" },
      { label: "Timetable Management", href: "/timetable", permission: "timetable.view" },
      { label: "Student Promotion", href: "/students/promotions", permission: "students.edit" },
    ],
    permission: "classes.view",
  },
  {
    icon: CalendarCheck, label: "Attendance", href: "/attendance",
    children: [
      { label: "Mark", href: "/attendance", permission: "attendance.mark" },
      { label: "View History", href: "/attendance/view", permission: "attendance.view" },
      { label: "Kiosk Mode", href: "/attendance/kiosk", permission: "attendance.mark" },
    ],
    permission: "attendance.view",
  },
  {
    icon: BookMarked, label: "Examinations", href: "/exams",
    children: [
      { label: "Dashboard", href: "/exams", permission: "exams.dashboard" },
      { label: "Manage Exams", href: "/exams/manage", permission: "exams.manage" },
      { label: "Marks Entry", href: "/exams/marks", permission: "exams.marks" },
      { label: "Results", href: "/exams/results", permission: "exams.results" },
      { label: "Report Cards", href: "/exams/report-cards", permission: "exams.report-cards" },
      { label: "Analytics", href: "/exams/analytics", permission: "exams.analytics" },
      { label: "Online Exams", href: "/exams/online", permission: "exams.online" },
      { label: "Class Compilations", href: "/results", permission: "results.view" },
      { label: "Settings", href: "/exams/settings", permission: "exams.settings" },
    ],
    permission: "exams.view",
  },
  { icon: ClipboardList, label: "Assignments", href: "/assignments" },
  { icon: CreditCard, label: "Fees", href: "/fees", permission: "fees.view" },
  { icon: Calculator, label: "Accounting", href: "/accounting", permission: "accounting.view" },
  {
    icon: Briefcase, label: "HR & Payroll", href: "/hr",
    children: [
      { label: "Staff Directory", href: "/hr", permission: "hr.view" },
      { label: "Payroll", href: "/payroll", permission: "payroll.view" },
    ],
    permission: "hr.view",
  },
  {
    icon: Package, label: "Operations", href: "/inventory",
    children: [
      { label: "Inventory", href: "/inventory", permission: "inventory.view" },
      { label: "Procurement", href: "/procurement", permission: "procurement.view" },
      { label: "Hostel", href: "/hostel", permission: "hostel.view" },
    ],
    permission: "inventory.view",
  },
  {
    icon: Award, label: "Student Life", href: "/discipline",
    children: [
      { label: "Discipline", href: "/discipline", permission: "discipline.view" },
      { label: "Scholarships", href: "/scholarships", permission: "scholarships.view" },
      { label: "Alumni", href: "/alumni", permission: "alumni.view" },
      { label: "Events", href: "/events", permission: "events.view" },
    ],
    permission: "discipline.view",
  },
  { icon: MessageSquare, label: "Messages", href: "/messages" },
  { icon: Radio, label: "Communications", href: "/communications", permission: "communications.view" },
  { icon: Library, label: "Library", href: "/library" },
  { icon: Bus, label: "Transport", href: "/transport" },
  { icon: Presentation, label: "LMS", href: "/lms", permission: "lms.view" },
  { icon: HeartHandshake, label: "Parents", href: "/parents", permission: "parents.view" },
  { icon: BarChart3, label: "Reports", href: "/reports" },
  { icon: ShieldCheck, label: "Users", href: "/users", permission: "users.view" },
  { icon: History, label: "Audit Log", href: "/audit-log", permission: "audit.view" },
  { icon: Settings, label: "Settings", href: "/settings", permission: "settings.view" },
];

const quickCreateActions = [
  { icon: Users, label: "Student", href: "/students", permission: "students.create" },
  { icon: UserPlus, label: "Admission", href: "/admissions", permission: "admissions.view" },
  { icon: CreditCard, label: "Invoice", href: "/fees", permission: "fees.create" },
  { icon: Megaphone, label: "Announcement", href: "/announcements" },
  { icon: BookMarked, label: "Exam", href: "/exams/manage", permission: "exams.create" },
  { icon: UserCheck, label: "Teacher", href: "/teachers", permission: "teachers.create" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { collapsed, toggle: toggleCollapsed } = useSidebarCollapse();
  const { activeRole, isDbLoaded } = useAppState();

  const [sessionName, setSessionName] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { tn } = useLanguage();
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [expandedParent, setExpandedParent] = useState<string | null>("Academics");

  const toggleParent = useCallback((label: string) => {
    setExpandedParent(prev => prev === label ? null : label);
  }, []);
  useEffect(() => {
    getSession().then(s => {
      setSessionName(s?.name ?? null);
      setSessionRole(s?.role ?? null);
      if (s?.role) {
        fetchRolePermissionsDB(s.role).then(setPermissions);
      }
    });
    setFavorites(JSON.parse(localStorage.getItem("sc_favorites") || "[]"));
  }, []);

  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  const hasPermission = useCallback((perm?: string) => {
    if (!perm) return true;
    if (sessionRole === "ADMIN") return true;
    return permissions[perm] === true;
  }, [permissions, sessionRole]);

  const visibleNavItems = navItems.filter(item => hasPermission(item.permission));

  const isFav = useCallback((href: string) => favorites.includes(href), [favorites]);
  const toggleFavorite = useCallback((href: string) => {
    setFavorites(prev => {
      const next = prev.includes(href) ? prev.filter(f => f !== href) : [...prev, href];
      localStorage.setItem("sc_favorites", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleNavClick = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCommandOpen(true); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (commandOpen) setTimeout(() => commandInputRef.current?.focus(), 100);
    setCommandSearch("");
    setCommandIndex(0);
  }, [commandOpen]);

  const filteredCommands = visibleNavItems.flatMap(item => {
    const results: { icon: LucideIcon; label: string; href: string }[] = [];
    const match = (label: string, href: string) =>
      label.toLowerCase().includes(commandSearch.toLowerCase()) ||
      href.toLowerCase().includes(commandSearch.toLowerCase());
    if (match(item.label, item.href)) results.push({ icon: item.icon, label: item.label, href: item.href });
    if (item.children) {
      for (const child of item.children) {
        if (hasPermission(child.permission) && match(child.label, child.href)) results.push({ icon: item.icon, label: child.label, href: child.href });
      }
    }
    return results;
  });

  const displayName = sessionName || "User";
  const displayRole = sessionRole || activeRole;
  const displayInitials = displayName.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col glass-sidebar transition-all duration-200 ease-linear",
          collapsed ? "w-[68px]" : "w-[280px]"
        )}
      >
        {/* Logo */}
        <div className={cn("flex h-[72px] items-center border-b border-border px-5 shrink-0", collapsed && "justify-center px-0")}>
          <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <GraduationCap className="h-[18px] w-[18px] text-primary" />
            </div>
            {!collapsed && (
              <div>
                <p className="text-sm font-bold text-foreground leading-tight">Scholarly</p>
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground leading-tight">Management ERP</p>
              </div>
            )}
          </div>
        </div>

        {/* Search + Quick Create */}
        <div className={cn("px-3 pt-3 pb-2", collapsed && "px-2")}>
          {collapsed ? (
            <button
              onClick={() => setCommandOpen(true)}
              className="flex h-9 w-full items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
              title="Search (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => setCommandOpen(true)}
                className="flex h-9 w-full items-center gap-2.5 rounded-xl border border-border bg-secondary/60 px-3 text-xs text-muted-foreground hover:border-primary/30 hover:text-muted-foreground transition-colors"
              >
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 text-left">{tn("Search...")}</span>
                <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </button>
              <button
                onClick={() => setQuickCreateOpen(true)}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-xl gradient-active text-white text-xs font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> {tn("Quick Create")}
              </button>
            </div>
          )}
        </div>

        {/* Favorites */}
        {!collapsed && favorites.length > 0 && (
          <div className="px-3 mb-1">
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
              <Star className="h-3 w-3 text-accent" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{tn("Favorites")}</span>
            </div>
            <div className="space-y-0.5">
                {favorites.map(href => {
                  let item: { icon: LucideIcon; label: string } | undefined;
                  let label = "";
                  for (const n of visibleNavItems) {
                    if (n.href === href) { item = n; label = n.label; break; }
                    if (n.children) {
                      const c = n.children.find(ch => ch.href === href);
                      if (c) { item = { icon: n.icon, label: c.label }; label = c.label; break; }
                    }
                  }
                  if (!item) return null;
                  const Icon = item.icon;
                  return (
                    <button
                      key={href}
                      onClick={() => handleNavClick(href)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150",
                        pathname === href
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{tn(label)}</span>
                    </button>
                  );
                })}
              </div>
          </div>
        )}

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3">
          <nav className="space-y-0.5 py-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              const isExpanded = expandedParent === item.label;
              const hasChildren = !!item.children?.length;

              if (hasChildren) {
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => collapsed ? handleNavClick(item.href) : toggleParent(item.label)}
                      onContextMenu={(e) => { e.preventDefault(); toggleFavorite(item.href); }}
                      className={cn(
                        "group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150",
                        collapsed && "justify-center px-2 py-2.5",
                        active
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      )}
                      title={collapsed ? tn(item.label) : undefined}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", collapsed ? "h-5 w-5" : "")} />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left truncate">{tn(item.label)}</span>
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                          <span
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(item.href); }}
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer",
                              isFav(item.href) ? "text-accent opacity-100" : "text-white/50 hover:text-white"
                            )}
                          >
                            <Star className={cn("h-3 w-3", isFav(item.href) && "fill-accent")} />
                          </span>
                        </>
                      )}
                    </button>
                    {!collapsed && (
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            key={item.label}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="ml-6 mt-0.5 space-y-0.5 border-l-2 border-border pl-2">
                              {item.children!.filter(child => hasPermission(child.permission)).map(child => {
                                const [childPath, childQuery] = child.href.split("?");
                                const childActive = childQuery
                                  ? pathname === childPath && searchParams.toString() === childQuery.replace("?", "")
                                  : pathname === child.href;
                                return (
                                  <button
                                    key={child.href}
                                    onClick={() => handleNavClick(child.href)}
                                    onContextMenu={(e) => { e.preventDefault(); toggleFavorite(child.href); }}
                              className={cn(
                                "group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150",
                                childActive
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                              )}
                            >
                              <span className="flex-1 text-left truncate">{tn(child.label)}</span>
                              <span
                                onClick={(e) => { e.stopPropagation(); toggleFavorite(child.href); }}
                                className={cn(
                                  "flex h-4 w-4 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer",
                                  isFav(child.href) ? "text-accent opacity-100" : "text-white/50 hover:text-white"
                                )}
                              >
                                <Star className={cn("h-2.5 w-2.5", isFav(child.href) && "fill-accent")} />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                            </motion.div>
                          )}
                      </AnimatePresence>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={item.href}
                  onClick={() => handleNavClick(item.href)}
                  onContextMenu={(e) => { e.preventDefault(); toggleFavorite(item.href); }}
                  className={cn(
                    "group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150",
                    collapsed && "justify-center px-2 py-2.5",
                    active
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                  title={collapsed ? tn(item.label) : undefined}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", collapsed ? "h-5 w-5" : "")} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left truncate">{tn(item.label)}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-foreground/20 px-1 text-[9px] font-bold text-white">
                          {item.badge}
                        </span>
                      )}
                      <span
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(item.href); }}
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer",
                          isFav(item.href) ? "text-accent opacity-100" : "text-white/50 hover:text-white"
                        )}
                      >
                        <Star className={cn("h-3 w-3", isFav(item.href) && "fill-accent")} />
                      </span>
                    </>
                  )}
                </button>
              );
            })}

            {/* Collapse Toggle */}
            <div className="pt-2 mt-2 border-t border-border">
              <button
                onClick={toggleCollapsed}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
              >
                {collapsed ? <PanelLeft className="h-4 w-4 mx-auto" /> : <><PanelLeftClose className="h-4 w-4" /><span>{tn("Collapse")}</span></>}
              </button>
            </div>
          </nav>
        </ScrollArea>

        {/* User Section */}
        <div className="border-t border-border p-3 shrink-0">
          <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
            <Avatar className="h-8 w-8 shrink-0 border border-border">
              <AvatarFallback className="bg-primary text-[10px] font-bold text-white">{displayInitials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 truncate">
                <p className="text-xs font-semibold text-foreground truncate leading-tight">{displayName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{displayRole === "ADMIN" ? tn("Administrator") : displayRole}</p>
              </div>
            )}
            {!collapsed && (
              <div className="flex items-center gap-0.5">
                <button onClick={toggleDarkMode}
                  aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors">
                  {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
                <Link href="/settings" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors">
                  <Settings className="h-3.5 w-3.5" />
                </Link>
                <button onClick={() => logout()}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Command Palette */}
      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogContent className="max-w-xl top-[12%] translate-y-0 p-0 gap-0 border-0 shadow-2xl rounded-2xl overflow-hidden backdrop-blur-2xl bg-card/95">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              ref={commandInputRef}
              value={commandSearch}
              onChange={e => { setCommandSearch(e.target.value); setCommandIndex(0); }}
              onKeyDown={e => {
                if (e.key === "ArrowDown") { e.preventDefault(); setCommandIndex(i => Math.min(i + 1, filteredCommands.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setCommandIndex(i => Math.max(i - 1, 0)); }
                if (e.key === "Enter" && filteredCommands[commandIndex]) {
                  handleNavClick(filteredCommands[commandIndex].href);
                  setCommandOpen(false);
                }
              }}
              placeholder="Search pages, students, actions..."
              className="border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
            />
            <button onClick={() => setCommandOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[320px] overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">No results found.</p>
            ) : (
              filteredCommands.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={`${item.href}-${item.label}`}
                    onClick={() => { handleNavClick(item.href); setCommandOpen(false); setCommandSearch(""); }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      i === commandIndex ? "gradient-active" : "text-muted-foreground hover:bg-secondary/60"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{tn(item.label)}</span>
                    <span className={cn("ml-auto text-[10px]", i === commandIndex ? "text-white/70" : "text-muted-foreground")}>{item.href}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="flex items-center gap-4 border-t border-border px-5 py-2.5 text-[10px] text-muted-foreground">
            <span><kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono">↵</kbd> open</span>
            <span><kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono">Esc</kbd> close</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Create */}
      <Dialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
        <DialogContent className="max-w-sm border-0 shadow-2xl rounded-2xl backdrop-blur-2xl bg-card/95">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground">{tn("Quick Create")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {quickCreateActions.filter(a => hasPermission(a.permission)).map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => { router.push(action.href); setQuickCreateOpen(false); }}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:bg-secondary hover:text-primary transition-colors"
                >
                  <Icon className="h-5 w-5" />
                  <span>{tn(action.label)}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
