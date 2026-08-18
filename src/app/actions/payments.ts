"use server";

import { query, checkDbConnection } from "@/lib/db";
import { getSession } from "./auth";
import { writeFeePaymentLedgerEntryDB } from "./db";
import {
  isJazzCashConfigured, isEasyPaisaConfigured,
  buildJazzCashRequest, buildEasyPaisaRequest,
} from "@/lib/payment-gateways";
import { logServerError } from "@/lib/error-log";
import { isWhatsAppConfigured } from "@/lib/whatsapp/config";
import { isEmailConfigured } from "@/lib/email";
import { notificationService } from "@/lib/notification-service";

export type Gateway = "jazzcash" | "easypaisa";

export async function fetchGatewayAvailabilityAction(): Promise<{ jazzcash: boolean; easypaisa: boolean }> {
  return { jazzcash: isJazzCashConfigured(), easypaisa: isEasyPaisaConfigured() };
}

interface InitiateResult {
  error?: string;
  actionUrl?: string;
  fields?: Record<string, string>;
}

// Starts an online payment attempt for a fee voucher. Only the student it
// belongs to, their parent, or an admin may initiate it — checked against the
// real students table (email / parent_email), not client-supplied identity.
export async function initiateFeePaymentAction(feeRecordId: string, gateway: Gateway): Promise<InitiateResult> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const isOnline = await checkDbConnection();
  if (!isOnline) return { error: "Database offline." };

  if (gateway === "jazzcash" && !isJazzCashConfigured()) {
    return { error: "Online payment via JazzCash isn't configured for this school yet. Please pay at the school office, or ask an admin to add JazzCash credentials in Settings." };
  }
  if (gateway === "easypaisa" && !isEasyPaisaConfigured()) {
    return { error: "Online payment via EasyPaisa isn't configured for this school yet. Please pay at the school office, or ask an admin to add EasyPaisa credentials in Settings." };
  }

  try {
    const feeRes = await query(
      `SELECT f.id, f.amount, f.discount, f.amount_paid, f.voucher_id, s.email, s.parent_email
       FROM fee_records f JOIN students s ON s.id = f.student_id WHERE f.id=$1`,
      [feeRecordId]
    );
    if (feeRes.rows.length === 0) return { error: "Voucher not found." };
    const fee = feeRes.rows[0];

    if (session.role === "STUDENT" && fee.email !== session.email) {
      return { error: "You can only pay your own fee voucher." };
    }
    if (session.role === "PARENT" && fee.parent_email !== session.email) {
      return { error: "You can only pay your ward's fee voucher." };
    }
    if (session.role !== "ADMIN" && session.role !== "PRINCIPAL" && session.role !== "OWNER" && session.role !== "STUDENT" && session.role !== "PARENT") {
      return { error: "Not authorized to pay fees." };
    }

    const netDue = (fee.amount || 0) - (fee.discount || 0) - (fee.amount_paid || 0);
    if (netDue <= 0) return { error: "This voucher is already fully paid." };

    // One initiated-but-unresolved attempt at a time per voucher, to avoid a
    // parent double-paying while an earlier redirect is still pending.
    const pending = await query(
      `SELECT id FROM online_payments WHERE fee_record_id=$1 AND status='initiated' AND created_at > NOW() - INTERVAL '30 minutes'`,
      [feeRecordId]
    );
    if (pending.rows.length > 0) {
      await query(`UPDATE online_payments SET status='cancelled' WHERE id=$1`, [pending.rows[0].id]);
    }

    const txnRef = `SCH${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const id = `op_${Date.now()}`;
    await query(
      `INSERT INTO online_payments (id, fee_record_id, gateway, txn_ref, amount, status, initiated_by_user_id)
       VALUES ($1,$2,$3,$4,$5,'initiated',$6)`,
      [id, feeRecordId, gateway, txnRef, netDue, session.userId]
    );

    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (gateway === "jazzcash") {
      const { actionUrl, fields } = buildJazzCashRequest({
        txnRefNo: txnRef,
        amountPKR: netDue,
        billReference: fee.voucher_id || feeRecordId,
        description: `School fee voucher ${fee.voucher_id || feeRecordId}`,
        returnUrl: `${origin}/api/payments/jazzcash/callback`,
      });
      return { actionUrl, fields };
    } else {
      const { actionUrl, fields } = buildEasyPaisaRequest({
        orderRefNum: txnRef,
        amountPKR: netDue,
        postBackUrl: `${origin}/api/payments/easypaisa/callback`,
        email: fee.email || undefined,
      });
      return { actionUrl, fields };
    }
  } catch (err) {
    logServerError("payments", "initiateFeePaymentAction error:", err);
    return { error: "Failed to start payment. Please try again." };
  }
}

// Called only from the gateway callback routes (src/app/api/payments/*),
// never directly from the client — those routes verify the gateway's signed
// payload first; that signature IS the authorization for this write, since
// there's no user session on a server-to-server bank callback.
export async function completeOnlinePaymentAction(
  txnRef: string, gateway: Gateway, success: boolean, rawResponse: Record<string, string>
): Promise<{ error?: string }> {
  try {
    const res = await query(`SELECT * FROM online_payments WHERE txn_ref=$1 AND gateway=$2`, [txnRef, gateway]);
    if (res.rows.length === 0) return { error: "Unknown transaction reference." };
    const row = res.rows[0];
    if (row.status !== "initiated") return {}; // already resolved — callback retried, no-op

    if (!success) {
      await query(
        `UPDATE online_payments SET status='failed', gateway_response=$1, completed_at=NOW() WHERE id=$2`,
        [JSON.stringify(rawResponse), row.id]
      );
      return {};
    }

    const today = new Date().toISOString().split("T")[0];
    const ledgerRes = await writeFeePaymentLedgerEntryDB(
      row.fee_record_id, parseFloat(row.amount), gateway === "jazzcash" ? "JazzCash" : "EasyPaisa", today
    );
    if (ledgerRes.error) {
      await query(
        `UPDATE online_payments SET status='failed', gateway_response=$1, completed_at=NOW() WHERE id=$2`,
        [JSON.stringify({ ...rawResponse, ledgerError: ledgerRes.error }), row.id]
      );
      return { error: ledgerRes.error };
    }

    await query(
      `UPDATE online_payments SET status='success', gateway_response=$1, completed_at=NOW() WHERE id=$2`,
      [JSON.stringify(rawResponse), row.id]
    );

    const feeInfo = await query(
      `SELECT f.voucher_id, s.email, s.parent_email FROM fee_records f JOIN students s ON s.id = f.student_id WHERE f.id=$1`,
      [row.fee_record_id]
    );
    const fee = feeInfo.rows[0];
    if (fee) {
      const msg = `Payment of Rs. ${parseFloat(row.amount).toLocaleString()} for voucher ${fee.voucher_id} was received via ${gateway === "jazzcash" ? "JazzCash" : "EasyPaisa"}.`;
      const notifId = (r: string) => `notif_${Date.now()}_${r}`;
      if (fee.email) {
        await query(
          `INSERT INTO notifications (id, title, message, date, recipient_role, recipient_email, read) VALUES ($1,$2,$3,$4,'STUDENT',$5,false)`,
          [notifId("s"), "Payment Received", msg, today, fee.email]
        );
      }
      if (fee.parent_email) {
        await query(
          `INSERT INTO notifications (id, title, message, date, recipient_role, recipient_email, read) VALUES ($1,$2,$3,$4,'PARENT',$5,false)`,
          [notifId("p"), "Payment Received", msg, today, fee.parent_email]
        );
      }
    }

    return {};
  } catch (err) {
    logServerError("payments", "completeOnlinePaymentAction error:", err);
    return { error: "Failed to finalize payment." };
  }
}

export interface OnlinePaymentRecord {
  id: string; feeRecordId: string; gateway: Gateway; txnRef: string; amount: number;
  status: string; createdAt: string; completedAt: string | null;
}

export async function fetchOnlinePaymentByTxnRefAction(txnRef: string): Promise<OnlinePaymentRecord | null> {
  const session = await getSession();
  if (!session) return null;
  try {
    const res = await query(`SELECT * FROM online_payments WHERE txn_ref=$1`, [txnRef]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id, feeRecordId: r.fee_record_id, gateway: r.gateway, txnRef: r.txn_ref,
      amount: parseFloat(r.amount), status: r.status, createdAt: r.created_at, completedAt: r.completed_at,
    };
  } catch { return null; }
}

export async function isFeeReminderChannelConfigured(): Promise<boolean> {
  return isWhatsAppConfigured();
}

export async function fetchNotificationChannelsStatusAction(): Promise<{ email: boolean }> {
  return { email: isEmailConfigured() };
}

// Sends one WhatsApp fee-due reminder for a single voucher, through the
// notification service (template-approval + opt-in gate enforced there —
// this function no longer talks to a gateway directly). Admin-only — this is
// a real send, never automatic.
export async function sendFeeReminderAction(feeRecordId: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "PRINCIPAL")) return { error: "Only admins can send fee reminders." };

  const feeRes = await query(
    `SELECT f.student_id, f.amount, f.discount, f.amount_paid, f.due_date, f.voucher_id, s.name as student_name, s.parent_name
     FROM fee_records f JOIN students s ON s.id = f.student_id WHERE f.id=$1`,
    [feeRecordId]
  );
  if (feeRes.rows.length === 0) return { error: "Voucher not found." };
  const fee = feeRes.rows[0];

  const netDue = (fee.amount || 0) - (fee.discount || 0) - (fee.amount_paid || 0);
  if (netDue <= 0) return { error: "This voucher is already fully paid." };

  const result = await notificationService.send({
    type: "FEE_REMINDER",
    recipientType: "PARENT",
    recipientId: fee.student_id,
    channel: "WHATSAPP",
    data: {
      parentName: fee.parent_name || "Parent/Guardian", studentName: fee.student_name,
      amount: `Rs. ${netDue.toLocaleString()}`, dueDate: fee.due_date,
    },
    createdByUserId: session.userId,
  });
  return result.error ? { error: result.error } : {};
}

// Bulk version for the Fees admin page's "Remind All Overdue" action.
export async function sendOverdueFeeRemindersAction(): Promise<{ sent: number; skipped: number; error?: string }> {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "PRINCIPAL")) return { sent: 0, skipped: 0, error: "Only admins can send fee reminders." };

  const res = await query(
    `SELECT f.id, f.student_id, f.status, f.amount, f.discount, f.amount_paid, f.due_date, f.voucher_id, s.name as student_name, s.parent_name
     FROM fee_records f JOIN students s ON s.id = f.student_id
     WHERE f.status IN ('Unpaid', 'Overdue')`
  );

  let sent = 0, skipped = 0;
  for (const fee of res.rows) {
    const netDue = (fee.amount || 0) - (fee.discount || 0) - (fee.amount_paid || 0);
    if (netDue <= 0) { skipped++; continue; }
    const result = await notificationService.send({
      type: fee.status === "Overdue" ? "FEE_OVERDUE" : "FEE_REMINDER",
      recipientType: "PARENT",
      recipientId: fee.student_id,
      channel: "WHATSAPP",
      data: {
        parentName: fee.parent_name || "Parent/Guardian", studentName: fee.student_name,
        amount: `Rs. ${netDue.toLocaleString()}`, dueDate: fee.due_date,
      },
      createdByUserId: session.userId,
    });
    if (result.error) skipped++; else sent++;
  }
  return { sent, skipped };
}
