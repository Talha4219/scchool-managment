"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { fetchClassesDB, fetchTermExamsDB, fetchExamSubjectsDB } from "@/app/actions/academic-core";
import {
  fetchOnlineExamsDB, createOnlineExamDB, updateOnlineExamDB, deleteOnlineExamDB,
  fetchAvailableOnlineExamsForStudentDB, fetchMyOnlineExamAttemptDB,
  fetchOnlineExamQuestionsDB, createOnlineExamQuestionDB, deleteOnlineExamQuestionDB,
  fetchOnlineExamAttemptsDB, gradeOnlineExamAnswerDB,
  type OnlineExamAttemptView,
} from "@/app/actions/features";
import type { OnlineExam, OnlineExamQuestion, ClassItem } from "@/lib/types";
import { getSession } from "@/app/actions/auth";
import { Laptop2, Plus, Trash2, Clock, ListChecks, Users, PlayCircle, CheckCircle2, Pencil } from "lucide-react";

const statusBadge: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground",
  Scheduled: "bg-blue-100 text-blue-700",
  Ongoing: "bg-amber-100 text-amber-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
};

const emptyQuestion: { type: OnlineExamQuestion["type"]; question: string; options: string[]; correctAnswer: string; marks: string } =
  { type: "MCQ", question: "", options: ["", "", "", ""], correctAnswer: "", marks: "5" };

export default function OnlineExamsPage() {
  const { can, loaded: permsLoaded } = usePermission();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => { getSession().then(s => setRole(s?.role ?? null)); }, []);

  const isStaff = role === "ADMIN" || role === "TEACHER" || role === "PRINCIPAL" || role === "OWNER";
  const isStudent = role === "STUDENT";

  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [myAttempts, setMyAttempts] = useState<Record<string, OnlineExamAttemptView | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    if (isStaff) {
      const [ex, cls] = await Promise.all([fetchOnlineExamsDB(), fetchClassesDB()]);
      setExams(ex);
      setClasses(cls);
    } else if (isStudent) {
      const ex = await fetchAvailableOnlineExamsForStudentDB();
      setExams(ex);
      const attempts = await Promise.all(ex.map(e => fetchMyOnlineExamAttemptDB(e.id)));
      const map: Record<string, OnlineExamAttemptView | null> = {};
      ex.forEach((e, i) => { map[e.id] = attempts[i]; });
      setMyAttempts(map);
    }
    setLoading(false);
  }, [isStaff, isStudent]);

  useEffect(() => { if (role) load(); }, [role, load]);

  // ── Create exam ──────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", className: "", subject: "", duration: "30", passingMarks: "40", startTime: "", endTime: "", instructions: "", linkedTermExamId: "", examSubjectId: "" });
  const [termExams, setTermExams] = useState<{ id: string; name: string }[]>([]);
  const [examSubjectOptions, setExamSubjectOptions] = useState<{ id: string; subjectId: string; subjectName?: string }[]>([]);

  useEffect(() => { if (createOpen) fetchTermExamsDB().then(setTermExams); }, [createOpen]);
  useEffect(() => {
    if (!form.linkedTermExamId) { setExamSubjectOptions([]); return; }
    fetchExamSubjectsDB(form.linkedTermExamId).then(setExamSubjectOptions);
  }, [form.linkedTermExamId]);

  const handleCreate = async () => {
    if (!form.title || !form.className || !form.subject || !form.startTime || !form.endTime) {
      toast({ title: "Fill in all required fields", variant: "destructive" }); return;
    }
    const res = await createOnlineExamDB({
      title: form.title, className: form.className, subject: form.subject,
      duration: Number(form.duration), totalMarks: 0, passingMarks: Number(form.passingMarks),
      startTime: form.startTime, endTime: form.endTime, instructions: form.instructions,
      proctoringEnabled: false, shuffleQuestions: false, status: "Draft",
      examSubjectId: form.examSubjectId || null,
    });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Exam created — add questions before publishing." });
    setCreateOpen(false);
    setForm({ title: "", className: "", subject: "", duration: "30", passingMarks: "40", startTime: "", endTime: "", instructions: "", linkedTermExamId: "", examSubjectId: "" });
    load();
  };

  const handlePublish = async (exam: OnlineExam) => {
    const res = await updateOnlineExamDB(exam.id, { status: "Scheduled" });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Exam published — students in this class can now see it." });
    load();
  };

  const handleCancel = async (exam: OnlineExam) => {
    const res = await updateOnlineExamDB(exam.id, { status: "Cancelled" });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Exam cancelled." });
    load();
  };

  const handleDelete = async (exam: OnlineExam) => {
    const ok = await confirm({ title: `Delete "${exam.title}"?`, description: "This permanently removes the exam, its questions, and any student attempts. This cannot be undone." });
    if (!ok) return;
    const res = await deleteOnlineExamDB(exam.id);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Exam deleted." });
    load();
  };

  // ── Manage dialog: questions + attempts ─────────────────────────────────
  const [manageExam, setManageExam] = useState<OnlineExam | null>(null);
  const [questions, setQuestions] = useState<OnlineExamQuestion[]>([]);
  const [attempts, setAttempts] = useState<OnlineExamAttemptView[]>([]);
  const [newQ, setNewQ] = useState(emptyQuestion);

  const openManage = async (exam: OnlineExam) => {
    setManageExam(exam);
    const [qs, at] = await Promise.all([fetchOnlineExamQuestionsDB(exam.id, { includeAnswers: true }), fetchOnlineExamAttemptsDB(exam.id)]);
    setQuestions(qs);
    setAttempts(at);
  };

  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  const handleAddQuestion = async () => {
    if (!manageExam) return;
    if (!newQ.question.trim()) { toast({ title: "Question text is required", variant: "destructive" }); return; }
    if ((newQ.type === "MCQ") && newQ.options.filter(o => o.trim()).length < 2) {
      toast({ title: "MCQ needs at least 2 options", variant: "destructive" }); return;
    }
    if (newQ.type !== "Essay" && newQ.type !== "ShortAnswer" && !newQ.correctAnswer.trim()) {
      toast({ title: "Set the correct answer for auto-grading", variant: "destructive" }); return;
    }
    const res = await createOnlineExamQuestionDB({
      examId: manageExam.id, type: newQ.type, question: newQ.question,
      options: newQ.type === "MCQ" ? newQ.options.filter(o => o.trim()) : newQ.type === "TrueFalse" ? ["True", "False"] : [],
      correctAnswer: newQ.correctAnswer, marks: Number(newQ.marks) || 1,
    });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    const qs = await fetchOnlineExamQuestionsDB(manageExam.id, { includeAnswers: true });
    setQuestions(qs);
    await updateOnlineExamDB(manageExam.id, { totalMarks: qs.reduce((s, q) => s + q.marks, 0) });
    setNewQ(emptyQuestion);
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!manageExam) return;
    const ok = await confirm({ title: "Delete this question?", description: "Removes it from the exam permanently. Any existing student answers to it are also deleted." });
    if (!ok) return;
    await deleteOnlineExamQuestionDB(id);
    const qs = await fetchOnlineExamQuestionsDB(manageExam.id, { includeAnswers: true });
    setQuestions(qs);
    await updateOnlineExamDB(manageExam.id, { totalMarks: qs.reduce((s, q) => s + q.marks, 0) });
  };

  const handleGrade = async (attemptId: string, questionId: string, marks: number) => {
    const res = await gradeOnlineExamAnswerDB(attemptId, questionId, marks);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    if (manageExam) setAttempts(await fetchOnlineExamAttemptsDB(manageExam.id));
  };

  if (!permsLoaded || !role) return null;
  if (!can("exams.online")) return <Unauthorized message="You don't have access to online exams." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Laptop2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Online Exams</h1>
            <p className="text-sm text-muted-foreground">
              {isStudent ? "Timed tests assigned to your class." : "Timed, auto-graded tests with a question bank."}
            </p>
          </div>
        </div>
        {isStaff && (
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Create Exam</Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{isStudent ? "Your Exams" : "All Exams"}</CardTitle>
          <CardDescription>{isStudent ? "Start when the window opens; auto-submits when time runs out." : "Publish an exam once its questions are ready."}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : exams.length === 0 ? (
            <div className="py-16 text-center">
              <Laptop2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{isStudent ? "No exams assigned yet." : "No online exams yet — create one to get started."}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Class / Subject</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">{isStudent ? "" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map(exam => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{exam.className} · {exam.subject}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(exam.startTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {" – "}
                      {new Date(exam.endTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-sm"><Clock className="h-3 w-3 inline mr-1 text-muted-foreground" />{exam.duration} min</TableCell>
                    <TableCell><Badge className={statusBadge[exam.status]} variant="secondary">{exam.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {isStaff ? (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => openManage(exam)}><ListChecks className="h-3.5 w-3.5 mr-1" /> Manage</Button>
                          {exam.status === "Draft" && (
                            <Button size="sm" onClick={() => handlePublish(exam)}>Publish</Button>
                          )}
                          {(exam.status === "Scheduled" || exam.status === "Ongoing") && (
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleCancel(exam)}>Cancel</Button>
                          )}
                          {exam.status === "Draft" && (
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(exam)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          )}
                        </div>
                      ) : (
                        <StudentExamAction exam={exam} attempt={myAttempts[exam.id] ?? null} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create exam dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Online Exam</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mid-Term Physics Quiz" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Class</Label>
                <Select value={form.className} onValueChange={v => setForm({ ...form, className: v })}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Physics" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Duration (minutes)</Label>
                <Input type="number" min="1" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Passing marks</Label>
                <Input type="number" min="0" value={form.passingMarks} onChange={e => setForm({ ...form, passingMarks: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Opens</Label>
                <Input type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Closes</Label>
                <Input type="datetime-local" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Instructions (optional)</Label>
              <Textarea value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1.5 border-t pt-3">
              <Label>Count toward a real exam result? (optional)</Label>
              <p className="text-xs text-muted-foreground">Link this quiz to a term exam's subject slot and a submitted score writes into that student's marks — otherwise this stays a standalone practice quiz.</p>
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.linkedTermExamId} onValueChange={v => setForm({ ...form, linkedTermExamId: v, examSubjectId: "" })}>
                  <SelectTrigger><SelectValue placeholder="No term exam" /></SelectTrigger>
                  <SelectContent>{termExams.map(te => <SelectItem key={te.id} value={te.id}>{te.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={form.examSubjectId} onValueChange={v => setForm({ ...form, examSubjectId: v })} disabled={!form.linkedTermExamId}>
                  <SelectTrigger><SelectValue placeholder="Select subject slot" /></SelectTrigger>
                  <SelectContent>{examSubjectOptions.map(es => <SelectItem key={es.id} value={es.id}>{es.subjectName || es.subjectId}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Exam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage dialog: question bank + attempts */}
      <Dialog open={!!manageExam} onOpenChange={o => !o && setManageExam(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{manageExam?.title}</DialogTitle>
          </DialogHeader>
          {manageExam && (
            <Tabs defaultValue="questions">
              <TabsList>
                <TabsTrigger value="questions">Questions ({questions.length}) · {totalMarks} marks</TabsTrigger>
                <TabsTrigger value="attempts">Attempts ({attempts.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="questions" className="space-y-4 pt-3">
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {questions.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No questions yet.</p>}
                  {questions.map((q, i) => (
                    <div key={q.id} className="border border-border rounded-lg p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{i + 1}. {q.type} · {q.marks} marks</p>
                        <p className="text-sm font-medium truncate">{q.question}</p>
                        {q.options.length > 0 && <p className="text-xs text-muted-foreground mt-0.5">Options: {q.options.join(", ")}</p>}
                        <p className="text-xs text-green-700 mt-0.5">Answer: {q.correctAnswer || "(manual grading)"}</p>
                      </div>
                      <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => handleDeleteQuestion(q.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-4 space-y-2.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Question</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Select value={newQ.type} onValueChange={(v: any) => setNewQ({ ...emptyQuestion, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MCQ">Multiple Choice</SelectItem>
                        <SelectItem value="TrueFalse">True / False</SelectItem>
                        <SelectItem value="ShortAnswer">Short Answer (manual grading)</SelectItem>
                        <SelectItem value="Essay">Essay (manual grading)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" min="1" placeholder="Marks" value={newQ.marks} onChange={e => setNewQ({ ...newQ, marks: e.target.value })} />
                  </div>
                  <Textarea placeholder="Question text" value={newQ.question} onChange={e => setNewQ({ ...newQ, question: e.target.value })} rows={2} />
                  {newQ.type === "MCQ" && (
                    <div className="space-y-1.5">
                      {newQ.options.map((opt, i) => (
                        <Input key={i} placeholder={`Option ${i + 1}`} value={opt}
                          onChange={e => { const opts = [...newQ.options]; opts[i] = e.target.value; setNewQ({ ...newQ, options: opts }); }} />
                      ))}
                      <Select value={newQ.correctAnswer} onValueChange={v => setNewQ({ ...newQ, correctAnswer: v })}>
                        <SelectTrigger><SelectValue placeholder="Correct option" /></SelectTrigger>
                        <SelectContent>{newQ.options.filter(o => o.trim()).map((o, i) => <SelectItem key={i} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  {newQ.type === "TrueFalse" && (
                    <Select value={newQ.correctAnswer} onValueChange={v => setNewQ({ ...newQ, correctAnswer: v })}>
                      <SelectTrigger><SelectValue placeholder="Correct answer" /></SelectTrigger>
                      <SelectContent><SelectItem value="True">True</SelectItem><SelectItem value="False">False</SelectItem></SelectContent>
                    </Select>
                  )}
                  <Button size="sm" variant="outline" onClick={handleAddQuestion}><Plus className="h-3.5 w-3.5 mr-1" /> Add Question</Button>
                </div>
              </TabsContent>

              <TabsContent value="attempts" className="pt-3">
                {attempts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No students have attempted this exam yet.</p>
                ) : (
                  <div className="space-y-3">
                    {attempts.map(a => (
                      <div key={a.id} className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">{a.studentName}</p>
                            <p className="text-xs text-muted-foreground">{a.status} · Score {a.score}/{totalMarks}</p>
                          </div>
                          <Badge variant="secondary" className={a.status === "Graded" ? "bg-green-100 text-green-700" : a.status === "Submitted" ? "bg-amber-100 text-amber-700" : "bg-secondary"}>{a.status}</Badge>
                        </div>
                        {a.status === "Submitted" && (
                          <div className="mt-2 space-y-1.5">
                            {a.answers.filter(ans => questions.find(q => q.id === ans.questionId && (q.type === "Essay" || q.type === "ShortAnswer"))).map(ans => {
                              const q = questions.find(qq => qq.id === ans.questionId)!;
                              return (
                                <div key={ans.questionId} className="bg-secondary/40 rounded p-2">
                                  <p className="text-xs text-muted-foreground">{q.question}</p>
                                  <p className="text-sm">{ans.answer || <span className="italic text-muted-foreground">No answer</span>}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Input type="number" min="0" max={q.marks} className="h-7 w-20 text-xs"
                                      defaultValue={ans.marksObtained ?? 0}
                                      onBlur={e => handleGrade(a.id, ans.questionId, Number(e.target.value))} />
                                    <span className="text-xs text-muted-foreground">/ {q.marks} marks</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudentExamAction({ exam, attempt }: { exam: OnlineExam; attempt: OnlineExamAttemptView | null }) {
  const now = Date.now();
  const opens = new Date(exam.startTime).getTime();
  const closes = new Date(exam.endTime).getTime();

  if (attempt?.status === "Graded") {
    return <Badge className="bg-green-100 text-green-700" variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" />Score: {attempt.score}</Badge>;
  }
  if (attempt?.status === "Submitted") {
    return <Badge className="bg-amber-100 text-amber-700" variant="secondary">Awaiting grading</Badge>;
  }
  if (attempt?.status === "InProgress") {
    return <Link href={`/exams/online/${exam.id}/take`}><Button size="sm"><PlayCircle className="h-3.5 w-3.5 mr-1" /> Resume</Button></Link>;
  }
  if (now < opens) return <span className="text-xs text-muted-foreground">Opens soon</span>;
  if (now > closes) return <span className="text-xs text-muted-foreground">Window closed</span>;
  return <Link href={`/exams/online/${exam.id}/take`}><Button size="sm"><PlayCircle className="h-3.5 w-3.5 mr-1" /> Start Exam</Button></Link>;
}
