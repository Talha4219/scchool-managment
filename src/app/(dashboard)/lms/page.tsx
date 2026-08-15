"use client";

import { useState, useEffect } from "react";
import { useAppState } from "@/lib/state-context";
import { getSession } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { Course, CourseMaterial } from "@/lib/types";
import {
  fetchCoursesDB, createCourseDB, updateCourseDB, deleteCourseDB,
  fetchCourseMaterialsDB, createCourseMaterialDB, deleteCourseMaterialDB,
} from "@/app/actions/features";
import {
  Plus, Search, BookOpen, BookMarked, Edit, Trash2, Check, X,
  GraduationCap, Users, Loader2, Lock, FolderOpen,
  FileText, Video, Download, Upload, PlayCircle,
} from "lucide-react";

// Converts a normal YouTube/Vimeo watch/share link into its iframe-embeddable
// form. Falls back to the raw URL for anything else (best-effort — most video
// hosts' share links work directly as an iframe src too).
function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return url;
  }
}

// Fallback only, used before any real classes exist in the DB — once classes
// are created, the grade/class picker below is driven from the real `classes`
// table instead, so a course's gradeLevel actually corresponds to a class.
const GRADE_LEVELS = ["Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12"];

const blankCourse = {
  title: "", code: "", description: "", gradeLevel: "", teacherName: "",
  credits: 3, learningOutcomes: [] as string[], prerequisites: [] as string[], isActive: true,
};

function MaterialsDialog({ course, canManage, trigger }: { course: Course; canManage: boolean; trigger: React.ReactNode }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [loading, setLoading] = useState(false);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteDesc, setNoteDesc] = useState("");
  const [noteFile, setNoteFile] = useState<{ name: string; dataUrl: string } | null>(null);

  const [videoTitle, setVideoTitle] = useState("");
  const [videoDesc, setVideoDesc] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const load = async () => {
    setLoading(true);
    setMaterials(await fetchCourseMaterialsDB(course.id));
    setLoading(false);
  };
  useEffect(() => { if (open) load(); }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNoteFile({ name: file.name, dataUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleAddNote = async () => {
    if (!noteTitle.trim() || !noteFile) { toast({ title: "Title and a file are required.", variant: "destructive" }); return; }
    const res = await createCourseMaterialDB({ courseId: course.id, title: noteTitle.trim(), type: "document", url: noteFile.dataUrl, fileName: noteFile.name, description: noteDesc || undefined });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Note added" });
    setNoteTitle(""); setNoteDesc(""); setNoteFile(null);
    load();
  };

  const handleAddVideo = async () => {
    if (!videoTitle.trim() || !videoUrl.trim()) { toast({ title: "Title and a video link are required.", variant: "destructive" }); return; }
    const res = await createCourseMaterialDB({ courseId: course.id, title: videoTitle.trim(), type: "video", url: videoUrl.trim(), description: videoDesc || undefined });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Video lecture added" });
    setVideoTitle(""); setVideoDesc(""); setVideoUrl("");
    load();
  };

  const handleDelete = async (id: string) => {
    const res = await deleteCourseMaterialDB(id);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Material removed" });
    load();
  };

  const notes = materials.filter(m => m.type === "document");
  const videos = materials.filter(m => m.type === "video");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{course.title} — Materials</DialogTitle></DialogHeader>
        <Tabs defaultValue="notes">
          <TabsList>
            <TabsTrigger value="notes" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="videos" className="gap-1.5"><Video className="h-3.5 w-3.5" /> Video Lectures ({videos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 mt-3">
            {canManage && (
              <div className="p-3 rounded-xl border bg-secondary/20 space-y-2">
                <Input placeholder="Note title" value={noteTitle} onChange={e => setNoteTitle(e.target.value)} />
                <Textarea placeholder="Description (optional)" rows={2} value={noteDesc} onChange={e => setNoteDesc(e.target.value)} />
                <div className="flex items-center gap-2">
                  <Input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,image/*" onChange={handleFileChange} className="text-xs" />
                  <Button type="button" size="sm" onClick={handleAddNote} className="gap-1 shrink-0"><Upload className="h-3.5 w-3.5" /> Upload</Button>
                </div>
                {noteFile && <p className="text-xs text-muted-foreground">Selected: {noteFile.name}</p>}
              </div>
            )}
            {loading ? (
              <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : notes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No notes uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {notes.map(n => (
                  <div key={n.id} className="flex items-center justify-between p-3 rounded-xl border">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <FileText className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{n.title}</p>
                        {n.description && <p className="text-xs text-muted-foreground line-clamp-1">{n.description}</p>}
                        <p className="text-[10px] text-muted-foreground">{n.createdByName}{n.createdByName ? " · " : ""}{new Date(n.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={n.url} download={n.fileName || n.title}>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8"><Download className="h-4 w-4" /></Button>
                      </a>
                      {canManage && (
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDelete(n.id)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="videos" className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 mt-3">
            {canManage && (
              <div className="p-3 rounded-xl border bg-secondary/20 space-y-2">
                <Input placeholder="Lecture title" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} />
                <Textarea placeholder="Description (optional)" rows={2} value={videoDesc} onChange={e => setVideoDesc(e.target.value)} />
                <div className="flex items-center gap-2">
                  <Input placeholder="YouTube or Vimeo link" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
                  <Button type="button" size="sm" onClick={handleAddVideo} className="gap-1 shrink-0"><Plus className="h-3.5 w-3.5" /> Add</Button>
                </div>
              </div>
            )}
            {loading ? (
              <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : videos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No video lectures added yet.</p>
            ) : (
              <div className="space-y-4">
                {videos.map(v => (
                  <div key={v.id} className="rounded-xl border overflow-hidden">
                    <div className="aspect-video bg-black">
                      <iframe
                        src={toEmbedUrl(v.url)} className="w-full h-full" title={v.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <div className="p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{v.title}</p>
                        {v.description && <p className="text-xs text-muted-foreground line-clamp-1">{v.description}</p>}
                      </div>
                      {canManage && (
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-500 shrink-0" onClick={() => handleDelete(v.id)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default function LMSPage() {
  const { activeRole, students, classes } = useAppState();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form, setForm] = useState<Omit<Course, "id">>({ ...blankCourse });
  const [editingForm, setEditingForm] = useState<Course | null>(null);
  const [outcomeInput, setOutcomeInput] = useState("");
  const [prereqInput, setPrereqInput] = useState("");
  const [editOutcomeInput, setEditOutcomeInput] = useState("");
  const [editPrereqInput, setEditPrereqInput] = useState("");

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const loadCourses = async () => {
    setLoading(true);
    const data = await fetchCoursesDB();
    setCourses(data);
    setLoading(false);
  };

  useEffect(() => { loadCourses(); }, []);
  useEffect(() => { getSession().then(s => setSessionEmail(s?.email ?? null)); }, []);

  const isAdmin = activeRole === "ADMIN";
  const isTeacher = activeRole === "TEACHER";
  const isStudent = activeRole === "STUDENT";

  // The logged-in student's own record — not just "the first active student",
  // which every student would otherwise incorrectly see.
  const myStudent = sessionEmail
    ? students.find(s => s.email === sessionEmail && s.status === "Active") || null
    : null;

  // Course grade/class options come from the real `classes` table so a
  // course's gradeLevel actually maps to a real class, not a free-floating
  // "Grade N" string the school may not even use.
  const gradeOptions = classes.length > 0 ? Array.from(new Set(classes.map(c => c.name))) : GRADE_LEVELS;

  const teacherCourses = courses.filter(c => c.teacherName && classes.some(cl => cl.teacherName === c.teacherName));
  const studentCourses = myStudent ? courses.filter(c => c.gradeLevel === myStudent.class) : [];
  const studentEnrolled = students.filter(s => s.status === "Active");
  const displayCourses = isAdmin ? courses : isTeacher ? teacherCourses : isStudent ? studentCourses : courses;

  const filtered = displayCourses.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase());
    const matchGrade = gradeFilter === "ALL" || c.gradeLevel === gradeFilter;
    return matchSearch && matchGrade;
  });

  const totalActive = courses.filter(c => c.isActive).length;
  const totalEnrolled = studentEnrolled.length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.code || !form.gradeLevel) {
      toast({ title: "Title, Code, and Grade Level are required.", variant: "destructive" });
      return;
    }
    const res = await createCourseDB(form);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Course created successfully." });
    setCreateOpen(false);
    setForm({ ...blankCourse });
    loadCourses();
  };

  const handleUpdate = async () => {
    if (!editingCourse) return;
    const res = await updateCourseDB(editingCourse.id, editingCourse);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Course updated." });
    setEditingCourse(null);
    setEditingForm(null);
    loadCourses();
  };

  const handleDelete = async (id: string) => {
    const res = await deleteCourseDB(id);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Course deleted." });
    loadCourses();
  };

  const toggleActive = async (course: Course) => {
    const res = await updateCourseDB(course.id, { isActive: !course.isActive });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: `Course ${course.isActive ? "deactivated" : "activated"}.` });
    loadCourses();
  };

  const addOutcome = () => {
    if (!outcomeInput.trim()) return;
    setForm(f => ({ ...f, learningOutcomes: [...f.learningOutcomes, outcomeInput.trim()] }));
    setOutcomeInput("");
  };

  const addPrereq = () => {
    if (!prereqInput.trim()) return;
    setForm(f => ({ ...f, prerequisites: [...f.prerequisites, prereqInput.trim()] }));
    setPrereqInput("");
  };

  const addEditOutcome = () => {
    if (!editOutcomeInput.trim() || !editingCourse) return;
    setEditingCourse({ ...editingCourse, learningOutcomes: [...editingCourse.learningOutcomes, editOutcomeInput.trim()] });
    setEditOutcomeInput("");
  };

  const addEditPrereq = () => {
    if (!editPrereqInput.trim() || !editingCourse) return;
    setEditingCourse({ ...editingCourse, prerequisites: [...editingCourse.prerequisites, editPrereqInput.trim()] });
    setEditPrereqInput("");
  };

  if (isStudent) {
    if (!permsLoaded) return null;
  if (!can("lms.view")) return <Unauthorized />;

  return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">My Courses</h1>
          <p className="text-muted-foreground mt-1">Browse your enrolled courses</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border bg-blue-50 border-blue-100">
            <p className="text-xs font-semibold text-blue-600">Total Courses</p>
            <p className="text-2xl font-bold text-primary mt-1">{studentCourses.length}</p>
          </div>
          <div className="p-4 rounded-xl border bg-green-50 border-green-100">
            <p className="text-xs font-semibold text-green-600">Active Courses</p>
            <p className="text-2xl font-bold text-primary mt-1">{studentCourses.filter(c => c.isActive).length}</p>
          </div>
          <div className="p-4 rounded-xl border bg-purple-50 border-purple-100">
            <p className="text-xs font-semibold text-purple-600">My Grade</p>
            <p className="text-2xl font-bold text-primary mt-1">{myStudent?.class || "—"}</p>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(course => (
              <Card key={course.id} className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{course.title}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{course.code}</p>
                    </div>
                    <Badge className={course.isActive ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-600 border-0"}>
                      {course.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground line-clamp-2">{course.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span>{course.gradeLevel}</span>
                    <span className="text-muted-foreground/40">|</span>
                    <BookMarked className="h-3.5 w-3.5" />
                    <span>{course.credits} credits</span>
                  </div>
                  {course.teacherName && (
                    <p className="text-xs text-muted-foreground">Instructor: {course.teacherName}</p>
                  )}
                  <MaterialsDialog
                    course={course} canManage={false}
                    trigger={<Button type="button" variant="outline" size="sm" className="w-full gap-1.5 mt-1"><FolderOpen className="h-3.5 w-3.5" /> Notes & Video Lectures</Button>}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!isAdmin && !isTeacher) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-bold text-primary">Access Restricted</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">
            {isAdmin ? "Course Management" : "My Courses"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Create, edit and manage all courses" : "Manage your assigned courses"}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Add Course</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create New Course</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="e.g. Algebra I" /></div>
                  <div className="space-y-1"><Label>Code *</Label><Input value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value}))} placeholder="e.g. MATH-101" /></div>
                </div>
                <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} placeholder="Course description..." /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label>Grade Level *</Label>
                    <Select value={form.gradeLevel} onValueChange={v => setForm(f => ({...f, gradeLevel: v}))}>
                      <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                      <SelectContent>
                        {gradeOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Teacher</Label><Input value={form.teacherName} onChange={e => setForm(f => ({...f, teacherName: e.target.value}))} placeholder="Instructor name" /></div>
                  <div className="space-y-1"><Label>Credits</Label><Input type="number" min={1} max={10} value={form.credits} onChange={e => setForm(f => ({...f, credits: parseInt(e.target.value) || 3}))} /></div>
                </div>
                <div className="space-y-1">
                  <Label>Learning Outcomes</Label>
                  <div className="flex gap-2">
                    <Input value={outcomeInput} onChange={e => setOutcomeInput(e.target.value)} placeholder="Add an outcome..." onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOutcome(); }}} />
                    <Button type="button" size="sm" variant="outline" onClick={addOutcome}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {form.learningOutcomes.map((o, i) => (
                      <Badge key={i} className="bg-blue-50 text-blue-700 border-0 gap-1">
                        {o}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setForm(f => ({...f, learningOutcomes: f.learningOutcomes.filter((_, j) => j !== i)}))} />
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Prerequisites</Label>
                  <div className="flex gap-2">
                    <Input value={prereqInput} onChange={e => setPrereqInput(e.target.value)} placeholder="Add a prerequisite..." onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPrereq(); }}} />
                    <Button type="button" size="sm" variant="outline" onClick={addPrereq}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {form.prerequisites.map((p, i) => (
                      <Badge key={i} className="bg-amber-50 text-amber-700 border-0 gap-1">
                        {p}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setForm(f => ({...f, prerequisites: f.prerequisites.filter((_, j) => j !== i)}))} />
                      </Badge>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button type="submit">Create Course</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border bg-blue-50 border-blue-100">
          <p className="text-xs font-semibold text-blue-600">Total Courses</p>
          <p className="text-2xl font-bold text-primary mt-1">{courses.length}</p>
        </div>
        <div className="p-4 rounded-xl border bg-green-50 border-green-100">
          <p className="text-xs font-semibold text-green-600">Active Courses</p>
          <p className="text-2xl font-bold text-primary mt-1">{totalActive}</p>
        </div>
        <div className="p-4 rounded-xl border bg-purple-50 border-purple-100">
          <p className="text-xs font-semibold text-purple-600">Total Students</p>
          <p className="text-2xl font-bold text-primary mt-1">{totalEnrolled}</p>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-wrap items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{isTeacher ? "Assigned Courses" : "All Courses"}</CardTitle>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56" />
            </div>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Grades" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Grades</SelectItem>
                {gradeOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/10">
                  <TableHead className="font-bold">Title</TableHead>
                  <TableHead className="font-bold">Code</TableHead>
                  <TableHead className="font-bold">Grade</TableHead>
                  <TableHead className="font-bold">Teacher</TableHead>
                  <TableHead className="font-bold text-center">Credits</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No courses found.</TableCell></TableRow>
                ) : filtered.map(course => (
                  <TableRow key={course.id} className="hover:bg-secondary/5">
                    <TableCell className="font-semibold text-primary">{course.title}</TableCell>
                    <TableCell className="font-mono text-xs font-bold">{course.code}</TableCell>
                    <TableCell className="text-muted-foreground">{course.gradeLevel}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{course.teacherName || "—"}</TableCell>
                    <TableCell className="text-center">{course.credits}</TableCell>
                    <TableCell className="text-center">
                      {editingCourse?.id === course.id ? (
                        <Badge
                          className={`cursor-pointer ${editingCourse.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"} border-0`}
                          onClick={() => setEditingCourse({ ...editingCourse, isActive: !editingCourse.isActive })}
                        >
                          {editingCourse.isActive ? "Active" : "Inactive"}
                        </Badge>
                      ) : (
                        <Badge className={course.isActive ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-600 border-0"}>
                          {course.isActive ? "Active" : "Inactive"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <MaterialsDialog
                          course={course} canManage={true}
                          trigger={<Button variant="ghost" size="icon" className="h-8 w-8" title="Notes & Video Lectures"><FolderOpen className="h-4 w-4" /></Button>}
                        />
                        {isAdmin && (
                          <>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => { setEditingCourse({ ...course }); setEditOutcomeInput(""); setEditPrereqInput(""); }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Course</AlertDialogTitle>
                                <AlertDialogDescription>Are you sure you want to delete "{course.title}"? This cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(course.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingCourse && !editingForm} onOpenChange={o => { if (!o) { setEditingCourse(null); setEditingForm(null); }}}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit Course</DialogTitle></DialogHeader>
          {editingCourse && (
            <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Title</Label><Input value={editingCourse.title} onChange={e => setEditingCourse({...editingCourse, title: e.target.value})} /></div>
                <div className="space-y-1"><Label>Code</Label><Input value={editingCourse.code} onChange={e => setEditingCourse({...editingCourse, code: e.target.value})} /></div>
              </div>
              <div className="space-y-1"><Label>Description</Label><Textarea value={editingCourse.description} onChange={e => setEditingCourse({...editingCourse, description: e.target.value})} rows={2} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Grade Level</Label>
                  <Select value={editingCourse.gradeLevel} onValueChange={v => setEditingCourse({...editingCourse, gradeLevel: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {gradeOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Teacher</Label><Input value={editingCourse.teacherName} onChange={e => setEditingCourse({...editingCourse, teacherName: e.target.value})} /></div>
                <div className="space-y-1"><Label>Credits</Label><Input type="number" min={1} max={10} value={editingCourse.credits} onChange={e => setEditingCourse({...editingCourse, credits: parseInt(e.target.value) || 3})} /></div>
              </div>
              <div className="space-y-1">
                <Label>Learning Outcomes</Label>
                <div className="flex gap-2">
                  <Input value={editOutcomeInput} onChange={e => setEditOutcomeInput(e.target.value)} placeholder="Add..." onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEditOutcome(); }}} />
                  <Button type="button" size="sm" variant="outline" onClick={addEditOutcome}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {editingCourse.learningOutcomes.map((o, i) => (
                    <Badge key={i} className="bg-blue-50 text-blue-700 border-0 gap-1">
                      {o}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setEditingCourse({...editingCourse, learningOutcomes: editingCourse.learningOutcomes.filter((_, j) => j !== i)})} />
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Prerequisites</Label>
                <div className="flex gap-2">
                  <Input value={editPrereqInput} onChange={e => setEditPrereqInput(e.target.value)} placeholder="Add..." onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEditPrereq(); }}} />
                  <Button type="button" size="sm" variant="outline" onClick={addEditPrereq}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {editingCourse.prerequisites.map((p, i) => (
                    <Badge key={i} className="bg-amber-50 text-amber-700 border-0 gap-1">
                      {p}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setEditingCourse({...editingCourse, prerequisites: editingCourse.prerequisites.filter((_, j) => j !== i)})} />
                    </Badge>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setEditingCourse(null); setEditingForm(null); }}>Cancel</Button>
                <Button type="button" onClick={handleUpdate}>Save Changes</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
