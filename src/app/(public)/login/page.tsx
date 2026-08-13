"use client";

import { useState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import {
  GraduationCap, Mail, Lock, Eye, EyeOff,
  Loader2, ShieldCheck, CheckCircle2, ArrowRight,
} from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

export default function LoginPage() {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [error, setError]             = useState("");
  const [isLoading, setIsLoading]     = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    const result = await login(email, password);
    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      localStorage.setItem("sc_activeRole", result.role ?? "ADMIN");
      // Full navigation so StateProvider remounts and reads the updated role
      window.location.href = result.role === "PARENT" ? "/parent" : "/dashboard";
    }
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-104px)] py-16 px-4 flex items-center justify-center">
      <div className="w-full max-w-[460px]">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-10 relative">

          {/* Header */}
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#1e3a6e]/10 flex items-center justify-center mb-5">
                <GraduationCap className="w-6 h-6 text-[#1e3a6e]" />
              </div>
              <h1 className="font-headline text-3xl font-bold text-gray-900 mb-1.5">{t("login.welcome")}</h1>
              <p className="text-gray-500 text-sm">{t("login.subtitle")}</p>
            </div>
            <LanguageSwitcher />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t("login.email")}</label>
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

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">{t("login.password")}</label>
                <Link href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                  {t("login.forgotPassword")}
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
                <ShieldCheck className="w-4 h-4 shrink-0 text-red-500" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              id="login-submit-btn"
              className="w-full py-3.5 bg-[#1e3a6e] hover:bg-[#1a3260] text-white font-bold rounded-xl shadow-lg shadow-[#1e3a6e]/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5 active:translate-y-0"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t("login.signingIn")}</>
              ) : (
                <><span>{t("login.signIn")}</span><ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Sign up */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-gray-500 text-sm">
              {t("login.noAccount")}{" "}
              <Link href="/signup" className="text-blue-600 font-semibold hover:text-blue-800 transition-colors">
                {t("login.applyNow")} →
              </Link>
            </p>
          </div>

          {/* Trust badges */}
          <div className="mt-6 flex items-center justify-center gap-4">
            {[
              { icon: ShieldCheck, text: "Secure Login" },
              { icon: CheckCircle2, text: "256-bit SSL" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 text-gray-400 text-xs">
                <Icon className="w-3.5 h-3.5 text-green-500" />
                {text}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
