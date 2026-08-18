"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import {
  ArrowLeft, GraduationCap, CalendarCheck, Wallet, FileText, History as HistoryIcon,
  Phone, Mail, MapPin, Users as UsersIcon, Upload,
} from "lucide-react";
import {
  fetchStudentProfileDB, fetchStudentTermResultsDB, fetchStudentReportCardsDB,
  fetchStudentAttendanceHistoryDB, fetchPromotionsDB,
} from "@/app/actions/academic-core";
import { fetchStudentFeeRecordsDB } from "@/app/actions/db";
import { fetchStudentDocumentsDB, uploadStudentDocumentDB, type StudentDocumentRecord } from "@/app/actions/student-documents";
import { formatDatePK } from "@/lib/date-format";
import type { FeeRecord } from "@/lib/types";

const STUDENT_DOCUMENT_TYPES = ["Birth Certificate", "CNIC/B-Form", "Leaving Certificate", "Photograph"] as const;

type StudentProfile = {
  id: string; name: string; admissionNumber: string; status: string;
  email: string | null; phone: string | null; dob: string | null; gender: string | null; address: string | null;
  profilePhoto: string | null; branchId: string | null; branchName: string | null;
  parentName: string | null; parentEmail: string | null; parentPhone: string | null; guardianRelation: string | null;
  className: string | null; sectionName: string | null; rollNumber: number | null; academicYearId: string | null;
  linkedParent: { id: string; name: string | null; email: string | null; phone: string | null } | null;
  attendancePct: number | null; outstandingFees: number;
};

export default function StudentProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const { can, loaded: permsLoaded } = usePermission();
  const studentId = String(params?.id || "");

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [documents, setDocuments] = useState<StudentDocumentRecord[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "academics" | "attendance" | "fees" | "documents" | "history">("overview");
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!studentId) return;
    if (!opts?.silent) setLoading(true);
    const p = await fetchStudentProfileDB(studentId);
    setProfile(p);
    const [res, cards, att, fees, docs, promos] = await Promise.all([
      fetchStudentTermResultsDB(studentId),
      fetchStudentReportCardsDB(studentId),
      p?.academicYearId ? fetchStudentAttendanceHistoryDB(studentId, p.academicYearId) : Promise.resolve([]),
      fetchStudentFeeRecordsDB(studentId),
      fetchStudentDocumentsDB(studentId),
      fetchPromotionsDB(studentId),
    ]);
    setResults(res); setReportCards(cards); setAttendance(att); setFeeRecords(fees); setDocuments(docs); setPromotions(promos);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const handleDocumentUpload = (documentType: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setUploadingType(documentType);
      const res = await uploadStudentDocumentDB(studentId, documentType, file.name, reader.result as string);
      if (res.success) {
        toast({ title: `${documentType} uploaded` });
        load({ silent: true });
      } else {
        toast({ title: "Upload failed", description: res.message, variant: "destructive" });
      }
      setUploadingType(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (!permsLoaded) return null;
  if (!can("students.view")) return <Unauthorized />;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/students")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <p className="text-sm text-muted-foreground">Student not found.</p>
      </div>
    );
  }

  const netDue = (f: FeeRecord) => Math.max(0, f.amount - (f.discount || 0) - (f.amountPaid || 0));

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/students")}><ArrowLeft className="h-4 w-4 mr-1" /> Back to Students</Button>

      <Card className="border-border">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start gap-5">
            <div className="shrink-0">
              {profile.profilePhoto ? (
                <img src={profile.profilePhoto} alt={profile.name} className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="font-semibold text-primary text-2xl">{profile.name.charAt(0)}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="dashboard-heading !text-2xl">{profile.name}</h1>
                <Badge variant={profile.status === "Active" ? "default" : "secondary"}>{profile.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{profile.email || "—"}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge variant="outline" className="text-xs font-mono">Adm# {profile.admissionNumber}</Badge>
                {profile.className && <Badge variant="secondary" className="text-xs">{profile.className}{profile.sectionName ? ` - ${profile.sectionName}` : ""}</Badge>}
                {profile.rollNumber !== null && <Badge variant="outline" className="text-xs">Roll No. {profile.rollNumber}</Badge>}
                {profile.branchName && <Badge variant="outline" className="text-xs">{profile.branchName}</Badge>}
              </div>
            </div>
            <div className="flex gap-4 shrink-0">
              <div className="text-center px-3">
                <p className="text-xl font-bold text-primary">{profile.attendancePct !== null ? `${profile.attendancePct}%` : "—"}</p>
                <p className="text-[11px] text-muted-foreground">Attendance</p>
              </div>
              <div className="text-center px-3">
                <p className={`text-xl font-bold ${profile.outstandingFees > 0 ? "text-red-600" : "text-green-600"}`}>Rs {profile.outstandingFees.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground">Outstanding</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 w-fit flex-wrap">
        {([
          { key: "overview", label: "Overview" },
          { key: "academics", label: "Academics" },
          { key: "attendance", label: "Attendance" },
          { key: "fees", label: "Fees" },
          { key: "documents", label: "Documents" },
          { key: "history", label: "History" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-xs font-semibold rounded-md px-3 py-1.5 transition-colors ${tab === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border">
            <CardHeader><CardTitle className="text-sm">Contact Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5"><Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-xs text-muted-foreground">Email</p><p>{profile.email || "—"}</p></div></div>
              <div className="flex items-start gap-2.5"><Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-xs text-muted-foreground">Phone</p><p>{profile.phone || "—"}</p></div></div>
              <div className="flex items-start gap-2.5"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-xs text-muted-foreground">Address</p><p>{profile.address || "—"}</p></div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Date of Birth</p><p>{profile.dob ? formatDatePK(profile.dob) : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Gender</p><p>{profile.gender || "—"}</p></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><UsersIcon className="h-4 w-4" /> Parent / Guardian</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Name</p><p>{profile.parentName || "—"}{profile.guardianRelation ? ` (${profile.guardianRelation})` : ""}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Email</p><p>{profile.parentEmail || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Phone</p><p>{profile.parentPhone || "—"}</p></div>
              </div>
              {profile.linkedParent && (
                <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                  Linked to a parent portal account ({profile.linkedParent.name}).
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "academics" && (
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader><CardTitle className="text-sm">Published Results</CardTitle></CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No published results yet.</p>
              ) : (
                <div className="space-y-2">
                  {results.map(r => (
                    <div key={r.id} className="flex items-center justify-between border border-border rounded-md px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{r.examName} <span className="text-xs text-muted-foreground">({r.examType})</span></p>
                        <p className="text-xs text-muted-foreground">{formatDatePK(r.startDate)} – {formatDatePK(r.endDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{r.obtainedMarks}/{r.totalMarks} ({r.percentage}%)</p>
                        <p className="text-xs text-muted-foreground">Grade {r.grade}{r.sectionPosition ? ` · Rank ${r.sectionPosition}/${r.sectionTotal}` : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader><CardTitle className="text-sm">Report Cards</CardTitle></CardHeader>
            <CardContent>
              {reportCards.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No report cards generated yet.</p>
              ) : (
                <div className="space-y-2">
                  {reportCards.map((rc: any) => (
                    <div key={rc.id} className="flex items-center justify-between border border-border rounded-md px-3 py-2 text-sm">
                      <p className="font-medium">{rc.termName || rc.examName || "Report Card"}</p>
                      <Badge variant="outline">{rc.overallGrade || rc.grade || "—"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "attendance" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CalendarCheck className="h-4 w-4" /> Attendance History</CardTitle></CardHeader>
          <CardContent>
            {attendance.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No attendance recorded for the active academic year.</p>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {attendance.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded hover:bg-secondary/30">
                    <span>{formatDatePK(a.date)}</span>
                    <Badge variant={a.status === "Present" ? "default" : a.status === "Late" ? "secondary" : "outline"}>{a.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "fees" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" /> Fee Vouchers</CardTitle></CardHeader>
          <CardContent>
            {feeRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No fee vouchers on record.</p>
            ) : (
              <div className="space-y-2">
                {feeRecords.map(f => (
                  <div key={f.id} className="flex items-center justify-between border border-border rounded-md px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{f.feeType || f.month || "Fee Voucher"} <span className="text-xs text-muted-foreground font-mono">#{f.voucherId}</span></p>
                      <p className="text-xs text-muted-foreground">Due {formatDatePK(f.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">Rs {f.amount.toLocaleString()}</p>
                      <Badge variant={f.status === "Paid" ? "default" : f.status === "Overdue" ? "destructive" : "secondary"} className="text-xs">
                        {f.status}{netDue(f) > 0 && f.status !== "Paid" ? ` · Rs ${netDue(f).toLocaleString()} due` : ""}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "documents" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Documents</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STUDENT_DOCUMENT_TYPES.map(docType => {
              const doc = documents.find(d => d.documentType === docType);
              return (
                <div key={docType} className="border border-border rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{docType}</p>
                    {doc ? (
                      <p className="text-xs text-muted-foreground truncate">{formatDatePK(doc.uploadedAt)}{doc.uploadedBy ? ` · ${doc.uploadedBy}` : ""}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not uploaded</p>
                    )}
                  </div>
                  <label className="shrink-0 text-xs text-primary cursor-pointer flex items-center gap-1">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingType === docType ? "Uploading…" : doc ? "Replace" : "Upload"}
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleDocumentUpload(docType)} disabled={uploadingType === docType} />
                  </label>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {tab === "history" && (
        <Card className="border-border">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><HistoryIcon className="h-4 w-4" /> Promotion History</CardTitle></CardHeader>
          <CardContent>
            {promotions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No promotion history yet.</p>
            ) : (
              <div className="space-y-2">
                {promotions.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between border border-border rounded-md px-3 py-2 text-sm">
                    <p>{p.fromClassName} → {p.toClassName}</p>
                    <span className="text-xs text-muted-foreground">{formatDatePK(p.promotedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
