"use client";

// Split out of state-context.tsx (see notifications-context.tsx for the
// rationale). Attendance is read by very few consumers but was previously
// bundled into the same god-context as fees/students/exams/etc., so any
// attendance-related state change forced unrelated pages to re-render.

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { saveAttendanceDB } from "../app/actions/db";
import { useNotifications } from "./notifications-context";
import type { AttendanceRecord } from "./types";
import { defaultAttendance } from "./default-data";

interface AttendanceContextType {
  attendance: AttendanceRecord[];
  saveAttendance: (records: Omit<AttendanceRecord, "id">[]) => void;
  setAttendanceFromDB: (records: AttendanceRecord[]) => void;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

const syncDB = (fn: () => Promise<unknown>) => {
  fn().catch(e => console.error(e));
};

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(defaultAttendance);
  const { addNotification } = useNotifications();

  const saveAttendance = useCallback((records: Omit<AttendanceRecord, "id">[]) => {
    const ids  = records.map(r => r.studentId);
    const date = records[0]?.date;
    const withId: AttendanceRecord[] = records.map((r, i) => ({ ...r, id: `att_${Date.now()}_${i}` }));
    setAttendance(prev => [...prev.filter(a => !(a.date === date && ids.includes(a.studentId))), ...withId]);
    records.forEach(r => {
      if (r.status === "Absent") {
        addNotification("Absence Alert", `${r.studentName} was marked Absent on ${r.date}.`, "ADMIN");
      }
    });
    syncDB(() => saveAttendanceDB(withId));
  }, [addNotification]);

  const setAttendanceFromDB = useCallback((records: AttendanceRecord[]) => {
    setAttendance(records);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("sc_attendance");
    if (stored) {
      try { setAttendance(JSON.parse(stored)); } catch { /* ignore malformed cache */ }
    }
  }, []);

  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem("sc_attendance", JSON.stringify(attendance));
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [attendance]);

  const value = useMemo<AttendanceContextType>(() => ({
    attendance, saveAttendance, setAttendanceFromDB,
  }), [attendance, saveAttendance, setAttendanceFromDB]);

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error("useAttendance must be used within an AttendanceProvider");
  return ctx;
}
