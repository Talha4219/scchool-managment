"use client";

import { useEffect, useState } from "react";
import { getParentPortalData, type ParentPortalData } from "@/app/actions/features";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarCheck, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

const STATUS_STYLE: Record<string, string> = {
  Present: "bg-green-100 text-green-700",
  Absent:  "bg-red-100 text-red-700",
  Late:    "bg-amber-100 text-amber-700",
  Leave:   "bg-blue-100 text-blue-700",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  Present: CheckCircle2,
  Absent:  XCircle,
  Late:    Clock,
  Leave:   AlertCircle,
};

export default function ParentAttendancePage() {
  const { t } = useLanguage();
  const [data, setData] = useState<ParentPortalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getParentPortalData().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  const records = data?.attendance ?? [];
  const total = records.length;
  const present = records.filter(r => r.status === "Present").length;
  const absent  = records.filter(r => r.status === "Absent").length;
  const late    = records.filter(r => r.status === "Late").length;
  const pct     = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">{t("parentAttendance.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("parentAttendance.subtitle")}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t("parentAttendance.rate"), value: `${pct}%`, color: pct >= 80 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200" },
          { label: t("common.present"), value: present, color: "bg-green-50 border-green-200" },
          { label: t("common.absent"), value: absent, color: "bg-red-50 border-red-200" },
          { label: t("common.late"), value: late, color: "bg-amber-50 border-amber-200" },
        ].map(s => (
          <Card key={s.label} className={`border shadow-sm ${s.color}`}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground font-medium mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm">
        <CardHeader className="border-b border-secondary/50">
          <CardTitle className="text-base font-bold text-primary flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" /> {t("parentAttendance.log")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">{t("parentAttendance.noRecords")}</div>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/20">
                <TableRow>
                  <TableHead className="font-bold">{t("common.date")}</TableHead>
                  <TableHead className="font-bold">{t("common.class")}</TableHead>
                  <TableHead className="font-bold text-center">{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(r => {
                  const Icon = STATUS_ICON[r.status] ?? CheckCircle2;
                  return (
                    <TableRow key={r.id} className="hover:bg-secondary/10">
                      <TableCell className="font-medium py-3">{r.date}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{r.class} – {r.section}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${STATUS_STYLE[r.status] ?? "bg-gray-100 text-gray-700"} border-none gap-1`}>
                          <Icon className="h-3 w-3" /> {r.status === "Present" ? t("common.present") : r.status === "Absent" ? t("common.absent") : r.status === "Late" ? t("common.late") : r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
