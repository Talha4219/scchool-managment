"use client";

import { useState, useEffect, useCallback, useRef, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  fetchOnlineExamsDB, fetchOnlineExamQuestionsDB, startOnlineExamAttemptDB,
  saveOnlineExamAnswerDB, submitOnlineExamAttemptDB, fetchMyOnlineExamAttemptDB,
  type OnlineExamAttemptView,
} from "@/app/actions/features";
import type { OnlineExam, OnlineExamQuestion } from "@/lib/types";
import { Clock, CheckCircle2, AlertTriangle } from "lucide-react";

function formatClock(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TakeOnlineExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = usePromise(params);
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<OnlineExam | null>(null);
  const [questions, setQuestions] = useState<OnlineExamQuestion[]>([]);
  const [attempt, setAttempt] = useState<OnlineExamAttemptView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // Starts above zero so the auto-submit effect can't fire before the real
  // countdown (anchored to the timer effect below) computes its first tick.
  const [remainingMs, setRemainingMs] = useState<number>(Number.POSITIVE_INFINITY);
  const [result, setResult] = useState<{ score: number; totalMarks: number } | null>(null);
  const submittingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    const exams = await fetchOnlineExamsDB().catch(() => []);
    // Staff-only list — students resolve exam details through their own attempt/question fetch instead.
    let ex = exams.find(e => e.id === examId) || null;

    const started = await startOnlineExamAttemptDB(examId);
    if (started.error) {
      setError(started.error);
      setLoading(false);
      return;
    }
    setAttempt(started.attempt || null);

    const qs = await fetchOnlineExamQuestionsDB(examId);
    setQuestions(qs);

    if (started.attempt) {
      const map: Record<string, string> = {};
      started.attempt.answers.forEach(a => { map[a.questionId] = a.answer; });
      setAnswers(map);
    }

    if (!ex) {
      // Fallback: student may not have staff-level list access; derive a minimal
      // view from the attempt + questions already fetched.
      ex = null;
    }
    setExam(ex);
    setLoading(false);
  }, [examId]);

  useEffect(() => { load(); }, [load]);

  // Timer — anchored to the attempt's real startedAt, so a page refresh can't extend it.
  useEffect(() => {
    if (!attempt || !exam) return;
    const deadline = new Date(attempt.startedAt).getTime() + exam.duration * 60 * 1000;
    const tick = () => setRemainingMs(deadline - Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [attempt, exam]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    if (attempt) saveOnlineExamAnswerDB(attempt.id, questionId, value);
  };

  const handleSubmit = useCallback(async (auto = false) => {
    if (!attempt || submittingRef.current) return;
    submittingRef.current = true;
    const res = await submitOnlineExamAttemptDB(attempt.id);
    if (res.error) {
      toast({ title: res.error, variant: "destructive" });
      submittingRef.current = false;
      return;
    }
    setResult({ score: res.score ?? 0, totalMarks: res.totalMarks ?? 0 });
    if (auto) toast({ title: "Time's up — your exam was submitted automatically." });
  }, [attempt, toast]);

  // Auto-submit the instant the clock hits zero.
  useEffect(() => {
    if (attempt?.status === "InProgress" && remainingMs <= 0) handleSubmit(true);
  }, [remainingMs, attempt, handleSubmit]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh] text-sm text-muted-foreground">Loading exam…</div>;
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
        <p className="text-sm text-foreground font-medium">{error}</p>
        <Button variant="outline" onClick={() => router.push("/exams/online")}>Back to Online Exams</Button>
      </div>
    );
  }

  if (result || attempt?.status === "Submitted" || attempt?.status === "Graded") {
    const graded = attempt?.status === "Graded";
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <CheckCircle2 className="h-10 w-10 mx-auto text-green-600" />
        <h1 className="text-lg font-bold text-foreground">Exam Submitted</h1>
        {graded || result ? (
          <p className="text-sm text-muted-foreground">
            Your score: <span className="font-semibold text-foreground">{result?.score ?? attempt?.score}</span>
            {result?.totalMarks ? ` / ${result.totalMarks}` : ""}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Some answers need manual grading — your final score will appear once your teacher reviews them.</p>
        )}
        <Button onClick={() => router.push("/exams/online")}>Back to Online Exams</Button>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).filter(k => answers[k]?.trim()).length;
  const timeCritical = remainingMs < 60_000;

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
      <Card className="sticky top-4 z-10 shadow-md">
        <CardContent className="py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{exam?.title || "Online Exam"}</p>
            <p className="text-xs text-muted-foreground">{answeredCount}/{questions.length} answered</p>
          </div>
          <Badge variant="secondary" className={timeCritical ? "bg-red-100 text-red-700" : "bg-secondary"}>
            <Clock className="h-3 w-3 mr-1" /> {Number.isFinite(remainingMs) ? formatClock(remainingMs) : "--:--"}
          </Badge>
        </CardContent>
        <Progress value={(answeredCount / Math.max(1, questions.length)) * 100} className="h-1 rounded-none" />
      </Card>

      {questions.map((q, i) => (
        <Card key={q.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-start justify-between gap-2">
              <span>{i + 1}. {q.question}</span>
              <span className="text-xs font-normal text-muted-foreground shrink-0">{q.marks} marks</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {q.type === "MCQ" && (
              <RadioGroup value={answers[q.id] || ""} onValueChange={v => handleAnswerChange(q.id, v)}>
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2 py-1">
                    <RadioGroupItem value={opt} id={`${q.id}-${oi}`} />
                    <Label htmlFor={`${q.id}-${oi}`} className="font-normal cursor-pointer">{opt}</Label>
                  </div>
                ))}
              </RadioGroup>
            )}
            {q.type === "TrueFalse" && (
              <RadioGroup value={answers[q.id] || ""} onValueChange={v => handleAnswerChange(q.id, v)}>
                {["True", "False"].map(opt => (
                  <div key={opt} className="flex items-center gap-2 py-1">
                    <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                    <Label htmlFor={`${q.id}-${opt}`} className="font-normal cursor-pointer">{opt}</Label>
                  </div>
                ))}
              </RadioGroup>
            )}
            {(q.type === "ShortAnswer" || q.type === "Essay") && (
              <Textarea
                placeholder="Type your answer…"
                value={answers[q.id] || ""}
                onChange={e => handleAnswerChange(q.id, e.target.value)}
                rows={q.type === "Essay" ? 5 : 2}
              />
            )}
          </CardContent>
        </Card>
      ))}

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur p-4 flex justify-end">
        <div className="max-w-2xl w-full mx-auto flex justify-end">
          <Button onClick={() => handleSubmit(false)} size="lg">Submit Exam</Button>
        </div>
      </div>
    </div>
  );
}
