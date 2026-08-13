"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import {
  Calendar, ClipboardCheck, Clock, Users, ChevronLeft, ChevronRight,
  History, ListChecks, BarChart3, ArrowLeft, ScanLine,
} from "lucide-react";
import {
  fetchAcademicYearsDB, fetchClassesDB, fetchSectionsByClassDB,
  fetchEnrollmentsDB, fetchAttendanceSessionsDB,
  createAttendanceSessionDB, saveAttendanceRecordsDB, fetchAttendanceRecordsDB,
  fetchAttendanceDatesDB, fetchAttendanceHistoryDB, getAttendanceSummaryDB,
} from "@/app/actions/academic-core";
import type { AcademicYear, ClassItem, SectionItem, Enrollment } from "@/lib/types";

const ATT_STATUS_OPTIONS = ["Present", "Absent", "Late", "Leave", "Half Day"] as const;

const STATUS_COLORS: Record<string, string> = {
  Present: "bg-green-100 text-green-700 border-green-200",
  Absent: "bg-red-100 text-red-700 border-red-200",
  Late: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Leave: "bg-blue-100 text-blue-700 border-blue-200",
  "Half Day": "bg-orange-100 text-orange-700 border-orange-200",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  Present: "bg-green-500",
  Absent: "bg-red-500",
  Late: "bg-yellow-500",
  Leave: "bg-blue-500",
  "Half Day": "bg-orange-500",
};

const STATUS_SHORT: Record<string, string> = {
  Present: "P",
  Absent: "A",
  Late: "L",
  Leave: "LV",
  "Half Day": "HD",
};

export default function AttendancePage() {
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [activeYearId, setActiveYearId] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"mark" | "history">("mark");
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [studentSummaries, setStudentSummaries] = useState<Record<string, any>>({});

  const loadContext = useCallback(async () => {
    const years = await fetchAcademicYearsDB();
    setAcademicYears(years);
    const active = years.find(y => y.isActive) || years[0];
    if (active) {
      setActiveYearId(active.id);
      const cls = await fetchClassesDB();
      setClasses(cls);
    }
  }, []);

  useEffect(() => { loadContext(); }, [loadContext]);

  useEffect(() => {
    if (selectedClassId) {
      fetchSectionsByClassDB(selectedClassId).then(setSections);
      setEnrollments([]);
    }
  }, [selectedClassId]);

  const loadSavedDates = useCallback(async () => {
    if (!selectedClassId || !selectedSectionId) { setSavedDates([]); return; }
    const dates = await fetchAttendanceDatesDB(selectedClassId, selectedSectionId);
    setSavedDates(dates);
  }, [selectedClassId, selectedSectionId]);

  useEffect(() => { loadSavedDates(); }, [loadSavedDates]);

  const loadEnrollments = useCallback(async () => {
    if (!selectedClassId || !selectedSectionId || !activeYearId) return;
    setLoadingStudents(true);
    const enr = await fetchEnrollmentsDB(activeYearId, selectedClassId);
    setEnrollments(enr.filter(e => e.sectionId === selectedSectionId && e.status === "Active"));
    setLoadingStudents(false);
  }, [selectedClassId, selectedSectionId, activeYearId]);

  useEffect(() => { loadEnrollments(); }, [loadEnrollments]);

  // Load existing attendance for selected date
  useEffect(() => {
    if (!selectedClassId || !selectedSectionId || !selectedDate) {
      setSessionId(null);
      setAttendanceMap({});
      return;
    }
    (async () => {
      const sessions = await fetchAttendanceSessionsDB(selectedClassId, selectedSectionId, selectedDate);
      if (sessions.length > 0) {
        setSessionId(sessions[0].id);
        const records = await fetchAttendanceRecordsDB(sessions[0].id);
        const map: Record<string, string> = {};
        for (const r of records) map[r.studentId] = r.status;
        setAttendanceMap(map);
      } else {
        setSessionId(null);
        setAttendanceMap({});
      }
    })();
  }, [selectedClassId, selectedSectionId, selectedDate]);

  // Load history data when entering history mode
  useEffect(() => {
    if (viewMode !== "history" || !selectedClassId || !selectedSectionId) return;
    (async () => {
      const dates = await fetchAttendanceDatesDB(selectedClassId, selectedSectionId);
      setHistoryDates(dates);
      if (dates.length > 0) {
        const start = dates[dates.length - 1];
        const end = dates[0];
        const data = await fetchAttendanceHistoryDB(selectedClassId, selectedSectionId, start, end);
        setHistoryData(data);

        const summaries: Record<string, any> = {};
        for (const enr of enrollments) {
          const studentRecords = data.filter((r: any) => r.studentId === enr.studentId);
          const counts: Record<string, number> = { Present: 0, Absent: 0, Late: 0, Leave: 0, "Half Day": 0 };
          for (const r of studentRecords) counts[r.status] = (counts[r.status] || 0) + 1;
          const total = studentRecords.length;
          const presentWeight = counts.Present + counts.Late + counts["Half Day"] * 0.5;
          summaries[enr.studentId] = { ...counts, total };
        }
        setStudentSummaries(summaries);
      }
    })();
  }, [viewMode, selectedClassId, selectedSectionId, enrollments]);

  const handleSaveAll = async () => {
    if (!selectedClassId || !selectedSectionId || !activeYearId) return;
    setSaving(true);
    try {
      const session = await createAttendanceSessionDB({
        academicYearId: activeYearId,
        classId: selectedClassId,
        sectionId: selectedSectionId,
        date: selectedDate,
      });
      if (!session) { toast({ title: "Failed to create session", variant: "destructive" }); return; }
      setSessionId(session);
      const records = enrollments.map(enr => ({
        studentId: enr.studentId,
        status: attendanceMap[enr.studentId] || "Present",
      }));
      await saveAttendanceRecordsDB(session, records);
      toast({ title: `Attendance saved for ${selectedDate}` });
      loadSavedDates();
    } catch {
      toast({ title: "Failed to save attendance", variant: "destructive" });
    }
    setSaving(false);
  };

  const setBulk = (status: string) => {
    const map: Record<string, string> = {};
    enrollments.forEach(e => { map[e.studentId] = status; });
    setAttendanceMap(map);
  };

  const navigateDate = (direction: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + direction);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const goToToday = () => setSelectedDate(new Date().toISOString().split("T")[0]);

  const presentCount = enrollments.filter(e => (attendanceMap[e.studentId] || "Present") !== "Absent").length;
  const absentCount = enrollments.length - presentCount;

  const statusBadge = (status: string) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] || "bg-slate-100 text-slate-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_COLORS[status] || "bg-slate-400"}`} />
      {status}
    </span>
  );

  const statusShortBadge = (status: string) => (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold ${STATUS_COLORS[status] || "bg-slate-100 text-slate-600"}`}>
      {STATUS_SHORT[status] || "?"}
    </span>
  );

  if (!permsLoaded) return null;
  if (!can("attendance.mark")) return <Unauthorized />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Attendance</h1>
          <p className="text-sm text-[#64748B] mt-1">Mark daily attendance and browse all previous records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/attendance/kiosk"><ScanLine className="h-4 w-4 mr-1" /> Kiosk Mode</Link>
          </Button>
          {viewMode === "history" && (
            <Button variant="outline" size="sm" onClick={() => setViewMode("mark")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Marking
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <Select value={activeYearId} onValueChange={setActiveYearId}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>{academicYears.map(y => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedClassId} onValueChange={v => { setSelectedClassId(v); setSelectedSectionId(""); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Grade" /></SelectTrigger>
          <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.gradeLevel}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
          <SelectTrigger className="w-28"><SelectValue placeholder="Section" /></SelectTrigger>
          <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id}>Section {s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {selectedSectionId && selectedClassId ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Sidebar — Saved Dates */}
          <div className="lg:col-span-1 space-y-3">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Saved Dates</h3>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"
                    onClick={() => setViewMode(viewMode === "history" ? "mark" : "history")}>
                    {viewMode === "history" ? (
                      <><ListChecks className="h-3 w-3" /> Mark</>
                    ) : (
                      <><History className="h-3 w-3" /> History</>
                    )}
                  </Button>
                </div>
                <div className="space-y-1 max-h-[320px] overflow-y-auto">
                  {savedDates.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No dates saved yet</p>
                  )}
                  {savedDates.map(date => {
                    const isToday = date === selectedDate;
                    return (
                      <button
                        key={date}
                        onClick={() => { setSelectedDate(date); setViewMode("mark"); }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition
                          ${isToday ? "bg-indigo-100 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}
                      >
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{date}</span>
                        {isToday && <span className="ml-auto text-[9px] font-bold text-indigo-500">CURRENT</span>}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Per-student summary cards in mark mode */}
            {viewMode === "mark" && enrollments.length > 0 && (
              <Card>
                <CardContent className="p-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Student Stats</h3>
                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                    {enrollments.map(enr => {
                      const s = studentSummaries[enr.studentId];
                      const pct = s?.total ? Math.round(((s.Present + s.Late + s["Half Day"] * 0.5) / s.total) * 100) : 0;
                      return (
                        <div key={enr.studentId} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 truncate max-w-[120px]">{enr.studentName}</span>
                          {s ? (
                            <span className={`font-semibold ${pct >= 75 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                              {pct}%
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-4">
            {viewMode === "mark" ? (
              <>
                {/* Date Navigation */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => navigateDate(-1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2 mx-2">
                      <Calendar className="h-4 w-4 text-[#64748B]" />
                      <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-40" />
                    </div>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => navigateDate(1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs ml-1" onClick={goToToday}>
                      Today
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${sessionId ? "text-green-600" : "text-amber-600"}`}>
                      {sessionId ? "Saved" : "Unsaved"}
                    </span>
                    <Button size="sm" className="text-xs h-8" onClick={handleSaveAll} disabled={saving || !enrollments.length}>
                      <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>

                {/* Summary Cards */}
                {enrollments.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="border-green-200 bg-green-50/30"><CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-green-700">{presentCount}</p>
                      <p className="text-xs text-green-600">Present</p>
                    </CardContent></Card>
                    <Card className="border-red-200 bg-red-50/30"><CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-red-700">{absentCount}</p>
                      <p className="text-xs text-red-600">Absent</p>
                    </CardContent></Card>
                    <Card className="border-blue-200 bg-blue-50/30"><CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-blue-700">{enrollments.length}</p>
                      <p className="text-xs text-blue-600">Total</p>
                    </CardContent></Card>
                    <Card className="border-purple-200 bg-purple-50/30"><CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-purple-700">
                        {enrollments.length > 0 ? Math.round((presentCount / enrollments.length) * 100) : 0}%
                      </p>
                      <p className="text-xs text-purple-600">Rate</p>
                    </CardContent></Card>
                  </div>
                )}

                {/* Bulk Actions */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-[#64748B]" />
                    <span className="text-sm text-[#475569]">{enrollments.length} students</span>
                  </div>
                  <div className="flex gap-1">
                    {ATT_STATUS_OPTIONS.map(s => (
                      <Button key={s} variant="outline" size="sm" className="text-xs h-8" onClick={() => setBulk(s)}>
                        All {s}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Attendance Table */}
                <Card className="border-[#E5E7EB]">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Roll</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead className="w-[520px]">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enrollments.map(enr => (
                          <TableRow key={enr.studentId}>
                            <TableCell className="text-slate-500">{enr.rollNumber}</TableCell>
                            <TableCell className="font-medium">{enr.studentName}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {ATT_STATUS_OPTIONS.map(s => {
                                  const current = attendanceMap[enr.studentId] || "Present";
                                  const isActive = current === s;
                                  return (
                                    <Button
                                      key={s}
                                      variant="outline"
                                      size="sm"
                                      className={`text-xs h-7 px-2 transition-all ${isActive ? STATUS_COLORS[s] + " ring-1 ring-offset-1" : ""}`}
                                      onClick={() => setAttendanceMap(prev => ({ ...prev, [enr.studentId]: s }))}
                                    >
                                      {s}
                                    </Button>
                                  );
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {enrollments.length === 0 && !loadingStudents && (
                          <TableRow><TableCell colSpan={3} className="text-center text-[#94A3B8] py-12">
                            No students enrolled in this class/section
                          </TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                {/* History View */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-[#64748B]" />
                    <h2 className="text-lg font-semibold text-[#0F172A]">Attendance History</h2>
                    <span className="text-xs text-slate-400">({historyDates.length} days)</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-xs h-8 gap-1"
                      onClick={async () => {
                        const summaries: Record<string, any> = {};
                        for (const enr of enrollments) {
                          const s = await getAttendanceSummaryDB(enr.studentId, activeYearId);
                          if (s) summaries[enr.studentId] = s;
                        }
                        setStudentSummaries(summaries);
                      }}>
                      <BarChart3 className="h-3.5 w-3.5" /> Refresh Stats
                    </Button>
                  </div>
                </div>

                {/* Class-wide Summary */}
                {Object.keys(studentSummaries).length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {["Present", "Absent", "Late", "Leave", "Half Day"].map(status => {
                      const total = Object.values(studentSummaries).reduce(
                        (sum: number, s: any) => sum + (s[status] || 0), 0
                      );
                      return (
                        <Card key={status} className={`border-slate-200 ${status === "Absent" && total > 0 ? "bg-red-50/30" : ""}`}>
                          <CardContent className="p-2.5 text-center">
                            <p className="text-lg font-bold text-slate-700">{total}</p>
                            <p className="text-[10px] text-slate-500">{status}</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* History Matrix Table */}
                {historyDates.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-white z-10 min-w-[140px]">Student</TableHead>
                          <TableHead className="min-w-[60px] text-center">%</TableHead>
                          {historyDates.map(d => (
                            <TableHead key={d} className="min-w-[36px] text-center p-1">
                              <span className="text-[9px] font-semibold uppercase whitespace-nowrap">
                                {new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })}
                              </span>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enrollments.map(enr => {
                          const summary = studentSummaries[enr.studentId];
                          const pct = summary?.total
                            ? Math.round(((summary.Present + summary.Late + summary["Half Day"] * 0.5) / summary.total) * 100)
                            : null;
                          return (
                            <TableRow key={enr.studentId} className="hover:bg-slate-50">
                              <TableCell className="sticky left-0 bg-white z-10 font-medium text-sm whitespace-nowrap">
                                {enr.studentName}
                              </TableCell>
                              <TableCell className="text-center">
                                {pct !== null ? (
                                  <span className={`text-xs font-bold ${pct >= 75 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                    {pct}%
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </TableCell>
                              {historyDates.map(d => {
                                const record = historyData.find(
                                  (r: any) => r.studentId === enr.studentId && r.date === d
                                );
                                return (
                                  <TableCell key={d} className="text-center p-1">
                                    {record ? (
                                      <span title={`${new Date(d).toLocaleDateString()}: ${record.status}`}>
                                        {statusShortBadge(record.status)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-200 text-xs">—</span>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-16 text-[#94A3B8]">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No attendance records found for this class</p>
                    <p className="text-xs mt-1">Start marking attendance to build history</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-[#94A3B8]">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Select a class and section to view attendance</p>
        </div>
      )}
    </div>
  );
}
