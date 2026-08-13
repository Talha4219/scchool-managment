"use client";
import Link from "next/link";
import Image from "next/image";
import { BookMarked, Users, Award, Star } from "lucide-react";

export default function FacultyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative h-72 sm:h-80 overflow-hidden">
        <Image src="/hero-banner.png" alt="Faculty" fill className="object-cover" />
        <div className="absolute inset-0 bg-[#0B1B3D]/80" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sky-300 text-xs font-semibold uppercase tracking-widest mb-4">
            <BookMarked className="w-3 h-3" /> Our Educators
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white font-headline">Faculty & Staff</h1>
          <p className="mt-3 text-white/70 max-w-xl">Meet the dedicated educators shaping the next generation of leaders.</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
        <div className="max-w-7xl mx-auto text-sm text-gray-500">
          <Link href="/" className="hover:text-[#1e3a6e]">Home</Link> <span className="mx-2">/</span> <span className="text-gray-800">Faculty & Staff</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
          {[
            { v: "—", l: "Faculty Members",      icon: Users },
            { v: "—", l: "Masters/PhD Holders",  icon: Award },
            { v: "—", l: "Years Avg. Experience", icon: Star },
            { v: "—", l: "Academic Departments", icon: BookMarked },
          ].map((s) => (
            <div key={s.l} className="text-center p-6 rounded-2xl bg-[#0B1B3D] text-white">
              <s.icon className="w-7 h-7 text-sky-400 mx-auto mb-3" />
              <div className="text-3xl font-bold font-headline">{s.v}</div>
              <div className="text-white/60 text-sm mt-1">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Departments */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-[#1e3a6e] font-headline mb-3">Academic Departments</h2>
          <p className="text-gray-500 mb-10">Each department is led by a subject expert committed to academic excellence.</p>
          <div className="flex flex-col items-center justify-center py-16 border border-gray-100 rounded-2xl bg-gray-50 text-center gap-3">
            <BookMarked className="w-10 h-10 text-gray-300" />
            <p className="font-semibold text-gray-500">Department information not yet available.</p>
            <p className="text-sm text-gray-400">Please check back later or contact the school office.</p>
          </div>
        </div>

        {/* Faculty Cards */}
        <div>
          <h2 className="text-3xl font-bold text-[#1e3a6e] font-headline mb-3">Meet Our Teachers</h2>
          <p className="text-gray-500 mb-10">Our faculty members bring world-class qualifications and passion to every classroom.</p>
          <div className="flex flex-col items-center justify-center py-16 border border-gray-100 rounded-2xl bg-gray-50 text-center gap-3">
            <Users className="w-10 h-10 text-gray-300" />
            <p className="font-semibold text-gray-500">Faculty listing not yet available.</p>
            <p className="text-sm text-gray-400">Please check back later or contact the school office.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
