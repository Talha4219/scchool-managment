"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useRef, startTransition } from "react";
import {
  fetchDBState, updateSchoolInfoDB,
  addClassDB, updateClassDB, deleteClassDB, addSubjectDB,
  updateSubjectDB, deleteSubjectDB, addFeeCategoryDB, updateFeeCategoryDB, deleteFeeCategoryDB,
  addAcademicTermDB, updateAcademicTermDB, setActiveTermDB, generateFeeVouchersDB, payFeeVoucherDB,
  applyFeeDiscountDB, recordPartialPaymentDB,
  addFeeStructureDB, updateFeeStructureDB, deleteFeeStructureDB,
  updateFeePaymentDB, regenerateVoucherDB,
  updateApplicationStatusDB,
} from "../app/actions/db";
import { approveAdmissionWithAccountsDB } from "../app/actions/admissions";
import { useNotifications } from "./notifications-context";
import { useAttendance } from "./attendance-context";
import { useExams } from "./exams-context";
import { useStudents } from "./students-context";

import {
  UserRole,
  SchoolInfo,
  ClassSection,
  FeeRecord,
  Subject,
  FeeCategory,
  FeeStructure,
  AcademicTerm,
  AdmissionApplication,
  VoucherLineItem,
} from "./types";
import {
  defaultSchoolInfo,
  defaultClasses,
  defaultSubjects,
  defaultFeeCategories,
  defaultFeeStructures,
  defaultAcademicTerms,
  defaultFeeRecords,
} from "./default-data";

export {
  defaultSchoolInfo,
  defaultClasses,
  defaultSubjects,
  defaultFeeCategories,
  defaultFeeStructures,
  defaultAcademicTerms,
  defaultFeeRecords,
};

interface StateContextType {
  isDbLoaded: boolean;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  schoolInfo: SchoolInfo;
  updateSchoolInfo: (info: SchoolInfo) => void;
  classes: ClassSection[];
  addClass: (classItem: Omit<ClassSection, "id">) => void;
  updateClass: (c: ClassSection) => void;
  deleteClass: (id: string) => void;
  feeRecords: FeeRecord[];
  generateFeeVouchers: (classFilter: string, amount: number, dueDate: string, categoryId?: string, month?: string, feeType?: string, lineItems?: VoucherLineItem[], targetStudentId?: string, roster?: { studentIds: string[]; classId: string; sectionId?: string; academicYearId: string }) => void;
  payFeeVoucher: (voucherId: string, paymentMethod: string) => Promise<{ error?: string }>;
  applyDiscount: (voucherId: string, discount: number, reason: string) => Promise<{ error?: string }>;
  recordPartialPayment: (voucherId: string, amountPaid: number, method: string) => Promise<{ error?: string }>;
  sendFeeReminders: (voucherIds: string[]) => void;
  updateFeePayment: (voucherId: string, method: string, date: string) => void;
  regenerateVoucher: (voucherId: string, month: string, dueDate: string, lineItems: VoucherLineItem[]) => void;
  feeStructures: FeeStructure[];
  addFeeStructure: (fs: Omit<FeeStructure, "id">) => void;
  updateFeeStructure: (fs: FeeStructure) => void;
  deleteFeeStructure: (id: string) => void;
  // New setup entities
  subjects: Subject[];
  addSubject: (subject: Omit<Subject, "id">) => void;
  updateSubject: (subject: Subject) => void;
  deleteSubject: (id: string) => void;
  feeCategories: FeeCategory[];
  addFeeCategory: (cat: Omit<FeeCategory, "id">) => void;
  updateFeeCategory: (cat: FeeCategory) => void;
  deleteFeeCategory: (id: string) => void;
  academicTerms: AcademicTerm[];
  addAcademicTerm: (term: Omit<AcademicTerm, "id">) => void;
  updateAcademicTerm: (term: AcademicTerm) => void;
  setActiveTerm: (id: string) => void;
  applications: AdmissionApplication[];
  approveApplication: (id: string, classId?: string, sectionId?: string, remarks?: string) => void;
  rejectApplication: (id: string, notes?: string) => void;
  setApplicationUnderReview: (id: string) => void;
}

const StateContext = createContext<StateContextType | undefined>(undefined);

// Fire-and-forget DB sync — runs outside React's scheduler so no transition
// stays "pending" while the network round-trip is in flight. This prevents
// dialog overlays from blocking clicks during async DB calls.
const syncDB = (fn: () => Promise<unknown>) => {
  fn().catch(e => console.error(e));
};

// ─── Provider ───────────────────────────────────────────────────────────────

export function StateProvider({ children }: { children: React.ReactNode }) {
  const [activeRole,    setActiveRole]    = useState<UserRole>("ADMIN");
  const [schoolInfo,    setSchoolInfo]    = useState<SchoolInfo>(defaultSchoolInfo);
  const [classes,       setClasses]       = useState<ClassSection[]>(defaultClasses);
  const [subjects,      setSubjects]      = useState<Subject[]>(defaultSubjects);
  const [feeCategories,  setFeeCategories]  = useState<FeeCategory[]>(defaultFeeCategories);
  const [feeStructures,  setFeeStructures]  = useState<FeeStructure[]>(defaultFeeStructures);
  const [academicTerms,  setAcademicTerms]  = useState<AcademicTerm[]>(defaultAcademicTerms);
  const [feeRecords,     setFeeRecords]     = useState<FeeRecord[]>(defaultFeeRecords);
  const [applications,  setApplications]  = useState<AdmissionApplication[]>([]);
  const [isLoaded,      setIsLoaded]      = useState(false);
  const { addNotification, setNotificationsFromDB } = useNotifications();
  const { setAttendanceFromDB } = useAttendance();
  const { setExamsFromDB } = useExams();
  const { students, appendStudent, setStudentsFromDB } = useStudents();

  // ── Load from localStorage or DB ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const loadInitData = async () => {
      try {
        const dbState = await fetchDBState();
        if (dbState) {
          // Previously these only overwrote the hardcoded demo defaults when
          // the DB array was non-empty, treating "successfully fetched, zero
          // rows" the same as "fetch didn't run" — which meant a Principal
          // whose branch legitimately has zero fee records (etc.) would see
          // the ~480-row demo dataset instead of their real (empty) data.
          // Once dbState exists at all, every array from it is authoritative,
          // empty or not.
          if (dbState.schoolInfo) setSchoolInfo(dbState.schoolInfo);
          setStudentsFromDB(dbState.students);
          setClasses(dbState.classes);
          setSubjects(dbState.subjects);
          setFeeCategories(dbState.feeCategories);
          if (dbState.feeStructures) setFeeStructures(dbState.feeStructures);
          setAcademicTerms(dbState.academicTerms);
          setFeeRecords(dbState.feeRecords);
          setAttendanceFromDB(dbState.attendance);
          setExamsFromDB(dbState.exams);
          setNotificationsFromDB(dbState.notifications);
          if (dbState.applications) setApplications(dbState.applications);

          const storedRole = localStorage.getItem("sc_activeRole");
          if (storedRole) setActiveRole(storedRole as UserRole);

          setIsLoaded(true);
          return;
        }
      } catch (err) {
        console.error("DB load failed, falling back to local storage", err);
      }

      // Fallback
      const load = (key: string) => {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : null;
      };

      const storedRole    = localStorage.getItem("sc_activeRole");
      const storedSchool  = load("sc_schoolInfo");
      const storedClasses        = load("sc_classes");
      const storedSubjects       = load("sc_subjects");
      const storedFeeCategories  = load("sc_feeCategories");
      const storedFeeStructures  = load("sc_feeStructures");
      const storedAcademicTerms  = load("sc_academicTerms");
      const storedFees           = load("sc_feeRecords");

      if (storedRole)           setActiveRole(storedRole as UserRole);
      if (storedSchool)         setSchoolInfo(storedSchool);
      if (storedClasses)        setClasses(storedClasses);
      if (storedSubjects)       setSubjects(storedSubjects);
      if (storedFeeCategories)  setFeeCategories(storedFeeCategories);
      if (storedFeeStructures)  setFeeStructures(storedFeeStructures);
      if (storedAcademicTerms)  setAcademicTerms(storedAcademicTerms);
      if (storedFees)           setFeeRecords(storedFees);

      setIsLoaded(true);
    };
    loadInitData();
  }, []);

  // ── Save to localStorage ────────────────────────────────────────────────
  // This is only an offline fallback cache (the DB via syncDB is the source of
  // truth), so it doesn't need to happen synchronously on every keystroke-level
  // mutation. Debounced so a burst of rapid updates (e.g. bulk attendance save,
  // typing in a form) coalesces into a single serialize+write instead of one
  // full JSON.stringify of every array per state change.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem("sc_activeRole",     activeRole);
      localStorage.setItem("sc_schoolInfo",     JSON.stringify(schoolInfo));
      localStorage.setItem("sc_classes",        JSON.stringify(classes));
      localStorage.setItem("sc_subjects",       JSON.stringify(subjects));
      localStorage.setItem("sc_feeCategories",  JSON.stringify(feeCategories));
      localStorage.setItem("sc_feeStructures",  JSON.stringify(feeStructures));
      localStorage.setItem("sc_academicTerms",  JSON.stringify(academicTerms));
      localStorage.setItem("sc_feeRecords",     JSON.stringify(feeRecords));
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [activeRole, schoolInfo, classes, subjects, feeCategories, feeStructures, academicTerms, feeRecords, isLoaded]);

  // ── Helpers ─────────────────────────────────────────────────────────────

  // Notifies the specific student (by their own login email) and, if on file,
  // their parent — used for fee/result events so each family only sees their own.
  const notifyStudentAndParent = (studentId: string, title: string, message: string) => {
    const s = students.find(x => x.id === studentId);
    if (!s) return;
    if (s.email) addNotification(title, message, "STUDENT", s.email);
    if (s.parentEmail) addNotification(title, message, "PARENT", s.parentEmail);
  };

  // ── School ──────────────────────────────────────────────────────────────
  const updateSchoolInfo = (info: SchoolInfo) => {
    setSchoolInfo(info);
    addNotification("School Profile Updated", `${info.name} configuration saved successfully.`, "ADMIN");
    syncDB(() => updateSchoolInfoDB(info));
  };

  // ── Classes ─────────────────────────────────────────────────────────────
  const addClass = (item: Omit<ClassSection, "id">) => {
    const cls: ClassSection = { ...item, id: `c${Date.now()}` };
    setClasses(prev => [...prev, cls]);
    syncDB(() => addClassDB(cls));
  }
  const updateClass = (c: ClassSection) => {
    setClasses(prev => prev.map(x => x.id === c.id ? c : x));
    syncDB(() => updateClassDB(c));
  }
  const deleteClass = (id: string) => {
    setClasses(prev => prev.filter(x => x.id !== id));
    syncDB(() => deleteClassDB(id));
  }

  // ── Subjects ────────────────────────────────────────────────────────────
  const addSubject = (s: Omit<Subject, "id">) => {
    const sub: Subject = { ...s, id: `sub${Date.now()}` };
    setSubjects(prev => [...prev, sub]);
    syncDB(() => addSubjectDB(sub));
  }
  const updateSubject = (s: Subject) => {
    setSubjects(prev => prev.map(x => x.id === s.id ? s : x));
    syncDB(() => updateSubjectDB(s));
  }
  const deleteSubject = (id: string) => {
    setSubjects(prev => prev.filter(x => x.id !== id));
    syncDB(() => deleteSubjectDB(id));
  }

  // ── Fee Categories ──────────────────────────────────────────────────────
  const addFeeCategory = (c: Omit<FeeCategory, "id">) => {
    const fc: FeeCategory = { ...c, id: `fc${Date.now()}` };
    setFeeCategories(prev => [...prev, fc]);
    syncDB(() => addFeeCategoryDB(fc));
  }
  const updateFeeCategory = (c: FeeCategory) => {
    setFeeCategories(prev => prev.map(x => x.id === c.id ? c : x));
    syncDB(() => updateFeeCategoryDB(c));
  }
  const deleteFeeCategory = (id: string) => {
    setFeeCategories(prev => prev.filter(x => x.id !== id));
    syncDB(() => deleteFeeCategoryDB(id));
  }

  // ── Academic Terms ──────────────────────────────────────────────────────
  const addAcademicTerm = (t: Omit<AcademicTerm, "id">) => {
    const at: AcademicTerm = { ...t, id: `at${Date.now()}` };
    setAcademicTerms(prev => [...prev, at]);
    syncDB(() => addAcademicTermDB(at));
  }
  const updateAcademicTerm = (t: AcademicTerm) => {
    setAcademicTerms(prev => prev.map(x => x.id === t.id ? t : x));
    syncDB(() => updateAcademicTermDB(t));
  }
  const setActiveTerm = (id: string) => {
    setAcademicTerms(prev => prev.map(t => ({ ...t, isActive: t.id === id })));
    syncDB(() => setActiveTermDB(id));
  }

  // ── Fee Structures ──────────────────────────────────────────────────────
  const addFeeStructure = (data: Omit<FeeStructure, "id">) => {
    const fs: FeeStructure = { ...data, id: `fstr${Date.now()}` };
    setFeeStructures(prev => [...prev, fs]);
    syncDB(() => addFeeStructureDB(fs));
  };
  const updateFeeStructure = (fs: FeeStructure) => {
    setFeeStructures(prev => prev.map(x => x.id === fs.id ? fs : x));
    syncDB(() => updateFeeStructureDB(fs));
  };
  const deleteFeeStructure = (id: string) => {
    setFeeStructures(prev => prev.filter(x => x.id !== id));
    syncDB(() => deleteFeeStructureDB(id));
  };

  // ── Fee Vouchers ────────────────────────────────────────────────────────
  const generateFeeVouchers = (classFilter: string, amount: number, dueDate: string, _categoryId?: string, month?: string, feeType?: string, lineItems?: VoucherLineItem[], targetStudentId?: string, roster?: { studentIds: string[]; classId: string; sectionId?: string; academicYearId: string }) => {
    // Prefer the real Enrollment roster (resolved by the caller via fetchEnrollmentsDB)
    // over legacy name-string class matching, when the caller has one.
    const matched = roster
      ? students.filter(s => roster.studentIds.includes(s.id) && s.status === "Active")
      : students.filter(s => {
          if (targetStudentId) return s.id === targetStudentId;
          if (classFilter === "ALL") return s.status === "Active";
          return s.status === "Active" && `${s.class}-${s.section}` === classFilter;
        });
    const year = new Date().getFullYear();
    const issueDate = new Date().toISOString().split("T")[0];
    const baseCount = feeRecords.length;
    const resolvedItems: VoucherLineItem[] = lineItems && lineItems.length > 0
      ? lineItems
      : [{ description: feeType || "Fee", amount }];
    const totalAmount = resolvedItems.reduce((sum, i) => sum + i.amount, 0);

    const newVouchers: FeeRecord[] = matched.map((s, idx) => {
      const n = baseCount + idx + 1;
      return {
        id: `f${n}_${Date.now()}`,
        studentId: s.id,
        studentName: s.name,
        amount: totalAmount,
        dueDate,
        status: "Unpaid",
        voucherId: `FV-${year}-${String(n).padStart(4, "0")}`,
        month,
        feeType,
        discount: 0,
        amountPaid: 0,
        issueDate,
        className: `${s.class}-${s.section}`,
        lineItems: resolvedItems,
        classId: roster?.classId,
        sectionId: roster?.sectionId,
        academicYearId: roster?.academicYearId,
      };
    });
    setFeeRecords(prev => [...prev, ...newVouchers]);
    const label = month ? ` for ${month}` : "";
    newVouchers.forEach(v => {
      const msg = `${feeType || "Fee"} voucher${label} of Rs.${v.amount.toLocaleString()} for ${v.studentName} due ${dueDate}.`;
      addNotification("Fee Voucher Generated", msg, "ADMIN");
      notifyStudentAndParent(v.studentId, "Fee Voucher Generated", msg);
    });
    syncDB(() => generateFeeVouchersDB(newVouchers));
  };

  // These three mutations now carry real server-side validation (net-due caps,
  // ledger writes) — so unlike the rest of this file's optimistic + fire-and-forget
  // syncDB pattern, they await the DB call and only apply the local update on
  // success, surfacing { error } to the caller (fees/page.tsx shows it as a toast).
  const payFeeVoucher = async (voucherId: string, method: string) => {
    const res = await payFeeVoucherDB(voucherId, method);
    if (res.error) return res;
    setFeeRecords(prev => prev.map(f =>
      f.id === voucherId
        ? { ...f, status: "Paid", paymentMethod: method, paymentDate: new Date().toISOString().split("T")[0] }
        : f
    ));
    const vch = feeRecords.find(f => f.id === voucherId);
    if (vch) {
      addNotification("Payment Confirmed", `$${vch.amount.toFixed(2)} for ${vch.studentName} (${vch.voucherId}) paid via ${method}.`, "ADMIN");
      addNotification("Fee Collected", `Voucher ${vch.voucherId} settled by ${vch.studentName}.`, "ADMIN");
      notifyStudentAndParent(vch.studentId, "Payment Confirmed", `Your payment of $${vch.amount.toFixed(2)} for voucher ${vch.voucherId} has been received.`);
    }
    return {};
  };

  const applyDiscount = async (voucherId: string, discount: number, reason: string) => {
    const res = await applyFeeDiscountDB(voucherId, discount, reason);
    if (res.error) return res;
    setFeeRecords(prev => prev.map(f => {
      if (f.id !== voucherId) return f;
      const net = f.amount - discount - (f.amountPaid || 0);
      const autoStatus = net <= 0 ? "Paid" : f.status;
      return { ...f, discount, discountReason: reason, status: autoStatus as any };
    }));
    const vch = feeRecords.find(f => f.id === voucherId);
    if (vch) {
      addNotification("Discount Applied", `$${discount.toFixed(2)} discount applied to ${vch.studentName}'s voucher ${vch.voucherId}. Reason: ${reason}`, "ADMIN");
      notifyStudentAndParent(vch.studentId, "Discount Applied", `A $${discount.toFixed(2)} discount was applied to your voucher ${vch.voucherId}. Reason: ${reason}`);
    }
    return {};
  };

  const recordPartialPayment = async (voucherId: string, amountPaid: number, method: string) => {
    const res = await recordPartialPaymentDB(voucherId, amountPaid, method);
    if (res.error) return res;
    setFeeRecords(prev => prev.map(f => {
      if (f.id !== voucherId) return f;
      const net = f.amount - (f.discount || 0);
      const totalPaid = (f.amountPaid || 0) + amountPaid;
      const newStatus = totalPaid >= net ? "Paid" : "Partial";
      return { ...f, amountPaid: totalPaid, status: newStatus as any, paymentMethod: method, paymentDate: new Date().toISOString().split("T")[0] };
    }));
    const vch = feeRecords.find(f => f.id === voucherId);
    if (vch) {
      addNotification("Partial Payment Recorded", `$${amountPaid.toFixed(2)} partial payment received from ${vch.studentName} for voucher ${vch.voucherId}.`, "ADMIN");
      notifyStudentAndParent(vch.studentId, "Partial Payment Recorded", `Your partial payment of $${amountPaid.toFixed(2)} for voucher ${vch.voucherId} has been recorded.`);
    }
    return {};
  };

  const sendFeeReminders = (voucherIds: string[]) => {
    const matched = feeRecords.filter(f => voucherIds.includes(f.id));
    matched.forEach(v => {
      const net = v.amount - (v.discount || 0) - (v.amountPaid || 0);
      notifyStudentAndParent(
        v.studentId,
        "Fee Payment Reminder",
        `Reminder: Payment of $${net.toFixed(2)} for voucher ${v.voucherId} is due on ${v.dueDate}. Please settle your fee to avoid late charges.`
      );
    });
    addNotification("Reminders Dispatched", `Fee payment reminders sent for ${matched.length} outstanding voucher(s).`, "ADMIN");
  };

  const updateFeePayment = (voucherId: string, method: string, date: string) => {
    setFeeRecords(prev => prev.map(f =>
      f.id === voucherId || f.voucherId === voucherId
        ? { ...f, paymentMethod: method, paymentDate: date }
        : f
    ));
    syncDB(() => updateFeePaymentDB(voucherId, method, date));
  };

  const regenerateVoucher = (voucherId: string, month: string, dueDate: string, lineItems: VoucherLineItem[]) => {
    const totalAmount = lineItems.reduce((s, i) => s + i.amount, 0);
    const issueDate = new Date().toISOString().split("T")[0];
    setFeeRecords(prev => prev.map(f => {
      if (f.id !== voucherId && f.voucherId !== voucherId) return f;
      return {
        ...f,
        month,
        dueDate,
        issueDate,
        lineItems,
        amount: totalAmount,
        status: "Unpaid" as const,
        paymentMethod: undefined,
        paymentDate: undefined,
        discount: 0,
        discountReason: undefined,
        amountPaid: 0,
      };
    }));
    const vch = feeRecords.find(f => f.id === voucherId || f.voucherId === voucherId);
    if (vch) {
      addNotification("Voucher Regenerated", `Fee voucher ${vch.voucherId} has been regenerated for ${month}.`, "ADMIN");
      notifyStudentAndParent(vch.studentId, "Voucher Regenerated", `Your fee voucher ${vch.voucherId} has been regenerated for ${month}.`);
    }
    syncDB(() => regenerateVoucherDB(voucherId, month, dueDate, totalAmount, lineItems));
  };

  // ── Applications ────────────────────────────────────────────────────────
  const setApplicationUnderReview = (id: string) => {
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status: "Under Review" } : a));
    syncDB(() => updateApplicationStatusDB(id, "Under Review"));
  };

  const approveApplication = (id: string, classId?: string, sectionId?: string, remarks?: string) => {
    const app = applications.find(a => a.id === id);
    if (!app) return;
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status: "Approved", adminNotes: remarks || a.adminNotes } : a));

    startTransition(async () => {
      const result = await approveAdmissionWithAccountsDB(id, classId, sectionId, remarks);
      if (result.studentRecord) {
        appendStudent(result.studentRecord);
      }
    });

    addNotification(
      "Application Approved",
      `${app.firstName} ${app.lastName}'s admission (${app.applicationId}) has been approved. Parent & student portal accounts have been created.`,
      "ADMIN"
    );
  };

  const rejectApplication = (id: string, notes?: string) => {
    const app = applications.find(a => a.id === id);
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status: "Rejected", adminNotes: notes } : a));
    if (app) {
      addNotification(
        "Application Rejected",
        `${app.firstName} ${app.lastName}'s admission application (${app.applicationId}) has been rejected.`,
        "ADMIN"
      );
    }
    syncDB(() => updateApplicationStatusDB(id, "Rejected", notes));
  };

  // Memoized so a re-render of StateProvider with unchanged state (e.g. caused
  // by a parent re-render) doesn't hand every consumer of useAppState() a new
  // object reference — which would otherwise force all of them to re-render
  // even though nothing they read actually changed.
  const value = useMemo<StateContextType>(() => ({
    isDbLoaded: isLoaded,
    activeRole, setActiveRole,
    schoolInfo, updateSchoolInfo,
    classes, addClass, updateClass, deleteClass,
    subjects, addSubject, updateSubject, deleteSubject,
    feeCategories, addFeeCategory, updateFeeCategory, deleteFeeCategory,
    feeStructures, addFeeStructure, updateFeeStructure, deleteFeeStructure,
    academicTerms, addAcademicTerm, updateAcademicTerm, setActiveTerm,
    feeRecords, generateFeeVouchers, payFeeVoucher, applyDiscount, recordPartialPayment, sendFeeReminders,
    updateFeePayment, regenerateVoucher,
    applications, approveApplication, rejectApplication, setApplicationUnderReview,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    isLoaded, activeRole, schoolInfo, classes, subjects, feeCategories,
    feeStructures, academicTerms, feeRecords, applications,
  ]);

  return (
    <StateContext.Provider value={value}>
      {children}
    </StateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("useAppState must be used within a StateProvider");
  return ctx;
}
