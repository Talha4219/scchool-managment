import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { query } from "@/lib/db";
import { checkInByCardUid, checkInByStaffCardUid } from "@/lib/attendance-checkin";

// Headless integration endpoint for RFID/biometric reader agents — a local
// bridge script (ZKTeco pyzk poller, Suprema BioStar webhook, a Raspberry Pi
// reading a USB card reader, etc.) POSTs here whenever a student badges in.
// Authenticated by a per-device API key (issued in Settings → Attendance
// Devices), not a browser session — there's no user logged in on the device.
//
// curl -X POST https://<school>/api/attendance/checkin \
//   -H "Authorization: Bearer <device-api-key>" \
//   -H "Content-Type: application/json" \
//   -d '{"cardUid":"04A2B3C1"}'
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") || "";
    const apiKey = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!apiKey) return NextResponse.json({ error: "Missing device API key." }, { status: 401 });

    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const keyRes = await query(
      `SELECT id FROM attendance_device_keys WHERE api_key_hash=$1 AND is_active=true`,
      [keyHash]
    );
    if (keyRes.rows.length === 0) return NextResponse.json({ error: "Invalid or revoked device API key." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const cardUid = String(body.cardUid || body.card_uid || "");
    if (!cardUid) return NextResponse.json({ error: "Missing cardUid." }, { status: 400 });

    await query(`UPDATE attendance_device_keys SET last_used_at=NOW() WHERE id=$1`, [keyRes.rows[0].id]);

    // One physical device/API key serves both students and staff — figure
    // out which badge type was scanned before dispatching, so the "not
    // recognized" error is only returned once both lookups miss.
    const isStaffCard = await query(`SELECT 1 FROM staff_id_cards WHERE card_uid=$1`, [cardUid.trim()]);
    const result = isStaffCard.rows.length > 0
      ? await checkInByStaffCardUid(cardUid, "device")
      : await checkInByCardUid(cardUid, "device");
    if (result.error) return NextResponse.json(result, { status: 409 });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("Device checkin error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
