"use client";

import { useState, useEffect, useLayoutEffect, useRef, createContext, useContext, useCallback, Suspense } from "react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Bell, MessageSquare, Zap, LogOut, User, Settings, ShieldAlert, UserCheck, GraduationCap, Loader2, Menu, Check, X, ChevronRight, Users, AlertOctagon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/state-context";
import { useNotifications } from "@/lib/notifications-context";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { logout, getSession, getOwnerViewBranchAction, setOwnerViewBranchAction } from "@/app/actions/auth";
import { fetchBranchesDB, type BranchRecord } from "@/app/actions/branches";
import { fetchProfilePhotoAction } from "@/app/actions/features";
import { formatDayMonthPK } from "@/lib/date-format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { fetchConversationsDB, fetchUnreadMessageCountDB, type ConversationSummary } from "@/app/actions/messaging";
import { globalSearchDB, type GlobalSearchResult } from "@/app/actions/academic-core";
import { usePermission } from "@/hooks/use-permission";
import { fetchUnresolvedErrorCountAction } from "@/app/actions/error-log-admin";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/dashboard/breadcrumbs";
import { useLanguage } from "@/hooks/use-language";
import { Agentation } from "agentation";

const searchResultIcon: Record<GlobalSearchResult["type"], typeof User> = {
  student: User,
  teacher: UserCheck,
  class: Users,
};

function timeAgo(iso: string) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)}h`;
  return formatDayMonthPK(iso);
}

const SidebarCollapseCtx = createContext<{ collapsed: boolean; toggle: () => void }>({ collapsed: false, toggle: () => {} });
export const useSidebarCollapse = () => useContext(SidebarCollapseCtx);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isDbLoaded, activeRole, setActiveRole, schoolInfo, reloadDbData } = useAppState();
  const { notifications, markNotificationRead } = useNotifications();
  const { t, tn } = useLanguage();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  // Global "view branch as" selector for OWNER — the selection scopes every
  // branch-aware query app-wide (students, fees, HR, attendance, sidebar
  // nav, everything), not just this dropdown. See src/lib/auth-scope.ts and
  // setOwnerViewBranchAction/getOwnerViewBranchAction in actions/auth.ts.
  const [ownerBranches, setOwnerBranches] = useState<BranchRecord[]>([]);
  const [ownerViewBranchId, setOwnerViewBranchId] = useState<string>("");

  useEffect(() => {
    getSession().then(s => {
      setSessionRole(s?.role ?? null);
      setSessionName(s?.name ?? null);
      setSessionEmail(s?.email ?? null);
      if (s?.role === 'STUDENT' || s?.role === 'PARENT') fetchProfilePhotoAction().then(setProfilePhoto);
      if (s?.role === 'OWNER') {
        fetchBranchesDB().then(setOwnerBranches);
        getOwnerViewBranchAction().then(id => setOwnerViewBranchId(id ?? ""));
      }
    });
  }, []);

  // No full window reload: refresh the App Router's server-rendered data,
  // force every "use client" page under this layout to remount (most fetch
  // once in a mount effect, not on every render — a key change is what
  // actually re-triggers that) via contentKey, and re-pull the legacy
  // useAppState demo/DB dataset (fees, library, etc.) that a subset of older
  // pages still read from instead of fetching directly.
  const [contentKey, setContentKey] = useState(0);

  // Scroll position restoration — Next's built-in scroll restoration only
  // tracks window scroll, but this app's scrollable region is the <main>
  // element below (overflow-y-auto), not the window. Without this, every
  // navigation (including browser back) drops the user back at the top of
  // a long list/table instead of where they were.
  const mainRef = useRef<HTMLElement>(null);
  const scrollPositions = useRef<Map<string, number>>(new Map());
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (el) el.scrollTop = scrollPositions.current.get(pathname) ?? 0;
  }, [pathname, contentKey]);
  const handleMainScroll = useCallback(() => {
    if (mainRef.current) scrollPositions.current.set(pathname, mainRef.current.scrollTop);
  }, [pathname]);
  const handleOwnerBranchChange = async (value: string) => {
    const branchId = value === "ALL" ? null : value;
    await setOwnerViewBranchAction(branchId);
    router.refresh();
    await reloadDbData();
    setContentKey(k => k + 1);
  };

  const isAdmin = sessionRole === "ADMIN";
  const { can: canSettings } = usePermission();
  const displayName = sessionName || "User";
  const displayRole = sessionRole || activeRole;
  const displayInitials = displayName.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
  const roleLabel: Record<string, string> = { ADMIN: "Administrator", TEACHER: "Teacher", STUDENT: "Student", PARENT: "Parent", EMPLOYEE: "Employee" };
  const roleBadgeStyle: Record<string, string> = {
    ADMIN: "bg-primary/10 text-primary", TEACHER: "bg-green-50 text-green-700",
    STUDENT: "bg-orange-50 text-orange-700", PARENT: "bg-purple-50 text-purple-700",
    EMPLOYEE: "bg-cyan-50 text-cyan-700",
  };

  const filteredNotifications = notifications.filter(n => {
    if (!sessionRole) return false;
    if (n.recipientRole !== sessionRole) return false;
    // Notifications targeted at a specific person (recipientEmail set) must match
    // the logged-in user's own email — a role-wide notification (no recipientEmail)
    // is visible to everyone with that role (e.g. admin broadcasts).
    if (n.recipientEmail && n.recipientEmail !== sessionEmail) return false;
    return true;
  });
  const unreadCount = filteredNotifications.filter(n => !n.read).length;
  const toggleSidebar = useCallback(() => setSidebarCollapsed(v => !v), []);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = searchQuery.trim();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchDebounceRef.current = setTimeout(() => {
      globalSearchDB(q).then(results => {
        setSearchResults(results);
        setSearchLoading(false);
      });
    }, 250);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setSearchOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const [recentConversations, setRecentConversations] = useState<ConversationSummary[]>([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  useEffect(() => {
    const load = () => {
      if (document.hidden) return;
      fetchConversationsDB().then(setRecentConversations);
      fetchUnreadMessageCountDB().then(setUnreadMessageCount);
    };
    load();
    const interval = setInterval(load, 60000);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  // Admin-only: surfaces unresolved server-action failures (Settings → Error
  // Log) so a silently-failing production write is actually noticed, not just
  // sitting in a table nobody queries.
  const [unresolvedErrorCount, setUnresolvedErrorCount] = useState(0);
  useEffect(() => {
    if (sessionRole !== "ADMIN") return;
    const load = () => { if (!document.hidden) fetchUnresolvedErrorCountAction().then(setUnresolvedErrorCount); };
    load();
    const interval = setInterval(load, 120000);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", load);
    };
  }, [sessionRole]);

  // Radix generates its dropdown trigger/content ids via React's useId, which is
  // only stable when the SSR tree shape and the client's first-paint tree shape
  // match exactly. Mounting these four DropdownMenus only after hydration means
  // the server (and the client's initial render, before this effect fires) both
  // render the same plain trigger button with no Radix ids at all — nothing left
  // to mismatch. The swap to the interactive version happens as a normal post-
  // hydration state update, not during hydration itself.
  const [headerMenusReady, setHeaderMenusReady] = useState(false);
  useEffect(() => setHeaderMenusReady(true), []);

  return (
    <SidebarCollapseCtx.Provider value={{ collapsed: sidebarCollapsed, toggle: toggleSidebar }}>
      <div className="flex min-h-screen w-full bg-background">
        <Suspense fallback={<div className="w-[280px] h-full bg-card border-r border-border" />}>
          <AppSidebar />
        </Suspense>
        <div
          className="flex flex-1 flex-col transition-all duration-200 ease-linear"
          style={{ marginLeft: sidebarCollapsed ? 68 : 280 }}
        >
          {/* Header */}
          <header className="sticky top-4 z-30 mx-4 glass-header h-[72px] flex items-center gap-4 px-5">
            <button
              onClick={toggleSidebar}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground transition-colors shrink-0"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Search */}
            <div className="relative flex-1 max-w-md" ref={searchBoxRef}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t("common.searchPlaceholder")}
                className="h-10 pl-10 bg-secondary/50 border-0 text-sm placeholder:text-muted-foreground rounded-full focus-visible:ring-2 focus-visible:ring-ring/40"
                onFocus={() => setSearchOpen(true)}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchOpen && searchQuery.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 glass-panel shadow-lg p-2 max-h-80 overflow-y-auto">
                  {searchQuery.trim().length < 2 ? (
                    <p className="text-xs text-muted-foreground p-3 text-center">Keep typing to search…</p>
                  ) : searchLoading ? (
                    <div className="flex items-center justify-center gap-2 p-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Searching…</span>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 text-center">No results found for "{searchQuery.trim()}"</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {searchResults.map(r => {
                        const Icon = searchResultIcon[r.type];
                        return (
                          <Link
                            key={`${r.type}-${r.id}`}
                            href={r.href}
                            onClick={() => setSearchOpen(false)}
                            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/60 transition-colors"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/70 text-muted-foreground">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold text-foreground truncate">{r.title}</span>
                              <span className="block text-[10px] text-muted-foreground truncate">{r.subtitle}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {sessionRole === "OWNER" && ownerBranches.length > 0 && (
                <Select value={ownerViewBranchId || "ALL"} onValueChange={v => { setOwnerViewBranchId(v === "ALL" ? "" : v); handleOwnerBranchChange(v); }}>
                  <SelectTrigger className="h-10 w-[180px] rounded-full bg-secondary/50 border-0 text-xs">
                    <Building2 className="h-3.5 w-3.5 shrink-0 mr-1" />
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Branches</SelectItem>
                    {ownerBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <LanguageSwitcher />

              {/* Unresolved error alert (admin only) */}
              {isAdmin && unresolvedErrorCount > 0 && (
                <Link
                  href="/settings?tab=errors"
                  title={`${unresolvedErrorCount} unresolved server error${unresolvedErrorCount === 1 ? "" : "s"}`}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive shadow-sm hover:bg-destructive/20 transition-colors"
                >
                  <AlertOctagon className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                    {unresolvedErrorCount > 9 ? "9+" : unresolvedErrorCount}
                  </span>
                </Link>
              )}

              {/* Notifications */}
              {(() => {
                const trigger = (
                  <button className="relative flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground transition-colors">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                );
                if (!headerMenusReady) return trigger;
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[380px] p-0 border-0 shadow-2xl rounded-2xl overflow-hidden">
                      <div className="p-4 bg-card border-b border-border flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{t("common.notifications")}</span>
                        {unreadCount > 0 && (
                          <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">{unreadCount} {t("common.new")}</span>
                        )}
                      </div>
                      <ScrollArea className="h-[320px]">
                        {filteredNotifications.length === 0 ? (
                          <div className="p-10 text-center"><Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground" /><p className="text-xs text-muted-foreground">{t("common.noNotifications")}</p></div>
                        ) : (
                          <div className="divide-y divide-border">
                            {filteredNotifications.map(n => (
                              <div key={n.id} onClick={() => markNotificationRead(n.id)}
                                className={`p-4 cursor-pointer transition-colors ${n.read ? "bg-card hover:bg-secondary/40" : "bg-secondary border-l-2 border-primary"}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <span className={`text-xs font-semibold ${n.read ? "text-muted-foreground" : "text-foreground"}`}>{n.title}</span>
                                  <span className="text-[10px] text-muted-foreground shrink-0">{n.date}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })()}

              {/* Messages */}
              {(() => {
                const trigger = (
                  <button className="relative flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground transition-colors">
                    <MessageSquare className="h-4 w-4" />
                    {unreadMessageCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                        {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                      </span>
                    )}
                  </button>
                );
                if (!headerMenusReady) return trigger;
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[340px] p-0 border-0 shadow-2xl rounded-2xl overflow-hidden">
                      <div className="p-4 bg-card border-b border-border flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{t("common.messages")}</span>
                        {unreadMessageCount > 0 && (
                          <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">{unreadMessageCount} {t("common.unread")}</span>
                        )}
                      </div>
                      <ScrollArea className="h-[280px]">
                        {recentConversations.length === 0 ? (
                          <div className="p-10 text-center"><MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" /><p className="text-xs text-muted-foreground">{t("common.noConversations")}</p></div>
                        ) : (
                          <div className="divide-y divide-border">
                            {recentConversations.slice(0, 6).map(c => (
                              <Link key={c.conversationId} href="/messages" className="block p-4 hover:bg-secondary/40 transition-colors">
                                <div className="flex items-start justify-between gap-2">
                                  <span className={`text-xs font-semibold ${c.unreadCount > 0 ? "text-foreground" : "text-muted-foreground"}`}>{c.otherUserName}</span>
                                  <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(c.lastMessageAt)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">{c.lastMessage || "No messages yet"}</p>
                              </Link>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                      <Link href="/messages" className="block p-3 text-center text-xs font-semibold text-primary hover:bg-secondary/40 transition-colors border-t border-border">
                        {t("common.viewAllMessages")}
                      </Link>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })()}

              {/* Quick Actions */}
              {(() => {
                const trigger = (
                  <button className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground transition-colors">
                    <Zap className="h-4 w-4" />
                  </button>
                );
                if (!headerMenusReady) return trigger;
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 border-0 shadow-2xl rounded-2xl p-1">
                      {["Add Student", "Mark Attendance", "Create Fee Voucher", "Generate Result", "Add Teacher"].map(action => (
                        <DropdownMenuItem key={action} className="text-xs font-medium rounded-xl cursor-pointer">
                          {tn(action)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })()}

              {/* Profile */}
              {(() => {
                const trigger = (
                  <button className="flex items-center gap-2 pl-1 pr-3 h-10 rounded-full bg-secondary/60 shadow-sm hover:bg-secondary transition-colors">
                    <Avatar className="h-8 w-8 shrink-0 border-2 border-card shadow-sm">
                      {profilePhoto && <AvatarImage src={profilePhoto} alt={displayName} className="object-cover" />}
                      <AvatarFallback className={`text-[10px] font-bold ${roleBadgeStyle[displayRole]}`}>{displayInitials}</AvatarFallback>
                    </Avatar>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-semibold leading-none text-foreground">{displayName}</p>
                      <span className="text-[9px] text-muted-foreground">{tn(roleLabel[displayRole] || displayRole)}</span>
                    </div>
                  </button>
                );
                if (!headerMenusReady) return trigger;
                return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 border-0 shadow-2xl rounded-2xl p-1">
                  <div className="p-3 mb-1">
                    <p className="text-sm font-semibold text-foreground">{displayName}</p>
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 ${roleBadgeStyle[displayRole]}`}>
                      {tn(roleLabel[displayRole] || displayRole)}
                    </span>
                  </div>
                  <DropdownMenuItem asChild className="rounded-xl text-xs font-medium cursor-pointer">
                    <Link href="/profile" className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> {t("common.myProfile")}</Link>
                  </DropdownMenuItem>
                  {canSettings("settings.view") && (
                    <DropdownMenuItem asChild className="rounded-xl text-xs font-medium cursor-pointer">
                      <Link href="/settings" className="flex items-center gap-2"><Settings className="h-3.5 w-3.5" /> {t("common.settings")}</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {isAdmin && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">{t("common.switchRole")}</div>
                      {(["ADMIN", "TEACHER", "STUDENT"] as const).map(role => (
                        <DropdownMenuItem key={role} onClick={() => setActiveRole(role)}
                          className="flex items-center justify-between rounded-xl text-xs font-medium cursor-pointer">
                          <span>{tn(roleLabel[role])}</span>
                          {activeRole === role && <Check className="h-3 w-3 text-primary" />}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()} className="rounded-xl text-xs font-medium text-destructive cursor-pointer flex items-center gap-2">
                    <LogOut className="h-3.5 w-3.5" /> {t("common.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
                );
              })()}
            </div>
          </header>

          {/* Main Content */}
          <main ref={mainRef} onScroll={handleMainScroll} className="flex-1 p-6 overflow-y-auto page-enter">
            {isDbLoaded && <Breadcrumbs />}
            {!isDbLoaded ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-7 w-40" />
                  <Skeleton className="h-10 w-36 rounded-md" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1"><Skeleton className="h-6 w-16 mb-1" /><Skeleton className="h-3 w-20" /></div>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            ) : <div key={contentKey}>{children}</div>}
          </main>
        </div>
      </div>
      {process.env.NODE_ENV === "development" && (
        <Agentation
          enableDemoMode
          onSubmit={(output: string, annotations: any[]) => {
            console.log("[Agentation] submitted:", { output, annotations });
          }}
        />
      )}
    </SidebarCollapseCtx.Provider>
  );
}
