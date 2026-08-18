"use server";

import { query } from "@/lib/db";
import { getSession } from "./auth";

export interface ErrorLogEntry {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "PRINCIPAL" && session.role !== "OWNER")) return null;
  return session;
}

export async function fetchErrorLogAction(opts?: { onlyUnresolved?: boolean }): Promise<ErrorLogEntry[]> {
  if (!(await requireAdmin())) return [];
  const res = await query(
    `SELECT * FROM error_log ${opts?.onlyUnresolved ? "WHERE resolved = false" : ""} ORDER BY created_at DESC LIMIT 200`
  );
  return res.rows.map(r => ({
    id: r.id, source: r.source, message: r.message, stack: r.stack,
    resolved: r.resolved, resolvedAt: r.resolved_at, resolvedBy: r.resolved_by, createdAt: r.created_at,
  }));
}

export async function fetchUnresolvedErrorCountAction(): Promise<number> {
  if (!(await requireAdmin())) return 0;
  const res = await query(`SELECT COUNT(*)::int as c FROM error_log WHERE resolved = false`);
  return res.rows[0]?.c ?? 0;
}

export async function resolveErrorLogEntryAction(id: string): Promise<{ error?: string }> {
  const session = await requireAdmin();
  if (!session) return { error: "Not authorized." };
  await query(
    `UPDATE error_log SET resolved = true, resolved_at = NOW(), resolved_by = $1 WHERE id = $2`,
    [session.name, id]
  );
  return {};
}

export async function resolveErrorLogEntriesAction(ids: string[]): Promise<{ error?: string }> {
  const session = await requireAdmin();
  if (!session) return { error: "Not authorized." };
  if (ids.length === 0) return {};
  await query(
    `UPDATE error_log SET resolved = true, resolved_at = NOW(), resolved_by = $1 WHERE id = ANY($2)`,
    [session.name, ids]
  );
  return {};
}

export async function clearResolvedErrorLogAction(): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  await query(`DELETE FROM error_log WHERE resolved = true`);
  return {};
}
