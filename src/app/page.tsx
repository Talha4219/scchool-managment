"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { useAppState } from "@/lib/state-context";
import {
  GraduationCap, Menu, X, ChevronRight, Phone, Mail, MapPin,
  Users, BookOpen, Trophy, Star, Award, Clock, ArrowRight,
  Facebook, Twitter, Instagram, Youtube, Linkedin,
  MonitorPlay, FlaskConical, Library, Dumbbell, Bus, UtensilsCrossed,
  Download, CalendarDays, FileText, Newspaper,
  MessageSquare, Quote, ChevronDown, PlayCircle,
  ShieldCheck, BarChart3, CreditCard, Bell, Brain, Layers,
  UserCog, School, Microscope, BookMarked,
  TrendingUp, CheckCircle2, Zap, Globe2,
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

const navLinks = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Admissions", href: "/admissions-info" },
  { label: "Academics", href: "/academics" },
  { label: "Faculty & Staff", href: "/faculty" },
  { label: "Student Life", href: "/student-life" },
  { label: "Events & News", href: "/events-news" },
  { label: "Gallery", href: "/gallery-page" },
  { label: "Contact Us", href: "/contact" },
];

const stats = [
  { value: "3,200+", label: "Total Students", icon: Users },
  { value: "180+", label: "Qualified Teachers", icon: BookOpen },
  { value: "64", label: "Classes", icon: School },
  { value: "12,400+", label: "Graduates", icon: GraduationCap },
  { value: "97%", label: "Success Rate", icon: Trophy },
  { value: "25+", label: "Years of Excellence", icon: Award },
];

const quickPortals = [
  { label: "Student Login", icon: Users, color: "from-blue-500 to-blue-700", href: "/dashboard" },
  { label: "Parent Login", icon: UserCog, color: "from-emerald-500 to-emerald-700", href: "/dashboard" },
  { label: "Teacher Login", icon: BookMarked, color: "from-violet-500 to-violet-700", href: "/dashboard" },
  { label: "Admin Login", icon: ShieldCheck, color: "from-rose-500 to-rose-700", href: "/dashboard" },
  { label: "Online Fee Payment", icon: CreditCard, color: "from-blue-500 to-blue-700", href: "/dashboard" },
  { label: "Results & Reports", icon: BarChart3, color: "from-cyan-500 to-cyan-700", href: "/dashboard" },
  { label: "Attendance Portal", icon: CalendarDays, color: "from-pink-500 to-pink-700", href: "/dashboard" },
  { label: "Homework & Assignments", icon: FileText, color: "from-indigo-500 to-indigo-700", href: "/dashboard" },
];

const smsFeatures = [
  {
    title: "Student Management",
    color: "border-blue-500 bg-blue-50",
    iconColor: "text-blue-600",
    icon: Users,
    items: ["Comprehensive Student Records", "Daily Attendance Tracking", "Academic Performance Analytics", "Behavior & Discipline Logs"],
  },
  {
    title: "Teacher Management",
    color: "border-violet-500 bg-violet-50",
    iconColor: "text-violet-600",
    icon: BookMarked,
    items: ["Class Timetable Builder", "Leave Management System", "Grade Submission Portal", "Professional Development Tracking"],
  },
  {
    title: "Parent Portal",
    color: "border-emerald-500 bg-emerald-50",
    iconColor: "text-emerald-600",
    icon: UserCog,
    items: ["Real-time Progress Reports", "Live Attendance Monitoring", "Fee Tracking & Payment", "Direct Teacher Communication"],
  },
  {
    title: "Administration",
    color: "border-rose-500 bg-rose-50",
    iconColor: "text-rose-600",
    icon: ShieldCheck,
    items: ["Digital Admissions Pipeline", "Fee Ledger & Management", "Transport Route Planning", "Library Catalog System"],
  },
];

const announcements = [
  { date: "Jun 21, 2026", tag: "Holiday", title: "Summer Vacation Schedule 2026", desc: "School will remain closed from June 25 to July 31. Classes resume August 1.", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { date: "Jun 18, 2026", tag: "Examinations", title: "Term 2 Examination Timetable Published", desc: "Final exams begin July 10. Download the detailed subject-wise schedule.", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { date: "Jun 15, 2026", tag: "Admissions", title: "New Academic Year Admissions Open", desc: "Applications for Grade 1 to Grade 12 for 2026–27 session are now open.", color: "bg-sky-100 text-sky-800 border-sky-200" },
  { date: "Jun 12, 2026", tag: "Notice", title: "Parent-Teacher Meeting – Grade 9 & 10", desc: "PTM scheduled for June 28. Please confirm attendance via the portal.", color: "bg-indigo-50 text-indigo-700 border-indigo-100" },
];

const events = [
  { date: "Jul 15", month: "2026", title: "Annual Sports Day", desc: "Inter-house athletic competitions, relay races and field events. All parents welcome.", icon: Dumbbell, gradient: "from-blue-400 to-blue-600" },
  { date: "Aug 10", month: "2026", title: "Science & Technology Fair", desc: "Students showcase innovative projects. Guest judges from leading tech institutions.", icon: Microscope, gradient: "from-sky-400 to-blue-500" },
  { date: "Sep 5", month: "2026", title: "Annual Cultural Function", desc: "A grand evening of student performances — drama, music, dance, and art exhibition.", icon: Star, gradient: "from-indigo-400 to-pink-500" },
  { date: "Sep 20", month: "2026", title: "Parent-Teacher Conference", desc: "Quarterly academic progress review meetings with class teachers.", icon: Users, gradient: "from-sky-400 to-blue-500" },
  { date: "Oct 8", month: "2026", title: "Educational Trip – National Museum", desc: "Grade 6–8 students visit the National Museum and Heritage Park.", icon: Bus, gradient: "from-sky-400 to-blue-500" },
];

const programs = [
  { level: "Pre-School", age: "Ages 3–5", grades: "Nursery & KG", desc: "Play-based learning fostering creativity, social skills, and early literacy in a nurturing environment.", color: "from-sky-400 to-blue-500", icon: "🎨" },
  { level: "Primary School", age: "Ages 6–10", grades: "Grade 1–5", desc: "Core academics with emphasis on foundational literacy, numeracy, and holistic character development.", color: "from-sky-400 to-indigo-500", icon: "📚" },
  { level: "Middle School", age: "Ages 11–13", grades: "Grade 6–8", desc: "Exploratory curriculum introducing specialized subjects, labs, and enrichment activities.", color: "from-blue-400 to-indigo-500", icon: "🔬" },
  { level: "High School", age: "Ages 14–16", grades: "Grade 9–10", desc: "Rigorous academics preparing students for board examinations with focused subject specialization.", color: "from-indigo-400 to-indigo-500", icon: "🎓" },
  { level: "O-Level", age: "Ages 15–17", grades: "O-Level I & II", desc: "Cambridge International curriculum with internationally recognized qualifications.", color: "from-sky-400 to-blue-500", icon: "🌍" },
  { level: "A-Level", age: "Ages 17–19", grades: "A1 & A2", desc: "Advanced university-preparatory program with Cambridge AS & A Level certifications.", color: "from-sky-400 to-blue-500", icon: "🏛️" },
];

const facilities = [
  { name: "Smart Classrooms", desc: "Interactive whiteboards, digital projectors, and high-speed Wi-Fi in every room.", icon: MonitorPlay, color: "bg-blue-500" },
  { name: "Computer Labs", desc: "4 fully equipped labs with latest hardware, programming suites and internet access.", icon: Brain, color: "bg-indigo-600" },
  { name: "Science Labs", desc: "Separate Physics, Chemistry, and Biology labs with modern experimental equipment.", icon: FlaskConical, color: "bg-sky-500" },
  { name: "Library", desc: "60,000+ books, digital e-library access, reading rooms and research terminals.", icon: Library, color: "bg-blue-600" },
  { name: "Sports Complex", desc: "Cricket ground, basketball and volleyball courts, indoor gymnasium and swimming pool.", icon: Dumbbell, color: "bg-blue-600" },
  { name: "Transport Services", desc: "GPS-tracked fleet covering 30+ routes across the city with trained drivers.", icon: Bus, color: "bg-sky-500" },
  { name: "Cafeteria", desc: "Hygienic canteen serving nutritious, balanced meals under dietitian supervision.", icon: UtensilsCrossed, color: "bg-indigo-600" },
  { name: "Auditorium", desc: "1,200-seat state-of-the-art auditorium for functions, seminars, and performances.", icon: Layers, color: "bg-indigo-500" },
];

const testimonials = [
  { name: "Ayesha Malik", role: "Parent of Grade 8 Student", rating: 5, text: "The parent portal is a game-changer! I can track attendance, check results, and communicate with teachers all in one place. My daughter has never been more motivated.", avatar: "AM" },
  { name: "Muhammad Usman", role: "Alumni, Batch 2022", rating: 5, text: "Scholarly Central shaped not just my academic career but my character. The teachers are genuinely invested in every student's success. I'm now at a top engineering university.", avatar: "MU" },
  { name: "Sarah Johnson", role: "Parent of Twin Boys (Grade 5)", rating: 5, text: "Exceptional institution! The smart classrooms and extracurricular programs keep my sons engaged and excited about learning every single day.", avatar: "SJ" },
  { name: "Dr. Khalid Hussain", role: "Parent, Former Board Member", rating: 5, text: "Twenty years in education, and I've never seen such a well-rounded school management system. The fee transparency and communication are world class.", avatar: "KH" },
];

const newsItems = [
  { category: "Achievement", title: "Students Win National Robotics Championship", date: "Jun 19, 2026", desc: "Our Grade 11 robotics team swept gold at the National Science Olympiad.", icon: Trophy, color: "text-blue-500" },
  { category: "Academic", title: "100% Pass Rate in O-Level Examinations", date: "Jun 10, 2026", desc: "Proud to announce another year of 100% Cambridge O-Level results with 42 A* grades.", icon: GraduationCap, color: "text-blue-500" },
  { category: "Event Report", title: "Annual Function 2026 Recap", date: "May 28, 2026", desc: "Over 2,000 guests attended our spectacular Annual Cultural Night — a night to remember.", icon: Star, color: "text-indigo-500" },
  { category: "Community", title: "Tree Plantation Drive – 500 Saplings Planted", date: "May 15, 2026", desc: "Students and staff together planted 500 trees across campus as part of our Green Initiative.", icon: Layers, color: "text-sky-500" },
];

const downloads = [
  { name: "Admission Form 2026–27", size: "PDF, 245 KB", icon: FileText, color: "text-blue-600 bg-blue-50" },
  { name: "School Prospectus", size: "PDF, 8.2 MB", icon: BookOpen, color: "text-indigo-600 bg-indigo-50" },
  { name: "Academic Calendar 2026", size: "PDF, 320 KB", icon: CalendarDays, color: "text-sky-600 bg-sky-50" },
  { name: "Fee Structure 2026–27", size: "PDF, 180 KB", icon: CreditCard, color: "text-blue-600 bg-blue-50" },
  { name: "Grade 9–10 Syllabus", size: "PDF, 1.1 MB", icon: Newspaper, color: "text-sky-600 bg-sky-50" },
  { name: "O-Level Syllabus", size: "PDF, 950 KB", icon: Award, color: "text-sky-600 bg-sky-50" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const { students, classes } = useAppState();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [formSent, setFormSent] = useState(false);
  const [countedStats, setCountedStats] = useState(false);
  const teacherCount = useMemo(() => new Set(classes.map(c => c.teacherName).filter(Boolean)).size, [classes]);
  const classCount = classes.length;
  const studentCount = students.length;
  const liveStats = [
    { value: `${studentCount > 0 ? studentCount : '3,200'}+`, label: "Total Students", icon: Users },
    { value: `${teacherCount > 0 ? teacherCount : '180'}+`, label: "Qualified Teachers", icon: BookOpen },
    { value: `${classCount > 0 ? classCount : '64'}`, label: "Classes", icon: School },
    { value: "12,400+", label: "Graduates", icon: GraduationCap },
    { value: "97%", label: "Success Rate", icon: Trophy },
    { value: "25+", label: "Years of Excellence", icon: Award },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      if (!countedStats && window.scrollY > 400) setCountedStats(true);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [countedStats]);

  const handleContact = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSent(true);
    setTimeout(() => setFormSent(false), 4000);
    setContactForm({ name: "", email: "", phone: "", subject: "", message: "" });
  };

  return (
    <div className="min-h-screen bg-white font-body overflow-x-hidden">

      {/* ── ANNOUNCEMENT TICKER BAR ────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-[#1e3a6e] h-9 flex items-center overflow-hidden">
        <div className="shrink-0 bg-sky-500 h-full flex items-center px-4 z-10 gap-2">
          <Bell className="w-3 h-3 text-white" />
          <span className="text-white text-xs font-bold uppercase tracking-wider whitespace-nowrap">Latest</span>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-ticker whitespace-nowrap text-white/80 text-xs font-medium">
            🎓 Admissions Open for 2026–27 Session &nbsp;·&nbsp; 📅 Annual Sports Day: July 15, 2026 &nbsp;·&nbsp; 🏆 100% Pass Rate in O-Level Examinations &nbsp;·&nbsp; 📢 Summer Vacation: June 25 – July 31 &nbsp;·&nbsp; 🔬 Science Fair: August 10, 2026 &nbsp;·&nbsp; 🌟 Robotics Team Wins National Championship &nbsp;·&nbsp;
          </div>
        </div>
        <div className="shrink-0 px-4">
          <Link href="/apply" className="text-sky-300 hover:text-white text-xs font-semibold transition-colors whitespace-nowrap">Apply Now →</Link>
        </div>
      </div>

      {/* ── NAVIGATION ─────────────────────────────────────────────── */}
      <header
        id="home"
        className={`fixed top-9 left-0 right-0 z-50 transition-all duration-300 ${scrolled || mobileMenuOpen
            ? "bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-100"
            : "bg-gradient-to-b from-[#0B1B3D]/80 via-[#0B1B3D]/30 to-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[68px] flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl transition-all duration-300 ${scrolled || mobileMenuOpen ? "bg-[#1e3a6e]" : "bg-white/15 backdrop-blur-sm border border-white/20"
                }`}>
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className={`font-headline text-[19px] font-bold tracking-tight block transition-colors leading-tight ${scrolled || mobileMenuOpen ? "text-[#1e3a6e]" : "text-white"
                  }`}>
                  Scholarly Central
                </span>
                <span className={`text-[9px] font-semibold tracking-[0.15em] uppercase transition-colors ${scrolled || mobileMenuOpen ? "text-gray-400" : "text-white/70"
                  }`}>
                  {/* School Management System */}
                </span>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden xl:flex items-center gap-0.5">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-[13px] font-semibold transition-all ${scrolled || mobileMenuOpen
                      ? "text-gray-600 hover:text-[#1e3a6e] hover:bg-gray-100"
                      : "text-white/90 hover:text-white hover:bg-white/10"
                    }`}
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* CTA + Mobile Toggle */}
            <div className="flex items-center gap-2.5">
              <Link href="/login" className="hidden sm:block">
                <button className={`font-semibold px-4 py-2 rounded-xl text-sm transition-all ${scrolled || mobileMenuOpen
                    ? "text-[#1e3a6e] border-2 border-[#1e3a6e] hover:bg-[#1e3a6e] hover:text-white"
                    : "text-white border-2 border-white/30 hover:bg-white/10"
                  }`}>
                  Sign In
                </button>
              </Link>
              <Link href="/apply" className="hidden sm:block">
                <button className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0">
                  Apply Now
                </button>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`xl:hidden p-2 rounded-lg transition-colors ${scrolled || mobileMenuOpen ? "text-gray-600" : "text-white"
                  }`}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden bg-white border-b border-gray-200 px-4 pb-6 shadow-lg">
            <nav className="flex flex-col gap-1 mt-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 text-gray-600 hover:text-[#1e3a6e] hover:bg-blue-50 rounded-xl font-medium transition-colors text-sm"
                >
                  {link.label}
                </a>
              ))}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Link href="/login">
                  <button className="w-full border-2 border-[#1e3a6e] text-[#1e3a6e] font-bold py-3 rounded-xl text-sm">
                    Sign In
                  </button>
                </Link>
                <Link href="/apply">
                  <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm">
                    Apply Now
                  </button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ── HERO SECTION ───────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden pt-9">
        {/* Background */}
        <div className="absolute inset-0">
          <Image
            src="/hero-banner.png"
            alt="Scholarly Central School Campus"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-[#0B1B3D]/80" />
        </div>

        {/* Hero Content — centered, single column */}
        <div className="relative z-20 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-28 text-center">

          {/* Trust badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-semibold uppercase tracking-widest mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            Accredited · Award-Winning · Est. 2001
          </div>

          {/* Headline */}
          <h1 className="font-headline text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
            Welcome to{" "}
            <span className="text-sky-400">Scholarly Central</span>
          </h1>

          {/* Sub-headline */}
          <p className="text-xl text-white/70 leading-relaxed max-w-2xl mx-auto mb-10">
            A premier institution nurturing bright minds since 2001 — committed to academic excellence,
            character development, and preparing students for a rapidly changing world.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
            <Link href="/apply">
              <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-all hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5">
                Apply for Admission <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Link href="/login">
              <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-all hover:-translate-y-0.5">
                Student Portal <ChevronRight className="w-5 h-5" />
              </button>
            </Link>
            <Link href="/contact">
              <button className="flex items-center gap-2 border border-white/20 text-white/80 hover:text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-all hover:-translate-y-0.5">
                Contact Us <Phone className="w-4 h-4" />
              </button>
            </Link>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 border-t border-white/10 pt-10">
            {[
              { n: `${studentCount > 0 ? studentCount : '3,200'}+`, l: "Students Enrolled" },
              { n: `${teacherCount > 0 ? teacherCount : '180'}+`, l: "Qualified Teachers" },
              { n: "97%", l: "Success Rate" },
              { n: "25+", l: "Years of Excellence" },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <div className="text-3xl font-bold text-sky-400 font-headline">{s.n}</div>
                <div className="text-sm text-white/50 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/30 z-20">
          <span className="text-[10px] tracking-[0.2em] uppercase font-medium">Scroll</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </div>
      </section>

      {/* ── QUICK ACCESS PORTAL ────────────────────────────────────── */}
      <section id="portal" className="py-16 bg-[#0B1B3D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="font-headline text-3xl font-bold text-white mb-2">Quick Access Portal</h2>
            <p className="text-white/50 text-sm">One click to your personalized dashboard</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {quickPortals.map((portal) => (
              <Link key={portal.label} href={portal.href}>
                <div className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${portal.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <portal.icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white/80 text-xs text-center font-medium leading-tight">{portal.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCHOOL STATISTICS ─────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-[#1e3a6e] via-[#243b6e] to-[#0B1B3D] relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-500/20 text-sky-400 text-xs font-bold uppercase tracking-wider mb-4">
              <Star className="w-3 h-3" /> Our Achievements in Numbers
            </div>
            <h2 className="font-headline text-4xl font-bold text-white">Milestones That Define Us</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {liveStats.map((stat) => (
              <div key={stat.label} className="group text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-600/20 group-hover:border-blue-500/30 transition-all duration-300">
                  <stat.icon className="w-7 h-7 text-sky-400" />
                </div>
                <div className="font-headline text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-white/50 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT SCHOOL ──────────────────────────────────────────── */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Images */}
            <div className="relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <Image src="/hero-banner.png" alt="School Campus" width={700} height={480} className="w-full object-cover h-80 lg:h-[420px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B1B3D]/60 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex gap-3">
                    <div className="flex-1 bg-white/95 backdrop-blur-sm rounded-xl p-4 text-center shadow-lg">
                      <div className="font-headline text-2xl font-bold text-[#1e3a6e]">25+</div>
                      <div className="text-xs text-gray-500 font-medium">Years Excellence</div>
                    </div>
                    <div className="flex-1 bg-blue-600 rounded-xl p-4 text-center shadow-lg">
                      <div className="font-headline text-2xl font-bold text-white">97%</div>
                      <div className="text-xs text-white/80 font-medium">Success Rate</div>
                    </div>
                    <div className="flex-1 bg-white/95 backdrop-blur-sm rounded-xl p-4 text-center shadow-lg">
                      <div className="font-headline text-2xl font-bold text-[#1e3a6e]">{studentCount > 0 ? studentCount : '3,200'}</div>
                      <div className="text-xs text-gray-500 font-medium">Students</div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating badge */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#1e3a6e] rounded-2xl flex flex-col items-center justify-center shadow-xl text-center rotate-3">
                <Award className="w-8 h-8 text-sky-400 mb-1" />
                <span className="text-[10px] text-white font-bold leading-tight">Best School<br />2025</span>
              </div>
            </div>

            {/* Right: Content */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e3a6e]/8 border border-[#1e3a6e]/15 text-[#1e3a6e] text-xs font-bold uppercase tracking-wider">
                <BookOpen className="w-3 h-3" /> About Scholarly Central
              </div>
              <h2 className="font-headline text-4xl lg:text-5xl font-bold text-[#1e3a6e] leading-tight">
                Two Decades of <span className="text-blue-500 italic">Shaping Futures</span>
              </h2>
              <p className="text-gray-600 leading-relaxed text-lg">
                Established in 2001, Scholarly Central has grown from a small institution of 80 students to one of the nation's most respected schools with over 3,200 enrolled learners. We combine time-honored academic traditions with cutting-edge technology.
              </p>

              {/* Vision & Mission */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mb-3">
                    <Star className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="font-bold text-[#1e3a6e] mb-2">Our Vision</h4>
                  <p className="text-gray-500 text-sm leading-relaxed">To be a globally recognized center of academic excellence and character formation.</p>
                </div>
                <div className="p-5 rounded-2xl bg-blue-50 border border-amber-100">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mb-3">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="font-bold text-[#1e3a6e] mb-2">Our Mission</h4>
                  <p className="text-gray-500 text-sm leading-relaxed">To empower every student with knowledge, critical thinking, and ethical values.</p>
                </div>
              </div>

              {/* Principal's Message */}
              <div className="flex gap-4 p-5 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="shrink-0">
                  <Image src="/principal.png" alt="Principal" width={72} height={72} className="rounded-xl object-cover w-16 h-16" />
                </div>
                <div>
                  <Quote className="w-5 h-5 text-blue-500 mb-2" />
                  <p className="text-gray-600 text-sm italic leading-relaxed mb-2">
                    "Education is not merely the transfer of information — it is the awakening of curiosity, the cultivation of wisdom, and the courage to dream."
                  </p>
                  <p className="font-bold text-[#1e3a6e] text-sm">Dr. James Al-Rashid</p>
                  <p className="text-gray-400 text-xs">Principal & CEO, Scholarly Central</p>
                </div>
              </div>

              <button className="flex items-center gap-2 text-[#1e3a6e] font-bold text-sm hover:gap-3 transition-all">
                Read Full Story <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── SMS FEATURES ──────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e3a6e]/8 border border-[#1e3a6e]/15 text-[#1e3a6e] text-xs font-bold uppercase tracking-wider mb-4">
              <Brain className="w-3 h-3" /> School Management System
            </div>
            <h2 className="font-headline text-4xl font-bold text-[#1e3a6e] mb-4">
              Everything You Need, <span className="text-blue-500 italic">All in One Platform</span>
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              A fully integrated digital ERP that covers every corner of school operations — from admissions to alumni.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {smsFeatures.map((feat) => (
              <div key={feat.title} className={`rounded-2xl p-6 border-t-4 ${feat.color} shadow-sm hover:shadow-md transition-all hover:-translate-y-1`}>
                <div className={`w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center mb-5 ${feat.iconColor}`}>
                  <feat.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-[#1e3a6e] text-lg mb-4">{feat.title}</h3>
                <ul className="space-y-2.5">
                  {feat.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-gray-600 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link href="/dashboard">
              <button className="inline-flex items-center gap-2 bg-[#1e3a6e] hover:bg-[#1e3a6e]/90 text-white font-bold px-10 py-4 rounded-xl transition-all hover:shadow-xl hover:shadow-[#1e3a6e]/25 hover:-translate-y-0.5">
                <PlayCircle className="w-5 h-5" /> Explore the Dashboard
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── ANNOUNCEMENTS + EVENTS ────────────────────────────────── */}
      <section id="events" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">

            {/* Announcements */}
            <div>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold uppercase tracking-wider mb-2">
                    <Bell className="w-3 h-3" /> Latest Announcements
                  </div>
                  <h2 className="font-headline text-3xl font-bold text-[#1e3a6e]">Important Notices</h2>
                </div>
                <button className="text-sm text-[#1e3a6e] font-bold flex items-center gap-1 hover:gap-2 transition-all">
                  View All <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                {announcements.map((ann) => (
                  <div key={ann.title} className="group flex gap-4 p-5 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-md hover:border-gray-200 transition-all cursor-pointer">
                    <div className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-bold text-center min-w-[70px] ${ann.color}`}>
                      {ann.tag}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 mb-1">{ann.date}</div>
                      <h4 className="font-bold text-[#1e3a6e] text-sm mb-1 truncate group-hover:text-blue-700 transition-colors">{ann.title}</h4>
                      <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{ann.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1 transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Events */}
            <div>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold uppercase tracking-wider mb-2">
                    <CalendarDays className="w-3 h-3" /> School Calendar
                  </div>
                  <h2 className="font-headline text-3xl font-bold text-[#1e3a6e]">Upcoming Events</h2>
                </div>
                <button className="text-sm text-[#1e3a6e] font-bold flex items-center gap-1 hover:gap-2 transition-all">
                  Full Calendar <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.title} className="group flex gap-4 p-5 rounded-2xl border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer bg-gray-50/50 hover:bg-white">
                    <div className={`shrink-0 w-14 rounded-xl bg-gradient-to-br ${event.gradient} flex flex-col items-center justify-center py-2 shadow-md group-hover:scale-105 transition-transform`}>
                      <span className="text-white font-bold text-lg leading-none">{event.date.split(" ")[0]}</span>
                      <span className="text-white/80 text-[10px] font-medium">{event.date.split(" ")[1]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-[#1e3a6e] text-sm mb-1 group-hover:text-blue-700 transition-colors">{event.title}</h4>
                      <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{event.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── ACADEMIC PROGRAMS ─────────────────────────────────────── */}
      <section id="programs" className="py-24 bg-gradient-to-br from-[#0B1B3D] via-[#1e3a6e] to-[#0B1B3D] relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-500/20 text-sky-400 text-xs font-bold uppercase tracking-wider mb-4">
              <GraduationCap className="w-3 h-3" /> Academic Programs
            </div>
            <h2 className="font-headline text-4xl font-bold text-white mb-4">Programs for Every Stage</h2>
            <p className="text-white/50 max-w-xl mx-auto">From early childhood to advanced pre-university level — a continuous journey of growth.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map((prog) => (
              <div key={prog.level} className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-white/20 transition-all hover:-translate-y-1 hover:shadow-2xl cursor-pointer">
                <div className={`absolute inset-0 bg-gradient-to-br ${prog.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                <div className="relative p-6">
                  <div className="text-4xl mb-4">{prog.icon}</div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-headline text-xl font-bold text-white">{prog.level}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full bg-gradient-to-r ${prog.color} text-white font-bold`}>{prog.grades}</span>
                  </div>
                  <p className="text-white/40 text-xs mb-3">{prog.age}</p>
                  <p className="text-white/65 text-sm leading-relaxed">{prog.desc}</p>
                  <button className="mt-4 flex items-center gap-1 text-sky-400 text-xs font-bold group-hover:gap-2 transition-all">
                    Learn More <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FACILITIES ────────────────────────────────────────────── */}
      <section id="facilities" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e3a6e]/8 border border-[#1e3a6e]/15 text-[#1e3a6e] text-xs font-bold uppercase tracking-wider mb-4">
              <Layers className="w-3 h-3" /> World-Class Infrastructure
            </div>
            <h2 className="font-headline text-4xl font-bold text-[#1e3a6e] mb-4">
              State-of-the-Art <span className="text-blue-500 italic">Facilities</span>
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">Designed to inspire learning, encourage exploration, and support every student's potential.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {facilities.map((fac) => (
              <div key={fac.name} className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer">
                <div className={`w-14 h-14 rounded-2xl ${fac.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                  <fac.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-bold text-[#1e3a6e] text-lg mb-2 group-hover:text-blue-700 transition-colors">{fac.name}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{fac.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY ───────────────────────────────────────────────── */}
      <section id="gallery" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e3a6e]/8 border border-[#1e3a6e]/15 text-[#1e3a6e] text-xs font-bold uppercase tracking-wider mb-4">
              <Star className="w-3 h-3" /> Photo Gallery
            </div>
            <h2 className="font-headline text-4xl font-bold text-[#1e3a6e] mb-4">
              Life at <span className="text-blue-500 italic">Scholarly Central</span>
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">A snapshot of the vibrant, dynamic campus life that makes our school truly special.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Smart Classroom", aspect: "col-span-1 row-span-2" },
              { label: "Science Lab", aspect: "col-span-1" },
              { label: "Sports Day", aspect: "col-span-1" },
              { label: "Annual Function", aspect: "col-span-2" },
              { label: "Computer Lab", aspect: "col-span-1" },
              { label: "Library", aspect: "col-span-1" },
            ].map((item, i) => (
              <div key={i} className={`group relative rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer ${i === 0 ? "md:row-span-2" : ""} ${i === 3 ? "md:col-span-2" : ""}`}>
                <Image
                  src="/gallery.png"
                  alt={item.label}
                  width={600}
                  height={i === 0 ? 500 : i === 3 ? 300 : 250}
                  className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  style={{ height: i === 0 ? "100%" : i === 3 ? "220px" : "200px" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B1B3D]/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-4 left-4 text-white font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <button className="inline-flex items-center gap-2 border-2 border-[#1e3a6e] text-[#1e3a6e] font-bold px-8 py-3.5 rounded-xl hover:bg-[#1e3a6e] hover:text-white transition-all">
              View Full Gallery <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────── */}
      <section className="py-24 bg-gradient-to-br from-[#0B1B3D] to-[#1e3a6e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-500/20 text-sky-400 text-xs font-bold uppercase tracking-wider mb-4">
              <MessageSquare className="w-3 h-3" /> Testimonials
            </div>
            <h2 className="font-headline text-4xl font-bold text-white mb-4">
              Words from Our <span className="text-sky-400 italic">Community</span>
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">Hear from the parents, students, and alumni who've experienced the Scholarly Central difference.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {testimonials.map((t, i) => (
              <div key={t.name} className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all hover:-translate-y-1 ${i === 1 ? "lg:mt-6" : ""} ${i === 3 ? "lg:-mt-6" : ""}`}>
                <Quote className="w-8 h-8 text-sky-400/50 mb-4" />
                <p className="text-white/75 text-sm leading-relaxed mb-6 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{t.name}</div>
                    <div className="text-white/40 text-xs">{t.role}</div>
                  </div>
                </div>
                <div className="flex gap-0.5 mt-4">
                  {[...Array(t.rating)].map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 text-sky-400 fill-blue-500" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEWS & BLOG ───────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-12">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e3a6e]/8 border border-[#1e3a6e]/15 text-[#1e3a6e] text-xs font-bold uppercase tracking-wider mb-3">
                <Newspaper className="w-3 h-3" /> News & Achievements
              </div>
              <h2 className="font-headline text-4xl font-bold text-[#1e3a6e]">
                School <span className="text-blue-500 italic">Highlights</span>
              </h2>
            </div>
            <button className="hidden sm:flex items-center gap-2 text-[#1e3a6e] font-bold text-sm hover:gap-3 transition-all">
              All News <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {newsItems.map((item) => (
              <div key={item.title} className="group cursor-pointer">
                <div className="relative rounded-2xl overflow-hidden mb-4 shadow-sm">
                  <Image src="/gallery.png" alt={item.title} width={400} height={220} className="w-full object-cover h-44 group-hover:scale-105 transition-transform duration-500" />
                  <div className={`absolute top-3 left-3 px-3 py-1 rounded-full bg-white text-xs font-bold ${item.color}`}>
                    {item.category}
                  </div>
                </div>
                <div className="text-gray-400 text-xs mb-2">{item.date}</div>
                <h3 className="font-bold text-[#1e3a6e] text-base mb-2 leading-tight group-hover:text-blue-700 transition-colors line-clamp-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">{item.desc}</p>
                <button className="mt-3 flex items-center gap-1 text-[#1e3a6e] text-xs font-bold group-hover:gap-2 transition-all">
                  Read More <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOWNLOAD CENTER ───────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e3a6e]/8 border border-[#1e3a6e]/15 text-[#1e3a6e] text-xs font-bold uppercase tracking-wider mb-4">
              <Download className="w-3 h-3" /> Resources
            </div>
            <h2 className="font-headline text-4xl font-bold text-[#1e3a6e] mb-4">Download Center</h2>
            <p className="text-gray-500">Access official documents, forms, and academic resources instantly.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {downloads.map((doc) => (
              <button key={doc.name} className={`group flex items-center gap-4 p-5 rounded-2xl border border-gray-100 bg-white hover:shadow-md transition-all hover:-translate-y-0.5 text-left w-full`}>
                <div className={`w-12 h-12 rounded-xl ${doc.color} flex items-center justify-center shrink-0`}>
                  <doc.icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[#1e3a6e] text-sm group-hover:text-blue-700 transition-colors">{doc.name}</div>
                  <div className="text-gray-400 text-xs mt-0.5">{doc.size}</div>
                </div>
                <Download className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT SECTION ───────────────────────────────────────── */}
      <section id="contact" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e3a6e]/8 border border-[#1e3a6e]/15 text-[#1e3a6e] text-xs font-bold uppercase tracking-wider mb-4">
              <Phone className="w-3 h-3" /> Get in Touch
            </div>
            <h2 className="font-headline text-4xl font-bold text-[#1e3a6e] mb-4">
              Contact <span className="text-blue-500 italic">Us</span>
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">We're here to answer your questions. Reach out anytime — our admissions team responds within 24 hours.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-10">
            {/* Contact Info */}
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-[#1e3a6e] text-lg mb-5">Contact Information</h3>
                <div className="space-y-5">
                  {[
                    { icon: MapPin, label: "Address", value: "123 Education Avenue, Knowledge Park, Islamabad, Pakistan" },
                    { icon: Phone, label: "Phone", value: "+92-51-1234567\n+92-51-7654321" },
                    { icon: Mail, label: "Email", value: "info@scholarlycentral.edu.pk\nadmissions@scholarlycentral.edu.pk" },
                    { icon: Clock, label: "Office Hours", value: "Mon–Fri: 8:00 AM – 3:30 PM\nSat: 9:00 AM – 1:00 PM" },
                  ].map((item) => (
                    <div key={item.label} className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#1e3a6e]/8 flex items-center justify-center shrink-0">
                        <item.icon className="w-4 h-4 text-[#1e3a6e]" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 font-medium mb-0.5">{item.label}</div>
                        <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map Embed Placeholder */}
              <div className="rounded-2xl overflow-hidden border border-gray-200 h-48 bg-gray-100 flex items-center justify-center">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d212644.30985398!2d72.82185955!3d33.6844202!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x38dfbfd07891722f%3A0x6789f8fc0a8a8a8a!2sIslamabad%2C%20Pakistan!5e0!3m2!1sen!2s!4v1705000000000!5m2!1sen!2s"
                  width="100%"
                  height="192"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="grayscale"
                />
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
                <h3 className="font-bold text-[#1e3a6e] text-lg mb-6">Send Us a Message</h3>
                {formSent ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center">
                      <ShieldCheck className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h4 className="font-bold text-[#1e3a6e] text-xl">Message Sent!</h4>
                    <p className="text-gray-500 text-sm max-w-xs">Thank you for contacting us. Our admissions team will respond within 24 hours.</p>
                  </div>
                ) : (
                  <form onSubmit={handleContact} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Full Name *</label>
                        <input
                          required
                          type="text"
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          placeholder="Your full name"
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/10 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Address *</label>
                        <input
                          required
                          type="email"
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          placeholder="your@email.com"
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/10 transition-all"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone Number</label>
                        <input
                          type="tel"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                          placeholder="+92-XXX-XXXXXXX"
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/10 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Subject *</label>
                        <select
                          required
                          value={contactForm.subject}
                          onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/10 transition-all text-gray-600"
                        >
                          <option value="">Select a subject</option>
                          <option>Admissions Inquiry</option>
                          <option>Fee Structure</option>
                          <option>Academic Programs</option>
                          <option>Campus Tour</option>
                          <option>Transport Services</option>
                          <option>General Inquiry</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Message *</label>
                      <textarea
                        required
                        rows={5}
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        placeholder="Tell us how we can help you..."
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/10 transition-all resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-[#1e3a6e] hover:bg-[#1e3a6e]/90 text-white font-bold py-4 rounded-xl transition-all hover:shadow-xl hover:shadow-[#1e3a6e]/25 active:scale-98 flex items-center justify-center gap-2"
                    >
                      <Mail className="w-4 h-4" /> Send Message
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── JOIN CTA SECTION ──────────────────────────────────────── */}
      <section className="relative py-24 overflow-hidden" style={{ background: "linear-gradient(135deg, #0B1B3D 0%, #1e3a6e 50%, #0B1B3D 100%)" }}>
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-sky-400/8 rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/15 border border-blue-400/20 text-sky-400 text-xs font-bold uppercase tracking-widest mb-6">
            <Zap className="w-3.5 h-3.5" /> Ready to Get Started?
          </div>

          <h2 className="font-headline text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-5 leading-tight">
            Join <span className="text-sky-400">Scholarly Central</span><br />
            <span className="text-white/75 text-3xl sm:text-4xl font-medium italic font-body">and shape the future today.</span>
          </h2>
          <p className="text-white/55 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Whether you&apos;re a student, parent, or educator — Scholarly Central gives you the tools and community to thrive. Apply for the 2026–27 session now.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-14">
            <Link href="/apply">
              <button className="flex items-center gap-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-all hover:shadow-2xl hover:shadow-blue-500/30 hover:-translate-y-1 active:translate-y-0">
                Apply for Admission <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Link href="/login">
              <button className="flex items-center gap-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/25 text-white font-bold px-8 py-4 rounded-xl text-base transition-all hover:-translate-y-1">
                Access Your Portal <ChevronRight className="w-5 h-5" />
              </button>
            </Link>
            <a href="#contact">
              <button className="flex items-center gap-2.5 border border-white/20 text-white/75 hover:text-white hover:border-white/40 font-bold px-8 py-4 rounded-xl text-base transition-all hover:-translate-y-1">
                Talk to Admissions <Phone className="w-4 h-4" />
              </button>
            </a>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 border-t border-white/10 pt-10">
            {[
              { icon: Globe2, text: "Cambridge Affiliated" },
              { icon: ShieldCheck, text: "HEC Recognized" },
              { icon: Award, text: "Best School 2025" },
              { icon: CheckCircle2, text: "ISO 9001 Certified" },
              { icon: Users, text: "3,200+ Students Enrolled" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-white/45 text-sm">
                <Icon className="w-4 h-4 text-sky-400/70" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer className="bg-[#050f1f] text-white">
        {/* Upper Footer */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">

            {/* Brand Column */}
            <div className="lg:col-span-2 space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-xl">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="font-headline text-xl font-bold block">Scholarly Central</span>
                  <span className="text-white/40 text-xs">School Management System</span>
                </div>
              </div>
              <p className="text-white/50 text-sm leading-relaxed max-w-xs">
                Empowering minds, shaping futures. A premier institution dedicated to holistic education and character development since 2001.
              </p>
              <div className="flex gap-3">
                {[
                  { icon: Facebook, label: "Facebook" },
                  { icon: Twitter, label: "Twitter" },
                  { icon: Instagram, label: "Instagram" },
                  { icon: Youtube, label: "YouTube" },
                  { icon: Linkedin, label: "LinkedIn" },
                ].map(({ icon: Icon, label }) => (
                  <button key={label} aria-label={label} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-blue-600 border border-white/10 hover:border-blue-600 flex items-center justify-center transition-all">
                    <Icon className="w-4 h-4 text-white/60 hover:text-white" />
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-5">Quick Links</h4>
              <ul className="space-y-3">
                {["Home", "About Us", "Admissions", "Academic Programs", "Faculty & Staff", "Events & News"].map((link) => (
                  <li key={link}>
                    <a href="#" className="text-white/50 hover:text-sky-400 text-sm transition-colors flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3" /> {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Portals */}
            <div>
              <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-5">Portals</h4>
              <ul className="space-y-3">
                {["Student Portal", "Parent Portal", "Teacher Portal", "Admin Portal", "Online Fee Payment", "Results Portal"].map((link) => (
                  <li key={link}>
                    <Link href="/dashboard" className="text-white/50 hover:text-sky-400 text-sm transition-colors flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3" /> {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-5">Contact</h4>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                  <span className="text-white/50 text-sm leading-relaxed">123 Education Ave, Knowledge Park, Islamabad</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="text-white/50 text-sm">+92-51-1234567</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="text-white/50 text-sm">info@scholarlycentral.edu.pk</span>
                </div>
              </div>

              {/* Newsletter */}
              <div className="mt-6">
                <h5 className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">Newsletter</h5>
                <div className="flex gap-2">
                  <input type="email" placeholder="Your email" className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder-white/30 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all" />
                  <button className="px-3 py-2 bg-blue-600 hover:bg-blue-400 rounded-lg text-white transition-all">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/30 text-xs">
              © 2026 Scholarly Central. All Rights Reserved. Established 2001.
            </p>
            <div className="flex gap-6">
              {["Privacy Policy", "Terms & Conditions", "Cookie Policy", "Sitemap"].map((item) => (
                <a key={item} href="#" className="text-white/30 hover:text-white/60 text-xs transition-colors">
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
