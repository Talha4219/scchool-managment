"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getSessionProfileDB, changePasswordDB, fetchPayslipsDB, fetchLeaveRequestsDB, createLeaveRequestDB } from "@/app/actions/features";
import type { Payslip, LeaveRequest } from "@/lib/types";
import { formatDatePK } from "@/lib/date-format";
import { User, Mail, Shield, Calendar, KeyRound, Eye, EyeOff, Receipt, CalendarDays, Plus, Loader2 } from "lucide-react";

const LEAVE_TYPES = ["Sick", "Casual", "Annual", "Maternity", "Paternity", "Unpaid"] as const;
const leaveStatusBadge: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800", Approved: "bg-green-100 text-green-800", Rejected: "bg-red-100 text-red-800",
};
const payslipStatusBadge: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-800", Generated: "bg-blue-100 text-blue-800", Paid: "bg-green-100 text-green-800",
};

type ProfileData = { id: number; name: string; email: string; role: string; createdAt: Date };

const roleBadge: Record<string, string> = {
  ADMIN:   "bg-blue-100 text-blue-800",
  TEACHER: "bg-green-100 text-green-800",
  STUDENT: "bg-orange-100 text-orange-800",
  EMPLOYEE: "bg-cyan-100 text-cyan-800",
};

export default function ProfilePage() {
  const { toast } = useToast();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveForm, setLeaveForm] = useState({ leaveType: "Sick" as (typeof LEAVE_TYPES)[number], startDate: "", endDate: "", totalDays: 1, reason: "" });
  const [submittingLeave, setSubmittingLeave] = useState(false);

  const [oldPassword,     setOldPassword]     = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSessionProfileDB().then(data => {
      setProfile(data);
      setLoading(false);
      if (data && (data.role === "TEACHER" || data.role === "EMPLOYEE")) {
        fetchPayslipsDB().then(setPayslips);
        fetchLeaveRequestsDB().then(setLeaveRequests);
      }
    });
  }, []);

  const reloadLeave = () => fetchLeaveRequestsDB().then(setLeaveRequests);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !leaveForm.startDate || !leaveForm.endDate) return;
    setSubmittingLeave(true);
    const res = await createLeaveRequestDB({
      employeeId: profile.id, employeeName: profile.name, leaveType: leaveForm.leaveType,
      startDate: leaveForm.startDate, endDate: leaveForm.endDate, totalDays: leaveForm.totalDays,
      reason: leaveForm.reason, status: "Pending", approvedBy: "", appliedAt: new Date().toISOString().split("T")[0],
    });
    setSubmittingLeave(false);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Leave request submitted." });
    setLeaveForm({ leaveType: "Sick", startDate: "", endDate: "", totalDays: 1, reason: "" });
    reloadLeave();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "New password must be at least 8 characters.", variant: "destructive" }); return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "New passwords do not match.", variant: "destructive" }); return;
    }
    setSaving(true);
    const res = await changePasswordDB(oldPassword, newPassword);
    setSaving(false);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Password changed successfully." });
    setOldPassword(""); setNewPassword(""); setConfirmPassword("");
  };

  const initials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const displayProfile = profile ?? null;

  if (loading) {
    return (
      <div className="space-y-8 max-w-2xl">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 mb-8" />
        <Card className="border-none shadow-sm">
          <CardHeader><Skeleton className="h-5 w-36" /><Skeleton className="h-3 w-48 mt-1" /></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-5">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div><Skeleton className="h-6 w-32 mb-1" /><Skeleton className="h-5 w-16 rounded-full" /></div>
            </div>
            <div className="space-y-4">
              {[1,2,3,4].map(i => <div key={i} className="flex items-center gap-4 py-3 border-b"><Skeleton className="h-5 w-5 rounded" /><div><Skeleton className="h-4 w-16 mb-1" /><Skeleton className="h-4 w-32" /></div></div>)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader><Skeleton className="h-5 w-36" /></CardHeader>
          <CardContent className="space-y-4">
            {[1,2,3].map(i => <div key={i}><Skeleton className="h-3 w-16 mb-1" /><Skeleton className="h-10 w-full rounded-md" /></div>)}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!displayProfile) {
    return <div className="py-20 text-center text-muted-foreground">No profile found. Please log in.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-primary font-headline">My Profile</h1>
        <p className="text-muted-foreground mt-1">View your account information and manage your password.</p>
      </div>

      {/* Profile Info Card */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Account Information</CardTitle>
          <CardDescription>Your profile details and role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar + name */}
          <div className="flex items-center gap-5">
            <Avatar className="h-20 w-20 border-2 border-primary/20">
              <AvatarFallback className={`text-xl font-bold ${roleBadge[displayProfile.role]}`}>
                {initials(displayProfile.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold text-primary">{displayProfile.name}</h2>
              <Badge className={`${roleBadge[displayProfile.role]} border-0 mt-1`}>{displayProfile.role}</Badge>
            </div>
          </div>

          <Separator />

          {/* Info rows */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 py-3 border-b border-secondary/30">
              <div className="p-2 rounded-lg bg-blue-50">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold">Full Name</p>
                <p className="font-semibold text-primary">{displayProfile.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 py-3 border-b border-secondary/30">
              <div className="p-2 rounded-lg bg-green-50">
                <Mail className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold">Email Address</p>
                <p className="font-semibold text-primary">{displayProfile.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 py-3 border-b border-secondary/30">
              <div className="p-2 rounded-lg bg-purple-50">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold">Role</p>
                <p className="font-semibold text-primary">{displayProfile.role}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 py-3">
              <div className="p-2 rounded-lg bg-orange-50">
                <Calendar className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold">Account Created</p>
                <p className="font-semibold text-primary">{new Date(displayProfile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Self-service: My Payslips + My Leave — teaching/non-teaching staff only */}
      {(displayProfile.role === "TEACHER" || displayProfile.role === "EMPLOYEE") && (
        <>
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> My Payslips</CardTitle>
              <CardDescription>Your own payslip history — visible only to you and admins.</CardDescription>
            </CardHeader>
            <CardContent>
              {payslips.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No payslips yet.</p>
              ) : (
                <div className="space-y-2">
                  {payslips.map(p => (
                    <div key={p.id} className="flex items-center justify-between border-b border-secondary/30 py-2 last:border-0">
                      <div>
                        <p className="font-medium text-sm">{p.month} {p.year}</p>
                        <p className="text-xs text-muted-foreground">Net Pay: {p.netPay.toLocaleString()}</p>
                      </div>
                      <Badge className={payslipStatusBadge[p.status]}>{p.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> My Leave</CardTitle>
              <CardDescription>Apply for leave and track your requests.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={handleApplyLeave} className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Leave Type</Label>
                  <Select value={leaveForm.leaveType} onValueChange={v => setLeaveForm(f => ({ ...f, leaveType: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LEAVE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Total Days</Label>
                  <Input type="number" min={1} value={leaveForm.totalDays} onChange={e => setLeaveForm(f => ({ ...f, totalDays: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Start Date</Label>
                  <Input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Date</Label>
                  <Input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Reason</Label>
                  <Textarea value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} />
                </div>
                <Button type="submit" className="col-span-2" disabled={submittingLeave || !leaveForm.startDate || !leaveForm.endDate}>
                  {submittingLeave ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Apply for Leave
                </Button>
              </form>

              <Separator />

              {leaveRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No leave requests yet.</p>
              ) : (
                <div className="space-y-2">
                  {leaveRequests.map(lr => (
                    <div key={lr.id} className="flex items-center justify-between border-b border-secondary/30 py-2 last:border-0">
                      <div>
                        <p className="font-medium text-sm">{lr.leaveType} — {formatDatePK(lr.startDate)} to {formatDatePK(lr.endDate)}</p>
                        <p className="text-xs text-muted-foreground">{lr.totalDays} day(s)</p>
                      </div>
                      <Badge className={leaveStatusBadge[lr.status]}>{lr.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Change Password Card */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Change Password
          </CardTitle>
          <CardDescription>Update your account password. Use at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1">
              <Label>Current Password</Label>
              <div className="relative">
                <Input
                  type={showOld ? "text" : "password"}
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowOld(v => !v)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-primary">
                  {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 8 chars)"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-primary">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>

            <Button type="submit" className="w-full gap-2 mt-2" disabled={saving || !oldPassword || !newPassword || !confirmPassword}>
              <KeyRound className="h-4 w-4" />
              {saving ? "Changing Password…" : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
