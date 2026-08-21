"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useTransform, type Variants } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  GraduationCap, Menu, X, ChevronRight, Phone, Mail,
  Users, BookOpen, Trophy, Star, ArrowRight,
  Facebook, Twitter, Instagram, Youtube, Linkedin,
  MessageSquare, Quote, ChevronDown, PlayCircle, Check,
  CreditCard, Bell, Brain, Layers,
  UserCog, BookMarked, Bus, Building2, ClipboardList,
  Zap, Globe2, Lock, Headphones, Sparkles, Rocket, Flame,
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Why Us", href: "#why-us" },
  { label: "Pricing", href: "#pricing" },
  { label: "Reviews", href: "#testimonials" },
  { label: "FAQ", href: "#faq" },
];

const marqueeWords = ["ONE PLATFORM", "ZERO SPREADSHEETS", "LIVE IN DAYS", "BUILT DIFFERENT", "AI-NATIVE", "SCHOOLS FIRST"];

const trustLogos = ["Greenfield Academy", "Al-Noor International", "Riverside College", "Crescent High School", "Beacon Grammar", "Horizon Academy"];

const modules = [
  { title: "Admissions & Enrollment", icon: ClipboardList, span: "lg:col-span-2", gradient: "from-blue-500 to-indigo-600", items: ["Online application forms", "Automated waitlists", "Digital document uploads", "Merit-based ranking"] },
  { title: "Academics & Attendance", icon: Users, span: "", gradient: "from-violet-500 to-purple-600", items: ["Class & section management", "Biometric/RFID attendance", "Timetable builder"] },
  { title: "Exams & Report Cards", icon: BookMarked, span: "", gradient: "from-emerald-500 to-teal-600", items: ["Gradebook & mark entry", "Auto report cards", "Online exams & analytics"] },
  { title: "Fees & Accounting", icon: CreditCard, span: "lg:col-span-2", gradient: "from-rose-500 to-pink-600", items: ["Fee vouchers & ledgers", "JazzCash / EasyPaisa payments", "Scholarships & discounts", "Payroll & expense tracking"] },
  { title: "HR & Staff", icon: UserCog, span: "", gradient: "from-amber-500 to-orange-600", items: ["Staff attendance & leave", "Payroll processing", "Role-based permissions"] },
  { title: "Communications", icon: MessageSquare, span: "", gradient: "from-sky-500 to-cyan-600", items: ["WhatsApp & SMS alerts", "AI-drafted progress reports", "Announcements"] },
  { title: "Transport & Hostel", icon: Bus, span: "lg:col-span-2", gradient: "from-indigo-500 to-blue-600", items: ["GPS route planning", "Hostel room allocation", "Vehicle maintenance logs", "Live pickup notifications"] },
  { title: "Library & Inventory", icon: BookOpen, span: "", gradient: "from-fuchsia-500 to-purple-600", items: ["Book catalog & issuance", "Asset tracking", "Low-stock alerts"] },
];

const differentiators = [
  { icon: Layers, title: "One Platform, Not Ten Tabs", desc: "Admissions, academics, fees, HR, transport, library, comms — one login, one bill, one source of truth." },
  { icon: Zap, title: "Live in Days, Not Months", desc: "Modern cloud stack means your school is up and running in days — data imported, staff trained, done." },
  { icon: Brain, title: "AI Built In, Not Bolted On", desc: "AI-drafted progress reports and exam analytics ship native. No marketplace app, no extra bill." },
  { icon: Lock, title: "Your Data, Actually Yours", desc: "Full export anytime, field-level role access, and an audit log on everything sensitive. No lock-in." },
  { icon: Headphones, title: "Support That Actually Answers", desc: "Real humans respond in hours, not a ticket queue that ghosts you for a week." },
  { icon: Globe2, title: "Built for How Schools Pay", desc: "Native JazzCash & EasyPaisa — not a generic Stripe-only checkout half your parents can't use." },
];

const pricingTiers = [
  { name: "Starter", tagline: "small schools, big ambitions", price: "$49", period: "/mo", students: "Up to 300 students", features: ["Admissions & academics", "Attendance & timetable", "Fee vouchers & ledgers", "Parent & teacher portals", "Email support"], cta: "Start Free Trial", highlighted: false },
  { name: "Growth", tagline: "the one everyone picks", price: "$129", period: "/mo", students: "Up to 1,500 students", features: ["Everything in Starter", "HR & payroll", "Transport & hostel", "WhatsApp & SMS", "JazzCash / EasyPaisa", "AI progress reports", "Priority support"], cta: "Start Free Trial", highlighted: true },
  { name: "Enterprise", tagline: "multi-campus, no limits", price: "Custom", period: "", students: "Unlimited students & branches", features: ["Everything in Growth", "Multi-campus rollups", "Custom API access", "Dedicated onboarding", "SLA-backed uptime", "On-site training"], cta: "Talk to Sales", highlighted: false },
];

const testimonials = [
  { name: "Ayesha Malik", role: "Principal, Al-Noor International", text: "We ditched four separate tools for one platform. Our admin team got two hours a day back — actual hours, not a marketing claim.", avatar: "AM" },
  { name: "Muhammad Usman", role: "Administrator, Riverside College", text: "1,800 student records migrated in under a week. Parents were paying fees through the portal within days of launch.", avatar: "MU" },
  { name: "Sarah Johnson", role: "IT Head, Crescent High", text: "Role-based permissions and the audit log finally got our board comfortable going paperless. Support answers in the hour, every time.", avatar: "SJ" },
  { name: "Dr. Khalid Hussain", role: "Director, Beacon Grammar Group", text: "Three campuses, one dashboard, per-campus rollups. This is the system we wished existed five years ago.", avatar: "KH" },
];

const faqs = [
  { q: "How long does implementation take?", a: "Most schools go live in 1–2 weeks. We handle data migration and run live training for your admin, teacher, and front-desk staff." },
  { q: "Can we import our existing records?", a: "Yes — student, staff, and fee-ledger data from Excel, CSV, or most common exports, migrated at no extra cost during setup." },
  { q: "Does it support JazzCash and EasyPaisa?", a: "Natively, alongside bank transfer and cash reconciliation. No third-party payment plugin required." },
  { q: "What happens to our data if we cancel?", a: "Full export, any time, from any plan. No lock-in period, no games." },
  { q: "Is there a free trial?", a: "14-day full-featured trial, every plan, no credit card required." },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

// ─── Component ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { scrollY } = useScroll();
  const heroBlobY = useTransform(scrollY, [0, 800], [0, 160]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white font-body overflow-x-hidden">

      {/* ── NAVIGATION ─────────────────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled || mobileMenuOpen
            ? "bg-white/90 backdrop-blur-xl shadow-lg border-b border-gray-100"
            : "bg-gradient-to-b from-[#0a0118]/80 via-[#0a0118]/30 to-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[68px] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl transition-all duration-300 ${scrolled || mobileMenuOpen ? "bg-gradient-to-br from-violet-600 to-indigo-600" : "bg-white/15 backdrop-blur-sm border border-white/20"}`}>
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className={`font-headline text-[19px] font-bold tracking-tight block transition-colors leading-tight ${scrolled || mobileMenuOpen ? "text-[#1e1033]" : "text-white"}`}>
                  Classora
                </span>
                <span className={`text-[9px] font-semibold tracking-[0.15em] uppercase transition-colors ${scrolled || mobileMenuOpen ? "text-gray-400" : "text-white/70"}`}>
                  School OS
                </span>
              </div>
            </div>

            <nav className="hidden xl:flex items-center gap-0.5">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-[13px] font-semibold transition-all ${scrolled || mobileMenuOpen
                      ? "text-gray-600 hover:text-violet-700 hover:bg-violet-50"
                      : "text-white/90 hover:text-white hover:bg-white/10"
                    }`}
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2.5">
              <Link href="/login" className="hidden sm:block">
                <button className={`font-semibold px-4 py-2 rounded-xl text-sm transition-all ${scrolled || mobileMenuOpen
                    ? "text-[#1e1033] border-2 border-[#1e1033]/15 hover:border-violet-600 hover:text-violet-700"
                    : "text-white border-2 border-white/30 hover:bg-white/10"
                  }`}>
                  Sign In
                </button>
              </Link>
              <Link href="/login" className="hidden sm:block">
                <button className="relative bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-violet-500/40 hover:-translate-y-0.5 active:translate-y-0">
                  Start Free Trial
                </button>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`xl:hidden p-2 rounded-lg transition-colors ${scrolled || mobileMenuOpen ? "text-gray-600" : "text-white"}`}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="xl:hidden bg-white border-b border-gray-200 px-4 pb-6 shadow-lg">
            <nav className="flex flex-col gap-1 mt-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 text-gray-600 hover:text-violet-700 hover:bg-violet-50 rounded-xl font-medium transition-colors text-sm"
                >
                  {link.label}
                </a>
              ))}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Link href="/login">
                  <button className="w-full border-2 border-[#1e1033]/15 text-[#1e1033] font-bold py-3 rounded-xl text-sm">Sign In</button>
                </Link>
                <Link href="/login">
                  <button className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-3 rounded-xl text-sm">Start Trial</button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="relative min-h-[94vh] flex items-center overflow-hidden bg-[#0a0118]">
        <motion.div style={{ y: heroBlobY }} className="absolute inset-0">
          <div className="absolute -top-40 -left-20 w-[600px] h-[600px] bg-violet-600/30 rounded-full blur-[120px]" />
          <div className="absolute top-40 -right-20 w-[500px] h-[500px] bg-indigo-500/25 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-1/3 w-[450px] h-[450px] bg-fuchsia-500/20 rounded-full blur-[120px]" />
        </motion.div>
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "34px 34px" }} />

        <div className="relative z-20 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 text-center">
          <motion.div initial="hidden" animate="show" variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-semibold uppercase tracking-widest mb-8">
            <Flame className="w-3.5 h-3.5 text-fuchsia-400" />
            Not another boring school app
          </motion.div>

          <motion.h1
            initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            className="font-headline text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.05] mb-6"
          >
            {"Run your whole school".split(" ").map((w, i) => (
              <motion.span key={i} variants={fadeUp} className="inline-block mr-3">{w}</motion.span>
            ))}
            <br className="hidden sm:block" />
            <motion.span variants={fadeUp} className="inline-block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
              from one screen
            </motion.span>
          </motion.h1>

          <motion.p initial="hidden" animate="show" variants={fadeUp} transition={{ delay: 0.3 }} className="text-xl text-white/60 leading-relaxed max-w-2xl mx-auto mb-10">
            Admissions, fees, attendance, HR, transport, hostel, comms — everything a school runs on, in one platform. No more five logins and a group chat held together with duct tape.
          </motion.p>

          <motion.div initial="hidden" animate="show" variants={fadeUp} transition={{ delay: 0.4 }} className="flex flex-wrap items-center justify-center gap-4 mb-16">
            <Link href="/login">
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold px-8 py-3.5 rounded-xl text-base shadow-xl shadow-violet-600/30">
                Start Free Trial <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
            <Link href="/dashboard">
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="flex items-center gap-2 bg-white/10 border border-white/25 text-white font-bold px-8 py-3.5 rounded-xl text-base">
                <PlayCircle className="w-5 h-5" /> Explore Live Demo
              </motion.button>
            </Link>
          </motion.div>

          <motion.div
            initial="hidden" animate="show" variants={stagger}
            className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 border-t border-white/10 pt-10"
          >
            {[
              { n: 8, suffix: "", l: "Modules, One Login" },
              { n: 14, suffix: "-day", l: "Free Trial, No Card" },
              { n: 1, suffix: "–2 wks", l: "Typical Go-Live" },
              { n: 1, prefix: "<", suffix: " hr", l: "Support Response" },
            ].map((s) => (
              <motion.div key={s.l} variants={fadeUp} className="text-center">
                <div className="text-3xl font-bold font-headline bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                  <AnimatedCounter value={s.n} prefix={s.prefix ?? ""} suffix={s.suffix} />
                </div>
                <div className="text-sm text-white/50 mt-1">{s.l}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/30 z-20">
          <span className="text-[10px] tracking-[0.2em] uppercase font-medium">Scroll</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </div>
      </section>

      {/* ── MARQUEE STRIP ─────────────────────────────────────── */}
      <div className="bg-[#0a0118] border-t border-white/5 py-4 overflow-hidden">
        <div className="flex animate-ticker whitespace-nowrap">
          {[...marqueeWords, ...marqueeWords, ...marqueeWords].map((w, i) => (
            <span key={i} className="mx-6 text-white/25 font-headline font-bold text-sm tracking-widest uppercase flex items-center gap-6">
              {w} <Sparkles className="w-3.5 h-3.5 text-violet-400/50" />
            </span>
          ))}
        </div>
      </div>

      {/* ── TRUST STRIP ────────────────────────────────────── */}
      <section className="py-10 bg-gray-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">Trusted by schools who quit spreadsheets for good</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {trustLogos.map((name) => (
              <span key={name} className="text-gray-400 font-bold text-sm tracking-tight">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM / SOLUTION ────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger} className="space-y-6">
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold uppercase tracking-wider">
                The old way
              </motion.div>
              <motion.h2 variants={fadeUp} className="font-headline text-4xl font-bold text-[#1e1033] leading-tight">
                Five tools. <span className="text-rose-500 italic">Zero of them talk to each other.</span>
              </motion.h2>
              <motion.p variants={fadeUp} className="text-gray-600 leading-relaxed text-lg">
                A fee app. A separate attendance system. WhatsApp groups for parent updates. Excel for HR. Paper for the library. Every tool has its own login and its own version of the truth.
              </motion.p>
              <motion.ul variants={stagger} className="space-y-3">
                {["Admin re-typing the same student data 3–4 times", "No single source of truth for fees or attendance", "Parent comms scattered across SMS, WhatsApp, paper", "Reports that take days to compile by hand"].map((item) => (
                  <motion.li key={item} variants={fadeUp} className="flex items-start gap-3 text-gray-600 text-sm">
                    <X className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" /> {item}
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger} className="space-y-6">
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                The Classora way
              </motion.div>
              <motion.h2 variants={fadeUp} className="font-headline text-4xl font-bold text-[#1e1033] leading-tight">
                One platform. <span className="text-violet-600 italic">One source of truth.</span>
              </motion.h2>
              <motion.p variants={fadeUp} className="text-gray-600 leading-relaxed text-lg">
                Every module shares the same live student and staff records. Update it once — it&apos;s correct everywhere: fee ledger, report card, parent portal, WhatsApp ping.
              </motion.p>
              <motion.ul variants={stagger} className="space-y-3">
                {["Enter a student once — live everywhere, instantly", "Real-time fee, attendance, academic dashboards", "Native WhatsApp & SMS, not a bolt-on", "Board-ready reports generated in seconds"].map((item) => (
                  <motion.li key={item} variants={fadeUp} className="flex items-start gap-3 text-gray-600 text-sm">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> {item}
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FEATURE BENTO GRID ──────────────────────────────────── */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 border border-violet-200 text-violet-700 text-xs font-bold uppercase tracking-wider mb-4">
              <Layers className="w-3 h-3" /> Everything, one platform
            </motion.div>
            <motion.h2 variants={fadeUp} className="font-headline text-4xl font-bold text-[#1e1033] mb-4">
              Eight modules. <span className="text-violet-600 italic">Zero silos.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-500 max-w-2xl mx-auto">
              Every part of running a school, covered — and every module shares the same live data.
            </motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger} className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {modules.map((mod) => (
              <motion.div
                key={mod.title}
                variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className={`relative rounded-3xl p-6 text-white overflow-hidden shadow-lg ${mod.span}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${mod.gradient}`} />
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
                <div className="relative">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-5">
                    <mod.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg mb-4">{mod.title}</h3>
                  <ul className="space-y-2">
                    {mod.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-white/85 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-white/60 mt-2 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </motion.div>
          <div className="text-center mt-12">
            <Link href="/dashboard">
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-flex items-center gap-2 bg-[#1e1033] text-white font-bold px-10 py-4 rounded-xl shadow-xl">
                <PlayCircle className="w-5 h-5" /> Explore the Live Demo
              </motion.button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── WHY US ────────────────────────────────────── */}
      <section id="why-us" className="py-24 bg-[#0a0118] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-fuchsia-500/10 rounded-full blur-[140px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger} className="text-center mb-14">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-600/15 border border-violet-500/30 text-violet-300 text-xs font-bold uppercase tracking-wider mb-4">
              <Trophy className="w-3 h-3" /> Why schools switch
            </motion.div>
            <motion.h2 variants={fadeUp} className="font-headline text-4xl font-bold text-white mb-4">Why choose Classora over the rest</motion.h2>
            <motion.p variants={fadeUp} className="text-white/50 max-w-xl mx-auto">Not a rigid legacy system. Not a spreadsheet with extra steps. Built for how schools actually operate.</motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {differentiators.map((d) => (
              <motion.div key={d.title} variants={fadeUp} whileHover={{ y: -4 }} className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-violet-500/40 transition-colors bg-white/[0.03] p-7">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600/30 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center mb-5">
                  <d.icon className="w-6 h-6 text-violet-300" />
                </div>
                <h3 className="font-headline text-lg font-bold text-white mb-3">{d.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{d.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 border border-violet-200 text-violet-700 text-xs font-bold uppercase tracking-wider mb-4">
              <CreditCard className="w-3 h-3" /> Simple, transparent pricing
            </motion.div>
            <motion.h2 variants={fadeUp} className="font-headline text-4xl font-bold text-[#1e1033] mb-4">
              Pricing that scales <span className="text-violet-600 italic">with your school</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-500 max-w-xl mx-auto">No per-module fees, no surprise add-ons. Every plan includes free onboarding and a 14-day trial.</motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger} className="grid lg:grid-cols-3 gap-8 items-start">
            {pricingTiers.map((tier) => (
              <motion.div
                key={tier.name}
                variants={fadeUp}
                whileHover={{ y: -6 }}
                className={`relative rounded-3xl p-8 border-2 transition-colors ${tier.highlighted
                    ? "border-violet-600 shadow-2xl shadow-violet-500/15 bg-white lg:-translate-y-4"
                    : "border-gray-100 bg-gray-50/50 hover:border-gray-200"
                  }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full shadow-lg">
                    Most Popular
                  </div>
                )}
                <h3 className="font-headline text-2xl font-bold text-[#1e1033] mb-1">{tier.name}</h3>
                <p className="text-gray-500 text-sm mb-6">{tier.tagline}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-headline text-5xl font-bold text-[#1e1033]">{tier.price}</span>
                  <span className="text-gray-400 text-sm">{tier.period}</span>
                </div>
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-6">{tier.students}</p>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-gray-600 text-sm">
                      <Check className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href={tier.cta === "Talk to Sales" ? "/contact" : "/login"}>
                  <button className={`w-full font-bold py-3.5 rounded-xl text-sm transition-all ${tier.highlighted
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-violet-500/30"
                      : "border-2 border-[#1e1033]/15 text-[#1e1033] hover:border-violet-600 hover:text-violet-700"
                    }`}>
                    {tier.cta}
                  </button>
                </Link>
              </motion.div>
            ))}
          </motion.div>
          <p className="text-center text-gray-400 text-sm mt-10">All prices in USD, billed monthly. Annual billing saves 20%. Need a custom quote? <Link href="/contact" className="text-violet-600 font-semibold hover:underline">Talk to sales →</Link></p>
        </div>
      </section>

      {/* ── TESTIMONIALS MARQUEE ─────────────────────────────────────────── */}
      <section id="testimonials" className="py-24 bg-[#0a0118] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger} className="text-center mb-14">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-600/15 border border-violet-500/30 text-violet-300 text-xs font-bold uppercase tracking-wider mb-4">
              <MessageSquare className="w-3 h-3" /> Reviews
            </motion.div>
            <motion.h2 variants={fadeUp} className="font-headline text-4xl font-bold text-white mb-4">
              What school leaders are <span className="text-violet-400 italic">saying</span>
            </motion.h2>
          </motion.div>
        </div>
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((t, i) => (
            <motion.div key={t.name} variants={fadeUp} whileHover={{ y: -4 }} className={`bg-white/[0.04] border border-white/10 rounded-2xl p-6 hover:border-violet-500/40 transition-colors ${i === 1 ? "lg:mt-6" : ""} ${i === 3 ? "lg:-mt-6" : ""}`}>
              <Quote className="w-8 h-8 text-violet-400/50 mb-4" />
              <p className="text-white/75 text-sm leading-relaxed mb-6 italic">&quot;{t.text}&quot;</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {t.avatar}
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{t.name}</div>
                  <div className="text-white/40 text-xs">{t.role}</div>
                </div>
              </div>
              <div className="flex gap-0.5 mt-4">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 text-violet-400 fill-violet-500" />
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section id="faq" className="py-24 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger} className="text-center mb-14">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 border border-violet-200 text-violet-700 text-xs font-bold uppercase tracking-wider mb-4">
              <Bell className="w-3 h-3" /> FAQ
            </motion.div>
            <motion.h2 variants={fadeUp} className="font-headline text-4xl font-bold text-[#1e1033]">Questions? We&apos;ve got answers</motion.h2>
          </motion.div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={faq.q} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="font-bold text-[#1e1033] text-sm">{faq.q}</span>
                  <motion.span animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 text-gray-500 text-sm leading-relaxed">{faq.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5 }}
            className="rounded-[2.5rem] bg-[#0a0118] p-14 text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-violet-600/25 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] bg-fuchsia-500/20 rounded-full blur-[120px]" />
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "36px 36px" }} />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-semibold uppercase tracking-widest mb-6">
                <Rocket className="w-3.5 h-3.5 text-violet-400" /> Ready when you are
              </div>
              <h2 className="font-headline text-4xl sm:text-5xl font-bold text-white mb-5">
                Give your school one screen to run on
              </h2>
              <p className="text-white/60 max-w-xl mx-auto mb-9 text-lg">
                Start your 14-day free trial today — no credit card, live in days, and our team migrates your data.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link href="/login">
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold px-8 py-3.5 rounded-xl text-base shadow-xl shadow-violet-600/30">
                    Start Free Trial <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </Link>
                <Link href="/contact">
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="flex items-center gap-2 bg-white/10 border border-white/25 text-white font-bold px-8 py-3.5 rounded-xl text-base">
                    <Phone className="w-4 h-4" /> Talk to Sales
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-[#0a0118] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div className="sm:col-span-2 lg:col-span-1 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl"><GraduationCap className="w-6 h-6 text-white" /></div>
                <div>
                  <span className="font-headline text-lg font-bold block">Classora</span>
                  <span className="text-white/40 text-xs">School OS</span>
                </div>
              </div>
              <p className="text-white/50 text-sm leading-relaxed">The all-in-one school management system for admissions, academics, fees, HR, and more.</p>
              <div className="flex gap-2">
                {[Facebook, Twitter, Instagram, Youtube, Linkedin].map((Icon, i) => (
                  <button key={i} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-violet-600 border border-white/10 hover:border-violet-600 flex items-center justify-center transition-all">
                    <Icon className="w-4 h-4 text-white/60" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2.5">
                {navLinks.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-white/50 hover:text-violet-400 text-sm transition-colors flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3" /> {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Get Started</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Sign In", href: "/login" },
                  { label: "Start Free Trial", href: "/login" },
                  { label: "Try the Live Demo", href: "/dashboard" },
                  { label: "Talk to Sales", href: "/contact" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-white/50 hover:text-violet-400 text-sm transition-colors flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3" /> {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Contact Sales</h4>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3"><Building2 className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" /><span className="text-white/50">Serving schools worldwide, remote-first team</span></div>
                <div className="flex gap-3"><Phone className="w-4 h-4 text-violet-400 shrink-0" /><span className="text-white/50">0300 3380058</span></div>
                <div className="flex gap-3"><Mail className="w-4 h-4 text-violet-400 shrink-0" /><span className="text-white/50">talhashamsch@gmail.com</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-white/30 text-xs">© 2026 Classora. All Rights Reserved. Built by <a href="https://talhasham.me" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-violet-400 transition-colors">Talha Sham</a>.</p>
            <div className="flex gap-5">
              {[{ l: "Privacy Policy", href: "/privacy-policy" }, { l: "Terms & Conditions", href: "#" }, { l: "Sitemap", href: "#" }].map((item) => (
                <Link key={item.l} href={item.href} className="text-white/30 hover:text-white/60 text-xs transition-colors">{item.l}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
