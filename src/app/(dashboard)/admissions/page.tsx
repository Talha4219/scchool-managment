"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppState } from "@/lib/state-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, ClipboardList, CheckCircle2, XCircle,
  Eye, Clock, ExternalLink, Printer, Users, Download,
} from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { fetchClassesDB, fetchSectionsByClassDB } from "@/app/actions/academic-core";
import { bulkApproveAdmissionsDB } from "@/app/actions/admissions";
import type { AdmissionApplication, ClassItem, SectionItem } from "@/lib/types";

const APP_STATUS_COLORS: Record<string, string> = {
  Pending: "bg-blue-50 text-blue-700 border-blue-200",
  "Under Review": "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-green-50 text-green-700 border-green-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
};

<style>{`
  @media print {
    body { background: #fff !important; margin: 0; padding: 0.5in; }
    body * { visibility: hidden; }
    #admission-report, #admission-report * { visibility: visible; }
    #admission-report { position: absolute; left: 0; top: 0; width: 100%; padding: 40px; box-sizing: border-box; }
    .no-print { display: none !important; }
    img { max-width: 100%; }
  }
`}</style>

export default function AdmissionsPage() {
  const { applications, approveApplication, rejectApplication, setApplicationUnderReview, schoolInfo } = useAppState();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();

  const [appSearch, setAppSearch] = useState("");
  const [appStatusFilter, setAppStatusFilter] = useState<string>("All");
  const [selectedApp, setSelectedApp] = useState<AdmissionApplication | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<AdmissionApplication | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // ── Class / Section selection for approval ──
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [approveTarget, setApproveTarget] = useState<AdmissionApplication | null>(null);

  // ── Bulk assign ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkClassId, setBulkClassId] = useState("");
  const [bulkSectionId, setBulkSectionId] = useState("");
  const [bulkSections, setBulkSections] = useState<SectionItem[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const loadClasses = useCallback(async () => {
    const cls = await fetchClassesDB();
    setClasses(cls);
  }, []);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  useEffect(() => {
    if (!selectedClassId) { setSections([]); return; }
    fetchSectionsByClassDB(selectedClassId).then(setSections);
  }, [selectedClassId]);

  useEffect(() => {
    if (!bulkClassId) { setBulkSections([]); return; }
    fetchSectionsByClassDB(bulkClassId).then(setBulkSections);
  }, [bulkClassId]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === eligibleForBulk.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleForBulk.map(a => a.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0 || !bulkClassId) return;
    setBulkLoading(true);
    try {
      const result = await bulkApproveAdmissionsDB(Array.from(selectedIds), bulkClassId, bulkSectionId || undefined);
      if (result.errors.length > 0) {
        toast({ title: "Partial Success", description: `${result.approved} approved, ${result.errors.length} failed. ${result.errors[0]}` });
      } else {
        toast({ title: "Bulk Approval Complete", description: `${result.approved} application(s) approved and enrolled.` });
      }
      // Refresh local state
      for (const appId of Array.from(selectedIds)) {
        approveApplication(appId, bulkClassId, bulkSectionId || undefined);
      }
      setSelectedIds(new Set());
      setBulkApproveOpen(false);
      setBulkClassId("");
      setBulkSectionId("");
    } catch {
      toast({ title: "Error", description: "Bulk approval failed. Please try again.", variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleApprove = () => {
    if (!approveTarget) return;
    approveApplication(approveTarget.id, selectedClassId || undefined, selectedSectionId || undefined);
    toast({ title: "Application Approved", description: `${approveTarget.firstName} ${approveTarget.lastName} has been enrolled as a student.` });
    setApproveTarget(null);
    setSelectedClassId("");
    setSelectedSectionId("");
  };

  const handleRejectSubmit = () => {
    if (!rejectTarget) return;
    rejectApplication(rejectTarget.id, rejectNotes);
    toast({ title: "Application Rejected", description: `${rejectTarget.firstName} ${rejectTarget.lastName}'s application has been declined.` });
    setIsRejectOpen(false);
    setRejectNotes("");
    setRejectTarget(null);
    setSelectedApp(null);
  };

  const handleMarkUnderReview = (app: AdmissionApplication) => {
    setApplicationUnderReview(app.id);
    toast({ title: "Status Updated", description: "Application marked as Under Review." });
  };

  const filteredApps = applications.filter(a => {
    const name = `${a.firstName} ${a.lastName}`.toLowerCase();
    const matchSearch = name.includes(appSearch.toLowerCase()) || a.applicationId.toLowerCase().includes(appSearch.toLowerCase());
    const matchStatus = appStatusFilter === "All" || a.status === appStatusFilter;
    return matchSearch && matchStatus;
  });

  const eligibleForBulk = filteredApps.filter(a => a.status === "Pending" || a.status === "Under Review");
  const pendingCount = applications.filter(a => a.status === "Pending" || a.status === "Under Review").length;

  if (!permsLoaded) return null;
  if (!can("admissions.view")) return <Unauthorized />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Admissions</h1>
          <p className="text-muted-foreground mt-1">Manage student registrations and online admission applications.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <Button
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => { setBulkClassId(""); setBulkSectionId(""); setBulkApproveOpen(true); }}
            >
              <Users className="h-4 w-4" /> Bulk Approve ({selectedIds.size})
            </Button>
          )}
          <Button
            variant="outline"
            className="gap-2 border-primary text-primary hover:bg-primary/5"
            onClick={() => window.open("/apply", "_blank")}
          >
            <ExternalLink className="h-4 w-4" /> Online Form
          </Button>
        </div>
      </div>

      {/* Applications */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="border-b border-secondary/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name or App ID..." className="pl-9 h-10 border-none bg-secondary/30" value={appSearch} onChange={e => setAppSearch(e.target.value)} />
            </div>
            <div className="flex gap-1 flex-wrap">
              {["All", "Pending", "Under Review", "Approved", "Rejected"].map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={appStatusFilter === s ? "default" : "outline"}
                  className={`h-8 text-xs ${appStatusFilter === s ? "bg-primary" : ""}`}
                  onClick={() => setAppStatusFilter(s)}
                >
                  {s}
                </Button>
              ))}
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => {
                exportToCsv("admissions", ["App ID", "Applicant", "Applying For", "Parent", "Phone", "Status", "Submitted"],
                  filteredApps.map(a => [a.applicationId, `${a.firstName} ${a.lastName}`, a.applyingForClass, a.parentName, a.parentPhone, a.status, a.submittedAt]));
              }}>
                <Download className="h-3 w-3" /> Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow>
                <TableHead className="w-[40px] py-4">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 accent-green-600 cursor-pointer"
                    checked={eligibleForBulk.length > 0 && selectedIds.size === eligibleForBulk.length}
                    onChange={toggleSelectAll}
                    title="Select all pending/under review"
                  />
                </TableHead>
                <TableHead className="font-bold py-4">App ID</TableHead>
                <TableHead className="font-bold">Applicant</TableHead>
                <TableHead className="font-bold">Class</TableHead>
                <TableHead className="font-bold">Parent Email</TableHead>
                <TableHead className="font-bold">Submitted</TableHead>
                <TableHead className="font-bold text-center">Status</TableHead>
                <TableHead className="w-[140px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No applications found.</p>
                    <p className="text-xs mt-1">Share the <button onClick={() => window.open("/apply", "_blank")} className="underline text-primary">online form</button> to start receiving applications.</p>
                  </TableCell>
                </TableRow>
              ) : filteredApps.map(app => {
                const canSelect = app.status === "Pending" || app.status === "Under Review";
                return (
                <TableRow key={app.id} className={`hover:bg-secondary/5 transition-colors ${selectedIds.has(app.id) ? "bg-green-50/50" : ""}`}>
                  <TableCell className="w-[40px]">
                    {canSelect && (
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 accent-green-600 cursor-pointer"
                        checked={selectedIds.has(app.id)}
                        onChange={() => toggleSelect(app.id)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-primary">{app.applicationId}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={app.profilePhoto} />
                        <AvatarFallback className="bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold">
                          {app.firstName.charAt(0)}{app.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-primary">{app.firstName} {app.lastName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{app.applyingForClass}</TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">{app.parentEmail}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{app.submittedAt}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={APP_STATUS_COLORS[app.status] || ""}>
                      {app.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => { setSelectedApp(app); setReportOpen(true); }}
                      >
                        <Eye className="h-3 w-3" /> View
                      </Button>
                      {app.status === "Pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                          onClick={() => handleMarkUnderReview(app)}
                        >
                          <Clock className="h-3 w-3" />
                        </Button>
                      )}
                      {(app.status === "Pending" || app.status === "Under Review") && (
                        <>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => { setApproveTarget(app); setSelectedClassId(""); setSelectedSectionId(""); }}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                            onClick={() => { setRejectTarget(app); setIsRejectOpen(true); }}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </>
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

      {/* Application Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={o => { setReportOpen(o); if (!o) setSelectedApp(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedApp && (
            <>
              <DialogHeader className="flex-row items-center justify-between border-b pb-4">
                <DialogTitle className="text-xl font-bold">Admission Application Report</DialogTitle>
                <Button size="sm" variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-1" /> Print / PDF
                </Button>
              </DialogHeader>

              <div ref={printRef} id="admission-report" className="space-y-6 py-4">
                {/* School Header */}
                <div className="text-center border-b-2 border-[#0F172A] pb-4 mb-2">
                  <h1 className="text-2xl font-bold text-[#0F172A]">{schoolInfo?.name || "School Management System"}</h1>
                  <p className="text-sm text-[#64748B]">{schoolInfo?.address || ""}</p>
                  <p className="text-sm text-[#64748B]">
                    {schoolInfo?.phone ? `Phone: ${schoolInfo.phone}  |  ` : ""}
                    Email: {schoolInfo?.contactEmail || ""}
                    {schoolInfo?.website ? `  |  Web: ${schoolInfo.website}` : ""}
                  </p>
                  <p className="text-xs text-[#94A3B8] mt-1">Reg. No: {schoolInfo?.registrationNumber || "—"}</p>
                </div>

                <div className="text-center mb-4">
                  <h2 className="text-lg font-bold text-[#0F172A] uppercase tracking-wide">Admission Application Form</h2>
                  <p className="text-xs text-[#64748B]">Application ID: {selectedApp.applicationId}</p>
                </div>

                {/* Applicant Photo + Basic Info */}
                <div className="flex items-center gap-5 pb-4 border-b">
                  <Avatar className="h-20 w-20 border-2 border-[#E5E7EB] shrink-0">
                    <AvatarImage src={selectedApp.profilePhoto} />
                    <AvatarFallback className="bg-[#EFF6FF] text-[#2563EB] text-xl font-semibold">
                      {selectedApp.firstName.charAt(0)}{selectedApp.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-[#0F172A]">{selectedApp.firstName} {selectedApp.lastName}</h3>
                    <p className="text-sm text-[#64748B] font-mono">{selectedApp.applicationId}</p>
                    <p className="text-xs text-[#94A3B8]">Submitted: {selectedApp.submittedAt}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${
                      selectedApp.status === "Approved" ? "bg-green-100 text-green-800" :
                      selectedApp.status === "Rejected" ? "bg-red-100 text-red-800" :
                      selectedApp.status === "Under Review" ? "bg-amber-100 text-amber-800" :
                      "bg-blue-100 text-blue-800"
                    }`}>
                      {selectedApp.status}
                    </span>
                  </div>
                </div>

                {/* Personal Information */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 border-b pb-1">Personal Information</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {[
                      ["Date of Birth", selectedApp.dateOfBirth],
                      ["Gender", selectedApp.gender],
                      ["Nationality", selectedApp.nationality],
                      ["Blood Group", selectedApp.bloodGroup || "—"],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between py-1.5 border-b border-gray-50">
                        <span className="text-[#64748B]">{l}</span>
                        <span className="font-semibold text-[#0F172A]">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Academic Background */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 border-b pb-1">Academic Background</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {[
                      ["Applying For Class", selectedApp.applyingForClass],
                      ["Previous School", selectedApp.previousSchool || "—"],
                      ["Previous Grade", selectedApp.previousGrade || "—"],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between py-1.5 border-b border-gray-50">
                        <span className="text-[#64748B]">{l}</span>
                        <span className="font-semibold text-[#0F172A]">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Parent / Guardian */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 border-b pb-1">Parent / Guardian</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {[
                      ["Parent Name", selectedApp.parentName],
                      ["Relation", selectedApp.parentRelation],
                      ["Phone", selectedApp.parentPhone],
                      ["Email", selectedApp.parentEmail],
                      ["CNIC", selectedApp.parentCNIC || "—"],
                      ["Address", selectedApp.address],
                      ["City", selectedApp.city],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between py-1.5 border-b border-gray-50">
                        <span className="text-[#64748B]">{l}</span>
                        <span className="font-semibold text-[#0F172A] text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedApp.adminNotes && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                    <p className="font-bold text-red-700 mb-1">Rejection Notes</p>
                    <p className="text-red-600">{selectedApp.adminNotes}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="text-center text-xs text-[#94A3B8] pt-4 border-t mt-6">
                  <p>This is a computer-generated application form.</p>
                  <p>Generated on: {new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              {(selectedApp.status === "Pending" || selectedApp.status === "Under Review") && (
                <DialogFooter className="border-t pt-4 gap-2">
                  <Button
                    className="bg-green-600 hover:bg-green-700 gap-2"
                    onClick={() => { setApproveTarget(selectedApp); setSelectedClassId(""); setSelectedSectionId(""); setSelectedApp(null); }}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50 gap-2"
                    onClick={() => { setRejectTarget(selectedApp); setIsRejectOpen(true); }}
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={v => { setIsRejectOpen(v); if (!v) setRejectNotes(""); }}>
        <DialogContent className="max-w-md border-secondary">
          <DialogHeader>
            <DialogTitle className="font-headline font-bold text-red-600 flex items-center gap-2">
              <XCircle className="h-5 w-5" /> Reject Application
            </DialogTitle>
            <DialogDescription>
              Reject {rejectTarget?.firstName} {rejectTarget?.lastName}'s admission application ({rejectTarget?.applicationId}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Rejection <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                placeholder="e.g. All seats for Grade 10 are filled. Please apply next year..."
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleRejectSubmit}>
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={!!approveTarget} onOpenChange={o => { if (!o) { setApproveTarget(null); setSelectedClassId(""); setSelectedSectionId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" /> Approve & Enroll
            </DialogTitle>
            <DialogDescription>
              Assign a class and section for {approveTarget?.firstName} {approveTarget?.lastName} ({approveTarget?.applicationId}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs mb-1 block">Class</Label>
              <Select value={selectedClassId} onValueChange={v => { setSelectedClassId(v); setSelectedSectionId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Section</Label>
              <Select value={selectedSectionId} onValueChange={setSelectedSectionId} disabled={!selectedClassId}>
                <SelectTrigger><SelectValue placeholder={selectedClassId ? "Select section" : "Select class first"} /></SelectTrigger>
                <SelectContent>
                  {sections.map(s => <SelectItem key={s.id} value={s.id}>Section {s.name}{s.group ? ` — ${s.group}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setApproveTarget(null); setSelectedClassId(""); setSelectedSectionId(""); }}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 gap-2"
              onClick={handleApprove}
              disabled={!selectedClassId || !selectedSectionId}
            >
              <CheckCircle2 className="h-4 w-4" /> Approve & Enroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Approve Dialog */}
      <Dialog open={bulkApproveOpen} onOpenChange={o => { setBulkApproveOpen(o); if (!o) { setBulkClassId(""); setBulkSectionId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Bulk Approve & Enroll</DialogTitle>
            <DialogDescription>
              Approve {selectedIds.size} application(s) and assign them all to the same class & section.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={bulkClassId} onValueChange={v => { setBulkClassId(v); setBulkSectionId(""); }}>
                <SelectTrigger className="h-11 border-secondary">
                  <SelectValue placeholder="Select class for all selected students" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Section (Optional)</Label>
              <Select value={bulkSectionId} onValueChange={setBulkSectionId} disabled={!bulkClassId}>
                <SelectTrigger className="h-11 border-secondary">
                  <SelectValue placeholder="Auto-assign if blank" />
                </SelectTrigger>
                <SelectContent>
                  {bulkSections.filter(s => s.classId === bulkClassId).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.teacherName || "No teacher"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-sm text-blue-800">
              All {selectedIds.size} students will be marked <strong>Approved</strong> and enrolled in the selected class/section.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setBulkApproveOpen(false); setBulkClassId(""); setBulkSectionId(""); }}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 gap-2"
              onClick={handleBulkApprove}
              disabled={!bulkClassId || bulkLoading}
            >
              {bulkLoading ? "Approving..." : <><CheckCircle2 className="h-4 w-4" /> Approve {selectedIds.size} Students</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
