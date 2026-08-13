"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { kioskCheckInAction } from "@/app/actions/attendance-devices";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { Button } from "@/components/ui/button";
import { ScanLine, CheckCircle2, XCircle, ArrowLeft, Radio } from "lucide-react";

interface ScanEvent {
  id: number; ok: boolean; message: string; time: string;
}

export default function AttendanceKioskPage() {
  const { can, loaded: permsLoaded } = usePermission();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState<ScanEvent[]>([]);
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);

  const refocus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    refocus();
    const interval = setInterval(refocus, 2000);
    return () => clearInterval(interval);
  }, [refocus]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(t);
  }, [flash]);

  const handleSubmit = async (cardUid: string) => {
    if (!cardUid.trim() || busy) return;
    setBusy(true);
    const result = await kioskCheckInAction(cardUid);
    const ok = !result.error;
    setFlash(ok ? "ok" : "err");
    setFeed(prev => [
      {
        id: Date.now(),
        ok,
        message: ok
          ? `${result.studentName} — ${result.className}${result.sectionName ? `-${result.sectionName}` : ""} (${result.status})`
          : result.error || "Scan failed.",
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
      ...prev,
    ].slice(0, 12));
    setValue("");
    setBusy(false);
    refocus();
  };

  if (!permsLoaded) return null;
  if (!can("attendance.mark")) return <Unauthorized />;

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col items-center justify-center gap-8 py-8">
      <Link href="/attendance" className="self-start flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground -mt-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Attendance
      </Link>

      <div
        className={`h-40 w-40 rounded-full flex items-center justify-center border-4 transition-colors duration-300 ${
          flash === "ok" ? "border-green-500 bg-green-50" : flash === "err" ? "border-red-500 bg-red-50" : "border-primary/30 bg-primary/5"
        }`}
      >
        {flash === "ok" ? (
          <CheckCircle2 className="h-16 w-16 text-green-600" />
        ) : flash === "err" ? (
          <XCircle className="h-16 w-16 text-red-600" />
        ) : (
          <ScanLine className="h-16 w-16 text-primary animate-pulse" />
        )}
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Attendance Kiosk</h1>
        <p className="text-muted-foreground mt-1 flex items-center justify-center gap-1.5">
          <Radio className="h-3.5 w-3.5" /> Ready — scan a student ID card or badge
        </p>
      </div>

      {/* Invisible input the RFID/barcode reader "types" into — these readers act
          as a keyboard and send the card UID followed by Enter with no visible cursor needed. */}
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleSubmit(value); }}
        onBlur={refocus}
        autoFocus
        className="opacity-0 absolute h-0 w-0 pointer-events-none"
        aria-hidden
      />

      <div className="w-full max-w-md">
        <div className="flex gap-2">
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSubmit(value); }}
            placeholder="Or type card ID and press Enter"
            className="flex-1 h-11 rounded-xl border border-border bg-card px-4 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button onClick={() => handleSubmit(value)} disabled={busy}>Check In</Button>
        </div>
      </div>

      {feed.length > 0 && (
        <div className="w-full max-w-md space-y-1.5">
          {feed.map(f => (
            <div
              key={f.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                f.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
              }`}
            >
              <span className="flex items-center gap-2">
                {f.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                {f.message}
              </span>
              <span className="text-xs opacity-60 shrink-0 ml-2">{f.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
