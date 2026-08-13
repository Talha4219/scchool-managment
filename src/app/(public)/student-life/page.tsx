"use client";
import Link from "next/link";
import Image from "next/image";
import { Dumbbell, Music, Palette, Users, BookOpen, Trophy, Microscope } from "lucide-react";

const clubs = [
  { name: "Robotics & AI Club",    members: 45,  icon: Microscope, color: "bg-blue-500",   desc: "Build robots, program AI models, and compete nationally." },
  { name: "Debate Society",         members: 60,  icon: Users,      color: "bg-indigo-600", desc: "Sharpen communication, argumentation, and critical thinking." },
  { name: "School Cricket Team",    members: 22,  icon: Trophy,     color: "bg-sky-500",    desc: "Represent Scholarly Central in inter-school championships." },
  { name: "Art & Craft Studio",     members: 38,  icon: Palette,    color: "bg-violet-500", desc: "Explore painting, sculpture, and graphic design." },
  { name: "School Orchestra",       members: 30,  icon: Music,      color: "bg-blue-600",   desc: "Classical and contemporary music performances and events." },
  { name: "Environmental Society",  members: 55,  icon: BookOpen,   color: "bg-emerald-600", desc: "Green campus initiatives, tree plantations, and awareness drives." },
  { name: "Sports Complex",         members: 200, icon: Dumbbell,   color: "bg-sky-600",    desc: "Cricket, basketball, volleyball, gymnasium, and swimming." },
  { name: "Literary Club",          members: 42,  icon: BookOpen,   color: "bg-indigo-500", desc: "Creative writing, poetry, and public speaking competitions." },
];

const facilities = [
  { name: "Cricket Ground",        desc: "Regulation-size cricket pitch with well-maintained outfield." },
  { name: "Basketball Courts",     desc: "2 covered courts with professional markings and hoops." },
  { name: "Indoor Gymnasium",      desc: "Fully equipped gym with modern cardio and strength equipment." },
  { name: "Swimming Pool",         desc: "Olympic-standard 25m pool with trained lifeguards." },
  { name: "Auditorium",            desc: "1,200-seat venue for performances, seminars, and events." },
  { name: "Cafeteria",             desc: "Hygienic meals under dietitian supervision with student choice." },
];

export default function StudentLifePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative h-72 sm:h-80 overflow-hidden">
        <Image src="/hero-banner.png" alt="Student Life" fill className="object-cover" />
        <div className="absolute inset-0 bg-[#0B1B3D]/80" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sky-300 text-xs font-semibold uppercase tracking-widest mb-4">
            <Dumbbell className="w-3 h-3" /> Campus Experience
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white font-headline">Student Life</h1>
          <p className="mt-3 text-white/70 max-w-xl">Beyond academics — a vibrant community of clubs, sports, arts, and lifelong memories.</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
        <div className="max-w-7xl mx-auto text-sm text-gray-500">
          <Link href="/" className="hover:text-[#1e3a6e]">Home</Link> <span className="mx-2">/</span> <span className="text-gray-800">Student Life</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Clubs & Societies */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-[#1e3a6e] font-headline mb-3">Clubs & Societies</h2>
          <p className="text-gray-500 mb-10">We believe in educating the whole person — join one of our many active clubs and societies.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {clubs.map((c) => (
              <div key={c.name} className="rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all">
                <div className={`${c.color} p-5 flex items-center gap-3`}>
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <c.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white font-bold">{c.name}</span>
                </div>
                <div className="p-4">
                  <p className="text-gray-500 text-sm leading-relaxed">{c.desc}</p>
                  <p className="text-xs text-gray-400 mt-3 font-semibold">{c.members} members</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sports & Facilities */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-[#1e3a6e] font-headline mb-3">Sports & Facilities</h2>
          <p className="text-gray-500 mb-10">World-class infrastructure to support both academic and extracurricular growth.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {facilities.map((f) => (
              <div key={f.name} className="flex gap-4 p-5 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                  <Dumbbell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-[#1e3a6e]">{f.name}</h4>
                  <p className="text-gray-500 text-sm mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Annual Events Highlight */}
        <div className="rounded-3xl bg-gradient-to-r from-[#0B1B3D] to-[#1e3a6e] text-white p-10">
          <h2 className="text-2xl font-bold mb-2">Annual Events Calendar</h2>
          <p className="text-white/70 mb-6">From Sports Day to the Annual Cultural Night, every academic year is full of memorable experiences.</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { name: "Annual Sports Day", month: "July", icon: "🏅" },
              { name: "Science Fair",      month: "August", icon: "🔬" },
              { name: "Cultural Night",    month: "September", icon: "🎭" },
            ].map((e) => (
              <div key={e.name} className="bg-white/10 border border-white/20 rounded-2xl p-5 text-center hover:bg-white/15 transition-all">
                <div className="text-4xl mb-3">{e.icon}</div>
                <div className="font-bold text-white">{e.name}</div>
                <div className="text-sky-300 text-sm mt-1">{e.month} 2026</div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/events-news">
              <button className="bg-white text-[#1e3a6e] font-bold px-7 py-3 rounded-xl hover:bg-blue-50 transition-all">
                View Full Events Calendar
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
