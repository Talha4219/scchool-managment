"use server";

import { randomBytes, createHash } from "crypto";
import { query, checkDbConnection } from "@/lib/db";
import { checkInByCardUid, checkInByStaffCardUid, type CheckInResult } from "@/lib/attendance-checkin";
import { requireRole } from "@/lib/auth-scope";

// ── Device API keys (Settings → Attendance Devices, ADMIN only) ────────────

export interface DeviceKeyRecord {
  id: string; deviceName: string; isActive: boolean; createdAt: string; lastUsedAt: string | null;
}

export async function fetchDeviceKeysAction(): Promise<DeviceKeyRecord[]> {
  const auth = await requireRole("ADMIN");
  if ("error" in auth) return [];
  try {
    const res = await query(`SELECT id, device_name, is_active, created_at, last_used_at FROM attendance_device_keys ORDER BY created_at DESC`);
    return res.rows.map(r => ({
      id: r.id, deviceName: r.device_name, isActive: r.is_active,
      createdAt: r.created_at, lastUsedAt: r.last_used_at,
    }));
  } catch { return []; }
}

// Returns the raw key exactly once — only its hash is ever stored, matching
// the same pattern used for password-reset tokens.
export async function generateDeviceKeyAction(deviceName: string): Promise<{ error?: string; apiKey?: string }> {
  const auth = await requireRole("ADMIN");
  if ("error" in auth) return { error: auth.error };
  if (!deviceName.trim()) return { error: "Device name is required." };
  try {
    const apiKey = randomBytes(24).toString("hex");
    const id = `dk_${Date.now()}`;
    await query(
      `INSERT INTO attendance_device_keys (id, device_name, api_key_hash) VALUES ($1,$2,$3)`,
      [id, deviceName.trim(), createHash("sha256").update(apiKey).digest("hex")]
    );
    return { apiKey };
  } catch { return { error: "Failed to generate device key." }; }
}

export async function revokeDeviceKeyAction(id: string): Promise<{ error?: string }> {
  const auth = await requireRole("ADMIN");
  if ("error" in auth) return { error: auth.error };
  try {
    await query(`UPDATE attendance_device_keys SET is_active=false WHERE id=$1`, [id]);
    return {};
  } catch { return { error: "Failed to revoke key." }; }
}

// ── Student card enrollment (ADMIN or TEACHER) ──────────────────────────────

export interface StudentCardRecord {
  id: string; studentId: string; studentName: string; cardUid: string; label: string | null; issuedAt: string;
}

export async function fetchStudentCardsAction(): Promise<StudentCardRecord[]> {
  const auth = await requireRole("ADMIN", "TEACHER");
  if ("error" in auth) return [];
  try {
    const res = await query(
      `SELECT sic.id, sic.student_id, s.name as student_name, sic.card_uid, sic.label, sic.issued_at
       FROM student_id_cards sic JOIN students s ON s.id = sic.student_id ORDER BY sic.issued_at DESC`
    );
    return res.rows.map(r => ({
      id: r.id, studentId: r.student_id, studentName: r.student_name,
      cardUid: r.card_uid, label: r.label, issuedAt: r.issued_at,
    }));
  } catch { return []; }
}

export async function assignStudentCardAction(studentId: string, cardUid: string, label?: string): Promise<{ error?: string }> {
  const auth = await requireRole("ADMIN", "TEACHER");
  if ("error" in auth) return { error: auth.error };
  const trimmed = cardUid.trim();
  if (!trimmed) return { error: "Card ID is required." };
  try {
    const dupe = await query(`SELECT student_id FROM student_id_cards WHERE card_uid=$1`, [trimmed]);
    if (dupe.rows.length > 0 && dupe.rows[0].student_id !== studentId) {
      return { error: "This card is already assigned to another student." };
    }
    const id = `sic_${Date.now()}`;
    await query(
      `INSERT INTO student_id_cards (id, student_id, card_uid, label) VALUES ($1,$2,$3,$4)
       ON CONFLICT (student_id) DO UPDATE SET card_uid=$3, label=$4`,
      [id, studentId, trimmed, label || null]
    );
    return {};
  } catch (err: any) {
    if (err?.code === "23505") return { error: "This card ID is already in use." };
    return { error: "Failed to assign card." };
  }
}

export async function removeStudentCardAction(id: string): Promise<{ error?: string }> {
  const auth = await requireRole("ADMIN", "TEACHER");
  if ("error" in auth) return { error: auth.error };
  try {
    await query(`DELETE FROM student_id_cards WHERE id=$1`, [id]);
    return {};
  } catch { return { error: "Failed to remove card." }; }
}

// ── Kiosk mode: browser-based scanning, session-authenticated ──────────────
// The kiosk page runs in a normal logged-in browser tab next to a USB
// RFID/barcode reader acting as a keyboard (the overwhelming majority of
// cheap readers do this natively — no driver/SDK needed). Unlike the device
// API route, this trusts the signed-in ADMIN/TEACHER session instead of an
// API key, since a real person is sitting at this browser.
export async function kioskCheckInAction(cardUid: string): Promise<CheckInResult> {
  const auth = await requireRole("ADMIN", "TEACHER");
  if ("error" in auth) return { error: auth.error };
  const isOnline = await checkDbConnection();
  if (!isOnline) return { error: "Database offline." };
  // Same badge/card population as the device endpoint — check which table
  // the UID belongs to before dispatching so a staff badge tapped at the
  // kiosk works too, not just student cards.
  const staffCard = await query("SELECT 1 FROM staff_id_cards WHERE card_uid=$1", [cardUid.trim()]);
  if (staffCard.rows.length > 0) {
    const staffResult = await checkInByStaffCardUid(cardUid, "kiosk");
    if (staffResult.error) return { error: staffResult.error };
    return { studentName: staffResult.staffName, status: staffResult.status, time: staffResult.time };
  }
  return checkInByCardUid(cardUid, "kiosk");
}
