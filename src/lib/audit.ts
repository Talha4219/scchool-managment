import { query } from "@/lib/db";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AuditActor {
  userId: number;
  name: string;
  role: string;
}

/** Writes one compliance audit-trail row. Never throws — a logging failure
 *  must not roll back or block the mutation it's describing. */
export async function logAudit(params: {
  actor: AuditActor | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  summary: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    const id = `al_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await query(
      `INSERT INTO audit_log (id, actor_user_id, actor_name, actor_role, action, entity_type, entity_id, summary, before_data, after_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        params.actor?.userId ?? null,
        params.actor?.name ?? "Unknown",
        params.actor?.role ?? null,
        params.action,
        params.entityType,
        params.entityId,
        params.summary,
        params.before !== undefined ? JSON.stringify(params.before) : null,
        params.after !== undefined ? JSON.stringify(params.after) : null,
      ]
    );
  } catch (err) {
    console.error("audit log failed:", err);
  }
}
