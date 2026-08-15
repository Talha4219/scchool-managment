import { query } from "@/lib/db";

export interface ErrorLogActor {
  userId?: number | null;
  name?: string | null;
  role?: string | null;
}

function extractMessage(args: unknown[]): { message: string; stack?: string } {
  const err = args.find(a => a instanceof Error) as Error | undefined;
  if (err) return { message: err.message || String(err), stack: err.stack };
  const message = args
    .map(a => (typeof a === "string" ? a : a instanceof Error ? a.message : JSON.stringify(a)))
    .join(" ");
  return { message: message || "Unknown error" };
}

/** Drop-in replacement for `console.error(...)` inside server actions: still logs to
 *  stdout for local dev, but also persists a row so a failed write in production is
 *  visible to an operator (Settings → Error Log) instead of vanishing into a log file
 *  nobody tails. Fire-and-forget — a logging failure must never throw or block the
 *  caller, same contract as logAudit. */
export function logServerError(source: string, ...args: unknown[]): void {
  console.error(`[${source}]`, ...args);
  const { message, stack } = extractMessage(args);
  const id = `el_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  query(
    `INSERT INTO error_log (id, source, message, stack, actor_user_id, actor_name, actor_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, source, message.slice(0, 4000), stack?.slice(0, 8000) ?? null, null, null, null]
  ).catch(err => {
    // Last resort: if even the error log itself can't be written (e.g. DB is down,
    // which is exactly when this matters most), fall back to stdout only.
    console.error("[error-log] failed to persist error row:", err);
  });
}
