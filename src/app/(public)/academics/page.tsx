"use client";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, Brain, FlaskConical, Monitor, Globe2, ArrowRight, CheckCircle2 } from "lucide-react";

const subjects = [
  { name: "Mathematics",       code: "MTH", grade: "All Grades",  type: "Core",     icon: "➕" },
  { name: "English Language",  code: "ENG", grade: "All Grades",  type: "Core",     icon: "📖" },
  { name: "Urdu",              code: "URD", grade: "All Grades",  type: "Core",     icon: "✍️" },
  { name: "Physics",           code: "PHY", grade: "Grade 9+",    type: "Core",     icon: "⚡" },
  { name: "Chemistry",         code: "CHM", grade: "Grade 9+",    type: "Core",     icon: "🧪" },
  { name: "Biology",           code: "BIO", grade: "Grade 9+",    type: "Core",     icon: "🦋" },
  { name: "Computer Science",  code: "CS",  grade: "Grade 8+",    type: "Elective", icon: "💻" },
  { name: "History",           code: "HST", grade: "All Grades",  type: "Core",     icon: "🏛️" },
  { name: "Geography",         code: "GEO", grade: "All Grades",  type: "Core",     icon: "🌍" },
  { name: "Art & Design",      code: "ART", grade: "All Grades",  type: "Elective", icon: "🎨" },
  { name: "Islamic Studies",   code: "ISL", grade: "All Grades",  type: "Core",     icon: "☪️" },
  { name: "Pakistan Studies",  code: "PKS", grade: "Grade 9–10",  type: "Core",     icon: "🇵🇰" },
];

const features = [
  { icon: Brain,       title: "Smart Learning",       desc: "Interactive whiteboards, projectors, and digital labs in every classroom for an immersive learning experience." },
  { icon: FlaskConical, title: "Lab-based Science",   desc: "Separate Physics, Chemistry, and Biology labs with modern equipment for hands-on experiments." },
  { icon: Monitor,     title: "Computer Science",     desc: "4 fully equipped computer labs with high-speed internet and the latest programming software." },
  { icon: Globe2,      title: "Cambridge Programs",   desc: "O-Level and A-Level programs fully affiliated with Cambridge Assessment International Education (CAIE)." },
  { icon: BookOpen,    title: "Extensive Library",    desc: "60,000+ books, digital e-library, and research terminals available to all students and staff." },
  { icon: CheckCircle2, title: "Regular Assessments", desc: "Continuous assessment system with monthly tests, mid-terms, and final exams to track progress." },
];

export default function AcademicsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative h-72 sm:h-80 overflow-hidden">
        <Image src="/hero-banner.png" alt="Academics" fill className="object-cover" />
        <div className="absolute inset-0 bg-[#0B1B3D]/80" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sky-300 text-xs font-semibold uppercase tracking-widest mb-4">
            <BookOpen className="w-3 h-3" /> Curriculum
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white font-headline">Academics</h1>
          <p className="mt-3 text-white/70 max-w-xl">A rigorous, holistic curriculum designed to inspire curiosity and build lifelong learners.</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
        <div className="max-w-7xl mx-auto text-sm text-gray-500">
          <Link href="/" className="hover:text-[#1e3a6e]">Home</Link> <span className="mx-2">/</span> <span className="text-gray-800">Academics</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Academic Features */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-[#1e3a6e] font-headline mb-3">What Makes Us Different</h2>
          <p className="text-gray-500 mb-10">We combine traditional academic rigor with modern, technology-driven teaching methods.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-[#1e3a6e] mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Subject List */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-[#1e3a6e] font-headline mb-3">Subjects Offered</h2>
          <p className="text-gray-500 mb-10">Our comprehensive subject catalogue covers core disciplines and enrichment electives.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((s) => (
              <div key={s.name} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm transition-all">
                <span className="text-2xl">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#1e3a6e]">{s.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.grade}</div>
                </div>
                <div className="flex gap-1.5">
                  <code className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">{s.code}</code>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.type === "Core" ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-violet-50 text-violet-700 border border-violet-100"}`}>{s.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cambridge Programs CTA */}
        <div className="rounded-3xl bg-gradient-to-r from-[#0B1B3D] to-[#1e3a6e] text-white p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sky-300 text-xs font-semibold uppercase tracking-widest mb-4">
              <Globe2 className="w-3 h-3" /> Cambridge Affiliated
            </div>
            <h2 className="text-2xl font-bold mb-2">O-Level & A-Level Programs</h2>
            <p className="text-white/70 max-w-lg">Our Cambridge programs are fully accredited with CAIE. Students receive internationally recognized qualifications opening doors to universities worldwide.</p>
          </div>
          <Link href="/admissions-info" className="shrink-0">
            <button className="bg-white text-[#1e3a6e] font-bold px-7 py-3 rounded-xl hover:bg-blue-50 transition-all flex items-center gap-2">
              Apply Now <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
