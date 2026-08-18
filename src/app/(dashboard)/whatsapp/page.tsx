"use client";

import { useState, useEffect, useCallback } from "react";
import { getSession } from "@/app/actions/auth";
import { formatDatePK, formatDateTimePK } from "@/lib/date-format";
import { Unauthorized } from "@/components/unauthorized";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Send, History, LayoutTemplate, ListChecks, RefreshCw,
  Clock, CheckCircle2, XCircle, Loader2, Eye,
} from "lucide-react";
import {
  fetchWhatsAppTemplatesAction, updateWhatsAppTemplateStatusAction,
  fetchWhatsAppQueueStatsAction, processWhatsAppQueueNowAction,
  fetchWhatsAppNotificationHistoryAction, sendBulkNotificationAction,
  type WhatsAppTemplateRecord, type NotificationHistoryEntry,
} from "@/app/actions/whatsapp-notifications";
import type { NotificationType } from "@/lib/notification-service";
import { useActiveAcademicYearId, useClasses, useSections } from "@/hooks/use-academic-data";

const statusColor: Record<string, string> = {
  QUEUED: "bg-gray-100 text-gray-600", PROCESSING: "bg-blue-100 text-blue-700",
  SENT: "bg-indigo-100 text-indigo-700", DELIVERED: "bg-teal-100 text-teal-700",
  READ: "bg-green-100 text-green-700", FAILED: "bg-red-100 text-red-700", CANCELLED: "bg-gray-100 text-gray-500",
};

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: "STUDENT_ABSENCE", label: "Student Absence" },
  { value: "FEE_REMINDER", label: "Fee Reminder" },
  { value: "FEE_OVERDUE", label: "Fee Overdue" },
  { value: "EXAM_REMINDER", label: "Exam Reminder" },
  { value: "PTM_REMINDER", label: "Parent-Teacher Meeting" },
  { value: "SCHOOL_ANNOUNCEMENT", label: "School Announcement" },
  { value: "TEACHER_MEETING", label: "Teacher Meeting" },
  { value: "EVENT_REMINDER", label: "Event Reminder" },
];

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const { toast } = useToast();
  const [stats, setStats] = useState({ pending: 0, processing: 0, completed: 0, failed: 0, deadLetter: 0 });
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => { fetchWhatsAppQueueStatsAction().then(s => { setStats(s); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const handleProcessNow = async () => {
    setProcessing(true);
    const result = await processWhatsAppQueueNowAction();
    setProcessing(false);
    toast({ title: "Queue processed", description: `Claimed ${result.claimed} — ${result.sent} sent, ${result.retried} retried, ${result.failed} failed.` });
    load();
  };

  const cards = [
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-gray-600 bg-gray-50" },
    { label: "Processing", value: stats.processing, icon: Loader2, color: "text-blue-600 bg-blue-50" },
    { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
    { label: "Failed", value: stats.failed, icon: XCircle, color: "text-red-600 bg-red-50" },
    { label: "Dead Letter", value: stats.deadLetter, icon: XCircle, color: "text-amber-600 bg-amber-50" },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-none shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div><Skeleton className="h-6 w-8 mb-1" /><Skeleton className="h-3 w-14" /></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-72" /></div>
            <Skeleton className="h-9 w-40 rounded-md" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {cards.map(c => (
          <Card key={c.label} className="border-none shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${c.color}`}><c.icon className="h-4 w-4" /></div>
              <div><p className="text-xl font-bold text-primary">{c.value}</p><p className="text-[10px] text-muted-foreground">{c.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-none shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Queue Worker</p>
            <p className="text-xs text-muted-foreground">Postgres-backed queue with retry/backoff. Runs on a cron hitting /api/cron/whatsapp-queue, or manually below.</p>
          </div>
          <Button onClick={handleProcessNow} disabled={processing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${processing ? "animate-spin" : ""}`} /> {processing ? "Processing..." : "Process Queue Now"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Templates tab ─────────────────────────────────────────────────────────────
function TemplatesTab() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WhatsAppTemplateRecord[]>([]);
  const [viewing, setViewing] = useState<WhatsAppTemplateRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const load = () => { fetchWhatsAppTemplatesAction().then(t => { setTemplates(t); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const handleApprove = async (id: string) => {
    await updateWhatsAppTemplateStatusAction(id, "APPROVED");
    toast({ title: "Template marked approved" });
    load();
  };
  const handleReject = async (id: string) => {
    await updateWhatsAppTemplateStatusAction(id, "REJECTED");
    toast({ title: "Template marked rejected" });
    load();
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Message Templates</CardTitle>
        <CardDescription>Create each of these in Meta Business Manager with matching content, get it approved there, then mark it approved here — only approved templates can be used to send.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-secondary/20">
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Meta Template Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-7 w-20 ml-auto rounded" /></TableCell>
              </TableRow>
            ))}
            {!loading && templates.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-semibold">{t.name}</TableCell>
                <TableCell className="font-mono text-xs">{t.metaTemplateName}</TableCell>
                <TableCell className="text-xs">{t.category}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.variables.join(", ") || "—"}</TableCell>
                <TableCell>
                  <Badge className={`border-0 ${t.status === "APPROVED" ? "bg-green-100 text-green-700" : t.status === "REJECTED" ? "bg-red-100 text-red-700" : t.status === "DISABLED" ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"}`}>
                    {t.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDatePK(t.updatedAt)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" className="h-7 text-xs mr-1" onClick={() => setViewing(t)}><Eye className="h-3 w-3 mr-1" /> View</Button>
                  {t.status !== "APPROVED" && <Button size="sm" variant="outline" className="h-7 text-xs mr-1" onClick={() => handleApprove(t.id)}>Mark Approved</Button>}
                  {t.status !== "REJECTED" && <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleReject(t.id)}>Reject</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {viewing.name}
                  <Badge className={`border-0 ${viewing.status === "APPROVED" ? "bg-green-100 text-green-700" : viewing.status === "REJECTED" ? "bg-red-100 text-red-700" : viewing.status === "DISABLED" ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"}`}>
                    {viewing.status}
                  </Badge>
                </DialogTitle>
                {viewing.description && <DialogDescription>{viewing.description}</DialogDescription>}
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Meta Template Name</p>
                    <p className="font-mono text-xs mt-0.5">{viewing.metaTemplateName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Language</p>
                    <p className="mt-0.5">{viewing.language}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</p>
                    <p className="mt-0.5">{viewing.category}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Updated</p>
                    <p className="mt-0.5">{formatDateTimePK(viewing.updatedAt)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Variables</p>
                  {viewing.variables.length > 0 ? (
                    <div className="space-y-1">
                      {viewing.variables.map((v, i) => (
                        <div key={v} className="flex items-center gap-2 text-xs">
                          <span className="font-mono px-2 py-0.5 rounded-md bg-secondary/50 border">{`{{${i + 1}}}`}</span>
                          <span className="text-muted-foreground">← {v}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No variables — static message.</p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Template Body (paste into Meta)</p>
                    {viewing.body && (
                      <Button
                        size="sm" variant="ghost" className="h-6 text-[11px] px-2"
                        onClick={() => { navigator.clipboard.writeText(viewing.body!); toast({ title: "Copied to clipboard" }); }}
                      >
                        Copy
                      </Button>
                    )}
                  </div>
                  {viewing.body ? (
                    <pre className="rounded-xl border bg-secondary/20 p-3 text-xs leading-relaxed whitespace-pre-wrap font-mono">{viewing.body}</pre>
                  ) : (
                    <p className="text-xs text-muted-foreground">No body text saved for this template yet.</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1.5 italic">
                    Create this exact text as a {viewing.category} template named <span className="font-mono">{viewing.metaTemplateName}</span> ({viewing.language}) in Meta Business Manager, submit for review, then mark it Approved above once Meta confirms.
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── History tab ───────────────────────────────────────────────────────────────
function HistoryTab() {
  const [entries, setEntries] = useState<NotificationHistoryEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const load = useCallback(() => {
    fetchWhatsAppNotificationHistoryAction({
      status: statusFilter !== "ALL" ? statusFilter : undefined,
      notificationType: typeFilter !== "ALL" ? typeFilter : undefined,
    }).then(setEntries);
  }, [statusFilter, typeFilter]);
  useEffect(() => { load(); }, [load]);

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="text-base">Notification History</CardTitle>
          <CardDescription>Every notification created — including ones blocked before sending (opt-out, unapproved template).</CardDescription>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {["QUEUED", "PROCESSING", "SENT", "DELIVERED", "READ", "FAILED", "CANCELLED"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {NOTIFICATION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              <SelectItem value="TEST_MESSAGE">Test Message</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-secondary/20">
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Delivered</TableHead>
              <TableHead>Read</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(e => (
              <TableRow key={e.id}>
                <TableCell className="text-xs">
                  <div className="font-semibold">{e.recipientName || e.recipientId}</div>
                  <div className="text-muted-foreground">{e.recipientType}</div>
                </TableCell>
                <TableCell className="text-xs">{e.notificationType}</TableCell>
                <TableCell className="font-mono text-[10px]">{e.templateName || "—"}</TableCell>
                <TableCell className="text-xs">WHATSAPP</TableCell>
                <TableCell><Badge className={`border-0 ${statusColor[e.status] || "bg-gray-100 text-gray-600"}`}>{e.status}</Badge></TableCell>
                <TableCell className="text-[10px] text-muted-foreground">{formatDateTimePK(e.sentAt)}</TableCell>
                <TableCell className="text-[10px] text-muted-foreground">{formatDateTimePK(e.deliveredAt)}</TableCell>
                <TableCell className="text-[10px] text-muted-foreground">{formatDateTimePK(e.readAt)}</TableCell>
                <TableCell className="text-[10px] text-red-600 max-w-[200px] truncate" title={e.errorMessage || ""}>{e.errorMessage || "—"}</TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground text-sm">No notifications match this filter.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Send Notification tab ────────────────────────────────────────────────────
function SendTab() {
  const { toast } = useToast();
  const [type, setType] = useState<NotificationType>("SCHOOL_ANNOUNCEMENT");
  const [audienceKind, setAudienceKind] = useState<"CLASS" | "ALL_TEACHERS">("CLASS");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [scheduleAt, setScheduleAt] = useState("");
  const [sending, setSending] = useState(false);

  const template = NOTIFICATION_TYPES.find(t => t.value === type);

  const { activeYearId } = useActiveAcademicYearId();
  const { classes } = useClasses(activeYearId);
  const { sections } = useSections(classId || undefined);
  useEffect(() => { setSectionId(""); }, [classId]);

  const handleSend = async () => {
    setSending(true);
    const result = await sendBulkNotificationAction({
      type,
      audience: audienceKind === "ALL_TEACHERS" ? { kind: "ALL_TEACHERS" } : { kind: "CLASS", classId, sectionId: sectionId || undefined },
      data: variables,
      scheduledAt: scheduleAt || undefined,
    });
    setSending(false);
    if (result.queued > 0) {
      toast({ title: `Queued ${result.queued} notification(s)`, description: result.skipped > 0 ? `${result.skipped} skipped (opt-out/unapproved/no phone).` : undefined });
    } else {
      toast({ title: "Nothing was queued", description: result.errors[0] || "No recipients matched.", variant: "destructive" });
    }
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Send Notification</CardTitle>
        <CardDescription>Select a template and audience — each send is queued individually, so a partial failure never blocks the rest of the batch.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Template</Label>
            <Select value={type} onValueChange={v => setType(v as NotificationType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{NOTIFICATION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Audience</Label>
            <Select value={audienceKind} onValueChange={v => setAudienceKind(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CLASS">Class (Parents)</SelectItem>
                <SelectItem value="ALL_TEACHERS">All Teachers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {audienceKind === "CLASS" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Section (optional — all if blank)</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger><SelectValue placeholder="All sections" /></SelectTrigger>
                <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs mb-1.5 block">Template Variables (preview)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {["title", "message", "date", "time", "amount", "dueDate", "examName", "eventName"].map(key => (
              <Input key={key} placeholder={key} value={variables[key] || ""} onChange={e => setVariables(v => ({ ...v, [key]: e.target.value }))} className="text-xs" />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Only the variables the selected template actually uses are read — extras are ignored.</p>
        </div>

        <div>
          <Label className="text-xs">Schedule (optional — leave blank to send as soon as the queue worker next runs)</Label>
          <Input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} className="max-w-xs" />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSend} disabled={sending || (audienceKind === "CLASS" && !classId)} className="gap-2">
            <Send className="h-4 w-4" /> {sending ? "Queuing..." : scheduleAt ? "Schedule" : "Send Now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WhatsAppAdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => { getSession().then(s => setIsAdmin(s?.role === "ADMIN" || s?.role === "PRINCIPAL" || s?.role === "OWNER")); }, []);

  if (isAdmin === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-2xl" />
          <div><Skeleton className="h-6 w-56 mb-1.5" /><Skeleton className="h-3 w-80" /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }
  if (!isAdmin) return <Unauthorized />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center"><MessageSquare className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary font-headline">WhatsApp Notifications</h1>
          <p className="text-sm text-muted-foreground">Official Meta WhatsApp Business Platform — queue, templates, history, and manual sends.</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5"><ListChecks className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5"><LayoutTemplate className="h-3.5 w-3.5" /> Templates</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><History className="h-3.5 w-3.5" /> History</TabsTrigger>
          <TabsTrigger value="send" className="gap-1.5"><Send className="h-3.5 w-3.5" /> Send Notification</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
        <TabsContent value="templates" className="mt-4"><TemplatesTab /></TabsContent>
        <TabsContent value="history" className="mt-4"><HistoryTab /></TabsContent>
        <TabsContent value="send" className="mt-4"><SendTab /></TabsContent>
      </Tabs>
    </div>
  );
}
