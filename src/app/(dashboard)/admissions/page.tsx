"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppState } from "@/lib/state-context";
import { formatDatePK } from "@/lib/date-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, ClipboardList, CheckCircle2, XCircle,
  Eye, Clock, ExternalLink, Printer, Users, Download,
  FileText, Trash2, Upload, Cake, VenetianMask, Globe2, Droplet,
  GraduationCap, School, Phone, Mail, IdCard, MapPin, UserCircle2,
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
import {
  fetchAdmissionDocumentsDB, uploadAdmissionDocumentDB, deleteAdmissionDocumentDB,
  type AdmissionDocumentRecord,
} from "@/app/actions/admission-documents";
import type { AdmissionApplication, ClassItem, SectionItem } from "@/lib/types";

const APP_STATUS_COLORS: Record<string, string> = {
  Pending: "bg-blue-50 text-blue-700 border-blue-200",
  "Under Review": "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-green-50 text-green-700 border-green-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
};

const ADMISSION_DOCUMENT_TYPES = ['Birth Certificate', 'CNIC/B-Form', 'Leaving Certificate', 'Photograph'] as const;

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
  const [approveRemarks, setApproveRemarks] = useState("");

  // ── Bulk assign ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkClassId, setBulkClassId] = useState("");
  const [bulkSectionId, setBulkSectionId] = useState("");
  const [bulkSections, setBulkSections] = useState<SectionItem[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkApproveRemarks, setBulkApproveRemarks] = useState("");

  const [loading, setLoading] = useState(true);

  const loadClasses = useCallback(async () => {
    const cls = await fetchClassesDB();
    setClasses(cls);
    setLoading(false);
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

  // ── Documents (embedded in the Report dialog) ────────────────────────────
  const [docsAppId, setDocsAppId] = useState("");
  const [docsAppName, setDocsAppName] = useState("");
  const [docsData, setDocsData] = useState<AdmissionDocumentRecord[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsUploadingType, setDocsUploadingType] = useState<string | null>(null);
  const [viewDoc, setViewDoc] = useState<AdmissionDocumentRecord | null>(null);

  const loadAdmissionDocuments = async (applicationId: string) => {
    const docs = await fetchAdmissionDocumentsDB(applicationId);
    setDocsData(docs);
  };

  const openReport = async (app: AdmissionApplication) => {
    setSelectedApp(app);
    setReportOpen(true);
    setDocsAppId(app.id);
    setDocsAppName(`${app.firstName} ${app.lastName}`);
    setDocsData([]);
    setDocsLoading(true);
    await loadAdmissionDocuments(app.id);
    setDocsLoading(false);
  };

  const handleDocumentUpload = (documentType: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setDocsUploadingType(documentType);
      const res = await uploadAdmissionDocumentDB(docsAppId, documentType, file.name, reader.result as string);
      if (res.success) {
        await loadAdmissionDocuments(docsAppId);
        toast({ title: `${documentType} uploaded` });
      } else {
        toast({ title: "Upload failed", description: res.message, variant: "destructive" });
      }
      setDocsUploadingType(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDocumentDelete = async (id: string, documentType: string) => {
    const res = await deleteAdmissionDocumentDB(id);
    if (res.success) {
      await loadAdmissionDocuments(docsAppId);
      toast({ title: `${documentType} deleted` });
    } else {
      toast({ title: "Delete failed", description: res.message, variant: "destructive" });
    }
  };

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
      const result = await bulkApproveAdmissionsDB(Array.from(selectedIds), bulkClassId, bulkSectionId || undefined, bulkApproveRemarks || undefined);
      if (result.errors.length > 0) {
        toast({ title: "Partial Success", description: `${result.approved} approved, ${result.errors.length} failed. ${result.errors[0]}` });
      } else {
        toast({ title: "Bulk Approval Complete", description: `${result.approved} application(s) approved and enrolled.` });
      }
      // Refresh local state
      for (const appId of Array.from(selectedIds)) {
        approveApplication(appId, bulkClassId, bulkSectionId || undefined, bulkApproveRemarks || undefined);
      }
      setSelectedIds(new Set());
      setBulkApproveOpen(false);
      setBulkClassId("");
      setBulkSectionId("");
      setBulkApproveRemarks("");
    } catch {
      toast({ title: "Error", description: "Bulk approval failed. Please try again.", variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleApprove = () => {
    if (!approveTarget) return;
    approveApplication(approveTarget.id, selectedClassId || undefined, selectedSectionId || undefined, approveRemarks || undefined);
    toast({ title: "Application Approved", description: `${approveTarget.firstName} ${approveTarget.lastName} has been enrolled as a student.` });
    setApproveTarget(null);
    setSelectedClassId("");
    setSelectedSectionId("");
    setApproveRemarks("");
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

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-56 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="border-b border-secondary/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <Skeleton className="h-10 w-full md:w-72 rounded-md" />
              <div className="flex gap-1 flex-wrap">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-16 rounded-md" />)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/20">
                <TableRow>
                  {["", "App ID", "Applicant", "Class", "Parent Email", "Submitted", "Status", ""].map((h, i) => (
                    <TableHead key={i} className="font-bold py-4">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map(i => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-28" /></div></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-20 rounded-full mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-7 w-24 rounded-md" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                        onClick={() => openReport(app)}
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
      <Dialog open={reportOpen} onOpenChange={o => { setReportOpen(o); if (!o) { setSelectedApp(null); setDocsData([]); setDocsAppId(""); } }}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0 gap-0">
          {selectedApp && (
            <>
              {/* Banner Header */}
              <div className="no-print bg-gradient-to-br from-[#1E3A8A] via-[#1D4ED8] to-[#2563EB] px-8 pt-8 pb-6 text-white rounded-t-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-5">
                    <Avatar className="h-20 w-20 border-4 border-white/30 shadow-lg shrink-0">
                      <AvatarImage src={selectedApp.profilePhoto} />
                      <AvatarFallback className="bg-white/10 text-white text-xl font-semibold">
                        {selectedApp.firstName.charAt(0)}{selectedApp.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <DialogTitle className="text-2xl font-bold text-white">{selectedApp.firstName} {selectedApp.lastName}</DialogTitle>
                      <p className="text-sm text-blue-100 font-mono mt-0.5">{selectedApp.applicationId}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          selectedApp.status === "Approved" ? "bg-green-400/20 text-green-100 ring-1 ring-green-300/40" :
                          selectedApp.status === "Rejected" ? "bg-red-400/20 text-red-100 ring-1 ring-red-300/40" :
                          selectedApp.status === "Under Review" ? "bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/40" :
                          "bg-blue-400/20 text-blue-50 ring-1 ring-blue-200/40"
                        }`}>
                          {selectedApp.status}
                        </span>
                        <span className="text-xs text-blue-100">Applying for {selectedApp.applyingForClass}</span>
                        <span className="text-xs text-blue-200">· Submitted {selectedApp.submittedAt}</span>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" className="gap-1.5 shrink-0" onClick={() => window.print()}>
                    <Printer className="h-3.5 w-3.5" /> Print / PDF
                  </Button>
                </div>
              </div>

              {/* Body: data + documents side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 p-6">
                {/* Left: data sections */}
                <div ref={printRef} id="admission-report" className="space-y-5">
                  <div className="hidden print:block text-center border-b-2 border-[#0F172A] pb-4 mb-2">
                    <h1 className="text-2xl font-bold text-[#0F172A]">{schoolInfo?.name || "School Management System"}</h1>
                    <p className="text-sm text-[#64748B]">{schoolInfo?.address || ""}</p>
                    <p className="text-sm text-[#64748B]">
                      {schoolInfo?.phone ? `Phone: ${schoolInfo.phone}  |  ` : ""}
                      Email: {schoolInfo?.contactEmail || ""}
                      {schoolInfo?.website ? `  |  Web: ${schoolInfo.website}` : ""}
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-1">Reg. No: {schoolInfo?.registrationNumber || "—"}</p>
                    <h2 className="text-lg font-bold text-[#0F172A] uppercase tracking-wide mt-4">Admission Application Form</h2>
                    <p className="text-xs text-[#64748B] mt-1">Application ID: {selectedApp.applicationId}</p>
                  </div>

                  <div className="hidden print:flex items-center gap-4 pb-4 border-b mb-2">
                    <Avatar className="h-16 w-16 border-2 border-[#E5E7EB]">
                      <AvatarImage src={selectedApp.profilePhoto} />
                      <AvatarFallback className="bg-[#EFF6FF] text-[#2563EB] font-semibold">
                        {selectedApp.firstName.charAt(0)}{selectedApp.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-bold text-[#0F172A]">{selectedApp.firstName} {selectedApp.lastName}</h3>
                      <p className="text-xs text-[#64748B]">Status: {selectedApp.status} · Submitted {selectedApp.submittedAt}</p>
                    </div>
                  </div>

                  {/* Personal Information */}
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#64748B] mb-3">
                      <UserCircle2 className="h-3.5 w-3.5" /> Personal Information
                    </h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      {[
                        [Cake, "Date of Birth", selectedApp.dateOfBirth],
                        [VenetianMask, "Gender", selectedApp.gender],
                        [Globe2, "Nationality", selectedApp.nationality],
                        [Droplet, "Blood Group", selectedApp.bloodGroup || "—"],
                      ].map(([Icon, l, v]: any) => (
                        <div key={l} className="flex items-start gap-2">
                          <Icon className="h-3.5 w-3.5 text-[#94A3B8] mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[11px] text-[#94A3B8] leading-tight">{l}</p>
                            <p className="font-semibold text-[#0F172A] truncate">{v}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Academic Background */}
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#64748B] mb-3">
                      <GraduationCap className="h-3.5 w-3.5" /> Academic Background
                    </h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      {[
                        [GraduationCap, "Applying For Class", selectedApp.applyingForClass],
                        [School, "Previous School", selectedApp.previousSchool || "—"],
                        [School, "Previous Grade", selectedApp.previousGrade || "—"],
                      ].map(([Icon, l, v]: any) => (
                        <div key={l} className="flex items-start gap-2">
                          <Icon className="h-3.5 w-3.5 text-[#94A3B8] mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[11px] text-[#94A3B8] leading-tight">{l}</p>
                            <p className="font-semibold text-[#0F172A] truncate">{v}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Parent / Guardian */}
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#64748B] mb-3">
                      <Users className="h-3.5 w-3.5" /> Parent / Guardian
                    </h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      {[
                        [UserCircle2, "Parent Name", selectedApp.parentName],
                        [Users, "Relation", selectedApp.parentRelation],
                        [Phone, "Phone", selectedApp.parentPhone],
                        [Mail, "Email", selectedApp.parentEmail],
                        [IdCard, "CNIC", selectedApp.parentCNIC || "—"],
                        [MapPin, "Address", selectedApp.address],
                        [MapPin, "City", selectedApp.city],
                      ].map(([Icon, l, v]: any) => (
                        <div key={l} className="flex items-start gap-2">
                          <Icon className="h-3.5 w-3.5 text-[#94A3B8] mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[11px] text-[#94A3B8] leading-tight">{l}</p>
                            <p className="font-semibold text-[#0F172A] truncate">{v}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedApp.adminNotes && (
                    selectedApp.status === "Rejected" ? (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                        <p className="font-bold text-red-700 mb-1">Rejection Notes</p>
                        <p className="text-red-600">{selectedApp.adminNotes}</p>
                      </div>
                    ) : (
                      <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-sm">
                        <p className="font-bold text-green-700 mb-1">Remarks</p>
                        <p className="text-green-700">{selectedApp.adminNotes}</p>
                      </div>
                    )
                  )}

                  <div className="hidden print:block text-center text-xs text-[#94A3B8] pt-4 border-t mt-6">
                    <p>This is a computer-generated application form.</p>
                    <p>Generated on: {formatDatePK(new Date())}</p>
                  </div>
                </div>

                {/* Right: documents panel */}
                <div className="no-print space-y-3">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#64748B]">
                    <FileText className="h-3.5 w-3.5" /> Documents
                  </h4>
                  <div className="space-y-2">
                    {docsLoading && (
                      <div className="rounded-xl border border-dashed border-[#E5E7EB] p-6 text-center text-sm text-[#94A3B8]">Loading…</div>
                    )}
                    {!docsLoading && ADMISSION_DOCUMENT_TYPES.map(docType => {
                      const doc = docsData.find(d => d.documentType === docType);
                      const inputId = `adoc-upload-${docType.replace(/[^a-zA-Z0-9]/g, "-")}`;
                      return (
                        <div key={docType} className="rounded-xl border border-[#E5E7EB] bg-white p-3 flex items-center gap-3 hover:border-[#93C5FD] transition-colors">
                          {doc ? (
                            <button type="button" onClick={() => setViewDoc(doc)} className="flex-shrink-0">
                              <img src={doc.fileData} alt="" className="h-11 w-11 rounded-lg object-cover border border-[#E5E7EB] hover:opacity-80" />
                            </button>
                          ) : (
                            <div className="h-11 w-11 rounded-lg bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
                              <FileText className="h-4 w-4 text-[#CBD5E1]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#0F172A]">{docType}</p>
                            {doc ? (
                              <p className="text-xs text-[#94A3B8] truncate">{formatDatePK(doc.uploadedAt)}</p>
                            ) : (
                              <p className="text-xs text-[#CBD5E1]">Not uploaded</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {doc && (
                              <button onClick={() => setViewDoc(doc)} className="text-[11px] text-[#2563EB] hover:underline flex items-center gap-0.5">
                                <Eye className="h-3 w-3" /> View
                              </button>
                            )}
                            <Label htmlFor={inputId} className="cursor-pointer">
                              <span className="text-[11px] text-[#2563EB] hover:underline flex items-center gap-0.5">
                                {docsUploadingType === docType ? "Uploading…" : (
                                  <><Upload className="h-3 w-3" /> {doc ? "Replace" : "Upload"}</>
                                )}
                              </span>
                            </Label>
                          </div>
                          <Input id={inputId} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleDocumentUpload(docType)} disabled={!!docsUploadingType} />
                          {doc && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 shrink-0" onClick={() => handleDocumentDelete(doc.id, docType)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {(selectedApp.status === "Pending" || selectedApp.status === "Under Review") && (
                <DialogFooter className="no-print border-t px-6 py-4 gap-2">
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

      {/* Document Preview Dialog */}
      <Dialog open={!!viewDoc} onOpenChange={o => { if (!o) setViewDoc(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{viewDoc?.documentType}</DialogTitle></DialogHeader>
          {viewDoc && (
            <div className="space-y-2">
              {viewDoc.fileData.startsWith("data:application/pdf") ? (
                <iframe src={viewDoc.fileData} className="w-full h-[70vh] rounded-lg border border-[#E5E7EB]" />
              ) : (
                <img src={viewDoc.fileData} alt={viewDoc.documentType} className="w-full max-h-[70vh] object-contain rounded-lg border border-[#E5E7EB] bg-[#F8FAFC]" />
              )}
              <p className="text-xs text-[#94A3B8]">{viewDoc.fileName} · Uploaded {formatDatePK(viewDoc.uploadedAt)}{viewDoc.uploadedBy ? ` by ${viewDoc.uploadedBy}` : ""}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDoc(null)}>Close</Button>
          </DialogFooter>
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
      <Dialog open={!!approveTarget} onOpenChange={o => { if (!o) { setApproveTarget(null); setSelectedClassId(""); setSelectedSectionId(""); setApproveRemarks(""); } }}>
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
            <div>
              <Label className="text-xs mb-1 block">Remarks (optional)</Label>
              <Textarea
                value={approveRemarks}
                onChange={e => setApproveRemarks(e.target.value)}
                placeholder="e.g. Merit-based approval, sibling discount noted, interview passed…"
                className="min-h-[70px] text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setApproveTarget(null); setSelectedClassId(""); setSelectedSectionId(""); setApproveRemarks(""); }}>Cancel</Button>
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
      <Dialog open={bulkApproveOpen} onOpenChange={o => { setBulkApproveOpen(o); if (!o) { setBulkClassId(""); setBulkSectionId(""); setBulkApproveRemarks(""); } }}>
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
            <div className="space-y-2">
              <Label>Remarks (Optional)</Label>
              <Textarea
                value={bulkApproveRemarks}
                onChange={e => setBulkApproveRemarks(e.target.value)}
                placeholder="Applied to all selected applications…"
                className="min-h-[70px] text-sm"
              />
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-sm text-blue-800">
              All {selectedIds.size} students will be marked <strong>Approved</strong> and enrolled in the selected class/section.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setBulkApproveOpen(false); setBulkClassId(""); setBulkSectionId(""); setBulkApproveRemarks(""); }}>Cancel</Button>
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
