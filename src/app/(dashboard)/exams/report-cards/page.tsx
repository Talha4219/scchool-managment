"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FileText, ArrowLeft, Download, RefreshCw, Loader2, Pencil, Printer } from "lucide-react";
import { motion } from "framer-motion";
import { useAppState } from "@/lib/state-context";
import { ReportCard } from "@/components/report-card";
import {
  fetchAcademicYearsDB, fetchClassesDB,
  fetchStudentsForDropdownDB,
  generateReportCardDB, generateBatchReportCardsDB,
  regenerateReportCardDB, updateReportCardRemarksDB,
  fetchReportCardsDB, computeTermResultsDB, fetchTermConfigsDB,
} from "@/app/actions/academic-core";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function ReportCardsPage() {
  const { can, loaded } = usePermission();
  const { toast } = useToast();
  const { schoolInfo } = useAppState();
  const [activeYearId, setActiveYearId] = useState("");
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [allStudents, setAllStudents] = useState<{ id: string; name: string; classId: string | null; className: string }[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [studentForRC, setStudentForRC] = useState("");
  const [selectedRC, setSelectedRC] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [editingRemarks, setEditingRemarks] = useState("");
  const [savingRemarks, setSavingRemarks] = useState(false);
  const [computingTerms, setComputingTerms] = useState(false);
  const [termReady, setTermReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [years, cls] = await Promise.all([fetchAcademicYearsDB(), fetchClassesDB()]);
      const active = years.find(y => y.isActive) || years[0];
      if (active) setActiveYearId(active.id);
      setClasses(cls.map(c => ({ id: c.id, name: c.name })));
    })();
  }, []);

  useEffect(() => {
    fetchStudentsForDropdownDB(selectedClassId || undefined).then(setAllStudents);
  }, [selectedClassId]);

  const loadReportCards = useCallback(async () => {
    if (!activeYearId) return;
    setReportCards(await fetchReportCardsDB(activeYearId));
  }, [activeYearId]);

  useEffect(() => { loadReportCards(); }, [loadReportCards]);

  const handleGenerateRC = async () => {
    if (!studentForRC) { toast({ title: "Select a student", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      const rc = await generateReportCardDB(studentForRC, activeYearId);
      if (rc) {
        setStudentForRC("");
        toast({ title: "Report card generated" });
        loadReportCards();
        setSelectedRC(rc);
      } else {
        toast({ title: "Failed to generate", variant: "destructive" });
      }
    } finally { setGenerating(false); }
  };

  const handleGenerateAll = async () => {
    setGenerating(true);
    try {
      const res = await generateBatchReportCardsDB(activeYearId, selectedClassId || undefined);
      toast({ title: `Generated ${res.generated} report card${res.generated !== 1 ? "s" : ""}` });
      loadReportCards();
    } finally { setGenerating(false); }
  };

  const handleRegenerate = async (rcId: string) => {
    setRegenerating(rcId);
    try {
      const rc = await regenerateReportCardDB(rcId);
      if (rc) {
        toast({ title: "Report card regenerated" });
        loadReportCards();
        setSelectedRC(rc);
      } else {
        toast({ title: "Failed to regenerate", variant: "destructive" });
      }
    } finally { setRegenerating(null); }
  };

  const handleSaveRemarks = async () => {
    if (!selectedRC) return;
    setSavingRemarks(true);
    try {
      const ok = await updateReportCardRemarksDB(selectedRC.id, editingRemarks);
      if (ok) {
        toast({ title: "Remarks saved" });
        setSelectedRC({ ...selectedRC, remarks: editingRemarks });
        loadReportCards();
      }
    } finally { setSavingRemarks(false); }
  };

  const handleComputeTerms = async () => {
    if (!activeYearId) return;
    setComputingTerms(true);
    try {
      const res = await computeTermResultsDB(activeYearId);
      setTermReady(true);
      toast({ title: `Computed ${res.computed} term result${res.computed !== 1 ? "s" : ""}` });
    } finally { setComputingTerms(false); }
  };

  useEffect(() => {
    fetchTermConfigsDB().then(cfgs => setTermReady(cfgs.some(c => c.termOrder > 0 && !c.isOptional)));
  }, []);

  const filteredStudents = allStudents;

  if (!loaded) return <PageSkeleton />;
  if (!can("exams.report-cards")) return <Unauthorized />;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/exams" className="p-2 hover:bg-slate-100 rounded-lg transition"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Report Cards</h1>
          <p className="text-sm text-[#64748B] mt-1">Generate and view student report cards</p>
        </div>
      </div>

      {/* Generate Controls */}
      <Card className="border-[#E5E7EB]">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-[#64748B] mb-1 block">Class (optional for batch)</label>
              <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v === "all" ? "" : v); setStudentForRC(""); }}>
                <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-[#64748B] mb-1 block">Individual Student</label>
              <Select value={studentForRC} onValueChange={setStudentForRC}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {filteredStudents.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateRC} disabled={generating || !studentForRC}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              Generate
            </Button>
            <Button variant="outline" onClick={handleGenerateAll} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              Generate All{selectedClassId ? " (Class)" : ""}
            </Button>
            <Button variant="outline" onClick={handleComputeTerms} disabled={computingTerms} className="ml-auto">
              {computingTerms ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              {termReady ? "Recompute Term Results" : "Compute Term Results"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Card List */}
      {reportCards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reportCards.map(rc => (
            <Card key={rc.id} className="border-[#E5E7EB] hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => { setSelectedRC(rc); setEditingRemarks(rc.remarks || ""); }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[#2563EB]" />
                    <span className="font-medium">{rc.studentName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={rc.overallGrade === "F" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>
                      {rc.overallGrade}
                    </Badge>
                    {rc.isPromoted !== undefined && (
                      <Badge className={rc.isPromoted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                        {rc.isPromoted ? "Promoted" : "Not Promoted"}
                      </Badge>
                    )}
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); handleRegenerate(rc.id); }}
                      disabled={regenerating === rc.id}
                    >
                      {regenerating === rc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-[#64748B] space-y-1">
                  <p>Year: {rc.academicYearName}</p>
                  <p>Class: {rc.className || "—"} {rc.sectionName ? `/ ${rc.sectionName}` : ""}</p>
                  <p>Percentage: {rc.totalPercentage}%</p>
                  {rc.classPosition && <p>Position: {rc.classPosition} of {rc.classTotal}</p>}
                  {Array.isArray(rc.termResults) && rc.termResults.length > 0 && (
                    <p>Terms: {rc.termResults.map((t: any) => t.termName).join(", ")}</p>
                  )}
                  <p>Generated: {rc.generatedAt}</p>
                  {rc.remarks && <p className="italic text-slate-500 truncate">Remarks: {rc.remarks}</p>}
                </div>
                {rc.needsRegeneration && (
                  <Badge variant="outline" className="mt-2 border-amber-400 text-amber-700 bg-amber-50 text-[10px] gap-1">
                    <RefreshCw className="h-2.5 w-2.5" /> Stale — marks changed since generation
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-[#94A3B8]">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No report cards generated yet</p>
        </div>
      )}

      {/* Report Card Viewer Dialog */}
      <Dialog open={!!selectedRC} onOpenChange={() => setSelectedRC(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Report Card — {selectedRC?.studentName}</DialogTitle>
            <Button
              size="sm" variant="outline"
              onClick={() => { if (selectedRC) handleRegenerate(selectedRC.id); }}
              disabled={regenerating === selectedRC?.id}
            >
              {regenerating === selectedRC?.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Regenerate
            </Button>
          </DialogHeader>
          {selectedRC && (
            <>
              <ReportCard
                studentName={selectedRC.studentName || selectedRC.student_name || "Student"}
                admissionNumber={selectedRC.admissionNumber || selectedRC.admission_number}
                className={selectedRC.className || ""}
                sectionName={selectedRC.sectionName || ""}
                academicYearName={selectedRC.academicYearName || selectedRC.academic_year_name || ""}
                examResults={selectedRC.examResults || []}
                totalPercentage={selectedRC.totalPercentage || 0}
                overallGrade={selectedRC.overallGrade || "F"}
                classPosition={selectedRC.classPosition}
                classTotal={selectedRC.classTotal}
                generatedAt={selectedRC.generatedAt || new Date().toISOString().split("T")[0]}
                remarks={editingRemarks}
                terms={selectedRC.termResults || []}
                annual={selectedRC.annual || null}
                schoolName={schoolInfo.name || "Classora"}
              />
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={`/print/report-cards/${selectedRC.id}?school=${encodeURIComponent(schoolInfo.name || "Classora")}`} target="_blank" rel="noopener noreferrer">
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print / Save PDF
                  </a>
                </Button>
              </div>
              {/* Remarks Editor */}
              <div className="mt-4 space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> Remarks
                </label>
                <Textarea
                  value={editingRemarks}
                  onChange={(e) => setEditingRemarks(e.target.value)}
                  placeholder="Add remarks about this student's performance..."
                  rows={3}
                />
                <Button size="sm" onClick={handleSaveRemarks} disabled={savingRemarks || editingRemarks === (selectedRC.remarks || "")}>
                  {savingRemarks ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                  Save Remarks
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
