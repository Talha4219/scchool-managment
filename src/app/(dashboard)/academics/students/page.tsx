"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Users, Search, ChevronDown, ChevronRight, Layers, Download } from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAcademicYearsDB, fetchClassesDB, fetchSectionsByClassDB, fetchAllSectionsDB, fetchEnrollmentsDB } from "@/app/actions/academic-core";
import type { AcademicYear, ClassItem, SectionItem, Enrollment } from "@/lib/types";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";

export default function StudentsByClassPage() {
  const { can, loaded } = usePermission();
  const [loading, setLoading] = useState(true);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [activeYearId, setActiveYearId] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sectionsMap, setSectionsMap] = useState<Record<string, SectionItem[]>>({});
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("ALL");
  const [selectedSectionId, setSelectedSectionId] = useState("ALL");
  const [search, setSearch] = useState("");
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    const years = await fetchAcademicYearsDB();
    setAcademicYears(years);
    const active = years.find(y => y.isActive);
    const yearId = active?.id || years[0]?.id || "";
    setActiveYearId(yearId);

    const cls = await fetchClassesDB();
    setClasses(cls);

    const allSections = await fetchAllSectionsDB(cls.map(c => c.id));
    const secMap: Record<string, SectionItem[]> = {};
    for (const s of allSections) {
      if (!secMap[s.classId]) secMap[s.classId] = [];
      secMap[s.classId].push(s);
    }
    setSectionsMap(secMap);

    const enrs = await fetchEnrollmentsDB(yearId);
    setEnrollments(enrs);

    setExpandedClasses(new Set(cls.map(c => c.id)));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!activeYearId) return;
    fetchEnrollmentsDB(activeYearId, selectedClassId === "ALL" ? undefined : selectedClassId).then(setEnrollments);
  }, [activeYearId, selectedClassId]);

  const filteredEnrollments = enrollments.filter(e => {
    if (selectedSectionId !== "ALL" && e.sectionId !== selectedSectionId) return false;
    if (search && !e.studentName?.toLowerCase().includes(search.toLowerCase())) return false;
    return e.status === "Active";
  });

  const classMap = new Map(classes.map(c => [c.id, c]));
  const groupedByClass: Record<string, Record<string, Enrollment[]>> = {};
  for (const e of filteredEnrollments) {
    if (!groupedByClass[e.classId]) groupedByClass[e.classId] = {};
    const secKey = e.sectionId || "unassigned";
    if (!groupedByClass[e.classId][secKey]) groupedByClass[e.classId][secKey] = [];
    groupedByClass[e.classId][secKey].push(e);
  }

  const sectionsForClass = selectedClassId !== "ALL"
    ? (sectionsMap[selectedClassId] || [])
    : [];

  const toggleClass = (id: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-[#E5E7EB]">
              <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
              <CardContent className="space-y-3">
                {[1, 2].map(j => <Skeleton key={j} className="h-16 w-full" />)}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!loaded) return <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading...</div>;
  if (!can("classes.students")) return <Unauthorized />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#0F172A]">Students by Class</h1>
        <p className="text-sm text-[#64748B] mt-1">View students organized by class and section</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={activeYearId} onValueChange={setActiveYearId}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Academic Year" /></SelectTrigger>
          <SelectContent>
            {academicYears.map(y => (
              <SelectItem key={y.id} value={y.id}>{y.name} {y.isActive ? "✓" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedClassId} onValueChange={v => { setSelectedClassId(v); setSelectedSectionId("ALL"); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectedClassId !== "ALL" && sectionsForClass.length > 0 && (
          <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Sections" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Sections</SelectItem>
              {sectionsForClass.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#94A3B8]" />
          <Input placeholder="Search student..." className="pl-9 w-64" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => {
          exportToCsv("class-list", ["Roll No.", "Name", "Class", "Section"],
            filteredEnrollments.map(e => [e.rollNumber ?? "", e.studentName ?? "", classMap.get(e.classId)?.name ?? "", e.sectionName ?? ""]));
        }}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
            <Users className="h-4 w-4 text-[#2563EB]" />
          </div>
          <div>
            <p className="text-xs text-[#64748B]">Total Students</p>
            <p className="font-semibold text-[#0F172A]">{filteredEnrollments.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-[#16A34A]" />
          </div>
          <div>
            <p className="text-xs text-[#64748B]">Classes</p>
            <p className="font-semibold text-[#0F172A]">{Object.keys(groupedByClass).length}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedByClass).sort(([a], [b]) => {
          const ca = classMap.get(a);
          const cb = classMap.get(b);
          return (ca?.name || "").localeCompare(cb?.name || "");
        }).map(([classId, sections]) => {
          const cls = classMap.get(classId);
          const total = Object.values(sections).reduce((sum, s) => sum + s.length, 0);
          const isExpanded = expandedClasses.has(classId);

          return (
            <Card key={classId} className="border-[#E5E7EB] shadow-sm overflow-hidden">
              <button
                onClick={() => toggleClass(classId)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#F8FAFC] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-[#2563EB]" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-[#0F172A]">{cls?.name || classId}</h3>
                    <p className="text-xs text-[#64748B]">{cls?.gradeLevel} — {Object.keys(sections).length} section{Object.keys(sections).length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs font-semibold">{total} student{total !== 1 ? "s" : ""}</Badge>
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-[#94A3B8]" /> : <ChevronRight className="h-4 w-4 text-[#94A3B8]" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-[#E5E7EB]">
                  {Object.entries(sections).sort(([a], [b]) => a.localeCompare(b)).map(([secId, secEnrollments]) => {
                    const sec = sectionsMap[classId]?.find(s => s.id === secId);
                    return (
                      <div key={secId} className="border-b border-[#E5E7EB] last:border-b-0">
                        <div className="px-5 py-2.5 bg-[#F8FAFC] flex items-center gap-2">
                          <Layers className="h-3.5 w-3.5 text-[#2563EB]" />
                          <span className="text-xs font-bold text-[#475569] uppercase tracking-wide">
                            Section {sec?.name || "N/A"}
                          </span>
                          {sec?.teacherName && (
                            <span className="text-xs text-[#94A3B8]">— {sec.teacherName}</span>
                          )}
                          <Badge variant="outline" className="text-[10px] ml-auto">{secEnrollments.length}</Badge>
                        </div>
                        <div className="divide-y divide-[#F1F5F9]">
                          {secEnrollments.sort((a, b) => a.rollNumber - b.rollNumber).map(e => (
                            <div key={e.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-[#F8FAFC] transition-colors">
                              <span className="text-xs font-mono text-[#94A3B8] w-8 text-center">{e.rollNumber}</span>
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={e.profilePhoto || undefined} />
                                <AvatarFallback className="bg-[#EFF6FF] text-[#2563EB] text-[10px] font-semibold">
                                  {e.studentName?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-[#0F172A]">{e.studentName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}

        {Object.keys(groupedByClass).length === 0 && (
          <div className="text-center py-16 text-[#94A3B8]">
            <GraduationCap className="h-12 w-12 mx-auto mb-3 text-[#E2E8F0]" />
            <p className="font-medium">No students found</p>
            <p className="text-sm mt-1">Try adjusting your filters or enroll students first.</p>
          </div>
        )}
      </div>
    </div>
  );
}
