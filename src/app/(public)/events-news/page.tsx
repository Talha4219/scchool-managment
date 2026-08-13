"use client";
import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Bell, Trophy, Star, ChevronRight } from "lucide-react";

const events = [
  { date: "Jul 15", year: "2026", title: "Annual Sports Day",             desc: "Inter-house athletic competitions, relay races and field events. All parents welcome.", category: "Sports",      color: "bg-blue-600" },
  { date: "Aug 10", year: "2026", title: "Science & Technology Fair",     desc: "Students showcase innovative projects. Guest judges from leading tech institutions.",  category: "Academic",    color: "bg-indigo-600" },
  { date: "Sep 5",  year: "2026", title: "Annual Cultural Night",         desc: "A grand evening of student performances — drama, music, dance, and art exhibition.",  category: "Cultural",    color: "bg-sky-600" },
  { date: "Sep 20", year: "2026", title: "Parent-Teacher Conference",     desc: "Quarterly academic progress review meetings with class teachers.",                    category: "Academic",    color: "bg-blue-600" },
  { date: "Oct 8",  year: "2026", title: "Educational Trip – National Museum", desc: "Grade 6–8 students visit the National Museum and Heritage Park.",               category: "Trip",        color: "bg-violet-600" },
  { date: "Nov 1",  year: "2026", title: "Inter-School Debate Championship", desc: "Scholarly Central hosts the city-wide annual debate championship.",               category: "Competition", color: "bg-indigo-600" },
];

const news = [
  { category: "Achievement", title: "Students Win National Robotics Championship",  date: "Jun 19, 2026", desc: "Our Grade 11 robotics team swept gold at the National Science Olympiad in Lahore." },
  { category: "Academic",    title: "100% Pass Rate in O-Level Examinations",       date: "Jun 10, 2026", desc: "Proud to announce another year of 100% Cambridge O-Level results with 42 A* grades." },
  { category: "Event Report", title: "Annual Function 2026 Recap",                  date: "May 28, 2026", desc: "Over 2,000 guests attended our spectacular Annual Cultural Night — a night to remember." },
  { category: "Community",   title: "Tree Plantation Drive – 500 Saplings Planted", date: "May 15, 2026", desc: "Students and staff planted 500 trees across campus as part of our Green Initiative." },
  { category: "Achievement", title: "Best School Award 2025 Received",              date: "Apr 20, 2026", desc: "Scholarly Central has been named the Best School by the National Education Board." },
  { category: "Sports",      title: "Cricket Team Wins District Championship",      date: "Apr 5, 2026",  desc: "Our U-16 cricket team clinched the district championship, remaining undefeated all season." },
];

const announcements = [
  { date: "Jun 21, 2026", tag: "Holiday",      title: "Summer Vacation Schedule 2026",               desc: "School closed June 25 to July 31. Classes resume August 1.", urgent: true },
  { date: "Jun 18, 2026", tag: "Examinations", title: "Term 2 Examination Timetable Published",      desc: "Final exams begin July 10. Download the detailed schedule.", urgent: false },
  { date: "Jun 15, 2026", tag: "Admissions",   title: "New Academic Year Admissions Open",            desc: "Applications for Grade 1 to Grade 12 for 2026–27 are now open.", urgent: false },
  { date: "Jun 12, 2026", tag: "Notice",       title: "Parent-Teacher Meeting – Grade 9 & 10",       desc: "PTM scheduled for June 28. Please confirm attendance via the portal.", urgent: false },
];

const catColor: Record<string, string> = {
  Achievement: "bg-blue-50 text-blue-700 border-blue-200",
  Academic:    "bg-sky-50 text-sky-700 border-sky-200",
  "Event Report": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Community:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  Sports:      "bg-violet-50 text-violet-700 border-violet-200",
};

export default function EventsNewsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative h-72 sm:h-80 overflow-hidden">
        <Image src="/hero-banner.png" alt="Events" fill className="object-cover" />
        <div className="absolute inset-0 bg-[#0B1B3D]/80" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sky-300 text-xs font-semibold uppercase tracking-widest mb-4">
            <CalendarDays className="w-3 h-3" /> Whats Happening
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white font-headline">Events & News</h1>
          <p className="mt-3 text-white/70 max-w-xl">Stay up to date with the latest happenings at Scholarly Central.</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
        <div className="max-w-7xl mx-auto text-sm text-gray-500">
          <Link href="/" className="hover:text-[#1e3a6e]">Home</Link> <span className="mx-2">/</span> <span className="text-gray-800">Events & News</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Announcements */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#1e3a6e] font-headline">Important Announcements</h2>
              <p className="text-gray-500 text-sm">Official notices from school administration</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {announcements.map((a) => (
              <div key={a.title} className={`p-5 rounded-2xl border ${a.urgent ? "border-rose-200 bg-rose-50" : "border-gray-100 bg-gray-50"} hover:shadow-sm transition-all cursor-pointer`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${a.urgent ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-blue-50 text-blue-700 border-blue-100"}`}>{a.tag}</span>
                  <span className="text-xs text-gray-400">{a.date}</span>
                </div>
                <h4 className="font-bold text-[#1e3a6e] mb-1">{a.title}</h4>
                <p className="text-gray-500 text-sm">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#1e3a6e] font-headline">Upcoming Events</h2>
              <p className="text-gray-500 text-sm">Mark your calendar — exciting things ahead</p>
            </div>
          </div>
          <div className="space-y-4">
            {events.map((e) => (
              <div key={e.title} className="flex gap-4 sm:gap-6 p-5 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-md transition-all cursor-pointer">
                <div className={`shrink-0 w-16 h-16 ${e.color} rounded-2xl flex flex-col items-center justify-center text-white`}>
                  <span className="font-bold text-lg leading-none">{e.date.split(" ")[0]}</span>
                  <span className="text-white/70 text-xs">{e.date.split(" ")[1]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{e.category}</span>
                    <span className="text-xs text-gray-400">{e.year}</span>
                  </div>
                  <h4 className="font-bold text-[#1e3a6e]">{e.title}</h4>
                  <p className="text-gray-500 text-sm mt-1 leading-relaxed">{e.desc}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 self-center" />
              </div>
            ))}
          </div>
        </div>

        {/* News & Achievements */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#1e3a6e] font-headline">News & Achievements</h2>
              <p className="text-gray-500 text-sm">Celebrating our community's milestones and accomplishments</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item) => (
              <div key={item.title} className="rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer">
                <div className="h-40 relative">
                  <Image src="/gallery.png" alt={item.title} fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B1B3D]/60 to-transparent" />
                  <span className={`absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full border bg-white ${catColor[item.category] || "text-gray-700 border-gray-200"}`}>{item.category}</span>
                </div>
                <div className="p-5">
                  <p className="text-gray-400 text-xs mb-2">{item.date}</p>
                  <h3 className="font-bold text-[#1e3a6e] leading-tight mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
