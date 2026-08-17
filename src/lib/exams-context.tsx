"use client";

// Split out of state-context.tsx (see notifications-context.tsx for the
// rationale). Exams is read by very few consumers but was previously bundled
// into the same god-context as fees/students/attendance/etc.

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { saveExamResultsDB, updateExamAIResultsDB } from "../app/actions/db";
import { useNotifications } from "./notifications-context";
import type { ExamRecord, StudentRecord } from "./types";
import { defaultExams } from "./default-data";

interface ExamsContextType {
  exams: ExamRecord[];
  saveExamResults: (data: Omit<ExamRecord, "id">, students: StudentRecord[]) => string;
  updateExamAIResults: (examId: string, strengths: string, weaknesses: string, studentRecs: { studentName: string; recommendations: string }[]) => void;
  setExamsFromDB: (exams: ExamRecord[]) => void;
}

const ExamsContext = createContext<ExamsContextType | undefined>(undefined);

const syncDB = (fn: () => Promise<unknown>) => {
  fn().catch(e => console.error(e));
};

export function ExamsProvider({ children }: { children: React.ReactNode }) {
  const [exams, setExams] = useState<ExamRecord[]>(defaultExams);
  const { addNotification } = useNotifications();

  // Notifies the specific student (by their own login email) and, if on file,
  // their parent — mirrors notifyStudentAndParent in state-context.tsx, but
  // needs the current students list passed in since students now live in a
  // different context (avoids a circular dependency between the two).
  const notifyStudentAndParent = useCallback((students: StudentRecord[], studentId: string, title: string, message: string) => {
    const s = students.find(x => x.id === studentId);
    if (!s) return;
    if (s.email) addNotification(title, message, "STUDENT", s.email);
    if (s.parentEmail) addNotification(title, message, "PARENT", s.parentEmail);
  }, [addNotification]);

  const saveExamResults = useCallback((data: Omit<ExamRecord, "id">, students: StudentRecord[]) => {
    const id = `e${Date.now()}`;
    const ex: ExamRecord = { ...data, id };
    setExams(prev => [...prev, ex]);
    data.studentResults.forEach(res => {
      notifyStudentAndParent(students, res.studentId, "Results Published", `${res.studentName} scored ${res.score}/100 in ${data.examName}.`);
    });
    syncDB(() => saveExamResultsDB(ex));
    return id;
  }, [notifyStudentAndParent]);

  const updateExamAIResults = useCallback((examId: string, strengths: string, weaknesses: string, recs: { studentName: string; recommendations: string }[]) => {
    setExams(prev => prev.map(ex => {
      if (ex.id !== examId) return ex;
      addNotification("AI Study Guide Ready", `Personalized study plans for ${ex.examName} are now available.`, "STUDENT");
      return {
        ...ex,
        commonStrengths: strengths,
        commonWeaknesses: weaknesses,
        studentResults: ex.studentResults.map(res => {
          const rec = recs.find(r => r.studentName.toLowerCase() === res.studentName.toLowerCase());
          return rec ? { ...res, recommendations: rec.recommendations } : res;
        }),
      };
    }));
    syncDB(() => updateExamAIResultsDB(examId, strengths, weaknesses, recs));
  }, [addNotification]);

  const setExamsFromDB = useCallback((rows: ExamRecord[]) => {
    setExams(rows);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("sc_exams");
    if (stored) {
      try { setExams(JSON.parse(stored)); } catch { /* ignore malformed cache */ }
    }
  }, []);

  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem("sc_exams", JSON.stringify(exams));
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [exams]);

  const value = useMemo<ExamsContextType>(() => ({
    exams, saveExamResults, updateExamAIResults, setExamsFromDB,
  }), [exams, saveExamResults, updateExamAIResults, setExamsFromDB]);

  return (
    <ExamsContext.Provider value={value}>
      {children}
    </ExamsContext.Provider>
  );
}

export function useExams() {
  const ctx = useContext(ExamsContext);
  if (!ctx) throw new Error("useExams must be used within an ExamsProvider");
  return ctx;
}
