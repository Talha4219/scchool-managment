"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/auth";
import {
  GraduationCap, Mail, Loader2, ArrowRight, ArrowLeft,
  CheckCircle2, Copy, Check,
} from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [resetLink, setResetLink] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");
    setResetLink("");
    const result = await requestPasswordResetAction(email);
    setMessage(result.message);
    if (result.resetLink) setResetLink(result.resetLink);
    setIsLoading(false);
  };

  const fullLink = typeof window !== "undefined" && resetLink ? `${window.location.origin}${resetLink}` : resetLink;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-104px)] py-16 px-4 flex items-center justify-center">
      <div className="w-full max-w-[460px]">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-10">
          <div className="mb-8">
            <div className="w-12 h-12 rounded-2xl bg-[#1e3a6e]/10 flex items-center justify-center mb-5">
              <GraduationCap className="w-6 h-6 text-[#1e3a6e]" />
            </div>
            <h1 className="font-headline text-3xl font-bold text-gray-900 mb-1.5">Reset your password</h1>
            <p className="text-gray-500 text-sm">Enter the email on your account and we'll get you a reset link.</p>
          </div>

          {!message ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.edu"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-[#1e3a6e] hover:bg-[#1a3260] text-white font-bold rounded-xl shadow-lg shadow-[#1e3a6e]/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5 active:translate-y-0"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                ) : (
                  <><span>Send Reset Link</span><ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start gap-2.5 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
                <span>{message}</span>
              </div>

              {resetLink && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <p className="text-xs font-semibold text-amber-800">
                    Email delivery isn't configured for this school yet — use this link now, or share it with the account holder directly. It expires in 1 hour and works once.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={fullLink}
                      className="flex-1 min-w-0 truncate text-xs bg-white border border-amber-200 rounded-lg px-3 py-2 text-gray-700"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="shrink-0 flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg px-3 py-2 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <Link
                    href={resetLink}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1e3a6e] hover:underline"
                  >
                    Open reset link now <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-gray-500 text-sm hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
