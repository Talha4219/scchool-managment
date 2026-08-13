"use client";

import React, { createContext, useContext, useState, useEffect, startTransition } from "react";
import {
  fetchDBState, updateSchoolInfoDB, addStudentDB, updateStudentDB, deleteStudentDB,
  addClassDB, updateClassDB, deleteClassDB, addSubjectDB,
  updateSubjectDB, deleteSubjectDB, addFeeCategoryDB, updateFeeCategoryDB, deleteFeeCategoryDB,
  addAcademicTermDB, updateAcademicTermDB, setActiveTermDB, generateFeeVouchersDB, payFeeVoucherDB,
  applyFeeDiscountDB, recordPartialPaymentDB,
  addFeeStructureDB, updateFeeStructureDB, deleteFeeStructureDB,
  updateFeePaymentDB, regenerateVoucherDB,
  saveAttendanceDB, saveExamResultsDB, updateExamAIResultsDB, addNotificationDB, markNotificationReadDB,
  updateApplicationStatusDB,
} from "../app/actions/db";
import { approveAdmissionWithAccountsDB } from "../app/actions/admissions";

import {
  UserRole,
  SchoolInfo,
  StudentRecord,
  ClassSection,
  FeeRecord,
  AttendanceRecord,
  ExamRecord,
  NotificationRecord,
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
  defaultStudents,
  defaultFeeRecords,
  defaultAttendance,
  defaultExams,
  defaultNotifications,
} from "./default-data";

export {
  defaultSchoolInfo,
  defaultClasses,
  defaultSubjects,
  defaultFeeCategories,
  defaultFeeStructures,
  defaultAcademicTerms,
  defaultStudents,
  defaultFeeRecords,
  defaultAttendance,
  defaultExams,
  defaultNotifications,
};

interface StateContextType {
  isDbLoaded: boolean;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  schoolInfo: SchoolInfo;
  updateSchoolInfo: (info: SchoolInfo) => void;
  students: StudentRecord[];
  addStudent: (student: Omit<StudentRecord, "id" | "admissionNumber">) => StudentRecord;
  updateStudent: (student: StudentRecord) => void;
  deleteStudent: (id: string) => void;
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
  attendance: AttendanceRecord[];
  saveAttendance: (records: Omit<AttendanceRecord, "id">[]) => void;
  exams: ExamRecord[];
  saveExamResults: (exam: Omit<ExamRecord, "id">) => string;
  updateExamAIResults: (examId: string, strengths: string, weaknesses: string, studentRecs: { studentName: string; recommendations: string }[]) => void;
  notifications: NotificationRecord[];
  addNotification: (title: string, message: string, recipientRole: UserRole, recipientEmail?: string) => void;
  markNotificationRead: (id: string) => void;
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
  approveApplication: (id: string, classId?: string, sectionId?: string) => void;
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
  const [students,      setStudents]      = useState<StudentRecord[]>(defaultStudents);
  const [classes,       setClasses]       = useState<ClassSection[]>(defaultClasses);
  const [subjects,      setSubjects]      = useState<Subject[]>(defaultSubjects);
  const [feeCategories,  setFeeCategories]  = useState<FeeCategory[]>(defaultFeeCategories);
  const [feeStructures,  setFeeStructures]  = useState<FeeStructure[]>(defaultFeeStructures);
  const [academicTerms,  setAcademicTerms]  = useState<AcademicTerm[]>(defaultAcademicTerms);
  const [feeRecords,     setFeeRecords]     = useState<FeeRecord[]>(defaultFeeRecords);
  const [attendance,    setAttendance]    = useState<AttendanceRecord[]>(defaultAttendance);
  const [exams,         setExams]         = useState<ExamRecord[]>(defaultExams);
  const [notifications, setNotifications] = useState<NotificationRecord[]>(defaultNotifications);
  const [applications,  setApplications]  = useState<AdmissionApplication[]>([]);
  const [isLoaded,      setIsLoaded]      = useState(false);

  // ── Load from localStorage or DB ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const loadInitData = async () => {
      try {
        const dbState = await fetchDBState();
        if (dbState) {
          if (dbState.schoolInfo) setSchoolInfo(dbState.schoolInfo);
          if (dbState.students.length > 0) setStudents(dbState.students);
          if (dbState.classes.length > 0) setClasses(dbState.classes);
          if (dbState.subjects.length > 0) setSubjects(dbState.subjects);
          if (dbState.feeCategories.length > 0) setFeeCategories(dbState.feeCategories);
          if (dbState.feeStructures && dbState.feeStructures.length > 0) setFeeStructures(dbState.feeStructures);
          if (dbState.academicTerms.length > 0) setAcademicTerms(dbState.academicTerms);
          if (dbState.feeRecords.length > 0) setFeeRecords(dbState.feeRecords);
          if (dbState.attendance.length > 0) setAttendance(dbState.attendance);
          if (dbState.exams.length > 0) setExams(dbState.exams);
          if (dbState.notifications.length > 0) setNotifications(dbState.notifications);
          if (dbState.applications && dbState.applications.length > 0) setApplications(dbState.applications);

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
      const storedStudents       = load("sc_students");
      const storedClasses        = load("sc_classes");
      const storedSubjects       = load("sc_subjects");
      const storedFeeCategories  = load("sc_feeCategories");
      const storedFeeStructures  = load("sc_feeStructures");
      const storedAcademicTerms  = load("sc_academicTerms");
      const storedFees           = load("sc_feeRecords");
      const storedAttendance     = load("sc_attendance");
      const storedExams          = load("sc_exams");
      const storedNotifications  = load("sc_notifications");

      if (storedRole)           setActiveRole(storedRole as UserRole);
      if (storedSchool)         setSchoolInfo(storedSchool);
      if (storedStudents)       setStudents(storedStudents);
      if (storedClasses)        setClasses(storedClasses);
      if (storedSubjects)       setSubjects(storedSubjects);
      if (storedFeeCategories)  setFeeCategories(storedFeeCategories);
      if (storedFeeStructures)  setFeeStructures(storedFeeStructures);
      if (storedAcademicTerms)  setAcademicTerms(storedAcademicTerms);
      if (storedFees)           setFeeRecords(storedFees);
      if (storedAttendance)     setAttendance(storedAttendance);
      if (storedExams)          setExams(storedExams);
      if (storedNotifications)  setNotifications(storedNotifications);

      setIsLoaded(true);
    };
    loadInitData();
  }, []);

  // ── Save to localStorage ────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;
    localStorage.setItem("sc_activeRole",     activeRole);
    localStorage.setItem("sc_schoolInfo",     JSON.stringify(schoolInfo));
    localStorage.setItem("sc_students",       JSON.stringify(students));
    localStorage.setItem("sc_classes",        JSON.stringify(classes));
    localStorage.setItem("sc_subjects",       JSON.stringify(subjects));
    localStorage.setItem("sc_feeCategories",  JSON.stringify(feeCategories));
    localStorage.setItem("sc_feeStructures",  JSON.stringify(feeStructures));
    localStorage.setItem("sc_academicTerms",  JSON.stringify(academicTerms));
    localStorage.setItem("sc_feeRecords",     JSON.stringify(feeRecords));
    localStorage.setItem("sc_attendance",     JSON.stringify(attendance));
    localStorage.setItem("sc_exams",          JSON.stringify(exams));
    localStorage.setItem("sc_notifications",  JSON.stringify(notifications));
  }, [activeRole, schoolInfo, students, classes, subjects, feeCategories, feeStructures, academicTerms, feeRecords, attendance, exams, notifications, isLoaded]);

  // ── Helpers ─────────────────────────────────────────────────────────────

  const addNotification = (title: string, message: string, recipientRole: UserRole, recipientEmail?: string) => {
    const notif: NotificationRecord = {
      id: `n_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title, message,
      date: new Date().toISOString().split("T")[0],
      recipientRole,
      recipientEmail,
      read: false,
    };
    setNotifications(prev => [notif, ...prev]);
    syncDB(() => addNotificationDB(notif));
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    syncDB(() => markNotificationReadDB(id));
  }

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

  // ── Students ────────────────────────────────────────────────────────────
  const addStudent = (data: Omit<StudentRecord, "id" | "admissionNumber">): StudentRecord => {
    const id  = `s${Date.now()}`;
    const adm = `ADM-${new Date().getFullYear()}-${String(students.length + 1).padStart(3, "0")}`;
    const st: StudentRecord = { ...data, id, admissionNumber: adm };
    setStudents(prev => [...prev, st]);
    addNotification("New Admission", `${data.name} enrolled in ${data.class}-${data.section}.`, "ADMIN");
    syncDB(() => addStudentDB(st));
    return st;
  };
  const updateStudent = (s: StudentRecord) => {
    setStudents(prev => prev.map(x => x.id === s.id ? s : x));
    syncDB(() => updateStudentDB(s));
  }
  const deleteStudent = (id: string) => {
    setStudents(prev => prev.map(x => x.id === id ? { ...x, status: "Inactive" as any } : x));
    syncDB(() => deleteStudentDB(id));
  }

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

  const approveApplication = (id: string, classId?: string, sectionId?: string) => {
    const app = applications.find(a => a.id === id);
    if (!app) return;
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status: "Approved" } : a));

    startTransition(async () => {
      const result = await approveAdmissionWithAccountsDB(id, classId, sectionId);
      if (result.studentRecord) {
        setStudents(prev => [...prev, result.studentRecord!]);
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

  // ── Attendance ──────────────────────────────────────────────────────────
  const saveAttendance = (records: Omit<AttendanceRecord, "id">[]) => {
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
  };

  // ── Exams ───────────────────────────────────────────────────────────────
  const saveExamResults = (data: Omit<ExamRecord, "id">) => {
    const id = `e${exams.length + 1}_${Date.now()}`;
    const ex: ExamRecord = { ...data, id };
    setExams(prev => [...prev, ex]);
    data.studentResults.forEach(res => {
      notifyStudentAndParent(res.studentId, "Results Published", `${res.studentName} scored ${res.score}/100 in ${data.examName}.`);
    });
    syncDB(() => saveExamResultsDB(ex));
    return id;
  };

  const updateExamAIResults = (examId: string, strengths: string, weaknesses: string, recs: { studentName: string; recommendations: string }[]) => {
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
  };

  return (
    <StateContext.Provider value={{
      isDbLoaded: isLoaded,
      activeRole, setActiveRole,
      schoolInfo, updateSchoolInfo,
      students, addStudent, updateStudent, deleteStudent,
      classes, addClass, updateClass, deleteClass,
      subjects, addSubject, updateSubject, deleteSubject,
      feeCategories, addFeeCategory, updateFeeCategory, deleteFeeCategory,
      feeStructures, addFeeStructure, updateFeeStructure, deleteFeeStructure,
      academicTerms, addAcademicTerm, updateAcademicTerm, setActiveTerm,
      feeRecords, generateFeeVouchers, payFeeVoucher, applyDiscount, recordPartialPayment, sendFeeReminders,
      updateFeePayment, regenerateVoucher,
      applications, approveApplication, rejectApplication, setApplicationUnderReview,
      attendance, saveAttendance,
      exams, saveExamResults, updateExamAIResults,
      notifications, addNotification, markNotificationRead,
    }}>
      {children}
    </StateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("useAppState must be used within a StateProvider");
  return ctx;
}
