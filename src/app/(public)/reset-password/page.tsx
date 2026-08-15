"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resetPasswordWithTokenAction } from "@/app/actions/auth";
import {
  GraduationCap, Lock, Eye, EyeOff, Loader2, ArrowRight,
  CheckCircle2, ShieldCheck,
} from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }

    setIsLoading(true);
    const result = await resetPasswordWithTokenAction(token, password);
    setIsLoading(false);
    if (result.error) { setError(result.error); return; }
    setSuccess(true);
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-104px)] py-16 px-4 flex items-center justify-center">
      <div className="w-full max-w-[460px]">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-10">
          <div className="mb-8">
            <div className="w-12 h-12 rounded-2xl bg-[#1e3a6e]/10 flex items-center justify-center mb-5">
              <GraduationCap className="w-6 h-6 text-[#1e3a6e]" />
            </div>
            <h1 className="font-headline text-3xl font-bold text-gray-900 mb-1.5">Set a new password</h1>
            <p className="text-gray-500 text-sm">Choose a new password for your account.</p>
          </div>

          {!token ? (
            <div role="alert" className="flex items-center gap-2.5 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
              <ShieldCheck className="w-4 h-4 shrink-0 text-red-500" />
              This link is missing its reset token. Request a new link from the sign-in page.
            </div>
          ) : success ? (
            <div className="space-y-5">
              <div role="status" className="flex items-start gap-2.5 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
                Your password has been updated. You can now sign in with your new password.
              </div>
              <Link
                href="/login"
                className="w-full py-3.5 bg-[#1e3a6e] hover:bg-[#1a3260] text-white font-bold rounded-xl shadow-lg shadow-[#1e3a6e]/20 transition-all duration-200 flex items-center justify-center gap-2 text-sm"
              >
                <span>Go to Sign In</span><ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all text-sm"
                  />
                </div>
              </div>

              {error && (
                <div role="alert" className="flex items-center gap-2.5 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-red-500" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-[#1e3a6e] hover:bg-[#1a3260] text-white font-bold rounded-xl shadow-lg shadow-[#1e3a6e]/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5 active:translate-y-0"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                ) : (
                  <><span>Update Password</span><ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <Link href="/login" className="text-gray-500 text-sm hover:text-gray-700 transition-colors">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
