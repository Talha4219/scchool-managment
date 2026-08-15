"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import {
  fetchAllRolePermissionsDB, bulkUpdateRolePermissionsDB, fetchUsersDB,
  fetchCustomRolesDB, createCustomRoleDB, updateCustomRoleDB, deleteCustomRoleDB, type CustomRole,
} from "@/app/actions/features";
import { ShieldCheck, Plus, Pencil, Trash2, Check, Minus } from "lucide-react";

const SYSTEM_ROLES = ["ADMIN", "TEACHER", "STUDENT", "PARENT", "EMPLOYEE"] as const;
const SYSTEM_DESCRIPTIONS: Record<string, string> = {
  ADMIN: "Full system access across every module.",
  TEACHER: "Classroom, grading, and attendance access for teaching staff.",
  STUDENT: "Self-service access to grades, fees, and timetable.",
  PARENT: "View-only access into a linked student's records.",
  EMPLOYEE: "Non-teaching staff — minimal access until customized.",
};

// The full module → permission-key catalog. One source of truth for every
// module's grantable actions, driving both the module-access cards below
// and the enabled-permission counts shown per role.
const PERMISSION_GROUPS: Record<string, { color: string; perms: string[] }> = {
  Students: { color: "cyan", perms: ['students.view', 'students.create', 'students.edit', 'students.delete'] },
  Teachers: { color: "green", perms: ['teachers.view', 'teachers.create', 'teachers.edit', 'teachers.delete'] },
  Admissions: { color: "amber", perms: ['admissions.view', 'admissions.create', 'admissions.edit', 'admissions.delete', 'admissions.approve', 'admissions.reject'] },
  Classes: { color: "purple", perms: ['classes.view', 'classes.create', 'classes.edit', 'classes.delete', 'classes.grades', 'classes.students'] },
  Assignments: { color: "purple", perms: ['assignments.view', 'assignments.create', 'assignments.grade', 'assignments.delete'] },
  Attendance: { color: "green", perms: ['attendance.view', 'attendance.mark', 'attendance.staff.manage'] },
  Exams: { color: "amber", perms: ['exams.view', 'exams.create', 'exams.edit', 'exams.delete', 'exams.dashboard', 'exams.manage', 'exams.marks', 'exams.results', 'exams.report-cards', 'exams.analytics', 'exams.online', 'exams.books', 'exams.settings'] },
  Results: { color: "blue", perms: ['results.view', 'results.enter', 'results.approve', 'results.publish'] },
  Fees: { color: "amber", perms: ['fees.view', 'fees.create', 'fees.edit', 'fees.delete'] },
  Timetable: { color: "blue", perms: ['timetable.view', 'timetable.create', 'timetable.edit', 'timetable.delete', 'timetable.substitute'] },
  Announcements: { color: "amber", perms: ['announcements.view', 'announcements.create', 'announcements.edit', 'announcements.delete'] },
  Library: { color: "amber", perms: ['library.view', 'library.create', 'library.edit', 'library.delete'] },
  Accounting: { color: "green", perms: ['accounting.view', 'accounting.create', 'accounting.edit'] },
  HR: { color: "blue", perms: ['hr.view', 'hr.create', 'hr.edit'] },
  Payroll: { color: "rose", perms: ['payroll.view', 'payroll.create', 'payroll.edit'] },
  Inventory: { color: "orange", perms: ['inventory.view', 'inventory.create', 'inventory.edit'] },
  Procurement: { color: "teal", perms: ['procurement.view', 'procurement.create', 'procurement.edit'] },
  Hostel: { color: "orange", perms: ['hostel.view', 'hostel.create', 'hostel.edit'] },
  Discipline: { color: "amber", perms: ['discipline.view', 'discipline.create', 'discipline.edit'] },
  Scholarships: { color: "amber", perms: ['scholarships.view', 'scholarships.create', 'scholarships.edit'] },
  Alumni: { color: "amber", perms: ['alumni.view', 'alumni.create', 'alumni.edit'] },
  Events: { color: "amber", perms: ['events.view', 'events.create', 'events.edit'] },
  Messages: { color: "cyan", perms: ['messages.view'] },
  Communications: { color: "cyan", perms: ['communications.view', 'communications.create'] },
  LMS: { color: "purple", perms: ['lms.view', 'lms.create', 'lms.edit'] },
  Parents: { color: "pink", perms: ['parents.view', 'parents.create', 'parents.edit'] },
  Transport: { color: "orange", perms: ['transport.view', 'transport.create', 'transport.edit'] },
  Reports: { color: "blue", perms: ['reports.view', 'reports.export'] },
  Settings: { color: "slate", perms: ['settings.view', 'settings.edit'] },
  Users: { color: "blue", perms: ['users.view', 'users.create', 'users.edit', 'users.delete'] },
  "Audit Log": { color: "rose", perms: ['audit.view'] },
};

const COLORS = ["blue", "green", "purple", "orange", "pink", "teal", "amber", "rose", "cyan", "slate"] as const;
const dotColor: Record<string, string> = {
  blue: "bg-blue-500", green: "bg-green-500", purple: "bg-purple-500", orange: "bg-orange-500",
  pink: "bg-pink-500", teal: "bg-teal-500", amber: "bg-amber-500", rose: "bg-rose-500",
  cyan: "bg-cyan-500", slate: "bg-slate-500",
};
const roleLabel = (r: string) => r.charAt(0) + r.slice(1).toLowerCase();

type RoleRow = {
  key: string; name: string; description: string; isCustom: boolean; custom: CustomRole | null;
};

export default function PermissionsPage() {
  const { can, loaded: permsLoaded } = usePermission();
  const { toast } = useToast();

  const [allPerms, setAllPerms] = useState<Record<string, Record<string, boolean>>>({});
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const [perms, roles, users] = await Promise.all([fetchAllRolePermissionsDB(), fetchCustomRolesDB(), fetchUsersDB()]);
    setAllPerms(perms);
    setCustomRoles(roles);
    const counts: Record<string, number> = {};
    for (const u of users as any[]) {
      const key = u.customRoleId || u.role;
      counts[key] = (counts[key] || 0) + 1;
    }
    setUserCounts(counts);
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows: RoleRow[] = useMemo(() => [
    ...SYSTEM_ROLES.map(r => ({ key: r as string, name: roleLabel(r), description: SYSTEM_DESCRIPTIONS[r], isCustom: false, custom: null })),
    ...customRoles.map(cr => ({ key: cr.id, name: cr.name, description: cr.description || `${roleLabel(cr.baseRole)}-based custom role.`, isCustom: true, custom: cr })),
  ], [customRoles]);

  const permCount = (key: string) => Object.values(allPerms[key] || {}).filter(Boolean).length;

  // ── Create / Edit role panel (always visible, box-in-box) ─────────────
  // permChecked is the real RBAC unit — one entry per actual permission key
  // (e.g. "fees.approve"), not a module-level on/off. A module card expands
  // to show its individual actions the moment any one of them is selected.
  const emptyForm = { name: "", description: "", baseRole: "TEACHER" as string };
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [permChecked, setPermChecked] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<CustomRole | null>(null);

  const resetForm = () => { setEditing(null); setForm(emptyForm); setPermChecked({}); };

  const openEdit = (row: RoleRow) => {
    setEditing(row);
    setForm({ name: row.name, description: row.custom?.description || "", baseRole: row.custom?.baseRole || "TEACHER" });
    setPermChecked({ ...(allPerms[row.key] || {}) });
  };

  const moduleState = (perms: string[]): "all" | "some" | "none" => {
    const onCount = perms.filter(p => permChecked[p]).length;
    return onCount === 0 ? "none" : onCount === perms.length ? "all" : "some";
  };

  // Master checkbox: none/some → select every action in the module (and expand it);
  // all → clear every action in the module (and collapse it back).
  const toggleModule = (perms: string[]) => {
    const turnOn = moduleState(perms) !== "all";
    setPermChecked(prev => ({ ...prev, ...Object.fromEntries(perms.map(p => [p, turnOn])) }));
  };

  const togglePerm = (perm: string) => setPermChecked(prev => ({ ...prev, [perm]: !prev[perm] }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast({ title: "Role name is required", variant: "destructive" }); return; }
    const allPermKeys = Object.values(PERMISSION_GROUPS).flatMap(g => g.perms);
    const permMap = Object.fromEntries(allPermKeys.map(p => [p, !!permChecked[p]]));

    try {
      if (editing?.isCustom) {
        const res = await updateCustomRoleDB(editing.key, { name: form.name, description: form.description });
        if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
        const permsRes = await bulkUpdateRolePermissionsDB(editing.key, permMap);
        if (permsRes.error) { toast({ title: permsRes.error, variant: "destructive" }); return; }
        toast({ title: "Role updated." });
      } else if (editing && !editing.isCustom) {
        const permsRes = await bulkUpdateRolePermissionsDB(editing.key, permMap);
        if (permsRes.error) { toast({ title: permsRes.error, variant: "destructive" }); return; }
        toast({ title: `${editing.name}'s permissions updated.` });
      } else {
        const res = await createCustomRoleDB({ name: form.name, baseRole: form.baseRole, description: form.description });
        if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
        if (res.id) {
          const permsRes = await bulkUpdateRolePermissionsDB(res.id, permMap);
          if (permsRes.error) { toast({ title: permsRes.error, variant: "destructive" }); return; }
        }
        toast({ title: `"${form.name}" created.` });
      }
      resetForm();
      load();
    } catch {
      toast({ title: "Something went wrong saving the role. Please try again.", variant: "destructive" });
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteTarget) return;
    const res = await deleteCustomRoleDB(deleteTarget.id);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: `"${deleteTarget.name}" deleted.` });
    if (editing?.key === deleteTarget.id) resetForm();
    setDeleteTarget(null);
    load();
  };

  if (!permsLoaded) return null;
  if (!can("settings.edit")) return <Unauthorized message="Only administrators can manage permissions." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Permissions & Roles</h1>
          <p className="text-sm text-muted-foreground">Manage system and custom roles, and each role's module access.</p>
        </div>
      </div>

      {/* Role list */}
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
        {rows.map(row => (
          <div key={row.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{row.name}</p>
                <p className="text-xs text-muted-foreground truncate">{row.description}</p>
              </div>
              <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Active</span>
              <span className="shrink-0 text-xs text-muted-foreground">{userCounts[row.key] || 0} user{(userCounts[row.key] || 0) === 1 ? "" : "s"}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{permCount(row.key)} perms</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => openEdit(row)} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              {row.isCustom && (
                <button onClick={() => setDeleteTarget(row.custom!)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete role">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit role panel */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <h2 className="text-base font-bold text-foreground">{editing ? `Edit ${editing.name}` : "Create Role"}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Role Name *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Accounts Manager" disabled={!!editing && !editing.isCustom} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief role description" disabled={!!editing && !editing.isCustom} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Module Access <span className="text-xs font-normal text-muted-foreground">(select a module, then pick the exact actions this role can perform)</span></p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 items-start">
            {Object.entries(PERMISSION_GROUPS).map(([group, { color, perms }]) => {
              const state = moduleState(perms);
              const onCount = perms.filter(p => permChecked[p]).length;
              return (
                <div key={group} className={`rounded-xl border bg-secondary/20 transition-colors ${state === "none" ? "border-border" : "border-primary/30 bg-primary/5"}`}>
                  <div className="flex items-start gap-2 px-3 py-2.5 cursor-pointer" onClick={() => toggleModule(perms)}>
                    <span className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center ${state === "all" ? "bg-primary border-primary" : state === "some" ? "bg-primary/20 border-primary" : "border-border"}`}>
                      {state === "all" && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      {state === "some" && <Minus className="h-2.5 w-2.5 text-primary" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor[color]}`} />
                        {group}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{onCount > 0 ? `${onCount} of ${perms.length} actions` : `${perms.length} action${perms.length === 1 ? "" : "s"}`}</p>
                    </div>
                  </div>
                  {state !== "none" && (
                    <div className="border-t border-primary/20 px-3 py-2 space-y-1.5">
                      {perms.map(p => {
                        const actionLabel = p.split(".")[1].replace(/-/g, " ");
                        const on = !!permChecked[p];
                        return (
                          <label key={p} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={on} onChange={() => togglePerm(p)} className="h-3 w-3 rounded border-border accent-primary" />
                            <span className="text-[11px] text-muted-foreground capitalize">{actionLabel}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSubmit} className="gap-2"><Plus className="h-4 w-4" /> {editing ? "Save Changes" : "Create Role"}</Button>
          {editing && <Button variant="outline" onClick={resetForm}>Cancel</Button>}
        </div>
      </div>

      {/* Delete custom role confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Custom Role</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Delete <strong>{deleteTarget?.name}</strong>? This only works if no user is currently assigned this role.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteRole}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
