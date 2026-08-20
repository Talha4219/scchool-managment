"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  GraduationCap, Menu, X, ChevronRight,
  Facebook, Twitter, Instagram, Youtube, Linkedin,
  Phone, Mail, MapPin, ArrowRight,
} from "lucide-react";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Why Us", href: "/#why-us" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Testimonials", href: "/#testimonials" },
  { label: "Contact", href: "/contact" },
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
      {/* Navbar */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled || open ? "bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-100" : "bg-white shadow-sm border-b border-gray-100"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[68px] flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#1e3a6e]">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-headline text-[19px] font-bold text-[#1e3a6e] tracking-tight block leading-tight">Classora</span>
                <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-gray-400">School ERP Platform</span>
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
              <Link href="/login" className="hidden sm:block">
                <button className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all">Start Free Trial</button>
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
                <Link href="/login"><button className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm">Start Trial</button></Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Spacer so content clears fixed header */}
      <div className="h-[68px]" />
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
                <span className="font-headline text-lg font-bold block">Classora</span>
                <span className="text-white/40 text-xs">School ERP Platform</span>
              </div>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">The all-in-one school management system for admissions, academics, fees, HR, and more — built for schools that want to run on one platform instead of ten.</p>
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
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Product</h4>
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

          {/* Get Started */}
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
                  <Link href={link.href} className="text-white/50 hover:text-sky-400 text-sm transition-colors flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3" /> {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Contact Sales</h4>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3"><MapPin className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" /><span className="text-white/50">Serving schools worldwide, remote-first team</span></div>
              <div className="flex gap-3"><Phone className="w-4 h-4 text-sky-400 shrink-0" /><span className="text-white/50">0300 3380058</span></div>
              <div className="flex gap-3"><Mail className="w-4 h-4 text-sky-400 shrink-0" /><span className="text-white/50">talhashamsch@gmail.com</span></div>
            </div>
            <div className="mt-5">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Get product updates</p>
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
          <p className="text-white/30 text-xs">© 2026 Classora. All Rights Reserved. Built by <a href="https://talhasham.me" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-sky-400 transition-colors">Talha Sham</a>.</p>
          <div className="flex gap-5">
            {[{ l: "Privacy Policy", href: "/privacy-policy" }, { l: "Terms & Conditions", href: "#" }, { l: "Sitemap", href: "#" }].map((item) => (
              <Link key={item.l} href={item.href} className="text-white/30 hover:text-white/60 text-xs transition-colors">{item.l}</Link>
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
