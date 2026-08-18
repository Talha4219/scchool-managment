"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppState } from "@/lib/state-context";
import { formatDatePK } from "@/lib/date-format";
import { useStudents } from "@/lib/students-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { fetchEventsDB, createEventDB, registerForEventDB } from "@/app/actions/features";
import type { Event, EventRegistration } from "@/lib/types";
import {
  Plus, Calendar, MapPin, Users, Clock, UserCheck, CheckCircle2,
  XCircle, Loader2, Eye, Pencil, Trash2, Filter, Search,
  Music, BookOpen, Dumbbell, Globe, Church,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Academic: BookOpen, Sports: Dumbbell, Cultural: Music, Social: Globe, Religious: Church, Workshop: BookOpen,
};

const STATUS_COLORS: Record<string, string> = {
  Upcoming: "bg-blue-50 text-blue-700 border-blue-200",
  Ongoing: "bg-green-50 text-green-700 border-green-200",
  Completed: "bg-gray-100 text-gray-700 border-gray-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
};

const EVENT_CATEGORIES = ["Academic", "Sports", "Cultural", "Social", "Religious", "Workshop"];

function formatDate(d: string) {
  return formatDatePK(d);
}

export default function EventsPage() {
  const { activeRole } = useAppState();
  const { students } = useStudents();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();

  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", category: "Academic",
    startDate: "", endDate: "", startTime: "", endTime: "",
    venue: "", organizer: "", maxParticipants: 100,
    registrationDeadline: "", budget: 0, bannerUrl: "",
  });

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({ eventId: "", studentId: "", attended: false });
  const [filterStatus, setFilterStatus] = useState<string>("All");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchEventsDB();
    setEvents(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayedEvents = useMemo(() => {
    if (filterStatus === "All") return events;
    return events.filter(e => e.status === filterStatus);
  }, [events, filterStatus]);

  const upcomingEvents = useMemo(() =>
    events.filter(e => e.status === "Upcoming" || e.status === "Ongoing").length,
    [events]
  );

  const totalParticipants = useMemo(() =>
    registrations.reduce((s, r) => s + (r.attended ? 1 : 0), 0),
    [registrations]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.startDate || !form.endDate) {
      toast({ title: "Title, start and end dates are required.", variant: "destructive" });
      return;
    }
    const res = await createEventDB({
      ...form,
      category: form.category as Event["category"],
      description: form.description || "",
      startTime: form.startTime || "",
      endTime: form.endTime || "",
      venue: form.venue || "",
      organizer: form.organizer || "",
      maxParticipants: form.maxParticipants || 0,
      registrationDeadline: form.registrationDeadline || "",
      budget: form.budget || 0,
      bannerUrl: form.bannerUrl || "",
      status: "Upcoming",
    });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Event created." });
    setCreateOpen(false);
    setForm({ title: "", description: "", category: "Academic", startDate: "", endDate: "", startTime: "", endTime: "", venue: "", organizer: "", maxParticipants: 100, registrationDeadline: "", budget: 0, bannerUrl: "" });
    load();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.eventId || !registerForm.studentId) {
      toast({ title: "Select event and student.", variant: "destructive" });
      return;
    }
    const event = events.find(ev => ev.id === registerForm.eventId);
    const student = students.find(s => s.id === registerForm.studentId);
    if (!event || !student) { toast({ title: "Invalid selection.", variant: "destructive" }); return; }
    const existing = registrations.find(r => r.eventId === registerForm.eventId && r.studentId === registerForm.studentId);
    if (existing) { toast({ title: "Already registered.", variant: "destructive" }); return; }
    const res = await registerForEventDB({
      eventId: registerForm.eventId,
      studentId: registerForm.studentId,
      studentName: student.name,
      class: `${student.class}-${student.section}`,
      registeredAt: new Date().toISOString().split("T")[0],
      attended: registerForm.attended,
      certificateIssued: false,
    });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    const newReg: EventRegistration = {
      id: `er_${Date.now()}`,
      eventId: registerForm.eventId,
      studentId: registerForm.studentId,
      studentName: student.name,
      class: `${student.class}-${student.section}`,
      registeredAt: new Date().toISOString().split("T")[0],
      attended: registerForm.attended,
      certificateIssued: false,
    };
    setRegistrations(prev => [...prev, newReg]);
    toast({ title: "Student registered." });
    setRegisterOpen(false);
    setRegisterForm({ eventId: "", studentId: "", attended: false });
  };

  const handleUpdateStatus = async (id: string, status: Event["status"]) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    toast({ title: `Status updated to ${status}.` });
  };

  const getEventRegistrations = (eventId: string) => registrations.filter(r => r.eventId === eventId);

  const getEventTitle = (id: string) => events.find(e => e.id === id)?.title || id;

  if (!permsLoaded) return null;
  if (!can("events.view")) return <Unauthorized />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Event Management</h1>
          <p className="text-muted-foreground mt-1">Create, manage and track school events and registrations.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
                <UserCheck className="h-4 w-4" /> Register Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleRegister}>
                <DialogHeader><DialogTitle>Register Student for Event</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Event</Label>
                    <Select value={registerForm.eventId} onValueChange={v => setRegisterForm(f => ({ ...f, eventId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select event..." /></SelectTrigger>
                      <SelectContent>
                        {events.filter(e => e.status !== "Cancelled" && e.status !== "Completed").map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.title} ({e.status})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Student</Label>
                    <Select value={registerForm.studentId} onValueChange={v => setRegisterForm(f => ({ ...f, studentId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select student..." /></SelectTrigger>
                      <SelectContent>
                        {students.filter(s => s.status === "Active").map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} — {s.class}-{s.section}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="attended" checked={registerForm.attended}
                      onChange={e => setRegisterForm(f => ({ ...f, attended: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300" />
                    <Label htmlFor="attended" className="text-sm">Mark as Attended</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>Cancel</Button>
                  <Button type="submit">Register</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Create Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <form onSubmit={handleCreate}>
                <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title" />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EVENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Event description..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Venue</Label>
                      <Input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder="Auditorium, Ground..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Organizer</Label>
                      <Input value={form.organizer} onChange={e => setForm(f => ({ ...f, organizer: e.target.value }))} placeholder="Teacher/Dept name" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Max Participants</Label>
                      <Input type="number" min={0} value={form.maxParticipants} onChange={e => setForm(f => ({ ...f, maxParticipants: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Registration Deadline</Label>
                      <Input type="date" value={form.registrationDeadline} onChange={e => setForm(f => ({ ...f, registrationDeadline: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Budget (Rs.)</Label>
                      <Input type="number" min={0} value={form.budget} onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button type="submit">Create Event</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-none shadow-sm bg-[#0B1B3D] text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-white/10"><Calendar className="h-6 w-6" /></div>
              <div>
                <p className="text-white/60 text-sm font-medium">Total Events</p>
                <h3 className="text-2xl font-bold">{events.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100"><Calendar className="h-6 w-6 text-blue-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Upcoming / Ongoing</p>
                <h3 className="text-2xl font-bold">{upcomingEvents}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100"><Users className="h-6 w-6 text-green-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Registrations</p>
                <h3 className="text-2xl font-bold">{registrations.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-100"><UserCheck className="h-6 w-6 text-purple-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Attended</p>
                <h3 className="text-2xl font-bold">{totalParticipants}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="events" className="gap-2"><Calendar className="h-4 w-4" /> Events</TabsTrigger>
          <TabsTrigger value="registrations" className="gap-2"><Users className="h-4 w-4" /> Registrations</TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-lg">All Events</CardTitle>
                <CardDescription>Manage school events and their status.</CardDescription>
              </div>
              <div className="flex gap-1 flex-wrap">
                {(["All", "Upcoming", "Ongoing", "Completed", "Cancelled"] as const).map(s => (
                  <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"}
                    className={`h-7 text-xs ${filterStatus === s ? "bg-primary" : ""}`}
                    onClick={() => setFilterStatus(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold">Event</TableHead>
                    <TableHead className="font-bold">Category</TableHead>
                    <TableHead className="font-bold">Dates</TableHead>
                    <TableHead className="font-bold">Venue</TableHead>
                    <TableHead className="font-bold">Organizer</TableHead>
                    <TableHead className="font-bold">Participants</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="w-[200px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedEvents.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No events found.</TableCell></TableRow>
                  ) : displayedEvents.map(event => {
                    const CatIcon = CATEGORY_ICONS[event.category] || Calendar;
                    const regCount = getEventRegistrations(event.id).length;
                    return (
                      <TableRow key={event.id} className="hover:bg-secondary/5">
                        <TableCell>
                          <div className="font-semibold text-primary">{event.title}</div>
                          {event.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{event.description}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-primary/5 gap-1">
                            <CatIcon className="h-3 w-3" /> {event.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>{formatDate(event.startDate)}</div>
                          {event.endDate && event.endDate !== event.startDate && <div className="text-muted-foreground">to {formatDate(event.endDate)}</div>}
                          {event.startTime && <div className="text-muted-foreground">{event.startTime}{event.endTime ? ` - ${event.endTime}` : ""}</div>}
                        </TableCell>
                        <TableCell className="text-xs">{event.venue || "—"}</TableCell>
                        <TableCell className="text-xs">{event.organizer || "—"}</TableCell>
                        <TableCell className="text-xs">{regCount}/{event.maxParticipants || "∞"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[event.status] || ""}>{event.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {event.status === "Upcoming" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50"
                                onClick={() => handleUpdateStatus(event.id, "Ongoing")}>Start</Button>
                            )}
                            {event.status === "Ongoing" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                onClick={() => handleUpdateStatus(event.id, "Completed")}>Complete</Button>
                            )}
                            {(event.status === "Upcoming" || event.status === "Ongoing") && (
                              <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50"
                                onClick={() => handleUpdateStatus(event.id, "Cancelled")}>Cancel</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registrations">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Event Registrations</CardTitle>
              <CardDescription>Students registered for events and attendance tracking.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold">Event</TableHead>
                    <TableHead className="font-bold">Student</TableHead>
                    <TableHead className="font-bold">Class</TableHead>
                    <TableHead className="font-bold">Registered At</TableHead>
                    <TableHead className="font-bold">Attended</TableHead>
                    <TableHead className="font-bold">Certificate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No registrations yet.</TableCell></TableRow>
                  ) : registrations.map(r => (
                    <TableRow key={r.id} className="hover:bg-secondary/5">
                      <TableCell className="font-semibold text-primary">{getEventTitle(r.eventId)}</TableCell>
                      <TableCell>{r.studentName}</TableCell>
                      <TableCell className="text-xs">{r.class}</TableCell>
                      <TableCell className="text-xs">{formatDate(r.registeredAt)}</TableCell>
                      <TableCell>
                        {r.attended ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <XCircle className="h-3 w-3 mr-1" /> No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{r.certificateIssued ? "Issued" : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
