"use client";

// Split out of state-context.tsx (see notifications-context.tsx for the
// rationale). `students` is the single most widely-read slice in the app
// (15+ pages), so isolating it is the biggest remaining re-render win: pages
// that only read `students` (assignments, library, transport, etc.) no
// longer re-render when fees/attendance/exams/etc. change, and vice versa.

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { addStudentDB, updateStudentDB, deleteStudentDB } from "../app/actions/db";
import { useNotifications } from "./notifications-context";
import type { StudentRecord } from "./types";
import { defaultStudents } from "./default-data";

interface StudentsContextType {
  students: StudentRecord[];
  addStudent: (student: Omit<StudentRecord, "id" | "admissionNumber">) => StudentRecord;
  updateStudent: (student: StudentRecord) => void;
  deleteStudent: (id: string) => void;
  /** Raw append with no notification/DB sync — used by admission approval,
   *  which already persisted the record via approveAdmissionWithAccountsDB. */
  appendStudent: (student: StudentRecord) => void;
  setStudentsFromDB: (students: StudentRecord[]) => void;
}

const StudentsContext = createContext<StudentsContextType | undefined>(undefined);

const syncDB = (fn: () => Promise<unknown>) => {
  fn().catch(e => console.error(e));
};

export function StudentsProvider({ children }: { children: React.ReactNode }) {
  const [students, setStudents] = useState<StudentRecord[]>(defaultStudents);
  const { addNotification } = useNotifications();

  const addStudent = useCallback((data: Omit<StudentRecord, "id" | "admissionNumber">): StudentRecord => {
    let created!: StudentRecord;
    setStudents(prev => {
      const id  = `s${Date.now()}`;
      const adm = `ADM-${new Date().getFullYear()}-${String(prev.length + 1).padStart(3, "0")}`;
      created = { ...data, id, admissionNumber: adm };
      return [...prev, created];
    });
    addNotification("New Admission", `${data.name} enrolled in ${data.class}-${data.section}.`, "ADMIN");
    syncDB(() => addStudentDB(created));
    return created;
  }, [addNotification]);

  const updateStudent = useCallback((s: StudentRecord) => {
    setStudents(prev => prev.map(x => x.id === s.id ? s : x));
    syncDB(() => updateStudentDB(s));
  }, []);

  const deleteStudent = useCallback((id: string) => {
    setStudents(prev => prev.map(x => x.id === id ? { ...x, status: "Inactive" as StudentRecord["status"] } : x));
    syncDB(() => deleteStudentDB(id));
  }, []);

  const appendStudent = useCallback((s: StudentRecord) => {
    setStudents(prev => [...prev, s]);
  }, []);

  const setStudentsFromDB = useCallback((rows: StudentRecord[]) => {
    setStudents(rows);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("sc_students");
    if (stored) {
      try { setStudents(JSON.parse(stored)); } catch { /* ignore malformed cache */ }
    }
  }, []);

  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem("sc_students", JSON.stringify(students));
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [students]);

  const value = useMemo<StudentsContextType>(() => ({
    students, addStudent, updateStudent, deleteStudent, appendStudent, setStudentsFromDB,
  }), [students, addStudent, updateStudent, deleteStudent, appendStudent, setStudentsFromDB]);

  return (
    <StudentsContext.Provider value={value}>
      {children}
    </StudentsContext.Provider>
  );
}

export function useStudents() {
  const ctx = useContext(StudentsContext);
  if (!ctx) throw new Error("useStudents must be used within a StudentsProvider");
  return ctx;
}
