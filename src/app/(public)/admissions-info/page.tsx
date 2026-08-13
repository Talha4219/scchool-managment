"use client";
import Link from "next/link";
import Image from "next/image";
import { FileText, CalendarDays, CheckCircle2, ArrowRight, GraduationCap, Users, Clock } from "lucide-react";

const programs = [
  { level: "Pre-School",    age: "Ages 3–5",   grades: "Nursery & KG",   icon: "🎨", desc: "Play-based learning fostering creativity, social skills, and early literacy." },
  { level: "Primary",       age: "Ages 6–10",  grades: "Grade 1–5",      icon: "📚", desc: "Core academics emphasizing foundational literacy, numeracy and character." },
  { level: "Middle School", age: "Ages 11–13", grades: "Grade 6–8",      icon: "🔬", desc: "Exploratory curriculum introducing specialized subjects and enrichment." },
  { level: "High School",   age: "Ages 14–16", grades: "Grade 9–10",     icon: "🎓", desc: "Rigorous academics preparing students for board examinations." },
  { level: "O-Level",       age: "Ages 15–17", grades: "O-Level I & II", icon: "🌍", desc: "Cambridge International curriculum with globally recognized qualifications." },
  { level: "A-Level",       age: "Ages 17–19", grades: "A1 & A2",        icon: "🏛️", desc: "University-preparatory Cambridge AS & A Level certifications." },
];

const steps = [
  { step: "01", title: "Download & Fill Form",     desc: "Obtain the admission form from our website or school office and fill it completely." },
  { step: "02", title: "Submit Documents",          desc: "Submit required documents: birth certificate, previous report cards, CNIC copy of parent/guardian." },
  { step: "03", title: "Entrance Assessment",       desc: "Attend a grade-appropriate entry test (Math, English, General Knowledge) at our campus." },
  { step: "04", title: "Parent Interview",          desc: "A brief meeting with the class coordinator to discuss the student's background and expectations." },
  { step: "05", title: "Offer Letter & Fee",        desc: "Receive an official offer letter and complete the enrollment by paying the admission fee." },
  { step: "06", title: "Welcome to the Family",    desc: "Receive your student ID, kit list, timetable, and school uniform details. Classes begin!" },
];

const docs = ["Original Birth Certificate", "School Leaving Certificate", "Last 2 years' Report Cards", "4 Passport-size Photographs", "Parent/Guardian CNIC Copy", "Medical Fitness Certificate"];

export default function AdmissionsInfoPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative h-72 sm:h-80 overflow-hidden">
        <Image src="/hero-banner.png" alt="Admissions" fill className="object-cover" />
        <div className="absolute inset-0 bg-[#0B1B3D]/80" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sky-300 text-xs font-semibold uppercase tracking-widest mb-4">
            <GraduationCap className="w-3 h-3" /> Enroll Today
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white font-headline">Admissions 2026–27</h1>
          <p className="mt-3 text-white/70 max-w-xl">Applications for the new academic session are now open. Secure your child's place today.</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
        <div className="max-w-7xl mx-auto text-sm text-gray-500">
          <Link href="/" className="hover:text-[#1e3a6e]">Home</Link> <span className="mx-2">/</span> <span className="text-gray-800">Admissions</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Alert Banner */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 mb-14">
          <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
          <div>
            <p className="font-bold text-emerald-800">Admissions are Open for 2026–27 Session</p>
            <p className="text-emerald-700 text-sm mt-0.5">Limited seats available. Apply early to avoid disappointment. Last date: <strong>August 1, 2026</strong>.</p>
          </div>
          <Link href="/apply" className="ml-auto shrink-0">
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all">Apply Now</button>
          </Link>
        </div>

        {/* Programs Grid */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-[#1e3a6e] font-headline mb-3">Academic Programs</h2>
          <p className="text-gray-500 mb-10">We offer a full continuum of education from pre-school through A-Levels.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map((p) => (
              <div key={p.level} className="rounded-2xl border border-gray-100 p-6 hover:shadow-md hover:-translate-y-1 transition-all">
                <div className="text-3xl mb-3">{p.icon}</div>
                <h3 className="font-bold text-[#1e3a6e] text-lg">{p.level}</h3>
                <div className="flex gap-3 my-2">
                  <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-100">{p.grades}</span>
                  <span className="bg-gray-50 text-gray-500 text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-100">{p.age}</span>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Admission Process */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-[#1e3a6e] font-headline mb-3">Admission Process</h2>
          <p className="text-gray-500 mb-10">A simple 6-step journey to join the Scholarly Central family.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((s) => (
              <div key={s.step} className="flex gap-4">
                <div className="shrink-0 w-12 h-12 rounded-2xl bg-[#1e3a6e] text-white font-bold text-lg flex items-center justify-center">
                  {s.step}
                </div>
                <div>
                  <h4 className="font-bold text-[#1e3a6e] mb-1">{s.title}</h4>
                  <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Documents & CTA */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl bg-gray-50 border border-gray-100">
            <h3 className="font-bold text-[#1e3a6e] text-xl mb-5 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" /> Required Documents
            </h3>
            <ul className="space-y-3">
              {docs.map((d) => (
                <li key={d} className="flex items-center gap-3 text-gray-600 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> {d}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-8 rounded-3xl bg-[#0B1B3D] text-white flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-xl mb-3">Ready to Apply?</h3>
              <p className="text-white/70 leading-relaxed mb-6">Fill out our online admission form and our admissions team will contact you within 24 hours to guide you through the next steps.</p>
            </div>
            <div className="space-y-3">
              <Link href="/apply">
                <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                  Start Online Application <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link href="/contact">
                <button className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold py-3 rounded-xl transition-all">
                  Contact Admissions Office
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
