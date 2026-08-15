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
import {
  fetchStaffAttendanceDB, markStaffAttendanceDB, fetchStaffAttendanceHistoryDB, fetchStaffAttendanceSummaryDB, checkOutStaffDB,
} from "@/app/actions/staff-attendance";
import {
  fetchSubstitutionsForDateDB, fetchEligibleSubstitutesDB, overrideSubstitutionDB, fillUnfilledSubstitutionDB,
  type SubstitutionRecord,
} from "@/app/actions/substitutions";
import { fetchStaffDirectoryDB } from "@/app/actions/features";
import { getSession } from "@/app/actions/auth";
import type { AcademicYear, ClassItem, SectionItem, Enrollment } from "@/lib/types";
import { UserCheck, AlertTriangle, LogOut } from "lucide-react";

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

function StudentAttendanceTab() {
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

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF ATTENDANCE (admin marking) — same status vocabulary/visual language as
// the student view above, but no class/section grouping: one row per person.
// ═══════════════════════════════════════════════════════════════════════════════
function StaffAttendanceTab() {
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();
  const [staff, setStaff] = useState<{ userId: number; name: string; department: string }[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [records, setRecords] = useState<Record<number, { status: string; remarks?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [staffList, existing] = await Promise.all([fetchStaffDirectoryDB(), fetchStaffAttendanceDB(date)]);
    setStaff(staffList);
    const map: Record<number, { status: string; remarks?: string }> = {};
    existing.forEach(r => { map[r.userId] = { status: r.status, remarks: r.remarks || undefined }; });
    setRecords(map);
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const setStatus = (userId: number, status: string) => setRecords(prev => ({ ...prev, [userId]: { ...prev[userId], status } }));
  const markAllPresent = () => {
    const map: Record<number, { status: string; remarks?: string }> = {};
    staff.forEach(s => { map[s.userId] = { status: "Present" }; });
    setRecords(map);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = staff.filter(s => records[s.userId]?.status).map(s => ({ userId: s.userId, date, status: records[s.userId].status, remarks: records[s.userId].remarks }));
    const res = await markStaffAttendanceDB(payload);
    setSaving(false);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Staff attendance saved" });
    load();
  };

  const handleCheckOut = async (userId: number) => {
    const res = await checkOutStaffDB(userId, date);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: res.halfDay ? "Checked out — marked Half Day, remaining periods substituted" : "Checked out" });
    load();
  };

  if (!permsLoaded) return null;
  if (!can("attendance.staff.manage")) return <Unauthorized />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAllPresent}>Mark All Present</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Attendance"}</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map(s => (
                <TableRow key={s.userId}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.department}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {ATT_STATUS_OPTIONS.map(opt => (
                        <button
                          key={opt}
                          onClick={() => setStatus(s.userId, opt)}
                          className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${records[s.userId]?.status === opt ? STATUS_COLORS[opt] : "border-border text-muted-foreground hover:bg-secondary/40"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {records[s.userId]?.status === "Present" && date === new Date().toISOString().split("T")[0] && (
                      <button
                        onClick={() => handleCheckOut(s.userId)}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        title="Check out now — flips to Half Day and substitutes remaining periods if early"
                      >
                        <LogOut className="h-3 w-3" /> Check Out
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {staff.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No staff found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MY ATTENDANCE (self-service — teacher/employee viewing their own record)
// ═══════════════════════════════════════════════════════════════════════════════
function MyAttendanceTab() {
  const [userId, setUserId] = useState<number | null>(null);
  const [summary, setSummary] = useState<Record<string, number> & { total: number; percentage: number }>({ total: 0, percentage: 0 });
  const [history, setHistory] = useState<{ id: string; date: string; status: string; remarks: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then(async (s) => {
      if (!s) { setLoading(false); return; }
      setUserId(s.userId);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const [sum, hist] = await Promise.all([
        fetchStaffAttendanceSummaryDB(s.userId, monthStart, monthEnd),
        fetchStaffAttendanceHistoryDB(s.userId, monthStart, monthEnd),
      ]);
      setSummary(sum);
      setHistory(hist);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(["Present", "Absent", "Late", "Leave", "Half Day"] as const).map(key => (
          <div key={key} className={`rounded-xl border p-3 text-center ${STATUS_COLORS[key]}`}>
            <p className="text-2xl font-bold">{summary[key] || 0}</p>
            <p className="text-xs font-medium">{key}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-4 bg-secondary/10 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">This month's attendance rate</span>
        <span className="text-xl font-bold text-primary">{summary.percentage}%</span>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
          <TableBody>
            {history.map(h => (
              <TableRow key={h.id}>
                <TableCell>{h.date}</TableCell>
                <TableCell><span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_COLORS[h.status] || ""}`}>{h.status}</span></TableCell>
                <TableCell className="text-muted-foreground text-sm">{h.remarks || "—"}</TableCell>
              </TableRow>
            ))}
            {history.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No attendance recorded yet this month.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSTITUTIONS (admin review) — today's (or any date's) auto-generated
// substitute-teacher assignments, with unfilled slots surfaced first and a
// one-click swap that only offers teachers who won't create a new conflict.
// ═══════════════════════════════════════════════════════════════════════════════
const SUB_STATUS_COLORS: Record<string, string> = {
  auto: "bg-blue-100 text-blue-700 border-blue-200",
  confirmed: "bg-green-100 text-green-700 border-green-200",
  manual_override: "bg-purple-100 text-purple-700 border-purple-200",
  unfilled: "bg-red-100 text-red-700 border-red-200",
};
const SUB_STATUS_LABELS: Record<string, string> = {
  auto: "Auto", confirmed: "Confirmed", manual_override: "Manual", unfilled: "Unfilled",
};

function SubstitutionsTab() {
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [subs, setSubs] = useState<SubstitutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [eligible, setEligible] = useState<{ userId: number; name: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setSubs(await fetchSubstitutionsForDateDB(date));
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const openSwap = async (id: string) => {
    setSwapFor(id);
    setEligible(await fetchEligibleSubstitutesDB(id));
  };

  const doSwap = async (teacherId: number) => {
    if (!swapFor) return;
    const isUnfilled = subs.find(s => s.id === swapFor)?.status === "unfilled";
    const res = isUnfilled ? await fillUnfilledSubstitutionDB(swapFor, teacherId) : await overrideSubstitutionDB(swapFor, teacherId);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Substitute assigned" });
    setSwapFor(null);
    load();
  };

  if (!permsLoaded) return null;
  if (!can("timetable.substitute")) return <Unauthorized />;

  const unfilledCount = subs.filter(s => s.status === "unfilled").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
        </div>
        {unfilledCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-3 py-1">
            <AlertTriangle className="h-3.5 w-3.5" /> {unfilledCount} period{unfilledCount > 1 ? "s" : ""} unfilled
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : subs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No substitutions needed for {date}</p>
          <p className="text-xs mt-1">Substitutions appear here automatically when a teacher is marked Absent, on Leave, or checks out early.</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Original Teacher</TableHead>
                <TableHead>Substitute</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map(s => (
                <TableRow key={s.id} className={s.status === "unfilled" ? "bg-red-50/40" : ""}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{s.startTime}–{s.endTime}</TableCell>
                  <TableCell className="font-medium">{s.className}</TableCell>
                  <TableCell>{s.subjectName}</TableCell>
                  <TableCell className="text-muted-foreground">{s.originalTeacherName}</TableCell>
                  <TableCell className="font-medium">{s.substituteTeacherName || <span className="text-red-600">—</span>}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${SUB_STATUS_COLORS[s.status]}`}>
                      {SUB_STATUS_LABELS[s.status]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <button onClick={() => openSwap(s.id)} className="text-xs font-medium text-primary hover:underline">
                      {s.status === "unfilled" ? "Assign" : "Swap"}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {swapFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSwapFor(null)}>
          <div className="bg-card rounded-xl border p-4 w-80 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3">Choose a substitute</h3>
            {eligible.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No eligible teachers are free at this time.</p>
            ) : (
              <div className="space-y-1">
                {eligible.map(t => (
                  <button key={t.userId} onClick={() => doSwap(t.userId)}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-secondary/50">
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE ROOT — tab switcher between Student attendance, Staff attendance
// (admin marking), and My Attendance (staff self-service).
// ═══════════════════════════════════════════════════════════════════════════════
export default function AttendancePage() {
  const { can, loaded: permsLoaded } = usePermission();
  const [role, setRole] = useState<string | null>(null);
  const [tab, setTab] = useState<"students" | "staff" | "substitutions" | "mine">("students");

  useEffect(() => { getSession().then(s => setRole(s?.role ?? null)); }, []);

  if (!permsLoaded || role === null) return null;

  const showStudents = can("attendance.mark");
  const showStaff = can("attendance.staff.manage");
  const showSubstitutions = can("timetable.substitute");
  const showMine = role === "TEACHER" || role === "EMPLOYEE";

  if (!showStudents && !showStaff && !showSubstitutions && !showMine) return <Unauthorized />;

  const tabs = [
    ...(showStudents ? [{ key: "students" as const, label: "Students" }] : []),
    ...(showStaff ? [{ key: "staff" as const, label: "Staff" }] : []),
    ...(showSubstitutions ? [{ key: "substitutions" as const, label: "Substitutions" }] : []),
    ...(showMine ? [{ key: "mine" as const, label: "My Attendance" }] : []),
  ];
  const activeTab = tabs.some(t => t.key === tab) ? tab : tabs[0]?.key;

  return (
    <div className="space-y-4">
      {tabs.length > 1 && (
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 w-fit">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`text-xs font-semibold rounded-md px-3 py-1.5 transition-colors ${activeTab === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {activeTab === "students" && <StudentAttendanceTab />}
      {activeTab === "staff" && <StaffAttendanceTab />}
      {activeTab === "substitutions" && <SubstitutionsTab />}
      {activeTab === "mine" && <MyAttendanceTab />}
    </div>
  );
}
