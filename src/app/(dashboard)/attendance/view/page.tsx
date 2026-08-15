"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import {
  fetchAcademicYearsDB, fetchClassesDB, fetchSectionsByClassDB,
  fetchEnrollmentsDB, fetchAttendanceDatesDB, fetchAttendanceHistoryDB,
  getAttendanceSummaryDB,
} from "@/app/actions/academic-core";
import type { AcademicYear, ClassItem, SectionItem, Enrollment } from "@/lib/types";
import { ArrowLeft, Calendar, Download, Eye, BarChart3, History, Users, Search } from "lucide-react";
import { motion } from "framer-motion";

const STATUS_COLORS: Record<string, string> = {
  Present: "bg-green-100 text-green-700 border-green-200",
  Absent: "bg-red-100 text-red-700 border-red-200",
  Late: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Leave: "bg-blue-100 text-blue-700 border-blue-200",
  "Half Day": "bg-orange-100 text-orange-700 border-orange-200",
};

const STATUS_DOT: Record<string, string> = {
  Present: "bg-green-500", Absent: "bg-red-500", Late: "bg-yellow-500",
  Leave: "bg-blue-500", "Half Day": "bg-orange-500",
};

const STATUS_SHORT: Record<string, string> = {
  Present: "P", Absent: "A", Late: "L", Leave: "LV", "Half Day": "HD",
};

function statusDot(status: string) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] || "bg-slate-400"}`} />;
}

function statusShortBadge(status: string) {
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold ${STATUS_COLORS[status] || "bg-slate-100 text-slate-600"}`}>
      {STATUS_SHORT[status] || "?"}
    </span>
  );
}

export default function AttendanceViewPage() {
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [activeYearId, setActiveYearId] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");

  const [dateRangeStart, setDateRangeStart] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0];
  });
  const [dateRangeEnd, setDateRangeEnd] = useState(() => new Date().toISOString().split("T")[0]);

  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [summaries, setSummaries] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  const loadContext = useCallback(async () => {
    const years = await fetchAcademicYearsDB();
    setAcademicYears(years);
    const active = years.find(y => y.isActive) || years[0];
    if (active) { setActiveYearId(active.id); setClasses(await fetchClassesDB()); }
  }, []);

  useEffect(() => { loadContext(); }, [loadContext]);

  useEffect(() => {
    if (selectedClassId) { fetchSectionsByClassDB(selectedClassId).then(setSections); setEnrollments([]); }
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId || !selectedSectionId || !activeYearId) return;
    fetchEnrollmentsDB(activeYearId, selectedClassId).then(enr =>
      setEnrollments(enr.filter(e => e.sectionId === selectedSectionId && e.status === "Active"))
    );
  }, [selectedClassId, selectedSectionId, activeYearId]);

  const loadHistory = useCallback(async () => {
    if (!selectedClassId || !selectedSectionId) return;
    setLoading(true);
    try {
      const dates = await fetchAttendanceDatesDB(selectedClassId, selectedSectionId);
      const filtered = dates.filter(d => d >= dateRangeStart && d <= dateRangeEnd);
      setHistoryDates(filtered);
      if (filtered.length > 0) {
        const data = await fetchAttendanceHistoryDB(selectedClassId, selectedSectionId, filtered[filtered.length - 1], filtered[0]);
        setHistoryData(data);

        const s: Record<string, any> = {};
        for (const enr of enrollments) {
          const recs = data.filter((r: any) => r.studentId === enr.studentId);
          const c: Record<string, number> = { Present: 0, Absent: 0, Late: 0, Leave: 0, "Half Day": 0 };
          for (const r of recs) c[r.status] = (c[r.status] || 0) + 1;
          const total = recs.length;
          s[enr.studentId] = { ...c, total, pct: total > 0 ? Math.round(((c.Present + c.Late + c["Half Day"] * 0.5) / total) * 100) : 0 };
        }
        setSummaries(s);
      } else {
        setHistoryData([]);
        setSummaries({});
      }
    } catch { toast({ title: "Failed to load history", variant: "destructive" }); }
    setLoading(false);
  }, [selectedClassId, selectedSectionId, dateRangeStart, dateRangeEnd, enrollments, toast]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const classTotals = useMemo((): Record<string, number> => {
    const t: Record<string, number> = { Present: 0, Absent: 0, Late: 0, Leave: 0, "Half Day": 0, total: 0 };
    for (const s of Object.values(summaries) as any[]) {
      for (const k of ["Present", "Absent", "Late", "Leave", "Half Day"]) t[k] += s[k] || 0;
      t.total += s.total || 0;
    }
    return t;
  }, [summaries]);

  const filteredStudents = enrollments.filter(e =>
    (e.studentName ?? "").toLowerCase().includes(studentSearch.toLowerCase())
  );

  const handleExport = () => {
    if (historyDates.length === 0) return;
    const headers = ["Student", "Roll", ...historyDates];
    const rows = filteredStudents.map(enr => {
      const s = summaries[enr.studentId];
      return [
        enr.studentName ?? "",
        String(enr.rollNumber ?? ""),
        ...historyDates.map(d => {
          const rec = historyData.find((r: any) => r.studentId === enr.studentId && r.date === d);
          return rec ? rec.status : "";
        }),
      ];
    });
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "attendance-history.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Attendance history exported" });
  };

  if (!permsLoaded) return null;
  if (!can("attendance.view")) return <Unauthorized />;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/attendance" className="p-2 hover:bg-slate-100 rounded-lg transition"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100"><Eye className="h-5 w-5 text-indigo-600" /></div>
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">Attendance View</h1>
            <p className="text-sm text-[#64748B] mt-0.5">View and analyze attendance records across dates</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
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
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <Input type="date" value={dateRangeStart} onChange={e => setDateRangeStart(e.target.value)} className="w-36" />
              <span className="text-slate-300">—</span>
              <Input type="date" value={dateRangeEnd} onChange={e => setDateRangeEnd(e.target.value)} className="w-36" />
            </div>
            <Button size="sm" onClick={loadHistory} disabled={loading}>
              {loading ? "Loading..." : "Load"}
            </Button>
            {historyDates.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedClassId && selectedSectionId ? (
        <>
          {/* Summary Cards */}
          {historyDates.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <Card className="border-green-200 bg-green-50/30 col-span-1">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{classTotals.Present}</p>
                  <p className="text-xs text-green-600">Present</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50/30">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{classTotals.Absent}</p>
                  <p className="text-xs text-red-600">Absent</p>
                </CardContent>
              </Card>
              <Card className="border-yellow-200 bg-yellow-50/30">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{classTotals.Late}</p>
                  <p className="text-xs text-yellow-600">Late</p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50/30">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{classTotals.Leave}</p>
                  <p className="text-xs text-blue-600">Leave</p>
                </CardContent>
              </Card>
              <Card className="border-orange-200 bg-orange-50/30">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-orange-700">{classTotals["Half Day"]}</p>
                  <p className="text-xs text-orange-600">Half Day</p>
                </CardContent>
              </Card>
              <Card className="border-purple-200 bg-purple-50/30">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-purple-700">{classTotals.total}</p>
                  <p className="text-xs text-purple-600">Total Records</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Student Search */}
          {historyDates.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                placeholder="Search student..."
                className="pl-9 max-w-xs"
              />
            </div>
          )}

          {/* History Matrix */}
          {historyDates.length > 0 ? (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-white z-10 min-w-[160px]">Student</TableHead>
                      <TableHead className="min-w-[56px] text-center">Attendance %</TableHead>
                      <TableHead className="min-w-[52px] text-center">Total</TableHead>
                      {historyDates.map(d => (
                        <TableHead key={d} className="min-w-[36px] text-center p-1">
                          <span className="text-[9px] font-semibold uppercase whitespace-nowrap">
                            {/* timeZone pinned to UTC: `d` is a date-only string, and formatting it in the
                                runtime's local offset renders a different calendar day server vs client. */}
                            {new Date(d).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map(enr => {
                      const s = summaries[enr.studentId];
                      const pct = s?.pct ?? null;
                      return (
                        <TableRow key={enr.studentId} className="hover:bg-slate-50">
                          <TableCell className="sticky left-0 bg-white z-10">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 w-6">{enr.rollNumber || "—"}</span>
                              <span className="font-medium text-sm">{enr.studentName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {pct !== null ? (
                              <Badge className={`${pct >= 75 ? "bg-green-100 text-green-700" : pct >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                                {pct}%
                              </Badge>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs text-slate-500">
                            {s?.total || 0}
                          </TableCell>
                          {historyDates.map(d => {
                            const rec = historyData.find((r: any) => r.studentId === enr.studentId && r.date === d);
                            return (
                              <TableCell key={d} className="text-center p-1">
                                {rec ? statusShortBadge(rec.status) : <span className="text-slate-200">—</span>}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                    {filteredStudents.length === 0 && (
                      <TableRow><TableCell colSpan={2 + historyDates.length} className="text-center py-12 text-slate-400">
                        No students found
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-16 text-[#94A3B8]">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">No attendance records found</p>
              <p className="text-xs mt-1">Select a class and section, then adjust the date range</p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-[#94A3B8]">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Select a class and section to view attendance</p>
        </div>
      )}
    </motion.div>
  );
}
