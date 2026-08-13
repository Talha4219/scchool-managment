"use client";

import { useState, useEffect } from "react";
import { useAppState } from "@/lib/state-context";
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
import { Course } from "@/lib/types";
import {
  fetchCoursesDB, createCourseDB, updateCourseDB, deleteCourseDB,
} from "@/app/actions/features";
import {
  Plus, Search, BookOpen, BookMarked, Edit, Trash2, Check, X,
  GraduationCap, Users, Loader2, Lock, FolderOpen,
} from "lucide-react";

const GRADE_LEVELS = ["Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12"];

const blankCourse = {
  title: "", code: "", description: "", gradeLevel: "", teacherName: "",
  credits: 3, learningOutcomes: [] as string[], prerequisites: [] as string[], isActive: true,
};

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

  const loadCourses = async () => {
    setLoading(true);
    const data = await fetchCoursesDB();
    setCourses(data);
    setLoading(false);
  };

  useEffect(() => { loadCourses(); }, []);

  const isAdmin = activeRole === "ADMIN";
  const isTeacher = activeRole === "TEACHER";
  const isStudent = activeRole === "STUDENT";

  const teacherCourses = courses.filter(c => c.teacherName && classes.some(cl => cl.teacherName === c.teacherName));
  const studentEnrolled = students.filter(s => s.status === "Active");
  const displayCourses = isAdmin ? courses : isTeacher ? teacherCourses : courses;

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
            <p className="text-2xl font-bold text-primary mt-1">{courses.length}</p>
          </div>
          <div className="p-4 rounded-xl border bg-green-50 border-green-100">
            <p className="text-xs font-semibold text-green-600">Active Courses</p>
            <p className="text-2xl font-bold text-primary mt-1">{totalActive}</p>
          </div>
          <div className="p-4 rounded-xl border bg-purple-50 border-purple-100">
            <p className="text-xs font-semibold text-purple-600">My Grade</p>
            <p className="text-2xl font-bold text-primary mt-1">{students.find(s => s.status === "Active")?.class || "—"}</p>
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
                        {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
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
                {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
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
                      {isAdmin && (
                        <div className="flex gap-1">
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
                        </div>
                      )}
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
                      {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
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
