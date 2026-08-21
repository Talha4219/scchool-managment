import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password", 12);

  const users = [
    { name: "Admin User",          email: "admin@educators.edu.pk",        role: "ADMIN"   as const },
    // ── Teachers ──
    { name: "Ms. Fatima Ahmed",    email: "fatima@educators.edu.pk",      role: "TEACHER" as const },
    { name: "Mr. Usman Ali",       email: "usman.ali@educators.edu.pk",   role: "TEACHER" as const },
    { name: "Ms. Nadia Javed",     email: "nadia.javed@educators.edu.pk", role: "TEACHER" as const },
    { name: "Ms. Ayesha Khan",     email: "ayesha.khan@educators.edu.pk", role: "TEACHER" as const },
    { name: "Ms. Hira Batool",     email: "hira.batool@educators.edu.pk", role: "TEACHER" as const },
    { name: "Mr. Bilal Hassan",    email: "bilal.hassan@educators.edu.pk",role: "TEACHER" as const },
    { name: "Ms. Samina Rashid",   email: "samina.rashid@educators.edu.pk",role: "TEACHER" as const },
    { name: "Mr. Imran Sheikh",    email: "imran.sheikh@educators.edu.pk",role: "TEACHER" as const },
    { name: "Ms. Rubina Aslam",    email: "rubina.aslam@educators.edu.pk",role: "TEACHER" as const },
    { name: "Mr. Khalid Mahmood",  email: "khalid.mahmood@educators.edu.pk",role: "TEACHER" as const },
    { name: "Mr. Tariq Mehmood",   email: "tariq.mehmood@educators.edu.pk",role: "TEACHER" as const },
    { name: "Ms. Farah Naz",       email: "farah.naz@educators.edu.pk",   role: "TEACHER" as const },
    { name: "Mr. Javed Akhtar",    email: "javed.akhtar@educators.edu.pk",role: "TEACHER" as const },
    { name: "Mr. Sohail Ahmed",    email: "sohail.ahmed@educators.edu.pk",role: "TEACHER" as const },
    { name: "Ms. Zainab Ali",      email: "zainab.ali@educators.edu.pk",  role: "TEACHER" as const },
    // ── Parents ──
    { name: "Mr. Ali Khan",        email: "ali.khan@email.com",           role: "PARENT"  as const },
    { name: "Mr. Hassan Zahra",    email: "hassan.zahra@email.com",       role: "PARENT"  as const },
    { name: "Mr. Tariq Usman",     email: "tariq.usman@email.com",        role: "PARENT"  as const },
    { name: "Mr. Rashid Ahmed",    email: "rashid.ahmed@email.com",       role: "PARENT"  as const },
    { name: "Mr. Javed Raza",      email: "javed.raza@email.com",         role: "PARENT"  as const },
    { name: "Mr. Haider Ali",      email: "haider.ali@email.com",         role: "PARENT"  as const },
    { name: "Mr. Asif Batool",     email: "asif.batool@email.com",        role: "PARENT"  as const },
    { name: "Mr. Ahmed Khan",      email: "ahmed.khan2@email.com",        role: "PARENT"  as const },
    { name: "Mr. Noor Hussain",    email: "noor.hussain@email.com",       role: "PARENT"  as const },
    { name: "Mr. Akhtar Ali",      email: "akhtar.ali@email.com",         role: "PARENT"  as const },
    { name: "Mr. Javed Iqbal",     email: "javed.iqbal@email.com",        role: "PARENT"  as const },
    { name: "Mr. Farooq Ahmed",    email: "farooq.ahmed@email.com",       role: "PARENT"  as const },
    { name: "Mr. Afridi Khan",     email: "afridi.khan@email.com",        role: "PARENT"  as const },
    { name: "Mr. Yasmin Ali",      email: "yasmin.ali@email.com",         role: "PARENT"  as const },
    { name: "Mr. Nazir Ahmed",     email: "nazir.ahmed@email.com",        role: "PARENT"  as const },
    // ── Student ──
    { name: "Ahmed Ali Khan",      email: "ahmed.ali.khan@educators.pk",  role: "STUDENT" as const },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
  }
  console.log("Users seeded");

  const schoolCount = await prisma.schoolInfo.count();
  if (schoolCount === 0) {
    await prisma.schoolInfo.create({
      data: {
        name: "The Educators School System",
        registrationNumber: "SCH-PK-2026-042",
        address: "42-A, Main Boulevard, Gulberg III, Lahore, Punjab",
        contactEmail: "admin@educators.edu.pk",
        academicYear: "2026-2027",
      },
    });
    console.log("School info seeded");
  }

  const termCount = await prisma.academicTerm.count();
  if (termCount === 0) {
    await prisma.academicTerm.createMany({
      data: [
        { name: "First Quarter 2026",    startDate: "2026-04-01", endDate: "2026-06-30",   isActive: true  },
        { name: "Second Quarter 2026",   startDate: "2026-07-01", endDate: "2026-09-30",   isActive: false },
        { name: "Third Quarter 2026",    startDate: "2026-10-01", endDate: "2026-12-31",   isActive: false },
        { name: "Academic Year 2026-27", startDate: "2026-04-01", endDate: "2027-03-31",   isActive: true  },
      ],
    });
    console.log("Academic terms seeded");
  }

  const classCount = await prisma.classSection.count();
  if (classCount === 0) {
    await prisma.classSection.createMany({
      data: [
        { id: "cls-pg",   name: "Playgroup",           capacity: 25, teacherName: "Ms. Fatima Ahmed" },
        { id: "cls-nur",  name: "Nursery",             capacity: 30, teacherName: "Ms. Ayesha Khan" },
        { id: "cls-prep", name: "Prep",                capacity: 30, teacherName: "Ms. Hira Batool" },
        { id: "cls-1",    name: "Grade 1",             capacity: 35, teacherName: "Mr. Usman Ali" },
        { id: "cls-2",    name: "Grade 2",             capacity: 35, teacherName: "Mr. Bilal Hassan" },
        { id: "cls-3",    name: "Grade 3",             capacity: 35, teacherName: "Mr. Imran Sheikh" },
        { id: "cls-4",    name: "Grade 4",             capacity: 35, teacherName: "Mr. Khalid Mahmood" },
        { id: "cls-5",    name: "Grade 5",             capacity: 35, teacherName: "Ms. Shazia Iqbal" },
        { id: "cls-6",    name: "Grade 6",             capacity: 40, teacherName: "Mr. Tariq Mehmood" },
        { id: "cls-7",    name: "Grade 7",             capacity: 40, teacherName: "Mr. Javed Akhtar" },
        { id: "cls-8",    name: "Grade 8",             capacity: 40, teacherName: "Mr. Sohail Ahmed" },
        { id: "cls-9",    name: "Grade 9",             capacity: 45, teacherName: "Mr. Naveed Anjum" },
        { id: "cls-10",   name: "Grade 10 (Matric)",   capacity: 45, teacherName: "Mr. Asif Raza" },
      ],
    });
    console.log("Classes seeded");
  }

  // The Class/Section/AcademicYear models are a separate (newer) academic-core
  // schema from ClassSection above — Section.classId is a real FK, so Class
  // rows (and their AcademicYear parent) must exist before Section can.
  const academicYear = await prisma.academicYear.upsert({
    where: { id: "ay-2026-27" },
    update: {},
    create: { id: "ay-2026-27", name: "2026-2027", startDate: "2026-04-01", endDate: "2027-03-31", isActive: true },
  });

  const gradeLevels = [
    { id: "cls-core-pg",   name: "Playgroup" },
    { id: "cls-core-nur",  name: "Nursery" },
    { id: "cls-core-prep", name: "Prep" },
    { id: "cls-core-1",    name: "Grade 1" },
    { id: "cls-core-2",    name: "Grade 2" },
    { id: "cls-core-3",    name: "Grade 3" },
    { id: "cls-core-4",    name: "Grade 4" },
    { id: "cls-core-5",    name: "Grade 5" },
    { id: "cls-core-6",    name: "Grade 6" },
    { id: "cls-core-7",    name: "Grade 7" },
    { id: "cls-core-8",    name: "Grade 8" },
    { id: "cls-core-9",    name: "Grade 9" },
    { id: "cls-core-10",   name: "Grade 10 (Matric)" },
  ];
  const classCoreCount = await prisma.class.count();
  if (classCoreCount === 0) {
    await prisma.class.createMany({
      data: gradeLevels.map(g => ({ id: g.id, name: g.name, gradeLevel: g.name, academicYearId: academicYear.id })),
    });
    console.log("Classes (academic-core) seeded");
  }
  const classIdByGrade = Object.fromEntries(gradeLevels.map(g => [g.name, g.id]));

  const sectionCount = await prisma.section.count();
  if (sectionCount === 0) {
    await prisma.section.createMany({
      data: [
        { id: "sec-a-pg",   name: "A", classId: classIdByGrade["Playgroup"],         capacity: 25, teacherName: "Ms. Fatima Ahmed" },
        { id: "sec-b-pg",   name: "B", classId: classIdByGrade["Playgroup"],         capacity: 25, teacherName: "Ms. Sana Tariq" },
        { id: "sec-a-nur",  name: "A", classId: classIdByGrade["Nursery"],           capacity: 30, teacherName: "Ms. Ayesha Khan" },
        { id: "sec-a-prep", name: "A", classId: classIdByGrade["Prep"],              capacity: 30, teacherName: "Ms. Hira Batool" },
        { id: "sec-a-1",    name: "A", classId: classIdByGrade["Grade 1"],           capacity: 35, teacherName: "Mr. Usman Ali" },
        { id: "sec-b-1",    name: "B", classId: classIdByGrade["Grade 1"],           capacity: 35, teacherName: "Ms. Nadia Javed" },
        { id: "sec-a-2",    name: "A", classId: classIdByGrade["Grade 2"],           capacity: 35, teacherName: "Mr. Bilal Hassan" },
        { id: "sec-b-2",    name: "B", classId: classIdByGrade["Grade 2"],           capacity: 35, teacherName: "Ms. Samina Rashid" },
        { id: "sec-a-3",    name: "A", classId: classIdByGrade["Grade 3"],           capacity: 35, teacherName: "Mr. Imran Sheikh" },
        { id: "sec-b-3",    name: "B", classId: classIdByGrade["Grade 3"],           capacity: 35, teacherName: "Ms. Rubina Aslam" },
        { id: "sec-a-4",    name: "A", classId: classIdByGrade["Grade 4"],           capacity: 35, teacherName: "Mr. Khalid Mahmood" },
        { id: "sec-a-5",    name: "A", classId: classIdByGrade["Grade 5"],           capacity: 35, teacherName: "Ms. Shazia Iqbal" },
        { id: "sec-a-6",    name: "A", classId: classIdByGrade["Grade 6"],           capacity: 40, teacherName: "Mr. Tariq Mehmood" },
        { id: "sec-b-6",    name: "B", classId: classIdByGrade["Grade 6"],           capacity: 40, teacherName: "Ms. Farah Naz" },
        { id: "sec-a-7",    name: "A", classId: classIdByGrade["Grade 7"],           capacity: 40, teacherName: "Mr. Javed Akhtar" },
        { id: "sec-a-8",    name: "A", classId: classIdByGrade["Grade 8"],           capacity: 40, teacherName: "Mr. Sohail Ahmed" },
        { id: "sec-b-8",    name: "B", classId: classIdByGrade["Grade 8"],           capacity: 40, teacherName: "Ms. Zainab Ali" },
        { id: "sec-a-9",    name: "A", classId: classIdByGrade["Grade 9"],           capacity: 45, teacherName: "Mr. Naveed Anjum" },
        { id: "sec-a-10",   name: "A", classId: classIdByGrade["Grade 10 (Matric)"], capacity: 45, teacherName: "Mr. Asif Raza" },
        { id: "sec-b-10",   name: "B", classId: classIdByGrade["Grade 10 (Matric)"], capacity: 45, teacherName: "Ms. Tabassum Jabeen" },
      ],
    });
    console.log("Sections seeded");
  }

  const subjectCount = await prisma.subject.count();
  if (subjectCount === 0) {
    await prisma.subject.createMany({
      data: [
        { id: "sub-eng", name: "English",         code: "ENG",  gradeLevel: "All",       teacherName: "", isElective: false },
        { id: "sub-urd", name: "Urdu",            code: "URD",  gradeLevel: "All",       teacherName: "", isElective: false },
        { id: "sub-math",name: "Mathematics",     code: "MATH", gradeLevel: "All",       teacherName: "", isElective: false },
        { id: "sub-sci", name: "General Science", code: "SCI",  gradeLevel: "All",       teacherName: "", isElective: false },
        { id: "sub-sst", name: "Social Studies",  code: "SST",  gradeLevel: "All",       teacherName: "", isElective: false },
        { id: "sub-isl", name: "Islamiat",        code: "ISL",  gradeLevel: "All",       teacherName: "", isElective: false },
        { id: "sub-com", name: "Computer Science",code: "COM",  gradeLevel: "Grade 6+", teacherName: "", isElective: true  },
        { id: "sub-phy", name: "Physics",         code: "PHY",  gradeLevel: "Grade 9+", teacherName: "", isElective: false },
        { id: "sub-chem",name: "Chemistry",       code: "CHEM", gradeLevel: "Grade 9+", teacherName: "", isElective: false },
        { id: "sub-bio", name: "Biology",         code: "BIO",  gradeLevel: "Grade 9+", teacherName: "", isElective: false },
        { id: "sub-pst", name: "Pakistan Studies",code: "PST",  gradeLevel: "Grade 9+", teacherName: "", isElective: false },
        { id: "sub-draw",name: "Drawing & Art",   code: "ART",  gradeLevel: "Primary",  teacherName: "", isElective: true  },
        { id: "sub-qur", name: "Quran / Nazra",   code: "QUR",  gradeLevel: "All",       teacherName: "", isElective: false },
        { id: "sub-ara", name: "Arabic",          code: "ARA",  gradeLevel: "Grade 6+", teacherName: "", isElective: true  },
      ],
    });
    console.log("Subjects seeded");
  }

  const feeCatCount = await prisma.feeCategory.count();
  if (feeCatCount === 0) {
    await prisma.feeCategory.createMany({
      data: [
        { id: "fc-tuition",   name: "Monthly Tuition",    description: "Standard monthly tuition fee",        defaultAmount: 8500,  frequency: "monthly",   isActive: true },
        { id: "fc-admission", name: "Admission Fee",      description: "One-time admission fee",              defaultAmount: 25000, frequency: "one-time",  isActive: true },
        { id: "fc-exam",      name: "Examination Fee",    description: "Per-term exam fee",                   defaultAmount: 3000,  frequency: "quarterly", isActive: true },
        { id: "fc-sports",    name: "Sports & Co-curricular", description: "Annual sports fee",              defaultAmount: 4000,  frequency: "annually",  isActive: true },
        { id: "fc-lab",       name: "Computer Lab Fee",   description: "Monthly lab charges",                 defaultAmount: 1500,  frequency: "monthly",   isActive: true },
        { id: "fc-transport", name: "Transport Fee",      description: "Monthly transport charges",           defaultAmount: 6000,  frequency: "monthly",   isActive: true },
        { id: "fc-library",   name: "Library Fee",        description: "Annual library membership",           defaultAmount: 2000,  frequency: "annually",  isActive: true },
        { id: "fc-hostel",    name: "Hostel & Boarding",  description: "Monthly hostel charges",              defaultAmount: 15000, frequency: "monthly",   isActive: true },
        { id: "fc-late",      name: "Late Fee Fine",      description: "Penalty for late payment",            defaultAmount: 500,   frequency: "monthly",   isActive: true },
        { id: "fc-other",     name: "Miscellaneous",      description: "Other charges",                       defaultAmount: 1000,  frequency: "one-time",  isActive: true },
      ],
    });
    console.log("Fee categories seeded");
  }

  const studentCount = await prisma.student.count();
  if (studentCount === 0) {
    const students = [
      { id: "stu-100", name: "Ahmed Ali Khan",     admissionNumber: "STU-2026-001", class: "Playgroup",         section: "A", parentName: "Mr. Ali Khan",        status: "Active", parentEmail: "ali.khan@email.com",       email: "ahmed.ali.khan@educators.pk" },
      { id: "stu-101", name: "Fatima Zahra",        admissionNumber: "STU-2026-002", class: "Playgroup",         section: "A", parentName: "Mr. Hassan Zahra",    status: "Active", parentEmail: "hassan.zahra@email.com",    email: "fatima.zahra@educators.pk" },
      { id: "stu-102", name: "Muhammad Usman",      admissionNumber: "STU-2026-003", class: "Playgroup",         section: "B", parentName: "Mr. Tariq Usman",     status: "Active", parentEmail: "tariq@email.com",           email: "muhammad.usman@educators.pk" },
      { id: "stu-103", name: "Ayesha Bibi",         admissionNumber: "STU-2026-004", class: "Nursery",           section: "A", parentName: "Mr. Rashid Ahmed",    status: "Active", parentEmail: "rashid@email.com",          email: "ayesha.bibi@educators.pk" },
      { id: "stu-104", name: "Hassan Raza",         admissionNumber: "STU-2026-005", class: "Nursery",           section: "A", parentName: "Mr. Javed Raza",      status: "Active", parentEmail: "javed@email.com",           email: "hassan.raza@educators.pk" },
      { id: "stu-105", name: "Sana Tariq",          admissionNumber: "STU-2026-006", class: "Prep",              section: "A", parentName: "Mr. Tariq Mehmood",   status: "Active", parentEmail: "tariq.mehmood@email.com",   email: "sana.tariq@educators.pk" },
      { id: "stu-106", name: "Ali Haider",          admissionNumber: "STU-2026-007", class: "Grade 1",           section: "A", parentName: "Mr. Haider Ali",      status: "Active", parentEmail: "haider@email.com",          email: "ali.haider@educators.pk" },
      { id: "stu-107", name: "Hira Batool",         admissionNumber: "STU-2026-008", class: "Grade 1",           section: "A", parentName: "Mr. Asif Batool",     status: "Active", parentEmail: "asif@email.com",            email: "hira.batool@educators.pk" },
      { id: "stu-108", name: "Bilal Ahmed",         admissionNumber: "STU-2026-009", class: "Grade 1",           section: "B", parentName: "Mr. Ahmed Khan",      status: "Active", parentEmail: "ahmed.khan@email.com",      email: "bilal.ahmed@educators.pk" },
      { id: "stu-109", name: "Sadia Noor",          admissionNumber: "STU-2026-010", class: "Grade 1",           section: "B", parentName: "Mr. Noor Hussain",    status: "Active", parentEmail: "noor@email.com",             email: "sadia.noor@educators.pk" },
      { id: "stu-110", name: "Kamran Akhtar",       admissionNumber: "STU-2026-011", class: "Grade 2",           section: "A", parentName: "Mr. Akhtar Ali",      status: "Active", parentEmail: "akhtar@email.com",           email: "kamran.akhtar@educators.pk" },
      { id: "stu-111", name: "Nadia Javed",         admissionNumber: "STU-2026-012", class: "Grade 2",           section: "A", parentName: "Mr. Javed Iqbal",     status: "Active", parentEmail: "javed.iqbal@email.com",      email: "nadia.javed@educators.pk" },
      { id: "stu-112", name: "Omar Farooq",         admissionNumber: "STU-2026-013", class: "Grade 2",           section: "B", parentName: "Mr. Farooq Ahmed",    status: "Active", parentEmail: "farooq@email.com",           email: "omar.farooq@educators.pk" },
      { id: "stu-113", name: "Rabia Basri",         admissionNumber: "STU-2026-014", class: "Grade 2",           section: "B", parentName: "Mr. Basri Khan",      status: "Active", parentEmail: "basri@email.com",            email: "rabia.basri@educators.pk" },
      { id: "stu-114", name: "Shahid Afridi",       admissionNumber: "STU-2026-015", class: "Grade 3",           section: "A", parentName: "Mr. Afridi Khan",     status: "Active", parentEmail: "afridi@email.com",           email: "shahid.afridi@educators.pk" },
      { id: "stu-115", name: "Tahira Yasmin",       admissionNumber: "STU-2026-016", class: "Grade 3",           section: "A", parentName: "Mr. Yasmin Ali",      status: "Active", parentEmail: "yasmin@email.com",           email: "tahira.yasmin@educators.pk" },
      { id: "stu-116", name: "Imran Nazir",         admissionNumber: "STU-2026-017", class: "Grade 3",           section: "B", parentName: "Mr. Nazir Ahmed",     status: "Active", parentEmail: "nazir@email.com",            email: "imran.nazir@educators.pk" },
      { id: "stu-117", name: "Zainab Ali",          admissionNumber: "STU-2026-018", class: "Grade 4",           section: "A", parentName: "Mr. Ali Raza",        status: "Active", parentEmail: "ali.raza@email.com",         email: "zainab.ali@educators.pk" },
      { id: "stu-118", name: "Khalid Masood",       admissionNumber: "STU-2026-019", class: "Grade 4",           section: "A", parentName: "Mr. Masood Ahmed",    status: "Active", parentEmail: "masood@email.com",           email: "khalid.masood@educators.pk" },
      { id: "stu-119", name: "Farah Iqbal",         admissionNumber: "STU-2026-020", class: "Grade 5",           section: "A", parentName: "Mr. Iqbal Hussain",   status: "Active", parentEmail: "iqbal@email.com",            email: "farah.iqbal@educators.pk" },
      { id: "stu-120", name: "Junaid Jamshed",      admissionNumber: "STU-2026-021", class: "Grade 5",           section: "A", parentName: "Mr. Jamshed Ali",     status: "Active", parentEmail: "jamshed@email.com",          email: "junaid.jamshed@educators.pk" },
      { id: "stu-121", name: "Maria Rashid",        admissionNumber: "STU-2026-022", class: "Grade 6",           section: "A", parentName: "Mr. Rashid Mehmood",  status: "Active", parentEmail: "rashid.mehmood@email.com",   email: "maria.rashid@educators.pk" },
      { id: "stu-122", name: "Ahsan Raza",          admissionNumber: "STU-2026-023", class: "Grade 6",           section: "A", parentName: "Mr. Raza Hussain",     status: "Active", parentEmail: "raza@email.com",             email: "ahsan.raza@educators.pk" },
      { id: "stu-123", name: "Saba Javed",          admissionNumber: "STU-2026-024", class: "Grade 6",           section: "B", parentName: "Mr. Javed Bashir",    status: "Active", parentEmail: "javed.bashir@email.com",     email: "saba.javed@educators.pk" },
      { id: "stu-124", name: "Naveed Alam",         admissionNumber: "STU-2026-025", class: "Grade 6",           section: "B", parentName: "Mr. Alam Khan",       status: "Active", parentEmail: "alam@email.com",             email: "naveed.alam@educators.pk" },
      { id: "stu-125", name: "Parveen Akhtar",      admissionNumber: "STU-2026-026", class: "Grade 7",           section: "A", parentName: "Mr. Akhtar Mehmood",  status: "Active", parentEmail: "akhtar.mehmood@email.com",   email: "parveen.akhtar@educators.pk" },
      { id: "stu-126", name: "Asif Mehmood",        admissionNumber: "STU-2026-027", class: "Grade 7",           section: "A", parentName: "Mr. Mehmood Ali",     status: "Active", parentEmail: "mehmood@email.com",          email: "asif.mehmood@educators.pk" },
      { id: "stu-127", name: "Rubina Aslam",        admissionNumber: "STU-2026-028", class: "Grade 8",           section: "A", parentName: "Mr. Aslam Khan",      status: "Active", parentEmail: "aslam@email.com",            email: "rubina.aslam@educators.pk" },
      { id: "stu-128", name: "Shahbaz Ahmed",       admissionNumber: "STU-2026-029", class: "Grade 8",           section: "A", parentName: "Mr. Ahmed Nawaz",     status: "Active", parentEmail: "ahmed.nawaz@email.com",      email: "shahbaz.ahmed@educators.pk" },
      { id: "stu-129", name: "Tasneem Fatima",      admissionNumber: "STU-2026-030", class: "Grade 8",           section: "B", parentName: "Mr. Fatima Khan",     status: "Active", parentEmail: "fatima.khan@email.com",      email: "tasneem.fatima@educators.pk" },
      { id: "stu-130", name: "Waqas Ali",           admissionNumber: "STU-2026-031", class: "Grade 8",           section: "B", parentName: "Mr. Ali Rizvi",       status: "Active", parentEmail: "ali.rizvi@email.com",        email: "waqas.ali@educators.pk" },
      { id: "stu-131", name: "Zeeshan Haider",      admissionNumber: "STU-2026-032", class: "Grade 9",           section: "A", parentName: "Mr. Haider Abbas",    status: "Active", parentEmail: "haider.abbas@email.com",     email: "zeeshan.haider@educators.pk" },
      { id: "stu-132", name: "Amina Tariq",         admissionNumber: "STU-2026-033", class: "Grade 9",           section: "A", parentName: "Mr. Tariq Javed",     status: "Active", parentEmail: "tariq.javed@email.com",      email: "amina.tariq@educators.pk" },
      { id: "stu-133", name: "Babar Azam",          admissionNumber: "STU-2026-034", class: "Grade 10 (Matric)", section: "A", parentName: "Mr. Azam Khan",       status: "Active", parentEmail: "azam@email.com",             email: "babar.azam@educators.pk" },
      { id: "stu-134", name: "Dania Hashmi",        admissionNumber: "STU-2026-035", class: "Grade 10 (Matric)", section: "A", parentName: "Mr. Hashmi Raza",     status: "Active", parentEmail: "hashmi@email.com",           email: "dania.hashmi@educators.pk" },
      { id: "stu-135", name: "Faisal Mushtaq",      admissionNumber: "STU-2026-036", class: "Grade 10 (Matric)", section: "B", parentName: "Mr. Mushtaq Ahmed",   status: "Active", parentEmail: "mushtaq@email.com",          email: "faisal.mushtaq@educators.pk" },
      { id: "stu-136", name: "Ghulam Hussain",      admissionNumber: "STU-2026-037", class: "Grade 10 (Matric)", section: "B", parentName: "Mr. Hussain Ali",     status: "Active", parentEmail: "hussain@email.com",          email: "ghulam.hussain@educators.pk" },
      { id: "stu-137", name: "Hina Khawaja",        admissionNumber: "STU-2026-038", class: "Grade 10 (Matric)", section: "B", parentName: "Mr. Khawaja Nadeem",  status: "Active", parentEmail: "khawaja@email.com",          email: "hina.khawaja@educators.pk" },
      { id: "stu-138", name: "Irfan Malik",         admissionNumber: "STU-2026-039", class: "Grade 10 (Matric)", section: "B", parentName: "Mr. Malik Riaz",      status: "Active", parentEmail: "malik@email.com",            email: "irfan.malik@educators.pk" },
      { id: "stu-139", name: "Javeria Siddiqui",    admissionNumber: "STU-2026-040", class: "Grade 10 (Matric)", section: "A", parentName: "Mr. Siddiqui Ahmed",  status: "Active", parentEmail: "siddiqui@email.com",         email: "javeria.siddiqui@educators.pk" },
      // ── 40 new students (stu-140 → stu-179) ──
      { id: "stu-140", name: "Danish Tariq",        admissionNumber: "STU-2026-041", class: "Playgroup",         section: "A", parentName: "Mr. Tariq Hussain",    status: "Active", parentEmail: "tariq.hussain@email.com",    email: "danish.tariq@educators.pk" },
      { id: "stu-141", name: "Areeba Fatima",        admissionNumber: "STU-2026-042", class: "Playgroup",         section: "B", parentName: "Mr. Fatima Ali",        status: "Active", parentEmail: "fatima.ali@email.com",       email: "areeba.fatima@educators.pk" },
      { id: "stu-142", name: "Hamza Shahid",         admissionNumber: "STU-2026-043", class: "Nursery",           section: "A", parentName: "Mr. Shahid Nawaz",      status: "Active", parentEmail: "shahid.nawaz@email.com",     email: "hamza.shahid@educators.pk" },
      { id: "stu-143", name: "Maham Riaz",           admissionNumber: "STU-2026-044", class: "Nursery",           section: "A", parentName: "Mr. Riaz Ahmed",        status: "Active", parentEmail: "riaz.ahmed@email.com",       email: "maham.riaz@educators.pk" },
      { id: "stu-144", name: "Usama Bin Zaid",       admissionNumber: "STU-2026-045", class: "Prep",              section: "A", parentName: "Mr. Zaid Haroon",       status: "Active", parentEmail: "zaid.haroon@email.com",      email: "usama.binzaid@educators.pk" },
      { id: "stu-145", name: "Ismat Aara",           admissionNumber: "STU-2026-046", class: "Grade 1",           section: "A", parentName: "Mr. Haroon Jahangir",   status: "Active", parentEmail: "haroon.j@email.com",         email: "ismat.aara@educators.pk" },
      { id: "stu-146", name: "Saad Dastgir",         admissionNumber: "STU-2026-047", class: "Grade 1",           section: "B", parentName: "Mr. Dastgir Khan",      status: "Active", parentEmail: "dastgir@email.com",          email: "saad.dastgir@educators.pk" },
      { id: "stu-147", name: "Warda Asad",           admissionNumber: "STU-2026-048", class: "Grade 2",           section: "A", parentName: "Mr. Asad Mehmood",      status: "Active", parentEmail: "asad.mehmood@email.com",     email: "warda.asad@educators.pk" },
      { id: "stu-148", name: "Bilal Malik",          admissionNumber: "STU-2026-049", class: "Grade 2",           section: "B", parentName: "Mr. Malik Shafiq",      status: "Active", parentEmail: "malik.shafiq@email.com",     email: "bilal.malik@educators.pk" },
      { id: "stu-149", name: "Zara Qureshi",         admissionNumber: "STU-2026-050", class: "Grade 3",           section: "A", parentName: "Mr. Qureshi Sajjad",    status: "Active", parentEmail: "qureshi.sajjad@email.com",   email: "zara.qureshi@educators.pk" },
      { id: "stu-150", name: "Shoaib Naveed",        admissionNumber: "STU-2026-051", class: "Grade 3",           section: "B", parentName: "Mr. Naveed Baloch",     status: "Active", parentEmail: "naveed.baloch@email.com",    email: "shoaib.naveed@educators.pk" },
      { id: "stu-151", name: "Mahnoor Zia",          admissionNumber: "STU-2026-052", class: "Grade 4",           section: "A", parentName: "Mr. Zia Ullah",         status: "Active", parentEmail: "zia.ullah@email.com",        email: "mahnoor.zia@educators.pk" },
      { id: "stu-152", name: "Affan Siddiqui",       admissionNumber: "STU-2026-053", class: "Grade 4",           section: "A", parentName: "Mr. Siddiqui Rehman",   status: "Active", parentEmail: "siddiqui.rehman@email.com",  email: "affan.siddiqui@educators.pk" },
      { id: "stu-153", name: "Neha Parveen",         admissionNumber: "STU-2026-054", class: "Grade 5",           section: "A", parentName: "Mr. Parveen Akhtar",    status: "Active", parentEmail: "parveen.akhtar@email.com",   email: "neha.parveen@educators.pk" },
      { id: "stu-154", name: "Rehan Ghaffar",        admissionNumber: "STU-2026-055", class: "Grade 5",           section: "A", parentName: "Mr. Ghaffar Shah",      status: "Active", parentEmail: "ghaffar.shah@email.com",     email: "rehan.ghaffar@educators.pk" },
      { id: "stu-155", name: "Saima Kausar",         admissionNumber: "STU-2026-056", class: "Grade 6",           section: "A", parentName: "Mr. Kausar Javed",      status: "Active", parentEmail: "kausar.javed@email.com",     email: "saima.kausar@educators.pk" },
      { id: "stu-156", name: "Talha Bilal",          admissionNumber: "STU-2026-057", class: "Grade 6",           section: "A", parentName: "Mr. Bilal Anwar",       status: "Active", parentEmail: "bilal.anwar@email.com",      email: "talha.bilal@educators.pk" },
      { id: "stu-157", name: "Hira Noor",            admissionNumber: "STU-2026-058", class: "Grade 6",           section: "B", parentName: "Mr. Noor Amin",         status: "Active", parentEmail: "noor.amin@email.com",        email: "hira.noor@educators.pk" },
      { id: "stu-158", name: "Abrar Ul Haq",         admissionNumber: "STU-2026-059", class: "Grade 6",           section: "B", parentName: "Mr. Haq Nawaz",         status: "Active", parentEmail: "haq.nawaz@email.com",        email: "abrar.ulhaq@educators.pk" },
      { id: "stu-159", name: "Fizza Amir",           admissionNumber: "STU-2026-060", class: "Grade 7",           section: "A", parentName: "Mr. Amir Shehzad",      status: "Active", parentEmail: "amir.shehzad@email.com",     email: "fizza.amir@educators.pk" },
      { id: "stu-160", name: "Usman Ghani",          admissionNumber: "STU-2026-061", class: "Grade 7",           section: "A", parentName: "Mr. Ghani Bakhsh",      status: "Active", parentEmail: "ghani.bakhsh@email.com",     email: "usman.ghani@educators.pk" },
      { id: "stu-161", name: "Rabail Faisal",        admissionNumber: "STU-2026-062", class: "Grade 8",           section: "A", parentName: "Mr. Faisal Qadir",      status: "Active", parentEmail: "faisal.qadir@email.com",     email: "rabail.faisal@educators.pk" },
      { id: "stu-162", name: "Adnan Raza",           admissionNumber: "STU-2026-063", class: "Grade 8",           section: "A", parentName: "Mr. Raza Kazim",        status: "Active", parentEmail: "raza.kazim@email.com",       email: "adnan.raza@educators.pk" },
      { id: "stu-163", name: "Ayesha Siddiqa",       admissionNumber: "STU-2026-064", class: "Grade 8",           section: "B", parentName: "Mr. Siddiqa Bashir",    status: "Active", parentEmail: "siddiqa.bashir@email.com",   email: "ayesha.siddiqa@educators.pk" },
      { id: "stu-164", name: "Saif Ullah",           admissionNumber: "STU-2026-065", class: "Grade 8",           section: "B", parentName: "Mr. Ullah Kareem",      status: "Active", parentEmail: "ullah.kareem@email.com",     email: "saif.ullah@educators.pk" },
      { id: "stu-165", name: "Momina Arshad",        admissionNumber: "STU-2026-066", class: "Grade 9",           section: "A", parentName: "Mr. Arshad Jilani",     status: "Active", parentEmail: "arshad.jilani@email.com",    email: "momina.arshad@educators.pk" },
      { id: "stu-166", name: "Hasnain Ali Rizvi",    admissionNumber: "STU-2026-067", class: "Grade 9",           section: "A", parentName: "Mr. Rizvi Husain",      status: "Active", parentEmail: "rizvi.husain@email.com",     email: "hasnain.rizvi@educators.pk" },
      { id: "stu-167", name: "Sanaullah Qureshi",    admissionNumber: "STU-2026-068", class: "Grade 10 (Matric)", section: "A", parentName: "Mr. Qureshi Tariq",     status: "Active", parentEmail: "qureshi.tariq@email.com",    email: "sanaullah.qureshi@educators.pk" },
      { id: "stu-168", name: "Mishaal Khan",         admissionNumber: "STU-2026-069", class: "Grade 10 (Matric)", section: "A", parentName: "Mr. Khan Shujaat",      status: "Active", parentEmail: "khan.shujaat@email.com",     email: "mishaal.khan@educators.pk" },
      { id: "stu-169", name: "Fahad Mehmood",        admissionNumber: "STU-2026-070", class: "Grade 10 (Matric)", section: "B", parentName: "Mr. Mehmood Saeed",     status: "Active", parentEmail: "mehmood.saeed@email.com",    email: "fahad.mehmood@educators.pk" },
      { id: "stu-170", name: "Sundas Rehman",        admissionNumber: "STU-2026-071", class: "Grade 10 (Matric)", section: "B", parentName: "Mr. Rehman Aziz",       status: "Active", parentEmail: "rehman.aziz@email.com",      email: "sundas.rehman@educators.pk" },
      { id: "stu-171", name: "Aqib Javed",           admissionNumber: "STU-2026-072", class: "Playgroup",         section: "A", parentName: "Mr. Javed Akram",       status: "Active", parentEmail: "javed.akram@email.com",      email: "aqib.javed@educators.pk" },
      { id: "stu-172", name: "Fatima Noor",          admissionNumber: "STU-2026-073", class: "Nursery",           section: "A", parentName: "Mr. Noor-ul-Amin",      status: "Active", parentEmail: "noor.ulamin@email.com",      email: "fatima.noor@educators.pk" },
      { id: "stu-173", name: "Kamal Haider",         admissionNumber: "STU-2026-074", class: "Grade 1",           section: "A", parentName: "Mr. Haider Farooq",     status: "Active", parentEmail: "haider.farooq@email.com",    email: "kamal.haider@educators.pk" },
      { id: "stu-174", name: "Nida Zehra",           admissionNumber: "STU-2026-075", class: "Grade 2",           section: "B", parentName: "Mr. Zehra Naqvi",       status: "Active", parentEmail: "zehra.naqvi@email.com",      email: "nida.zehra@educators.pk" },
      { id: "stu-175", name: "Osama Bin Farooq",     admissionNumber: "STU-2026-076", class: "Grade 3",           section: "A", parentName: "Mr. Farooq Zaman",      status: "Active", parentEmail: "farooq.zaman@email.com",     email: "osama.farooq@educators.pk" },
      { id: "stu-176", name: "Rida Fatima",          admissionNumber: "STU-2026-077", class: "Grade 4",           section: "A", parentName: "Mr. Fatima Baig",       status: "Active", parentEmail: "fatima.baig@email.com",      email: "rida.fatima@educators.pk" },
      { id: "stu-177", name: "Subhan Allauddin",     admissionNumber: "STU-2026-078", class: "Grade 5",           section: "A", parentName: "Mr. Allauddin Sheikh",  status: "Active", parentEmail: "allauddin.sheikh@email.com", email: "subhan.allauddin@educators.pk" },
      { id: "stu-178", name: "Tooba Kamal",          admissionNumber: "STU-2026-079", class: "Grade 6",           section: "A", parentName: "Mr. Kamal Hussain",     status: "Active", parentEmail: "kamal.hussain@email.com",    email: "tooba.kamal@educators.pk" },
      { id: "stu-179", name: "Waleed Khan",          admissionNumber: "STU-2026-080", class: "Grade 7",           section: "A", parentName: "Mr. Khan Habibullah",   status: "Active", parentEmail: "khan.habibullah@email.com",  email: "waleed.khan@educators.pk" },
    ];

    for (const s of students) {
      await prisma.student.create({ data: s });
    }

    const feeStudents = students.slice(0, 80);
    const months = ["April", "May", "June", "July", "August", "September"];
    const statuses: ("Paid" | "Unpaid" | "Overdue" | "Partial")[] = ["Paid", "Unpaid", "Overdue", "Partial"];

    for (let fi = 0; fi < feeStudents.length; fi++) {
      const s = feeStudents[fi];
      for (let mi = 0; mi < months.length; mi++) {
        const month = months[mi];
        const statusIdx = (fi * 7 + mi * 3) % 3;
        const status = statuses[statusIdx];
        const day = 5 + ((fi * 7 + mi * 3) % 5);
        const monthNum = String(4 + mi).padStart(2, "0");
        await prisma.feeRecord.create({
          data: {
            id: `fee-${s.id}-${month}`,
            studentId: s.id,
            studentName: s.name,
            amount: 7800,
            dueDate: `2026-${monthNum}-10`,
            status,
            voucherId: `VCH-2026-${String(1000 + fi)}`,
            paymentMethod: status === "Paid" ? "Cash" : undefined,
            paymentDate: status === "Paid" ? `2026-${monthNum}-${String(day).padStart(2, "0")}` : undefined,
          },
        });
      }
    }

    for (let si = 0; si < 80; si++) {
      const s = students[si];
      for (let day = 1; day <= 25; day++) {
        const date = `2026-04-${String(day).padStart(2, "0")}`;
        const statusesArr: ("Present" | "Absent" | "Late")[] = ["Present", "Present", "Present", "Present", "Present", "Absent", "Late"];
        const statusIdx = (si * 7 + day * 3) % statusesArr.length;
        const status = statusesArr[statusIdx];
        await prisma.attendance.create({
          data: {
            id: `att-${s.id}-${day}`,
            studentId: s.id,
            studentName: s.name,
            class: s.class,
            section: s.section,
            date,
            status,
          },
        });
      }
    }

    console.log("Students, fee records & attendance seeded");
  }

  const examCount = await prisma.exam.count();
  if (examCount === 0) {
    await prisma.exam.createMany({
      data: [
        {
          id: "exam-mt-6",
          examName: "Mid Term 2026",
          subject: "Mathematics",
          className: "Grade 6",
          date: "2026-05-15",
          commonStrengths: "Geometry concepts well understood",
          commonWeaknesses: "Fraction operations need improvement",
          studentResults: [
            { studentId: "stu-121", studentName: "Maria Rashid", score: 82, detailedBreakdown: "Algebra: 25/30, Geometry: 20/20, Fractions: 37/50", recommendations: "Improve fraction operations" },
            { studentId: "stu-122", studentName: "Ahsan Raza", score: 68, detailedBreakdown: "Algebra: 20/30, Geometry: 15/20, Fractions: 33/50", recommendations: "Practice algebraic expressions" },
            { studentId: "stu-123", studentName: "Saba Javed", score: 91, detailedBreakdown: "Algebra: 28/30, Geometry: 18/20, Fractions: 45/50", recommendations: "" },
            { studentId: "stu-124", studentName: "Naveed Alam", score: 55, detailedBreakdown: "Algebra: 15/30, Geometry: 12/20, Fractions: 28/50", recommendations: "Needs remedial classes" },
          ] as any,
          published: true,
        },
        {
          id: "exam-mt-sci-6",
          examName: "Mid Term 2026",
          subject: "General Science",
          className: "Grade 6",
          date: "2026-05-17",
          commonStrengths: "Chemistry practicals",
          commonWeaknesses: "Biology diagrams",
          studentResults: [
            { studentId: "stu-121", studentName: "Maria Rashid", score: 78, detailedBreakdown: "Biology: 30/40, Physics: 28/35, Chemistry: 20/25", recommendations: "" },
            { studentId: "stu-122", studentName: "Ahsan Raza", score: 72, detailedBreakdown: "Biology: 28/40, Physics: 25/35, Chemistry: 19/25", recommendations: "Focus on biology concepts" },
            { studentId: "stu-123", studentName: "Saba Javed", score: 88, detailedBreakdown: "Biology: 35/40, Physics: 30/35, Chemistry: 23/25", recommendations: "" },
            { studentId: "stu-124", studentName: "Naveed Alam", score: 45, detailedBreakdown: "Biology: 18/40, Physics: 15/35, Chemistry: 12/25", recommendations: "Needs extra tutoring" },
          ] as any,
          published: true,
        },
        {
          id: "exam-mt-10",
          examName: "Mid Term 2026",
          subject: "Physics",
          className: "Grade 10 (Matric)",
          date: "2026-05-20",
          commonStrengths: "Optics and light",
          commonWeaknesses: "Mechanics numerical problems",
          studentResults: [
            { studentId: "stu-133", studentName: "Babar Azam", score: 88, detailedBreakdown: "Mechanics: 35/40, Optics: 28/30, Electricity: 25/30", recommendations: "" },
            { studentId: "stu-134", studentName: "Dania Hashmi", score: 92, detailedBreakdown: "Mechanics: 38/40, Optics: 30/30, Electricity: 24/30", recommendations: "Excellent work" },
            { studentId: "stu-135", studentName: "Faisal Mushtaq", score: 65, detailedBreakdown: "Mechanics: 25/40, Optics: 20/30, Electricity: 20/30", recommendations: "Focus on mechanics" },
            { studentId: "stu-136", studentName: "Ghulam Hussain", score: 71, detailedBreakdown: "Mechanics: 28/40, Optics: 22/30, Electricity: 21/30", recommendations: "Practice numericals" },
          ] as any,
          published: false,
        },
        {
          id: "exam-mt-eng-5",
          examName: "Mid Term 2026",
          subject: "English",
          className: "Grade 5",
          date: "2026-05-16",
          commonStrengths: "Vocabulary and reading comprehension",
          commonWeaknesses: "Creative writing and essay structure",
          studentResults: [
            { studentId: "stu-119", studentName: "Farah Iqbal", score: 85, detailedBreakdown: "Grammar: 28/30, Composition: 32/40, Comprehension: 25/30", recommendations: "Work on essay organization" },
            { studentId: "stu-120", studentName: "Junaid Jamshed", score: 72, detailedBreakdown: "Grammar: 22/30, Composition: 25/40, Comprehension: 25/30", recommendations: "Practice creative writing" },
            { studentId: "stu-153", studentName: "Neha Parveen", score: 90, detailedBreakdown: "Grammar: 29/30, Composition: 35/40, Comprehension: 26/30", recommendations: "" },
            { studentId: "stu-154", studentName: "Rehan Ghaffar", score: 63, detailedBreakdown: "Grammar: 18/30, Composition: 22/40, Comprehension: 23/30", recommendations: "Focus on grammar rules" },
          ] as any,
          published: true,
        },
        {
          id: "exam-mt-urd-8",
          examName: "Mid Term 2026",
          subject: "Urdu",
          className: "Grade 8",
          date: "2026-05-18",
          commonStrengths: "Prose comprehension and poetry interpretation",
          commonWeaknesses: "Essay writing and letter formatting",
          studentResults: [
            { studentId: "stu-127", studentName: "Rubina Aslam", score: 79, detailedBreakdown: "Nasar: 28/35, Nazam: 25/30, Insha: 26/35", recommendations: "Improve essay structure" },
            { studentId: "stu-128", studentName: "Shahbaz Ahmed", score: 66, detailedBreakdown: "Nasar: 22/35, Nazam: 20/30, Insha: 24/35", recommendations: "Practice Urdu letter writing" },
            { studentId: "stu-161", studentName: "Rabail Faisal", score: 88, detailedBreakdown: "Nasar: 32/35, Nazam: 28/30, Insha: 28/35", recommendations: "" },
            { studentId: "stu-162", studentName: "Adnan Raza", score: 58, detailedBreakdown: "Nasar: 20/35, Nazam: 18/30, Insha: 20/35", recommendations: "Needs remedial Urdu sessions" },
          ] as any,
          published: true,
        },
        {
          id: "exam-mt-bio-10",
          examName: "Mid Term 2026",
          subject: "Biology",
          className: "Grade 10 (Matric)",
          date: "2026-05-19",
          commonStrengths: "Cell biology and genetics",
          commonWeaknesses: "Ecology diagrams and classification",
          studentResults: [
            { studentId: "stu-133", studentName: "Babar Azam", score: 82, detailedBreakdown: "MCQs: 18/20, Short Questions: 28/40, Long Questions: 36/40", recommendations: "" },
            { studentId: "stu-134", studentName: "Dania Hashmi", score: 94, detailedBreakdown: "MCQs: 20/20, Short Questions: 36/40, Long Questions: 38/40", recommendations: "Excellent grasp of biology concepts" },
            { studentId: "stu-167", studentName: "Sanaullah Qureshi", score: 60, detailedBreakdown: "MCQs: 14/20, Short Questions: 22/40, Long Questions: 24/40", recommendations: "Revise ecology and classification" },
            { studentId: "stu-168", studentName: "Mishaal Khan", score: 75, detailedBreakdown: "MCQs: 16/20, Short Questions: 28/40, Long Questions: 31/40", recommendations: "Practice diagram-based questions" },
          ] as any,
          published: true,
        },
        {
          id: "exam-mt-math-9",
          examName: "Mid Term 2026",
          subject: "Mathematics",
          className: "Grade 9",
          date: "2026-05-21",
          commonStrengths: "Algebraic manipulation",
          commonWeaknesses: "Trigonometric identities and proofs",
          studentResults: [
            { studentId: "stu-131", studentName: "Zeeshan Haider", score: 77, detailedBreakdown: "Algebra: 28/30, Geometry: 18/25, Trigonometry: 31/45", recommendations: "Practice trigonometric proofs" },
            { studentId: "stu-132", studentName: "Amina Tariq", score: 89, detailedBreakdown: "Algebra: 29/30, Geometry: 22/25, Trigonometry: 38/45", recommendations: "" },
            { studentId: "stu-165", studentName: "Momina Arshad", score: 54, detailedBreakdown: "Algebra: 20/30, Geometry: 14/25, Trigonometry: 20/45", recommendations: "Needs extra practice in trigonometry" },
            { studentId: "stu-166", studentName: "Hasnain Ali Rizvi", score: 71, detailedBreakdown: "Algebra: 25/30, Geometry: 18/25, Trigonometry: 28/45", recommendations: "Focus on geometry proofs" },
          ] as any,
          published: true,
        },
        {
          id: "exam-mt-sci-7",
          examName: "Mid Term 2026",
          subject: "General Science",
          className: "Grade 7",
          date: "2026-05-22",
          commonStrengths: "Basic physics concepts and measurements",
          commonWeaknesses: "Chemical equations and biology diagrams",
          studentResults: [
            { studentId: "stu-125", studentName: "Parveen Akhtar", score: 81, detailedBreakdown: "Biology: 30/35, Physics: 26/35, Chemistry: 25/30", recommendations: "" },
            { studentId: "stu-126", studentName: "Asif Mehmood", score: 69, detailedBreakdown: "Biology: 25/35, Physics: 22/35, Chemistry: 22/30", recommendations: "Work on chemical equations" },
            { studentId: "stu-159", studentName: "Fizza Amir", score: 92, detailedBreakdown: "Biology: 33/35, Physics: 30/35, Chemistry: 29/30", recommendations: "Outstanding performance" },
            { studentId: "stu-160", studentName: "Usman Ghani", score: 56, detailedBreakdown: "Biology: 20/35, Physics: 18/35, Chemistry: 18/30", recommendations: "Needs remedial support in all areas" },
          ] as any,
          published: true,
        },
      ],
    });
    console.log("Exams seeded");
  }

  // ── Teacher (staff) attendance ──
  const teacherAttCount = await prisma.teacherAttendance.count({ where: { id: { startsWith: "tatt-" } } });
  if (teacherAttCount === 0) {
    const teachers = await prisma.user.findMany({ where: { role: "TEACHER" } });
    const statusesArr: ("Present" | "Absent" | "Late" | "Leave")[] = ["Present", "Present", "Present", "Present", "Present", "Late", "Absent", "Leave"];
    for (let ti = 0; ti < teachers.length; ti++) {
      const t = teachers[ti];
      for (let day = 1; day <= 25; day++) {
        const date = `2026-04-${String(day).padStart(2, "0")}`;
        const statusIdx = (ti * 5 + day * 3) % statusesArr.length;
        const status = statusesArr[statusIdx];
        await prisma.teacherAttendance.create({
          data: {
            id: `tatt-${t.id}-${day}`,
            userId: t.id,
            date,
            status,
            checkInTime: status !== "Absent" && status !== "Leave" ? new Date(`2026-04-${String(day).padStart(2, "0")}T${status === "Late" ? "08:35" : "07:55"}:00Z`) : undefined,
            checkOutTime: status !== "Absent" && status !== "Leave" ? new Date(`2026-04-${String(day).padStart(2, "0")}T14:30:00Z`) : undefined,
            source: "manual",
            markedBy: "Admin User",
          },
        });
      }
    }
    console.log("Teacher attendance seeded");
  }

  const notifCount = await prisma.notification.count();
  if (notifCount === 0) {
    await prisma.notification.createMany({
      data: [
        { title: "Fee Reminder",           message: "April tuition fee deadline is April 10th. Please submit before due date to avoid late fee.",                                                            date: "2026-04-05", recipientRole: "PARENT",  read: false },
        { title: "Mid Term Schedule",      message: "Mid Term examinations will begin from May 15th. Detailed schedule has been uploaded.",                                                                  date: "2026-05-01", recipientRole: "STUDENT", read: false },
        { title: "Staff Meeting",          message: "All teachers are requested to attend the staff meeting on Monday at 2 PM in the conference room.",                                                     date: "2026-04-08", recipientRole: "TEACHER", read: false },
        { title: "Summer Break",           message: "Summer break will start from June 20th. School will reopen on August 1st.",                                                                            date: "2026-06-01", recipientRole: "PARENT",  read: true },
        { title: "New Admission Enquiry",  message: "A new admission enquiry has been received for Grade 1. Please review the application.",                                                                date: "2026-04-03", recipientRole: "ADMIN",   read: false },
        { title: "Result Submission",      message: "All subject teachers must submit Mid Term results by May 25th.",                                                                                       date: "2026-05-10", recipientRole: "TEACHER", read: false },
        { title: "Transport Route Change", message: "Route #3 will have a changed pickup point starting next week.",                                                                                         date: "2026-04-02", recipientRole: "PARENT",  read: true },
        { title: "Parent-Teacher Meeting", message: "PTM scheduled for April 30th. Please confirm your availability.",                                                                                      date: "2026-04-15", recipientRole: "TEACHER", read: false },
        { title: "Library Due Date",       message: "Books issued on March 1st are due for return. Late fine will apply after April 10th.",                                                                 date: "2026-04-01", recipientRole: "STUDENT", read: false },
        { title: "Sports Gala",            message: "Annual Sports Gala will be held on April 25th. Students are encouraged to participate.",                                                               date: "2026-04-10", recipientRole: "STUDENT", read: true },
        { title: "Salary Disbursed",       message: "April salaries have been disbursed. Please check your bank accounts.",                                                                                 date: "2026-04-01", recipientRole: "TEACHER", read: true },
        { title: "Board Registration",     message: "Grade 9 and 10 board registration forms are due by April 20th.",                                                                                       date: "2026-04-05", recipientRole: "ADMIN",   read: false },
      ],
    });
    console.log("Notifications seeded");
  }

  // ── Announcements ──
  const annCount = await prisma.announcement.count();
  if (annCount === 0) {
    await prisma.announcement.createMany({
      data: [
        { title: "School Reopening", content: "School will reopen for the new academic year on April 1st, 2026. All students must report by 8:00 AM.", date: "2026-03-25", authorId: "1", authorName: "Admin User", targetRole: "ALL", priority: "high" },
        { title: "Uniform Update", content: "New winter uniform design has been approved. Detailed pictures have been shared with class representatives.", date: "2026-04-10", authorId: "1", authorName: "Admin User", targetRole: "PARENT", priority: "normal" },
        { title: "Science Exhibition", content: "Annual Science Exhibition will be held on May 10th. Students from Grade 6-10 are encouraged to submit their projects.", date: "2026-04-15", authorId: "1", authorName: "Admin User", targetRole: "STUDENT", targetClass: "Grade 6", priority: "normal" },
        { title: "Staff Training Workshop", content: "All teachers must attend the pedagogical skills workshop on April 20th in the auditorium.", date: "2026-04-12", authorId: "1", authorName: "Admin User", targetRole: "TEACHER", priority: "high" },
        { title: "Parent Portal Activation", content: "Parents can now access the online portal to view fee records, attendance, and exam results.", date: "2026-04-05", authorId: "1", authorName: "Admin User", targetRole: "PARENT", priority: "normal" },
        { title: "Quran Competition", content: "Annual Quran Naazra & Tajweed competition registration is open until April 25th.", date: "2026-04-08", authorId: "1", authorName: "Admin User", targetRole: "STUDENT", priority: "normal" },
        { title: "Security Drill", content: "A mandatory fire safety drill will be conducted on April 18th. All staff and students must participate.", date: "2026-04-14", authorId: "1", authorName: "Admin User", targetRole: "ALL", priority: "high" },
        { title: "Library New Arrivals", content: "New books have been added to the library including latest fiction and reference materials.", date: "2026-04-06", authorId: "1", authorName: "Admin User", targetRole: "ALL", priority: "low" },
      ],
    });
    console.log("Announcements seeded");
  }

  // ── Assignments ──
  const assignCount = await prisma.assignment.count();
  if (assignCount === 0) {
    await prisma.assignment.createMany({
      data: [
        { title: "Algebra Practice Problems", description: "Solve 20 problems from Chapter 3: Linear Equations. Show all steps.", dueDate: "2026-04-15", className: "Grade 6", subject: "Mathematics", teacherName: "Mr. Tariq Mehmood", createdAt: "2026-04-10" },
        { title: "Urdu Essay", description: "Write a 300-word essay on 'Meri Pasandida Kitab' (My Favorite Book).", dueDate: "2026-04-18", className: "Grade 6", subject: "Urdu", teacherName: "Mr. Tariq Mehmood", createdAt: "2026-04-11" },
        { title: "Science Lab Report", description: "Submit the practical lab report on plant cell observation under microscope.", dueDate: "2026-04-20", className: "Grade 7", subject: "General Science", teacherName: "Mr. Javed Akhtar", createdAt: "2026-04-12" },
        { title: "English Grammar Worksheet", description: "Complete the worksheet on tenses - past, present, and future perfect.", dueDate: "2026-04-16", className: "Grade 5", subject: "English", teacherName: "Ms. Shazia Iqbal", createdAt: "2026-04-09" },
        { title: "Physics Numericals", description: "Solve 10 numerical problems from Chapter 2: Kinematics.", dueDate: "2026-04-22", className: "Grade 10 (Matric)", subject: "Physics", teacherName: "Mr. Asif Raza", createdAt: "2026-04-13" },
        { title: "Pakistan Studies Project", description: "Prepare a project on the history of Pakistan Movement with timelines and key figures.", dueDate: "2026-04-25", className: "Grade 9", subject: "Pakistan Studies", teacherName: "Mr. Naveed Anjum", createdAt: "2026-04-10" },
        { title: "Computer Programming", description: "Write a Python program to calculate factorial, fibonacci series, and prime numbers.", dueDate: "2026-04-19", className: "Grade 8", subject: "Computer Science", teacherName: "Mr. Sohail Ahmed", createdAt: "2026-04-12" },
        { title: "Chemistry Balancing Equations", description: "Balance 25 chemical equations from the worksheet.", dueDate: "2026-04-21", className: "Grade 10 (Matric)", subject: "Chemistry", teacherName: "Mr. Asif Raza", createdAt: "2026-04-14" },
        // ── 6 new assignments ──
        { title: "Urdu Essay Writing", description: "Write a 250-word essay on 'Mera Shehar Lahore'. Use proper Urdu punctuation.", dueDate: "2026-04-23", className: "Grade 4", subject: "Urdu", teacherName: "Mr. Khalid Mahmood", createdAt: "2026-04-15" },
        { title: "Science Project - Solar System", description: "Build a working model of the solar system using thermocol and paint. Label all planets.", dueDate: "2026-04-28", className: "Grade 7", subject: "General Science", teacherName: "Mr. Javed Akhtar", createdAt: "2026-04-16" },
        { title: "Math Worksheet - Quadratic Equations", description: "Solve all 15 problems from the quadratic equations worksheet. Show complete working.", dueDate: "2026-04-24", className: "Grade 9", subject: "Mathematics", teacherName: "Mr. Naveed Anjum", createdAt: "2026-04-17" },
        { title: "History Essay - Mughal Empire", description: "Write a 400-word essay on the rise and fall of the Mughal Empire in the subcontinent.", dueDate: "2026-04-26", className: "Grade 10 (Matric)", subject: "Social Studies", teacherName: "Ms. Tabassum Jabeen", createdAt: "2026-04-18" },
        { title: "English Reading Comprehension", description: "Read the passage on pages 24-25 and answer all comprehension questions in full sentences.", dueDate: "2026-04-17", className: "Grade 3", subject: "English", teacherName: "Mr. Imran Sheikh", createdAt: "2026-04-12" },
        { title: "Art Assignment - My Family Drawing", description: "Draw a picture of your family using crayons or color pencils. Label each family member.", dueDate: "2026-04-20", className: "Grade 2", subject: "Drawing & Art", teacherName: "Mr. Bilal Hassan", createdAt: "2026-04-13" },
      ],
    });
    // Submissions for first 5 assignments
    const assignments = await prisma.assignment.findMany({ take: 5 });
    const subStudents = await prisma.student.findMany({ where: { class: "Grade 6" }, take: 4 });
    for (const a of assignments) {
      for (const s of subStudents) {
        await prisma.assignmentSubmission.create({
          data: {
            assignmentId: a.id,
            studentId: s.id,
            studentName: s.name,
            submittedAt: "2026-04-14",
            notes: "Submitted on time",
            grade: (s.id.charCodeAt(4) * 7 + a.title.charCodeAt(0)) % 4 === 0 ? undefined : ["A", "B+", "B", "C+"][((s.id.charCodeAt(4) * 7 + a.title.charCodeAt(0)) % 4)],
            feedback: (s.id.charCodeAt(4) * 3) % 2 === 0 ? "Good work, keep it up!" : undefined,
          },
        });
      }
    }
    console.log("Assignments & submissions seeded");
  }

  // ── Timetable Entries ──
  const ttCount = await prisma.timetableEntry.count();
  if (ttCount === 0) {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const periods = [
      { start: "08:00", end: "08:45" }, { start: "08:45", end: "09:30" }, { start: "09:45", end: "10:30" },
      { start: "10:30", end: "11:15" }, { start: "11:30", end: "12:15" }, { start: "12:15", end: "13:00" },
    ];
    const subjects = ["English", "Urdu", "Mathematics", "General Science", "Social Studies", "Islamiat"];
    const teachers = ["Ms. Shazia Iqbal", "Mr. Tariq Mehmood", "Mr. Javed Akhtar", "Mr. Sohail Ahmed", "Ms. Farah Naz", "Ms. Zainab Ali"];
    const rooms = ["Room 101", "Room 102", "Room 103", "Science Lab", "Computer Lab", "Room 201"];
    const entries: any[] = [];
    let ttId = 1;
    for (const day of days) {
      for (let p = 0; p < periods.length; p++) {
        entries.push({
          id: `tt-${ttId++}`,
          className: "Grade 6",
          subjectName: subjects[p % subjects.length],
          teacherName: teachers[p % teachers.length],
          dayOfWeek: day,
          startTime: periods[p].start,
          endTime: periods[p].end,
          room: rooms[p % rooms.length],
        });
      }
    }
    // Add Grade 10 timetable
    for (const day of days) {
      const g10subjects = ["English", "Urdu", "Mathematics", "Physics", "Chemistry", "Biology"];
      for (let p = 0; p < periods.length; p++) {
        entries.push({
          id: `tt-${ttId++}`,
          className: "Grade 10 (Matric)",
          subjectName: g10subjects[p % g10subjects.length],
          teacherName: ["Mr. Asif Raza", "Ms. Tabassum Jabeen", "Mr. Naveed Anjum", "Mr. Asif Raza", "Ms. Tabassum Jabeen", "Mr. Naveed Anjum"][p],
          dayOfWeek: day,
          startTime: periods[p].start,
          endTime: periods[p].end,
          room: ["Room 301", "Room 302", "Room 303", "Physics Lab", "Chemistry Lab", "Room 304"][p],
        });
      }
    }
    await prisma.timetableEntry.createMany({ data: entries });
    console.log("Timetable entries seeded");
  }

  // ── Academic Core (Relational) ──
  const ayCount = await prisma.academicYear.count();
  if (ayCount === 0) {
    await prisma.academicYear.createMany({
      data: [
        { id: "ay-2026-27", name: "Academic Year 2026-2027", startDate: "2026-04-01", endDate: "2027-03-31", isActive: true },
        { id: "ay-2025-26", name: "Academic Year 2025-2026", startDate: "2025-04-01", endDate: "2026-03-31", isActive: false },
      ],
    });
    console.log("Academic years seeded");
  }

  const classRelCount = await prisma.class.count();
  if (classRelCount === 0) {
    const gradeLevels = ["Playgroup", "Nursery", "Prep", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10 (Matric)"];
    for (let i = 0; i < gradeLevels.length; i++) {
      await prisma.class.create({
        data: {
          id: `cls-rel-${String(i + 1).padStart(2, "0")}`,
          name: gradeLevels[i],
          gradeLevel: gradeLevels[i],
          academicYearId: "ay-2026-27",
        },
      });
    }
    console.log("Relational classes seeded");
  }

  const sectionRelCount = await prisma.section.count();
  if (sectionRelCount === 0) {
    // Fix: The existing seed creates sections with gradeLevel but Prisma schema requires classId
    // We need to delete old-style sections and create proper ones, but we check count first
    const classes = await prisma.class.findMany();
    for (const cls of classes) {
      const grp = cls.gradeLevel;
      const hasB = !["Nursery", "Prep", "Grade 4", "Grade 5", "Grade 7", "Grade 9"].includes(grp);
      await prisma.section.create({
        data: {
          id: `sec-rel-${cls.id}-a`,
          name: "A",
          capacity: 25,
          teacherName: `${grp} Section A Teacher`,
          classId: cls.id,
        },
      });
      if (hasB) {
        await prisma.section.create({
          data: {
            id: `sec-rel-${cls.id}-b`,
            name: "B",
            capacity: 25,
            teacherName: `${grp} Section B Teacher`,
            classId: cls.id,
          },
        });
      }
    }
    console.log("Relational sections seeded");
  }

  // ── Enrollments ──
  const enrollCount = await prisma.enrollment.count();
  if (enrollCount === 0) {
    const clsList = await prisma.class.findMany();
    const sectionList = await prisma.section.findMany();
    const studentList = await prisma.student.findMany();
    let rollNum = 1;
    for (const s of studentList) {
      const matchingClass = clsList.find(c => c.gradeLevel === s.class);
      const matchingSection = sectionList.find(sec => sec.classId === matchingClass?.id && sec.name === s.section);
      if (matchingClass && matchingSection) {
        await prisma.enrollment.create({
          data: {
            studentId: s.id,
            classId: matchingClass.id,
            sectionId: matchingSection.id,
            academicYearId: "ay-2026-27",
            rollNumber: rollNum++,
            status: "Active",
          },
        });
      }
    }
    console.log("Enrollments seeded");
  }

  // ── Teacher Class Subjects ──
  const tcsCount = await prisma.teacherClassSubject.count();
  if (tcsCount === 0) {
    const clsList = await prisma.class.findMany();
    const sectionList = await prisma.section.findMany();
    const subjList = await prisma.subject.findMany();
    const tcsData: any[] = [];
    let tcsId = 1;
    for (const cls of clsList) {
      const secs = sectionList.filter(s => s.classId === cls.id);
      for (const sec of secs) {
        for (const sub of subjList.slice(0, 6)) {
          tcsData.push({
            id: `tcs-${tcsId++}`,
            teacherId: 2,
            classId: cls.id,
            sectionId: sec.id,
            subjectId: sub.id,
            academicYearId: "ay-2026-27",
          });
        }
      }
    }
    await prisma.teacherClassSubject.createMany({ data: tcsData.slice(0, 50) }); // limit to 50
    console.log("Teacher class subjects seeded");
  }

  // ── Term Exams ──
  const termExamCount = await prisma.termExam.count();
  if (termExamCount === 0) {
    const clsList = await prisma.class.findMany();
    const grade6Class = clsList.find(c => c.gradeLevel === "Grade 6");
    const grade10Class = clsList.find(c => c.gradeLevel === "Grade 10 (Matric)");
    const grade8Class = clsList.find(c => c.gradeLevel === "Grade 8");
    await prisma.termExam.createMany({
      data: [
        { id: "term-exam-mt-6", name: "Mid Term 2026", examType: "MidTerm", classId: grade6Class!.id, academicYearId: "ay-2026-27", startDate: "2026-05-15", endDate: "2026-05-25", status: "Published" },
        { id: "term-exam-mt-8", name: "Mid Term 2026", examType: "MidTerm", classId: grade8Class!.id, academicYearId: "ay-2026-27", startDate: "2026-05-15", endDate: "2026-05-25", status: "Published" },
        { id: "term-exam-mt-10", name: "Mid Term 2026", examType: "MidTerm", classId: grade10Class!.id, academicYearId: "ay-2026-27", startDate: "2026-05-15", endDate: "2026-05-25", status: "Published" },
        { id: "term-exam-final-6", name: "Final Term 2026", examType: "Final", classId: grade6Class!.id, academicYearId: "ay-2026-27", startDate: "2026-09-01", endDate: "2026-09-15", status: "Scheduled" },
        { id: "term-exam-final-10", name: "Final Term 2026", examType: "Final", classId: grade10Class!.id, academicYearId: "ay-2026-27", startDate: "2026-09-01", endDate: "2026-09-15", status: "Scheduled" },
      ],
    });
    console.log("Term exams seeded");
  }

  // ── Exam Subjects ──
  const examSubjCount = await prisma.examSubject.count();
  if (examSubjCount === 0) {
    const termExams = await prisma.termExam.findMany();
    const subjList = await prisma.subject.findMany();
    const mathSubj = subjList.find(s => s.code === "MATH");
    const sciSubj = subjList.find(s => s.code === "SCI");
    const engSubj = subjList.find(s => s.code === "ENG");
    const phySubj = subjList.find(s => s.code === "PHY");
    const chemSubj = subjList.find(s => s.code === "CHEM");
    await prisma.examSubject.createMany({
      data: [
        { id: "es-mt6-math", examId: "term-exam-mt-6", subjectId: mathSubj!.id, totalMarks: 100, passingMarks: 33, teacherId: 2 },
        { id: "es-mt6-sci", examId: "term-exam-mt-6", subjectId: sciSubj!.id, totalMarks: 100, passingMarks: 33, teacherId: 2 },
        { id: "es-mt6-eng", examId: "term-exam-mt-6", subjectId: engSubj!.id, totalMarks: 100, passingMarks: 33, teacherId: 2 },
        { id: "es-mt10-phy", examId: "term-exam-mt-10", subjectId: phySubj!.id, totalMarks: 100, passingMarks: 33, teacherId: 2 },
        { id: "es-mt10-chem", examId: "term-exam-mt-10", subjectId: chemSubj!.id, totalMarks: 100, passingMarks: 33, teacherId: 2 },
        { id: "es-mt8-math", examId: "term-exam-mt-8", subjectId: mathSubj!.id, totalMarks: 100, passingMarks: 33, teacherId: 2 },
      ],
    });
    console.log("Exam subjects seeded");
  }

  // ── Marks Entries ──
  const marksCount = await prisma.marksEntry.count();
  if (marksCount === 0) {
    const examSubjects = await prisma.examSubject.findMany();
    const enrollments = await prisma.enrollment.findMany({ where: { academicYearId: "ay-2026-27" }, take: 20 });
    for (const es of examSubjects) {
      for (const enr of enrollments) {
        const marks = 40 + Math.floor(Math.random() * 60);
        let grade = "F";
        if (marks >= 90) grade = "A+";
        else if (marks >= 80) grade = "A";
        else if (marks >= 70) grade = "B";
        else if (marks >= 60) grade = "C";
        else if (marks >= 50) grade = "D";
        else if (marks >= 33) grade = "E";
        await prisma.marksEntry.create({
          data: {
            examSubjectId: es.id,
            studentId: enr.studentId,
            marksObtained: marks,
            grade,
            remarks: marks >= 80 ? "Excellent performance" : marks >= 60 ? "Good, can improve" : "Needs improvement",
          },
        });
      }
    }
    console.log("Marks entries seeded");
  }

  // ── Results ──
  const resultCount = await prisma.result.count();
  if (resultCount === 0) {
    const termExams = await prisma.termExam.findMany({ where: { status: "Published" } });
    const enrollments = await prisma.enrollment.findMany({ take: 20 });
    for (const te of termExams) {
      for (const enr of enrollments) {
        const totalMarks = 300;
        const obtained = 120 + Math.floor(Math.random() * 150);
        const percentage = (obtained / totalMarks) * 100;
        let grade = "F";
        if (percentage >= 90) grade = "A+";
        else if (percentage >= 80) grade = "A";
        else if (percentage >= 70) grade = "B";
        else if (percentage >= 60) grade = "C";
        else if (percentage >= 50) grade = "D";
        else if (percentage >= 33) grade = "E";
        await prisma.result.create({
          data: {
            examId: te.id,
            studentId: enr.studentId,
            totalMarks,
            obtainedMarks: obtained,
            percentage,
            grade,
            status: "Published",
          },
        });
      }
    }
    console.log("Results seeded");
  }

  // ── Report Cards ──
  const rcCount = await prisma.reportCard.count();
  if (rcCount === 0) {
    const enrollments = await prisma.enrollment.findMany({ take: 10 });
    for (const enr of enrollments) {
      await prisma.reportCard.create({
        data: {
          studentId: enr.studentId,
          academicYearId: "ay-2026-27",
          examResults: [{ examName: "Mid Term 2026", totalObtained: 240, totalMarks: 300, percentage: 80, subjects: [] }],
          generatedAt: "2026-06-01",
          totalPercentage: 75 + Math.random() * 20,
          overallGrade: "A",
          classPosition: Math.floor(Math.random() * 30) + 1,
          remarks: "A diligent student with good academic performance.",
        },
      });
    }
    console.log("Report cards seeded");
  }

  // ── LMS: Courses ──
  const courseCount = await prisma.course.count();
  if (courseCount === 0) {
    await prisma.course.createMany({
      data: [
        { id: "crs-eng-6", title: "English Language Arts Grade 6", code: "ENG-6", description: "Comprehensive English course covering grammar, composition, and literature for Grade 6 students following the national curriculum.", gradeLevel: "Grade 6", teacherName: "Mr. Tariq Mehmood", credits: 3, learningOutcomes: ["Master parts of speech", "Write coherent paragraphs", "Comprehend age-appropriate texts"], prerequisites: [], isActive: true },
        { id: "crs-math-6", title: "Mathematics Grade 6", code: "MATH-6", description: "Full mathematics course covering algebra, geometry, fractions, and data handling for Grade 6.", gradeLevel: "Grade 6", teacherName: "Mr. Tariq Mehmood", credits: 4, learningOutcomes: ["Solve linear equations", "Calculate area and perimeter", "Work with fractions and decimals"], prerequisites: [], isActive: true },
        { id: "crs-sci-7", title: "General Science Grade 7", code: "SCI-7", description: "Integrated science covering biology, chemistry, and physics fundamentals.", gradeLevel: "Grade 7", teacherName: "Mr. Javed Akhtar", credits: 3, learningOutcomes: ["Understand cell structure", "Basic chemical reactions", "Force and motion concepts"], prerequisites: [], isActive: true },
        { id: "crs-phy-10", title: "Physics Grade 10 (Matric)", code: "PHY-10", description: "Matric-level physics covering mechanics, optics, electricity, and modern physics.", gradeLevel: "Grade 10 (Matric)", teacherName: "Mr. Asif Raza", credits: 4, learningOutcomes: ["Solve numerical problems", "Understand laws of motion", "Apply optics principles"], prerequisites: ["SCI-9"], isActive: true },
        { id: "crs-com-8", title: "Computer Science Grade 8", code: "COM-8", description: "Introduction to programming, web development, and computational thinking.", gradeLevel: "Grade 8", teacherName: "Mr. Sohail Ahmed", credits: 2, learningOutcomes: ["Write basic Python programs", "Create simple web pages", "Understand binary logic"], prerequisites: [], isActive: true },
        { id: "crs-urd-5", title: "Urdu Language Grade 5", code: "URD-5", description: "Urdu language course focusing on grammar, essay writing, and poetry appreciation.", gradeLevel: "Grade 5", teacherName: "Ms. Shazia Iqbal", credits: 3, learningOutcomes: ["Correct grammar usage", "Write creative essays", "Appreciate Urdu poetry"], prerequisites: [], isActive: true },
      ],
    });

    // Course Materials
    const courses = await prisma.course.findMany();
    for (const c of courses) {
      await prisma.courseMaterial.createMany({
        data: [
          { id: `mat-${c.id}-1`, courseId: c.id, title: `Introduction to ${c.title}`, type: "video", url: `https://educators.edu.pk/courses/${c.id}/intro`, createdAt: "2026-04-01" },
          { id: `mat-${c.id}-2`, courseId: c.id, title: "Chapter 1 Notes", type: "document", url: `https://educators.edu.pk/courses/${c.id}/ch1`, createdAt: "2026-04-02" },
          { id: `mat-${c.id}-3`, courseId: c.id, title: "Practice Worksheet", type: "document", url: `https://educators.edu.pk/courses/${c.id}/ws1`, createdAt: "2026-04-03" },
        ],
      });
    }

    // Discussion Forums
    for (const c of courses) {
      const forum = await prisma.discussionForum.create({
        data: {
          id: `forum-${c.id}`,
          courseId: c.id,
          topic: "Welcome & Introductions",
          authorName: c.teacherName,
          content: `Welcome to ${c.title}! Please introduce yourself and share what you hope to learn this term.`,
          createdAt: "2026-04-01",
        },
      });
      await prisma.forumReply.createMany({
        data: [
          { id: `reply-${c.id}-1`, forumId: forum.id, authorName: "Student", content: "Looking forward to this course!", createdAt: "2026-04-02" },
          { id: `reply-${c.id}-2`, forumId: forum.id, authorName: c.teacherName, content: "Great to have you onboard!", createdAt: "2026-04-03" },
        ],
      });
    }

    // Online Quizzes
    for (const c of courses) {
      await prisma.onlineQuiz.create({
        data: {
          id: `quiz-${c.id}-1`,
          courseId: c.id,
          title: `${c.title} - Chapter 1 Quiz`,
          questions: [
            { id: "q1", question: "Sample question 1", options: ["A", "B", "C", "D"], correctAnswer: 0, marks: 5 },
            { id: "q2", question: "Sample question 2", options: ["A", "B", "C", "D"], correctAnswer: 1, marks: 5 },
          ],
          totalMarks: 10,
          timeLimit: 15,
          dueDate: "2026-04-30",
        },
      });
    }

    // Student Progress
    const studentsForProgress = await prisma.student.findMany({ take: 10 });
    for (const s of studentsForProgress) {
      for (const c of courses) {
        await prisma.studentProgress.create({
          data: {
            courseId: c.id,
            studentId: s.id,
            studentName: s.name,
            materialsCompleted: Math.floor(Math.random() * 3),
            totalMaterials: 3,
            quizScore: Math.floor(Math.random() * 10),
            lastAccessed: "2026-04-10",
          },
        });
      }
    }
    console.log("LMS: Courses, materials, forums, quizzes, progress seeded");
  }

  // ── Library ──
  const libBookCount = await prisma.libraryBook.count();
  if (libBookCount === 0) {
    await prisma.libraryBook.createMany({
      data: [
        { id: "book-001", title: "Pakistan: A Modern History", author: "Ian Talbot", isbn: "978-0195673731", category: "History", publisher: "Oxford University Press", publishYear: 2005, totalCopies: 5, availableCopies: 3, rackNumber: "H-01", barcode: "BAR-001", isDigital: false, digitalUrl: "", status: "Available" },
        { id: "book-002", title: "Mathematics for Class 10", author: "Punjab Textbook Board", isbn: "978-969-1234-01-5", category: "Textbook", publisher: "PTB Lahore", publishYear: 2024, totalCopies: 50, availableCopies: 45, rackNumber: "T-10", barcode: "BAR-002", isDigital: true, digitalUrl: "https://ebooks.ptb.edu.pk/math10", status: "Available" },
        { id: "book-003", title: "Physics for Class 10", author: "Punjab Textbook Board", isbn: "978-969-1234-02-2", category: "Textbook", publisher: "PTB Lahore", publishYear: 2024, totalCopies: 50, availableCopies: 48, rackNumber: "T-11", barcode: "BAR-003", isDigital: true, digitalUrl: "https://ebooks.ptb.edu.pk/phy10", status: "Available" },
        { id: "book-004", title: "The Alchemist", author: "Paulo Coelho", isbn: "978-0062315007", category: "Fiction", publisher: "HarperCollins", publishYear: 2014, totalCopies: 3, availableCopies: 1, rackNumber: "F-05", barcode: "BAR-004", isDigital: false, digitalUrl: "", status: "Available" },
        { id: "book-005", title: "Oxford English Dictionary", author: "Oxford Languages", isbn: "978-0199571123", category: "Reference", publisher: "Oxford University Press", publishYear: 2010, totalCopies: 2, availableCopies: 2, rackNumber: "R-01", barcode: "BAR-005", isDigital: true, digitalUrl: "https://www.oed.com", status: "Available" },
        { id: "book-006", title: "Urdu Adab Ki Tareekh", author: "Dr. Jameel Jalibi", isbn: "978-969-3523-01-8", category: "Literature", publisher: "Majlis-e-Taraqqi-e-Adab", publishYear: 2012, totalCopies: 4, availableCopies: 3, rackNumber: "L-03", barcode: "BAR-006", isDigital: false, digitalUrl: "", status: "Available" },
        { id: "book-007", title: "General Science Encyclopedia", author: "DK Publishing", isbn: "978-1465414171", category: "Science", publisher: "DK Children", publishYear: 2013, totalCopies: 3, availableCopies: 2, rackNumber: "S-02", barcode: "BAR-007", isDigital: false, digitalUrl: "", status: "Available" },
        { id: "book-008", title: "Computer Science: An Overview", author: "Glenn Brookshear", isbn: "978-0134875460", category: "Computer Science", publisher: "Pearson", publishYear: 2018, totalCopies: 6, availableCopies: 5, rackNumber: "CS-01", barcode: "BAR-008", isDigital: false, digitalUrl: "", status: "Available" },
        { id: "book-009", title: "Seerat-un-Nabi (SAW)", author: "Allama Shibli Nomani", isbn: "978-969-6400-12-7", category: "Islamic Studies", publisher: "Darul Ishaat", publishYear: 2008, totalCopies: 7, availableCopies: 6, rackNumber: "IS-01", barcode: "BAR-009", isDigital: false, digitalUrl: "", status: "Available" },
        { id: "book-010", title: "Cambridge English Grammar", author: "Raymond Murphy", isbn: "978-1108586627", category: "Education", publisher: "Cambridge University Press", publishYear: 2019, totalCopies: 10, availableCopies: 8, rackNumber: "E-02", barcode: "BAR-010", isDigital: false, digitalUrl: "", status: "Available" },
      ],
    });

    // Book Issues
    const libStudents = await prisma.student.findMany({ take: 8 });
    const books = await prisma.libraryBook.findMany({ take: 5 });
    for (let i = 0; i < books.length && i < libStudents.length; i++) {
      await prisma.bookIssue.create({
        data: {
          id: `issue-${String(i + 1).padStart(3, "0")}`,
          bookId: books[i].id,
          bookTitle: books[i].title,
          studentId: libStudents[i].id,
          studentName: libStudents[i].name,
          issuedDate: "2026-04-01",
          dueDate: "2026-04-15",
          returnedDate: i % 2 === 0 ? "2026-04-14" : undefined,
          status: i % 2 === 0 ? "Returned" : "Issued",
          fine: 0,
          finePaid: false,
        },
      });
    }

    // Library Reservations
    await prisma.libraryReservation.createMany({
      data: [
        { id: "res-001", bookId: "book-004", studentId: libStudents[0]?.id || "stu-100", studentName: libStudents[0]?.name || "Student", reservedDate: "2026-04-10", status: "Pending" },
        { id: "res-002", bookId: "book-005", studentId: libStudents[1]?.id || "stu-101", studentName: libStudents[1]?.name || "Student", reservedDate: "2026-04-12", status: "Pending" },
      ],
    });
    console.log("Library seeded");
  }

  // ── Hostel ──
  const hostelCount = await prisma.hostel.count();
  if (hostelCount === 0) {
    await prisma.hostel.createMany({
      data: [
        { id: "hostel-boys", name: "Iqbal Hostel (Boys)", type: "Boys", wardenName: "Mr. Rashid Mehmood", contactPhone: "0300-1234567", totalRooms: 20, totalBeds: 80, address: "Adjacent to School Campus, Block B, Gulberg III" },
        { id: "hostel-girls", name: "Fatima Hostel (Girls)", type: "Girls", wardenName: "Ms. Nasreen Akhtar", contactPhone: "0301-7654321", totalRooms: 15, totalBeds: 60, address: "Street 5, Garden Town, Lahore" },
      ],
    });

    // Hostel Rooms
    for (const h of ["hostel-boys", "hostel-girls"]) {
      const rooms = [];
      const maxRooms = h === "hostel-boys" ? 10 : 8;
      for (let i = 1; i <= maxRooms; i++) {
        const floor = Math.ceil(i / 5);
        rooms.push({
          id: `room-${h}-${String(i).padStart(2, "0")}`,
          hostelId: h,
          roomNumber: `${String(floor)}0${i}`,
          floor,
          totalBeds: 4,
          occupiedBeds: Math.floor(Math.random() * 5),
          monthlyFee: h === "hostel-boys" ? 12000 : 15000,
          isActive: true,
        });
      }
      await prisma.hostelRoom.createMany({ data: rooms });
    }

    // Hostel Allocations
    const hostelStudents = await prisma.student.findMany({ take: 6 });
    const rooms_b = await prisma.hostelRoom.findMany({ take: 6 });
    for (let i = 0; i < hostelStudents.length && i < rooms_b.length; i++) {
      await prisma.hostelAllocation.create({
        data: {
          id: `alloc-${String(i + 1).padStart(3, "0")}`,
          hostelId: i < 3 ? "hostel-boys" : "hostel-girls",
          hostelName: i < 3 ? "Iqbal Hostel (Boys)" : "Fatima Hostel (Girls)",
          roomId: rooms_b[i].id,
          roomNumber: rooms_b[i].roomNumber,
          studentId: hostelStudents[i].id,
          studentName: hostelStudents[i].name,
          startDate: "2026-04-01",
          endDate: "2027-03-31",
          status: "Active",
          feeAmount: 12000,
          feePaid: i % 2 === 0,
        },
      });
    }

    // Hostel Attendance
    for (const s of hostelStudents.slice(0, 4)) {
      for (let d = 1; d <= 10; d++) {
        await prisma.hostelAttendance.create({
          data: {
            id: `h-att-${s.id}-${d}`,
            studentId: s.id,
            studentName: s.name,
            date: `2026-04-${String(d).padStart(2, "0")}`,
            status: Math.random() > 0.2 ? "Present" : "Absent",
            inTime: "07:30",
            outTime: "16:00",
            remarks: "",
          },
        });
      }
    }

    // Visitor Logs
    await prisma.visitorLog.createMany({
      data: [
        { id: "vis-001", hostelId: "hostel-boys", visitorName: "Mr. Ali Khan", studentName: "Ahmed Ali Khan", relation: "Father", phone: "0300-1112223", inTime: "10:00", outTime: "11:30", date: "2026-04-05" },
        { id: "vis-002", hostelId: "hostel-girls", visitorName: "Mrs. Ayesha Bibi", studentName: "Fatima Zahra", relation: "Mother", phone: "0301-3334445", inTime: "14:00", outTime: "15:00", date: "2026-04-08" },
        { id: "vis-003", hostelId: "hostel-boys", visitorName: "Mr. Hassan Raza", studentName: "Muhammad Usman", relation: "Uncle", phone: "0302-5556667", inTime: "09:30", outTime: "10:30", date: "2026-04-12" },
      ],
    });
    console.log("Hostel seeded");
  }

  // ── Transport ──
  const routeCount = await prisma.transportRoute.count();
  if (routeCount === 0) {
    await prisma.transportRoute.createMany({
      data: [
        { id: "route-1", routeName: "Gulberg Route", startPoint: "Gulberg Main Chowk", endPoint: "School", stops: JSON.stringify(["Gulberg Chowk", "Liberty Market", "MM Alam Road", "School"]), distance: 8.5, feeAmount: 5000, isActive: true },
        { id: "route-2", routeName: "Garden Town Route", startPoint: "Garden Town Gate 2", endPoint: "School", stops: JSON.stringify(["Garden Town", "Faisal Town", "Johar Town", "School"]), distance: 12.0, feeAmount: 6000, isActive: true },
        { id: "route-3", routeName: "Model Town Route", startPoint: "Model Town Link Road", endPoint: "School", stops: JSON.stringify(["Model Town", "Canal Bank", "Gulshan-e-Ravi", "School"]), distance: 10.2, feeAmount: 5500, isActive: true },
        { id: "route-4", routeName: "Defence Route", startPoint: "DHA Phase 1", endPoint: "School", stops: JSON.stringify(["DHA Phase 1", "DHA Phase 2", "Qadri Center", "School"]), distance: 15.0, feeAmount: 7000, isActive: false },
      ],
    });

    // Transport Vehicles
    await prisma.transportVehicle.createMany({
      data: [
        { id: "veh-001", vehicleNumber: "LEK-1234", type: "Bus", capacity: 50, routeId: "route-1", driverName: "Mr. Muhammad Ashraf", driverPhone: "0300-9876543", registrationDate: "2024-01-15", fitnessExpiry: "2026-12-31", insuranceExpiry: "2026-06-30", isActive: true },
        { id: "veh-002", vehicleNumber: "LEK-5678", type: "Bus", capacity: 45, routeId: "route-2", driverName: "Mr. Abdul Sattar", driverPhone: "0301-8765432", registrationDate: "2024-03-20", fitnessExpiry: "2026-12-31", insuranceExpiry: "2026-06-30", isActive: true },
        { id: "veh-003", vehicleNumber: "LEK-9012", type: "Van", capacity: 20, routeId: "route-3", driverName: "Mr. Naveed Aslam", driverPhone: "0302-7654321", registrationDate: "2025-02-10", fitnessExpiry: "2027-02-10", insuranceExpiry: "2027-02-10", isActive: true },
        { id: "veh-004", vehicleNumber: "LEK-3456", type: "Bus", capacity: 50, routeId: "route-4", driverName: "Mr. Shafiq Ahmed", driverPhone: "0303-6543210", registrationDate: "2023-09-05", fitnessExpiry: "2026-09-05", insuranceExpiry: "2026-09-05", isActive: false },
      ],
    });

    // Transport Allocations
    const transportStudents = await prisma.student.findMany({ take: 10 });
    const vehicles = await prisma.transportVehicle.findMany({ where: { isActive: true } });
    for (let i = 0; i < transportStudents.length; i++) {
      const veh = vehicles[i % vehicles.length];
      await prisma.transportAllocation.create({
        data: {
          id: `t-alloc-${String(i + 1).padStart(3, "0")}`,
          routeId: veh.routeId,
          vehicleId: veh.id,
          studentId: transportStudents[i].id,
          studentName: transportStudents[i].name,
          pickupPoint: "Main Stop",
          dropPoint: "School",
          feeAmount: 5500,
          feePaid: i % 3 !== 0,
          status: "Active",
        },
      });
    }
    console.log("Transport seeded");
  }

  // ── HR: Employees ──
  const empCount = await prisma.employee.count();
  if (empCount === 0) {
    await prisma.employee.createMany({
      data: [
        { id: "emp-001", userId: 1, name: "Admin User", email: "admin@educators.edu.pk", phone: "042-35871234", department: "Administration", designation: "Principal", employmentType: "Permanent", joiningDate: "2020-01-01", cnic: "35201-1234567-1", address: "42-A, Gulberg III, Lahore", emergencyContact: "Mrs. Admin", emergencyPhone: "0300-1111111", qualification: "PhD Education", experience: 15, status: "Active", bankName: "HBL", bankAccount: "1234567890", profilePhoto: "" },
        { id: "emp-002", userId: 2, name: "Ms. Fatima Ahmed", email: "fatima@educators.edu.pk", phone: "042-35871235", department: "Academics", designation: "Senior Teacher", employmentType: "Permanent", joiningDate: "2021-03-15", cnic: "35201-2345678-2", address: "12-B, Model Town, Lahore", emergencyContact: "Mr. Ahmed", emergencyPhone: "0300-2222222", qualification: "MSc Mathematics, BEd", experience: 10, status: "Active", bankName: "UBL", bankAccount: "2345678901", profilePhoto: "" },
        { id: "emp-003", userId: 3, name: "Mr. Muhammad Usman", email: "usman@educators.edu.pk", phone: "042-35871236", department: "Academics", designation: "Subject Specialist", employmentType: "Permanent", joiningDate: "2022-08-01", cnic: "35201-3456789-3", address: "5-C, Garden Town, Lahore", emergencyContact: "Ms. Usman", emergencyPhone: "0300-3333333", qualification: "MSc Physics, MEd", experience: 7, status: "Active", bankName: "Meezan Bank", bankAccount: "3456789012", profilePhoto: "" },
        { id: "emp-004", userId: 1, name: "Mr. Khalid Mahmood", email: "khalid@educators.edu.pk", phone: "042-35871237", department: "Science", designation: "Science Teacher", employmentType: "Contract", joiningDate: "2023-04-10", cnic: "35201-4567890-4", address: "8-A, Faisal Town, Lahore", emergencyContact: "Mrs. Khalid", emergencyPhone: "0300-4444444", qualification: "MSc Chemistry", experience: 5, status: "Active", bankName: "HBL", bankAccount: "4567890123", profilePhoto: "" },
        { id: "emp-005", userId: 1, name: "Ms. Shazia Iqbal", email: "shazia@educators.edu.pk", phone: "042-35871238", department: "Languages", designation: "English Teacher", employmentType: "Permanent", joiningDate: "2021-09-01", cnic: "35201-5678901-5", address: "15-D, Gulshan-e-Ravi, Lahore", emergencyContact: "Mr. Iqbal", emergencyPhone: "0300-5555555", qualification: "MA English, BEd", experience: 8, status: "Active", bankName: "Allied Bank", bankAccount: "5678901234", profilePhoto: "" },
      ],
    });

    // Leave Requests
    await prisma.leaveRequest.createMany({
      data: [
        { id: "leave-001", employeeId: 2, employeeName: "Ms. Fatima Ahmed", leaveType: "Casual", startDate: "2026-04-20", endDate: "2026-04-21", totalDays: 2, reason: "Personal work", status: "Approved", approvedBy: "Admin User", appliedAt: "2026-04-15" },
        { id: "leave-002", employeeId: 3, employeeName: "Mr. Muhammad Usman", leaveType: "Sick", startDate: "2026-04-10", endDate: "2026-04-11", totalDays: 2, reason: "Fever and rest", status: "Pending", approvedBy: "", appliedAt: "2026-04-10" },
        { id: "leave-003", employeeId: 5, employeeName: "Ms. Shazia Iqbal", leaveType: "Annual", startDate: "2026-06-01", endDate: "2026-06-10", totalDays: 10, reason: "Family vacation", status: "Approved", approvedBy: "Admin User", appliedAt: "2026-04-01" },
      ],
    });

    // Performance Evaluations
    await prisma.performanceEvaluation.createMany({
      data: [
        { id: "eval-001", employeeId: 2, employeeName: "Ms. Fatima Ahmed", evaluatorName: "Admin User", evaluationDate: "2026-03-15", rating: 4, feedback: "Consistently delivers high-quality instruction. Students show excellent progress.", goals: "Lead the mathematics curriculum revision committee", overallScore: 85.5 },
        { id: "eval-002", employeeId: 3, employeeName: "Mr. Muhammad Usman", evaluatorName: "Admin User", evaluationDate: "2026-03-15", rating: 3, feedback: "Good physics teacher but needs to work on classroom management.", goals: "Complete advanced teaching certification", overallScore: 72.0 },
        { id: "eval-003", employeeId: 5, employeeName: "Ms. Shazia Iqbal", evaluatorName: "Admin User", evaluationDate: "2026-03-15", rating: 5, feedback: "Excellent English teacher with innovative teaching methods.", goals: "Develop school-wide English language program", overallScore: 92.0 },
      ],
    });

    // Contract Records
    await prisma.contractRecord.createMany({
      data: [
        { id: "ctr-001", employeeId: 4, startDate: "2023-04-10", endDate: "2026-04-09", contractType: "Fixed Term", documents: "/docs/contracts/khalid.pdf", status: "Active" },
        { id: "ctr-002", employeeId: 2, startDate: "2021-03-15", endDate: "2027-03-14", contractType: "Permanent", documents: "/docs/contracts/fatima.pdf", status: "Active" },
      ],
    });
    console.log("HR (employees, leaves, evaluations, contracts) seeded");
  }

  // ── Payroll ──
  const salaryStructCount = await prisma.salaryStructure.count();
  if (salaryStructCount === 0) {
    await prisma.salaryStructure.createMany({
      data: [
        { id: "ss-001", name: "Principal Scale", employeeId: 1, employeeName: "Admin User", basicSalary: 150000, allowances: JSON.stringify([{ name: "House Rent", amount: 45000, type: "Fixed" }, { name: "Transport", amount: 15000, type: "Fixed" }]), deductions: JSON.stringify([{ name: "Income Tax", amount: 25000, type: "Fixed" }, { name: "Health Insurance", amount: 5000, type: "Fixed" }]), totalSalary: 180000, isActive: true },
        { id: "ss-002", name: "Senior Teacher Scale", employeeId: 2, employeeName: "Ms. Fatima Ahmed", basicSalary: 85000, allowances: JSON.stringify([{ name: "House Rent", amount: 25500, type: "Fixed" }, { name: "Transport", amount: 10000, type: "Fixed" }]), deductions: JSON.stringify([{ name: "Income Tax", amount: 12000, type: "Fixed" }, { name: "Health Insurance", amount: 3000, type: "Fixed" }]), totalSalary: 105500, isActive: true },
        { id: "ss-003", name: "Subject Specialist Scale", employeeId: 3, employeeName: "Mr. Muhammad Usman", basicSalary: 65000, allowances: JSON.stringify([{ name: "House Rent", amount: 19500, type: "Fixed" }, { name: "Transport", amount: 8000, type: "Fixed" }]), deductions: JSON.stringify([{ name: "Income Tax", amount: 8000, type: "Fixed" }]), totalSalary: 84500, isActive: true },
        { id: "ss-004", name: "Contract Teacher Scale", employeeId: 4, employeeName: "Mr. Khalid Mahmood", basicSalary: 45000, allowances: JSON.stringify([{ name: "Transport", amount: 5000, type: "Fixed" }]), deductions: JSON.stringify([]), totalSalary: 50000, isActive: true },
      ],
    });

    // Payslips
    await prisma.payslip.createMany({
      data: [
        { id: "ps-2026-04-001", employeeId: 1, employeeName: "Admin User", month: "April", year: 2026, basicSalary: 150000, allowances: JSON.stringify([{ name: "House Rent", amount: 45000 }, { name: "Transport", amount: 15000 }]), deductions: JSON.stringify([{ name: "Income Tax", amount: 25000 }, { name: "Health Insurance", amount: 5000 }]), grossPay: 210000, totalDeductions: 30000, netPay: 180000, taxAmount: 25000, overtimePay: 0, status: "Paid", generatedAt: "2026-04-01" },
        { id: "ps-2026-04-002", employeeId: 2, employeeName: "Ms. Fatima Ahmed", month: "April", year: 2026, basicSalary: 85000, allowances: JSON.stringify([{ name: "House Rent", amount: 25500 }, { name: "Transport", amount: 10000 }]), deductions: JSON.stringify([{ name: "Income Tax", amount: 12000 }, { name: "Health Insurance", amount: 3000 }]), grossPay: 120500, totalDeductions: 15000, netPay: 105500, taxAmount: 12000, overtimePay: 0, status: "Paid", generatedAt: "2026-04-01" },
        { id: "ps-2026-04-003", employeeId: 3, employeeName: "Mr. Muhammad Usman", month: "April", year: 2026, basicSalary: 65000, allowances: JSON.stringify([{ name: "House Rent", amount: 19500 }, { name: "Transport", amount: 8000 }]), deductions: JSON.stringify([{ name: "Income Tax", amount: 8000 }]), grossPay: 92500, totalDeductions: 8000, netPay: 84500, taxAmount: 8000, overtimePay: 2000, status: "Generated", generatedAt: "2026-04-01" },
      ],
    });

    // Overtime Records
    await prisma.overtimeRecord.createMany({
      data: [
        { id: "ot-001", employeeId: 2, employeeName: "Ms. Fatima Ahmed", date: "2026-04-08", hours: 3, rate: 1500, amount: 4500, status: "Approved" },
        { id: "ot-002", employeeId: 3, employeeName: "Mr. Muhammad Usman", date: "2026-04-10", hours: 4, rate: 1200, amount: 4800, status: "Pending" },
        { id: "ot-003", employeeId: 5, employeeName: "Ms. Shazia Iqbal", date: "2026-04-12", hours: 2, rate: 1200, amount: 2400, status: "Approved" },
      ],
    });
    console.log("Payroll seeded");
  }

  // ── Accounting ──
  const acctCount = await prisma.accountEntry.count();
  if (acctCount === 0) {
    await prisma.accountEntry.createMany({
      data: [
        { id: "acct-001", date: "2026-04-01", type: "Income", category: "Tuition Fee", description: "Monthly tuition collection - April 2026", amount: 780000, paymentMethod: "Bank Transfer", reference: "TXN-2026-001", createdBy: "Admin User" },
        { id: "acct-002", date: "2026-04-02", type: "Expense", category: "Salary", description: "April salaries disbursement", amount: 420000, paymentMethod: "Bank Transfer", reference: "SAL-2026-04", createdBy: "Admin User" },
        { id: "acct-003", date: "2026-04-03", type: "Expense", category: "Utilities", description: "Electricity bill - March 2026", amount: 85000, paymentMethod: "Online Payment", reference: "UTIL-2026-03", createdBy: "Admin User" },
        { id: "acct-004", date: "2026-04-05", type: "Income", category: "Admission Fee", description: "New admission fees for 5 students", amount: 125000, paymentMethod: "Cash", reference: "ADM-2026-004", createdBy: "Admin User" },
        { id: "acct-005", date: "2026-04-07", type: "Expense", category: "Supplies", description: "Stationery and classroom supplies", amount: 45000, paymentMethod: "Cash", reference: "SUP-2026-001", createdBy: "Admin User" },
        { id: "acct-006", date: "2026-04-10", type: "Income", category: "Transport Fee", description: "Monthly transport fees collection", amount: 165000, paymentMethod: "Bank Transfer", reference: "TXN-2026-002", createdBy: "Admin User" },
        { id: "acct-007", date: "2026-04-12", type: "Expense", category: "Maintenance", description: "Building maintenance and repairs", amount: 95000, paymentMethod: "Cash", reference: "MNT-2026-001", createdBy: "Admin User" },
      ],
    });

    // Budget Allocations
    await prisma.budgetAllocation.createMany({
      data: [
        { id: "budget-001", department: "Academics", category: "Teaching Materials", allocatedAmount: 500000, spentAmount: 125000, fiscalYear: "2026-2027", notes: "Annual budget for teaching aids and materials" },
        { id: "budget-002", department: "Science", category: "Lab Equipment", allocatedAmount: 300000, spentAmount: 50000, fiscalYear: "2026-2027", notes: "Lab equipment and chemicals" },
        { id: "budget-003", department: "Sports", category: "Sports Equipment", allocatedAmount: 200000, spentAmount: 75000, fiscalYear: "2026-2027", notes: "Annual sports equipment budget" },
        { id: "budget-004", department: "Library", category: "Books & Resources", allocatedAmount: 250000, spentAmount: 60000, fiscalYear: "2026-2027", notes: "New book acquisitions and subscriptions" },
        { id: "budget-005", department: "IT", category: "Computer Lab", allocatedAmount: 400000, spentAmount: 0, fiscalYear: "2026-2027", notes: "Computer upgrades and maintenance" },
      ],
    });

    // Bank Transactions
    await prisma.bankTransaction.createMany({
      data: [
        { id: "bank-txn-001", bankName: "Habib Bank Limited", accountNumber: "1234-5678-9012", type: "Deposit", amount: 905000, date: "2026-04-01", reference: "TXN-2026-001", balance: 2500000 },
        { id: "bank-txn-002", bankName: "Habib Bank Limited", accountNumber: "1234-5678-9012", type: "Withdrawal", amount: 420000, date: "2026-04-02", reference: "SAL-2026-04", balance: 2080000 },
        { id: "bank-txn-003", bankName: "Habib Bank Limited", accountNumber: "1234-5678-9012", type: "Withdrawal", amount: 85000, date: "2026-04-03", reference: "UTIL-2026-03", balance: 1995000 },
        { id: "bank-txn-004", bankName: "Habib Bank Limited", accountNumber: "1234-5678-9012", type: "Deposit", amount: 165000, date: "2026-04-10", reference: "TXN-2026-002", balance: 2160000 },
      ],
    });
    console.log("Accounting seeded");
  }

  // ── Scholarships ──
  const scholCount = await prisma.scholarship.count();
  if (scholCount === 0) {
    await prisma.scholarship.createMany({
      data: [
        { id: "schol-001", name: "Merit Scholarship - Top 10%", type: "Merit", amount: 50000, totalSlots: 10, availableSlots: 8, eligibilityCriteria: "Students scoring 90% or above in the previous annual examination. Family income below PKR 500,000/year.", isActive: true },
        { id: "schol-002", name: "Need-Based Financial Aid", type: "Need-based", amount: 35000, totalSlots: 20, availableSlots: 15, eligibilityCriteria: "Family income below PKR 300,000/year. Minimum 60% academic score.", isActive: true },
        { id: "schol-003", name: "Sports Excellence Scholarship", type: "Sports", amount: 25000, totalSlots: 5, availableSlots: 4, eligibilityCriteria: "District level or above sports achievers. Minimum 50% academic score.", isActive: true },
        { id: "schol-004", name: "Hifz-e-Quran Scholarship", type: "Special", amount: 30000, totalSlots: 8, availableSlots: 7, eligibilityCriteria: "Students who have completed Hifz-e-Quran. Enrolled in regular academic program.", isActive: true },
      ],
    });

    // Scholarship Applications
    const scholStudents = await prisma.student.findMany({ take: 8 });
    await prisma.scholarshipApplication.createMany({
      data: [
        { id: "schol-app-001", scholarshipId: "schol-001", scholarshipName: "Merit Scholarship - Top 10%", studentId: scholStudents[0]?.id || "stu-100", studentName: scholStudents[0]?.name || "Student", applyingForClass: scholStudents[0]?.class || "Grade 6", academicScore: 91.5, familyIncome: 350000, supportingDocs: "/docs/scholarships/merit001.pdf", status: "Approved", appliedAt: "2026-03-20", approvedBy: "Admin User" },
        { id: "schol-app-002", scholarshipId: "schol-002", scholarshipName: "Need-Based Financial Aid", studentId: scholStudents[1]?.id || "stu-101", studentName: scholStudents[1]?.name || "Student", applyingForClass: scholStudents[1]?.class || "Grade 6", academicScore: 72.0, familyIncome: 250000, supportingDocs: "/docs/scholarships/need001.pdf", status: "Pending", appliedAt: "2026-03-25", approvedBy: "" },
        { id: "schol-app-003", scholarshipId: "schol-001", scholarshipName: "Merit Scholarship - Top 10%", studentId: scholStudents[2]?.id || "stu-102", studentName: scholStudents[2]?.name || "Student", applyingForClass: scholStudents[2]?.class || "Grade 6", academicScore: 88.0, familyIncome: 400000, supportingDocs: "/docs/scholarships/merit002.pdf", status: "Approved", appliedAt: "2026-03-22", approvedBy: "Admin User" },
        { id: "schol-app-004", scholarshipId: "schol-003", scholarshipName: "Sports Excellence Scholarship", studentId: scholStudents[3]?.id || "stu-103", studentName: scholStudents[3]?.name || "Student", applyingForClass: scholStudents[3]?.class || "Grade 6", academicScore: 65.0, familyIncome: 450000, supportingDocs: "/docs/scholarships/sports001.pdf", status: "Rejected", appliedAt: "2026-03-28", approvedBy: "Admin User" },
      ],
    });

    // Financial Aid
    await prisma.financialAid.createMany({
      data: [
        { id: "fa-001", studentId: scholStudents[0]?.id || "stu-100", studentName: scholStudents[0]?.name || "Student", aidType: "Tuition Waiver", amount: 50000, duration: "Full Academic Year", status: "Active", approvedAt: "2026-04-01" },
        { id: "fa-002", studentId: scholStudents[1]?.id || "stu-101", studentName: scholStudents[1]?.name || "Student", aidType: "Partial Fee Support", amount: 25000, duration: "Half Yearly", status: "Active", approvedAt: "2026-04-01" },
      ],
    });
    console.log("Scholarships seeded");
  }

  // ── Discipline ──
  const incCount = await prisma.incidentReport.count();
  if (incCount === 0) {
    await prisma.incidentReport.createMany({
      data: [
        { id: "inc-001", studentId: "stu-122", studentName: "Ahsan Raza", class: "Grade 6", reportedBy: "Mr. Tariq Mehmood", incidentDate: "2026-04-05", incidentType: "Disruptive Behavior", description: "Student was repeatedly disrupting the class during mathematics lecture by talking loudly and throwing paper airplanes.", severity: "Medium", location: "Room 201", witnesses: "Maria Rashid, Saba Javed", status: "Resolved", actionTaken: "Verbal warning issued and parents notified", resolvedAt: "2026-04-06" },
        { id: "inc-002", studentId: "stu-130", studentName: "Waqas Ali", class: "Grade 8", reportedBy: "Mr. Sohail Ahmed", incidentDate: "2026-04-08", incidentType: "Bullying", description: "Student was found bullying a junior student during break time in the playground.", severity: "High", location: "Playground", witnesses: "Multiple students", status: "Investigating", actionTaken: "Both students counseled. Investigation ongoing.", resolvedAt: "" },
        { id: "inc-003", studentId: "stu-135", studentName: "Faisal Mushtaq", class: "Grade 10 (Matric)", reportedBy: "Ms. Tabassum Jabeen", incidentDate: "2026-04-10", incidentType: "Uniform Violation", description: "Student came to school without proper uniform on multiple occasions.", severity: "Low", location: "School Gate", witnesses: "", status: "Open", actionTaken: "Warning issued", resolvedAt: "" },
        { id: "inc-004", studentId: "stu-116", studentName: "Imran Nazir", class: "Grade 3", reportedBy: "Mr. Imran Sheikh", incidentDate: "2026-04-12", incidentType: "Fighting", description: "Two students were involved in a physical altercation during sports period.", severity: "High", location: "Sports Ground", witnesses: "Coach, 5 students", status: "Resolved", actionTaken: "Both parents called. Suspension for 2 days.", resolvedAt: "2026-04-13" },
      ],
    });

    // Disciplinary Actions
    await prisma.disciplinaryAction.createMany({
      data: [
        { id: "da-001", incidentId: "inc-001", studentId: "stu-122", actionType: "Warning", description: "Official verbal warning with written notice to parents", startDate: "2026-04-06", endDate: "2026-04-06", issuedBy: "Mr. Tariq Mehmood", notes: "Student apologized and promised improvement" },
        { id: "da-002", incidentId: "inc-004", studentId: "stu-116", actionType: "Suspension", description: "2-day suspension for physical fighting", startDate: "2026-04-13", endDate: "2026-04-14", issuedBy: "Admin User", notes: "Student to submit written apology" },
      ],
    });

    // Counseling Records
    await prisma.counselingRecord.createMany({
      data: [
        { id: "csl-001", studentId: "stu-122", studentName: "Ahsan Raza", counselorName: "Ms. Ayesha Khan", sessionDate: "2026-04-07", type: "Behavioral", notes: "Discussed classroom behavior expectations and anger management strategies.", outcome: "Student showed understanding and agreed to improve behavior.", followUpDate: "2026-04-21" },
        { id: "csl-002", studentId: "stu-130", studentName: "Waqas Ali", counselorName: "Ms. Ayesha Khan", sessionDate: "2026-04-09", type: "Behavioral", notes: "Explored reasons behind bullying behavior. Student expressed personal frustrations.", outcome: "Referred for regular counseling sessions. Parents involved.", followUpDate: "2026-04-23" },
        { id: "csl-003", studentId: "stu-121", studentName: "Maria Rashid", counselorName: "Ms. Ayesha Khan", sessionDate: "2026-04-10", type: "Academic", notes: "High-achieving student feeling pressure to maintain grades. Discussed stress management.", outcome: "Student will participate in relaxation techniques. Follow-up in 2 weeks.", followUpDate: "2026-04-24" },
      ],
    });

    // Behavior History
    await prisma.behaviorHistory.createMany({
      data: [
        { id: "bh-001", studentId: "stu-122", entryDate: "2026-04-06", behaviorType: "Negative", description: "Classroom disruption during math lesson", recordedBy: "Mr. Tariq Mehmood", points: -10 },
        { id: "bh-002", studentId: "stu-121", entryDate: "2026-04-06", behaviorType: "Positive", description: "Helped classmate understand algebra concept", recordedBy: "Mr. Tariq Mehmood", points: 15 },
        { id: "bh-003", studentId: "stu-130", entryDate: "2026-04-08", behaviorType: "Negative", description: "Bullying incident in playground", recordedBy: "Mr. Sohail Ahmed", points: -20 },
        { id: "bh-004", studentId: "stu-123", entryDate: "2026-04-09", behaviorType: "Positive", description: "Volunteered to clean classroom after art period", recordedBy: "Mr. Tariq Mehmood", points: 10 },
        { id: "bh-005", studentId: "stu-116", entryDate: "2026-04-12", behaviorType: "Negative", description: "Physical altercation during sports", recordedBy: "Mr. Imran Sheikh", points: -15 },
      ],
    });
    console.log("Discipline seeded");
  }

  // ── Health ──
  const healthCount = await prisma.medicalRecord.count();
  if (healthCount === 0) {
    const healthStudentsList = await prisma.student.findMany({ take: 8 });
    const bloodGroups = ["A+", "B+", "AB+", "O+", "A-", "B-", "O-"];
    for (const s of healthStudentsList) {
      await prisma.medicalRecord.create({
        data: {
          id: `med-${s.id}`,
          studentId: s.id,
          studentName: s.name,
          bloodGroup: bloodGroups[Math.floor(Math.random() * bloodGroups.length)],
          allergies: Math.random() > 0.7 ? "Dust, Pollen" : "",
          chronicConditions: Math.random() > 0.8 ? "Asthma" : "",
          medications: "",
          emergencyContact: s.parentName,
          emergencyPhone: s.parentEmail?.includes("email") ? "0300-1112223" : "0300-9998887",
          insuranceProvider: "State Life Insurance",
          insuranceNumber: `SLI-${String(10000 + Math.floor(Math.random() * 90000))}`,
        },
      });

      // Vaccination Records
      await prisma.vaccinationRecord.createMany({
        data: [
          { id: `vac-${s.id}-1`, studentId: s.id, vaccineName: "Hepatitis B", doseNumber: 3, dateAdministered: "2025-09-15", administeredBy: "Dr. Ahmed", nextDueDate: "2030-09-15", notes: "Complete" },
          { id: `vac-${s.id}-2`, studentId: s.id, vaccineName: "Polio Booster", doseNumber: 1, dateAdministered: "2026-01-10", administeredBy: "Dr. Ahmed", nextDueDate: "", notes: "" },
          { id: `vac-${s.id}-3`, studentId: s.id, vaccineName: "TT (Tetanus)", doseNumber: 2, dateAdministered: "2025-06-20", administeredBy: "Dr. Fatima", nextDueDate: "2035-06-20", notes: "" },
        ],
      });

      // Health Screenings
      const height = 120 + Math.floor(Math.random() * 50);
      const weight = 25 + Math.floor(Math.random() * 35);
      await prisma.healthScreening.create({
        data: {
          id: `hs-${s.id}`,
          studentId: s.id,
          studentName: s.name,
          screeningDate: "2026-04-01",
          height,
          weight,
          bmi: +(weight / ((height / 100) * (height / 100))).toFixed(1),
          visionTest: "20/20",
          hearingTest: "Normal",
          dentalCheck: "No cavities",
          generalHealth: "Good",
          notes: "",
          screenedBy: "Dr. Ayesha Khan (School Doctor)",
        },
      });
    }
    console.log("Health records seeded");
  }

  // ── Events ──
  const eventCount = await prisma.event.count();
  if (eventCount === 0) {
    await prisma.event.createMany({
      data: [
        { id: "evt-001", title: "Annual Sports Gala 2026", description: "Annual sports competition featuring athletics, team sports, and fun activities for all grade levels.", category: "Sports", startDate: "2026-04-25", endDate: "2026-04-26", startTime: "08:00", endTime: "16:00", venue: "School Sports Ground", organizer: "Sports Department", maxParticipants: 500, registrationDeadline: "2026-04-20", status: "Upcoming", budget: 200000, bannerUrl: "/images/events/sports-gala-2026.jpg" },
        { id: "evt-002", title: "Parents-Teachers Meeting", description: "Quarterly meeting between parents and teachers to discuss student progress and concerns.", category: "Social", startDate: "2026-04-30", endDate: "2026-04-30", startTime: "14:00", endTime: "17:00", venue: "School Auditorium & Classrooms", organizer: "Academic Office", maxParticipants: 400, registrationDeadline: "2026-04-28", status: "Upcoming", budget: 50000, bannerUrl: "/images/events/ptm-2026.jpg" },
        { id: "evt-003", title: "Science & Technology Exhibition", description: "Students showcase their science projects, robotics demonstrations, and tech innovations.", category: "Academic", startDate: "2026-05-10", endDate: "2026-05-10", startTime: "09:00", endTime: "15:00", venue: "Science Block", organizer: "Science Department", maxParticipants: 200, registrationDeadline: "2026-05-05", status: "Upcoming", budget: 150000, bannerUrl: "/images/events/science-expo-2026.jpg" },
        { id: "evt-004", title: "Independence Day Celebration", description: "Flag hoisting ceremony, patriotic speeches, tableaus, and national songs competition.", category: "Cultural", startDate: "2026-08-14", endDate: "2026-08-14", startTime: "07:30", endTime: "11:00", venue: "School Main Ground", organizer: "Cultural Committee", maxParticipants: 800, registrationDeadline: "2026-08-10", status: "Upcoming", budget: 100000, bannerUrl: "/images/events/independence-day-2026.jpg" },
        { id: "evt-005", title: "Quran & Naat Competition", description: "Annual competition for Quran recitation, Naat, and Islamic knowledge quiz.", category: "Religious", startDate: "2026-05-15", endDate: "2026-05-15", startTime: "09:00", endTime: "13:00", venue: "School Auditorium", organizer: "Islamic Studies Department", maxParticipants: 100, registrationDeadline: "2026-05-10", status: "Upcoming", budget: 75000, bannerUrl: "/images/events/quran-competition-2026.jpg" },
        { id: "evt-006", title: "Career Counseling Workshop", description: "Interactive workshop for Grade 9-10 students on career planning, subject selection, and professional pathways.", category: "Workshop", startDate: "2026-05-20", endDate: "2026-05-20", startTime: "10:00", endTime: "14:00", venue: "Conference Hall", organizer: "Guidance & Counseling Cell", maxParticipants: 100, registrationDeadline: "2026-05-18", status: "Scheduled", budget: 30000, bannerUrl: "/images/events/career-workshop.jpg" },
      ],
    });

    // Event Registrations
    const eventStudents = await prisma.student.findMany({ take: 20 });
    for (let i = 0; i < eventStudents.length; i++) {
      await prisma.eventRegistration.create({
        data: {
          id: `evt-reg-${String(i + 1).padStart(3, "0")}`,
          eventId: i < 8 ? "evt-001" : i < 14 ? "evt-003" : "evt-005",
          studentId: eventStudents[i].id,
          studentName: eventStudents[i].name,
          class: eventStudents[i].class,
          registeredAt: "2026-04-10",
          attended: false,
          certificateIssued: false,
        },
      });
    }
    console.log("Events seeded");
  }

  // ── Alumni ──
  const alumniCount = await prisma.alumni.count();
  if (alumniCount === 0) {
    await prisma.alumni.createMany({
      data: [
        { id: "alumni-001", name: "Dr. Arif Alvi", email: "arif.alvi@gmail.com", phone: "0300-1110001", graduationYear: 2000, class: "Grade 10 (Matric)", currentOccupation: "Physician", company: "Mayo Hospital Lahore", address: "23-B, Model Town, Lahore", linkedinUrl: "https://linkedin.com/in/arifalvi", facebookUrl: "", isDonor: true, donationAmount: 100000, status: "Active" },
        { id: "alumni-002", name: "Ms. Sana Mirza", email: "sana.mirza@outlook.com", phone: "0301-2220002", graduationYear: 2005, class: "Grade 10 (Matric)", currentOccupation: "Software Engineer", company: "Systems Limited", address: "15-C, Gulberg II, Lahore", linkedinUrl: "https://linkedin.com/in/sanamirza", facebookUrl: "https://facebook.com/sana.mirza", isDonor: false, donationAmount: 0, status: "Active" },
        { id: "alumni-003", name: "Mr. Hassan Iqbal", email: "hassan.iqbal@yahoo.com", phone: "0302-3330003", graduationYear: 2010, class: "Grade 10 (Matric)", currentOccupation: "Chartered Accountant", company: "Deloitte Pakistan", address: "8-A, DHA Phase 3, Lahore", linkedinUrl: "https://linkedin.com/in/hassaniqbal", facebookUrl: "", isDonor: true, donationAmount: 50000, status: "Active" },
        { id: "alumni-004", name: "Ms. Fatima Tariq", email: "fatima.tariq@gmail.com", phone: "0303-4440004", graduationYear: 2015, class: "Grade 10 (Matric)", currentOccupation: "Civil Servant", company: "Pakistan Administrative Service", address: "House 12, Street 3, F-7/3, Islamabad", linkedinUrl: "https://linkedin.com/in/fatimatariq", facebookUrl: "https://facebook.com/fatima.tariq", isDonor: false, donationAmount: 0, status: "Active" },
        { id: "alumni-005", name: "Mr. Bilal Ahmed", email: "bilal.ahmed@live.com", phone: "0304-5550005", graduationYear: 2018, class: "Grade 10 (Matric)", currentOccupation: "University Student", company: "LUMS", address: "50-D, Garden Town, Lahore", linkedinUrl: "https://linkedin.com/in/bilalahmed", facebookUrl: "", isDonor: false, donationAmount: 0, status: "Active" },
      ],
    });
    console.log("Alumni seeded");
  }

  // ── Placement ──
  const jobCount = await prisma.jobPosting.count();
  if (jobCount === 0) {
    await prisma.jobPosting.createMany({
      data: [
        { id: "job-001", companyName: "Systems Limited", companyLogo: "/images/employers/systems.png", title: "Junior Software Developer", description: "Looking for fresh graduates to join our web development team. Training provided.", requirements: "Basic knowledge of JavaScript, HTML, CSS. Good problem-solving skills.", location: "Lahore", salaryRange: "PKR 50,000 - 70,000", jobType: "Full-time", applicationDeadline: "2026-06-30", postedAt: "2026-04-01", status: "Active", contactEmail: "hr@systems.com.pk" },
        { id: "job-002", companyName: "HBL Bank", companyLogo: "/images/employers/hbl.png", title: "Teller / Customer Service Officer", description: "Entry-level position for bank tellers and customer service representatives.", requirements: "Intermediate or above. Good communication skills. Basic math skills.", location: "Multiple Branches Lahore", salaryRange: "PKR 35,000 - 45,000", jobType: "Full-time", applicationDeadline: "2026-05-15", postedAt: "2026-04-03", status: "Active", contactEmail: "careers@hbl.com" },
        { id: "job-003", companyName: "The Educators School", companyLogo: "", title: "Teaching Assistant (Intern)", description: "Paid internship for Grade 12+ students interested in teaching careers. Mentorship provided.", requirements: "Good academic record. Interest in teaching. Available for 3 months.", location: "Lahore", salaryRange: "PKR 15,000 stipend", jobType: "Internship", applicationDeadline: "2026-05-01", postedAt: "2026-04-05", status: "Active", contactEmail: "careers@educators.edu.pk" },
      ],
    });

    // Job Applications
    const jobApplicants = await prisma.student.findMany({ take: 6 });
    await prisma.jobApplication.createMany({
      data: [
        { id: "job-app-001", jobId: "job-003", studentId: jobApplicants[0]?.id || "stu-100", studentName: jobApplicants[0]?.name || "Student", class: jobApplicants[0]?.class || "Grade 10", resume: "/docs/resumes/student1.pdf", coverLetter: "I am interested in the teaching assistant position to gain experience in education.", status: "Pending", appliedAt: "2026-04-08" },
        { id: "job-app-002", jobId: "job-003", studentId: jobApplicants[1]?.id || "stu-101", studentName: jobApplicants[1]?.name || "Student", class: jobApplicants[1]?.class || "Grade 10", resume: "/docs/resumes/student2.pdf", coverLetter: "I have excellent math skills and enjoy helping others learn.", status: "Shortlisted", appliedAt: "2026-04-07" },
      ],
    });

    // Employers
    await prisma.employer.createMany({
      data: [
        { id: "emplr-001", companyName: "Systems Limited", industry: "Information Technology", website: "https://www.systemsltd.com", contactName: "Ms. Hira Shah", contactEmail: "hira.shah@systemsltd.com", contactPhone: "042-1112233", address: "34-B, Gulberg III, Lahore", partnershipDate: "2025-01-15", status: "Active" },
        { id: "emplr-002", companyName: "Habib Bank Limited", industry: "Banking & Finance", website: "https://www.hbl.com", contactName: "Mr. Kamran Ali", contactEmail: "kamran.ali@hbl.com", contactPhone: "042-2223344", address: "HBL Plaza, Jail Road, Lahore", partnershipDate: "2024-06-01", status: "Active" },
      ],
    });

    // Internship Records
    await prisma.internshipRecord.createMany({
      data: [
        { id: "intern-001", studentId: jobApplicants[2]?.id || "stu-102", studentName: jobApplicants[2]?.name || "Student", companyName: "The Educators School", role: "Teaching Assistant", startDate: "2026-04-01", endDate: "2026-06-30", stipend: 15000, supervisorName: "Ms. Fatima Ahmed", supervisorEmail: "fatima@educators.edu.pk", status: "Ongoing" },
        { id: "intern-002", studentId: jobApplicants[3]?.id || "stu-103", studentName: jobApplicants[3]?.name || "Student", companyName: "TechVille Solutions", role: "Junior Developer Intern", startDate: "2026-04-15", endDate: "2026-07-15", stipend: 20000, supervisorName: "Mr. Usman Aslam", supervisorEmail: "usman@techville.pk", status: "Ongoing" },
      ],
    });
    console.log("Placement seeded");
  }

  // ── Research ──
  const researchCount = await prisma.researchProject.count();
  if (researchCount === 0) {
    await prisma.researchProject.createMany({
      data: [
        { id: "resproj-001", title: "Impact of Project-Based Learning on Student Engagement in Secondary School Mathematics", researcherName: "Dr. Abdul Qadeer Khan", department: "Academics", description: "A study examining how project-based learning approaches affect mathematics engagement and achievement in Grade 6-8 students.", startDate: "2026-01-01", endDate: "2026-12-31", fundingAmount: 200000, fundingSource: "HEC Research Grant", status: "Ongoing", outcomes: "Preliminary data collected. Analysis in progress." },
        { id: "resproj-002", title: "Effects of Bilingual Education on Language Acquisition in Primary Grades", researcherName: "Ms. Fatima Ahmed", department: "Languages", description: "Investigating the effectiveness of bilingual instruction (Urdu/English) on language skills development in early childhood education.", startDate: "2026-02-01", endDate: "2026-08-31", fundingAmount: 100000, fundingSource: "School Research Fund", status: "Ongoing", outcomes: "" },
        { id: "resproj-003", title: "Developing a Mobile App for School-Family Communication", researcherName: "Mr. Sohail Ahmed", department: "Computer Science", description: "Design and development of a mobile application to improve communication between school administration and parents.", startDate: "2026-03-01", endDate: "2026-09-30", fundingAmount: 50000, fundingSource: "Internal Funding", status: "Proposed", outcomes: "" },
      ],
    });

    // Research Grants
    await prisma.researchGrant.createMany({
      data: [
        { id: "rg-001", projectId: "resproj-001", grantName: "HEC National Research Program for Schools", amount: 200000, provider: "Higher Education Commission Pakistan", awardedDate: "2025-12-15", expiryDate: "2026-12-31", status: "Active" },
      ],
    });

    // Publications
    await prisma.publication.createMany({
      data: [
        { id: "pub-001", title: "Mathematics Achievement in Pakistani Secondary Schools: A Meta-Analysis", authors: "Dr. Abdul Qadeer Khan, Prof. Muhammad Ali", journal: "Journal of Educational Research Pakistan", doi: "10.1234/jerp.2026.001", publishYear: 2026, citations: 2, projectId: "resproj-001", url: "https://journal.education.pk/jerp-2026-001" },
      ],
    });

    // Ethics Approvals
    await prisma.ethicsApproval.createMany({
      data: [
        { id: "ea-001", projectId: "resproj-001", committeeName: "School Research Ethics Committee", approvalDate: "2025-12-20", expiryDate: "2026-12-31", status: "Approved", notes: "Approved with conditions: parental consent required" },
        { id: "ea-002", projectId: "resproj-002", committeeName: "School Research Ethics Committee", approvalDate: "2026-01-15", expiryDate: "2026-08-31", status: "Approved", notes: "" },
      ],
    });
    console.log("Research seeded");
  }

  // ── Online Exams ──
  const onlineExamCount = await prisma.onlineExam.count();
  if (onlineExamCount === 0) {
    await prisma.onlineExam.createMany({
      data: [
        { id: "oe-001", title: "Mathematics Weekly Quiz - Grade 6", className: "Grade 6", subject: "Mathematics", duration: 30, totalMarks: 25, passingMarks: 10, startTime: "2026-04-20T08:00:00Z", endTime: "2026-04-20T08:30:00Z", instructions: "Answer all questions. No negative marking.", proctoringEnabled: false, shuffleQuestions: true, status: "Scheduled" },
        { id: "oe-002", title: "English Grammar Test - Grade 8", className: "Grade 8", subject: "English", duration: 45, totalMarks: 40, passingMarks: 16, startTime: "2026-04-22T09:00:00Z", endTime: "2026-04-22T09:45:00Z", instructions: "Read each question carefully before answering.", proctoringEnabled: false, shuffleQuestions: false, status: "Draft" },
        { id: "oe-003", title: "Physics Diagnostic Test - Grade 10", className: "Grade 10 (Matric)", subject: "Physics", duration: 60, totalMarks: 50, passingMarks: 20, startTime: "2026-04-25T10:00:00Z", endTime: "2026-04-25T11:00:00Z", instructions: "Calculators are allowed. Show all working.", proctoringEnabled: true, shuffleQuestions: true, status: "Scheduled" },
      ],
    });

    // Online Exam Questions
    const exams = await prisma.onlineExam.findMany();
    for (const ex of exams) {
      await prisma.onlineExamQuestion.createMany({
        data: [
          { id: `oeq-${ex.id}-1`, examId: ex.id, type: "MCQ", question: "Sample MCQ question for this exam?", options: JSON.stringify(["Option A", "Option B", "Option C", "Option D"]), correctAnswer: "0", marks: 5 },
          { id: `oeq-${ex.id}-2`, examId: ex.id, type: "MCQ", question: "Another sample question?", options: JSON.stringify(["Choice 1", "Choice 2", "Choice 3", "Choice 4"]), correctAnswer: "2", marks: 5 },
          { id: `oeq-${ex.id}-3`, examId: ex.id, type: "TrueFalse", question: "A sample true/false statement.", options: JSON.stringify(["True", "False"]), correctAnswer: "0", marks: 3 },
        ],
      });
    }

    // Online Exam Attempts
    const onlineExamStudents = await prisma.student.findMany({ take: 5 });
    for (const s of onlineExamStudents) {
      await prisma.onlineExamAttempt.create({
        data: {
          id: `oea-${s.id}-oe-001`,
          examId: "oe-001",
          studentId: s.id,
          studentName: s.name,
          answers: JSON.stringify([{ questionId: "1", answer: "0" }, { questionId: "2", answer: "1" }]),
          score: Math.floor(Math.random() * 13) + 5,
          startedAt: "2026-04-20T08:00:00Z",
          submittedAt: "2026-04-20T08:25:00Z",
          status: "Submitted",
          proctoringLogs: "",
        },
      });
    }
    console.log("Online exams seeded");
  }

  // ── Certificates ──
  const certTplCount = await prisma.certificateTemplate.count();
  if (certTplCount === 0) {
    await prisma.certificateTemplate.createMany({
      data: [
        { id: "ctpl-001", name: "Standard Transcript", type: "Transcript", content: "<h1>ACADEMIC TRANSCRIPT</h1><p>This certifies that <strong>{{studentName}}</strong> has completed the academic year {{year}}.</p>", isActive: true },
        { id: "ctpl-002", name: "Character Certificate", type: "Character", content: "<h1>CHARACTER CERTIFICATE</h1><p>This is to certify that <strong>{{studentName}}</strong> bears good moral character.</p>", isActive: true },
        { id: "ctpl-003", name: "Participation Certificate", type: "Participation", content: "<h1>CERTIFICATE OF PARTICIPATION</h1><p>Awarded to <strong>{{studentName}}</strong> for participating in {{eventName}}.</p>", isActive: true },
        { id: "ctpl-004", name: "Completion Certificate", type: "Completion", content: "<h1>CERTIFICATE OF COMPLETION</h1><p>Awarded to <strong>{{studentName}}</strong> for successfully completing the {{courseName}}.</p>", isActive: true },
      ],
    });

    const certStudents = await prisma.student.findMany({ take: 5 });
    await prisma.certificateRecord.createMany({
      data: [
        { id: "cr-001", studentId: certStudents[0]?.id || "stu-100", studentName: certStudents[0]?.name || "Student", certificateType: "Character", certificateNumber: "CERT-2026-001", issuedDate: "2026-04-01", issuedBy: "Admin User", verified: true, verificationCode: "VFR-2026-A001", documentUrl: "/docs/certificates/cert-001.pdf" },
        { id: "cr-002", studentId: certStudents[1]?.id || "stu-101", studentName: certStudents[1]?.name || "Student", certificateType: "Participation", certificateNumber: "CERT-2026-002", issuedDate: "2026-04-10", issuedBy: "Admin User", verified: false, verificationCode: "VFR-2026-A002", documentUrl: "" },
        { id: "cr-003", studentId: certStudents[2]?.id || "stu-102", studentName: certStudents[2]?.name || "Student", certificateType: "Transcript", certificateNumber: "CERT-2026-003", issuedDate: "2026-03-31", issuedBy: "Admin User", verified: true, verificationCode: "VFR-2026-A003", documentUrl: "/docs/certificates/cert-003.pdf" },
      ],
    });
    console.log("Certificates seeded");
  }

  // ── Inventory / Assets ──
  const assetCount = await prisma.asset.count();
  if (assetCount === 0) {
    await prisma.asset.createMany({
      data: [
        { id: "asset-001", name: "Dell OptiPlex Desktop Computer", category: "IT Equipment", assetTag: "IT-001", location: "Computer Lab", purchaseDate: "2024-01-15", purchaseCost: 85000, currentValue: 55000, vendor: "Dell Pakistan", warrantyExpiry: "2027-01-15", status: "In Use", assignedTo: "Computer Lab", notes: "" },
        { id: "asset-002", name: "Interactive Whiteboard", category: "Teaching Equipment", assetTag: "TCH-001", location: "Main Auditorium", purchaseDate: "2025-03-01", purchaseCost: 120000, currentValue: 100000, vendor: "SmartTech Lahore", warrantyExpiry: "2028-03-01", status: "In Use", assignedTo: "Auditorium", notes: "" },
        { id: "asset-003", name: "Laboratory Microscope Set", category: "Lab Equipment", assetTag: "LAB-001", location: "Science Lab", purchaseDate: "2024-06-01", purchaseCost: 45000, currentValue: 35000, vendor: "Scientific Store", warrantyExpiry: "2027-06-01", status: "In Use", assignedTo: "Science Lab", notes: "Set of 10 microscopes" },
        { id: "asset-004", name: "Toyota HiAce School Bus", category: "Vehicle", assetTag: "VEH-001", location: "School Parking", purchaseDate: "2023-08-15", purchaseCost: 3500000, currentValue: 2800000, vendor: "Toyota Pakistan", warrantyExpiry: "2026-08-15", status: "In Use", assignedTo: "Transport Department", notes: "" },
        { id: "asset-005", name: "Library Bookshelves (Set)", category: "Furniture", assetTag: "FUR-001", location: "Library", purchaseDate: "2024-04-01", purchaseCost: 95000, currentValue: 80000, vendor: "Furniture House", warrantyExpiry: "2029-04-01", status: "In Use", assignedTo: "Library", notes: "Set of 12 steel shelves" },
        { id: "asset-006", name: "Canon Laser Printer", category: "IT Equipment", assetTag: "IT-002", location: "Admin Office", purchaseDate: "2025-01-10", purchaseCost: 35000, currentValue: 28000, vendor: "Canon Pakistan", warrantyExpiry: "2027-01-10", status: "Available", assignedTo: "", notes: "" },
        { id: "asset-007", name: "Air Conditioner (1.5 Ton)", category: "Facility", assetTag: "FAC-001", location: "Staff Room", purchaseDate: "2024-05-01", purchaseCost: 65000, currentValue: 50000, vendor: "Orient Electronics", warrantyExpiry: "2027-05-01", status: "Under Maintenance", assignedTo: "Staff Room", notes: "Compressor issue reported" },
      ],
    });

    // Maintenance Records
    await prisma.maintenanceRecord.createMany({
      data: [
        { id: "maint-001", assetId: "asset-007", assetName: "Air Conditioner (1.5 Ton)", maintenanceType: "Repair", description: "Compressor not cooling properly. Gas refill and servicing required.", cost: 5000, performedBy: "Mr. Ali (Technician)", scheduledDate: "2026-04-08", completedDate: "", status: "In Progress" },
        { id: "maint-002", assetId: "asset-004", assetName: "Toyota HiAce School Bus", maintenanceType: "Routine", description: "Regular oil change, filter replacement, and brake inspection.", cost: 12000, performedBy: "Toyota Service Center", scheduledDate: "2026-04-15", completedDate: "", status: "Scheduled" },
        { id: "maint-003", assetId: "asset-001", assetName: "Dell OptiPlex Desktop Computer", maintenanceType: "Repair", description: "System running slow. RAM upgrade and SSD replacement.", cost: 8000, performedBy: "IT Department", scheduledDate: "2026-04-05", completedDate: "2026-04-06", status: "Completed" },
      ],
    });

    // Consumable Items
    await prisma.consumableItem.createMany({
      data: [
        { id: "cons-001", name: "Whiteboard Markers (Pack of 10)", category: "Stationery", unit: "Pack", quantity: 25, minStockLevel: 10, unitPrice: 350, supplier: "Stationery Mart", lastRestocked: "2026-03-20" },
        { id: "cons-002", name: "Printer Paper (A4)", category: "Stationery", unit: "Ream", quantity: 50, minStockLevel: 20, unitPrice: 500, supplier: "Paper House", lastRestocked: "2026-03-25" },
        { id: "cons-003", name: "Chalk (White)", category: "Teaching Supplies", unit: "Box", quantity: 30, minStockLevel: 15, unitPrice: 150, supplier: "School Supplies Co", lastRestocked: "2026-04-01" },
        { id: "cons-004", name: "Disposable Gloves (Box of 100)", category: "Medical", unit: "Box", quantity: 10, minStockLevel: 5, unitPrice: 400, supplier: "MediCare Supply", lastRestocked: "2026-03-15" },
        { id: "cons-005", name: "Toner Cartridge (Canon LBP)", category: "IT Consumables", unit: "Piece", quantity: 5, minStockLevel: 3, unitPrice: 2500, supplier: "IT Solutions", lastRestocked: "2026-02-28" },
      ],
    });
    console.log("Inventory/Assets seeded");
  }

  // ── Procurement ──
  const prCount = await prisma.purchaseRequest.count();
  if (prCount === 0) {
    await prisma.purchaseRequest.createMany({
      data: [
        { id: "pr-001", requestedBy: "Ms. Fatima Ahmed", department: "Academics", description: "Purchase of mathematics textbooks for Grade 6-8", items: JSON.stringify([{ name: "Mathematics Textbook Grade 6", quantity: 100, unit: "pcs", estimatedCost: 850 }, { name: "Mathematics Textbook Grade 7", quantity: 100, unit: "pcs", estimatedCost: 850 }, { name: "Mathematics Textbook Grade 8", quantity: 80, unit: "pcs", estimatedCost: 850 }]), totalCost: 238000, priority: "High", status: "Approved", createdAt: "2026-03-20", approvedBy: "Admin User" },
        { id: "pr-002", requestedBy: "Mr. Sohail Ahmed", department: "IT", description: "Computer lab upgrades - 10 new desktop computers", items: JSON.stringify([{ name: "Dell OptiPlex Desktop i5", quantity: 10, unit: "pcs", estimatedCost: 85000 }]), totalCost: 850000, priority: "Medium", status: "Pending", createdAt: "2026-04-05", approvedBy: "" },
        { id: "pr-003", requestedBy: "Mr. Javed Akhtar", department: "Science", description: "Science lab chemicals and glassware", items: JSON.stringify([{ name: "Beaker Set (100ml-500ml)", quantity: 10, unit: "sets", estimatedCost: 1200 }, { name: "Chemical Reagent Kit", quantity: 5, unit: "kits", estimatedCost: 3500 }, { name: "Test Tubes (Pack of 50)", quantity: 5, unit: "packs", estimatedCost: 800 }]), totalCost: 33500, priority: "Low", status: "Approved", createdAt: "2026-04-01", approvedBy: "Admin User" },
        { id: "pr-004", requestedBy: "Admin User", department: "Administration", description: "Office furniture for new staff room", items: JSON.stringify([{ name: "Office Chair", quantity: 10, unit: "pcs", estimatedCost: 8500 }, { name: "Office Desk", quantity: 10, unit: "pcs", estimatedCost: 12000 }]), totalCost: 205000, priority: "Urgent", status: "Pending", createdAt: "2026-04-10", approvedBy: "" },
      ],
    });

    // Supplier Quotations
    await prisma.supplierQuotation.createMany({
      data: [
        { id: "sq-001", requestId: "pr-001", supplierName: "Punjab Textbook Board", contactPerson: "Mr. Rashid Mehmood", contactEmail: "sales@ptb.edu.pk", items: JSON.stringify([{ name: "Mathematics Textbook Grade 6", quantity: 100, unitPrice: 750, total: 75000 }]), totalAmount: 210000, validUntil: "2026-05-01", status: "Pending", submittedAt: "2026-03-25" },
        { id: "sq-002", requestId: "pr-001", supplierName: "Book World Lahore", contactPerson: "Mr. Nadeem Ahmed", contactEmail: "info@bookworld.pk", items: JSON.stringify([{ name: "Mathematics Textbook Grade 6", quantity: 100, unitPrice: 800, total: 80000 }]), totalAmount: 225000, validUntil: "2026-05-15", status: "Accepted", submittedAt: "2026-03-28" },
        { id: "sq-003", requestId: "pr-003", supplierName: "Scientific Store Lahore", contactPerson: "Mr. Ali Raza", contactEmail: "scientific@store.pk", items: JSON.stringify([{ name: "Beaker Set", quantity: 10, unitPrice: 1000, total: 10000 }]), totalAmount: 31000, validUntil: "2026-05-10", status: "Pending", submittedAt: "2026-04-05" },
      ],
    });

    // Purchase Orders
    await prisma.purchaseOrder.createMany({
      data: [
        { id: "po-001", poNumber: "PO-2026-001", requestId: "pr-001", supplierName: "Book World Lahore", items: JSON.stringify([{ name: "Mathematics Textbook Grade 6", quantity: 100, unitPrice: 800, total: 80000 }, { name: "Mathematics Textbook Grade 7", quantity: 100, unitPrice: 800, total: 80000 }, { name: "Mathematics Textbook Grade 8", quantity: 80, unitPrice: 800, total: 64000 }]), totalAmount: 224000, orderDate: "2026-04-01", deliveryDate: "2026-04-15", status: "Ordered", paymentStatus: "Unpaid", notes: "Requested urgent delivery" },
        { id: "po-002", poNumber: "PO-2026-002", requestId: "pr-003", supplierName: "Scientific Store Lahore", items: JSON.stringify([{ name: "Beaker Set", quantity: 10, unitPrice: 1000, total: 10000 }, { name: "Chemical Reagent Kit", quantity: 5, unitPrice: 3200, total: 16000 }, { name: "Test Tubes", quantity: 5, unitPrice: 750, total: 3750 }]), totalAmount: 29750, orderDate: "2026-04-05", deliveryDate: "2026-04-20", status: "Ordered", paymentStatus: "Unpaid", notes: "" },
      ],
    });

    // Goods Receipts
    await prisma.goodsReceipt.createMany({
      data: [
        { id: "gr-001", poId: "po-001", receivedDate: "2026-04-14", items: JSON.stringify([{ name: "Mathematics Textbook Grade 6", quantityReceived: 100, condition: "Excellent" }, { name: "Mathematics Textbook Grade 7", quantityReceived: 100, condition: "Excellent" }, { name: "Mathematics Textbook Grade 8", quantityReceived: 80, condition: "Good" }]), receivedBy: "Ms. Fatima Ahmed", notes: "All books received in good condition" },
      ],
    });
    console.log("Procurement seeded");
  }

  // ── Facilities (Rooms, Bookings, Maintenance Requests) ──
  const roomCount = await prisma.room.count();
  if (roomCount === 0) {
    await prisma.room.createMany({
      data: [
        { id: "room-101", name: "Grade 6 Classroom", type: "Classroom", capacity: 40, floor: 1, building: "Academic Block A", hasProjector: true, hasAC: true, hasComputers: false, isActive: true },
        { id: "room-102", name: "Grade 7 Classroom", type: "Classroom", capacity: 40, floor: 1, building: "Academic Block A", hasProjector: true, hasAC: true, hasComputers: false, isActive: true },
        { id: "room-103", name: "Grade 8 Classroom", type: "Classroom", capacity: 40, floor: 2, building: "Academic Block A", hasProjector: true, hasAC: true, hasComputers: false, isActive: true },
        { id: "room-201", name: "Computer Lab", type: "Lab", capacity: 30, floor: 2, building: "Science & Tech Block", hasProjector: true, hasAC: true, hasComputers: true, isActive: true },
        { id: "room-202", name: "Science Lab", type: "Lab", capacity: 30, floor: 2, building: "Science & Tech Block", hasProjector: false, hasAC: true, hasComputers: false, isActive: true },
        { id: "room-301", name: "School Auditorium", type: "Auditorium", capacity: 500, floor: 1, building: "Main Building", hasProjector: true, hasAC: true, hasComputers: true, isActive: true },
        { id: "room-302", name: "Conference Room", type: "Conference Room", capacity: 30, floor: 3, building: "Admin Block", hasProjector: true, hasAC: true, hasComputers: true, isActive: true },
        { id: "room-303", name: "Library", type: "Library", capacity: 80, floor: 1, building: "Main Building", hasProjector: false, hasAC: true, hasComputers: true, isActive: true },
        { id: "room-304", name: "Sports Hall", type: "Sports Hall", capacity: 200, floor: 0, building: "Sports Complex", hasProjector: false, hasAC: false, hasComputers: false, isActive: true },
        { id: "room-305", name: "Staff Room", type: "Office", capacity: 25, floor: 1, building: "Academic Block B", hasProjector: false, hasAC: true, hasComputers: true, isActive: true },
      ],
    });

    // Room Bookings
    const rooms = await prisma.room.findMany({ take: 5 });
    await prisma.roomBooking.createMany({
      data: [
        { id: "rb-001", roomId: rooms[0]?.id || "room-101", roomName: "Grade 6 Classroom", bookedBy: "Mr. Tariq Mehmood", purpose: "Extra Math Tutorial - Grade 6 Students", date: "2026-04-15", startTime: "14:00", endTime: "15:30", status: "Approved" },
        { id: "rb-002", roomId: rooms[3]?.id || "room-201", roomName: "Computer Lab", bookedBy: "Mr. Sohail Ahmed", purpose: "Computer programming workshop", date: "2026-04-18", startTime: "09:00", endTime: "12:00", status: "Approved" },
        { id: "rb-003", roomId: rooms[4]?.id || "room-202", roomName: "Science Lab", bookedBy: "Mr. Javed Akhtar", purpose: "Biology practical session", date: "2026-04-16", startTime: "10:00", endTime: "11:30", status: "Pending" },
        { id: "rb-004", roomId: rooms[0]?.id || "room-101", roomName: "Grade 6 Classroom", bookedBy: "Ms. Shazia Iqbal", purpose: "Parent meeting", date: "2026-04-20", startTime: "15:00", endTime: "16:00", status: "Pending" },
      ],
    });

    // Maintenance Requests
    await prisma.maintenanceRequest.createMany({
      data: [
        { id: "mr-001", roomId: "room-201", location: "Computer Lab", issueType: "Electrical", description: "Two computer systems are not powering on. Possible power supply issue.", reportedBy: "Mr. Sohail Ahmed", reportedDate: "2026-04-05", priority: "High", status: "In Progress", assignedTo: "IT Support", resolvedDate: "", cost: 3000 },
        { id: "mr-002", roomId: "room-101", location: "Grade 6 Classroom", issueType: "Plumbing", description: "Water tap in the classroom washbasin is leaking continuously.", reportedBy: "Mr. Tariq Mehmood", reportedDate: "2026-04-08", priority: "Medium", status: "Assigned", assignedTo: "Maintenance Staff", resolvedDate: "", cost: 1500 },
        { id: "mr-003", roomId: "room-301", location: "School Auditorium", issueType: "HVAC", description: "Air conditioner in the auditorium is not cooling properly.", reportedBy: "Admin User", reportedDate: "2026-04-10", priority: "Medium", status: "Open", assignedTo: "", resolvedDate: "", cost: 0 },
        { id: "mr-004", roomId: "room-303", location: "Library", issueType: "Lighting", description: "Two tube lights are flickering and need replacement.", reportedBy: "Librarian", reportedDate: "2026-04-03", priority: "Low", status: "Resolved", assignedTo: "Maintenance Staff", resolvedDate: "2026-04-04", cost: 500 },
      ],
    });
    console.log("Facilities seeded");
  }

  console.log("Database seeding completed!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
