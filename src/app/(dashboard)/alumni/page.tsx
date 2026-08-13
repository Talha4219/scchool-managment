"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppState } from "@/lib/state-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { fetchAlumniDB, createAlumniDB } from "@/app/actions/features";
import type { Alumni } from "@/lib/types";
import {
  GraduationCap, Plus, Search, Users, Building, Gift,
  Linkedin, Phone, Mail, MapPin, CalendarDays, Filter,
} from "lucide-react";

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AlumniPage() {
  const { activeRole } = useAppState();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();

  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("All");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", graduationYear: new Date().getFullYear(),
    class: "", currentOccupation: "", company: "", address: "",
    linkedinUrl: "", facebookUrl: "", isDonor: false, donationAmount: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAlumniDB();
    setAlumni(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const graduationYears = useMemo(() => {
    const years = new Set(alumni.map(a => a.graduationYear));
    return Array.from(years).sort((a, b) => b - a);
  }, [alumni]);

  const filteredAlumni = useMemo(() => {
    let result = alumni;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(term) ||
        a.currentOccupation?.toLowerCase().includes(term) ||
        a.company?.toLowerCase().includes(term)
      );
    }
    if (yearFilter !== "All") {
      result = result.filter(a => a.graduationYear === Number(yearFilter));
    }
    return result;
  }, [alumni, searchTerm, yearFilter]);

  const stats = useMemo(() => ({
    total: alumni.length,
    donors: alumni.filter(a => a.isDonor).length,
    totalDonations: alumni.reduce((s, a) => s + (a.donationAmount || 0), 0),
    active: alumni.filter(a => a.status === "Active").length,
    byYear: graduationYears.map(year => ({
      year,
      count: alumni.filter(a => a.graduationYear === year).length,
    })),
  }), [alumni, graduationYears]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: "Name and email are required.", variant: "destructive" });
      return;
    }
    const res = await createAlumniDB({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone || "",
      graduationYear: form.graduationYear,
      class: form.class || "",
      currentOccupation: form.currentOccupation || "",
      company: form.company || "",
      address: form.address || "",
      linkedinUrl: form.linkedinUrl || "",
      facebookUrl: form.facebookUrl || "",
      isDonor: form.isDonor,
      donationAmount: form.isDonor ? form.donationAmount : 0,
      status: "Active",
    });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Alumni added successfully." });
    setCreateOpen(false);
    setForm({ name: "", email: "", phone: "", graduationYear: new Date().getFullYear(), class: "", currentOccupation: "", company: "", address: "", linkedinUrl: "", facebookUrl: "", isDonor: false, donationAmount: 0 });
    load();
  };

  if (!permsLoaded) return null;
  if (!can("alumni.view")) return <Unauthorized />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Alumni Management</h1>
          <p className="text-muted-foreground mt-1">Directory, donor tracking, and engagement for school alumni.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add Alumni
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <form onSubmit={handleCreate}>
              <DialogHeader><DialogTitle>Add Alumni Record</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Alumni name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Graduation Year</Label>
                    <Input type="number" min={1950} max={2099} value={form.graduationYear}
                      onChange={e => setForm(f => ({ ...f, graduationYear: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Class / Batch</Label>
                    <Input value={form.class} onChange={e => setForm(f => ({ ...f, class: e.target.value }))} placeholder="e.g. Grade 10-A" />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Occupation</Label>
                    <Input value={form.currentOccupation} onChange={e => setForm(f => ({ ...f, currentOccupation: e.target.value }))} placeholder="e.g. Software Engineer" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Company name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="City / Address" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>LinkedIn URL</Label>
                    <Input value={form.linkedinUrl} onChange={e => setForm(f => ({ ...f, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Facebook URL</Label>
                    <Input value={form.facebookUrl} onChange={e => setForm(f => ({ ...f, facebookUrl: e.target.value }))} placeholder="https://facebook.com/..." />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <input type="checkbox" id="isDonor" checked={form.isDonor}
                    onChange={e => setForm(f => ({ ...f, isDonor: e.target.checked, donationAmount: e.target.checked ? f.donationAmount : 0 }))}
                    className="h-4 w-4 rounded border-gray-300" />
                  <Label htmlFor="isDonor" className="text-sm font-medium text-amber-800">Mark as Donor</Label>
                  {form.isDonor && (
                    <div className="ml-auto w-40">
                      <Input type="number" placeholder="Donation amount" value={form.donationAmount}
                        onChange={e => setForm(f => ({ ...f, donationAmount: Number(e.target.value) }))}
                        className="h-8 text-sm" min={0} />
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit">Save Alumni</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-none shadow-sm bg-[#0B1B3D] text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-white/10"><GraduationCap className="h-6 w-6" /></div>
              <div>
                <p className="text-white/60 text-sm font-medium">Total Alumni</p>
                <h3 className="text-2xl font-bold">{stats.total}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100"><Users className="h-6 w-6 text-blue-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Active</p>
                <h3 className="text-2xl font-bold">{stats.active}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100"><Gift className="h-6 w-6 text-green-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Donors</p>
                <h3 className="text-2xl font-bold">{stats.donors}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-100"><Building className="h-6 w-6 text-purple-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Total Donations</p>
                <h3 className="text-2xl font-bold">Rs. {stats.totalDonations.toLocaleString()}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {stats.byYear.map(({ year, count }) => (
          <Card key={year} className="border-none shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground font-medium">Class of {year}</p>
              <p className="text-2xl font-bold text-primary mt-1">{count}</p>
              <p className="text-xs text-muted-foreground">alumni</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-lg">Alumni Directory</CardTitle>
            <CardDescription>Complete list of school alumni.</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search alumni..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-36 h-9">
                <Filter className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Years</SelectItem>
                {graduationYears.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow>
                <TableHead className="font-bold">Name</TableHead>
                <TableHead className="font-bold">Graduation Year</TableHead>
                <TableHead className="font-bold">Class</TableHead>
                <TableHead className="font-bold">Occupation</TableHead>
                <TableHead className="font-bold">Company</TableHead>
                <TableHead className="font-bold">Contact</TableHead>
                <TableHead className="font-bold">Donor</TableHead>
                <TableHead className="font-bold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAlumni.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No alumni found.</TableCell></TableRow>
              ) : filteredAlumni.map(a => (
                <TableRow key={a.id} className="hover:bg-secondary/5">
                  <TableCell>
                    <div className="font-semibold text-primary">{a.name}</div>
                    {a.linkedinUrl && (
                      <a href={a.linkedinUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                        <Linkedin className="h-3 w-3" /> Profile
                      </a>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="bg-primary/5">{a.graduationYear}</Badge></TableCell>
                  <TableCell className="text-xs">{a.class || "—"}</TableCell>
                  <TableCell className="text-xs">{a.currentOccupation || "—"}</TableCell>
                  <TableCell className="text-xs">{a.company || "—"}</TableCell>
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" /> {a.email}</div>
                    {a.phone && <div className="flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3 text-muted-foreground" /> {a.phone}</div>}
                  </TableCell>
                  <TableCell>
                    {a.isDonor ? (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
                        <Gift className="h-3 w-3" /> Rs. {a.donationAmount?.toLocaleString() || "Donor"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={a.status === "Active" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600"}>{a.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
