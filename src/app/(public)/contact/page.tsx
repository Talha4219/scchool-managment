"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Phone, Mail, MapPin, Clock, ShieldCheck } from "lucide-react";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => { setSent(false); setForm({ name: "", email: "", phone: "", subject: "", message: "" }); }, 4000);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative h-64 sm:h-72 overflow-hidden">
        <Image src="/hero-banner.png" alt="Contact" fill className="object-cover" />
        <div className="absolute inset-0 bg-[#0B1B3D]/80" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sky-300 text-xs font-semibold uppercase tracking-widest mb-4">
            <Phone className="w-3 h-3" /> Reach Out
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white font-headline">Contact Us</h1>
          <p className="mt-3 text-white/70 max-w-xl">We're here to help. Our admissions team responds within 24 hours.</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
        <div className="max-w-7xl mx-auto text-sm text-gray-500">
          <Link href="/" className="hover:text-[#1e3a6e]">Home</Link> <span className="mx-2">/</span> <span className="text-gray-800">Contact Us</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-3 gap-12">

          {/* Contact Info */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-[#1e3a6e] font-headline mb-6">Contact Information</h2>
              <div className="space-y-5">
                {[
                  { icon: MapPin, label: "Address",      value: "123 Education Avenue, Knowledge Park\nIslamabad, Pakistan" },
                  { icon: Phone, label: "Phone",          value: "+92-51-1234567\n+92-51-7654321" },
                  { icon: Mail,  label: "Email",          value: "info@scholarlycentral.edu.pk\nadmissions@scholarlycentral.edu.pk" },
                  { icon: Clock, label: "Office Hours",   value: "Mon–Fri: 8:00 AM – 3:30 PM\nSat: 9:00 AM – 1:00 PM" },
                ].map((item) => (
                  <div key={item.label} className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#1e3a6e]/8 border border-[#1e3a6e]/10 flex items-center justify-center shrink-0">
                      <item.icon className="w-4 h-4 text-[#1e3a6e]" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">{item.label}</div>
                      <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Map */}
            <div className="rounded-2xl overflow-hidden border border-gray-200 h-52">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d212644.30985398!2d72.82185955!3d33.6844202!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x38dfbfd07891722f%3A0x6789f8fc0a8a8a8a!2sIslamabad%2C%20Pakistan!5e0!3m2!1sen!2s!4v1705000000000!5m2!1sen!2s"
                width="100%" height="208"
                style={{ border: 0 }} allowFullScreen loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="grayscale"
              />
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
              <h2 className="text-2xl font-bold text-[#1e3a6e] font-headline mb-6">Send Us a Message</h2>

              {sent ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <ShieldCheck className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-[#1e3a6e] text-xl">Message Sent!</h3>
                  <p className="text-gray-500 text-sm max-w-xs">Our admissions team will respond within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Full Name *</label>
                      <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your full name"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/10 transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Address *</label>
                      <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="your@email.com"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/10 transition-all" />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone Number</label>
                      <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+92-XXX-XXXXXXX"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/10 transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Subject *</label>
                      <select required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/10 transition-all text-gray-600">
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
                    <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us how we can help..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/10 transition-all resize-none" />
                  </div>
                  <button type="submit"
                    className="w-full bg-[#1e3a6e] hover:bg-[#1e3a6e]/90 text-white font-bold py-4 rounded-xl transition-all hover:shadow-xl hover:shadow-[#1e3a6e]/25 flex items-center justify-center gap-2">
                    <Mail className="w-4 h-4" /> Send Message
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
