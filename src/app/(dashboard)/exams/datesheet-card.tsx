"use client";

// Datesheet builder: one row per subject, one date/time for the whole
// class — every section sits the same paper at the same time, so there's
// exactly one thing to schedule per subject, not one per section. Click an
// empty row to fill it via a small popover (same interaction language as
// Timetable Management's cell popovers); click a filled row to edit it.

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CalendarDays, Download, AlertTriangle, Trash2, Plus } from "lucide-react";
import {
  fetchExamSchedulesDB, createExamSchedulesBulkDB, updateExamScheduleDB, deleteExamScheduleDB,
} from "@/app/actions/academic-core";
import type { TermExam, ExamSubjectItem, SectionItem } from "@/lib/types";
import { downloadCSV } from "@/lib/csv-export";

type ScheduleRow = Awaited<ReturnType<typeof fetchExamSchedulesDB>>[number];

function timesOverlap(aStart: string | null, aEnd: string | null, bStart: string | null, bEnd: string | null): boolean {
  // No time recorded on either side — can't rule out a clash, so treat it as
  // a potential conflict rather than silently ignoring it.
  if (!aStart || !aEnd || !bStart || !bEnd) return true;
  return aStart < bEnd && bStart < aEnd;
}

export function DatesheetCard({
  exam, examSubjects, sections, datesheet, onDatesheetChange,
}: {
  exam: TermExam | null;
  examSubjects: ExamSubjectItem[];
  sections: SectionItem[];
  datesheet: ScheduleRow[];
  onDatesheetChange: (rows: ScheduleRow[]) => void;
}) {
  const { toast } = useToast();
  const confirm = useConfirm();

  // Which subject's row popover is open — undefined means it's a fresh
  // (not-yet-scheduled) subject; set means editing an already-scheduled one.
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [isEditingActive, setIsEditingActive] = useState(false);
  // Carries over between rows so scheduling several papers in a row is
  // click, Add, click, Add — with the date already sitting there.
  const [rowForm, setRowForm] = useState({ examDate: exam?.startDate || "", startTime: "", endTime: "", roomNo: "" });
  const [saving, setSaving] = useState(false);

  // All sections share one entry per subject, so "the" entry for a subject
  // is whichever row happens to represent it (they're kept in sync).
  const entryFor = (subjectId: string) => datesheet.find(d => d.subjectId === subjectId);

  const openEmptyRow = (subjectId: string) => {
    setActiveSubjectId(subjectId);
    setIsEditingActive(false);
    setRowForm(f => ({ ...f, roomNo: entryFor(subjectId)?.roomNo || "" }));
  };

  const openExistingRow = (row: ScheduleRow) => {
    setActiveSubjectId(row.subjectId);
    setIsEditingActive(true);
    setRowForm({ examDate: row.examDate, startTime: row.startTime || "", endTime: row.endTime || "", roomNo: row.roomNo || "" });
  };

  // Conflicts for the row currently open: a different subject already
  // scheduled at an overlapping date/time for this class.
  const conflicts = useMemo(() => {
    if (!activeSubjectId || !rowForm.examDate) return [];
    const seen = new Set<string>();
    return datesheet.filter(d => {
      if (d.subjectId === activeSubjectId || seen.has(d.subjectId)) return false;
      const clash = d.examDate === rowForm.examDate && timesOverlap(d.startTime, d.endTime, rowForm.startTime || null, rowForm.endTime || null);
      if (clash) seen.add(d.subjectId);
      return clash;
    });
  }, [activeSubjectId, rowForm, datesheet]);

  const reload = async () => {
    if (!exam) return;
    onDatesheetChange(await fetchExamSchedulesDB(exam.id));
  };

  const handleSaveRow = async () => {
    if (!exam || !activeSubjectId || !rowForm.examDate) {
      toast({ title: "Pick a date", variant: "destructive" }); return;
    }
    setSaving(true);
    if (isEditingActive) {
      const existing = datesheet.filter(d => d.subjectId === activeSubjectId);
      const results = await Promise.all(existing.map(row => updateExamScheduleDB(row.id, {
        examDate: rowForm.examDate, startTime: rowForm.startTime || undefined, endTime: rowForm.endTime || undefined, roomId: undefined,
      })));
      setSaving(false);
      const failed = results.find(r => r.error);
      if (failed) { toast({ title: failed.error, variant: "destructive" }); return; }
      toast({ title: "Schedule updated" });
    } else {
      const res = await createExamSchedulesBulkDB({
        examId: exam.id, classId: exam.classId, sectionIds: sections.map(s => s.id),
        subjectId: activeSubjectId, examDate: rowForm.examDate,
        startTime: rowForm.startTime || undefined, endTime: rowForm.endTime || undefined,
      });
      setSaving(false);
      if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
      toast({ title: "Scheduled for all sections" });
    }
    await reload();
    setActiveSubjectId(null);
  };

  const handleDelete = async (subjectId: string, subjectName: string) => {
    const ok = await confirm({
      title: "Remove this paper from the datesheet?",
      description: `${subjectName} will be removed for every section.`,
    });
    if (!ok) return;
    const existing = datesheet.filter(d => d.subjectId === subjectId);
    await Promise.all(existing.map(row => deleteExamScheduleDB(row.id)));
    await reload();
    setActiveSubjectId(null);
    toast({ title: "Removed from datesheet" });
  };

  const handleExport = () => {
    if (examSubjects.length === 0) return;
    const rows = [...examSubjects]
      .map(es => ({ subject: es, entry: entryFor(es.subjectId) }))
      .sort((a, b) => (a.entry?.examDate || "9999").localeCompare(b.entry?.examDate || "9999") || (a.entry?.startTime || "").localeCompare(b.entry?.startTime || ""))
      .map(({ subject, entry }) => ({
        Date: entry?.examDate || "", "Start Time": entry?.startTime || "", "End Time": entry?.endTime || "",
        Subject: subject.subjectName, Room: entry?.roomNo || "",
      }));
    downloadCSV(rows, `datesheet-${exam?.name || "exam"}`);
  };

  const scheduledCount = examSubjects.filter(es => entryFor(es.subjectId)).length;

  return (
    <Card className="border-[#E5E7EB]">
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#64748B]" />
          <h3 className="font-medium text-sm">Datesheet</h3>
          <Badge className={scheduledCount === examSubjects.length ? "bg-emerald-100 text-emerald-700 text-[10px]" : "bg-amber-100 text-amber-700 text-[10px]"}>
            {scheduledCount}/{examSubjects.length} scheduled
          </Badge>
          {sections.length > 1 && (
            <span className="text-[11px] text-[#94A3B8]">applies to all {sections.length} sections</span>
          )}
        </div>
        <Button size="sm" variant="outline" className="text-xs h-8" onClick={handleExport} disabled={scheduledCount === 0}>
          <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {examSubjects.length === 0 ? (
          <p className="text-sm text-[#94A3B8] text-center py-8">Add exam subjects first.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#F8FAFC]">
                <th className="p-3 text-left text-xs font-semibold text-[#64748B]">Subject</th>
                <th className="p-3 text-left text-xs font-semibold text-[#64748B] w-64">Date &amp; Time</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {examSubjects.map(es => {
                const row = entryFor(es.subjectId);
                const isOpen = activeSubjectId === es.subjectId;
                return (
                  <tr key={es.id} className="border-b hover:bg-[#FAFBFC] group">
                    <td className="p-3 align-top">
                      <div className="font-medium text-sm">{es.subjectName}</div>
                      <div className="text-[11px] text-[#94A3B8]">{es.totalMarks} marks</div>
                    </td>
                    <td className="p-2 align-top">
                      <Popover open={isOpen} onOpenChange={(o) => !o && setActiveSubjectId(null)}>
                        <PopoverTrigger asChild>
                          {row ? (
                            <button
                              onClick={() => openExistingRow(row)}
                              className={`text-left w-full max-w-xs rounded-lg border p-2 ${isOpen ? "ring-2 ring-[#2563EB]" : ""} bg-[#EFF6FF] border-[#BFDBFE]`}
                            >
                              <p className="text-xs font-semibold text-[#1D4ED8]">{row.examDate}</p>
                              <p className="text-[10px] text-[#64748B]">
                                {row.startTime ? `${row.startTime}${row.endTime ? `–${row.endTime}` : ""}` : "No time set"}
                                {row.roomNo ? ` · Room ${row.roomNo}` : ""}
                              </p>
                            </button>
                          ) : (
                            <button
                              onClick={() => openEmptyRow(es.subjectId)}
                              aria-label={`Schedule ${es.subjectName}`}
                              className="w-full max-w-xs h-11 rounded-lg border border-dashed border-[#E5E7EB] flex items-center justify-center gap-1.5 text-xs text-[#94A3B8] hover:!text-[#2563EB] hover:!border-[#2563EB]/40 transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5" /> Schedule
                            </button>
                          )}
                        </PopoverTrigger>
                        <PopoverContent className="w-64" align="start">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-foreground">{es.subjectName}</p>
                            <div className="space-y-1">
                              <Label className="text-xs">Date</Label>
                              <Input type="date" className="h-8 text-sm" value={rowForm.examDate} onChange={e => setRowForm(f => ({ ...f, examDate: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <div className="space-y-1"><Label className="text-xs">Start</Label><Input type="time" className="h-8 text-sm" value={rowForm.startTime} onChange={e => setRowForm(f => ({ ...f, startTime: e.target.value }))} /></div>
                              <div className="space-y-1"><Label className="text-xs">End</Label><Input type="time" className="h-8 text-sm" value={rowForm.endTime} onChange={e => setRowForm(f => ({ ...f, endTime: e.target.value }))} /></div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Room (optional)</Label>
                              <Input className="h-8 text-sm" value={rowForm.roomNo} onChange={e => setRowForm(f => ({ ...f, roomNo: e.target.value }))} placeholder="e.g. Hall A" />
                            </div>
                            {conflicts.length > 0 && (
                              <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 border border-destructive/30 p-1.5">
                                <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                                <p className="text-[10px] text-foreground">Clashes with {conflicts.map(c => c.subjectName).join(", ")} at this date/time.</p>
                              </div>
                            )}
                            <div className="flex gap-1.5">
                              <Button size="sm" className="flex-1 h-8" disabled={!rowForm.examDate || saving} onClick={handleSaveRow}>
                                {saving ? "Saving..." : isEditingActive ? "Save" : "Schedule all sections"}
                              </Button>
                              {isEditingActive && (
                                <Button size="sm" variant="outline" className="h-8 text-red-500 hover:text-red-600" onClick={() => handleDelete(es.subjectId, es.subjectName || "This subject")}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </td>
                    <td className="p-2 align-top">
                      {row && (
                        <button
                          onClick={() => handleDelete(es.subjectId, es.subjectName || "This subject")}
                          title="Remove"
                          className="p-1 rounded hover:bg-[#FEE2E2] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
