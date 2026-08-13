"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register, registerTeacher } from "@/app/actions/auth";
import {
  GraduationCap, ChevronLeft, Mail, Lock, Eye, EyeOff,
  Loader2, ShieldCheck, BookOpen, Star, User,
  CheckCircle2, ArrowRight, Clock,
  Phone, CreditCard, Upload, MapPin, Briefcase, Calendar,
} from "lucide-react";

type Role = "ADMIN" | "TEACHER" | "STUDENT";

const roles: { value: Role; label: string; icon: React.ElementType; desc: string; gradient: string }[] = [
  { value: "ADMIN",   label: "Admin",   icon: ShieldCheck,   desc: "Full system access",  gradient: "from-[#1e3a6e] to-[#1e3a6e]/80" },
  { value: "TEACHER", label: "Teacher", icon: BookOpen,       desc: "Classes & grades",    gradient: "from-indigo-600 to-indigo-700" },
  { value: "STUDENT", label: "Student", icon: GraduationCap,  desc: "My academics",        gradient: "from-sky-600 to-sky-700" },
];

function readAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

function PhotoBox({
  label, preview, onFile, required,
}: { label: string; preview: string | null; onFile: (b64: string) => void; required?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}{required && " *"}</label>
      <div
        onClick={() => ref.current?.click()}
        className="relative flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl h-32 cursor-pointer hover:border-indigo-400 transition-colors bg-gray-50 overflow-hidden"
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-gray-400 text-xs">
            <Upload className="h-5 w-5" />
            <span>Click to upload</span>
            <span className="text-[10px] text-gray-300">JPG, PNG, WebP</span>
          </div>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async e => {
            const file = e.target.files?.[0];
            if (file) onFile(await readAsDataURL(file));
          }}
        />
      </div>
    </div>
  );
}

function Field({
  label, icon: Icon, children,
}: { label: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />}
        {children}
      </div>
    </div>
  );
}

export default function SignUpPage() {
  const router = useRouter();

  // Step 1 fields
  const [name,            setName]            = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role,            setRole]            = useState<Role>("STUDENT");
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);

  // Step 2 fields (teacher only)
  const [phone,           setPhone]           = useState("");
  const [cnic,            setCnic]            = useState("");
  const [specialization,  setSpecialization]  = useState("");
  const [qualification,   setQualification]   = useState("");
  const [experience,      setExperience]      = useState("");
  const [joiningDate,     setJoiningDate]     = useState("");
  const [address,         setAddress]         = useState("");
  const [profilePhoto,    setProfilePhoto]    = useState<string | null>(null);
  const [degreePhoto,     setDegreePhoto]     = useState<string | null>(null);

  const [step,      setStep]      = useState<1 | 2>(1);
  const [error,     setError]     = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const passwordStrength = (() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8)         score++;
    if (/[A-Z]/.test(password))       score++;
    if (/[0-9]/.test(password))       score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][passwordStrength];
  const strengthColor = ["", "bg-red-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"][passwordStrength];

  const validateStep1 = () => {
    if (password.length < 8)           { setError("Password must be at least 8 characters."); return false; }
    if (password !== confirmPassword)  { setError("Passwords do not match."); return false; }
    return true;
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validateStep1()) return;
    setStep(2);
  };

  const handleSubmitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validateStep1()) return;
    setIsLoading(true);
    const result = await register(name, email, password, role);
    setIsLoading(false);
    if (result.error) { setError(result.error); return; }
    if (result.pending) { setSubmitted(true); return; }
    router.push("/dashboard");
    router.refresh();
  };

  const handleSubmitStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!phone.trim() || !cnic.trim() || !specialization.trim() || !qualification.trim()) {
      setError("Phone, CNIC, Specialization, and Qualification are required."); return;
    }
    if (!profilePhoto) { setError("Profile photo is required."); return; }
    if (!degreePhoto)  { setError("Degree certificate photo is required."); return; }
    setIsLoading(true);
    const result = await registerTeacher(name, email, password, {
      phone, cnic, specialization, qualification,
      experienceYears: parseInt(experience) || 0,
      joiningDate, address,
      profilePhoto, degreePhoto,
    });
    setIsLoading(false);
    if (result.error) { setError(result.error); return; }
    if (result.pending) { setSubmitted(true); return; }
    router.push("/dashboard");
    router.refresh();
  };

  const inputCls = (hasIcon = true, hasError = false) =>
    `w-full ${hasIcon ? "pl-10" : "pl-4"} pr-4 py-3 bg-gray-50 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all text-sm ${hasError ? "border-red-300" : "border-gray-200"}`;

  if (submitted) {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-104px)] py-16 px-4 flex items-center justify-center">
        <div className="w-full max-w-[460px]">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto mb-5">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="font-headline text-2xl font-bold text-gray-900 mb-2">Application Submitted</h1>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Your account has been submitted for review. An administrator will approve your access shortly.
              You will be able to log in once your account is approved.
            </p>
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium mb-6">
              Registered as: <span className="font-bold">{email}</span>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1e3a6e] text-white font-bold rounded-xl text-sm hover:bg-[#1a3260] transition-colors"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-104px)] py-16 px-4 flex items-center justify-center">
      <div className="w-full max-w-[520px]">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-10 relative">

          {/* Step indicator (teacher only) */}
          {role === "TEACHER" && step === 2 && (
            <button
              type="button"
              onClick={() => { setStep(1); setError(""); }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back to account details
            </button>
          )}

          {/* Header */}
          <div className="mb-7">
            <div className="w-12 h-12 rounded-2xl bg-[#1e3a6e]/10 flex items-center justify-center mb-5">
              {step === 2 ? <BookOpen className="w-6 h-6 text-indigo-600" /> : <GraduationCap className="w-6 h-6 text-[#1e3a6e]" />}
            </div>
            {step === 1 ? (
              <>
                <h1 className="font-headline text-3xl font-bold text-gray-900 mb-1.5">Create an account</h1>
                <p className="text-gray-500 text-sm">Fill in your details below to get started with Scholarly Central.</p>
              </>
            ) : (
              <>
                <h1 className="font-headline text-2xl font-bold text-gray-900 mb-1.5">Teacher Profile</h1>
                <p className="text-gray-500 text-sm">Complete your professional profile — required for account activation.</p>
              </>
            )}
            {role === "TEACHER" && (
              <div className="flex items-center gap-2 mt-3">
                <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-indigo-500" : "bg-gray-200"}`} />
                <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-indigo-500" : "bg-gray-200"}`} />
                <span className="text-xs text-gray-400 ml-1">Step {step}/2</span>
              </div>
            )}
          </div>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <form onSubmit={role === "TEACHER" ? handleNext : handleSubmitStep1} className="space-y-4">
              {/* Full Name */}
              <Field label="Full Name" icon={User}>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" className={inputCls()} />
              </Field>

              {/* Email */}
              <Field label="Email Address" icon={Mail}>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@school.edu" className={inputCls()} />
              </Field>

              {/* Role selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Account Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map(({ value: v, label, icon: Icon, desc, gradient }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setRole(v)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 text-center ${
                        role === v ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${role === v ? "text-blue-700" : "text-gray-700"}`}>{label}</p>
                        <p className={`text-[10px] ${role === v ? "text-blue-500" : "text-gray-400"}`}>{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {role === "TEACHER" && (
                  <p className="mt-2 text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
                    Teacher accounts require a professional profile in the next step.
                  </p>
                )}
              </div>

              {/* Password */}
              <Field label="Password" icon={Lock}>
                <input
                  type={showPassword ? "text" : "password"}
                  required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className={`${inputCls()} pr-12`}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </Field>
              {password && (
                <div className="-mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4].map(i => <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= passwordStrength ? strengthColor : "bg-gray-200"}`} />)}
                  </div>
                  <p className={`text-xs ${["","text-red-500","text-yellow-600","text-blue-600","text-green-600"][passwordStrength]}`}>{strengthLabel} password</p>
                </div>
              )}

              {/* Confirm Password */}
              <Field label="Confirm Password" icon={CheckCircle2}>
                <input
                  type={showConfirm ? "text" : "password"}
                  required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className={`${inputCls(true, !!(confirmPassword && confirmPassword !== password))} pr-12`}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </Field>
              {confirmPassword && confirmPassword !== password && <p className="-mt-2 text-xs text-red-500">Passwords do not match</p>}

              {error && (
                <div className="flex items-center gap-2.5 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-red-500" /> {error}
                </div>
              )}

              <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-[#1e3a6e] hover:bg-[#1a3260] text-white font-bold rounded-xl shadow-lg shadow-[#1e3a6e]/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5 active:translate-y-0 mt-1">
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
                ) : role === "TEACHER" ? (
                  <><span>Next — Professional Profile</span><ArrowRight className="w-4 h-4" /></>
                ) : (
                  <><span>Create My Account</span><ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          )}

          {/* ── STEP 2 (Teacher profile) ── */}
          {step === 2 && (
            <form onSubmit={handleSubmitStep2} className="space-y-4">

              {/* Personal */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone Number *" icon={Phone}>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+92 300 0000000" className={inputCls()} />
                </Field>
                <Field label="CNIC *" icon={CreditCard}>
                  <input value={cnic} onChange={e => setCnic(e.target.value)} placeholder="12345-6789012-3" className={inputCls()} />
                </Field>
              </div>

              {/* Professional */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Specialization *" icon={Star}>
                  <input value={specialization} onChange={e => setSpecialization(e.target.value)} placeholder="e.g. Mathematics" className={inputCls()} />
                </Field>
                <Field label="Qualification *" icon={GraduationCap}>
                  <input value={qualification} onChange={e => setQualification(e.target.value)} placeholder="e.g. M.Ed, MSc" className={inputCls()} />
                </Field>
                <Field label="Experience (years)" icon={Briefcase}>
                  <input type="number" min="0" value={experience} onChange={e => setExperience(e.target.value)} placeholder="0" className={inputCls()} />
                </Field>
                <Field label="Joining Date" icon={Calendar}>
                  <input type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} className={inputCls()} />
                </Field>
              </div>

              <Field label="Home Address" icon={MapPin}>
                <textarea
                  value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="Full home address"
                  rows={2}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all text-sm resize-none"
                />
              </Field>

              {/* Photos */}
              <div className="grid grid-cols-2 gap-4">
                <PhotoBox label="Profile Photo" preview={profilePhoto} onFile={setProfilePhoto} required />
                <PhotoBox label="Degree / Certificate" preview={degreePhoto} onFile={setDegreePhoto} required />
              </div>

              {error && (
                <div className="flex items-center gap-2.5 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-red-500" /> {error}
                </div>
              )}

              <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5 active:translate-y-0 mt-1">
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
                ) : (
                  <><span>Create My Teacher Account</span><ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          )}

          {/* Sign in link */}
          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-gray-500 text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-800 transition-colors">Sign in →</Link>
            </p>
          </div>

          <div className="mt-4 flex items-center justify-center gap-4">
            {[{ icon: ShieldCheck, text: "256-bit SSL" }, { icon: CheckCircle2, text: "FERPA Compliant" }].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 text-gray-400 text-xs">
                <Icon className="w-3.5 h-3.5 text-green-500" /> {text}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
