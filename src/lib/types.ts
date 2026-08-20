
export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'EMPLOYEE' | 'OWNER' | 'PRINCIPAL';

export interface SchoolInfo {
  name: string;
  registrationNumber: string;
  address: string;
  contactEmail: string;
  academicYear?: string;
  phone?: string;
  website?: string;
  principal?: string;
  logoUrl?: string;
  foundingYear?: string;
  currency?: string;
  timezone?: string;
}

export interface StudentRecord {
  id: string;
  name: string;
  admissionNumber: string;
  class: string;       // Legacy: human-readable name (e.g. "Grade 6"), stored in students table
  section: string;     // Legacy: human-readable name (e.g. "A"), stored in students table
  parentName: string;
  status: 'Active' | 'Inactive';
  email?: string;
  parentEmail?: string;
  // ── Extended personal details ──
  dateOfBirth?: string;
  gender?: 'Male' | 'Female' | 'Other';
  phone?: string;
  address?: string;
  guardianRelation?: string;
  profilePhoto?: string;
  // ── Relational IDs (new enrollment system, stored in enrollments table) ──
  classId?: string;
  sectionId?: string;
  academicYearId?: string;
  rollNumber?: number;
}

export interface ClassSection {
  id: string;
  name: string;
  capacity: number;
  teacherName: string;
  // ── Extended fields ──
  gradeLevel?: string;
  academicYearId?: string;
}

export interface VoucherLineItem {
  description: string;
  amount: number;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  dueDate: string;
  status: 'Paid' | 'Unpaid' | 'Overdue' | 'Partial';
  voucherId: string;
  paymentMethod?: string;
  paymentDate?: string;
  discount?: number;
  discountReason?: string;
  amountPaid?: number;
  month?: string;
  feeType?: string;
  issueDate?: string;
  className?: string;
  lineItems?: VoucherLineItem[];
  classId?: string;
  sectionId?: string;
  academicYearId?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  section: string;
  date: string; // YYYY-MM-DD
  status: 'Present' | 'Absent' | 'Late';
}

export interface StudentExamScore {
  studentId: string;
  studentName: string;
  score: number;
  detailedBreakdown: string;
  recommendations?: string;
}

export interface ExamRecord {
  id: string;
  examName: string;
  subject: string;
  className: string;
  date: string;
  studentResults: StudentExamScore[];
  commonStrengths?: string;
  commonWeaknesses?: string;
  published?: boolean;
}


export interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  date: string;
  recipientRole: UserRole;
  recipientEmail?: string;
  read: boolean;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  gradeLevel: string;
  teacherName?: string;
  isElective: boolean;
}

export interface FeeCategory {
  id: string;
  name: string;
  description: string;
  defaultAmount: number;
  frequency: 'monthly' | 'quarterly' | 'annually' | 'one-time';
  isActive: boolean;
}

export interface AcademicTerm {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Section {
  id: string;
  name: string;    // e.g. "A", "B", "C"
  classId: string; // FK → classes.id
  capacity: number;
  teacherName?: string;
  group?: string;
  classTeacherId?: number | null;
  classTeacherName?: string | null;
}

export interface TeacherRecord {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string;
  specialization?: string;
  qualification?: string;
  experienceYears?: number;
  joiningDate?: string;
  address?: string;
  createdAt?: Date;
  profile?: {
    phone: string;
    cnic: string;
    specialization: string;
    qualification: string;
    experienceYears: number;
    joiningDate: string;
    address: string;
    profilePhoto: string | null;
    degreePhoto: string | null;
  } | null;
}

export interface ParentRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  studentIds: string[];
  status: 'Active' | 'Inactive';
  // Convenience: denormalized children info for display
  children?: { id: string; name: string; class: string; section: string }[];
}

export interface FeeStructure {
  id: string;
  name: string;
  assignedClass: string; // "ALL" or a specific class name like "Grade 10-A"
  assignedClassId?: string; // relational classes.id, when assigned to a real class ("ALL" has none)
  lineItems: VoucherLineItem[];
  totalAmount: number;
  isActive: boolean;
}

export interface ClassCompilation {
  id: string;
  sessionId: string;
  className: string;
  teacherName: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  submittedAt?: string;
  adminNotes?: string;
}

export interface ExamSession {
  id: string;
  name: string;
  term: string;
  deadline: string;
  status: 'active' | 'completed' | 'approved' | 'published';
  classes: string[];
  subjects: string[];
  totalMarks: number;
  createdAt: string;
  createdBy: string;
}

export interface ExamMarkEntry {
  id: string;
  sessionId: string;
  subjectName: string;
  className: string;
  teacherId?: number;
  teacherName?: string;
  studentResults: StudentExamScore[];
  status: 'pending' | 'submitted' | 'reviewed';
  submittedAt?: string;
}

export interface TeacherSubjectAssignment {
  id: string;
  teacherId: number;
  teacherName: string;
  subjectName: string;
  className: string;
}

// ── LMS / Course Management ────────────────────────────────────────────────────
export interface Course {
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

export interface CourseMaterial {
  id: string;
  courseId: string;
  title: string;
  type: 'video' | 'document' | 'quiz' | 'link';
  url: string;
  fileName?: string;
  description?: string;
  createdByName?: string;
  createdAt: string;
}

export interface DiscussionForum {
  id: string;
  courseId: string;
  topic: string;
  authorName: string;
  content: string;
  createdAt: string;
  replies: ForumReply[];
}

export interface ForumReply {
  id: string;
  forumId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface OnlineQuiz {
  id: string;
  courseId: string;
  title: string;
  questions: QuizQuestion[];
  totalMarks: number;
  timeLimit: number;
  dueDate: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  marks: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  studentName: string;
  answers: number[];
  score: number;
  submittedAt: string;
}

export interface StudentProgress {
  id: string;
  courseId: string;
  studentId: string;
  studentName: string;
  materialsCompleted: number;
  totalMaterials: number;
  quizScore: number;
  lastAccessed: string;
}

// ── Library Management ──────────────────────────────────────────────────────────
export interface LibraryBook {
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
  isDigital: boolean;
  digitalUrl: string;
  status: 'Available' | 'Issued' | 'Reserved' | 'Damaged';
}

export interface BookIssue {
  id: string;
  bookId: string;
  bookTitle: string;
  studentId: string;
  studentName: string;
  issuedDate: string;
  dueDate: string;
  returnedDate: string;
  status: 'Issued' | 'Returned' | 'Overdue';
  fine: number;
  finePaid: boolean;
}

export interface LibraryReservation {
  id: string;
  bookId: string;
  studentId: string;
  studentName: string;
  reservedDate: string;
  status: 'Pending' | 'Collected' | 'Cancelled';
}

// ── Hostel Management ──────────────────────────────────────────────────────────
export interface Hostel {
  id: string;
  name: string;
  type: 'Boys' | 'Girls' | 'Co-education';
  wardenName: string;
  contactPhone: string;
  totalRooms: number;
  totalBeds: number;
  address: string;
}

export interface HostelRoom {
  id: string;
  hostelId: string;
  roomNumber: string;
  floor: number;
  totalBeds: number;
  occupiedBeds: number;
  monthlyFee: number;
  isActive: boolean;
}

export interface HostelAllocation {
  id: string;
  hostelId: string;
  hostelName: string;
  roomId: string;
  roomNumber: string;
  studentId: string;
  studentName: string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Inactive' | 'Transferred';
  feeAmount: number;
  feePaid: boolean;
}

export interface HostelAttendance {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  status: 'Present' | 'Absent' | 'Late';
  inTime: string;
  outTime: string;
  remarks: string;
}

export interface VisitorLog {
  id: string;
  hostelId: string;
  visitorName: string;
  studentName: string;
  relation: string;
  phone: string;
  inTime: string;
  outTime: string;
  date: string;
}

// ── Transportation Management ──────────────────────────────────────────────────
export interface TransportRoute {
  id: string;
  routeName: string;
  startPoint: string;
  endPoint: string;
  stops: string[];
  distance: number;
  feeAmount: number;
  isActive: boolean;
}

export interface TransportVehicle {
  id: string;
  vehicleNumber: string;
  type: 'Bus' | 'Van' | 'Car';
  capacity: number;
  routeId: string;
  driverName: string;
  driverPhone: string;
  registrationDate: string;
  fitnessExpiry: string;
  insuranceExpiry: string;
  isActive: boolean;
}

export interface TransportAllocation {
  id: string;
  routeId: string;
  vehicleId: string;
  studentId: string;
  studentName: string;
  pickupPoint: string;
  dropPoint: string;
  feeAmount: number;
  feePaid: boolean;
  status: 'Active' | 'Inactive';
}

export interface GPSLocation {
  vehicleId: string;
  lat: number;
  lng: number;
  timestamp: string;
  speed: number;
}

// ── HR Management ──────────────────────────────────────────────────────────────
export interface EmployeeRecord {
  id: string;
  userId: number;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  employmentType: 'Permanent' | 'Contract' | 'Probation' | 'Intern';
  joiningDate: string;
  cnic: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  qualification: string;
  experience: number;
  status: 'Active' | 'Inactive' | 'Resigned' | 'Terminated';
  bankName: string;
  bankAccount: string;
  profilePhoto: string;
  payScaleId: string | null;
}

export interface LeaveRequest {
  id: string;
  employeeId: number;
  employeeName: string;
  leaveType: 'Sick' | 'Casual' | 'Annual' | 'Maternity' | 'Paternity' | 'Unpaid';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy: string;
  appliedAt: string;
}

export interface PerformanceEvaluation {
  id: string;
  employeeId: number;
  employeeName: string;
  evaluatorName: string;
  evaluationDate: string;
  rating: number;
  feedback: string;
  goals: string;
  overallScore: number;
}

export interface ContractRecord {
  id: string;
  employeeId: number;
  startDate: string;
  endDate: string;
  contractType: string;
  documents: string;
  status: 'Active' | 'Expired' | 'Terminated';
}

// ── Payroll Management ─────────────────────────────────────────────────────────
export interface SalaryStructure {
  id: string;
  name: string;
  employeeId: number;
  employeeName: string;
  basicSalary: number;
  allowances: PayrollAllowance[];
  deductions: PayrollDeduction[];
  totalSalary: number;
  isActive: boolean;
}

export interface PayrollAllowance {
  name: string;
  amount: number;
  type: 'Fixed' | 'Percentage';
}

export interface PayrollDeduction {
  name: string;
  amount: number;
  type: 'Fixed' | 'Percentage';
}

export interface Payslip {
  id: string;
  employeeId: number;
  employeeName: string;
  month: string;
  year: number;
  basicSalary: number;
  allowances: PayrollAllowance[];
  deductions: PayrollDeduction[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  taxAmount: number;
  overtimePay: number;
  status: 'Draft' | 'Generated' | 'Paid';
  generatedAt: string;
}

export interface OvertimeRecord {
  id: string;
  employeeId: number;
  employeeName: string;
  date: string;
  hours: number;
  rate: number;
  amount: number;
  status: 'Pending' | 'Approved' | 'Paid';
}

// ── Accounting & Finance ────────────────────────────────────────────────────────
export interface AccountEntry {
  id: string;
  date: string;
  type: 'Income' | 'Expense';
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  createdBy: string;
}

export interface BudgetAllocation {
  id: string;
  department: string;
  category: string;
  allocatedAmount: number;
  spentAmount: number;
  fiscalYear: string;
  notes: string;
}

export interface BankTransaction {
  id: string;
  bankName: string;
  accountNumber: string;
  type: 'Deposit' | 'Withdrawal' | 'Transfer';
  amount: number;
  date: string;
  reference: string;
  balance: number;
}

// ── Scholarship & Financial Aid ────────────────────────────────────────────────
export interface Scholarship {
  id: string;
  name: string;
  type: 'Merit' | 'Need-based' | 'Sports' | 'Special';
  amount: number;
  totalSlots: number;
  availableSlots: number;
  eligibilityCriteria: string;
  isActive: boolean;
}

export interface ScholarshipApplication {
  id: string;
  scholarshipId: string;
  scholarshipName: string;
  studentId: string;
  studentName: string;
  applyingForClass: string;
  academicScore: number;
  familyIncome: number;
  supportingDocs: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  appliedAt: string;
  approvedBy: string;
}

export interface FinancialAid {
  id: string;
  studentId: string;
  studentName: string;
  aidType: string;
  amount: number;
  duration: string;
  status: 'Active' | 'Completed' | 'Suspended';
  approvedAt: string;
}

// ── Discipline & Behavior ──────────────────────────────────────────────────────
export interface IncidentReport {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  reportedBy: string;
  incidentDate: string;
  incidentType: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  location: string;
  witnesses: string;
  status: 'Open' | 'Investigating' | 'Resolved' | 'Closed';
  actionTaken: string;
  resolvedAt: string;
}

export interface DisciplinaryAction {
  id: string;
  incidentId: string;
  studentId: string;
  actionType: 'Warning' | 'Suspension' | 'Probation' | 'Expulsion' | 'Counseling';
  description: string;
  startDate: string;
  endDate: string;
  issuedBy: string;
  notes: string;
}

export interface CounselingRecord {
  id: string;
  studentId: string;
  studentName: string;
  counselorName: string;
  sessionDate: string;
  type: 'Academic' | 'Behavioral' | 'Career' | 'Personal';
  notes: string;
  outcome: string;
  followUpDate: string;
}

export interface BehaviorHistory {
  id: string;
  studentId: string;
  entryDate: string;
  behaviorType: 'Positive' | 'Negative';
  description: string;
  recordedBy: string;
  points: number;
}

// ── Health & Medical ───────────────────────────────────────────────────────────
export interface MedicalRecord {
  id: string;
  studentId: string;
  studentName: string;
  bloodGroup: string;
  allergies: string;
  chronicConditions: string;
  medications: string;
  emergencyContact: string;
  emergencyPhone: string;
  insuranceProvider: string;
  insuranceNumber: string;
}

export interface VaccinationRecord {
  id: string;
  studentId: string;
  vaccineName: string;
  doseNumber: number;
  dateAdministered: string;
  administeredBy: string;
  nextDueDate: string;
  notes: string;
}

export interface HealthScreening {
  id: string;
  studentId: string;
  studentName: string;
  screeningDate: string;
  height: number;
  weight: number;
  bmi: number;
  visionTest: string;
  hearingTest: string;
  dentalCheck: string;
  generalHealth: string;
  notes: string;
  screenedBy: string;
}

// ── Event Management ───────────────────────────────────────────────────────────
export interface Event {
  id: string;
  title: string;
  description: string;
  category: 'Academic' | 'Sports' | 'Cultural' | 'Social' | 'Religious' | 'Workshop';
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  organizer: string;
  maxParticipants: number;
  registrationDeadline: string;
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
  budget: number;
  bannerUrl: string;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  studentId: string;
  studentName: string;
  class: string;
  registeredAt: string;
  attended: boolean;
  certificateIssued: boolean;
}

// ── Alumni Management ──────────────────────────────────────────────────────────
export interface Alumni {
  id: string;
  name: string;
  email: string;
  phone: string;
  graduationYear: number;
  class: string;
  currentOccupation: string;
  company: string;
  address: string;
  linkedinUrl: string;
  facebookUrl: string;
  isDonor: boolean;
  donationAmount: number;
  status: 'Active' | 'Inactive';
  sourceStudentId?: string;
}

export interface AlumniEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  venue: string;
  attendees: number;
  photos: string;
}

// ── Placement & Career Services ────────────────────────────────────────────────
export interface JobPosting {
  id: string;
  companyName: string;
  companyLogo: string;
  title: string;
  description: string;
  requirements: string;
  location: string;
  salaryRange: string;
  jobType: 'Full-time' | 'Part-time' | 'Internship';
  applicationDeadline: string;
  postedAt: string;
  status: 'Active' | 'Closed';
  contactEmail: string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  studentId: string;
  studentName: string;
  class: string;
  resume: string;
  coverLetter: string;
  status: 'Pending' | 'Shortlisted' | 'Interviewed' | 'Selected' | 'Rejected';
  appliedAt: string;
}

export interface Employer {
  id: string;
  companyName: string;
  industry: string;
  website: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  partnershipDate: string;
  status: 'Active' | 'Inactive';
}

export interface InternshipRecord {
  id: string;
  studentId: string;
  studentName: string;
  companyName: string;
  role: string;
  startDate: string;
  endDate: string;
  stipend: number;
  supervisorName: string;
  supervisorEmail: string;
  status: 'Ongoing' | 'Completed';
}

// ── Research Management ────────────────────────────────────────────────────────
export interface ResearchProject {
  id: string;
  title: string;
  researcherName: string;
  department: string;
  description: string;
  startDate: string;
  endDate: string;
  fundingAmount: number;
  fundingSource: string;
  status: 'Proposed' | 'Ongoing' | 'Completed' | 'Published';
  outcomes: string;
}

export interface ResearchGrant {
  id: string;
  projectId: string;
  grantName: string;
  amount: number;
  provider: string;
  awardedDate: string;
  expiryDate: string;
  status: 'Active' | 'Closed';
}

export interface Publication {
  id: string;
  title: string;
  authors: string;
  journal: string;
  doi: string;
  publishYear: number;
  citations: number;
  projectId: string;
  url: string;
}

export interface EthicsApproval {
  id: string;
  projectId: string;
  committeeName: string;
  approvalDate: string;
  expiryDate: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  notes: string;
}

// ── Online Examination ─────────────────────────────────────────────────────────
export interface OnlineExam {
  id: string;
  title: string;
  className: string;
  subject: string;
  duration: number;
  totalMarks: number;
  passingMarks: number;
  startTime: string;
  endTime: string;
  instructions: string;
  proctoringEnabled: boolean;
  shuffleQuestions: boolean;
  status: 'Draft' | 'Scheduled' | 'Ongoing' | 'Completed' | 'Cancelled';
  // When set, a submitted attempt's score is written into marks_entries for
  // this exam_subjects row — this online exam counts toward the student's
  // real term result/report card instead of being a standalone practice quiz.
  examSubjectId: string | null;
}

export interface OnlineExamQuestion {
  id: string;
  examId: string;
  type: 'MCQ' | 'Essay' | 'TrueFalse' | 'ShortAnswer';
  question: string;
  options: string[];
  correctAnswer: string;
  marks: number;
}

export interface OnlineExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  answers: OnlineExamAnswer[];
  score: number;
  startedAt: string;
  submittedAt: string;
  status: 'InProgress' | 'Submitted' | 'Graded';
  proctoringLogs: string;
}

export interface OnlineExamAnswer {
  questionId: string;
  answer: string;
  marksObtained: number;
}

// ── Certificate & Document Management ──────────────────────────────────────────
export interface CertificateTemplate {
  id: string;
  name: string;
  type: 'Transcript' | 'Character' | 'Migration' | 'Provisional' | 'Participation' | 'Completion';
  content: string;
  isActive: boolean;
}

export interface CertificateRecord {
  id: string;
  studentId: string;
  studentName: string;
  certificateType: string;
  certificateNumber: string;
  issuedDate: string;
  issuedBy: string;
  verified: boolean;
  verificationCode: string;
  documentUrl: string;
}

// ── Inventory & Asset Management ──────────────────────────────────────────────
export interface Asset {
  id: string;
  name: string;
  category: string;
  assetTag: string;
  location: string;
  purchaseDate: string;
  purchaseCost: number;
  currentValue: number;
  vendor: string;
  warrantyExpiry: string;
  status: 'In Use' | 'Available' | 'Under Maintenance' | 'Disposed';
  assignedTo: string;
  notes: string;
}

export interface MaintenanceRecord {
  id: string;
  assetId: string;
  assetName: string;
  maintenanceType: 'Routine' | 'Repair' | 'Emergency';
  description: string;
  cost: number;
  performedBy: string;
  scheduledDate: string;
  completedDate: string;
  status: 'Scheduled' | 'In Progress' | 'Completed';
}

export interface ConsumableItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minStockLevel: number;
  unitPrice: number;
  supplier: string;
  lastRestocked: string;
}

// ── Procurement Management ──────────────────────────────────────────────────────
export interface PurchaseRequest {
  id: string;
  requestedBy: string;
  department: string;
  description: string;
  items: PurchaseItem[];
  totalCost: number;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  approvedBy: string;
}

export interface PurchaseItem {
  name: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
}

export interface SupplierQuotation {
  id: string;
  requestId: string;
  supplierName: string;
  contactPerson: string;
  contactEmail: string;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  totalAmount: number;
  validUntil: string;
  status: 'Pending' | 'Accepted' | 'Rejected';
  submittedAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierName: string;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  totalAmount: number;
  orderDate: string;
  deliveryDate: string;
  status: 'Ordered' | 'Partially Received' | 'Received' | 'Cancelled';
  paymentStatus: 'Unpaid' | 'Partial' | 'Paid';
  notes: string;
}

export interface GoodsReceipt {
  id: string;
  poId: string;
  receivedDate: string;
  items: { name: string; quantityReceived: number; condition: string }[];
  receivedBy: string;
  notes: string;
}

// ── Facility & Campus Management ────────────────────────────────────────────────
export interface Room {
  id: string;
  name: string;
  type: 'Classroom' | 'Lab' | 'Library' | 'Auditorium' | 'Sports Hall' | 'Conference Room' | 'Office';
  capacity: number;
  floor: number;
  building: string;
  hasProjector: boolean;
  hasAC: boolean;
  hasComputers: boolean;
  isActive: boolean;
}

export interface RoomBooking {
  id: string;
  roomId: string;
  roomName: string;
  bookedBy: string;
  purpose: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
}

export interface MaintenanceRequest {
  id: string;
  roomId: string;
  location: string;
  issueType: string;
  description: string;
  reportedBy: string;
  reportedDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'Assigned' | 'In Progress' | 'Resolved';
  assignedTo: string;
  resolvedDate: string;
  cost: number;
}

// ── Academic Core (Relational) ─────────────────────────────────────────────────
export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface ClassItem {
  id: string;
  name: string;
  gradeLevel: string;
  academicYearId: string;
  sections?: SectionItem[];
  isGraduating?: boolean;
}

export interface SectionItem {
  id: string;
  name: string;
  capacity: number;
  teacherName?: string;
  classId: string;
  group?: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  classId: string;
  sectionId: string;
  academicYearId: string;
  rollNumber: number;
  status: 'Active' | 'Inactive' | 'Graduated' | 'Transferred';
  studentName?: string;
  className?: string;
  sectionName?: string;
  profilePhoto?: string;
}

export interface TeacherClassSubject {
  id: string;
  teacherId: number;
  classId: string;
  sectionId: string;
  subjectId: string;
  academicYearId: string;
  teacherName?: string;
  className?: string;
  sectionName?: string;
  subjectName?: string;
}

export interface TermExam {
  id: string;
  name: string;
  examType: 'MidTerm' | 'Final' | 'Monthly' | 'Quiz';
  classId: string;
  sectionId?: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
  status: 'Scheduled' | 'Ongoing' | 'Completed' | 'Published';
  className?: string;
  sectionName?: string;
  examSubjects?: ExamSubjectItem[];
}

export interface ExamSubjectItem {
  id: string;
  examId: string;
  subjectId: string;
  totalMarks: number;
  passingMarks: number;
  teacherId?: number;
  subjectName?: string;
  teacherName?: string;
}

export interface MarksEntry {
  id: string;
  examSubjectId: string;
  studentId: string;
  marksObtained: number;
  grade?: string;
  remarks?: string;
  studentName?: string;
}

export interface GradeScaleItem {
  id: number;
  name: string;
  minPercentage: number;
  maxPercentage: number;
  grade: string;
  points: number;
  isPass: boolean;
  sortOrder: number;
}

export interface TermConfigItem {
  id: number;
  examType: string;
  termName: string;
  termOrder: number;
  weight: number;
  isOptional: boolean;
  sortOrder: number;
}

export interface TermSubjectResult {
  subjectName: string;
  obtained: number;
  total: number;
  percentage: number;
  grade: string;
  points: number;
  isPass: boolean;
  rank: number;
  totalStudents: number;
}

export interface TermResultItem {
  termOrder: number;
  termName: string;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  points: number;
  isPass: boolean;
  position: number;
  totalStudents: number;
  subjects: TermSubjectResult[];
  examCount: number;
}

export interface AnnualResultItem {
  percentage: number;
  grade: string;
  points: number;
  isPass: boolean;
  position: number;
  totalStudents: number;
  subjectAverages: { subjectName: string; percentage: number; grade: string; isPass: boolean }[];
  isPromoted: boolean;
  promotionNote: string;
}

export interface ResultItem {
  id: string;
  examId: string;
  studentId: string;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade?: string;
  sectionPosition?: number;
  sectionTotal?: number;
  classId?: string;
  sectionId?: string;
  status: 'Pending' | 'Submitted' | 'Reviewed' | 'Approved' | 'Published';
}

export interface ReportCard {
  id: string;
  studentId: string;
  academicYearId: string;
  examResults: ReportCardExamResult[];
  generatedAt: string;
  totalPercentage: number;
  overallGrade?: string;
  classPosition?: number;
  remarks?: string;
}

export interface ReportCardExamResult {
  examId: string;
  examName: string;
  subjects: { subjectName: string; marksObtained: number; totalMarks: number; grade: string }[];
  totalObtained: number;
  totalMarks: number;
  percentage: number;
}

export interface ResultPosition {
  id: string;
  sessionId: string;
  className: string;
  gradeName: string;
  studentId: string;
  studentName: string;
  totalMarks: number;
  maxPossible: number;
  percentage: number;
  sectionPosition: number;
  sectionTotal: number;
  gradePosition: number;
  gradeTotal: number;
  subjectScores: { subject: string; score: number }[];
  calculatedAt: string;
}

export interface AdmissionApplication {
  id: string;
  applicationId: string;
  submittedAt: string;
  status: 'Pending' | 'Under Review' | 'Approved' | 'Rejected';
  // Personal
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other';
  nationality: string;
  bloodGroup?: string;
  // Academic
  applyingForClass: string;
  previousSchool?: string;
  previousGrade?: string;
  // Parent/Guardian
  parentName: string;
  parentRelation: string;
  parentPhone: string;
  parentEmail: string;
  parentCNIC?: string;
  // Address
  address: string;
  city: string;
  // Admin
  adminNotes?: string;
  parentPortalPassword?: string;
  // Uploaded documents
  profilePhoto?: string;
  previousResultFilename?: string;
}

export interface StudentPromotion {
  id: string;
  studentId: string;
  fromClassId: string;
  fromSectionId: string;
  toClassId: string;
  toSectionId: string;
  academicYearId: string;
  promotedBy?: string;
  promotedAt: string;
  studentName?: string;
  fromClassName?: string;
  toClassName?: string;
  outcome?: 'promoted' | 'retained' | 'withdrawn' | 'graduated';
}

// ── Attendance Module ──────────────────────────────────────────────────────────
export interface AttendanceSession {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  date: string;
  takenBy?: string;
  status: string;
  className?: string;
  sectionName?: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: 'Present' | 'Absent' | 'Late' | 'Leave' | 'Half Day';
  remarks?: string;
  studentName?: string;
}

// ── Timetable Module ────────────────────────────────────────────────────────────
export interface Room {
  id: string;
  roomNo: string;
  capacity: number;
  building?: string;
}

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  periodName?: string;
}

export interface Timetable {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  teacherId: number;
  roomId: string;
  dayOfWeek: string;
  timeSlotId: string;
  className?: string;
  sectionName?: string;
  subjectName?: string;
  teacherName?: string;
  roomNo?: string;
  startTime?: string;
  endTime?: string;
  periodName?: string;
}

// ── Exam Schedule ───────────────────────────────────────────────────────────────
export interface ExamSchedule {
  id: string;
  examId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  examDate: string;
  startTime?: string;
  endTime?: string;
  roomId?: string;
  className?: string;
  sectionName?: string;
  subjectName?: string;
  roomNo?: string;
}

// ── Result Details ──────────────────────────────────────────────────────────────
export interface ResultDetail {
  id: string;
  resultId: string;
  subjectId: string;
  obtainedMarks: number;
  remarks?: string;
  subjectName?: string;
}

export interface ResultWithDetails {
  id: string;
  examId: string;
  studentId: string;
  classId: string;
  sectionId: string;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade?: string;
  position?: number;
  status: string;
  reviewedBy?: string;
  approvedBy?: string;
  studentName?: string;
  examName?: string;
  details?: ResultDetail[];
}
