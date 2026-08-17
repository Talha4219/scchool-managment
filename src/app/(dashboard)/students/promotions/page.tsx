"use client";

import { useState, useEffect } from "react";
import { getSession } from "@/app/actions/auth";
import {
  fetchAcademicYearsDB, fetchClassesDB, fetchSectionsByClassDB,
  fetchPromotionCandidatesDB, bulkPromoteStudentsDB, fetchPromotionBatchesDB,
  type PromotionCandidate, type PromotionDecision, type BulkPromotionResult, type PromotionBatch,
} from "@/app/actions/academic-core";
import type { AcademicYear, ClassItem, SectionItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, ArrowRight, ChevronLeft, CheckCircle2, AlertTriangle, History } from "lucide-react";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";

type Outcome = "promoted" | "retained" | "withdrawn";
type Step = "setup" | "review" | "result";

// Required-field marker — the site-wide convention: red asterisk on the
// label, paired with a disabled-until-valid button instead of a toast that
// only fires after the user has already tried to submit.
const Req = () => <span className="text-destructive">*</span>;

export default function PromotionsPage() {
  const { can, loaded } = usePermission();
  const { toast } = useToast();

  const [sessionUserId, setSessionUserId] = useState<number | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  useEffect(() => { getSession().then(s => { setSessionUserId(s?.userId ?? null); setSessionName(s?.name ?? null); }); }, []);

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [step, setStep] = useState<Step>("setup");

  // Source
  const [fromYearId, setFromYearId] = useState("");
  const [fromClasses, setFromClasses] = useState<ClassItem[]>([]);
  const [fromClassId, setFromClassId] = useState("");
  const [fromSections, setFromSections] = useState<SectionItem[]>([]);
  const [fromSectionId, setFromSectionId] = useState("");
  const [isGraduating, setIsGraduating] = useState(false);
  const [sourceClassName, setSourceClassName] = useState("");

  // Target
  const [toYearId, setToYearId] = useState("");
  const [toClasses, setToClasses] = useState<ClassItem[]>([]);
  const [toClassId, setToClassId] = useState("");
  const [toSections, setToSections] = useState<SectionItem[]>([]);
  const [toSectionId, setToSectionId] = useState("");
  const [toSectionAutoPicked, setToSectionAutoPicked] = useState(false);

  // Review
  const [candidates, setCandidates] = useState<PromotionCandidate[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [batchRemarks, setBatchRemarks] = useState("");
  const [rowNoteOpen, setRowNoteOpen] = useState<Record<string, boolean>>({});
  const [rowRemarks, setRowRemarks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkPromotionResult | null>(null);

  const [history, setHistory] = useState<PromotionBatch[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    fetchAcademicYearsDB().then(y => {
      setYears(y);
      const active = y.find(x => x.isActive) || y[0];
      if (active) setFromYearId(active.id);
    });
  }, []);

  useEffect(() => { if (fromYearId) fetchClassesDB(fromYearId).then(setFromClasses); }, [fromYearId]);
  useEffect(() => {
    if (fromClassId) fetchSectionsByClassDB(fromClassId).then(setFromSections);
    else setFromSections([]);
    setFromSectionId("");
  }, [fromClassId]);

  useEffect(() => { if (toYearId) fetchClassesDB(toYearId).then(setToClasses); }, [toYearId]);
  useEffect(() => {
    if (toClassId) fetchSectionsByClassDB(toClassId).then(setToSections);
    else setToSections([]);
    setToSectionId("");
    setToSectionAutoPicked(false);
  }, [toClassId]);

  // Same-section convenience: once the target class's sections load, if one
  // shares the source section's name (the common "9-A -> 10-A" case), pick
  // it automatically — still fully editable, this just saves the click.
  useEffect(() => {
    if (toSectionAutoPicked || !toSections.length || !fromSections.length || !fromSectionId) return;
    const fromName = fromSections.find(s => s.id === fromSectionId)?.name;
    const match = fromName && toSections.find(s => s.name === fromName);
    if (match) { setToSectionId(match.id); setToSectionAutoPicked(true); }
  }, [toSections, fromSections, fromSectionId, toSectionAutoPicked]);

  const setupValid = isGraduating
    ? !!(fromClassId && fromSectionId && toYearId)
    : !!(fromClassId && fromSectionId && toYearId && toClassId && toSectionId);

  const goToReview = async () => {
    const res = await fetchPromotionCandidatesDB(fromClassId, fromSectionId);
    setCandidates(res.candidates);
    setSourceClassName(res.className);
    setOutcomes(Object.fromEntries(res.candidates.map(c => [c.enrollmentId, "promoted" as Outcome])));
    setBatchRemarks(""); setRowNoteOpen({}); setRowRemarks({});
    if (res.candidates.length === 0) { toast({ title: "No active students in this section.", variant: "destructive" }); return; }
    setStep("review");
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    const decisions: PromotionDecision[] = candidates.map(c => ({
      enrollmentId: c.enrollmentId, studentId: c.studentId, outcome: outcomes[c.enrollmentId] || "promoted",
      remarks: rowNoteOpen[c.enrollmentId] ? (rowRemarks[c.enrollmentId] || undefined) : undefined,
    }));
    const res = await bulkPromoteStudentsDB({
      fromClassId, fromSectionId, fromAcademicYearId: fromYearId,
      toClassId: isGraduating ? undefined : toClassId, toSectionId: isGraduating ? undefined : toSectionId, toAcademicYearId: toYearId,
      isGraduating, decisions, promotedByUserId: sessionUserId || undefined, promotedByName: sessionName || undefined,
      batchRemarks: batchRemarks || undefined,
    });
    setSubmitting(false);
    setResult(res);
    setStep("result");
  };

  const loadHistory = async () => { setHistory(await fetchPromotionBatchesDB()); setHistoryOpen(true); };

  const resetAll = () => {
    setStep("setup"); setFromClassId(""); setToClassId(""); setIsGraduating(false);
    setCandidates([]); setOutcomes({}); setResult(null); setBatchRemarks(""); setRowNoteOpen({}); setRowRemarks({});
  };

  const summary = { promoted: 0, retained: 0, withdrawn: 0 };
  Object.values(outcomes).forEach(o => { summary[o]++; });

  if (!loaded) return <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading...</div>;
  if (!can("students.edit")) return <Unauthorized />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Student Promotion</h1>
          <p className="text-muted-foreground mt-1">Move a whole section into the next academic year, with per-student overrides.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={loadHistory}><History className="h-4 w-4" /> Batch History</Button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        {(["setup", "review", "result"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`h-6 w-6 rounded-full flex items-center justify-center ${step === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
            <span className={step === s ? "text-foreground" : ""}>{s === "setup" ? "Setup" : s === "review" ? "Review" : "Result"}</span>
            {i < 2 && <ArrowRight className="h-3 w-3" />}
          </div>
        ))}
      </div>

      {step === "setup" && (
        <div className="soft-card p-6 space-y-5 max-w-3xl">
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground">From</h3>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Academic Year <Req /></Label>
                <Select value={fromYearId} onValueChange={setFromYearId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Class <Req /></Label>
                <Select value={fromClassId} onValueChange={v => { setFromClassId(v); setIsGraduating(!!fromClasses.find(c => c.id === v)?.isGraduating); }}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{fromClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.isGraduating ? " (Graduating)" : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Section <Req /></Label>
                <Select value={fromSectionId} onValueChange={setFromSectionId} disabled={!fromClassId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{fromSections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground">{isGraduating ? "Graduation" : "To"}</h3>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">{isGraduating ? "Graduation Year" : "Academic Year"} <Req /></Label>
                <Select value={toYearId} onValueChange={setToYearId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {!isGraduating && (
                <>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Class <Req /></Label>
                    <Select value={toClassId} onValueChange={setToClassId} disabled={!toYearId}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{toClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Section <Req /> {toSectionAutoPicked && <span className="text-primary font-normal">· auto-matched</span>}
                    </Label>
                    <Select value={toSectionId} onValueChange={v => { setToSectionId(v); setToSectionAutoPicked(false); }} disabled={!toClassId}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{toSections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </div>

          {isGraduating && (
            <div className="flex items-start gap-2 rounded-lg bg-primary/10 border border-primary/20 p-2.5">
              <GraduationCap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground">This class is marked as graduating — students promoted from here will be moved to Alumni instead of a next class.</p>
            </div>
          )}
          <div className="flex justify-end">
            <Button disabled={!setupValid} onClick={goToReview}>Next: Review Roster</Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="soft-card p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-foreground">Review — {sourceClassName} ({candidates.length} students)</h3>
            <div className="flex gap-2 text-xs">
              <Badge className="bg-success/15 text-success">{summary.promoted} {isGraduating ? "Graduating" : "Promoted"}</Badge>
              <Badge className="bg-warning/15 text-warning">{summary.retained} Retained</Badge>
              <Badge className="bg-destructive/15 text-destructive">{summary.withdrawn} Withdrawn</Badge>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Batch Remarks (optional — applies to every student below unless overridden)</Label>
            <Textarea
              value={batchRemarks} onChange={e => setBatchRemarks(e.target.value)}
              placeholder="e.g. Promoted per Term 2 result meeting"
              className="text-sm min-h-[60px]"
            />
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs text-muted-foreground sticky top-0">
                <tr><th className="text-left px-4 py-2">Roll</th><th className="text-left px-4 py-2">Student</th><th className="text-right px-4 py-2">Outcome</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates.map(c => (
                  <tr key={c.enrollmentId}>
                    <td className="px-4 py-2 text-muted-foreground align-top">{c.rollNumber}</td>
                    <td className="px-4 py-2 font-medium text-foreground align-top">
                      {c.studentName}
                      {rowNoteOpen[c.enrollmentId] ? (
                        <Input
                          value={rowRemarks[c.enrollmentId] || ""}
                          onChange={e => setRowRemarks(prev => ({ ...prev, [c.enrollmentId]: e.target.value }))}
                          placeholder="Note for this student"
                          className="h-7 text-xs mt-1 max-w-xs"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRowNoteOpen(prev => ({ ...prev, [c.enrollmentId]: true }))}
                          className="block text-[11px] text-primary hover:underline mt-0.5"
                        >
                          + Note
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right align-top">
                      <Select value={outcomes[c.enrollmentId]} onValueChange={v => setOutcomes(prev => ({ ...prev, [c.enrollmentId]: v as Outcome }))}>
                        <SelectTrigger className="h-8 w-36 ml-auto text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="promoted">{isGraduating ? "Graduate" : "Promote"}</SelectItem>
                          {!isGraduating && <SelectItem value="retained">Retain</SelectItem>}
                          <SelectItem value="withdrawn">Withdraw</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" className="gap-1" onClick={() => setStep("setup")}><ChevronLeft className="h-3.5 w-3.5" /> Back</Button>
            <Button onClick={handleConfirm} disabled={submitting}>{submitting ? "Processing..." : `Confirm ${candidates.length} Students`}</Button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="soft-card p-6 space-y-4 max-w-xl">
          {result.error ? (
            <div className="flex items-start gap-2 text-destructive"><AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><p className="text-sm">{result.error}</p></div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-success"><CheckCircle2 className="h-5 w-5" /><p className="text-sm font-semibold">{result.succeeded?.length || 0} student(s) processed successfully.</p></div>
              {result.failed && result.failed.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-warning">{result.failed.length} student(s) could not be processed:</p>
                  {result.failed.map((f, i) => (
                    <div key={i} className="rounded-lg bg-warning/10 border border-warning/30 p-2 text-xs text-foreground">{f.studentId}: {f.reason}</div>
                  ))}
                </div>
              )}
            </>
          )}
          <Button onClick={resetAll}>Start Another Batch</Button>
        </div>
      )}

      {/* History */}
      {historyOpen && (
        <div className="soft-card p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Promotion Batch History</h3>
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(false)}>Close</Button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No promotion batches yet.</p>}
            {history.map(b => (
              <div key={b.id} className="flex items-center justify-between rounded-xl bg-secondary/40 p-3 text-xs">
                <div>
                  <p className="font-semibold text-foreground">{b.isGraduating ? "Graduation batch" : "Promotion batch"} — {new Date(b.createdAt).toLocaleDateString()}</p>
                  <p className="text-muted-foreground mt-0.5">By {b.promotedByName || "—"}</p>
                </div>
                <div className="flex gap-1.5">
                  <Badge className="bg-success/15 text-success">{b.promotedCount}</Badge>
                  <Badge className="bg-warning/15 text-warning">{b.retainedCount}</Badge>
                  <Badge className="bg-destructive/15 text-destructive">{b.withdrawnCount}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
