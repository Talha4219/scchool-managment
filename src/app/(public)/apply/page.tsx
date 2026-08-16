"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  GraduationCap, User, BookOpen, Users, ClipboardCheck,
  CheckCircle2, Loader2, ChevronRight, ChevronLeft, Copy, Printer,
  MapPin, Phone, Mail, Calendar, Globe, Heart, School, UserCheck,
  Lock, Eye, EyeOff, Camera, Upload, X, FileText, ImageIcon, AlertCircle,
} from "lucide-react";
import { getSchoolInfoAction, submitAdmissionApplicationAction } from "@/app/actions/admissions";
import { fetchClassesDB } from "@/app/actions/academic-core";

// ─── Types ──────────────────────────────────────────────────────────────────

interface FormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  bloodGroup: string;
  applyingForClass: string;
  previousSchool: string;
  previousGrade: string;
  parentName: string;
  parentRelation: string;
  parentPhone: string;
  parentEmail: string;
  parentCNIC: string;
  address: string;
  city: string;
  parentPortalPassword: string;
  confirmPortalPassword: string;
}

type FieldErrors = Partial<Record<keyof FormData, string>> & {
  profilePhoto?: string;
  previousResult?: string;
};

const EMPTY_FORM: FormData = {
  firstName: "", lastName: "", dateOfBirth: "", gender: "", nationality: "", bloodGroup: "",
  applyingForClass: "", previousSchool: "", previousGrade: "",
  parentName: "", parentRelation: "", parentPhone: "", parentEmail: "", parentCNIC: "",
  address: "", city: "",
  parentPortalPassword: "", confirmPortalPassword: "",
};

const RELATIONS = ["Father", "Mother", "Guardian", "Uncle", "Aunt", "Grandparent"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_DOC   = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_PHOTO_MB   = 2;
const MAX_DOC_MB     = 5;

// ─── Step Config ────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, title: "Personal Information",  icon: User,          desc: "Student's basic details & photo" },
  { id: 2, title: "Academic Background",   icon: BookOpen,      desc: "Previous education & result document" },
  { id: 3, title: "Parent / Guardian",     icon: Users,         desc: "Contact & guardian details" },
  { id: 4, title: "Review & Submit",       icon: ClipboardCheck,desc: "Confirm your application" },
];

// ─── Helper: read file as base64 data URL ────────────────────────────────────

function readAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

// ─── Shared TextInput ────────────────────────────────────────────────────────

function TextInput({
  value, onChange, placeholder, type = "text", icon, error,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; icon?: React.ElementType; error?: string;
}) {
  return (
    <div className="relative">
      {icon && React.createElement(icon, { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" })}
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${icon ? "pl-9" : ""} ${error ? "border-red-400 focus-visible:ring-red-400" : "border-gray-200"} h-10`}
      />
    </div>
  );
}

// ─── Profile Photo Upload ─────────────────────────────────────────────────────

function PhotoUpload({ preview, onFile, onClear, error }: {
  preview: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (file: File) => {
    if (!ACCEPTED_IMAGE.includes(file.type)) return;
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) return;
    onFile(file);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-gray-700">
        Profile Photo <span className="text-gray-400 text-xs">(optional — JPG/PNG, max {MAX_PHOTO_MB}MB)</span>
      </Label>

      {preview ? (
        <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <img src={preview} alt="Profile" className="w-20 h-20 rounded-xl object-cover border-2 border-white shadow-sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">Photo uploaded</p>
            <p className="text-xs text-gray-500 mt-0.5">Looking good! You can change it below.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button type="button" size="sm" variant="outline" className="text-xs h-8 gap-1.5"
              onClick={() => inputRef.current?.click()}>
              <Camera className="h-3.5 w-3.5" /> Change
            </Button>
            <Button type="button" size="sm" variant="outline" className="text-xs h-8 gap-1.5 text-red-500 border-red-200 hover:bg-red-50"
              onClick={onClear}>
              <X className="h-3.5 w-3.5" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
            ${dragging ? "border-[#1e3a6e] bg-blue-50" : error ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-[#1e3a6e] hover:bg-blue-50/40"}`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${dragging ? "bg-blue-100" : "bg-gray-100"}`}>
              <Camera className={`h-7 w-7 ${dragging ? "text-[#1e3a6e]" : "text-gray-400"}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {dragging ? "Drop your photo here" : "Upload student photo"}
              </p>
              <p className="text-xs text-gray-400 mt-1">Drag & drop or click to browse · JPG, PNG, WebP</p>
            </div>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE.join(",")}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ""; }}
      />
      {error && <p className="text-xs text-red-500 font-medium flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  );
}

// ─── Previous Result Upload ───────────────────────────────────────────────────

function ResultUpload({ file, onFile, onClear, error }: {
  file: File | null;
  onFile: (file: File) => void;
  onClear: () => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (f: File) => {
    if (!ACCEPTED_DOC.includes(f.type)) return;
    if (f.size > MAX_DOC_MB * 1024 * 1024) return;
    onFile(f);
  };

  const isImage = file && file.type.startsWith("image/");
  const isPDF   = file && file.type === "application/pdf";

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-gray-700">
        Previous Result / Report Card <span className="text-gray-400 text-xs">(optional — PDF/JPG/PNG, max {MAX_DOC_MB}MB)</span>
      </Label>

      {file ? (
        <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            {isPDF
              ? <FileText className="h-6 w-6 text-blue-600" />
              : <ImageIcon className="h-6 w-6 text-blue-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{(file.size / 1024).toFixed(0)} KB · {isPDF ? "PDF Document" : "Image"}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button type="button" size="sm" variant="outline" className="text-xs h-8 gap-1.5"
              onClick={() => inputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Change
            </Button>
            <Button type="button" size="sm" variant="outline" className="text-xs h-8 gap-1 text-red-500 border-red-200 hover:bg-red-50"
              onClick={onClear}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
          className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all
            ${dragging ? "border-[#1e3a6e] bg-blue-50" : error ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-[#1e3a6e] hover:bg-blue-50/40"}`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${dragging ? "bg-blue-100" : "bg-gray-100"}`}>
              <Upload className={`h-6 w-6 ${dragging ? "text-[#1e3a6e]" : "text-gray-400"}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {dragging ? "Drop document here" : "Upload result card or report"}
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG · Scanned report card, marksheet, or transcript</p>
            </div>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_DOC.join(",")}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ""; }}
      />
      {error && <p className="text-xs text-red-500 font-medium flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  );
}

// ─── Step 1: Personal Info ───────────────────────────────────────────────────

function Step1({
  form, update, errors,
  photoPreview, onPhotoFile, onPhotoClear,
}: {
  form: FormData; update: (k: keyof FormData, v: string) => void; errors: FieldErrors;
  photoPreview: string | null; onPhotoFile: (f: File) => void; onPhotoClear: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Profile Photo */}
      <PhotoUpload
        preview={photoPreview}
        onFile={onPhotoFile}
        onClear={onPhotoClear}
        error={errors.profilePhoto}
      />

      <div className="border-t border-gray-100 pt-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">First Name <span className="text-red-500">*</span></Label>
            <TextInput value={form.firstName} onChange={v => update("firstName", v)} placeholder="e.g. Sarah" icon={User} error={errors.firstName} />
            {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">Last Name <span className="text-red-500">*</span></Label>
            <TextInput value={form.lastName} onChange={v => update("lastName", v)} placeholder="e.g. Johnson" error={errors.lastName} />
            {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-gray-700">Date of Birth <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
            <Input
              type="date"
              value={form.dateOfBirth}
              onChange={e => update("dateOfBirth", e.target.value)}
              className={`pl-9 h-10 ${errors.dateOfBirth ? "border-red-400" : "border-gray-200"}`}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>
          {errors.dateOfBirth && <p className="text-xs text-red-500">{errors.dateOfBirth}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-gray-700">Gender <span className="text-red-500">*</span></Label>
          <Select value={form.gender} onValueChange={v => update("gender", v)}>
            <SelectTrigger className={`h-10 ${errors.gender ? "border-red-400" : "border-gray-200"}`}><SelectValue placeholder="Select gender" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {errors.gender && <p className="text-xs text-red-500">{errors.gender}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-gray-700">Nationality <span className="text-red-500">*</span></Label>
          <TextInput value={form.nationality} onChange={v => update("nationality", v)} placeholder="e.g. Pakistani" icon={Globe} error={errors.nationality} />
          {errors.nationality && <p className="text-xs text-red-500">{errors.nationality}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-gray-700">Blood Group <span className="text-gray-400 text-xs">(optional)</span></Label>
          <Select value={form.bloodGroup} onValueChange={v => update("bloodGroup", v)}>
            <SelectTrigger className="h-10 border-gray-200"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {BLOOD_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Academic Background ─────────────────────────────────────────────

function Step2({
  form, update, errors, classOptions,
  resultFile, onResultFile, onResultClear,
}: {
  form: FormData; update: (k: keyof FormData, v: string) => void; errors: FieldErrors;
  classOptions: {id: string; name: string}[];
  resultFile: File | null; onResultFile: (f: File) => void; onResultClear: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold text-gray-700">Applying for Class <span className="text-red-500">*</span></Label>
        <Select value={form.applyingForClass} onValueChange={v => update("applyingForClass", v)}>
          <SelectTrigger className={`h-10 ${errors.applyingForClass ? "border-red-400" : "border-gray-200"}`}>
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            {classOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {errors.applyingForClass && <p className="text-xs text-red-500">{errors.applyingForClass}</p>}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Previous Education</p>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">Previous School Name <span className="text-gray-400 text-xs">(optional)</span></Label>
            <TextInput value={form.previousSchool} onChange={v => update("previousSchool", v)} placeholder="e.g. Sunrise Public School" icon={School} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">Last Grade / Class Completed <span className="text-gray-400 text-xs">(optional)</span></Label>
            <TextInput value={form.previousGrade} onChange={v => update("previousGrade", v)} placeholder="e.g. Grade 8 / 85%" icon={BookOpen} />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <ResultUpload
          file={resultFile}
          onFile={onResultFile}
          onClear={onResultClear}
          error={errors.previousResult}
        />
        {!resultFile && (
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3 shrink-0" />
            New students without a previous school may skip this. Original documents must be presented at admission.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Parent / Guardian ───────────────────────────────────────────────

function Step3({ form, update, errors }: { form: FormData; update: (k: keyof FormData, v: string) => void; errors: FieldErrors }) {
  const [showPass, setShowPass] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-gray-700">Full Name <span className="text-red-500">*</span></Label>
          <TextInput value={form.parentName} onChange={v => update("parentName", v)} placeholder="Guardian's full name" icon={UserCheck} error={errors.parentName} />
          {errors.parentName && <p className="text-xs text-red-500">{errors.parentName}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-gray-700">Relation <span className="text-red-500">*</span></Label>
          <Select value={form.parentRelation} onValueChange={v => update("parentRelation", v)}>
            <SelectTrigger className={`h-10 ${errors.parentRelation ? "border-red-400" : "border-gray-200"}`}>
              <SelectValue placeholder="Select relation" />
            </SelectTrigger>
            <SelectContent>
              {RELATIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          {errors.parentRelation && <p className="text-xs text-red-500">{errors.parentRelation}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-gray-700">Phone Number <span className="text-red-500">*</span></Label>
          <TextInput value={form.parentPhone} onChange={v => update("parentPhone", v)} placeholder="+92 300 0000000" icon={Phone} error={errors.parentPhone} />
          {errors.parentPhone && <p className="text-xs text-red-500">{errors.parentPhone}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-gray-700">Email Address <span className="text-red-500">*</span></Label>
          <TextInput value={form.parentEmail} onChange={v => update("parentEmail", v)} type="email" placeholder="parent@email.com" icon={Mail} error={errors.parentEmail} />
          {errors.parentEmail && <p className="text-xs text-red-500">{errors.parentEmail}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-semibold text-gray-700">CNIC / Passport No. <span className="text-gray-400 text-xs">(optional)</span></Label>
        <TextInput value={form.parentCNIC} onChange={v => update("parentCNIC", v)} placeholder="e.g. 42101-1234567-1" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-semibold text-gray-700">Residential Address <span className="text-red-500">*</span></Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
          <Textarea
            value={form.address}
            onChange={e => update("address", e.target.value)}
            placeholder="House no., Street, Area..."
            className={`pl-9 resize-none ${errors.address ? "border-red-400" : "border-gray-200"}`}
            rows={2}
          />
        </div>
        {errors.address && <p className="text-xs text-red-500">{errors.address}</p>}
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-semibold text-gray-700">City <span className="text-red-500">*</span></Label>
        <TextInput value={form.city} onChange={v => update("city", v)} placeholder="e.g. Karachi" icon={MapPin} error={errors.city} />
        {errors.city && <p className="text-xs text-red-500">{errors.city}</p>}
      </div>

      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Parent Portal Account</p>
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 mb-4">
          Set a password for your parent portal. You and your child will use this to log in after admission is approved.
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">Portal Password <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
              <Input
                type={showPass ? "text" : "password"}
                value={form.parentPortalPassword}
                onChange={e => update("parentPortalPassword", e.target.value)}
                placeholder="Min. 8 characters"
                className={`pl-9 pr-9 h-10 ${errors.parentPortalPassword ? "border-red-400" : "border-gray-200"}`}
              />
              <button type="button" onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.parentPortalPassword && <p className="text-xs text-red-500">{errors.parentPortalPassword}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">Confirm Password <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
              <Input
                type={showConfirm ? "text" : "password"}
                value={form.confirmPortalPassword}
                onChange={e => update("confirmPortalPassword", e.target.value)}
                placeholder="Repeat password"
                className={`pl-9 pr-9 h-10 ${errors.confirmPortalPassword ? "border-red-400" : "border-gray-200"}`}
              />
              <button type="button" onClick={() => setShowConfirm(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPortalPassword && <p className="text-xs text-red-500">{errors.confirmPortalPassword}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Review ──────────────────────────────────────────────────────────

function ReviewSection({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</p>
      <div className="bg-gray-50 rounded-lg border border-gray-100 divide-y divide-gray-100">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between items-center px-4 py-2.5 text-sm">
            <span className="text-gray-500 font-medium">{label}</span>
            <span className="text-gray-900 font-semibold text-right max-w-[60%]">{value || <span className="text-gray-300">—</span>}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step4Review({
  form, agreed, setAgreed, photoPreview, resultFile, classOptions,
}: {
  form: FormData; agreed: boolean; setAgreed: (v: boolean) => void;
  photoPreview: string | null; resultFile: File | null;
  classOptions: {id: string; name: string}[];
}) {
  return (
    <div className="space-y-5">
      {/* Documents preview */}
      {(photoPreview || resultFile) && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Uploaded Documents</p>
          <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 flex items-center gap-5 flex-wrap">
            {photoPreview && (
              <div className="flex items-center gap-3">
                <img src={photoPreview} alt="Student" className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-sm" />
                <div>
                  <p className="text-xs font-bold text-gray-700">Profile Photo</p>
                  <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Uploaded</p>
                </div>
              </div>
            )}
            {photoPreview && resultFile && <div className="w-px h-10 bg-gray-200 hidden sm:block" />}
            {resultFile && (
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  {resultFile.type === "application/pdf"
                    ? <FileText className="h-7 w-7 text-blue-600" />
                    : <ImageIcon className="h-7 w-7 text-blue-600" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-700">Previous Result</p>
                  <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{resultFile.name}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ReviewSection
        title="Student Information"
        rows={[
          ["Full Name", `${form.firstName} ${form.lastName}`],
          ["Date of Birth", form.dateOfBirth],
          ["Gender", form.gender],
          ["Nationality", form.nationality],
          ["Blood Group", form.bloodGroup],
        ]}
      />
      <ReviewSection
        title="Academic Background"
        rows={[
          ["Applying for Class", classOptions.find(c => c.id === form.applyingForClass)?.name || form.applyingForClass],
          ["Previous School", form.previousSchool],
          ["Previous Grade", form.previousGrade],
          ["Result Document", resultFile ? resultFile.name : "Not uploaded"],
        ]}
      />
      <ReviewSection
        title="Parent / Guardian"
        rows={[
          ["Name", form.parentName],
          ["Relation", form.parentRelation],
          ["Phone", form.parentPhone],
          ["Email", form.parentEmail],
          ["CNIC / Passport", form.parentCNIC],
          ["Address", form.address],
          ["City", form.city],
        ]}
      />
      <ReviewSection
        title="Portal Account"
        rows={[
          ["Login Email", form.parentEmail],
          ["Portal Password", form.parentPortalPassword ? "••••••••" : "Not set"],
        ]}
      />
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-800 mb-3 font-medium leading-relaxed">
          By submitting this application, I declare that all information provided is accurate and complete to the best of my knowledge. I understand that providing false information may result in cancellation of admission.
        </p>
        <div className="flex items-start gap-3">
          <Checkbox id="agree" checked={agreed} onCheckedChange={v => setAgreed(!!v)} className="mt-0.5" />
          <label htmlFor="agree" className="text-sm text-amber-900 font-semibold cursor-pointer leading-snug">
            I have read and agree to the terms and conditions of this admission application.
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Success Page ────────────────────────────────────────────────────────────

function SuccessPage({ applicationId, submittedAt, schoolName, parentEmail, hasPhoto, hasResult }: {
  applicationId: string; submittedAt: string; schoolName: string;
  parentEmail: string; hasPhoto: boolean; hasResult: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copyId = () => { navigator.clipboard.writeText(applicationId); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="bg-slate-50 min-h-screen py-16 px-4 flex items-center justify-center">
      <div className="w-full max-w-lg">
        <Card className="border-none shadow-2xl">
          <CardContent className="pt-10 pb-8 px-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Thank you for applying to <strong>{schoolName}</strong>. We have received your application and will review it shortly.
            </p>

            {/* Document receipt */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${hasPhoto ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                <Camera className="h-3.5 w-3.5" />
                {hasPhoto ? "Photo received" : "No photo"}
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${hasResult ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                <FileText className="h-3.5 w-3.5" />
                {hasResult ? "Result received" : "No result doc"}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Application Reference</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl font-bold font-mono text-[#0B1B3D]">{applicationId}</span>
                <button onClick={copyId} className="p-1.5 rounded-md hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600" title="Copy ID">
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Submitted on {submittedAt}</p>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl mb-6 text-left">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">Your Portal Login (After Approval)</p>
              <div className="flex justify-between text-sm py-1">
                <span className="text-purple-600 font-medium">Email</span>
                <span className="font-bold text-purple-900 font-mono text-xs">{parentEmail}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-purple-600 font-medium">Password</span>
                <span className="font-bold text-purple-900">The one you set</span>
              </div>
              <p className="text-xs text-purple-500 mt-2">Portals activate only after the admin grants admission.</p>
            </div>

            <div className="space-y-2 text-sm text-gray-600 mb-8">
              {[
                "Keep your reference number for tracking",
                "Review takes 5–7 working days",
                "You will be contacted via email / phone",
                "Bring original documents on admission day",
              ].map(t => (
                <div key={t} className="flex items-center gap-2 justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0B1B3D]" />
                  <span>{t}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 gap-2" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print
              </Button>
              <Button className="flex-1 bg-[#0B1B3D] hover:bg-[#0B1B3D]/90 gap-2" onClick={() => window.location.reload()}>
                New Application
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ApplyPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ applicationId: string; submittedAt: string; parentEmail: string; hasPhoto: boolean; hasResult: boolean } | null>(null);
  const [schoolInfo, setSchoolInfo] = useState({ name: "Classora", academicYear: "2026-2027" });

  const [classOptions, setClassOptions] = useState<{id: string; name: string}[]>(
    ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
     "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"].map(n => ({id: n, name: n}))
  );

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile,    setPhotoFile]    = useState<File | null>(null);
  const [resultPreview, setResultPreview] = useState<string | null>(null);
  const [resultFile,   setResultFile]   = useState<File | null>(null);

  useEffect(() => { getSchoolInfoAction().then(setSchoolInfo); }, []);

  useEffect(() => {
    fetchClassesDB().then(cls => {
      if (cls.length > 0) {
        const seen = new Set<string>();
        setClassOptions(cls.filter(c => { const dup = seen.has(c.name); seen.add(c.name); return !dup; }).map(c => ({id: c.id, name: c.name})));
      }
    });
  }, []);

  const update = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if ((errors as any)[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handlePhotoFile = async (file: File) => {
    setPhotoFile(file);
    const dataUrl = await readAsDataURL(file);
    setPhotoPreview(dataUrl);
    setErrors(prev => ({ ...prev, profilePhoto: undefined }));
  };
  const handlePhotoClear = () => { setPhotoFile(null); setPhotoPreview(null); };
  const handleResultFile = (file: File) => { setResultFile(file); setErrors(prev => ({ ...prev, previousResult: undefined })); };
  const handleResultClear = () => setResultFile(null);

  const validate = (s: number): boolean => {
    const e: FieldErrors = {};
    if (s === 1) {
      if (!form.firstName.trim()) e.firstName = "First name is required";
      if (!form.lastName.trim())  e.lastName  = "Last name is required";
      if (!form.dateOfBirth)      e.dateOfBirth = "Date of birth is required";
      if (!form.gender)           e.gender    = "Gender is required";
      if (!form.nationality.trim()) e.nationality = "Nationality is required";
      if (photoFile && !ACCEPTED_IMAGE.includes(photoFile.type))
        e.profilePhoto = "Only JPG, PNG, WebP images are accepted";
      if (photoFile && photoFile.size > MAX_PHOTO_MB * 1024 * 1024)
        e.profilePhoto = `Photo must be under ${MAX_PHOTO_MB}MB`;
    }
    if (s === 2) {
      if (!form.applyingForClass) e.applyingForClass = "Please select a class";
      if (resultFile && !ACCEPTED_DOC.includes(resultFile.type))
        e.previousResult = "Only PDF, JPG, PNG, WebP files are accepted";
      if (resultFile && resultFile.size > MAX_DOC_MB * 1024 * 1024)
        e.previousResult = `Document must be under ${MAX_DOC_MB}MB`;
    }
    if (s === 3) {
      if (!form.parentName.trim())  e.parentName  = "Full name is required";
      if (!form.parentRelation)     e.parentRelation = "Relation is required";
      if (!form.parentPhone.trim()) e.parentPhone = "Phone number is required";
      if (!form.parentEmail.trim()) e.parentEmail = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.parentEmail)) e.parentEmail = "Invalid email address";
      if (!form.address.trim())     e.address = "Address is required";
      if (!form.city.trim())        e.city    = "City is required";
      if (!form.parentPortalPassword) e.parentPortalPassword = "Portal password is required";
      else if (form.parentPortalPassword.length < 8) e.parentPortalPassword = "Password must be at least 8 characters";
      if (form.parentPortalPassword && form.parentPortalPassword !== form.confirmPortalPassword)
        e.confirmPortalPassword = "Passwords do not match";
      else if (!form.confirmPortalPassword)
        e.confirmPortalPassword = "Please confirm your password";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validate(step)) setStep(s => s + 1); };
  const handleBack = () => { setStep(s => s - 1); setErrors({}); };

  const handleSubmit = async () => {
    if (!agreed || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const className = classOptions.find(c => c.id === form.applyingForClass)?.name || form.applyingForClass;
      const result = await submitAdmissionApplicationAction({
        firstName: form.firstName, lastName: form.lastName,
        dateOfBirth: form.dateOfBirth, gender: form.gender as any,
        nationality: form.nationality, bloodGroup: form.bloodGroup || undefined,
        applyingForClass: className,
        previousSchool: form.previousSchool || undefined,
        previousGrade: form.previousGrade || undefined,
        parentName: form.parentName, parentRelation: form.parentRelation,
        parentPhone: form.parentPhone, parentEmail: form.parentEmail,
        parentCNIC: form.parentCNIC || undefined,
        address: form.address, city: form.city,
        parentPortalPassword: form.parentPortalPassword || undefined,
        profilePhoto: photoPreview ?? undefined,
        previousResultFilename: resultFile?.name ?? undefined,
      });
      setSubmitted({
        ...result,
        parentEmail: form.parentEmail,
        hasPhoto: !!photoPreview,
        hasResult: !!resultFile,
      });
    } catch (err) {
      console.error("Submission failed", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SuccessPage
        applicationId={submitted.applicationId}
        submittedAt={submitted.submittedAt}
        schoolName={schoolInfo.name}
        parentEmail={submitted.parentEmail}
        hasPhoto={submitted.hasPhoto}
        hasResult={submitted.hasResult}
      />
    );
  }

  const currentStep = STEPS[step - 1];

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <main className="px-4 pb-12">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Page Title */}
          <div className="text-center pb-4">
            <h1 className="text-3xl font-extrabold text-[#1e3a6e] font-headline tracking-tight">{schoolInfo.name}</h1>
            <p className="text-gray-500 text-sm mt-1.5 font-medium uppercase tracking-wider">Online Admission Application · {schoolInfo.academicYear}</p>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const isActive = step === s.id;
              const isDone   = step > s.id;
              return (
                <React.Fragment key={s.id}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all border-2
                      ${isDone ? "bg-green-500 border-green-500 text-white" : isActive ? "bg-white border-[#1e3a6e] text-[#1e3a6e] shadow-sm" : "bg-slate-100 border-slate-200 text-slate-400"}`}>
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                    </div>
                    <span className={`text-[10px] font-semibold hidden sm:block ${isActive ? "text-[#1e3a6e] font-bold" : isDone ? "text-green-600" : "text-slate-400"}`}>
                      {s.title.split(" ")[0]}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 rounded transition-all ${step > s.id ? "bg-green-500" : "bg-slate-200"}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Form Card */}
          <Card className="border-none shadow-2xl">
            <CardHeader className="pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#0B1B3D]/10 rounded-lg">
                  <currentStep.icon className="h-5 w-5 text-[#0B1B3D]" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-[#0B1B3D]">
                    Step {step} of {STEPS.length}: {currentStep.title}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">{currentStep.desc}</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {step === 1 && (
                <Step1
                  form={form} update={update} errors={errors}
                  photoPreview={photoPreview}
                  onPhotoFile={handlePhotoFile}
                  onPhotoClear={handlePhotoClear}
                />
              )}
              {step === 2 && (
                <Step2
                  form={form} update={update} errors={errors}
                  classOptions={classOptions}
                  resultFile={resultFile}
                  onResultFile={handleResultFile}
                  onResultClear={handleResultClear}
                />
              )}
              {step === 3 && <Step3 form={form} update={update} errors={errors} />}
              {step === 4 && (
                <Step4Review
                  form={form} agreed={agreed} setAgreed={setAgreed}
                  photoPreview={photoPreview}
                  resultFile={resultFile}
                  classOptions={classOptions}
                />
              )}
            </CardContent>

            {/* Footer */}
            <div className="px-6 pb-6 flex justify-between items-center">
              <Button type="button" variant="outline" onClick={handleBack} disabled={step === 1} className="gap-2">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <div className="text-xs text-gray-400 font-medium">{step} / {STEPS.length}</div>
              {step < 4 ? (
                <Button onClick={handleNext} className="bg-[#0B1B3D] hover:bg-[#0B1B3D]/90 gap-2">
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!agreed || isSubmitting}
                  className="bg-green-600 hover:bg-green-700 text-white gap-2 min-w-[160px]">
                  {isSubmitting
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                    : <><CheckCircle2 className="h-4 w-4" /> Submit Application</>}
                </Button>
              )}
            </div>
          </Card>

          <p className="text-center text-slate-400 text-xs">
            Having trouble? Contact us at {schoolInfo.name} · All submitted information is kept confidential.
          </p>
        </div>
      </main>
    </div>
  );
}
