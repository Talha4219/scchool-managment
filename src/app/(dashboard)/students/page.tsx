"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAppState } from "@/lib/state-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, UserPlus, GraduationCap, Users, Filter, Pencil, ArrowUpDown, History, RefreshCw, Download } from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";
import {
  fetchAcademicYearsDB, fetchClassesDB, fetchSectionsByClassDB,
  fetchEnrollmentsDB, createEnrollmentDB, updateEnrollmentStatusDB,
  bulkPromoteStudentsDB, fetchPromotionsDB, changeEnrollmentClassDB,
} from "@/app/actions/academic-core";
import { resetStudentPasswordDB } from "@/app/actions/db";
import { getSession } from "@/app/actions/auth";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import type { AcademicYear, ClassItem, SectionItem, Enrollment } from "@/lib/types";

export default function StudentsPage() {
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();
  const { addStudent, updateStudent, students: legacyStudents, activeRole } = useAppState();

  // Editing a student — including resetting their portal password — is an
  // admin-only capability. The legacy `activeRole` demo toggle isn't tied to
  // the real login, so this page never actually checked who was logged in;
  // the server actions it calls now enforce this too, but the button
  // shouldn't be shown at all to someone it will silently fail for.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => { getSession().then(s => setIsAdmin(s?.role === "ADMIN")); }, []);

  // ── Loading State ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);

  // ── Academic Context ─────────────────────────────────────────────────────────
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [activeYearId, setActiveYearId] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("ALL");
  const [selectedSectionId, setSelectedSectionId] = useState("ALL");

  // ── Students / Enrollments ────────────────────────────────────────────────────
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [search, setSearch] = useState("");

  // Fallback: transform legacy students to enrollment-like display when DB is empty
  const displayEnrollments: Enrollment[] = enrollments.length > 0 ? enrollments : legacyStudents.map((s, i) => ({
    id: s.id,
    studentId: s.id,
    studentName: s.name,
    classId: "",
    className: s.class,
    sectionId: "",
    sectionName: s.section,
    academicYearId: "",
    rollNumber: i + 1,
    status: s.status as "Active" | "Inactive",
    profilePhoto: s.profilePhoto,
  }));

  const loadContext = useCallback(async () => {
    setLoading(true);
    const years = await fetchAcademicYearsDB();
    setAcademicYears(years);
    const active = years.find(y => y.isActive) || years[0];
    if (active) {
      setActiveYearId(active.id);
      const cls = await fetchClassesDB(active.id);
      setClasses(cls);
    }
    setLoading(false);
  }, []);

  const loadEnrollments = useCallback(async () => {
    if (!activeYearId) return;
    const enr = await fetchEnrollmentsDB(activeYearId, selectedClassId !== "ALL" ? selectedClassId : undefined);
    setEnrollments(enr);
  }, [activeYearId, selectedClassId]);

  useEffect(() => { loadContext(); }, [loadContext]);

  useEffect(() => {
    if (selectedClassId !== "ALL") {
      fetchSectionsByClassDB(selectedClassId).then(setSections);
    } else {
      setSections([]);
    }
  }, [selectedClassId]);

  useEffect(() => { loadEnrollments(); }, [loadEnrollments]);

  // ── Edit Student ──────────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Enrollment | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", email: "", parentName: "", parentEmail: "", status: "Active",
    admissionNumber: "", dateOfBirth: "", gender: "", phone: "", address: "",
    guardianRelation: "", rollNumber: "",
  });
  const [editPhoto, setEditPhoto] = useState<string>("");
  const [editPassword, setEditPassword] = useState("");

  const handleEditPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleEdit = async () => {
    if (!editStudent || !editForm.name) { toast({ title: "Name is required", variant: "destructive" }); return; }
    const legacy = legacyStudents.find(s => s.id === editStudent.studentId);
    if (legacy) {
      const updated = {
        ...legacy,
        name: editForm.name, email: editForm.email, parentName: editForm.parentName,
        parentEmail: editForm.parentEmail, status: editForm.status as "Active" | "Inactive",
        dateOfBirth: editForm.dateOfBirth || legacy.dateOfBirth,
        gender: (editForm.gender || legacy.gender) as any,
        phone: editForm.phone || legacy.phone,
        address: editForm.address || legacy.address,
        guardianRelation: editForm.guardianRelation || legacy.guardianRelation,
        rollNumber: parseInt(editForm.rollNumber) || legacy.rollNumber,
        admissionNumber: editForm.admissionNumber || legacy.admissionNumber,
        profilePhoto: editPhoto || legacy.profilePhoto,
      };
      updateStudent(updated);
    } else {
      await updateEnrollmentStatusDB(editStudent.id, editForm.status);
    }
    if (editPassword) {
      const emailToUse = editForm.email || legacyStudents.find(s => s.id === editStudent.studentId)?.email;
      if (emailToUse) {
        const res = await resetStudentPasswordDB(emailToUse, editPassword);
        if (res.error) toast({ title: res.error, variant: "destructive" });
        else toast({ title: "Portal password updated" });
      }
    }
    setEditOpen(false);
    setEditStudent(null);
    setEditPhoto("");
    setEditPassword("");
    loadEnrollments();
    toast({ title: "Student updated" });
  };

  // ── Enroll Student ────────────────────────────────────────────────────────────
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    name: "", admissionNumber: "", email: "", parentName: "", parentEmail: "",
    classId: "", sectionId: "", rollNumber: "1",
  });

  const handleEnroll = async () => {
    if (!enrollForm.name || !enrollForm.classId || !enrollForm.sectionId) {
      toast({ title: "Fill required fields", variant: "destructive" }); return;
    }
    const student = addStudent({
      name: enrollForm.name,
      class: classes.find(c => c.id === enrollForm.classId)?.name || "",
      section: sections.find(s => s.id === enrollForm.sectionId)?.name || "",
      parentName: enrollForm.parentName,
      email: enrollForm.email,
      parentEmail: enrollForm.parentEmail,
      status: "Active",
    });
    if (student) {
      const res = await createEnrollmentDB({
        studentId: student.id, classId: enrollForm.classId,
        sectionId: enrollForm.sectionId, academicYearId: activeYearId,
        rollNumber: parseInt(enrollForm.rollNumber) || 1,
      });
      if (res?.error) {
        toast({ title: "Enrollment Failed", description: res.error, variant: "destructive" });
        setEnrollOpen(false);
        loadEnrollments();
        return;
      }
    }
    setEnrollOpen(false);
    setEnrollForm({ name: "", admissionNumber: "", email: "", parentName: "", parentEmail: "", classId: "", sectionId: "", rollNumber: "1" });
    loadEnrollments();
    toast({ title: "Student enrolled" });
  };

  const handleStatusChange = async (enrollmentId: string, status: string) => {
    await updateEnrollmentStatusDB(enrollmentId, status);
    loadEnrollments();
    toast({ title: `Status set to ${status}` });
  };

  // ── Promote Dialog ──────────────────────────────────────────────────────────
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteTarget, setPromoteTarget] = useState<Enrollment | null>(null);
  const [promoteClassId, setPromoteClassId] = useState("");
  const [promoteSectionId, setPromoteSectionId] = useState("");
  const [promoteSections, setPromoteSections] = useState<SectionItem[]>([]);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    if (promoteClassId) fetchSectionsByClassDB(promoteClassId).then(s => {
      setPromoteSections(s);
      setPromoteSectionId(s[0]?.id || "");
    });
  }, [promoteClassId]);

  const handlePromote = async () => {
    if (!promoteTarget || !promoteClassId || !promoteSectionId) {
      toast({ title: "Select target class and section", variant: "destructive" }); return;
    }
    setPromoting(true);
    // Routed through the same bulk-promotion path used by /students/promotions
    // (single-item batch) so there's one implementation of this logic, not two.
    const result = await bulkPromoteStudentsDB({
      fromClassId: promoteTarget.classId,
      fromSectionId: promoteTarget.sectionId || "",
      fromAcademicYearId: activeYearId,
      toClassId: promoteClassId,
      toSectionId: promoteSectionId,
      toAcademicYearId: activeYearId,
      isGraduating: false,
      decisions: [{ enrollmentId: promoteTarget.id, studentId: promoteTarget.studentId, outcome: "promoted" }],
    });
    setPromoting(false);
    if (result?.error || (result?.failed && result.failed.length > 0)) {
      toast({ title: "Promotion failed", description: result?.error || result?.failed?.[0]?.reason, variant: "destructive" });
    } else {
      toast({ title: "Student promoted successfully" });
      setPromoteOpen(false);
      setPromoteTarget(null);
      loadEnrollments();
    }
  };

  // ── Change Class/Section Dialog ─────────────────────────────────────────────
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeTarget, setChangeTarget] = useState<Enrollment | null>(null);
  const [changeClassId, setChangeClassId] = useState("");
  const [changeSectionId, setChangeSectionId] = useState("");
  const [changeSections, setChangeSections] = useState<SectionItem[]>([]);

  useEffect(() => {
    if (changeClassId) fetchSectionsByClassDB(changeClassId).then(s => {
      setChangeSections(s);
      setChangeSectionId(s[0]?.id || "");
    });
  }, [changeClassId]);

  const handleChangeClass = async () => {
    if (!changeTarget || !changeClassId || !changeSectionId) {
      toast({ title: "Select class and section", variant: "destructive" }); return;
    }
    const res = await changeEnrollmentClassDB({
      enrollmentId: changeTarget.id,
      classId: changeClassId,
      sectionId: changeSectionId,
      academicYearId: activeYearId,
    });
    if (res?.error) {
      toast({ title: "Failed to update class/section", description: res.error, variant: "destructive" });
    } else {
      toast({ title: "Class/section updated" });
      setChangeOpen(false);
      setChangeTarget(null);
      loadEnrollments();
    }
  };

  // ── Enrollment History Dialog ───────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyName, setHistoryName] = useState("");

  const openHistory = async (enr: Enrollment) => {
    setHistoryName(enr.studentName || "");
    const promotions = await fetchPromotionsDB(enr.studentId);
    setHistoryData(promotions);
    setHistoryOpen(true);
  };

  const filtered = displayEnrollments.filter(e => {
    if (selectedSectionId !== "ALL" && e.sectionId !== selectedSectionId) return false;
    if (search && !e.studentName?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Teacher View ──────────────────────────────────────────────────────────────
  if (activeRole === "TEACHER") {
    if (loading) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-7 w-40" />
          <div className="flex gap-2 items-center">
            <Skeleton className="h-10 flex-1 max-w-sm rounded-md" />
            <Skeleton className="h-10 w-40 rounded-md" />
          </div>
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {["Roll No", "Name", "Class", "Section", "Status"].map(h => <TableHead key={h}>{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[1,2,3,4].map(i => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-28" /></div></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[#0F172A]">My Students</h1>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <Input className="pl-9" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={selectedClassId} onValueChange={v => { setSelectedClassId(v); setSelectedSectionId("ALL"); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(enr => (
                  <TableRow key={enr.id}>
                    <TableCell>{enr.rollNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={enr.profilePhoto} />
                          <AvatarFallback className="bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold">
                            {enr.studentName?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{enr.studentName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{enr.className}</TableCell>
                    <TableCell>{enr.sectionName}</TableCell>
                    <TableCell><Badge variant={enr.status === "Active" ? "default" : "secondary"}>{enr.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-[#94A3B8] py-8">No students found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!permsLoaded) return null;
  if (!can("students.view")) return <Unauthorized />;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-40 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <Skeleton className="h-10 w-44 rounded-md" />
          <Skeleton className="h-10 w-36 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
          <Skeleton className="h-10 max-w-sm flex-1 rounded-md" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <Card key={i} className="border-[#E5E7EB]">
              <CardContent className="p-4 flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div><Skeleton className="h-7 w-16 mb-1" /><Skeleton className="h-3 w-20" /></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Roll No","Name","Class","Section","Status",""].map(h => <TableHead key={h}>{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1,2,3,4,5].map(i => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-28" /></div></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20 ml-auto rounded" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Students</h1>
          <p className="text-sm text-[#64748B] mt-1">Enrolled students by class, section and academic year</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/students/promotions"><ArrowUpDown className="h-4 w-4 mr-1" /> Bulk Promotion</Link>
          </Button>
          <Button onClick={() => setEnrollOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Enroll Student
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <Select value={activeYearId} onValueChange={v => setActiveYearId(v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Academic Year" /></SelectTrigger>
          <SelectContent>{academicYears.map(y => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedClassId} onValueChange={v => { setSelectedClassId(v); setSelectedSectionId("ALL"); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Class" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectedClassId !== "ALL" && (
          <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Section" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Sections</SelectItem>
              {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
          <Input className="pl-9" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => {
          exportToCsv("students", ["Roll No.", "Name", "Class", "Section", "Status"],
            filtered.map(e => [e.rollNumber ?? "", e.studentName ?? "", e.className ?? "", e.sectionName ?? "", e.status]));
          toast({ title: "Student list exported" });
        }}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
              <Users className="h-5 w-5 text-[#2563EB]" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{displayEnrollments.length}</p>
              <p className="text-xs text-[#64748B]">Total Enrolled</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{displayEnrollments.filter(e => e.status === "Active").length}</p>
              <p className="text-xs text-[#64748B]">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#F8FAFC] flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-[#64748B]" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{classes.length}</p>
              <p className="text-xs text-[#64748B]">Classes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-[#E5E7EB]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roll No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
              <TableBody>
                {filtered.map(enr => (
                  <TableRow key={enr.id}>
                    <TableCell>{enr.rollNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={enr.profilePhoto} />
                          <AvatarFallback className="bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold">
                            {enr.studentName?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{enr.studentName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{enr.className}</TableCell>
                    <TableCell>{enr.sectionName}</TableCell>
                    <TableCell>
                      <Select value={enr.status} onValueChange={v => handleStatusChange(enr.id, v)}>
                      <SelectTrigger className="h-7 w-28">
                        <Badge variant={enr.status === "Active" ? "default" : "secondary"} className="mr-1">
                          {enr.status}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Graduated">Graduated</SelectItem>
                        <SelectItem value="Transferred">Transferred</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => openHistory(enr)}>
                        <History className="h-3 w-3 mr-1" /> History
                      </Button>
                      {enr.status === "Active" && (
                        <>
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                            const nextIdx = classes.findIndex(c => c.id === enr.classId) + 1;
                            const nextClass = classes[nextIdx];
                            if (nextClass) {
                              setPromoteTarget(enr);
                              setPromoteClassId(nextClass.id);
                              setPromoteOpen(true);
                            } else {
                              toast({ title: "No higher grade available", variant: "destructive" });
                            }
                          }}>
                            <ArrowUpDown className="h-3 w-3 mr-1" /> Promote
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                            setChangeTarget(enr);
                            setChangeClassId(enr.classId);
                            setChangeOpen(true);
                          }}>
                            <RefreshCw className="h-3 w-3 mr-1" /> Change
                          </Button>
                        </>
                      )}
                      {isAdmin && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                          const legacy = legacyStudents.find(s => s.id === enr.studentId);
                          setEditStudent(enr);
                          setEditForm({
                            name: enr.studentName || legacy?.name || "",
                            email: legacy?.email || "",
                            parentName: legacy?.parentName || "",
                            parentEmail: legacy?.parentEmail || "",
                            status: enr.status,
                            admissionNumber: legacy?.admissionNumber || "",
                            dateOfBirth: legacy?.dateOfBirth || "",
                            gender: legacy?.gender || "",
                            phone: legacy?.phone || "",
                            address: legacy?.address || "",
                            guardianRelation: legacy?.guardianRelation || "",
                            rollNumber: String(enr.rollNumber || legacy?.rollNumber || ""),
                          });
                          setEditPhoto(legacy?.profilePhoto || "");
                          setEditOpen(true);
                        }}>
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-[#94A3B8] py-12">No students enrolled</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Student Dialog */}
      <Dialog open={editOpen} onOpenChange={o => { setEditOpen(o); if (!o) { setEditStudent(null); setEditPhoto(""); setEditPassword(""); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Student</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Profile Photo */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-[#E5E7EB]">
                {editPhoto ? (
                  <img src={editPhoto} className="h-full w-full object-cover rounded-full" alt="" />
                ) : (
                  <AvatarFallback className="bg-[#EFF6FF] text-[#2563EB] font-semibold text-lg">
                    {editForm.name?.charAt(0) || "?"}
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <Label htmlFor="edit-photo" className="cursor-pointer text-sm text-[#2563EB] hover:underline">Change Photo</Label>
                <Input id="edit-photo" type="file" accept="image/*" className="hidden" onChange={handleEditPhoto} />
              </div>
            </div>
            <Separator />
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Admission No.</Label><Input value={editForm.admissionNumber} onChange={e => setEditForm(f => ({ ...f, admissionNumber: e.target.value }))} /></div>
              <div><Label>Roll Number</Label><Input type="number" value={editForm.rollNumber} onChange={e => setEditForm(f => ({ ...f, rollNumber: e.target.value }))} /></div>
              <div><Label>Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Graduated">Graduated</SelectItem>
                    <SelectItem value="Transferred">Transferred</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            {/* Personal Details */}
            <h4 className="text-sm font-semibold text-[#0F172A]">Personal Details</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={editForm.dateOfBirth} onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))} /></div>
              <div><Label>Gender</Label>
                <Select value={editForm.gender} onValueChange={v => setEditForm(f => ({ ...f, gender: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Address</Label><Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
            </div>
            <Separator />
            {/* Parent Info */}
            <h4 className="text-sm font-semibold text-[#0F172A]">Parent / Guardian</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Parent Name</Label><Input value={editForm.parentName} onChange={e => setEditForm(f => ({ ...f, parentName: e.target.value }))} /></div>
              <div><Label>Parent Email</Label><Input value={editForm.parentEmail} onChange={e => setEditForm(f => ({ ...f, parentEmail: e.target.value }))} /></div>
              <div><Label>Guardian Relation</Label><Input value={editForm.guardianRelation} onChange={e => setEditForm(f => ({ ...f, guardianRelation: e.target.value }))} /></div>
            </div>
            <Separator />
            {/* Portal Password Reset */}
            <h4 className="text-sm font-semibold text-[#0F172A]">Portal Access</h4>
            <div><Label>New Portal Password <span className="text-xs text-[#94A3B8]">(leave blank to keep current)</span></Label>
              <Input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Enter new password" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleEdit}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Enroll New Student</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <div><Label>Student Name *</Label><Input value={enrollForm.name} onChange={e => setEnrollForm({ ...enrollForm, name: e.target.value })} /></div>
            <div><Label>Admission No.</Label><Input value={enrollForm.admissionNumber} onChange={e => setEnrollForm({ ...enrollForm, admissionNumber: e.target.value })} /></div>
            <div><Label>Class *</Label>
              <Select value={enrollForm.classId} onValueChange={v => setEnrollForm({ ...enrollForm, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Section *</Label>
              <Select value={enrollForm.sectionId} onValueChange={v => setEnrollForm({ ...enrollForm, sectionId: v })}>
                <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Roll Number</Label><Input type="number" value={enrollForm.rollNumber} onChange={e => setEnrollForm({ ...enrollForm, rollNumber: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={enrollForm.email} onChange={e => setEnrollForm({ ...enrollForm, email: e.target.value })} /></div>
            <div><Label>Parent Name</Label><Input value={enrollForm.parentName} onChange={e => setEnrollForm({ ...enrollForm, parentName: e.target.value })} /></div>
            <div><Label>Parent Email</Label><Input value={enrollForm.parentEmail} onChange={e => setEnrollForm({ ...enrollForm, parentEmail: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleEnroll}>Enroll</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote Dialog */}
      <Dialog open={promoteOpen} onOpenChange={o => { setPromoteOpen(o); if (!o) setPromoteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Promote Student</DialogTitle></DialogHeader>
          {promoteTarget && (
            <div className="space-y-3">
              <p className="text-sm text-[#64748B]">
                Promote <strong>{promoteTarget.studentName}</strong> from <strong>{promoteTarget.className}</strong>
                {promoteTarget.sectionName ? ` – ${promoteTarget.sectionName}` : ""}
              </p>
              <div><Label>Target Class *</Label>
                <Select value={promoteClassId} onValueChange={setPromoteClassId}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>{classes.filter(c => {
                    const idx = classes.findIndex(x => x.id === promoteTarget.classId);
                    return classes.indexOf(c) > idx;
                  }).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Target Section *</Label>
                <Select value={promoteSectionId} onValueChange={setPromoteSectionId}>
                  <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                  <SelectContent>
                    {promoteSections.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPromoteOpen(false); setPromoteTarget(null); }}>Cancel</Button>
            <Button onClick={handlePromote} disabled={promoting}>{promoting ? "Promoting..." : "Promote"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Class/Section Dialog */}
      <Dialog open={changeOpen} onOpenChange={o => { setChangeOpen(o); if (!o) setChangeTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Change Class/Section</DialogTitle></DialogHeader>
          {changeTarget && (
            <div className="space-y-3">
              <p className="text-sm text-[#64748B]">
                Move <strong>{changeTarget.studentName}</strong> from <strong>{changeTarget.className}</strong>
                {changeTarget.sectionName ? ` – ${changeTarget.sectionName}` : ""}
              </p>
              <div><Label>Class *</Label>
                <Select value={changeClassId} onValueChange={v => { setChangeClassId(v); }}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Section *</Label>
                <Select value={changeSectionId} onValueChange={setChangeSectionId}>
                  <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                  <SelectContent>
                    {changeSections.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setChangeOpen(false); setChangeTarget(null); }}>Cancel</Button>
            <Button onClick={handleChangeClass}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enrollment History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Enrollment History — {historyName}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {historyData.length === 0 && (
              <p className="text-sm text-[#94A3B8] text-center py-8">No promotion history found</p>
            )}
            {historyData.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E7EB]">
                <ArrowUpDown className="h-4 w-4 text-[#2563EB]" />
                <div className="flex-1 text-sm">
                  <span className="font-medium">{p.fromClassName}</span>
                  {p.fromSectionId && <span className="text-[#64748B]"> → </span>}
                  <span className="font-medium">{p.toClassName}</span>
                </div>
                <span className="text-xs text-[#94A3B8]">{new Date(p.promotedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
