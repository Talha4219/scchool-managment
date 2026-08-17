"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppState } from "@/lib/state-context";
import { useStudents } from "@/lib/students-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { fetchParentsDB, createParentDB, updateParentDB, deleteParentDB } from "@/app/actions/features";
import type { ParentRecord } from "@/lib/types";
import { Plus, Search, MoreHorizontal, Edit2, UserX, UserCheck, Trash2, Link2, Lock, UserCircle } from "lucide-react";

export default function ParentsPage() {
  const { activeRole } = useAppState();
  const { students } = useStudents();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();

  const [parents, setParents] = useState<ParentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [createOpen, setCreateOpen] = useState(false);
  const [editParent, setEditParent] = useState<ParentRecord | null>(null);
  const [linkParent, setLinkParent] = useState<ParentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ParentRecord | null>(null);

  const blankForm = { name: "", email: "", phone: "" };
  const [form, setForm] = useState(blankForm);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchParentsDB();
    setParents(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (activeRole !== "ADMIN") {
    if (!permsLoaded) return null;
  if (!can("parents.view")) return <Unauthorized />;

  return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-bold text-primary">Admin Access Only</h2>
      </div>
    );
  }

  const filtered = parents.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCount   = parents.filter(p => p.status === "Active").length;
  const inactiveCount = parents.filter(p => p.status === "Inactive").length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: "Name and Email are required.", variant: "destructive" }); return;
    }
    const res = await createParentDB({ name: form.name, email: form.email, phone: form.phone, studentIds: [], status: "Active" });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Parent added successfully." });
    setCreateOpen(false);
    setForm(blankForm);
    load();
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editParent) return;
    const res = await updateParentDB(editParent.id, { name: editParent.name, email: editParent.email, phone: editParent.phone });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Parent updated." });
    setEditParent(null);
    load();
  };

  const handleLinkSave = async () => {
    if (!linkParent) return;
    const res = await updateParentDB(linkParent.id, { studentIds: linkedIds });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Students linked successfully." });
    setLinkParent(null);
    load();
  };

  const toggleStatus = async (p: ParentRecord) => {
    const newStatus = p.status === "Active" ? "Inactive" : "Active";
    const res = await updateParentDB(p.id, { status: newStatus });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: `Parent ${newStatus === "Active" ? "activated" : "deactivated"}.` });
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteParentDB(deleteTarget.id);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Parent removed." });
    setDeleteTarget(null);
    load();
  };

  const openLink = (p: ParentRecord) => {
    setLinkedIds(p.studentIds || []);
    setLinkParent(p);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Parent Management</h1>
          <p className="text-muted-foreground mt-1">Add, edit, link to students, and manage parent accounts</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Parent</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add New Parent</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-2">
              <div className="space-y-1"><Label>Full Name *</Label><Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. John Smith" /></div>
              <div className="space-y-1"><Label>Email Address *</Label><Input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="parent@email.com" /></div>
              <div className="space-y-1"><Label>Phone Number</Label><Input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+1 555 000 0000" /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={()=>setCreateOpen(false)}>Cancel</Button>
                <Button type="submit">Add Parent</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border bg-purple-50 border-purple-100">
          <p className="text-xs font-semibold text-purple-600">Total Parents</p>
          <p className="text-2xl font-bold text-primary mt-1">{parents.length}</p>
        </div>
        <div className="p-4 rounded-xl border bg-green-50 border-green-100">
          <p className="text-xs font-semibold text-green-600">Active</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{activeCount}</p>
        </div>
        <div className="p-4 rounded-xl border bg-gray-50 border-gray-100">
          <p className="text-xs font-semibold text-gray-500">Inactive</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">{inactiveCount}</p>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-wrap items-center gap-3">
            <UserCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Parents</CardTitle>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name or email…" value={search} onChange={e=>setSearch(e.target.value)} className="pl-9 w-56" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-6 p-6"><div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="flex items-center gap-4"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-32" /><Skeleton className="h-5 w-16 rounded-full" /></div>)}</div></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/10">
                  <TableHead className="font-bold">Name</TableHead>
                  <TableHead className="font-bold">Email</TableHead>
                  <TableHead className="font-bold">Phone</TableHead>
                  <TableHead className="font-bold">Linked Students</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No parents found.</TableCell></TableRow>
                ) : filtered.map(p => {
                  const linkedStudents = students.filter(s => (p.studentIds || []).includes(s.id));
                  return (
                    <TableRow key={p.id} className="hover:bg-secondary/5">
                      <TableCell className="font-semibold text-primary">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.email}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.phone || "—"}</TableCell>
                      <TableCell>
                        {linkedStudents.length === 0
                          ? <span className="text-xs text-muted-foreground italic">None linked</span>
                          : <div className="flex flex-wrap gap-1">{linkedStudents.map(s=>(
                              <span key={s.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{s.name}</span>
                            ))}</div>
                        }
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={p.status === "Active" ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-600 border-0"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={()=>setEditParent({...p})} className="gap-2 cursor-pointer">
                              <Edit2 className="h-3.5 w-3.5" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={()=>openLink(p)} className="gap-2 cursor-pointer">
                              <Link2 className="h-3.5 w-3.5" /> Link Students
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={()=>toggleStatus(p)} className={`gap-2 cursor-pointer ${p.status==="Active" ? "text-orange-500" : "text-green-600"}`}>
                              {p.status === "Active"
                                ? <><UserX className="h-3.5 w-3.5" /> Deactivate</>
                                : <><UserCheck className="h-3.5 w-3.5" /> Activate</>
                              }
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={()=>setDeleteTarget(p)} className="gap-2 cursor-pointer text-red-500">
                              <Trash2 className="h-3.5 w-3.5" /> Remove Parent
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editParent} onOpenChange={o=>!o&&setEditParent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Parent</DialogTitle></DialogHeader>
          {editParent && (
            <form onSubmit={handleEdit} className="space-y-4 py-2">
              <div className="space-y-1"><Label>Full Name</Label><Input value={editParent.name} onChange={e=>setEditParent({...editParent,name:e.target.value})} /></div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={editParent.email} onChange={e=>setEditParent({...editParent,email:e.target.value})} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={editParent.phone||""} onChange={e=>setEditParent({...editParent,phone:e.target.value})} /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={()=>setEditParent(null)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Link Students Dialog */}
      <Dialog open={!!linkParent} onOpenChange={o=>!o&&setLinkParent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link Students to {linkParent?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 max-h-72 overflow-y-auto">
            {students.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-4">No students available.</p>
              : students.map(s => (
                  <label key={s.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/10 cursor-pointer border border-transparent hover:border-secondary">
                    <Checkbox
                      checked={linkedIds.includes(s.id)}
                      onCheckedChange={checked => {
                        setLinkedIds(ids => checked ? [...ids, s.id] : ids.filter(id => id !== s.id));
                      }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-primary">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.class}-{s.section} • {s.admissionNumber}</p>
                    </div>
                  </label>
                ))
            }
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setLinkParent(null)}>Cancel</Button>
            <Button onClick={handleLinkSave}>Save Links</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={o=>!o&&setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Parent</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Are you sure you want to remove <span className="font-semibold text-primary">{deleteTarget?.name}</span>? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
