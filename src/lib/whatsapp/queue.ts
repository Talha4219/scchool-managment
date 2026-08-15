import pool from "@/lib/db";
import { whatsAppProvider } from "./client";
import { markMessageSent, markMessageFailed } from "./notification-store";
import { logServerError } from "@/lib/error-log";
import type { TemplateMessageInput } from "./types";

// Postgres-backed queue (no Redis/BullMQ in this deployment). A "worker" here
// is just processQueueBatch() called from either the cron route
// (src/app/api/cron/whatsapp-queue) or the admin "Process Queue Now" button —
// both call the exact same function, so there's one implementation of the
// retry/backoff/idempotency logic regardless of what triggers it.

const BACKOFF_SCHEDULE_MINUTES = [1, 5, 15, 60, 240]; // exponential-ish backoff per attempt

// Meta error codes that represent a transient condition (rate limiting,
// temporary server-side issue) worth retrying. Everything else (invalid
// recipient, template not found, policy violation, etc.) is permanent —
// retrying it would just fail the same way every time and burn quota.
const TEMPORARY_META_ERROR_CODES = new Set(["1", "2", "4", "80007", "130429", "131048", "131056"]);

function isTemporaryError(errorCode: string | undefined): boolean {
  if (!errorCode) return true; // unknown/network errors default to retryable
  return TEMPORARY_META_ERROR_CODES.has(errorCode);
}

export async function enqueueJob(params: {
  notificationId: string;
  messageId: string;
  phoneNumber: string;
  templateName: string;
  templateLanguage: string;
  components?: TemplateMessageInput["components"];
  scheduledAt?: Date;
}): Promise<string> {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await pool.query(
    `INSERT INTO notification_jobs (id, notification_id, message_id, phone_number, template_name, template_language, components, next_attempt_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id, params.notificationId, params.messageId, params.phoneNumber, params.templateName, params.templateLanguage,
      params.components ? JSON.stringify(params.components) : null,
      params.scheduledAt || new Date(),
    ]
  );
  return id;
}

export interface QueueBatchResult {
  claimed: number;
  sent: number;
  failed: number;
  retried: number;
}

/** Claims up to `limit` due jobs and processes them one at a time (simple,
 *  predictable rate — a real high-volume deployment would parallelize this
 *  with a concurrency cap, not needed at this school's scale). SKIP LOCKED
 *  means two overlapping calls to this function (e.g. an overlapping cron
 *  tick) can never claim and double-send the same job. */
export async function processQueueBatch(limit = 20): Promise<QueueBatchResult> {
  const result: QueueBatchResult = { claimed: 0, sent: 0, failed: 0, retried: 0 };
  const client = await pool.connect();

  try {
    const claimed = await client.query(
      `UPDATE notification_jobs SET status='PROCESSING', updated_at=NOW()
       WHERE id IN (
         SELECT id FROM notification_jobs
         WHERE status='PENDING' AND next_attempt_at <= NOW()
         ORDER BY next_attempt_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [limit]
    );
    result.claimed = claimed.rows.length;

    for (const job of claimed.rows) {
      try {
        const components = job.components ? (typeof job.components === "string" ? JSON.parse(job.components) : job.components) : undefined;
        const sendResult = await whatsAppProvider.sendTemplateMessage({
          to: job.phone_number, templateName: job.template_name, languageCode: job.template_language, components,
        });

        if (!sendResult.error) {
          await markMessageSent(job.message_id, job.notification_id, sendResult.metaMessageId!);
          await client.query(`UPDATE notification_jobs SET status='COMPLETED', updated_at=NOW() WHERE id=$1`, [job.id]);
          result.sent++;
          continue;
        }

        const attempts = job.attempts + 1;
        const canRetry = isTemporaryError(sendResult.errorCode) && attempts < job.max_attempts;

        if (canRetry) {
          const delayMinutes = BACKOFF_SCHEDULE_MINUTES[Math.min(attempts - 1, BACKOFF_SCHEDULE_MINUTES.length - 1)];
          await client.query(
            `UPDATE notification_jobs SET status='PENDING', attempts=$1, next_attempt_at=NOW() + ($2 || ' minutes')::interval, last_error=$3, updated_at=NOW() WHERE id=$4`,
            [attempts, String(delayMinutes), sendResult.error, job.id]
          );
          result.retried++;
        } else {
          await markMessageFailed(job.message_id, job.notification_id, sendResult.errorCode, sendResult.error);
          const finalStatus = attempts >= job.max_attempts ? "DEAD_LETTER" : "FAILED";
          await client.query(
            `UPDATE notification_jobs SET status=$1, attempts=$2, last_error=$3, updated_at=NOW() WHERE id=$4`,
            [finalStatus, attempts, sendResult.error, job.id]
          );
          result.failed++;
        }
      } catch (err) {
        logServerError("whatsapp-queue", `Unexpected error processing job ${job.id}:`, err);
        const attempts = job.attempts + 1;
        const canRetry = attempts < job.max_attempts;
        await client.query(
          `UPDATE notification_jobs SET status=$1, attempts=$2, next_attempt_at=NOW() + interval '5 minutes', last_error=$3, updated_at=NOW() WHERE id=$4`,
          [canRetry ? "PENDING" : "DEAD_LETTER", attempts, err instanceof Error ? err.message : "Unknown error", job.id]
        );
        if (canRetry) result.retried++; else result.failed++;
      }
    }
  } finally {
    client.release();
  }

  return result;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
}

export async function fetchQueueStats(): Promise<QueueStats> {
  const res = await pool.query(`SELECT status, COUNT(*)::int as c FROM notification_jobs GROUP BY status`);
  const stats: QueueStats = { pending: 0, processing: 0, completed: 0, failed: 0, deadLetter: 0 };
  for (const row of res.rows) {
    if (row.status === "PENDING") stats.pending = row.c;
    else if (row.status === "PROCESSING") stats.processing = row.c;
    else if (row.status === "COMPLETED") stats.completed = row.c;
    else if (row.status === "FAILED") stats.failed = row.c;
    else if (row.status === "DEAD_LETTER") stats.deadLetter = row.c;
  }
  return stats;
}
