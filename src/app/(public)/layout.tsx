"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  GraduationCap, Menu, X, ChevronRight,
  Facebook, Twitter, Instagram, Youtube, Linkedin,
  Phone, Mail, MapPin, ArrowRight, Bell,
} from "lucide-react";

const navLinks = [
  // { label: "Home",           href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Admissions", href: "/admissions-info" },
  { label: "Academics", href: "/academics" },
  { label: "Faculty & Staff", href: "/faculty" },
  { label: "Student Life", href: "/student-life" },
  { label: "Events & News", href: "/events-news" },
  { label: "Gallery", href: "/gallery-page" },
  { label: "Contact Us", href: "/contact" },
];

function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <>
      {/* Ticker */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-[#1e3a6e] h-9 flex items-center overflow-hidden">
        <div className="shrink-0 bg-sky-500 h-full flex items-center px-4 gap-2">
          <Bell className="w-3 h-3 text-white" />
          <span className="text-white text-xs font-bold uppercase tracking-wider whitespace-nowrap">Latest</span>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-ticker whitespace-nowrap text-white/80 text-xs font-medium">
            🎓 Admissions Open for 2026–27 Session &nbsp;·&nbsp; 📅 Annual Sports Day: July 15, 2026 &nbsp;·&nbsp; 🏆 100% Pass Rate in O-Level Examinations &nbsp;·&nbsp; 📢 Summer Vacation: June 25 – July 31 &nbsp;·&nbsp;
          </div>
        </div>
        <div className="shrink-0 px-4">
          <Link href="/apply" className="text-sky-300 hover:text-white text-xs font-semibold transition-colors whitespace-nowrap">Apply Now →</Link>
        </div>
      </div>

      {/* Navbar */}
      <header className={`fixed top-9 left-0 right-0 z-50 transition-all duration-300 ${scrolled || open ? "bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-100" : "bg-white shadow-sm border-b border-gray-100"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[68px] flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#1e3a6e]">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-headline text-[19px] font-bold text-[#1e3a6e] tracking-tight block leading-tight">Scholarly Central</span>
                {/* <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-gray-400">School Management System</span> */}
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden xl:flex items-center gap-0.5">
              {navLinks.map((link) => (
                <Link key={link.label} href={link.href}
                  className="px-3 py-2 rounded-lg text-[13px] font-semibold text-gray-600 hover:text-[#1e3a6e] hover:bg-gray-100 transition-all">
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* CTAs + Mobile toggle */}
            <div className="flex items-center gap-2.5">
              <Link href="/login" className="hidden sm:block">
                <button className="font-semibold px-4 py-2 rounded-xl text-sm border-2 border-[#1e3a6e] text-[#1e3a6e] hover:bg-[#1e3a6e] hover:text-white transition-all">Sign In</button>
              </Link>
              <Link href="/apply" className="hidden sm:block">
                <button className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all">Apply Now</button>
              </Link>
              <button onClick={() => setOpen(!open)} className="xl:hidden p-2 rounded-lg text-gray-600 transition-colors" aria-label="Toggle menu">
                {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {open && (
          <div className="xl:hidden bg-white border-b border-gray-200 px-4 pb-6 shadow-lg">
            <nav className="flex flex-col gap-1 mt-4">
              {navLinks.map((link) => (
                <Link key={link.label} href={link.href} onClick={() => setOpen(false)}
                  className="px-4 py-3 text-gray-600 hover:text-[#1e3a6e] hover:bg-blue-50 rounded-xl font-medium text-sm transition-colors">
                  {link.label}
                </Link>
              ))}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Link href="/login"><button className="w-full border-2 border-[#1e3a6e] text-[#1e3a6e] font-bold py-3 rounded-xl text-sm">Sign In</button></Link>
                <Link href="/apply"><button className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm">Apply Now</button></Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Spacer so content clears fixed header */}
      <div className="h-[calc(36px+68px)]" />
    </>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-[#050f1f] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl"><GraduationCap className="w-6 h-6 text-white" /></div>
              <div>
                <span className="font-headline text-lg font-bold block">Scholarly Central</span>
                <span className="text-white/40 text-xs">School Management System</span>
              </div>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">Empowering minds, shaping futures. A premier institution dedicated to holistic education since 2001.</p>
            <div className="flex gap-2">
              {[Facebook, Twitter, Instagram, Youtube, Linkedin].map((Icon, i) => (
                <button key={i} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-blue-600 border border-white/10 hover:border-blue-600 flex items-center justify-center transition-all">
                  <Icon className="w-4 h-4 text-white/60" />
                </button>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Quick Links</h4>
            <ul className="space-y-2.5">
              {navLinks.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-white/50 hover:text-sky-400 text-sm transition-colors flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3" /> {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Portals */}
          <div>
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Portals</h4>
            <ul className="space-y-2.5">
              {["Student Portal", "Parent Portal", "Teacher Portal", "Admin Portal", "Online Fee Payment", "Results Portal"].map((link) => (
                <li key={link}>
                  <Link href="/dashboard" className="text-white/50 hover:text-sky-400 text-sm transition-colors flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3" /> {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Contact</h4>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3"><MapPin className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" /><span className="text-white/50">123 Education Ave, Knowledge Park, Islamabad</span></div>
              <div className="flex gap-3"><Phone className="w-4 h-4 text-sky-400 shrink-0" /><span className="text-white/50">+92-51-1234567</span></div>
              <div className="flex gap-3"><Mail className="w-4 h-4 text-sky-400 shrink-0" /><span className="text-white/50">info@scholarlycentral.edu.pk</span></div>
            </div>
            <div className="mt-5">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Newsletter</p>
              <div className="flex gap-2">
                <input type="email" placeholder="Your email" className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder-white/30 focus:outline-none focus:border-blue-500 transition-all" />
                <button className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-all"><ArrowRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/30 text-xs">© 2026 Scholarly Central. All Rights Reserved.</p>
          <div className="flex gap-5">
            {["Privacy Policy", "Terms & Conditions", "Sitemap"].map((l) => (
              <a key={l} href="#" className="text-white/30 hover:text-white/60 text-xs transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
