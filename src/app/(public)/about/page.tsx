"use client";
import Link from "next/link";
import Image from "next/image";
import { GraduationCap, BookOpen, Star, Award, Trophy, Users, ArrowRight, CheckCircle2, Quote } from "lucide-react";

const milestones = [
  { year: "2001", event: "Founded with 80 students and 12 teachers in a rented campus." },
  { year: "2005", event: "Moved to current campus. Enrollment reached 500 students." },
  { year: "2010", event: "Affiliated with Cambridge International — O & A Levels introduced." },
  { year: "2015", event: "Won Best School Award by National Education Board." },
  { year: "2019", event: "Launched digital SMS platform — 2,000+ students enrolled." },
  { year: "2023", event: "ISO 9001 certified. 3,000+ students, 150+ faculty members." },
  { year: "2026", event: "Celebrating 25 years of excellence with 3,200+ students." },
];

const leadership = [
  { name: "Dr. James Al-Rashid", role: "Principal & CEO", since: "2008", avatar: "JA" },
  { name: "Mrs. Amina Khalid",   role: "Vice Principal Academics", since: "2012", avatar: "AK" },
  { name: "Mr. Tariq Mehmood",   role: "Director Administration", since: "2010", avatar: "TM" },
  { name: "Dr. Sara Baig",       role: "Head of Cambridge Programs", since: "2015", avatar: "SB" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative h-72 sm:h-96 overflow-hidden">
        <Image src="/hero-banner.png" alt="About" fill className="object-cover" />
        <div className="absolute inset-0 bg-[#0B1B3D]/80" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sky-300 text-xs font-semibold uppercase tracking-widest mb-4">
            <BookOpen className="w-3 h-3" /> Our Story
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white font-headline">About Scholarly Central</h1>
          <p className="mt-3 text-white/70 max-w-xl">25 years of shaping futures, building character, and nurturing excellence.</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
        <div className="max-w-7xl mx-auto text-sm text-gray-500">
          <Link href="/" className="hover:text-[#1e3a6e]">Home</Link> <span className="mx-2">/</span> <span className="text-gray-800">About Us</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 gap-8 mb-20">
          <div className="p-8 rounded-3xl bg-[#0B1B3D] text-white">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center mb-5">
              <Star className="w-6 h-6 text-sky-400" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Our Vision</h2>
            <p className="text-white/70 leading-relaxed">To be a globally recognized center of academic excellence and holistic character formation — producing leaders, innovators, and compassionate citizens of the world.</p>
          </div>
          <div className="p-8 rounded-3xl bg-blue-600 text-white">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-5">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Our Mission</h2>
            <p className="text-white/80 leading-relaxed">To empower every student with knowledge, critical thinking, and ethical values through a rigorous, inclusive, and nurturing educational environment.</p>
          </div>
        </div>

        {/* Our Story */}
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
          <div>
            <h2 className="text-4xl font-bold text-[#1e3a6e] mb-6 font-headline">
              Two Decades of <span className="text-blue-500 italic">Shaping Futures</span>
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4 text-lg">
              Established in 2001, Scholarly Central was born from a simple belief: every child deserves an education that ignites curiosity, builds resilience, and nurtures greatness.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              From a modest beginning with 80 students, we have grown into one of the nation's most respected institutions — home to 3,200+ students, 180+ qualified faculty members, and an unbroken legacy of 97% board success rate.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Our Cambridge affiliation, state-of-the-art facilities, and a community of dedicated educators make Scholarly Central a place where students don't just learn — they thrive.
            </p>
          </div>
          <div className="relative rounded-3xl overflow-hidden shadow-2xl h-80 lg:h-[420px]">
            <Image src="/hero-banner.png" alt="Campus" fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B1B3D]/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 grid grid-cols-3 gap-3">
              {[["25+", "Years"], ["3,200+", "Students"], ["97%", "Success"]].map(([v, l]) => (
                <div key={l} className="bg-white/95 rounded-xl p-3 text-center">
                  <div className="font-bold text-xl text-[#1e3a6e]">{v}</div>
                  <div className="text-xs text-gray-500">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Principal's Quote */}
        <div className="bg-gray-50 rounded-3xl p-10 mb-20 flex flex-col sm:flex-row gap-8 items-start border border-gray-100">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shrink-0">JA</div>
          <div>
            <Quote className="w-8 h-8 text-blue-500 mb-3" />
            <p className="text-gray-700 text-lg italic leading-relaxed mb-4">
              "Education is not merely the transfer of information — it is the awakening of curiosity, the cultivation of wisdom, and the courage to dream. At Scholarly Central, we don't just teach subjects; we build people."
            </p>
            <p className="font-bold text-[#1e3a6e]">Dr. James Al-Rashid</p>
            <p className="text-gray-400 text-sm">Principal & CEO — Scholarly Central</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-[#1e3a6e] font-headline text-center mb-12">Our Journey</h2>
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-600 to-indigo-400 hidden sm:block" />
            <div className="space-y-8">
              {milestones.map((m, i) => (
                <div key={m.year} className="flex gap-6 sm:gap-10 items-start">
                  <div className="shrink-0 w-16 h-16 rounded-2xl bg-[#1e3a6e] flex items-center justify-center text-white font-bold text-sm font-headline shadow-lg z-10">
                    {m.year}
                  </div>
                  <div className="flex-1 pt-3">
                    <p className="text-gray-700 leading-relaxed">{m.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Leadership */}
        <div>
          <h2 className="text-3xl font-bold text-[#1e3a6e] font-headline text-center mb-12">School Leadership</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {leadership.map((l) => (
              <div key={l.name} className="text-center p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:shadow-md transition-all">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1e3a6e] to-blue-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                  {l.avatar}
                </div>
                <h3 className="font-bold text-[#1e3a6e]">{l.name}</h3>
                <p className="text-gray-500 text-sm mt-1">{l.role}</p>
                <p className="text-xs text-gray-400 mt-1">Since {l.since}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
