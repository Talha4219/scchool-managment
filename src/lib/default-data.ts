import {
  SchoolInfo,
  ClassSection,
  Section,
  Subject,
  FeeCategory,
  AcademicTerm,
  StudentRecord,
  FeeRecord,
  AttendanceRecord,
  ExamRecord,
  NotificationRecord,
  FeeStructure,
} from "./types";

export const defaultSchoolInfo: SchoolInfo = {
  name: "The Educators School System",
  registrationNumber: "SCH-PK-2026-042",
  address: "42-A, Main Boulevard, Gulberg III, Lahore, Punjab",
  contactEmail: "admin@educators.edu.pk",
  academicYear: "2026-2027",
  phone: "+92 42 3587-1234",
  website: "www.educators.edu.pk",
  principal: "Prof. Dr. Abdul Qadeer Khan",
};

export const defaultClasses: ClassSection[] = [
  { id: "cls-pg", name: "Playgroup", capacity: 25, teacherName: "" },
  { id: "cls-nur", name: "Nursery", capacity: 30, teacherName: "" },
  { id: "cls-prep", name: "Prep", capacity: 30, teacherName: "" },
  { id: "cls-1", name: "Grade 1", capacity: 35, teacherName: "" },
  { id: "cls-2", name: "Grade 2", capacity: 35, teacherName: "" },
  { id: "cls-3", name: "Grade 3", capacity: 35, teacherName: "" },
  { id: "cls-4", name: "Grade 4", capacity: 35, teacherName: "" },
  { id: "cls-5", name: "Grade 5", capacity: 35, teacherName: "" },
  { id: "cls-6", name: "Grade 6", capacity: 40, teacherName: "" },
  { id: "cls-7", name: "Grade 7", capacity: 40, teacherName: "" },
  { id: "cls-8", name: "Grade 8", capacity: 40, teacherName: "" },
  { id: "cls-9", name: "Grade 9", capacity: 45, teacherName: "" },
  { id: "cls-10", name: "Grade 10", capacity: 45, teacherName: "" },
];

export const defaultSections: Section[] = [
];

export const defaultSubjects: Subject[] = [
  { id: "sub-eng", name: "English", code: "ENG", gradeLevel: "All", teacherName: "", isElective: false },
  { id: "sub-urd", name: "Urdu", code: "URD", gradeLevel: "All", teacherName: "", isElective: false },
  { id: "sub-math", name: "Mathematics", code: "MATH", gradeLevel: "All", teacherName: "", isElective: false },
  { id: "sub-sci", name: "General Science", code: "SCI", gradeLevel: "All", teacherName: "", isElective: false },
  { id: "sub-sst", name: "Social Studies", code: "SST", gradeLevel: "All", teacherName: "", isElective: false },
  { id: "sub-isl", name: "Islamiat", code: "ISL", gradeLevel: "All", teacherName: "", isElective: false },
  { id: "sub-com", name: "Computer Science", code: "COM", gradeLevel: "Grade 6+", teacherName: "", isElective: true },
  { id: "sub-phy", name: "Physics", code: "PHY", gradeLevel: "Grade 9+", teacherName: "", isElective: false },
  { id: "sub-chem", name: "Chemistry", code: "CHEM", gradeLevel: "Grade 9+", teacherName: "", isElective: false },
  { id: "sub-bio", name: "Biology", code: "BIO", gradeLevel: "Grade 9+", teacherName: "", isElective: false },
  { id: "sub-pst", name: "Pakistan Studies", code: "PST", gradeLevel: "Grade 9+", teacherName: "", isElective: false },
  { id: "sub-draw", name: "Drawing & Art", code: "ART", gradeLevel: "Primary", teacherName: "", isElective: true },
  { id: "sub-qur", name: "Quran / Nazra", code: "QUR", gradeLevel: "All", teacherName: "", isElective: false },
  { id: "sub-ara", name: "Arabic", code: "ARA", gradeLevel: "Grade 6+", teacherName: "", isElective: true },
];

export const defaultFeeCategories: FeeCategory[] = [
  { id: "fc-tuition", name: "Monthly Tuition", description: "Standard monthly tuition fee", defaultAmount: 8500, frequency: "monthly", isActive: true },
  { id: "fc-admission", name: "Admission Fee", description: "One-time admission fee", defaultAmount: 25000, frequency: "one-time", isActive: true },
  { id: "fc-exam", name: "Examination Fee", description: "Per-term exam fee", defaultAmount: 3000, frequency: "quarterly", isActive: true },
  { id: "fc-sports", name: "Sports & Co-curricular", description: "Annual sports fee", defaultAmount: 4000, frequency: "annually", isActive: true },
  { id: "fc-lab", name: "Computer Lab Fee", description: "Monthly lab charges", defaultAmount: 1500, frequency: "monthly", isActive: true },
  { id: "fc-transport", name: "Transport Fee", description: "Monthly transport charges", defaultAmount: 6000, frequency: "monthly", isActive: true },
  { id: "fc-library", name: "Library Fee", description: "Annual library membership", defaultAmount: 2000, frequency: "annually", isActive: true },
  { id: "fc-hostel", name: "Hostel & Boarding", description: "Monthly hostel charges", defaultAmount: 15000, frequency: "monthly", isActive: true },
  { id: "fc-late", name: "Late Fee Fine", description: "Penalty for late payment", defaultAmount: 500, frequency: "monthly", isActive: true },
  { id: "fc-other", name: "Miscellaneous", description: "Other charges", defaultAmount: 1000, frequency: "one-time", isActive: true },
];

export const defaultFeeStructures: FeeStructure[] = [
  { id: "fs-primary", name: "Primary (Playgroup–Grade 5)", assignedClass: "ALL", lineItems: [
    { description: "Monthly Tuition", amount: 6500 },
    { description: "Computer Lab", amount: 1000 },
    { description: "Sports Fee", amount: 300 },
  ], totalAmount: 7800, isActive: true },
  { id: "fs-middle", name: "Middle (Grade 6–8)", assignedClass: "ALL", lineItems: [
    { description: "Monthly Tuition", amount: 8500 },
    { description: "Computer Lab", amount: 1500 },
    { description: "Sports Fee", amount: 500 },
    { description: "Library Fee", amount: 200 },
  ], totalAmount: 10700, isActive: true },
  { id: "fs-matric", name: "Matric (Grade 9–10)", assignedClass: "ALL", lineItems: [
    { description: "Monthly Tuition", amount: 11000 },
    { description: "Science Lab", amount: 2000 },
    { description: "Computer Lab", amount: 1500 },
    { description: "Sports Fee", amount: 500 },
    { description: "Library Fee", amount: 200 },
  ], totalAmount: 15200, isActive: true },
];

export const defaultAcademicTerms: AcademicTerm[] = [
  { id: "term-2026-q1", name: "First Quarter 2026", startDate: "2026-04-01", endDate: "2026-06-30", isActive: true },
  { id: "term-2026-q2", name: "Second Quarter 2026", startDate: "2026-07-01", endDate: "2026-09-30", isActive: false },
  { id: "term-2026-q3", name: "Third Quarter 2026", startDate: "2026-10-01", endDate: "2026-12-31", isActive: false },
  { id: "term-2027-q1", name: "First Quarter 2027", startDate: "2027-01-01", endDate: "2027-03-31", isActive: false },
  { id: "term-ay-2026", name: "Academic Year 2026-2027", startDate: "2026-04-01", endDate: "2027-03-31", isActive: true },
];

const pakistaniStudents: { name: string; admissionNo: string; class: string; section: string; parentName: string; parentEmail: string; email: string }[] = [
  { name: "Ahmed Ali Khan", admissionNo: "STU-2026-001", class: "Playgroup", section: "A", parentName: "Mr. Ali Khan", parentEmail: "ali.khan@email.com", email: "" },
  { name: "Fatima Zahra", admissionNo: "STU-2026-002", class: "Playgroup", section: "A", parentName: "Mr. Hassan Zahra", parentEmail: "hassan.zahra@email.com", email: "" },
  { name: "Muhammad Usman", admissionNo: "STU-2026-003", class: "Playgroup", section: "B", parentName: "Mr. Tariq Usman", parentEmail: "tariq@email.com", email: "" },
  { name: "Ayesha Bibi", admissionNo: "STU-2026-004", class: "Nursery", section: "A", parentName: "Mr. Rashid Ahmed", parentEmail: "rashid@email.com", email: "" },
  { name: "Hassan Raza", admissionNo: "STU-2026-005", class: "Nursery", section: "A", parentName: "Mr. Javed Raza", parentEmail: "javed@email.com", email: "" },
  { name: "Sana Tariq", admissionNo: "STU-2026-006", class: "Prep", section: "A", parentName: "Mr. Tariq Mehmood", parentEmail: "tariq.mehmood@email.com", email: "" },
  { name: "Ali Haider", admissionNo: "STU-2026-007", class: "Grade 1", section: "A", parentName: "Mr. Haider Ali", parentEmail: "haider@email.com", email: "" },
  { name: "Hira Batool", admissionNo: "STU-2026-008", class: "Grade 1", section: "A", parentName: "Mr. Asif Batool", parentEmail: "asif@email.com", email: "" },
  { name: "Bilal Ahmed", admissionNo: "STU-2026-009", class: "Grade 1", section: "B", parentName: "Mr. Ahmed Khan", parentEmail: "ahmed.khan@email.com", email: "" },
  { name: "Sadia Noor", admissionNo: "STU-2026-010", class: "Grade 1", section: "B", parentName: "Mr. Noor Hussain", parentEmail: "noor@email.com", email: "" },
  { name: "Kamran Akhtar", admissionNo: "STU-2026-011", class: "Grade 2", section: "A", parentName: "Mr. Akhtar Ali", parentEmail: "akhtar@email.com", email: "" },
  { name: "Nadia Javed", admissionNo: "STU-2026-012", class: "Grade 2", section: "A", parentName: "Mr. Javed Iqbal", parentEmail: "javed.iqbal@email.com", email: "" },
  { name: "Omar Farooq", admissionNo: "STU-2026-013", class: "Grade 2", section: "B", parentName: "Mr. Farooq Ahmed", parentEmail: "farooq@email.com", email: "" },
  { name: "Rabia Basri", admissionNo: "STU-2026-014", class: "Grade 2", section: "B", parentName: "Mr. Basri Khan", parentEmail: "basri@email.com", email: "" },
  { name: "Shahid Afridi", admissionNo: "STU-2026-015", class: "Grade 3", section: "A", parentName: "Mr. Afridi Khan", parentEmail: "afridi@email.com", email: "" },
  { name: "Tahira Yasmin", admissionNo: "STU-2026-016", class: "Grade 3", section: "A", parentName: "Mr. Yasmin Ali", parentEmail: "yasmin@email.com", email: "" },
  { name: "Imran Nazir", admissionNo: "STU-2026-017", class: "Grade 3", section: "B", parentName: "Mr. Nazir Ahmed", parentEmail: "nazir@email.com", email: "" },
  { name: "Zainab Ali", admissionNo: "STU-2026-018", class: "Grade 4", section: "A", parentName: "Mr. Ali Raza", parentEmail: "ali.raza@email.com", email: "" },
  { name: "Khalid Masood", admissionNo: "STU-2026-019", class: "Grade 4", section: "A", parentName: "Mr. Masood Ahmed", parentEmail: "masood@email.com", email: "" },
  { name: "Farah Iqbal", admissionNo: "STU-2026-020", class: "Grade 5", section: "A", parentName: "Mr. Iqbal Hussain", parentEmail: "iqbal@email.com", email: "" },
  { name: "Junaid Jamshed", admissionNo: "STU-2026-021", class: "Grade 5", section: "A", parentName: "Mr. Jamshed Ali", parentEmail: "jamshed@email.com", email: "" },
  { name: "Maria Rashid", admissionNo: "STU-2026-022", class: "Grade 6", section: "A", parentName: "Mr. Rashid Mehmood", parentEmail: "rashid.mehmood@email.com", email: "" },
  { name: "Ahsan Raza", admissionNo: "STU-2026-023", class: "Grade 6", section: "A", parentName: "Mr. Raza Hussain", parentEmail: "raza@email.com", email: "" },
  { name: "Saba Javed", admissionNo: "STU-2026-024", class: "Grade 6", section: "B", parentName: "Mr. Javed Bashir", parentEmail: "javed.bashir@email.com", email: "" },
  { name: "Naveed Alam", admissionNo: "STU-2026-025", class: "Grade 6", section: "B", parentName: "Mr. Alam Khan", parentEmail: "alam@email.com", email: "" },
  { name: "Parveen Akhtar", admissionNo: "STU-2026-026", class: "Grade 7", section: "A", parentName: "Mr. Akhtar Mehmood", parentEmail: "akhtar.mehmood@email.com", email: "" },
  { name: "Asif Mehmood", admissionNo: "STU-2026-027", class: "Grade 7", section: "A", parentName: "Mr. Mehmood Ali", parentEmail: "mehmood@email.com", email: "" },
  { name: "Rubina Aslam", admissionNo: "STU-2026-028", class: "Grade 8", section: "A", parentName: "Mr. Aslam Khan", parentEmail: "aslam@email.com", email: "" },
  { name: "Shahbaz Ahmed", admissionNo: "STU-2026-029", class: "Grade 8", section: "A", parentName: "Mr. Ahmed Nawaz", parentEmail: "ahmed.nawaz@email.com", email: "" },
  { name: "Tasneem Fatima", admissionNo: "STU-2026-030", class: "Grade 8", section: "B", parentName: "Mr. Fatima Khan", parentEmail: "fatima.khan@email.com", email: "" },
  { name: "Waqas Ali", admissionNo: "STU-2026-031", class: "Grade 8", section: "B", parentName: "Mr. Ali Rizvi", parentEmail: "ali.rizvi@email.com", email: "" },
  { name: "Zeeshan Haider", admissionNo: "STU-2026-032", class: "Grade 9", section: "A", parentName: "Mr. Haider Abbas", parentEmail: "haider.abbas@email.com", email: "" },
  { name: "Amina Tariq", admissionNo: "STU-2026-033", class: "Grade 9", section: "A", parentName: "Mr. Tariq Javed", parentEmail: "tariq.javed@email.com", email: "" },
  { name: "Babar Azam", admissionNo: "STU-2026-034", class: "Grade 10 (Matric)", section: "A", parentName: "Mr. Azam Khan", parentEmail: "azam@email.com", email: "" },
  { name: "Dania Hashmi", admissionNo: "STU-2026-035", class: "Grade 10 (Matric)", section: "A", parentName: "Mr. Hashmi Raza", parentEmail: "hashmi@email.com", email: "" },
  { name: "Faisal Mushtaq", admissionNo: "STU-2026-036", class: "Grade 10 (Matric)", section: "B", parentName: "Mr. Mushtaq Ahmed", parentEmail: "mushtaq@email.com", email: "" },
  { name: "Ghulam Hussain", admissionNo: "STU-2026-037", class: "Grade 10 (Matric)", section: "B", parentName: "Mr. Hussain Ali", parentEmail: "hussain@email.com", email: "" },
  { name: "Hina Khawaja", admissionNo: "STU-2026-038", class: "Grade 10 (Matric)", section: "B", parentName: "Mr. Khawaja Nadeem", parentEmail: "khawaja@email.com", email: "" },
  { name: "Irfan Malik", admissionNo: "STU-2026-039", class: "Grade 10 (Matric)", section: "B", parentName: "Mr. Malik Riaz", parentEmail: "malik@email.com", email: "" },
  { name: "Javeria Siddiqui", admissionNo: "STU-2026-040", class: "Grade 10 (Matric)", section: "A", parentName: "Mr. Siddiqui Ahmed", parentEmail: "siddiqui@email.com", email: "" },
  { name: "Hamza Shahid", admissionNo: "STU-2026-041", class: "Grade 1", section: "A", parentName: "Mr. Shahid Mehmood", parentEmail: "shahid.mehmood@email.com", email: "" },
  { name: "Mehwish Noor", admissionNo: "STU-2026-042", class: "Grade 1", section: "A", parentName: "Mr. Noor Muhammad", parentEmail: "noor.muhammad@email.com", email: "" },
  { name: "Saad bin Junaid", admissionNo: "STU-2026-043", class: "Grade 1", section: "B", parentName: "Mr. Junaid Ahmed", parentEmail: "junaid.ahmed@email.com", email: "" },
  { name: "Rida Fatima", admissionNo: "STU-2026-044", class: "Grade 1", section: "B", parentName: "Mr. Imran Saeed", parentEmail: "imran.saeed@email.com", email: "" },
  { name: "Talha Mahmood", admissionNo: "STU-2026-045", class: "Grade 2", section: "B", parentName: "Mr. Mahmood Ahmad", parentEmail: "mahmood.ahmad@email.com", email: "" },
  { name: "Amina Malik", admissionNo: "STU-2026-046", class: "Grade 2", section: "B", parentName: "Mr. Malik Sher", parentEmail: "malik.sher@email.com", email: "" },
  { name: "Furqan Ahmed", admissionNo: "STU-2026-047", class: "Grade 3", section: "B", parentName: "Mr. Ahmed Din", parentEmail: "ahmed.din@email.com", email: "" },
  { name: "Bushra Siddiqui", admissionNo: "STU-2026-048", class: "Grade 3", section: "B", parentName: "Mr. Siddiqui Hussain", parentEmail: "siddiqui.hussain@email.com", email: "" },
  { name: "Danish Khan", admissionNo: "STU-2026-049", class: "Grade 4", section: "B", parentName: "Mr. Khan Bahadur", parentEmail: "khan.bahadur@email.com", email: "" },
  { name: "Sana Riaz", admissionNo: "STU-2026-050", class: "Grade 4", section: "B", parentName: "Mr. Riaz Ahmad", parentEmail: "riaz.ahmad@email.com", email: "" },
  { name: "Usama Tariq", admissionNo: "STU-2026-051", class: "Grade 5", section: "A", parentName: "Mr. Tariq Hussain", parentEmail: "tariq.hussain@email.com", email: "" },
  { name: "Mahira Khan", admissionNo: "STU-2026-052", class: "Grade 5", section: "A", parentName: "Mr. Khan Masood", parentEmail: "khan.masood@email.com", email: "" },
  { name: "Haris Nawaz", admissionNo: "STU-2026-053", class: "Grade 5", section: "B", parentName: "Mr. Nawaz Ahmad", parentEmail: "nawaz.ahmad@email.com", email: "" },
  { name: "Zara Asif", admissionNo: "STU-2026-054", class: "Grade 5", section: "B", parentName: "Mr. Asif Mehmood", parentEmail: "asif.mehmood@email.com", email: "" },
  { name: "Bilal Malik", admissionNo: "STU-2026-055", class: "Grade 6", section: "A", parentName: "Mr. Malik Tariq", parentEmail: "malik.tariq@email.com", email: "" },
  { name: "Nida Saleem", admissionNo: "STU-2026-056", class: "Grade 6", section: "A", parentName: "Mr. Saleem Khan", parentEmail: "saleem.khan@email.com", email: "" },
  { name: "Awais Raza", admissionNo: "STU-2026-057", class: "Grade 6", section: "B", parentName: "Mr. Raza Ali", parentEmail: "raza.ali@email.com", email: "" },
  { name: "Hina Rizwan", admissionNo: "STU-2026-058", class: "Grade 6", section: "B", parentName: "Mr. Rizwan Ahmed", parentEmail: "rizwan.ahmed@email.com", email: "" },
  { name: "Kashif Mehmood", admissionNo: "STU-2026-059", class: "Grade 7", section: "A", parentName: "Mr. Mehmood Bhatti", parentEmail: "mehmood.bhatti@email.com", email: "" },
  { name: "Saima Bibi", admissionNo: "STU-2026-060", class: "Grade 7", section: "A", parentName: "Mr. Abdul Rahman", parentEmail: "abdul.rahman@email.com", email: "" },
  { name: "Yasir Shah", admissionNo: "STU-2026-061", class: "Grade 7", section: "B", parentName: "Mr. Shah Jahan", parentEmail: "shah.jahan@email.com", email: "" },
  { name: "Ayesha Siddiqa", admissionNo: "STU-2026-062", class: "Grade 7", section: "B", parentName: "Mr. Muhammad Siddiq", parentEmail: "muhammad.siddiq@email.com", email: "" },
  { name: "Adnan Ali", admissionNo: "STU-2026-063", class: "Grade 8", section: "A", parentName: "Mr. Ali Haider", parentEmail: "ali.haider@email.com", email: "" },
  { name: "Farwa Kausar", admissionNo: "STU-2026-064", class: "Grade 8", section: "A", parentName: "Mr. Muhammad Aslam", parentEmail: "muhammad.aslam@email.com", email: "" },
  { name: "Umar Draz", admissionNo: "STU-2026-065", class: "Grade 8", section: "B", parentName: "Mr. Draz Ahmed", parentEmail: "draz.ahmed@email.com", email: "" },
  { name: "Ramsha Noor", admissionNo: "STU-2026-066", class: "Grade 8", section: "B", parentName: "Mr. Noor Ul Haq", parentEmail: "noor.ulhaq@email.com", email: "" },
  { name: "Saif Ur Rehman", admissionNo: "STU-2026-067", class: "Grade 9", section: "A", parentName: "Mr. Rehmanullah Khan", parentEmail: "rehmanullah@email.com", email: "" },
  { name: "Momina Asad", admissionNo: "STU-2026-068", class: "Grade 9", section: "A", parentName: "Mr. Asad Ullah", parentEmail: "asad.ullah@email.com", email: "" },
  { name: "Hammad Hussain", admissionNo: "STU-2026-069", class: "Grade 9", section: "B", parentName: "Mr. Hussain Bakhsh", parentEmail: "hussain.bakhsh@email.com", email: "" },
  { name: "Khadija Tul Kubra", admissionNo: "STU-2026-070", class: "Grade 9", section: "B", parentName: "Mr. Muhammad Iqbal", parentEmail: "muhammad.iqbal@email.com", email: "" },
  { name: "Taimoor Khan", admissionNo: "STU-2026-071", class: "Grade 10 (Matric)", section: "A", parentName: "Mr. Khan Muhammad", parentEmail: "khan.muhammad@email.com", email: "" },
  { name: "Anum Fatima", admissionNo: "STU-2026-072", class: "Grade 10 (Matric)", section: "A", parentName: "Mr. Muhammad Faisal", parentEmail: "muhammad.faisal@email.com", email: "" },
  { name: "Shoaib Akhtar", admissionNo: "STU-2026-073", class: "Grade 10 (Matric)", section: "B", parentName: "Mr. Akhtar Ali Khan", parentEmail: "akhtar.ali@email.com", email: "" },
  { name: "Naima Aziz", admissionNo: "STU-2026-074", class: "Grade 10 (Matric)", section: "B", parentName: "Mr. Aziz Ur Rehman", parentEmail: "aziz.urrehman@email.com", email: "" },
  { name: "Hamza Rehman", admissionNo: "STU-2026-075", class: "Prep", section: "A", parentName: "Mr. Rehman Ahmed", parentEmail: "rehman.ahmed@email.com", email: "" },
  { name: "Laiba Irfan", admissionNo: "STU-2026-076", class: "Prep", section: "A", parentName: "Mr. Irfan Mahmood", parentEmail: "irfan.mahmood@email.com", email: "" },
  { name: "Shaheer Ahmed", admissionNo: "STU-2026-077", class: "Nursery", section: "A", parentName: "Mr. Ahmed Hussain", parentEmail: "ahmed.hussain@email.com", email: "" },
  { name: "Noor Ul Ain", admissionNo: "STU-2026-078", class: "Nursery", section: "A", parentName: "Mr. Ain Ul Mustafa", parentEmail: "ain.ulmustafa@email.com", email: "" },
  { name: "Aariz Mehmood", admissionNo: "STU-2026-079", class: "Playgroup", section: "A", parentName: "Mr. Mehmood Ahmad", parentEmail: "mehmood.ahmad2@email.com", email: "" },
  { name: "Inaya Siddiqui", admissionNo: "STU-2026-080", class: "Playgroup", section: "A", parentName: "Mr. Siddiqui Akhtar", parentEmail: "siddiqui.akhtar@email.com", email: "" },
];

export const defaultStudents: StudentRecord[] = pakistaniStudents.map((s, i) => ({
  id: `stu-${100 + i}`,
  name: s.name,
  admissionNumber: s.admissionNo,
  class: s.class,
  section: s.section,
  parentName: s.parentName,
  status: "Active",
  email: s.email || `${s.name.toLowerCase().replace(/\s+/g, ".")}@educators.pk`,
  parentEmail: s.parentEmail,
}));

const months = ["April", "May", "June", "July", "August", "September"];

const feeStatusesArr: ("Paid" | "Unpaid" | "Overdue" | "Partial")[] = [
  "Paid", "Paid", "Paid", "Paid", "Paid", "Paid", "Paid", "Paid", "Paid", "Paid",
  "Unpaid", "Unpaid", "Unpaid", "Unpaid", "Unpaid",
  "Partial", "Partial", "Partial",
  "Overdue", "Overdue",
];

function getFeeAmount(className: string): number {
  if (className.includes("Grade 9") || className.includes("Grade 10")) return 15200;
  if (className.includes("Grade 6") || className.includes("Grade 7") || className.includes("Grade 8")) return 10700;
  return 7800;
}

export const defaultFeeRecords: FeeRecord[] = defaultStudents.slice(0, 80).flatMap((s, i) => {
  const records: FeeRecord[] = [];
  for (let m = 0; m < 6; m++) {
    const month = months[m];
    const status = feeStatusesArr[(i * 5 + m * 3) % feeStatusesArr.length];
    const amount = getFeeAmount(s.class);
    const monthNum = m + 4;
    records.push({
      id: `fee-${s.id}-${month}`,
      studentId: s.id,
      studentName: s.name,
      amount,
      dueDate: `2026-${String(monthNum).padStart(2, "0")}-10`,
      status,
      voucherId: `VCH-2026-${String(1000 + i * 6 + m)}`,
      paymentMethod: status === "Paid" ? "Cash" : status === "Partial" ? "Bank Transfer" : undefined,
      paymentDate: status === "Paid" ? `2026-${String(monthNum).padStart(2, "0")}-${String(3 + ((i * 7 + m * 5) % 7)).padStart(2, "0")}` : status === "Partial" ? `2026-${String(monthNum).padStart(2, "0")}-${String(5 + ((i * 3 + m * 2) % 5)).padStart(2, "0")}` : undefined,
      amountPaid: status === "Paid" ? amount : status === "Partial" ? Math.floor(amount * (0.3 + ((i * 11 + m * 7) % 40) / 100)) : undefined,
      month,
      feeType: "Monthly Tuition",
      issueDate: `2026-${String(monthNum).padStart(2, "0")}-01`,
      className: s.class,
      lineItems: [{ description: "Monthly Tuition", amount }],
    });
  }
  return records;
});

const attStatusesArr: ("Present" | "Absent" | "Late")[] = [
  "Present", "Present", "Present", "Present", "Present", "Present", "Present", "Present",
  "Absent", "Absent",
  "Late", "Late",
];

export const defaultAttendance: AttendanceRecord[] = defaultStudents.slice(0, 80).flatMap((s, idx) => {
  const records: AttendanceRecord[] = [];
  for (let day = 1; day <= 25; day++) {
    const monthNum = day <= 15 ? 4 : 5;
    const dayInMonth = day <= 15 ? day : day - 15;
    const date = `2026-${String(monthNum).padStart(2, "0")}-${String(dayInMonth).padStart(2, "0")}`;
    const status = attStatusesArr[(idx * 7 + day * 3) % attStatusesArr.length];
    records.push({
      id: `att-${s.id}-${day}`,
      studentId: s.id,
      studentName: s.name,
      class: s.class,
      section: s.section,
      date,
      status,
    });
  }
  return records;
});

export const defaultExams: ExamRecord[] = [];

// ── Announcements ──
export interface AnnouncementRecord {
  id: string;
  title: string;
  content: string;
  date: string;
  authorId: string;
  authorName: string;
  targetRole?: string;
  targetClass?: string;
  priority: string;
}

export const defaultAnnouncements: AnnouncementRecord[] = [
  { id: "ann-1", title: "School Reopening", content: "School will reopen for the new academic year on April 1st, 2026. All students must report by 8:00 AM.", date: "2026-03-25", authorId: "1", authorName: "Admin User", targetRole: "ALL", priority: "high" },
  { id: "ann-2", title: "Science Exhibition", content: "Annual Science Exhibition will be held on May 10th. Students from Grade 6-10 are encouraged to submit their projects.", date: "2026-04-15", authorId: "1", authorName: "Admin User", targetRole: "STUDENT", targetClass: "Grade 6", priority: "normal" },
  { id: "ann-3", title: "Staff Training Workshop", content: "All teachers must attend the pedagogical skills workshop on April 20th in the auditorium.", date: "2026-04-12", authorId: "1", authorName: "Admin User", targetRole: "TEACHER", priority: "high" },
  { id: "ann-4", title: "Security Drill", content: "A mandatory fire safety drill will be conducted on April 18th. All staff and students must participate.", date: "2026-04-14", authorId: "1", authorName: "Admin User", targetRole: "ALL", priority: "high" },
  { id: "ann-5", title: "Library New Arrivals", content: "New books have been added to the library including latest fiction and reference materials.", date: "2026-04-06", authorId: "1", authorName: "Admin User", targetRole: "ALL", priority: "low" },
];

// ── Assignments ──
export interface AssignmentRecord {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  className: string;
  subject: string;
  teacherName: string;
  createdAt: string;
}

export const defaultAssignments: AssignmentRecord[] = [
  { id: "asg-1", title: "Algebra Practice Problems", description: "Solve 20 problems from Chapter 3: Linear Equations. Show all steps.", dueDate: "2026-04-15", className: "Grade 6", subject: "Mathematics", teacherName: "Mr. Tariq Mehmood", createdAt: "2026-04-10" },
  { id: "asg-2", title: "Urdu Essay", description: "Write a 300-word essay on 'Meri Pasandida Kitab' (My Favorite Book).", dueDate: "2026-04-18", className: "Grade 6", subject: "Urdu", teacherName: "Mr. Tariq Mehmood", createdAt: "2026-04-11" },
  { id: "asg-3", title: "Physics Numericals", description: "Solve 10 numerical problems from Chapter 2: Kinematics.", dueDate: "2026-04-22", className: "Grade 10 (Matric)", subject: "Physics", teacherName: "Mr. Asif Raza", createdAt: "2026-04-13" },
  { id: "asg-4", title: "Computer Programming", description: "Write a Python program to calculate factorial, fibonacci series, and prime numbers.", dueDate: "2026-04-19", className: "Grade 8", subject: "Computer Science", teacherName: "Mr. Sohail Ahmed", createdAt: "2026-04-12" },
  { id: "asg-5", title: "Urdu Essay", description: "Write a 400-word essay on 'Quaid-e-Azam aur Pakistan' (Quaid-e-Azam and Pakistan). Use proper Urdu essay format with matla and maqta.", dueDate: "2026-04-20", className: "Grade 4", subject: "Urdu", teacherName: "Mr. Khalid Mahmood", createdAt: "2026-04-14" },
  { id: "asg-6", title: "Science Project", description: "Build a working model of the solar system using recycled materials. Include accurate relative sizes and orbits of planets.", dueDate: "2026-04-28", className: "Grade 7", subject: "General Science", teacherName: "Mr. Javed Akhtar", createdAt: "2026-04-15" },
  { id: "asg-7", title: "Math Worksheet", description: "Complete the quadratic equations worksheet (Chapter 2). Solve all 25 problems showing complete working.", dueDate: "2026-04-24", className: "Grade 9", subject: "Mathematics", teacherName: "Mr. Naveed Anjum", createdAt: "2026-04-16" },
  { id: "asg-8", title: "History Essay", description: "Write a 500-word essay on the causes and consequences of the 1971 war. Include a timeline of key events.", dueDate: "2026-04-25", className: "Grade 10 (Matric)", subject: "Pakistan Studies", teacherName: "Mr. Asif Raza", createdAt: "2026-04-14" },
];

// ── Timetable ──
export interface TimetableRecord {
  id: string;
  className: string;
  subjectName: string;
  teacherName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string;
}

export const defaultTimetableEntries: TimetableRecord[] = [
  { id: "tt-demo-1", className: "Grade 6", subjectName: "English", teacherName: "Ms. Shazia Iqbal", dayOfWeek: "Monday", startTime: "08:00", endTime: "08:45", room: "Room 101" },
  { id: "tt-demo-2", className: "Grade 6", subjectName: "Urdu", teacherName: "Mr. Tariq Mehmood", dayOfWeek: "Monday", startTime: "08:45", endTime: "09:30", room: "Room 102" },
  { id: "tt-demo-3", className: "Grade 10 (Matric)", subjectName: "English", teacherName: "Mr. Asif Raza", dayOfWeek: "Monday", startTime: "08:00", endTime: "08:45", room: "Room 301" },
  { id: "tt-demo-4", className: "Grade 10 (Matric)", subjectName: "Physics", teacherName: "Mr. Asif Raza", dayOfWeek: "Monday", startTime: "08:45", endTime: "09:30", room: "Physics Lab" },
];

// ── LMS Course ──
export interface CourseRecord {
  id: string;
  title: string;
  code: string;
  description: string;
  gradeLevel: string;
  teacherName: string;
  credits: number;
  learningOutcomes: string[];
  prerequisites: string[];
  isActive: boolean;
}

export const defaultCourses: CourseRecord[] = [
  { id: "crs-eng-6", title: "English Language Arts Grade 6", code: "ENG-6", description: "Comprehensive English course covering grammar, composition, and literature.", gradeLevel: "Grade 6", teacherName: "Mr. Tariq Mehmood", credits: 3, learningOutcomes: ["Master parts of speech", "Write coherent paragraphs", "Comprehend age-appropriate texts"], prerequisites: [], isActive: true },
  { id: "crs-math-6", title: "Mathematics Grade 6", code: "MATH-6", description: "Full mathematics course covering algebra, geometry, fractions, and data handling.", gradeLevel: "Grade 6", teacherName: "Mr. Tariq Mehmood", credits: 4, learningOutcomes: ["Solve linear equations", "Calculate area and perimeter", "Work with fractions"], prerequisites: [], isActive: true },
  { id: "crs-phy-10", title: "Physics Grade 10 (Matric)", code: "PHY-10", description: "Matric-level physics covering mechanics, optics, electricity.", gradeLevel: "Grade 10 (Matric)", teacherName: "Mr. Asif Raza", credits: 4, learningOutcomes: ["Solve numerical problems", "Understand laws of motion", "Apply optics principles"], prerequisites: ["SCI-9"], isActive: true },
];

// ── Library Book ──
export interface LibraryBookRecord {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  publisher: string;
  publishYear: number;
  totalCopies: number;
  availableCopies: number;
  rackNumber: string;
  barcode: string;
}

export const defaultLibraryBooks: LibraryBookRecord[] = [
  { id: "book-001", title: "Pakistan: A Modern History", author: "Ian Talbot", isbn: "978-0195673731", category: "History", publisher: "Oxford University Press", publishYear: 2005, totalCopies: 5, availableCopies: 3, rackNumber: "H-01", barcode: "BAR-001" },
  { id: "book-002", title: "Mathematics for Class 10", author: "Punjab Textbook Board", isbn: "978-969-1234-01-5", category: "Textbook", publisher: "PTB Lahore", publishYear: 2024, totalCopies: 50, availableCopies: 45, rackNumber: "T-10", barcode: "BAR-002" },
  { id: "book-003", title: "The Alchemist", author: "Paulo Coelho", isbn: "978-0062315007", category: "Fiction", publisher: "HarperCollins", publishYear: 2014, totalCopies: 3, availableCopies: 1, rackNumber: "F-05", barcode: "BAR-003" },
  { id: "book-004", title: "Oxford English Dictionary", author: "Oxford Languages", isbn: "978-0199571123", category: "Reference", publisher: "Oxford University Press", publishYear: 2010, totalCopies: 2, availableCopies: 2, rackNumber: "R-01", barcode: "BAR-004" },
  { id: "book-005", title: "General Science Encyclopedia", author: "DK Publishing", isbn: "978-1465414171", category: "Science", publisher: "DK Children", publishYear: 2013, totalCopies: 3, availableCopies: 2, rackNumber: "S-02", barcode: "BAR-005" },
];

// ── Hostel ──
export interface HostelRecord {
  id: string;
  name: string;
  type: string;
  wardenName: string;
  contactPhone: string;
  totalRooms: number;
  totalBeds: number;
  address: string;
}

export const defaultHostels: HostelRecord[] = [
  { id: "hostel-boys", name: "Iqbal Hostel (Boys)", type: "Boys", wardenName: "Mr. Rashid Mehmood", contactPhone: "0300-1234567", totalRooms: 20, totalBeds: 80, address: "Adjacent to School Campus, Gulberg III" },
  { id: "hostel-girls", name: "Fatima Hostel (Girls)", type: "Girls", wardenName: "Ms. Nasreen Akhtar", contactPhone: "0301-7654321", totalRooms: 15, totalBeds: 60, address: "Street 5, Garden Town, Lahore" },
];

// ── Transport Route ──
export interface TransportRouteRecord {
  id: string;
  routeName: string;
  startPoint: string;
  endPoint: string;
  stops: string[];
  distance: number;
  feeAmount: number;
  isActive: boolean;
}

export const defaultTransportRoutes: TransportRouteRecord[] = [
  { id: "route-1", routeName: "Gulberg Route", startPoint: "Gulberg Main Chowk", endPoint: "School", stops: ["Gulberg Chowk", "Liberty Market", "MM Alam Road", "School"], distance: 8.5, feeAmount: 5000, isActive: true },
  { id: "route-2", routeName: "Garden Town Route", startPoint: "Garden Town Gate 2", endPoint: "School", stops: ["Garden Town", "Faisal Town", "Johar Town", "School"], distance: 12.0, feeAmount: 6000, isActive: true },
  { id: "route-3", routeName: "Model Town Route", startPoint: "Model Town Link Road", endPoint: "School", stops: ["Model Town", "Canal Bank", "Gulshan-e-Ravi", "School"], distance: 10.2, feeAmount: 5500, isActive: true },
];

// ── Events ──
export interface EventRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  startDate: string;
  endDate: string;
  venue: string;
  organizer: string;
  status: string;
}

export const defaultEvents: EventRecord[] = [
  { id: "evt-001", title: "Annual Sports Gala 2026", description: "Annual sports competition with athletics and team sports.", category: "Sports", startDate: "2026-04-25", endDate: "2026-04-26", venue: "School Sports Ground", organizer: "Sports Department", status: "Upcoming" },
  { id: "evt-002", title: "Parents-Teachers Meeting", description: "Quarterly meeting to discuss student progress.", category: "Social", startDate: "2026-04-30", endDate: "2026-04-30", venue: "School Auditorium", organizer: "Academic Office", status: "Upcoming" },
  { id: "evt-003", title: "Science & Technology Exhibition", description: "Students showcase science projects and innovations.", category: "Academic", startDate: "2026-05-10", endDate: "2026-05-10", venue: "Science Block", organizer: "Science Department", status: "Upcoming" },
  { id: "evt-004", title: "Independence Day Celebration", description: "Flag hoisting and patriotic celebrations.", category: "Cultural", startDate: "2026-08-14", endDate: "2026-08-14", venue: "School Main Ground", organizer: "Cultural Committee", status: "Upcoming" },
];

// ── Alumni ──
export interface AlumniRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  graduationYear: number;
  class: string;
  currentOccupation: string;
  company: string;
  status: string;
}

export const defaultAlumni: AlumniRecord[] = [
  { id: "alumni-001", name: "Dr. Arif Alvi", email: "arif.alvi@gmail.com", phone: "0300-1110001", graduationYear: 2000, class: "Grade 10 (Matric)", currentOccupation: "Physician", company: "Mayo Hospital Lahore", status: "Active" },
  { id: "alumni-002", name: "Ms. Sana Mirza", email: "sana.mirza@outlook.com", phone: "0301-2220002", graduationYear: 2005, class: "Grade 10 (Matric)", currentOccupation: "Software Engineer", company: "Systems Limited", status: "Active" },
  { id: "alumni-003", name: "Mr. Hassan Iqbal", email: "hassan.iqbal@yahoo.com", phone: "0302-3330003", graduationYear: 2010, class: "Grade 10 (Matric)", currentOccupation: "Chartered Accountant", company: "Deloitte Pakistan", status: "Active" },
  { id: "alumni-004", name: "Ms. Fatima Tariq", email: "fatima.tariq@gmail.com", phone: "0303-4440004", graduationYear: 2015, class: "Grade 10 (Matric)", currentOccupation: "Civil Servant", company: "Pakistan Administrative Service", status: "Active" },
  { id: "alumni-005", name: "Mr. Bilal Ahmed", email: "bilal.ahmed@live.com", phone: "0304-5550005", graduationYear: 2018, class: "Grade 10 (Matric)", currentOccupation: "University Student", company: "LUMS", status: "Active" },
];

// ── Scholarship ──
export interface ScholarshipRecord {
  id: string;
  name: string;
  type: string;
  amount: number;
  totalSlots: number;
  availableSlots: number;
  eligibilityCriteria: string;
  isActive: boolean;
}

export const defaultScholarships: ScholarshipRecord[] = [
  { id: "schol-001", name: "Merit Scholarship - Top 10%", type: "Merit", amount: 50000, totalSlots: 10, availableSlots: 8, eligibilityCriteria: "Students scoring 90% or above. Family income below PKR 500,000/year.", isActive: true },
  { id: "schol-002", name: "Need-Based Financial Aid", type: "Need-based", amount: 35000, totalSlots: 20, availableSlots: 15, eligibilityCriteria: "Family income below PKR 300,000/year. Minimum 60% score.", isActive: true },
  { id: "schol-003", name: "Sports Excellence Scholarship", type: "Sports", amount: 25000, totalSlots: 5, availableSlots: 4, eligibilityCriteria: "District level sports achievers. Minimum 50% score.", isActive: true },
  { id: "schol-004", name: "Hifz-e-Quran Scholarship", type: "Special", amount: 30000, totalSlots: 8, availableSlots: 7, eligibilityCriteria: "Students who completed Hifz-e-Quran.", isActive: true },
];

// ── Job Posting ──
export interface JobPostingRecord {
  id: string;
  companyName: string;
  title: string;
  description: string;
  requirements: string;
  location: string;
  salaryRange: string;
  jobType: string;
  status: string;
  contactEmail: string;
}

export const defaultJobPostings: JobPostingRecord[] = [
  { id: "job-001", companyName: "Systems Limited", title: "Junior Software Developer", description: "Looking for fresh graduates for web development team.", requirements: "Basic knowledge of JavaScript, HTML, CSS.", location: "Lahore", salaryRange: "PKR 50,000 - 70,000", jobType: "Full-time", status: "Active", contactEmail: "hr@systems.com.pk" },
  { id: "job-002", companyName: "HBL Bank", title: "Teller / Customer Service Officer", description: "Entry-level position for bank tellers.", requirements: "Intermediate or above. Good communication skills.", location: "Multiple Branches Lahore", salaryRange: "PKR 35,000 - 45,000", jobType: "Full-time", status: "Active", contactEmail: "careers@hbl.com" },
  { id: "job-003", companyName: "The Educators School", title: "Teaching Assistant (Intern)", description: "Paid internship for students interested in teaching.", requirements: "Good academic record. Available for 3 months.", location: "Lahore", salaryRange: "PKR 15,000 stipend", jobType: "Internship", status: "Active", contactEmail: "careers@educators.edu.pk" },
];

// ── Facility Room ──
export interface RoomRecord {
  id: string;
  name: string;
  type: string;
  capacity: number;
  floor: number;
  building: string;
  hasProjector: boolean;
  hasAC: boolean;
  isActive: boolean;
}

export const defaultRooms: RoomRecord[] = [
  { id: "room-101", name: "Grade 6 Classroom", type: "Classroom", capacity: 40, floor: 1, building: "Academic Block A", hasProjector: true, hasAC: true, isActive: true },
  { id: "room-201", name: "Computer Lab", type: "Lab", capacity: 30, floor: 2, building: "Science & Tech Block", hasProjector: true, hasAC: true, isActive: true },
  { id: "room-202", name: "Science Lab", type: "Lab", capacity: 30, floor: 2, building: "Science & Tech Block", hasProjector: false, hasAC: true, isActive: true },
  { id: "room-301", name: "School Auditorium", type: "Auditorium", capacity: 500, floor: 1, building: "Main Building", hasProjector: true, hasAC: true, isActive: true },
  { id: "room-302", name: "Conference Room", type: "Conference Room", capacity: 30, floor: 3, building: "Admin Block", hasProjector: true, hasAC: true, isActive: true },
  { id: "room-303", name: "Library", type: "Library", capacity: 80, floor: 1, building: "Main Building", hasProjector: false, hasAC: true, isActive: true },
  { id: "room-304", name: "Sports Hall", type: "Sports Hall", capacity: 200, floor: 0, building: "Sports Complex", hasProjector: false, hasAC: false, isActive: true },
  { id: "room-305", name: "Staff Room", type: "Office", capacity: 25, floor: 1, building: "Academic Block B", hasProjector: false, hasAC: true, isActive: true },
];

export const defaultNotifications: NotificationRecord[] = [
  { id: "notif-1", title: "Fee Reminder", message: "April tuition fee deadline is April 10th. Please submit before due date to avoid late fee.", date: "2026-04-05", recipientRole: "PARENT", read: false },
  { id: "notif-2", title: "Mid Term Schedule", message: "Mid Term examinations will begin from May 15th. Detailed schedule has been uploaded.", date: "2026-05-01", recipientRole: "STUDENT", read: false },
  { id: "notif-3", title: "Staff Meeting", message: "All teachers are requested to attend the staff meeting on Monday at 2 PM in the conference room.", date: "2026-04-08", recipientRole: "TEACHER", read: false },
  { id: "notif-4", title: "Summer Break Announcement", message: "Summer break will start from June 20th. School will reopen on August 1st.", date: "2026-06-01", recipientRole: "PARENT", read: true },
  { id: "notif-5", title: "New Admission Enquiry", message: "A new admission enquiry has been received for Grade 1. Please review the application.", date: "2026-04-03", recipientRole: "ADMIN", read: false },
  { id: "notif-6", title: "Result Submission", message: "All subject teachers must submit Mid Term results by May 25th.", date: "2026-05-10", recipientRole: "TEACHER", read: false },
  { id: "notif-7", title: "Transport Route Change", message: "Route #3 will have a changed pickup point starting next week.", date: "2026-04-02", recipientRole: "PARENT", read: true },
  { id: "notif-8", title: "Parent-Teacher Meeting", message: "PTM scheduled for April 30th. Please confirm your availability.", date: "2026-04-15", recipientRole: "TEACHER", read: false },
  { id: "notif-9", title: "Library Due Date", message: "Books issued on March 1st are due for return. Late fine will apply after April 10th.", date: "2026-04-01", recipientRole: "STUDENT", read: false },
  { id: "notif-10", title: "Sports Gala", message: "Annual Sports Gala will be held on April 25th. Students are encouraged to participate.", date: "2026-04-10", recipientRole: "STUDENT", read: true },
  { id: "notif-11", title: "Salary Disbursed", message: "April salaries have been disbursed. Please check your bank accounts.", date: "2026-04-01", recipientRole: "TEACHER", read: true },
  { id: "notif-12", title: "Board Registration", message: "Grade 9 and 10 board registration forms are due by April 20th.", date: "2026-04-05", recipientRole: "ADMIN", read: false },
];
