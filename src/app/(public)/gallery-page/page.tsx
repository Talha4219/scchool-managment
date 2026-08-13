"use client";
import Link from "next/link";
import Image from "next/image";
import { Star, ZoomIn } from "lucide-react";
import { useState } from "react";

const categories = ["All", "Campus", "Events", "Sports", "Lab", "Library", "Cultural"];

const photos = [
  { label: "Smart Classroom",         category: "Campus",   span: "md:row-span-2" },
  { label: "Annual Sports Day",        category: "Sports",   span: "" },
  { label: "Science Lab",              category: "Lab",      span: "" },
  { label: "Annual Cultural Night",    category: "Cultural", span: "md:col-span-2" },
  { label: "Computer Lab Session",     category: "Lab",      span: "" },
  { label: "Library & Reading Room",   category: "Library",  span: "" },
  { label: "Graduation Ceremony",      category: "Events",   span: "" },
  { label: "Cricket Tournament",       category: "Sports",   span: "" },
  { label: "School Entrance",          category: "Campus",   span: "" },
];

export default function GalleryPage() {
  const [active, setActive] = useState("All");

  const filtered = active === "All" ? photos : photos.filter((p) => p.category === active);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative h-72 sm:h-80 overflow-hidden">
        <Image src="/gallery.png" alt="Gallery" fill className="object-cover" />
        <div className="absolute inset-0 bg-[#0B1B3D]/75" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sky-300 text-xs font-semibold uppercase tracking-widest mb-4">
            <Star className="w-3 h-3" /> Campus Life
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white font-headline">Photo Gallery</h1>
          <p className="mt-3 text-white/70 max-w-xl">A visual journey through the vibrant campus life at Scholarly Central.</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
        <div className="max-w-7xl mx-auto text-sm text-gray-500">
          <Link href="/" className="hover:text-[#1e3a6e]">Home</Link> <span className="mx-2">/</span> <span className="text-gray-800">Gallery</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-10 justify-center">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                active === c
                  ? "bg-[#1e3a6e] text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map((item, i) => (
            <div
              key={item.label}
              className={`group relative rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer ${i === 0 ? "md:row-span-2" : ""} ${i === 3 ? "md:col-span-2" : ""}`}
            >
              <Image
                src="/gallery.png"
                alt={item.label}
                width={600}
                height={i === 0 ? 500 : i === 3 ? 300 : 250}
                className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                style={{ height: i === 0 ? "100%" : i === 3 ? "220px" : "200px", minHeight: "200px" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1B3D]/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center">
                  <ZoomIn className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 text-white font-bold text-sm opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                {item.label}
              </div>
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-semibold px-2 py-0.5 rounded-full">{item.category}</span>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-center py-20 text-gray-400">No photos in this category yet.</p>
        )}
      </div>
    </div>
  );
}
