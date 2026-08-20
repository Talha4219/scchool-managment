// Single source of truth for every grantable permission key in the app.
//
// This list is the canonical set used by:
//   - db-init.ts        (fresh-install seed + per-boot backfill so existing
//                        installs converge to the full catalog)
//   - permissions/page.tsx (the role editor renders exactly these keys)
//   - app-sidebar.tsx   (nav gates resolve against these keys)
//
// If you add a permission here, also add a matching module card in
// PERMISSION_GROUPS in src/app/(dashboard)/permissions/page.tsx so the role
// editor can grant/revoke it.
export const PERMISSION_KEYS: string[] = [
  // Students
  "students.view", "students.create", "students.edit", "students.delete",
  // Teachers
  "teachers.view", "teachers.create", "teachers.edit", "teachers.delete",
  // Admissions
  "admissions.view", "admissions.create", "admissions.edit", "admissions.delete", "admissions.approve", "admissions.reject",
  // Classes
  "classes.view", "classes.create", "classes.edit", "classes.delete", "classes.grades", "classes.students",
  // Assignments
  "assignments.view", "assignments.create", "assignments.grade", "assignments.delete",
  // Attendance
  "attendance.view", "attendance.mark", "attendance.staff.manage",
  // Exams
  "exams.view", "exams.create", "exams.edit", "exams.delete", "exams.dashboard", "exams.manage", "exams.marks", "exams.results", "exams.report-cards", "exams.analytics", "exams.online", "exams.books",
  // Results
  "results.view", "results.enter", "results.approve", "results.publish",
  // Fees
  "fees.view", "fees.create", "fees.edit", "fees.delete",
  // Timetable
  "timetable.view", "timetable.create", "timetable.edit", "timetable.delete", "timetable.substitute",
  // Announcements
  "announcements.view", "announcements.create", "announcements.edit", "announcements.delete",
  // Library
  "library.view", "library.create", "library.edit", "library.delete",
  // Accounting
  "accounting.view", "accounting.create", "accounting.edit",
  // HR
  "hr.view", "hr.create", "hr.edit",
  // Payroll
  "payroll.view", "payroll.create", "payroll.edit",
  // Inventory
  "inventory.view", "inventory.create", "inventory.edit",
  // Procurement
  "procurement.view", "procurement.create", "procurement.edit",
  // Hostel
  "hostel.view", "hostel.create", "hostel.edit",
  // Discipline
  "discipline.view", "discipline.create", "discipline.edit",
  // Scholarships
  "scholarships.view", "scholarships.create", "scholarships.edit",
  // Alumni
  "alumni.view", "alumni.create", "alumni.edit",
  // Events
  "events.view", "events.create", "events.edit",
  // Messages
  "messages.view",
  // Communications
  "communications.view", "communications.create",
  // WhatsApp
  "whatsapp.view",
  // LMS
  "lms.view", "lms.create", "lms.edit",
  // Parents
  "parents.view", "parents.create", "parents.edit",
  // Transport
  "transport.view", "transport.create", "transport.edit",
  // Reports
  "reports.view", "reports.export",
  // Settings
  "settings.view", "settings.edit",
  // Users
  "users.view", "users.create", "users.edit", "users.delete",
  // Audit Log
  "audit.view",
];

export const SYSTEM_ROLES = ["ADMIN", "TEACHER", "STUDENT", "PARENT", "EMPLOYEE"] as const;