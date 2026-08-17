"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppState } from "@/lib/state-context";
import { getSession } from "@/app/actions/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { fetchAnnouncementsDB, createAnnouncementDB, deleteAnnouncementDB, type Announcement } from "@/app/actions/features";
import { fetchAcademicYearsDB, fetchClassesDB, fetchTeacherAssignmentsDB } from "@/app/actions/academic-core";
import { Megaphone, Plus, Trash2, AlertTriangle, Info } from "lucide-react";

const priorityConfig = {
  normal:  { label: "Normal",  class: "bg-gray-100 text-gray-700" },
  high:    { label: "High",    class: "bg-orange-100 text-orange-700" },
  urgent:  { label: "Urgent",  class: "bg-red-100 text-red-700" },
};

export default function AnnouncementsPage() {
  const { schoolInfo } = useAppState();
  const { toast } = useToast();
  const confirm = useConfirm();

  // Real logged-in role — NOT the legacy `activeRole` demo role-switcher
  // (defaults to "ADMIN", never synced to the actual session).
  const [activeRole, setSessionRole] = useState<"ADMIN" | "TEACHER" | "STUDENT" | "PARENT" | "EMPLOYEE" | "OWNER" | "PRINCIPAL" | null>(null);
  const [sessionUserId, setSessionUserId] = useState<number | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  useEffect(() => {
    getSession().then(s => {
      setSessionRole((s?.role as any) ?? null);
      setSessionUserId(s?.userId ?? null);
      setSessionName(s?.name ?? null);
    });
  }, []);

  // Real relational classes — for Admin, every class this year; for Teacher,
  // only the classes they're actually assigned to teach.
  const [adminClasses, setAdminClasses] = useState<{ id: string; name: string }[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if ((activeRole === "ADMIN" || activeRole === "PRINCIPAL")) {
      fetchAcademicYearsDB().then(years => {
        const active = years.find(y => y.isActive) || years[0];
        if (active) fetchClassesDB(active.id).then(setAdminClasses);
      });
    } else if (activeRole === "TEACHER" && sessionUserId) {
      fetchTeacherAssignmentsDB(sessionUserId).then(assignments => {
        const seen = new Map<string, string>();
        for (const a of assignments) if (a.classId) seen.set(a.classId, a.className);
        setTeacherClasses(Array.from(seen, ([id, name]) => ({ id, name })));
      });
    }
  }, [activeRole, sessionUserId]);
  const classOptions = activeRole === "TEACHER" ? teacherClasses : adminClasses;

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", targetRole: "ALL", targetClass: "", priority: "normal" });

  const load = useCallback(async () => {
    if (!activeRole) return;
    setLoading(true);
    const data = await fetchAnnouncementsDB((activeRole === "ADMIN" || activeRole === "PRINCIPAL") ? undefined : activeRole, sessionUserId ?? undefined);
    setAnnouncements(data);
    setLoading(false);
  }, [activeRole, sessionUserId]);

  useEffect(() => { load(); }, [load]);

  const canCreate = (activeRole === "ADMIN" || activeRole === "PRINCIPAL") || activeRole === "TEACHER";

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: "Title and content are required.", variant: "destructive" }); return;
    }
    const res = await createAnnouncementDB({
      title: form.title, content: form.content,
      date: new Date().toISOString().split("T")[0],
      authorId: String(sessionUserId ?? "1"), authorName: sessionName || ((activeRole === "ADMIN" || activeRole === "PRINCIPAL") ? "Admin" : "Teacher"),
      targetRole: form.targetRole === "ALL" ? null : form.targetRole,
      targetClass: form.targetClass || null,
      priority: form.priority,
    });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Announcement posted." });
    setCreateOpen(false);
    setForm({ title: "", content: "", targetRole: "ALL", targetClass: "", priority: "normal" });
    load();
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this announcement?",
      description: "It will be removed from everyone's feed immediately. This cannot be undone.",
    });
    if (!ok) return;
    await deleteAnnouncementDB(id);
    toast({ title: "Announcement deleted." });
    load();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Announcements</h1>
          <p className="text-muted-foreground mt-1">School-wide communications for {schoolInfo.name}</p>
        </div>
        {canCreate && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Post Announcement</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title..." /></div>
                <div className="space-y-1"><Label>Content</Label><Textarea rows={4} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Write your announcement..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Target Audience</Label>
                    <Select value={form.targetRole} onValueChange={v => setForm(f => ({ ...f, targetRole: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Everyone</SelectItem>
                        <SelectItem value="TEACHER">Teachers Only</SelectItem>
                        <SelectItem value="STUDENT">Students Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Priority</Label>
                    <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {((activeRole === "ADMIN" || activeRole === "PRINCIPAL") || activeRole === "TEACHER") && (
                  <div className="space-y-1">
                    <Label>
                      {activeRole === "TEACHER" ? "Target Class (assigned only)" : "Specific Class (optional)"}
                    </Label>
                    <Select value={form.targetClass} onValueChange={v => setForm(f => ({ ...f, targetClass: v === "ALL" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
                      <SelectContent>
                        {(activeRole === "ADMIN" || activeRole === "PRINCIPAL") && <SelectItem value="ALL">All classes</SelectItem>}
                        {classOptions.length === 0 && (
                          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                            {activeRole === "TEACHER" ? "No classes assigned to you yet." : "No classes found."}
                          </div>
                        )}
                        {classOptions.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter><Button onClick={handleCreate}>Post Announcement</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <Card key={i} className="border-none shadow-sm"><CardHeader className="pb-2"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><div><Skeleton className="h-4 w-32 mb-1" /><Skeleton className="h-3 w-20" /></div></div></div></CardHeader><CardContent><Skeleton className="h-4 w-full mb-1" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>)}</div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <Megaphone className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium">No announcements yet.</p>
          {canCreate && <p className="text-sm text-muted-foreground">Post an announcement to notify staff and students.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(a => (
            <Card key={a.id} className={`border-none shadow-sm border-l-4 ${a.priority === "urgent" ? "border-l-red-500" : a.priority === "high" ? "border-l-orange-400" : "border-l-primary/30"}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-primary">{a.title}</span>
                      <Badge className={`${priorityConfig[a.priority as keyof typeof priorityConfig]?.class ?? ""} border-0 text-xs`}>
                        {priorityConfig[a.priority as keyof typeof priorityConfig]?.label}
                      </Badge>
                      {a.targetRole && <Badge variant="outline" className="text-xs">{a.targetRole}</Badge>}
                      {a.targetClass && <Badge variant="outline" className="text-xs">{a.targetClass}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{a.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">By {a.authorName} · {a.date}</p>
                  </div>
                  {(activeRole === "ADMIN" || activeRole === "PRINCIPAL") && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0" onClick={() => handleDelete(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
