"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { fetchAuditLogDB, type AuditLogEntry } from "@/app/actions/db";
import { History, Search, ChevronDown, ChevronRight } from "lucide-react";

const entityTypeLabel: Record<string, string> = {
  marks_entry: "Grades",
  exam_results: "Grades",
  fee_discount: "Fee Discount",
  attendance: "Attendance",
  attendance_session: "Attendance",
};

const actionBadge: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
};

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function DiffRow({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <pre className="text-[11px] bg-secondary/50 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-words">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export default function AuditLogPage() {
  const { can, loaded: permsLoaded } = usePermission();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAuditLogDB({
      entityType: entityFilter === "ALL" ? undefined : entityFilter,
      search: search.trim() || undefined,
    });
    setEntries(data);
    setLoading(false);
  }, [entityFilter, search]);

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
  }, [load]);

  if (!permsLoaded) return null;
  if (!can("audit.view")) return <Unauthorized message="Only administrators can view the audit log." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground">Who changed what, when — grades, fee discounts, and attendance edits.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Activity</CardTitle>
              <CardDescription>Most recent changes first. Every row shows the before/after values.</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by actor or summary…"
                  className="pl-8 h-9 w-56 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All areas</SelectItem>
                  <SelectItem value="marks_entry">Grades — Marks</SelectItem>
                  <SelectItem value="exam_results">Grades — Results</SelectItem>
                  <SelectItem value="fee_discount">Fee Discounts</SelectItem>
                  <SelectItem value="attendance">Attendance</SelectItem>
                  <SelectItem value="attendance_session">Attendance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center">
              <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No audit entries match your filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(e => (
                  <>
                    <TableRow
                      key={e.id}
                      className="cursor-pointer hover:bg-secondary/40"
                      onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                    >
                      <TableCell>
                        {expanded === e.id ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatTimestamp(e.createdAt)}</TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold text-foreground">{e.actorName}</div>
                        {e.actorRole && <div className="text-[10px] text-muted-foreground">{e.actorRole}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge className={actionBadge[e.action] || "bg-secondary text-secondary-foreground"} variant="secondary">{e.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entityTypeLabel[e.entityType] || e.entityType}</TableCell>
                      <TableCell className="text-xs text-foreground max-w-md truncate">{e.summary}</TableCell>
                    </TableRow>
                    {expanded === e.id && (
                      <TableRow key={`${e.id}-detail`}>
                        <TableCell colSpan={6} className="bg-secondary/20">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                            <DiffRow label="Before" value={e.before} />
                            <DiffRow label="After" value={e.after} />
                            {e.before == null && e.after == null && (
                              <p className="text-xs text-muted-foreground">No structured before/after data recorded for this entry.</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
