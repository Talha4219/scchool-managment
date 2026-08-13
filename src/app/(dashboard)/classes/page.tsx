"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, GraduationCap, Layers,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAcademicYearsDB, createAcademicYearDB, setActiveAcademicYearDB,
  fetchClassesDB, fetchAllSectionsDB, createSectionDB, deleteClassDB, deleteSectionDB,
  createClassDB, updateClassDB, updateSectionDB,
} from "@/app/actions/academic-core";
import type { AcademicYear, ClassItem, SectionItem } from "@/lib/types";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";

const GRADE_LEVELS = ["Playgroup", "Nursery", "Prep", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

const sectionLetters = ["A", "B", "C", "D", "E"];

const sectionGroupOptions: Record<string, string[]> = {
  "Grade 9": ["none", "General", "Biology", "ICS"],
  "Grade 10": ["none", "General", "Biology", "ICS"],
  "Grade 11": ["none", "General", "Pre-Medical", "Pre-Engineering", "ICS"],
  "Grade 12": ["none", "General", "Pre-Medical", "Pre-Engineering", "ICS"],
};

export default function ClassesPage() {
  const { can, loaded } = usePermission();
  const { toast } = useToast();

  // ── Academic Year ──────────────────────────────────────────────────────────────
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [activeYearId, setActiveYearId] = useState<string>("");
  const [ayDialogOpen, setAyDialogOpen] = useState(false);
  const [newAY, setNewAY] = useState({ name: "", startDate: "", endDate: "" });

  const loadAcademicYears = useCallback(async () => {
    const years = await fetchAcademicYearsDB();
    setAcademicYears(years);
    const active = years.find(y => y.isActive);
    if (active) setActiveYearId(active.id);
    else if (years.length > 0) setActiveYearId(years[0].id);
  }, []);

  useEffect(() => { loadAcademicYears(); }, [loadAcademicYears]);

  const handleCreateAY = async () => {
    if (!newAY.name || !newAY.startDate || !newAY.endDate) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    await createAcademicYearDB(newAY);
    setAyDialogOpen(false);
    setNewAY({ name: "", startDate: "", endDate: "" });
    loadAcademicYears();
    toast({ title: "Academic Year created" });
  };

  const handleSetActiveAY = async (id: string) => {
    await setActiveAcademicYearDB(id);
    setActiveYearId(id);
    loadAcademicYears();
    toast({ title: "Active year updated" });
  };

  // ── Loading State ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);

  // ── Classes ────────────────────────────────────────────────────────────────────
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sectionsMap, setSectionsMap] = useState<Record<string, SectionItem[]>>({});
  const [localSections, setLocalSections] = useState<Record<string, SectionItem[]>>(() => {
    try { return JSON.parse(localStorage.getItem("sc_local_sections") || "{}"); } catch { return {}; }
  });
  const persistLocalSections = (map: Record<string, SectionItem[]>) => {
    localStorage.setItem("sc_local_sections", JSON.stringify(map));
  };

  const loadClasses = useCallback(async () => {
    if (!activeYearId) return;
    setLoading(true);
    const cls = await fetchClassesDB();
    setClasses(cls);
    const dbSections = await fetchAllSectionsDB(cls.map(c => c.id));
    const secMap: Record<string, SectionItem[]> = {};
    for (const s of dbSections) {
      if (!secMap[s.classId]) secMap[s.classId] = [];
      secMap[s.classId].push(s);
    }
    for (const c of cls) {
      if (!secMap[c.id] || secMap[c.id].length === 0) {
        secMap[c.id] = localSections[c.id] || [];
      }
    }
    setSectionsMap(secMap);
    setLoading(false);
  }, [activeYearId, localSections]);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  // ── Create Class ─────────────────────────────────────────────────────────────
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassGradeLevel, setNewClassGradeLevel] = useState("");
  const [newClassIsGraduating, setNewClassIsGraduating] = useState(false);

  const handleCreateClass = async () => {
    if (!newClassName || !newClassGradeLevel) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    if (!activeYearId) { toast({ title: "Select an academic year first", variant: "destructive" }); return; }
    const res = await createClassDB({ name: newClassName, gradeLevel: newClassGradeLevel, academicYearId: activeYearId, isGraduating: newClassIsGraduating });
    if (!res) { toast({ title: "Failed to create class", variant: "destructive" }); return; }
    setClasses(prev => [...prev, res]);
    setCreateClassOpen(false);
    setNewClassName("");
    setNewClassGradeLevel("");
    setNewClassIsGraduating(false);
    toast({ title: "Class created" });
  };

  // ── Edit Class ──────────────────────────────────────────────────────────────
  const [editClassOpen, setEditClassOpen] = useState(false);
  const [editClassTarget, setEditClassTarget] = useState<ClassItem | null>(null);
  const [editClassName, setEditClassName] = useState("");
  const [editClassGradeLevel, setEditClassGradeLevel] = useState("");
  const [editClassIsGraduating, setEditClassIsGraduating] = useState(false);

  const openEditClass = (cls: ClassItem) => {
    setEditClassTarget(cls);
    setEditClassName(cls.name);
    setEditClassGradeLevel(cls.gradeLevel);
    setEditClassIsGraduating(!!cls.isGraduating);
    setEditClassOpen(true);
  };

  const handleUpdateClass = async () => {
    if (!editClassTarget || !editClassName || !editClassGradeLevel) return;
    const res = await updateClassDB({ id: editClassTarget.id, name: editClassName, gradeLevel: editClassGradeLevel, isGraduating: editClassIsGraduating });
    if (!res) { toast({ title: "Failed to update class", variant: "destructive" }); return; }
    setClasses(prev => prev.map(c => c.id === editClassTarget.id ? { ...c, name: editClassName, gradeLevel: editClassGradeLevel, isGraduating: editClassIsGraduating } : c));
    setEditClassOpen(false);
    setEditClassTarget(null);
    toast({ title: "Class updated" });
  };

  // ── Delete Class ─────────────────────────────────────────────────────────────
  const handleDeleteGrade = async (id: string) => {
    await deleteClassDB(id);
    setClasses(prev => prev.filter(c => c.id !== id));
    setSectionsMap(prev => { const { [id]: _, ...rest } = prev; return rest; });
    toast({ title: "Grade deleted" });
  };

  // ── Sections ────────────────────────────────────────────────────────────────────
  const [addSecDialog, setAddSecDialog] = useState<{ open: boolean; classId: string }>({ open: false, classId: "" });
  const [newSecName, setNewSecName] = useState("");
  const [newSecCap, setNewSecCap] = useState("30");
  const [newSecGroup, setNewSecGroup] = useState("");

  const getClassNameForSection = (classId: string) => classes.find(c => c.id === classId)?.name || "";

  const handleAddSection = async () => {
    if (!newSecName) { toast({ title: "Enter section name", variant: "destructive" }); return; }
    const existingSections = sectionsMap[addSecDialog.classId] || [];
    if (existingSections.some(s => s.name.toLowerCase() === newSecName.toLowerCase())) {
      toast({ title: `Section "${newSecName}" already exists in this class.`, variant: "destructive" }); return;
    }
    const groupVal = newSecGroup && newSecGroup !== "none" ? newSecGroup : undefined;
    const dbRes = await createSectionDB({ name: newSecName, capacity: parseInt(newSecCap) || 30, classId: addSecDialog.classId, group: groupVal });
    const section = dbRes || { id: `local-sec-${Date.now()}`, name: newSecName, capacity: parseInt(newSecCap) || 30, classId: addSecDialog.classId, group: groupVal };
    if (!dbRes) {
      setLocalSections(prev => {
        const updated = { ...prev, [addSecDialog.classId]: [...(prev[addSecDialog.classId] || []), section] };
        persistLocalSections(updated);
        return updated;
      });
    }
    setSectionsMap(prev => ({ ...prev, [addSecDialog.classId]: [...(prev[addSecDialog.classId] || []), section] }));
    setAddSecDialog({ open: false, classId: "" });
    setNewSecName("");
    setNewSecCap("30");
    setNewSecGroup("");
    toast({ title: "Section created" });
  };

  // ── Edit Section ────────────────────────────────────────────────────────────
  const [editSecDialog, setEditSecDialog] = useState<{ open: boolean; classId: string; section: SectionItem | null }>({ open: false, classId: "", section: null });
  const [editSecName, setEditSecName] = useState("");
  const [editSecCap, setEditSecCap] = useState("30");
  const [editSecGroup, setEditSecGroup] = useState("");

  const openEditSection = (classId: string, sec: SectionItem) => {
    setEditSecDialog({ open: true, classId, section: sec });
    setEditSecName(sec.name);
    setEditSecCap(String(sec.capacity));
    setEditSecGroup(sec.group || "none");
  };

  const handleUpdateSection = async () => {
    if (!editSecDialog.section || !editSecName) return;
    const groupVal = editSecGroup && editSecGroup !== "none" ? editSecGroup : undefined;
    const ok = await updateSectionDB({ id: editSecDialog.section.id, name: editSecName, capacity: parseInt(editSecCap) || 30, group: groupVal });
    if (!ok) { toast({ title: "Failed to update section", variant: "destructive" }); return; }
    const updated: SectionItem = { ...editSecDialog.section, name: editSecName, capacity: parseInt(editSecCap) || 30, group: groupVal };
    setSectionsMap(prev => ({
      ...prev,
      [editSecDialog.classId]: (prev[editSecDialog.classId] || []).map(s => s.id === updated.id ? updated : s),
    }));
    setEditSecDialog({ open: false, classId: "", section: null });
    toast({ title: "Section updated" });
  };

  // ── Delete Section ──────────────────────────────────────────────────────────
  const handleDeleteSection = async (id: string) => {
    await deleteSectionDB(id);
    const removeFromMap = (map: Record<string, SectionItem[]>) => {
      const updated: Record<string, SectionItem[]> = {};
      for (const cid of Object.keys(map)) {
        const filtered = map[cid].filter(s => s.id !== id);
        if (filtered.length > 0) updated[cid] = filtered;
      }
      return updated;
    };
    setSectionsMap(prev => removeFromMap(prev));
    setLocalSections(prev => { const updated = removeFromMap(prev); persistLocalSections(updated); return updated; });
    toast({ title: "Section deleted" });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-44 rounded-md" />
            <Skeleton className="h-10 w-20 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="border-[#E5E7EB] shadow-sm">
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div><Skeleton className="h-5 w-24 mb-1" /><Skeleton className="h-3 w-16" /></div>
                </div>
                <div className="flex gap-1">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[1,2].map(j => (
                    <div key={j} className="border border-[#E5E7EB] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-4 rounded" />
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <div className="flex gap-1">
                          <Skeleton className="h-7 w-7 rounded" />
                          <Skeleton className="h-7 w-7 rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!loaded) return <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading...</div>;
  if (!can("classes.grades")) return <Unauthorized />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Grades & Sections</h1>
          <p className="text-sm text-[#64748B] mt-1">Manage grades, sections, and teacher assignments</p>
        </div>
        <div className="flex gap-2">
          <Select value={activeYearId} onValueChange={handleSetActiveAY}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Select year" /></SelectTrigger>
            <SelectContent>
              {academicYears.map(y => (
                <SelectItem key={y.id} value={y.id}>
                  {y.name} {y.isActive ? "✓" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setAyDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Year
          </Button>
          <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white" onClick={() => { setNewClassName(""); setNewClassGradeLevel(""); setCreateClassOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Grade
          </Button>
        </div>
      </div>

      {/* Academic Year Dialog */}
      <Dialog open={ayDialogOpen} onOpenChange={setAyDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Academic Year</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Year Name</Label><Input value={newAY.name} onChange={e => setNewAY({ ...newAY, name: e.target.value })} placeholder="e.g. 2026-2027" /></div>
            <div><Label>Start Date</Label><Input value={newAY.startDate} onChange={e => setNewAY({ ...newAY, startDate: e.target.value })} placeholder="YYYY-MM-DD" /></div>
            <div><Label>End Date</Label><Input value={newAY.endDate} onChange={e => setNewAY({ ...newAY, endDate: e.target.value })} placeholder="YYYY-MM-DD" /></div>
          </div>
          <DialogFooter><Button onClick={handleCreateAY}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Class Dialog */}
      <Dialog open={createClassOpen} onOpenChange={setCreateClassOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Grade / Class</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Grade Level</Label>
              <Select value={newClassGradeLevel} onValueChange={setNewClassGradeLevel}>
                <SelectTrigger><SelectValue placeholder="Select grade level" /></SelectTrigger>
                <SelectContent>
                  {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Class Name</Label>
              <Input value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="e.g. Grade 10 (Matric)" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={newClassIsGraduating} onChange={e => setNewClassIsGraduating(e.target.checked)} className="accent-primary" />
              This is the graduating / final class
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateClassOpen(false)}>Cancel</Button>
            <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white" onClick={handleCreateClass}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Class Dialog */}
      <Dialog open={editClassOpen} onOpenChange={o => { setEditClassOpen(o); if (!o) setEditClassTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Grade / Class</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Grade Level</Label>
              <Select value={editClassGradeLevel} onValueChange={setEditClassGradeLevel}>
                <SelectTrigger><SelectValue placeholder="Select grade level" /></SelectTrigger>
                <SelectContent>
                  {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Class Name</Label>
              <Input value={editClassName} onChange={e => setEditClassName(e.target.value)} placeholder="e.g. Grade 10 (Matric)" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={editClassIsGraduating} onChange={e => setEditClassIsGraduating(e.target.checked)} className="accent-primary" />
              This is the graduating / final class
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditClassOpen(false); setEditClassTarget(null); }}>Cancel</Button>
            <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white" onClick={handleUpdateClass}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grade Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {classes.map(cls => {
          const sections = sectionsMap[cls.id] || [];
          return (
            <Card key={cls.id} className="border-[#E5E7EB] shadow-sm">
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-[#2563EB]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-[#0F172A]">{cls.name}</h3>
                      {cls.isGraduating && <Badge className="text-[9px] px-1.5 h-4 bg-primary/10 text-primary">Graduating</Badge>}
                    </div>
                    <p className="text-xs text-[#64748B]">{cls.gradeLevel} — {sections.length} section{sections.length !== 1 ? "s" : ""} — {sections.reduce((sum, s) => sum + s.capacity, 0)} total seats</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAddSecDialog({ open: true, classId: cls.id })}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditClass(cls)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete {cls.name}?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete this grade and all its sections.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteGrade(cls.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent>
                {sections.length === 0 ? (
                  <div className="text-sm text-[#94A3B8] text-center py-3">No sections</div>
                ) : (
                  <div className="space-y-2">
                    {sections.map(sec => (
                      <div key={sec.id} className="border border-[#E5E7EB] rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-[#2563EB]" />
                            <span className="font-medium text-sm">Section {sec.name}</span>
                            <Badge variant="outline" className="text-xs">{sec.capacity} seats</Badge>
                            {sec.group && sec.group !== "none" && (
                              <Badge variant="secondary" className="text-xs">{sec.group}</Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSection(cls.id, sec)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="h-3.5 w-3.5" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Delete Section {sec.name}?</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteSection(sec.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        {sec.teacherName && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              {sec.teacherName}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Section Dialog */}
      <Dialog open={addSecDialog.open} onOpenChange={o => setAddSecDialog({ open: o, classId: o ? addSecDialog.classId : "" })}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Section</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Section Name</Label>
              <Select value={newSecName} onValueChange={setNewSecName}>
                <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  {sectionLetters.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Capacity</Label><Input type="number" value={newSecCap} onChange={e => setNewSecCap(e.target.value)} /></div>
            {(() => {
              const clsName = getClassNameForSection(addSecDialog.classId);
              const groups = sectionGroupOptions[clsName];
              if (!groups) return null;
              return (
                <div><Label>Subject Group / Stream</Label>
                  <Select value={newSecGroup} onValueChange={setNewSecGroup}>
                    <SelectTrigger><SelectValue placeholder="None (General)" /></SelectTrigger>
                    <SelectContent>
                      {groups.map(g => <SelectItem key={g} value={g}>{g === "none" ? "None (General)" : g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
          </div>
          <DialogFooter><Button onClick={handleAddSection}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Section Dialog */}
      <Dialog open={editSecDialog.open} onOpenChange={o => { setEditSecDialog({ open: o, classId: "", section: null }); if (!o) { setEditSecName(""); setEditSecCap("30"); setEditSecGroup(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Section</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Section Name</Label>
              <Select value={editSecName} onValueChange={setEditSecName}>
                <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  {sectionLetters.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Capacity</Label><Input type="number" value={editSecCap} onChange={e => setEditSecCap(e.target.value)} /></div>
            {(() => {
              const clsName = getClassNameForSection(editSecDialog.classId);
              const groups = sectionGroupOptions[clsName];
              if (!groups) return null;
              return (
                <div><Label>Subject Group / Stream</Label>
                  <Select value={editSecGroup} onValueChange={setEditSecGroup}>
                    <SelectTrigger><SelectValue placeholder="None (General)" /></SelectTrigger>
                    <SelectContent>
                      {groups.map(g => <SelectItem key={g} value={g}>{g === "none" ? "None (General)" : g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditSecDialog({ open: false, classId: "", section: null }); }}>Cancel</Button>
            <Button onClick={handleUpdateSection}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
