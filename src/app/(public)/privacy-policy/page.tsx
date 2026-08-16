import Link from "next/link";
import { ShieldCheck, Mail, Phone } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | Classora",
  description: "How Classora collects, uses, and protects data for schools, students, parents, and staff.",
};

const sections = [
  {
    title: "1. Who We Are",
    body: "Classora (\"we\", \"us\", \"our\") is a school management platform (ERP) used by schools to run admissions, academics, attendance, fees, HR, transport, hostel, library, and communications. This policy explains how we handle data belonging to schools, students, parents/guardians, and staff who use Classora.",
  },
  {
    title: "2. Data We Collect",
    body: "Depending on how your school uses Classora, we process: student records (name, class, section, attendance, grades, fee ledgers); staff records (name, role, attendance, payroll data); parent/guardian contact details (phone, email) used for notifications; account credentials (hashed passwords, session tokens); and usage data such as login timestamps and audit logs of actions taken in the system.",
  },
  {
    title: "3. How We Use Data",
    body: "Data is used to operate the core product: displaying dashboards, generating report cards and fee vouchers, sending attendance/fee/exam notifications via email, SMS, or WhatsApp, processing online fee payments through JazzCash/EasyPaisa, and maintaining audit logs for accountability. We do not sell student, parent, or staff data to third parties.",
  },
  {
    title: "4. Who Can See What",
    body: "Access is role-based. Admins see school-wide data; teachers see data for their assigned classes; parents see only their own child's records; students see only their own records. Every sensitive action (grade changes, fee adjustments, permission changes) is written to an audit log visible to school admins.",
  },
  {
    title: "5. Third-Party Processors",
    body: "We use trusted third parties strictly to deliver the service: a database provider (PostgreSQL hosting) to store your school's data, an email provider (SMTP) for transactional email, Meta's WhatsApp Cloud API for WhatsApp notifications (only if your school enables and configures it), and JazzCash/EasyPaisa for processing online fee payments (we do not store card or wallet credentials — those are handled directly by the payment gateway).",
  },
  {
    title: "6. Data Retention",
    body: "School data is retained for as long as your school's account is active, plus a reasonable period afterward to allow for account recovery or legally required record-keeping. Schools can request full data export or deletion at any time by contacting us.",
  },
  {
    title: "7. Data Security",
    body: "Passwords are stored using industry-standard hashing (never in plain text). Access to the system requires authentication, and role-based permissions restrict what each user type can view or modify. We recommend schools enable HTTPS-only access and rotate admin credentials periodically.",
  },
  {
    title: "8. Children's Data",
    body: "Classora is used by schools to manage records belonging to minors. Student data is entered and managed by the school (not directly by children), and access is restricted to authorized school staff and the student's own parent/guardian account. Schools are responsible for obtaining any consent required under local law before entering student data into the system.",
  },
  {
    title: "9. Your Rights",
    body: "Schools, parents, and staff may request access to, correction of, or deletion of personal data held in Classora by contacting their school administrator (who manages the account) or by reaching out to us directly using the contact details below.",
  },
  {
    title: "10. Changes to This Policy",
    body: "We may update this policy as the product evolves. Material changes will be communicated to school administrators. Continued use of Classora after an update constitutes acceptance of the revised policy.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-[#0a0118] px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-violet-300 text-xs font-semibold uppercase tracking-widest mb-4">
          <ShieldCheck className="w-3.5 h-3.5" /> Privacy
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white font-headline">Privacy Policy</h1>
        <p className="mt-3 text-white/60 max-w-xl mx-auto">Last updated: August 2026</p>
      </div>

      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
        <div className="max-w-4xl mx-auto text-sm text-gray-500">
          <Link href="/" className="hover:text-violet-700">Home</Link> <span className="mx-2">/</span> <span className="text-gray-800">Privacy Policy</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="text-gray-600 leading-relaxed text-lg mb-12">
          This policy explains how Classora collects, uses, and protects data for the schools that use our platform, and for the students, parents, and staff whose information those schools manage within it.
        </p>

        <div className="space-y-10">
          {sections.map((s) => (
            <div key={s.title}>
              <h2 className="font-headline text-xl font-bold text-[#1e1033] mb-3">{s.title}</h2>
              <p className="text-gray-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-gray-100 bg-gray-50 p-8">
          <h3 className="font-headline text-lg font-bold text-[#1e1033] mb-4">Questions about this policy?</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-violet-600 shrink-0" />
              <a href="mailto:talhashamsch@gmail.com" className="text-gray-600 hover:text-violet-700">talhashamsch@gmail.com</a>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-violet-600 shrink-0" />
              <span className="text-gray-600">0300 3380058</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
