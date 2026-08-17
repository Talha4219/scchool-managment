"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useStudents } from "@/lib/students-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { getSession } from "@/app/actions/auth";
import {
  fetchAssignmentsDB, createAssignmentDB, deleteAssignmentDB,
  fetchSubmissionsDB, submitAssignmentDB, gradeSubmissionDB,
  type Assignment, type AssignmentSubmission,
} from "@/app/actions/features";
import { fetchTeacherAssignmentsDB, fetchEnrollmentsDB } from "@/app/actions/academic-core";
import { ClipboardList, Plus, Trash2, Eye, Send, Star, CheckCircle2, Clock, Paperclip, Download } from "lucide-react";

type TeacherAssignmentRow = { classId: string; className: string; sectionId: string; sectionName: string; subjectId: string; subjectName: string };

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AssignmentsPage() {
  const { students } = useStudents();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { can, loaded: permsLoaded } = usePermission();

  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<number | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewSubs, setViewSubs] = useState<{ assignment: Assignment; subs: AssignmentSubmission[] } | null>(null);
  const [submitOpen, setSubmitOpen] = useState<Assignment | null>(null);
  const [gradeTarget, setGradeTarget] = useState<AssignmentSubmission | null>(null);
  const [mySubmissions, setMySubmissions] = useState<Record<string, AssignmentSubmission>>({});

  const [teacherRows, setTeacherRows] = useState<TeacherAssignmentRow[]>([]);
  const [myEnrollment, setMyEnrollment] = useState<{ classId: string; sectionId: string } | null>(null);

  const [form, setForm] = useState({ title: "", description: "", dueDate: "", classId: "", subjectId: "" });
  const [formFile, setFormFile] = useState<File | null>(null);
  const [submitNotes, setSubmitNotes] = useState("");
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [grade, setGrade] = useState(""); const [feedback, setFeedback] = useState("");

  const myStudent = useMemo(() => students.find(s => s.email === sessionEmail && s.status === "Active"), [students, sessionEmail]);

  useEffect(() => {
    getSession().then(s => {
      setSessionRole(s?.role ?? null);
      setSessionUserId(typeof s?.userId === "number" ? s.userId : Number(s?.userId) || null);
      setSessionEmail(s?.email ?? null);
      setSessionName(s?.name ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    if (!sessionRole) return;
    setLoading(true);

    if (sessionRole === "TEACHER" && sessionUserId) {
      const rows = await fetchTeacherAssignmentsDB(sessionUserId);
      setTeacherRows(rows as TeacherAssignmentRow[]);
      const data = await fetchAssignmentsDB(undefined, undefined, { teacherId: sessionUserId });
      setAssignments(data);
    } else if (sessionRole === "STUDENT" && myStudent) {
      const enrollments = await fetchEnrollmentsDB(undefined, undefined, myStudent.id);
      const mine = enrollments[0];
      if (mine) {
        setMyEnrollment({ classId: mine.classId, sectionId: mine.sectionId });
        const data = await fetchAssignmentsDB(undefined, undefined, { classId: mine.classId });
        setAssignments(data);
        const subMap: Record<string, AssignmentSubmission> = {};
        await Promise.all(data.map(async a => {
          const subs = await fetchSubmissionsDB(a.id);
          const mine2 = subs.find(s => s.studentId === myStudent.id);
          if (mine2) subMap[a.id] = mine2;
        }));
        setMySubmissions(subMap);
      } else {
        setAssignments([]);
      }
    } else if (sessionRole === "ADMIN") {
      setAssignments(await fetchAssignmentsDB());
    }
    setLoading(false);
  }, [sessionRole, sessionUserId, myStudent]);

  useEffect(() => { load(); }, [load]);

  const availableSubjects = useMemo(() => {
    const rows = teacherRows.filter(r => r.classId === form.classId);
    const seen = new Map<string, string>();
    rows.forEach(r => seen.set(r.subjectId, r.subjectName));
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [teacherRows, form.classId]);

  const availableClasses = useMemo(() => {
    const seen = new Map<string, string>();
    teacherRows.forEach(r => seen.set(r.classId, r.className));
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [teacherRows]);

  const handleCreate = async () => {
    if (!form.title || !form.dueDate || !form.classId || !form.subjectId) {
      toast({ title: "Please fill all required fields.", variant: "destructive" }); return;
    }
    const row = teacherRows.find(r => r.classId === form.classId && r.subjectId === form.subjectId);
    let attachmentData: string | undefined; let attachmentName: string | undefined;
    if (formFile) { attachmentData = await readAsDataURL(formFile); attachmentName = formFile.name; }
    const res = await createAssignmentDB({
      title: form.title, description: form.description, dueDate: form.dueDate,
      classId: form.classId, sectionId: row?.sectionId, subjectId: form.subjectId,
      attachmentData, attachmentName,
    });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Assignment created." });
    setCreateOpen(false);
    setForm({ title: "", description: "", dueDate: "", classId: "", subjectId: "" });
    setFormFile(null);
    load();
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this assignment?",
      description: "Students will no longer see it, and any submissions already turned in for it will be deleted too. This cannot be undone.",
    });
    if (!ok) return;
    const res = await deleteAssignmentDB(id);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Assignment deleted." });
    load();
  };

  const handleViewSubs = async (a: Assignment) => {
    const subs = await fetchSubmissionsDB(a.id);
    setViewSubs({ assignment: a, subs });
  };

  const handleSubmit = async () => {
    if (!submitOpen) return;
    let attachmentData: string | undefined; let attachmentName: string | undefined;
    if (submitFile) { attachmentData = await readAsDataURL(submitFile); attachmentName = submitFile.name; }
    const res = await submitAssignmentDB({ assignmentId: submitOpen.id, notes: submitNotes, attachmentData, attachmentName });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Assignment submitted!" });
    setSubmitOpen(null); setSubmitNotes(""); setSubmitFile(null);
    load();
  };

  const handleGrade = async () => {
    if (!gradeTarget) return;
    const res = await gradeSubmissionDB(gradeTarget.id, grade, feedback);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Graded successfully." });
    setGradeTarget(null); setGrade(""); setFeedback("");
    if (viewSubs) handleViewSubs(viewSubs.assignment);
  };

  const isPastDue = (d: string) => new Date(d) < new Date();

  if (!permsLoaded) return null;
  if (!can("assignments.view")) return <Unauthorized />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Assignments</h1>
          <p className="text-muted-foreground mt-1">{sessionRole === "TEACHER" ? "Manage your class assignments" : "Your pending and completed assignments"}</p>
        </div>
        {sessionRole === "TEACHER" && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New Assignment</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Assignment</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Assignment title" /></div>
                <div className="space-y-1"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Instructions for students..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Class *</Label>
                    <Select value={form.classId} onValueChange={v => setForm(f => ({ ...f, classId: v, subjectId: "" }))}>
                      <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>{availableClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Subject *</Label>
                    <Select value={form.subjectId} onValueChange={v => setForm(f => ({ ...f, subjectId: v }))} disabled={!form.classId}>
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>{availableSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1"><Label>Due Date *</Label><Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Attachment (optional)</Label><Input type="file" onChange={e => setFormFile(e.target.files?.[0] ?? null)} /></div>
              </div>
              <DialogFooter><Button onClick={handleCreate}>Create Assignment</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <Card key={i} className="border-none shadow-sm"><CardHeader><div className="flex items-start justify-between"><div><Skeleton className="h-5 w-40 mb-1" /><Skeleton className="h-3 w-24" /></div><Skeleton className="h-6 w-20 rounded-full" /></div></CardHeader><CardContent><Skeleton className="h-4 w-full mb-1" /><Skeleton className="h-4 w-2/3 mb-3" /><div className="flex items-center gap-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-20" /></div></CardContent></Card>)}</div>
      ) : assignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <ClipboardList className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium">No assignments found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map(a => {
            const submitted = mySubmissions[a.id];
            const overdue = isPastDue(a.dueDate);
            return (
              <Card key={a.id} className="border-none shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-primary">{a.title}</span>
                        <Badge variant="outline" className="text-xs">{a.subject}</Badge>
                        <Badge variant="outline" className="text-xs">{a.className}</Badge>
                        {a.attachmentName && <Badge variant="outline" className="text-xs gap-1"><Paperclip className="h-3 w-3" />{a.attachmentName}</Badge>}
                        {sessionRole === "STUDENT" && (
                          submitted
                            ? <Badge className="bg-green-100 text-green-700 border-0 text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Submitted{submitted.grade ? ` · ${submitted.grade}` : ""}{submitted.isLate ? " · Late" : ""}</Badge>
                            : overdue
                              ? <Badge className="bg-red-100 text-red-700 border-0 text-xs">Overdue</Badge>
                              : <Badge className="bg-orange-100 text-orange-700 border-0 text-xs gap-1"><Clock className="h-3 w-3" />Pending</Badge>
                        )}
                      </div>
                      {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">Due: {a.dueDate} · Teacher: {a.teacherName}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {sessionRole === "TEACHER" && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleViewSubs(a)}><Eye className="h-3 w-3" />Submissions</Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => handleDelete(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </>
                      )}
                      {sessionRole === "STUDENT" && (!submitted || !submitted.gradedAt) && (
                        <Button size="sm" className="gap-1 text-xs" onClick={() => setSubmitOpen(a)}><Send className="h-3 w-3" />{submitted ? "Resubmit" : "Submit"}</Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Submissions Dialog */}
      <Dialog open={!!viewSubs} onOpenChange={o => !o && setViewSubs(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Submissions — {viewSubs?.assignment.title}</DialogTitle></DialogHeader>
          {viewSubs?.subs.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No submissions yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Submitted</TableHead><TableHead>Grade</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {viewSubs?.subs.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.studentName}{s.isLate && <Badge className="ml-2 bg-red-100 text-red-700 border-0 text-xs">Late</Badge>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.submittedAt}</TableCell>
                    <TableCell>{s.grade ? <Badge className="bg-green-100 text-green-700 border-0">{s.grade}</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                    <TableCell><Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => { setGradeTarget(s); setGrade(s.grade ?? ""); setFeedback(s.feedback ?? ""); }}><Star className="h-3 w-3" />Grade</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Submit Dialog */}
      <Dialog open={!!submitOpen} onOpenChange={o => !o && setSubmitOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit — {submitOpen?.title}</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <div className="space-y-2"><Label>Notes / Answer</Label><Textarea rows={4} value={submitNotes} onChange={e => setSubmitNotes(e.target.value)} placeholder="Write your answer or notes..." /></div>
            <div className="space-y-1"><Label>Attachment (optional)</Label><Input type="file" onChange={e => setSubmitFile(e.target.files?.[0] ?? null)} /></div>
          </div>
          <DialogFooter><Button onClick={handleSubmit}>Submit Assignment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grade Dialog */}
      <Dialog open={!!gradeTarget} onOpenChange={o => !o && setGradeTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Grade — {gradeTarget?.studentName}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {gradeTarget?.notes && <div className="p-3 bg-secondary/20 rounded-lg text-sm"><p className="font-medium text-xs text-muted-foreground mb-1">Student notes:</p>{gradeTarget.notes}</div>}
            {gradeTarget?.attachmentData && gradeTarget?.attachmentName && (
              <a href={gradeTarget.attachmentData} download={gradeTarget.attachmentName} className="flex items-center gap-1 text-sm text-primary underline"><Download className="h-3.5 w-3.5" />{gradeTarget.attachmentName}</a>
            )}
            <div className="space-y-1"><Label>Grade (e.g. A, B+, 85/100)</Label><Input value={grade} onChange={e => setGrade(e.target.value)} placeholder="Enter grade" /></div>
            <div className="space-y-1"><Label>Feedback</Label><Textarea rows={3} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Feedback for student..." /></div>
          </div>
          <DialogFooter><Button onClick={handleGrade}>Save Grade</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
