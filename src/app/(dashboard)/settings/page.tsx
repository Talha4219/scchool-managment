"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAppState } from "@/lib/state-context";
import { Subject, FeeCategory, AcademicTerm, Section, GradeScaleItem } from "@/lib/types";
import { fetchAllSectionsDB, createSectionDB, updateSectionDB, deleteSectionDB } from "@/app/actions/academic-core";
import { fetchUsersDB, fetchAllRolePermissionsDB, bulkUpdateRolePermissionsDB, updateRolePermissionDB, updateUserDB } from "@/app/actions/features";
import { fetchGradeScalesDB, updateGradeScaleDB } from "@/app/actions/academic-core";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, CalendarDays, Layers, BookOpen, DollarSign, Percent, Settings2, ChevronRight, Zap,
  Search, Check, Save, Plus, Users, UserCog, CreditCard, ShieldCheck, XCircle, ScanLine,
} from "lucide-react";
import { fetchGatewayAvailabilityAction } from "@/app/actions/payments";
import {
  fetchDeviceKeysAction, generateDeviceKeyAction, revokeDeviceKeyAction,
  fetchStudentCardsAction, assignStudentCardAction, removeStudentCardAction,
  type DeviceKeyRecord, type StudentCardRecord,
} from "@/app/actions/attendance-devices";

const GRADE_LEVELS = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

const labelCls = "block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide";
const inputSelectCls = "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition";
const addPanelCls = "mb-4 p-4 bg-secondary/40 rounded-2xl border border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3";
const tableWrapCls = "overflow-x-auto rounded-2xl border border-border";
const theadCls = "bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground";
const tbodyDivideCls = "divide-y divide-border";

function SoftCard({ icon: Icon, title, sub, action, children }: { icon?: React.ElementType; title?: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="soft-card p-5">
      {title && (
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {Icon && <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0"><Icon className="h-5 w-5 text-primary" /></div>}
            <div><h2 className="text-[15px] font-semibold text-foreground">{title}</h2>{sub && <p className="text-sm text-muted-foreground">{sub}</p>}</div>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── TAB 1 – School Profile ──────────────────────────────────────────────────

function SchoolProfileTab() {
  const { schoolInfo, updateSchoolInfo } = useAppState();
  const [form, setForm] = useState({ ...schoolInfo, phone: (schoolInfo as any).phone || "", website: (schoolInfo as any).website || "", principal: (schoolInfo as any).principal || "" });
  const [saved, setSaved] = useState(false);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = () => {
    updateSchoolInfo(form as any);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <SoftCard icon={Building2} title="School Profile" sub="Core information about your institution">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className={labelCls}>School Name</label><Input value={form.name} onChange={f("name")} placeholder="e.g. St. Jude's Academy" /></div>
        <div><label className={labelCls}>Registration Number</label><Input value={form.registrationNumber} onChange={f("registrationNumber")} placeholder="SJA-2026-001" /></div>
        <div><label className={labelCls}>Contact Email</label><Input type="email" value={form.contactEmail} onChange={f("contactEmail")} placeholder="admin@school.edu" /></div>
        <div><label className={labelCls}>Phone Number</label><Input value={form.phone} onChange={f("phone")} placeholder="+1 (555) 000-0000" /></div>
        <div className="sm:col-span-2"><label className={labelCls}>Address</label><textarea value={form.address} onChange={f("address")} rows={2} className={`${inputSelectCls} resize-none`} placeholder="Street, City, Country" /></div>
        <div><label className={labelCls}>Website</label><Input value={form.website} onChange={f("website")} placeholder="https://school.edu" /></div>
        <div><label className={labelCls}>Principal / Head</label><Input value={form.principal} onChange={f("principal")} placeholder="Dr. Jane Smith" /></div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} className={saved ? "bg-success hover:bg-success/90" : ""}>
          {saved ? <><Check className="h-4 w-4 mr-1" /> Saved!</> : <><Save className="h-4 w-4 mr-1" /> Save School Profile</>}
        </Button>
      </div>
    </SoftCard>
  );
}

// ─── TAB 2 – Academic Year & Terms ──────────────────────────────────────────

function AcademicTermsTab() {
  const { schoolInfo, updateSchoolInfo, academicTerms, addAcademicTerm, updateAcademicTerm, setActiveTerm } = useAppState();
  const [yearVal, setYearVal] = useState(schoolInfo.academicYear || "");
  const [yearSaved, setYearSaved] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [termForm, setTermForm] = useState<Omit<AcademicTerm, "id">>({ name: "", startDate: "", endDate: "", isActive: false });
  const [editing, setEditing] = useState<AcademicTerm | null>(null);

  const saveYear = () => { updateSchoolInfo({ ...schoolInfo, academicYear: yearVal }); setYearSaved(true); setTimeout(() => setYearSaved(false), 2000); };
  const addTerm = () => { if (!termForm.name || !termForm.startDate || !termForm.endDate) return; addAcademicTerm(termForm); setTermForm({ name: "", startDate: "", endDate: "", isActive: false }); setShowAdd(false); };

  return (
    <div className="space-y-5">
      <SoftCard icon={CalendarDays} title="Academic Year" sub="The current school year — e.g. 2026-2027">
        <div className="flex items-end gap-3">
          <div className="w-56"><label className={labelCls}>Current Year</label><Input value={yearVal} onChange={e => setYearVal(e.target.value)} placeholder="2026-2027" /></div>
          <Button onClick={saveYear} className={yearSaved ? "bg-success hover:bg-success/90" : ""}>{yearSaved ? "Saved!" : "Save"}</Button>
        </div>
      </SoftCard>
      <SoftCard
        icon={CalendarDays} title="Academic Terms" sub="Configure terms within the year"
        action={<Button size="sm" onClick={() => setShowAdd(v => !v)}><Plus className="h-4 w-4 mr-1" /> Add Term</Button>}
      >
        {showAdd && (
          <div className={addPanelCls}>
            <div className="lg:col-span-2"><label className={labelCls}>Term Name</label><Input value={termForm.name} onChange={e => setTermForm({ ...termForm, name: e.target.value })} placeholder="e.g. Term 1" /></div>
            <div><label className={labelCls}>Start Date</label><Input type="date" value={termForm.startDate} onChange={e => setTermForm({ ...termForm, startDate: e.target.value })} /></div>
            <div><label className={labelCls}>End Date</label><Input type="date" value={termForm.endDate} onChange={e => setTermForm({ ...termForm, endDate: e.target.value })} /></div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={addTerm}>Add Term</Button>
            </div>
          </div>
        )}
        <div className={tableWrapCls}>
          <table className="w-full text-sm">
            <thead className={theadCls}>
              <tr><th className="px-4 py-3 text-left">Term Name</th><th className="px-4 py-3 text-left">Start</th><th className="px-4 py-3 text-left">End</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className={tbodyDivideCls}>
              {academicTerms.map(t => (
                <tr key={t.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{editing?.id === t.id ? <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="py-1 text-xs" /> : t.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{editing?.id === t.id ? <Input type="date" value={editing.startDate} onChange={e => setEditing({ ...editing, startDate: e.target.value })} className="py-1 text-xs" /> : t.startDate}</td>
                  <td className="px-4 py-3 text-muted-foreground">{editing?.id === t.id ? <Input type="date" value={editing.endDate} onChange={e => setEditing({ ...editing, endDate: e.target.value })} className="py-1 text-xs" /> : t.endDate}</td>
                  <td className="px-4 py-3"><Badge className={t.isActive ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"}>{t.isActive ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    {editing?.id === t.id ? (
                      <span className="flex justify-end gap-3 text-xs font-medium">
                        <button className="text-success hover:opacity-80" onClick={() => { updateAcademicTerm(editing); setEditing(null); }}>Save</button>
                        <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditing(null)}>Cancel</button>
                      </span>
                    ) : (
                      <span className="flex justify-end gap-3 text-xs font-medium">
                        <button className="text-primary hover:opacity-80" onClick={() => setEditing({ ...t })}>Edit</button>
                        {!t.isActive && <button className="text-success hover:opacity-80" onClick={() => setActiveTerm(t.id)}>Set Active</button>}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SoftCard>
    </div>
  );
}

// ─── TAB 3 – Classes & Sections ─────────────────────────────────────────────

function ClassSectionsTab() {
  const { classes } = useAppState();
  const confirm = useConfirm();
  const [sections, setSections] = useState<Section[]>([]);
  const [teachers, setTeachers] = useState<{ id: number; name: string }[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Omit<Section, "id">>({ name: "", classId: "cls-10", capacity: 30, teacherName: "", group: "" });
  const [editing, setEditing] = useState<Section | null>(null);

  useEffect(() => {
    fetchAllSectionsDB().then(setSections);
    fetchUsersDB().then(users => setTeachers((users as any[]).filter(u => u.role === "TEACHER").map(u => ({ id: u.id, name: u.name }))));
  }, []);

  const classLabel = (id: string) => classes.find(c => c.id === id)?.name || id;
  const grouped = classes.reduce<Record<string, Section[]>>((acc, cls) => { const s = sections.filter(x => x.classId === cls.id); if (s.length) acc[cls.id] = s; return acc; }, {});

  const handleAdd = async () => {
    if (!form.name || !form.classId) return;
    const created = await createSectionDB({ name: form.name, capacity: form.capacity, teacherName: form.teacherName, classId: form.classId, group: form.group || undefined });
    if (created) setSections(prev => [...prev, created]);
    setForm({ name: "", classId: "cls-10", capacity: 30, teacherName: "", group: "" }); setShowAdd(false);
  };

  return (
    <SoftCard
      icon={Layers} title="Classes & Sections" sub="Configure grade levels and their sections"
      action={<Button size="sm" onClick={() => setShowAdd(v => !v)}><Plus className="h-4 w-4 mr-1" /> Add Section</Button>}
    >
      {showAdd && (
        <div className={addPanelCls}>
          <div><label className={labelCls}>Grade Level</label><select value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })} className={inputSelectCls}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className={labelCls}>Section</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="A, B, C…" /></div>
          <div><label className={labelCls}>Capacity</label><Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 30 })} /></div>
          <div><label className={labelCls}>Class Teacher</label><select value={form.teacherName || ""} onChange={e => setForm({ ...form, teacherName: e.target.value })} className={inputSelectCls}><option value="">None</option>{teachers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select></div>
          <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button><Button size="sm" onClick={handleAdd}>Add Section</Button></div>
        </div>
      )}
      {Object.keys(grouped).length === 0 && <p className="text-center py-12 text-muted-foreground text-sm">No sections configured yet.</p>}
      <div className="space-y-6">
        {Object.entries(grouped).map(([classId, secs]) => (
          <div key={classId}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{classLabel(classId)}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {secs.map(sec => (
                <div key={sec.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
                  {editing?.id === sec.id ? (
                    <div className="space-y-2">
                      <div className="flex gap-2"><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Section" className="w-20 py-1 text-xs" /><Input type="number" value={String(editing.capacity)} onChange={e => setEditing({ ...editing, capacity: parseInt(e.target.value) || 30 })} placeholder="Cap" className="w-20 py-1 text-xs" /></div>
                      <div className="flex gap-2 justify-end"><button className="text-xs font-medium text-success" onClick={async () => { await updateSectionDB({ id: sec.id, name: editing.name, capacity: editing.capacity, teacherName: editing.teacherName, group: editing.group || undefined }); setSections(prev => prev.map(x => x.id === sec.id ? editing : x)); setEditing(null); }}>Save</button><button className="text-xs font-medium text-muted-foreground" onClick={() => setEditing(null)}>Cancel</button></div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between"><span className="font-bold text-primary text-base">{classLabel(sec.classId).replace("Grade ", "G")}–{sec.name}</span><Badge className="bg-info/15 text-info">Cap {sec.capacity}</Badge></div>
                      {sec.group && <p className="text-xs text-muted-foreground mt-0.5">{sec.group}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">{sec.teacherName || "No teacher assigned"}</p>
                      <div className="mt-3 flex gap-3 text-xs font-medium"><button className="text-primary" onClick={() => setEditing({ ...sec })}>Edit</button><button className="text-destructive" onClick={async () => { const ok = await confirm({ title: `Delete section ${sec.name}?`, description: "Any students currently enrolled in this section will need to be reassigned. This cannot be undone." }); if (!ok) return; await deleteSectionDB(sec.id); setSections(prev => prev.filter(x => x.id !== sec.id)); }}>Delete</button></div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SoftCard>
  );
}

// ─── TAB 4 – Subjects ────────────────────────────────────────────────────────

function SubjectsTab() {
  const { subjects, addSubject, updateSubject, deleteSubject } = useAppState();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Omit<Subject, "id">>({ name: "", code: "", gradeLevel: "All", teacherName: "", isElective: false });
  const [editing, setEditing] = useState<Subject | null>(null);
  const [search, setSearch] = useState("");
  const filtered = subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <SoftCard
      icon={BookOpen} title="Subjects" sub="Manage academic subjects taught across all grade levels"
      action={
        <div className="flex gap-2">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subjects..." className="w-48 pl-8 py-1.5" /></div>
          <Button size="sm" onClick={() => setShowAdd(v => !v)}><Plus className="h-4 w-4 mr-1" /> Add Subject</Button>
        </div>
      }
    >
      {showAdd && (
        <div className={`${addPanelCls} lg:grid-cols-5`}>
          <div className="lg:col-span-2"><label className={labelCls}>Subject Name</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Mathematics" /></div>
          <div><label className={labelCls}>Code</label><Input value={form.name ? form.name.replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase() : "—"} disabled className="bg-muted text-muted-foreground" /></div>
          <div><label className={labelCls}>Grade Level</label><select value={form.gradeLevel} onChange={e => setForm({ ...form, gradeLevel: e.target.value })} className={inputSelectCls}><option value="All">All Grades</option>{GRADE_LEVELS.map(g => <option key={g}>{g}</option>)}</select></div>
          <div className="flex items-end justify-between gap-2 lg:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground"><input type="checkbox" checked={form.isElective} onChange={e => setForm({ ...form, isElective: e.target.checked })} className="accent-primary" /> Elective</label>
            <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button><Button size="sm" onClick={() => { if (!form.name) { toast({ title: "Subject name required", variant: "destructive" }); return; } const code = form.name.replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase(); addSubject({ ...form, code }); toast({ title: `"${form.name}" added` }); setForm({ name: "", code: "", gradeLevel: "All", teacherName: "", isElective: false }); setShowAdd(false); }}>Add Subject</Button></div>
          </div>
        </div>
      )}
      <div className={tableWrapCls}>
        <table className="w-full text-sm">
          <thead className={theadCls}>
            <tr><th className="px-4 py-3 text-left">Code</th><th className="px-4 py-3 text-left">Subject</th><th className="px-4 py-3 text-left">Grade</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className={tbodyDivideCls}>
            {filtered.map(sub => (
              <tr key={sub.id} className="hover:bg-secondary/30 transition-colors">
                {editing?.id === sub.id ? (
                  <>
                    <td className="px-4 py-2"><Input value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value })} className="py-1 text-xs w-24" /></td>
                    <td className="px-4 py-2"><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="py-1 text-xs" /></td>
                    <td className="px-4 py-2"><select value={editing.gradeLevel} onChange={e => setEditing({ ...editing, gradeLevel: e.target.value })} className="rounded-lg border border-border bg-card px-2 py-1 text-xs focus:ring-2 focus:ring-ring"><option value="All">All</option>{GRADE_LEVELS.map(g => <option key={g}>{g}</option>)}</select></td>
                    <td className="px-4 py-2"><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={editing.isElective} onChange={e => setEditing({ ...editing, isElective: e.target.checked })} className="accent-primary" /> Elective</label></td>
                    <td className="px-4 py-2 text-right"><span className="flex justify-end gap-3 text-xs font-medium"><button className="text-success" onClick={() => { updateSubject(editing); setEditing(null); toast({ title: `"${editing.name}" updated` }); }}>Save</button><button className="text-muted-foreground" onClick={() => setEditing(null)}>Cancel</button></span></td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3"><code className="bg-secondary text-primary px-1.5 py-0.5 rounded text-xs font-mono">{sub.code}</code></td>
                    <td className="px-4 py-3 font-medium text-foreground">{sub.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sub.gradeLevel}</td>
                    <td className="px-4 py-3"><Badge className={sub.isElective ? "bg-info/15 text-info" : "bg-success/15 text-success"}>{sub.isElective ? "Elective" : "Core"}</Badge></td>
                    <td className="px-4 py-3 text-right"><span className="flex justify-end gap-3 text-xs font-medium"><button className="text-primary" onClick={() => setEditing({ ...sub })}>Edit</button><button className="text-destructive" onClick={async () => { const ok = await confirm({ title: `Delete "${sub.name}"?`, description: "This subject will be removed from all classes and teacher assignments that reference it. This cannot be undone." }); if (!ok) return; deleteSubject(sub.id); toast({ title: `"${sub.name}" deleted` }); }}>Delete</button></span></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SoftCard>
  );
}

// ─── TAB 5 – Fee Categories ──────────────────────────────────────────────────

const FREQ_BADGE: Record<string, string> = { monthly: "bg-success/15 text-success", quarterly: "bg-info/15 text-info", annually: "bg-warning/15 text-warning", "one-time": "bg-secondary text-muted-foreground" };

function FeeCategoriesTab() {
  const { feeCategories, addFeeCategory, updateFeeCategory, deleteFeeCategory } = useAppState();
  const confirm = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Omit<FeeCategory, "id">>({ name: "", description: "", defaultAmount: 0, frequency: "monthly", isActive: true });
  const [editing, setEditing] = useState<FeeCategory | null>(null);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Categories", value: feeCategories.length, iconColor: "text-primary" },
          { label: "Active Categories", value: feeCategories.filter(c => c.isActive).length, iconColor: "text-success" },
          { label: "Est. Annual / Student", value: `Rs.${(feeCategories.filter(c => c.isActive && c.frequency === "monthly").reduce((s, c) => s + c.defaultAmount * 12, 0) + feeCategories.filter(c => c.isActive && c.frequency === "annually").reduce((s, c) => s + c.defaultAmount, 0) + feeCategories.filter(c => c.isActive && c.frequency === "quarterly").reduce((s, c) => s + c.defaultAmount * 4, 0)).toLocaleString()}`, iconColor: "text-info" },
        ].map(s => (
          <div key={s.label} className="soft-card p-5">
            <p className={`text-3xl font-bold ${s.iconColor}`}>{s.value}</p>
            <p className="text-muted-foreground text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      <SoftCard
        icon={DollarSign} title="Fee Categories" sub="Define the types of fees charged to students"
        action={<Button size="sm" onClick={() => setShowAdd(v => !v)}><Plus className="h-4 w-4 mr-1" /> Add Category</Button>}
      >
        {showAdd && (
          <div className={addPanelCls}>
            <div className="lg:col-span-2"><label className={labelCls}>Category Name</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Tuition Fee" /></div>
            <div><label className={labelCls}>Default Amount (Rs.)</label><Input type="number" min={0} value={String(form.defaultAmount)} onChange={e => setForm({ ...form, defaultAmount: parseFloat(e.target.value) || 0 })} /></div>
            <div><label className={labelCls}>Frequency</label><select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as FeeCategory["frequency"] })} className={inputSelectCls}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option><option value="one-time">One-time</option></select></div>
            <div className="sm:col-span-2 lg:col-span-4"><label className={labelCls}>Description</label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description…" /></div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button><Button size="sm" onClick={() => { if (!form.name) return; addFeeCategory(form); setForm({ name: "", description: "", defaultAmount: 0, frequency: "monthly", isActive: true }); setShowAdd(false); }}>Add Category</Button></div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {feeCategories.map(cat => (
            <div key={cat.id} className={`rounded-2xl border p-4 transition-colors ${cat.isActive ? "border-border bg-card" : "border-border/60 bg-secondary/20 opacity-60"}`}>
              {editing?.id === cat.id ? (
                <div className="space-y-2">
                  <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Name" className="py-1 text-xs" />
                  <div className="flex gap-2"><Input type="number" value={String(editing.defaultAmount)} onChange={e => setEditing({ ...editing, defaultAmount: parseFloat(e.target.value) || 0 })} className="py-1 text-xs" /><select value={editing.frequency} onChange={e => setEditing({ ...editing, frequency: e.target.value as FeeCategory["frequency"] })} className="rounded-lg border border-border bg-card px-2 py-1 text-xs focus:ring-2 focus:ring-ring"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option><option value="one-time">One-time</option></select></div>
                  <Input value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="Description" className="py-1 text-xs" />
                  <div className="flex gap-3 justify-end text-xs font-medium"><button className="text-success" onClick={() => { updateFeeCategory(editing); setEditing(null); }}>Save</button><button className="text-muted-foreground" onClick={() => setEditing(null)}>Cancel</button></div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2"><span className="font-semibold text-foreground text-sm">{cat.name}</span><Badge className={FREQ_BADGE[cat.frequency]}>{cat.frequency}</Badge></div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{cat.description}</p>
                  <p className="mt-3 text-2xl font-bold text-primary">Rs. {cat.defaultAmount.toLocaleString()}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs font-medium"><button className={cat.isActive ? "text-warning" : "text-success"} onClick={() => updateFeeCategory({ ...cat, isActive: !cat.isActive })}>{cat.isActive ? "Deactivate" : "Activate"}</button><button className="text-primary" onClick={() => setEditing({ ...cat })}>Edit</button><button className="text-destructive" onClick={async () => { const ok = await confirm({ title: `Delete "${cat.name}"?`, description: "This fee category will no longer be available when generating new vouchers. Existing vouchers already issued under it are not affected. This cannot be undone." }); if (!ok) return; deleteFeeCategory(cat.id); }}>Delete</button></div>
                </>
              )}
            </div>
          ))}
        </div>
      </SoftCard>
    </div>
  );
}

// ─── TAB 6 – Users ─────────────────────────────────────────────────────────

const ROLES = ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] as const;

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-primary/10 text-primary',
  TEACHER: 'bg-success/15 text-success',
  STUDENT: 'bg-warning/15 text-warning',
  PARENT: 'bg-purple-100 text-purple-700',
};

function UsersTab() {
  const [users, setUsers] = useState<{ id: number; name: string; email: string; role: string; status: string }[]>([]);
  const [editingUser, setEditingUser] = useState<{ id: number; name: string; role: string } | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  useEffect(() => { fetchUsersDB().then(setUsers); }, []);

  const filteredUsers = users.filter(u => {
    const ms = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return ms && (roleFilter === "ALL" || u.role === roleFilter);
  });

  const roleCounts = { ALL: users.length, ADMIN: users.filter(u => u.role === "ADMIN").length, TEACHER: users.filter(u => u.role === "TEACHER").length, STUDENT: users.filter(u => u.role === "STUDENT").length, PARENT: users.filter(u => u.role === "PARENT").length };

  return (
    <SoftCard icon={Users} title="Users" sub="Manage user accounts and roles">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email..." className="pl-8" /></div>
        <div className="flex gap-1 flex-wrap">
          {(["ALL", "ADMIN", "TEACHER", "STUDENT", "PARENT"] as const).map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${roleFilter === r ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-secondary/50"}`}>
              {r === "ALL" ? "All" : r} ({roleCounts[r]})
            </button>
          ))}
        </div>
      </div>
      <div className={tableWrapCls}>
        <table className="w-full text-sm">
          <thead className={theadCls}>
            <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3 text-left">Role</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className={tbodyDivideCls}>
            {filteredUsers.map(u => (
              <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                <td className="py-2.5 px-3 font-medium text-foreground">{u.name}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{u.email}</td>
                <td className="py-2.5 px-3">
                  {editingUser?.id === u.id ? (
                    <select value={editingUser.role} onChange={e => { updateUserDB(u.id, { role: e.target.value as any }); setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: e.target.value } : x)); setEditingUser(null); }}
                      className="rounded-lg border border-border bg-card px-2 py-1 text-xs focus:ring-2 focus:ring-ring">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <Badge className={ROLE_BADGE[u.role] || "bg-secondary text-muted-foreground"}>{u.role}</Badge>
                  )}
                </td>
                <td className="py-2.5 px-3"><Badge className={u.status === "ACTIVE" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}>{u.status}</Badge></td>
                <td className="py-2.5 px-3 text-right">
                  {editingUser?.id === u.id ? (
                    <span className="text-xs text-muted-foreground">Select role from dropdown</span>
                  ) : (
                    <button className="text-xs font-medium text-primary hover:opacity-80" onClick={() => setEditingUser({ id: u.id, name: u.name, role: u.role })}>Edit Role</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SoftCard>
  );
}

// ─── TAB 7 – Permissions ────────────────────────────────────────────────────

const PERMISSION_GROUPS: Record<string, { icon: string; perms: string[] }> = {
  Students: { icon: "👨‍🎓", perms: ['students.view', 'students.create', 'students.edit', 'students.delete'] },
  Teachers: { icon: "👨‍🏫", perms: ['teachers.view', 'teachers.create', 'teachers.edit', 'teachers.delete'] },
  Admissions: { icon: "📋", perms: ['admissions.view', 'admissions.create', 'admissions.edit', 'admissions.delete', 'admissions.approve', 'admissions.reject'] },
  Classes: { icon: "🏛️", perms: ['classes.view', 'classes.create', 'classes.edit', 'classes.delete', 'classes.grades', 'classes.students'] },
  Attendance: { icon: "✅", perms: ['attendance.view', 'attendance.mark'] },
  Exams: { icon: "📝", perms: ['exams.view', 'exams.create', 'exams.edit', 'exams.delete', 'exams.dashboard', 'exams.manage', 'exams.marks', 'exams.results', 'exams.report-cards', 'exams.analytics', 'exams.settings'] },
  Results: { icon: "📊", perms: ['results.view', 'results.enter', 'results.approve', 'results.publish'] },
  Fees: { icon: "💰", perms: ['fees.view', 'fees.create', 'fees.edit', 'fees.delete'] },
  Timetable: { icon: "📅", perms: ['timetable.view', 'timetable.create', 'timetable.edit', 'timetable.delete'] },
  Announcements: { icon: "📢", perms: ['announcements.view', 'announcements.create', 'announcements.edit', 'announcements.delete'] },
  Library: { icon: "📚", perms: ['library.view', 'library.create', 'library.edit', 'library.delete'] },
  Accounting: { icon: "💵", perms: ['accounting.view', 'accounting.create', 'accounting.edit'] },
  HR: { icon: "💼", perms: ['hr.view', 'hr.create', 'hr.edit'] },
  Payroll: { icon: "💼", perms: ['payroll.view', 'payroll.create', 'payroll.edit'] },
  Inventory: { icon: "📦", perms: ['inventory.view', 'inventory.create', 'inventory.edit'] },
  Procurement: { icon: "📦", perms: ['procurement.view', 'procurement.create', 'procurement.edit'] },
  Hostel: { icon: "📦", perms: ['hostel.view', 'hostel.create', 'hostel.edit'] },
  Discipline: { icon: "🏅", perms: ['discipline.view', 'discipline.create', 'discipline.edit'] },
  Scholarships: { icon: "🏅", perms: ['scholarships.view', 'scholarships.create', 'scholarships.edit'] },
  Alumni: { icon: "🏅", perms: ['alumni.view', 'alumni.create', 'alumni.edit'] },
  Events: { icon: "🏅", perms: ['events.view', 'events.create', 'events.edit'] },
  Communications: { icon: "📡", perms: ['communications.view', 'communications.create'] },
  LMS: { icon: "🖥️", perms: ['lms.view', 'lms.create', 'lms.edit'] },
  Parents: { icon: "🤝", perms: ['parents.view', 'parents.create', 'parents.edit'] },
  Settings: { icon: "⚙️", perms: ['settings.view', 'settings.edit'] },
  Users: { icon: "🔐", perms: ['users.view', 'users.create', 'users.edit', 'users.delete'] },
};

function PermissionsTab() {
  const [allPerms, setAllPerms] = useState<Record<string, Record<string, boolean>>>({});
  const [activeRoleTab, setActiveRoleTab] = useState<string>("ADMIN");
  const [permSearch, setPermSearch] = useState("");

  useEffect(() => { fetchAllRolePermissionsDB().then(setAllPerms); }, []);

  const filteredGroups = Object.entries(PERMISSION_GROUPS).filter(([group, { perms }]) =>
    group.toLowerCase().includes(permSearch.toLowerCase()) ||
    perms.some(p => p.toLowerCase().includes(permSearch.toLowerCase()))
  );

  return (
    <SoftCard icon={UserCog} title="Role Permissions" sub="Control access for all modules across the system">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1 flex-wrap">
          {ROLES.map(r => (
            <button key={r} onClick={() => setActiveRoleTab(r)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${activeRoleTab === r ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-muted-foreground border-border hover:bg-secondary/50"}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={permSearch} onChange={e => setPermSearch(e.target.value)} placeholder="Search modules..." className="w-48 pl-8 py-1.5" />
        </div>
      </div>
      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
        {filteredGroups.map(([group, { icon, perms }]) => {
          const rolePerms = allPerms[activeRoleTab] || {};
          const allEnabled = perms.every(p => rolePerms[p]);
          const someEnabled = perms.some(p => rolePerms[p]);
          return (
            <div key={group} className="rounded-2xl border border-border bg-secondary/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>{icon}</span> {group}
                </h4>
                <button onClick={() => { bulkUpdateRolePermissionsDB(activeRoleTab, Object.fromEntries(perms.map(p => [p, !allEnabled]))).then(() => { fetchAllRolePermissionsDB().then(setAllPerms); }); }}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${allEnabled ? "bg-primary/10 text-primary border-primary/20" : someEnabled ? "bg-warning/15 text-warning border-warning/30" : "bg-secondary text-muted-foreground border-border"}`}>
                  {allEnabled ? "All On" : someEnabled ? "Partial" : "All Off"}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1.5">
                {perms.map(p => {
                  const enabled = rolePerms[p] ?? false;
                  const label = p.split(".")[1].replace(/-/g, " ");
                  return (
                    <button key={p} onClick={async () => {
                      const newval = !enabled;
                      await updateRolePermissionDB(activeRoleTab, p, newval);
                      setAllPerms(prev => ({ ...prev, [activeRoleTab]: { ...prev[activeRoleTab], [p]: newval } }));
                    }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${enabled ? "bg-primary/10 text-primary border-primary/20" : "bg-card text-muted-foreground border-border hover:border-foreground/20"}`}>
                      <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${enabled ? "bg-primary border-primary" : "border-border"}`}>
                        {enabled && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </SoftCard>
  );
}

// ─── TAB 8 – Grade Scale ───────────────────────────────────────────────────

function GradeScaleTab() {
  const [grades, setGrades] = useState<GradeScaleItem[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ minPercentage: 0, maxPercentage: 100, grade: '', points: 0, isPass: true });

  useEffect(() => { fetchGradeScalesDB().then(setGrades); }, []);

  const gradeClass = (g: string) => {
    const colors: Record<string, string> = { 'A*': 'bg-success/15 text-success', A: 'bg-success/15 text-success', B: 'bg-info/15 text-info', C: 'bg-primary/10 text-primary', D: 'bg-warning/15 text-warning', E: 'bg-warning/15 text-warning', F: 'bg-destructive/15 text-destructive' };
    return colors[g] || 'bg-secondary text-muted-foreground';
  };

  return (
    <SoftCard icon={Percent} title="Grade Scale" sub="Configure percentage ranges and grade labels">
      <div className={tableWrapCls}>
        <table className="w-full text-sm">
          <thead className={theadCls}>
            <tr><th className="px-4 py-3 text-left">Grade</th><th className="px-4 py-3 text-left">Min %</th><th className="px-4 py-3 text-left">Max %</th><th className="px-4 py-3 text-left">GPA Points</th><th className="px-4 py-3 text-left">Pass?</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className={tbodyDivideCls}>
            {grades.map(g => (
              <tr key={g.id} className="hover:bg-secondary/30 transition-colors">
                <td className="py-2.5 px-3">{editing === g.id ? <Input value={editForm.grade} onChange={e => setEditForm({ ...editForm, grade: e.target.value })} className="w-16 py-1 text-xs" /> : <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${gradeClass(g.grade)}`}>{g.grade}</span>}</td>
                <td className="py-2.5 px-3">{editing === g.id ? <Input type="number" value={editForm.minPercentage} onChange={e => setEditForm({ ...editForm, minPercentage: parseFloat(e.target.value) || 0 })} className="w-20 py-1 text-xs" /> : <span className="text-foreground">{g.minPercentage}%</span>}</td>
                <td className="py-2.5 px-3">{editing === g.id ? <Input type="number" value={editForm.maxPercentage} onChange={e => setEditForm({ ...editForm, maxPercentage: parseFloat(e.target.value) || 100 })} className="w-20 py-1 text-xs" /> : <span className="text-foreground">{g.maxPercentage}%</span>}</td>
                <td className="py-2.5 px-3">{editing === g.id ? <Input type="number" step="0.1" value={editForm.points} onChange={e => setEditForm({ ...editForm, points: parseFloat(e.target.value) || 0 })} className="w-16 py-1 text-xs" /> : <span className="text-foreground">{g.points.toFixed(1)}</span>}</td>
                <td className="py-2.5 px-3">{editing === g.id ? <button onClick={() => setEditForm({ ...editForm, isPass: !editForm.isPass })} className={`px-2 py-1 rounded text-xs font-medium ${editForm.isPass ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>{editForm.isPass ? 'Yes' : 'No'}</button> : <span className={`text-xs font-medium ${g.isPass ? 'text-success' : 'text-destructive'}`}>{g.isPass ? 'Yes' : 'No'}</span>}</td>
                <td className="py-2.5 px-3 text-right">{editing === g.id ? <span className="flex gap-2 justify-end text-xs font-medium"><button className="text-success" onClick={async () => { const res = await updateGradeScaleDB(g.id, editForm); if (!res.error) { setGrades(prev => prev.map(x => x.id === g.id ? { ...x, ...editForm } : x)); setEditing(null); } }}>Save</button><button className="text-muted-foreground" onClick={() => setEditing(null)}>Cancel</button></span> : <button className="text-xs font-medium text-primary" onClick={() => { setEditing(g.id); setEditForm({ minPercentage: g.minPercentage, maxPercentage: g.maxPercentage, grade: g.grade, points: g.points, isPass: g.isPass }); }}>Edit</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Grades are checked from highest to lowest. Ensure ranges don't overlap.</p>
    </SoftCard>
  );
}

// ─── TAB 9 – Payment Gateways ───────────────────────────────────────────────

function PaymentGatewaysTab() {
  const [availability, setAvailability] = useState<{ jazzcash: boolean; easypaisa: boolean }>({ jazzcash: false, easypaisa: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGatewayAvailabilityAction().then(a => { setAvailability(a); setLoading(false); });
  }, []);

  const gateways = [
    {
      key: "jazzcash", name: "JazzCash", color: "bg-red-50 text-red-600", configured: availability.jazzcash,
      envVars: ["JAZZCASH_MERCHANT_ID", "JAZZCASH_PASSWORD", "JAZZCASH_INTEGRITY_SALT", "JAZZCASH_HCP_URL (optional, defaults to sandbox)"],
    },
    {
      key: "easypaisa", name: "EasyPaisa", color: "bg-green-50 text-green-600", configured: availability.easypaisa,
      envVars: ["EASYPAISA_STORE_ID", "EASYPAISA_HASH_KEY", "EASYPAISA_HCP_URL (optional, defaults to sandbox)"],
    },
  ];

  return (
    <SoftCard icon={CreditCard} title="Payment Gateways" sub="Lets students and parents pay fee vouchers online instead of at the office">
      <div className="space-y-4">
        {!loading && gateways.map(g => (
          <div key={g.key} className="rounded-2xl border border-border p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-xl ${g.color} flex items-center justify-center shrink-0`}>
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{g.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                  Merchant credentials are read from server environment variables, never stored in the database, so they can't be exposed through this UI. Set:
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {g.envVars.map(v => <li key={v} className="text-[11px] font-mono text-muted-foreground">{v}</li>)}
                </ul>
              </div>
            </div>
            <Badge className={`shrink-0 border-0 gap-1 ${g.configured ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {g.configured ? <ShieldCheck className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {g.configured ? "Configured" : "Not configured"}
            </Badge>
          </div>
        ))}
        {!loading && !availability.jazzcash && !availability.easypaisa && (
          <p className="text-xs text-muted-foreground bg-secondary/30 rounded-xl p-3">
            Neither gateway is configured yet — students and parents will see fee vouchers as pay-in-person only until one is set up. Restart the app after adding environment variables.
          </p>
        )}
      </div>
    </SoftCard>
  );
}

// ─── TAB 10 – Attendance Devices (biometric/RFID) ──────────────────────────

function AttendanceDevicesTab() {
  const { students } = useAppState();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [keys, setKeys] = useState<DeviceKeyRecord[]>([]);
  const [cards, setCards] = useState<StudentCardRecord[]>([]);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [cardStudentId, setCardStudentId] = useState("");
  const [cardUid, setCardUid] = useState("");
  const [cardLabel, setCardLabel] = useState("");

  const load = () => {
    fetchDeviceKeysAction().then(setKeys);
    fetchStudentCardsAction().then(setCards);
  };
  useEffect(() => { load(); }, []);

  const handleGenerateKey = async () => {
    if (!newDeviceName.trim()) return;
    const res = await generateDeviceKeyAction(newDeviceName);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    setIssuedKey(res.apiKey!);
    setNewDeviceName("");
    load();
  };

  const handleRevokeKey = async (id: string, name: string) => {
    const ok = await confirm({ title: `Revoke "${name}"?`, description: "This device will no longer be able to submit attendance scans. This cannot be undone." });
    if (!ok) return;
    await revokeDeviceKeyAction(id);
    toast({ title: "Device key revoked" });
    load();
  };

  const handleAssignCard = async () => {
    if (!cardStudentId || !cardUid.trim()) { toast({ title: "Select a student and enter a card ID.", variant: "destructive" }); return; }
    const res = await assignStudentCardAction(cardStudentId, cardUid, cardLabel || undefined);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Card assigned" });
    setCardStudentId(""); setCardUid(""); setCardLabel("");
    load();
  };

  const handleRemoveCard = async (id: string, name: string) => {
    const ok = await confirm({ title: `Unassign card from ${name}?`, description: "They'll need a new card enrolled before device/kiosk check-in will recognize them again." });
    if (!ok) return;
    await removeStudentCardAction(id);
    toast({ title: "Card unassigned" });
    load();
  };

  return (
    <div className="space-y-5">
      <SoftCard
        icon={ScanLine} title="Attendance Devices" sub="Connect RFID card readers, barcode scanners, or biometric devices for automatic check-in"
      >
        <div className="rounded-2xl border border-border p-4 bg-secondary/20 mb-5 space-y-2">
          <p className="text-sm font-semibold text-foreground">Two ways to capture attendance without manual entry</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li><b>Kiosk Mode</b> — open <span className="font-mono">/attendance/kiosk</span> on any browser plugged into a USB RFID/barcode reader (most act as a keyboard — no drivers needed). Staff sign in once, then students just tap their card.</li>
            <li><b>Device API</b> — for standalone biometric/fingerprint units (ZKTeco, Suprema, etc.) with their own bridge software: issue an API key below and point the device's integration at <span className="font-mono">POST /api/attendance/checkin</span>.</li>
          </ul>
        </div>

        <div className="flex items-end gap-2 mb-4">
          <div className="flex-1">
            <Label className="text-xs">New device name</Label>
            <Input value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)} placeholder="e.g. Main Gate Fingerprint Scanner" />
          </div>
          <Button onClick={handleGenerateKey}><Plus className="h-4 w-4 mr-1" /> Generate API Key</Button>
        </div>

        {issuedKey && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4 space-y-1.5">
            <p className="text-xs font-semibold text-amber-800">Copy this key now — it won't be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border border-amber-200 rounded-lg px-3 py-2 break-all">{issuedKey}</code>
              <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(issuedKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}

        <div className={tableWrapCls}>
          <table className="w-full text-sm">
            <thead className={theadCls}><tr><th className="text-left px-4 py-2">Device</th><th className="text-left px-4 py-2">Status</th><th className="text-left px-4 py-2">Last Used</th><th className="px-4 py-2"></th></tr></thead>
            <tbody className={tbodyDivideCls}>
              {keys.map(k => (
                <tr key={k.id}>
                  <td className="px-4 py-2.5 font-medium">{k.deviceName}</td>
                  <td className="px-4 py-2.5">
                    <Badge className={`border-0 ${k.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{k.isActive ? "Active" : "Revoked"}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {k.isActive && <button className="text-xs font-medium text-destructive" onClick={() => handleRevokeKey(k.id, k.deviceName)}>Revoke</button>}
                  </td>
                </tr>
              ))}
              {keys.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">No devices registered yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </SoftCard>

      <SoftCard icon={CreditCard} title="Student ID Cards" sub="Assign a card/badge UID to each student so scans resolve to the right person">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
          <Select value={cardStudentId} onValueChange={setCardStudentId}>
            <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
            <SelectContent>{students.filter(s => s.status === "Active").map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={cardUid} onChange={e => setCardUid(e.target.value)} placeholder="Card UID (scan or type)" className="font-mono" />
          <Input value={cardLabel} onChange={e => setCardLabel(e.target.value)} placeholder="Label (optional)" />
          <Button onClick={handleAssignCard}><Plus className="h-4 w-4 mr-1" /> Assign Card</Button>
        </div>

        <div className={tableWrapCls}>
          <table className="w-full text-sm">
            <thead className={theadCls}><tr><th className="text-left px-4 py-2">Student</th><th className="text-left px-4 py-2">Card UID</th><th className="text-left px-4 py-2">Label</th><th className="px-4 py-2"></th></tr></thead>
            <tbody className={tbodyDivideCls}>
              {cards.map(c => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5 font-medium">{c.studentName}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{c.cardUid}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{c.label || "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button className="text-xs font-medium text-destructive" onClick={() => handleRemoveCard(c.id, c.studentName)}>Remove</button>
                  </td>
                </tr>
              ))}
              {cards.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">No cards enrolled yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </SoftCard>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { key: "profile", icon: Building2, label: "School Profile" },
  { key: "academic", icon: CalendarDays, label: "Academic Year" },
  { key: "classes", icon: Layers, label: "Classes & Sections" },
  { key: "subjects", icon: BookOpen, label: "Subjects" },
  { key: "fees", icon: DollarSign, label: "Fee Categories" },
  { key: "payments", icon: CreditCard, label: "Payment Gateways" },
  { key: "devices", icon: ScanLine, label: "Attendance Devices" },
  { key: "users", icon: Users, label: "Users" },
  { key: "perms", icon: UserCog, label: "Permissions" },
  { key: "grades", icon: Percent, label: "Grade Scale" },
];

const TAB_COMPONENTS: Record<string, React.FC> = {
  profile: SchoolProfileTab,
  academic: AcademicTermsTab,
  classes: ClassSectionsTab,
  subjects: SubjectsTab,
  fees: FeeCategoriesTab,
  payments: PaymentGatewaysTab,
  devices: AttendanceDevicesTab,
  users: UsersTab,
  perms: PermissionsTab,
  grades: GradeScaleTab,
};

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const { can, loaded: permsLoaded } = usePermission();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "profile");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && NAV_ITEMS.some(t => t.key === tab)) setActiveTab(tab);
  }, [searchParams]);

  const filteredNav = searchQuery
    ? NAV_ITEMS.filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : NAV_ITEMS;

  const displayTab = searchQuery && filteredNav.length > 0 ? filteredNav[0].key : activeTab;
  const ActiveComponent = TAB_COMPONENTS[displayTab];

  const configItems = [
    { label: "Profile", done: true },
    { label: "Academic Year", done: true },
    { label: "Classes & Sections", done: true },
    { label: "Subjects", done: true },
    { label: "Fee Categories", done: true },
    { label: "Users", done: true },
    { label: "Permissions", done: true },
    { label: "Grade Scale", done: true },
  ];
  const configPct = Math.round((configItems.filter(i => i.done).length / configItems.length) * 100);

  if (!permsLoaded) return null;
  if (!can("settings.view")) return <Unauthorized />;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
      <div className="flex gap-6">
        {/* Left Navigation */}
        <aside className="hidden lg:flex flex-col w-52 shrink-0 gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="pl-8 h-9 text-sm rounded-xl bg-secondary/60 border-0 focus:bg-card transition-colors" />
          </div>
          <div className="space-y-0.5">
            {filteredNav.map(item => {
              const Icon = item.icon;
              const isActive = item.key === activeTab;
              return (
                <button key={item.key} onClick={() => { setActiveTab(item.key); setSearchQuery(""); }}
                  className={`group flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
                  <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                  <span>{item.label}</span>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto text-primary/60" />}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="dashboard-heading !text-2xl flex items-center gap-2">
                <Settings2 className="h-6 w-6 text-primary" />
                System Configuration
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage your school profile, academic structure, and permissions</p>
            </div>
            <Badge className="bg-secondary text-muted-foreground border-0 text-xs hidden sm:flex">
              <Check className="h-3 w-3 mr-1 text-success" /> All Configured
            </Badge>
          </div>

          {/* Mobile Nav */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = item.key === activeTab;
              return (
                <button key={item.key} onClick={() => setActiveTab(item.key)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${isActive ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"}`}>
                  <Icon className="h-3.5 w-3.5" /> {item.label}
                </button>
              );
            })}
          </div>

          {/* Active Content */}
          {ActiveComponent && <ActiveComponent />}
        </div>

        {/* Right Sidebar */}
        <aside className="hidden xl:flex flex-col w-52 shrink-0 gap-4">
          <div className="soft-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-success uppercase tracking-wide">Configuration</span>
              <span className="text-2xl font-bold text-success">{configPct}%</span>
            </div>
            <div className="h-2 bg-success/15 rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full transition-all duration-700" style={{ width: `${configPct}%` }} />
            </div>
            <div className="mt-3 space-y-1">
              {configItems.map(i => (
                <div key={i.label} className="flex items-center gap-2 text-xs">
                  <Check className="h-3 w-3 text-success" />
                  <span className="text-foreground">{i.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="soft-card p-4">
            <h4 className="text-xs font-semibold text-warning uppercase tracking-wide mb-2">Quick Tips</h4>
            <div className="space-y-1.5">
              <div className="flex items-start gap-1.5 text-xs text-foreground">
                <Zap className="h-3 w-3 shrink-0 mt-0.5 text-warning" />
                <span>Configure School Profile first</span>
              </div>
              <div className="flex items-start gap-1.5 text-xs text-foreground">
                <Zap className="h-3 w-3 shrink-0 mt-0.5 text-warning" />
                <span>Set up academic terms before classes</span>
              </div>
              <div className="flex items-start gap-1.5 text-xs text-foreground">
                <Zap className="h-3 w-3 shrink-0 mt-0.5 text-warning" />
                <span>Assign permissions last</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}
