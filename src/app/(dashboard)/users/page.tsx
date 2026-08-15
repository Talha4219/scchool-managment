"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAppState } from "@/lib/state-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import {
  fetchUsersDB, updateUserDB, deleteUserDB, resetUserPasswordDB, createUserDB,
  fetchPendingUsersDB, approveUserDB, rejectUserDB, fetchCustomRolesDB,
  deactivateUserDB, reactivateUserDB, type CustomRole,
} from "@/app/actions/features";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Lock, ShieldAlert, Trash2, Plus, Users, KeyRound, Pencil, Clock, CheckCircle2, XCircle,
  Eye, Phone, CreditCard, GraduationCap, Briefcase, Download, ShieldCheck, UserX, UserCheck2,
} from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";

type User = {
  id: number; name: string; email: string; role: string; createdAt: Date; status: string;
  customRoleId: string | null; customRoleName: string | null; customRoleColor: string | null;
};

type PendingUser = {
  id: number; name: string; email: string; role: string; createdAt: Date;
  profile: {
    phone: string; cnic: string; specialization: string; qualification: string;
    experienceYears: number; joiningDate: string; address: string;
    profilePhoto: string | null; degreePhoto: string | null;
  } | null;
};

const SYSTEM_ROLES = ["ADMIN", "TEACHER", "STUDENT", "PARENT", "EMPLOYEE"] as const;

const roleBadge: Record<string, string> = {
  ADMIN: "bg-blue-100 text-blue-800",
  TEACHER: "bg-green-100 text-green-800",
  STUDENT: "bg-orange-100 text-orange-800",
  PARENT: "bg-purple-100 text-purple-800",
  EMPLOYEE: "bg-cyan-100 text-cyan-800",
};

const customColorBadge: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800", green: "bg-green-100 text-green-800",
  purple: "bg-purple-100 text-purple-800", orange: "bg-orange-100 text-orange-800",
  pink: "bg-pink-100 text-pink-800", teal: "bg-teal-100 text-teal-800",
  amber: "bg-amber-100 text-amber-800", rose: "bg-rose-100 text-rose-800",
};

export default function UsersPage() {
  const { activeRole } = useAppState();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();
  const [users, setUsers] = useState<User[]>([]);
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [viewPending, setViewPending] = useState<PendingUser | null>(null);

  // Forms — a role field value is either a bare system role ("TEACHER") or
  // "custom:<id>" for a custom role; split apart right before hitting the DB.
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", roleValue: "STUDENT" });
  const [editRoleValue, setEditRoleValue] = useState("STUDENT");
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [data, pendingData, roles] = await Promise.all([fetchUsersDB(), fetchPendingUsersDB(), fetchCustomRolesDB()]);
    setUsers(data as User[]);
    setPending(pendingData as PendingUser[]);
    setCustomRoles(roles);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (activeRole !== "ADMIN") {
    if (!permsLoaded) return null;
    if (!can("users.view")) return <Unauthorized />;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-bold text-primary">Admin Access Only</h2>
        <p className="text-muted-foreground text-sm">User management is restricted to administrators.</p>
      </div>
    );
  }

  const parseRoleValue = (v: string): { role: string; customRoleId: string | null } => {
    if (v.startsWith("custom:")) {
      const customRoleId = v.slice("custom:".length);
      const cr = customRoles.find(c => c.id === customRoleId);
      return { role: cr?.baseRole || "STUDENT", customRoleId };
    }
    return { role: v, customRoleId: null };
  };

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "ALL"
      || (roleFilter === "CUSTOM" ? !!u.customRoleId : (u.role === roleFilter && !u.customRoleId));
    return matchSearch && matchRole;
  });

  const handleCreate = async () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast({ title: "Missing fields", variant: "destructive" }); return;
    }
    const { role, customRoleId } = parseRoleValue(createForm.roleValue);
    const res = await createUserDB(createForm.name, createForm.email, createForm.password, role as any, customRoleId);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "User created successfully." });
    setCreateOpen(false);
    setCreateForm({ name: "", email: "", password: "", roleValue: "STUDENT" });
    load();
  };

  const handleUpdateRole = async () => {
    if (!editUser) return;
    const { role, customRoleId } = parseRoleValue(editRoleValue);
    const res = await updateUserDB(editUser.id, { role: role as any, customRoleId });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Role updated." });
    setEditUser(null);
    load();
  };

  const handleReset = async () => {
    if (!resetUser || newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters.", variant: "destructive" }); return;
    }
    const res = await resetUserPasswordDB(resetUser.id, newPassword);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Password reset successfully." });
    setResetUser(null);
    setNewPassword("");
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    const res = await deleteUserDB(deleteUser.id);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "User deleted." });
    setDeleteUser(null);
    load();
  };

  const handleToggleActive = async (u: User) => {
    const res = u.status === "INACTIVE" ? await reactivateUserDB(u.id) : await deactivateUserDB(u.id);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: u.status === "INACTIVE" ? `${u.name} reactivated.` : `${u.name} deactivated — they can no longer sign in.` });
    load();
  };

  const handleApprove = async (id: number, name: string) => {
    const res = await approveUserDB(id);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: `${name}'s account approved.` });
    setViewPending(null);
    load();
  };

  const handleReject = async (id: number, name: string) => {
    const res = await rejectUserDB(id);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: `${name}'s account rejected and removed.` });
    setViewPending(null);
    load();
  };

  const counts = {
    ALL: users.length,
    ADMIN: users.filter(u => u.role === "ADMIN" && !u.customRoleId).length,
    TEACHER: users.filter(u => u.role === "TEACHER" && !u.customRoleId).length,
    STUDENT: users.filter(u => u.role === "STUDENT" && !u.customRoleId).length,
    PARENT: users.filter(u => u.role === "PARENT" && !u.customRoleId).length,
    EMPLOYEE: users.filter(u => u.role === "EMPLOYEE" && !u.customRoleId).length,
    CUSTOM: users.filter(u => !!u.customRoleId).length,
  };

  const RoleSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>System Roles</SelectLabel>
          {SYSTEM_ROLES.map(r => <SelectItem key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</SelectItem>)}
        </SelectGroup>
        {customRoles.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Custom Roles</SelectLabel>
              {customRoles.map(cr => (
                <SelectItem key={cr.id} value={`custom:${cr.id}`}>
                  {cr.name} <span className="text-muted-foreground">({cr.baseRole.charAt(0) + cr.baseRole.slice(1).toLowerCase()}-based)</span>
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">User Management</h1>
          <p className="text-muted-foreground mt-1">Create, edit, and manage all system accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/permissions">
            <Button variant="outline" className="gap-2"><ShieldCheck className="h-4 w-4" /> Permissions & Roles</Button>
          </Link>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Add User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1"><Label>Full Name</Label><Input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" /></div>
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="john@school.edu" /></div>
                <div className="space-y-1"><Label>Password</Label><Input type="password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" /></div>
                <div className="space-y-1"><Label>Role</Label>
                  <RoleSelect value={createForm.roleValue} onChange={v => setCreateForm(f => ({ ...f, roleValue: v }))} />
                </div>
              </div>
              <DialogFooter><Button onClick={handleCreate}>Create User</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
        {(["ALL", "ADMIN", "TEACHER", "STUDENT", "PARENT", "EMPLOYEE", "CUSTOM"] as const).map(r => (
          <button key={r} onClick={() => setRoleFilter(r)} className={`p-4 rounded-xl border text-left transition-all ${roleFilter === r ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
            <p className="text-xs font-semibold text-muted-foreground">{r === "ALL" ? "All Users" : r === "CUSTOM" ? "Custom Roles" : r.charAt(0) + r.slice(1).toLowerCase()}</p>
            <p className="text-2xl font-bold text-primary mt-1">{counts[r]}</p>
          </button>
        ))}
      </div>
      {/* Pending Approvals */}
      {pending.length > 0 && (
        <Card className="border-amber-200 shadow-sm bg-amber-50/30">
          <CardHeader className="pb-3 border-b border-amber-100">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base text-amber-800">Pending Approvals</CardTitle>
              <Badge className="bg-amber-100 text-amber-700 border-0 ml-1">{pending.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-amber-50/50">
                  <TableHead className="font-bold">Name</TableHead>
                  <TableHead className="font-bold">Email</TableHead>
                  <TableHead className="font-bold">Role</TableHead>
                  <TableHead className="font-bold">Applied</TableHead>
                  <TableHead className="font-bold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map(u => (
                  <TableRow key={u.id} className="hover:bg-amber-50/50">
                    <TableCell className="font-semibold text-primary">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                    <TableCell><Badge className={`${roleBadge[u.role] ?? "bg-gray-100 text-gray-800"} border-0 text-xs`}>{u.role}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {u.profile && (
                          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => setViewPending(u)}>
                            <Eye className="h-3.5 w-3.5" /> View Profile
                          </Button>
                        )}
                        <Button size="sm" className="h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(u.id, u.name)}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="h-8 gap-1.5 text-xs" onClick={() => handleReject(u.id, u.name)}>
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Registered Users</CardTitle>
            <div className="ml-auto flex gap-2">
              <Input placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
              <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                exportToCsv("users", ["Name", "Email", "Role", "Custom Role", "Status"],
                  filtered.map(u => [u.name, u.email, u.role, u.customRoleName || "", u.status]));
              }}>
                <Download className="h-4 w-4" /> Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6"><div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="flex items-center gap-4 py-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-44" /><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16 ml-auto rounded" /></div>)}</div></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found.</TableCell></TableRow>
                ) : filtered.map(u => (
                  <TableRow key={u.id} className={u.status === "INACTIVE" ? "opacity-60" : ""}>
                    <TableCell className="font-semibold">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge className={`${roleBadge[u.role]} border-0 text-xs`}>{u.role}</Badge>
                        {u.customRoleName && (
                          <Badge className={`${customColorBadge[u.customRoleColor || "blue"]} border-0 text-xs`}>{u.customRoleName}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={u.status === "INACTIVE" ? "bg-secondary text-muted-foreground" : "bg-green-100 text-green-800"}>
                        {u.status === "INACTIVE" ? "Inactive" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditUser(u); setEditRoleValue(u.customRoleId ? `custom:${u.customRoleId}` : u.role); }} title="Edit role"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setResetUser(u)} title="Reset password"><KeyRound className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleToggleActive(u)} title={u.status === "INACTIVE" ? "Reactivate" : "Deactivate"}>
                          {u.status === "INACTIVE" ? <UserCheck2 className="h-3.5 w-3.5 text-green-600" /> : <UserX className="h-3.5 w-3.5 text-amber-600" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteUser(u)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={!!editUser} onOpenChange={o => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Role — {editUser?.name}</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2"><Label>Role</Label>
            <RoleSelect value={editRoleValue} onChange={setEditRoleValue} />
          </div>
          <DialogFooter><Button onClick={handleUpdateRole}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={o => !o && setResetUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password — {resetUser?.name}</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2"><Label>New Password</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" /></div>
          <DialogFooter><Button onClick={handleReset}>Reset Password</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={o => !o && setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete User</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Are you sure you want to delete <strong>{deleteUser?.name}</strong>? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Pending Profile Dialog */}
      <Dialog open={!!viewPending} onOpenChange={o => !o && setViewPending(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Application — {viewPending?.name}</DialogTitle></DialogHeader>
          {viewPending && (
            <ScrollArea className="max-h-[70vh] pr-2">
              <div className="space-y-5 py-2">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-border">
                    {viewPending.profile?.profilePhoto && (
                      <AvatarImage src={viewPending.profile.profilePhoto} alt={viewPending.name} className="object-cover" />
                    )}
                    <AvatarFallback className="text-lg font-bold bg-green-100 text-green-800">
                      {viewPending.name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-lg font-bold text-primary">{viewPending.name}</h2>
                    <p className="text-sm text-muted-foreground">{viewPending.email}</p>
                    <Badge className={`${roleBadge[viewPending.role] ?? ""} border-0 text-xs mt-1`}>{viewPending.role}</Badge>
                  </div>
                </div>

                {viewPending.profile && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-secondary/10">
                        <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-medium">{viewPending.profile.phone || "—"}</p></div>
                      </div>
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-secondary/10">
                        <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div><p className="text-xs text-muted-foreground">CNIC</p><p className="text-sm font-medium">{viewPending.profile.cnic || "—"}</p></div>
                      </div>
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-secondary/10">
                        <GraduationCap className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div><p className="text-xs text-muted-foreground">Specialization</p><p className="text-sm font-medium">{viewPending.profile.specialization || "—"}</p></div>
                      </div>
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-secondary/10">
                        <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div><p className="text-xs text-muted-foreground">Qualification</p><p className="text-sm font-medium">{viewPending.profile.qualification || "—"}</p></div>
                      </div>
                    </div>
                    {viewPending.profile.degreePhoto && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Degree / Certificate</p>
                        <img src={viewPending.profile.degreePhoto} alt="Degree" className="rounded-lg border w-full max-h-48 object-contain bg-secondary/5" />
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewPending(null)}>Close</Button>
            {viewPending && (
              <>
                <Button variant="destructive" className="gap-1.5" onClick={() => handleReject(viewPending.id, viewPending.name)}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                <Button className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => handleApprove(viewPending.id, viewPending.name)}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
