"use client";

import { useRef } from "react";

interface ReportCardSubject {
  subjectName: string;
  marksObtained: number;
  totalMarks: number;
  passingMarks?: number;
  percentage?: number;
  grade: string;
  points?: number;
  isPass?: boolean;
}

interface ReportCardExam {
  examId: string;
  examName: string;
  subjects: ReportCardSubject[];
  totalObtained: number;
  totalMarks: number;
  percentage: number;
  grade?: string;
  sectionPosition?: number;
  sectionTotal?: number;
}

interface ReportCardProps {
  studentName: string;
  admissionNumber?: string;
  className?: string;
  sectionName?: string;
  academicYearName?: string;
  examResults: ReportCardExam[];
  totalPercentage: number;
  overallGrade: string;
  classPosition?: number | null;
  classTotal?: number | null;
  generatedAt: string;
  schoolName?: string;
  remarks?: string;
  terms?: {
    termOrder: number;
    termName: string;
    percentage: number;
    grade: string;
    points: number;
    isPass: boolean;
    position: number;
    totalStudents: number;
    examCount: number;
    subjects?: { subjectName: string; percentage: number; grade: string; isPass: boolean }[];
  }[];
  annual?: {
    percentage: number;
    grade: string;
    points: number;
    isPass: boolean;
    position: number;
    totalStudents: number;
    subjectAverages: { subjectName: string; percentage: number; grade: string; isPass: boolean }[];
    isPromoted: boolean;
    promotionNote: string;
  };
}

function rankSuffix(n: number | null | undefined): string {
  if (!n) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-emerald-600";
  if (grade === "B") return "text-blue-600";
  if (grade === "C") return "text-indigo-600";
  if (grade === "D") return "text-amber-600";
  return "text-red-600";
}

function gradeBg(grade: string): string {
  if (grade.startsWith("A")) return "bg-emerald-50";
  if (grade === "B") return "bg-blue-50";
  if (grade === "C") return "bg-indigo-50";
  if (grade === "D") return "bg-amber-50";
  return "bg-red-50";
}

export function ReportCard({
  studentName, admissionNumber, className, sectionName,
  academicYearName, examResults, totalPercentage, overallGrade,
  classPosition, classTotal, generatedAt, schoolName = "Classora", remarks,
  terms, annual,
}: ReportCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const el = cardRef.current;
    if (!el) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Report Card - ${studentName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; padding: 24px; }
        @media print { body { padding: 0; } }
        .rc-header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; }
        .rc-school { font-size: 22px; font-weight: 800; color: #1e40af; letter-spacing: -0.5px; }
        .rc-subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }
        .rc-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 10px; text-transform: uppercase; letter-spacing: 1px; }
        .rc-info { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; font-size: 12px; margin: 16px 0; padding: 10px 14px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
        .rc-info span { color: #64748b; }
        .rc-info strong { color: #0f172a; }
        .rc-exam { margin-bottom: 18px; }
        .rc-exam-title { font-size: 13px; font-weight: 700; color: #1e40af; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
        .rc-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .rc-table th { background: #1e40af; color: white; padding: 6px 8px; text-align: left; font-weight: 600; }
        .rc-table td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
        .rc-table tr:nth-child(even) td { background: #f8fafc; }
        .rc-summary { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin: 18px 0; }
        .rc-stat { padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0; }
        .rc-stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .rc-stat-value { font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 2px; }
        .rc-stat-sub { font-size: 10px; color: #94a3b8; }
        .rc-footer { margin-top: 24px; padding-top: 16px; border-top: 2px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px; }
        .rc-sig { text-align: center; }
        .rc-sig-line { border-top: 1px solid #1e293b; width: 140px; margin: 30px auto 0; padding-top: 4px; color: #64748b; }
        .pass { color: #16a34a; } .fail { color: #dc2626; }
      </style></head><body>${el.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  return (
    <div>
      <div ref={cardRef}>
        {/* Header */}
        <div className="rc-header">
          <div className="rc-school">{schoolName}</div>
          <div className="rc-subtitle">Academic Report Card</div>
          <div className="rc-title">Student Performance Report</div>
        </div>

        {/* Student Info */}
        <div className="rc-info">
          <div><span>Student Name: </span><strong>{studentName}</strong></div>
          <div><span>Admission No: </span><strong>{admissionNumber || "—"}</strong></div>
          <div><span>Class / Section: </span><strong>{className} {sectionName ? `/ ${sectionName}` : ""}</strong></div>
          <div><span>Academic Year: </span><strong>{academicYearName || "—"}</strong></div>
          <div><span>Date Issued: </span><strong>{generatedAt}</strong></div>
          <div><span>Overall Grade: </span><strong className={gradeColor(overallGrade)}>{overallGrade}</strong></div>
        </div>

        {/* Term Summary */}
        {terms && terms.length > 0 && (
          <div className="rc-exam">
            <div className="rc-exam-title">Term Summary</div>
            <table className="rc-table">
              <thead>
                <tr>
                  <th>Term</th>
                  <th className="text-center">%</th>
                  <th className="text-center">Grade</th>
                  <th className="text-center">Points</th>
                  <th className="text-center">Position</th>
                  <th className="text-center">Result</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((t, i) => (
                  <tr key={i}>
                    <td className="font-medium">{t.termName}</td>
                    <td className="text-center">{t.percentage.toFixed(1)}%</td>
                    <td className={`text-center font-bold ${gradeColor(t.grade)}`}>{t.grade}</td>
                    <td className="text-center">{t.points.toFixed(1)}</td>
                    <td className="text-center">{t.position ? `${rankSuffix(t.position)} of ${t.totalStudents}` : "—"}</td>
                    <td className={`text-center font-semibold ${t.isPass ? "pass" : "fail"}`}>{t.isPass ? "Pass" : "Fail"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Annual Summary */}
        {annual && (
          <div className="rc-exam">
            <div className="rc-exam-title">
              Annual Result
              {annual.position ? (
                <span className="float-right text-slate-500 font-normal">Position: {rankSuffix(annual.position)} of {annual.totalStudents}</span>
              ) : null}
            </div>
            {annual.subjectAverages.length > 0 && (
              <table className="rc-table mb-3">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th className="text-center">Average %</th>
                    <th className="text-center">Grade</th>
                    <th className="text-center">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {annual.subjectAverages.map((s, i) => (
                    <tr key={i}>
                      <td className="font-medium">{s.subjectName}</td>
                      <td className="text-center">{s.percentage.toFixed(1)}%</td>
                      <td className={`text-center font-bold ${gradeColor(s.grade)}`}>{s.grade}</td>
                      <td className={`text-center font-semibold ${s.isPass ? "pass" : "fail"}`}>{s.isPass ? "Pass" : "Fail"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="rc-summary">
              <div className="rc-stat">
                <div className="rc-stat-label">Annual Average</div>
                <div className="rc-stat-value">{annual.percentage.toFixed(1)}%</div>
              </div>
              <div className="rc-stat">
                <div className="rc-stat-label">Annual Grade</div>
                <div className={`rc-stat-value ${gradeColor(annual.grade)}`}>{annual.grade}</div>
              </div>
              <div className="rc-stat">
                <div className="rc-stat-label">Promotion</div>
                <div className={`rc-stat-value ${annual.isPromoted ? "pass" : "fail"}`}>
                  {annual.isPromoted ? "Promoted" : "Not Promoted"}
                </div>
              </div>
              <div className="rc-stat">
                <div className="rc-stat-label">Points</div>
                <div className="rc-stat-value">{annual.points.toFixed(1)}</div>
              </div>
            </div>
            {annual.promotionNote && (
              <p className="mt-1 text-xs text-slate-500 italic">{annual.promotionNote}</p>
            )}
          </div>
        )}

        {/* Exam Results */}
        {examResults.map((exam) => (
          <div key={exam.examId} className="rc-exam">
            <div className="rc-exam-title">
              {exam.examName}
              {exam.sectionPosition && (
                <span className="float-right text-slate-500 font-normal">
                  Position: {rankSuffix(exam.sectionPosition)} of {exam.sectionTotal}
                </span>
              )}
            </div>
            <table className="rc-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th className="text-center">Obtained</th>
                  <th className="text-center">Total</th>
                  <th className="text-center">%</th>
                  <th className="text-center">Grade</th>
                  <th className="text-center">Result</th>
                </tr>
              </thead>
              <tbody>
                {exam.subjects.map((subj, i) => (
                  <tr key={i}>
                    <td className="font-medium">{subj.subjectName}</td>
                    <td className="text-center">{subj.marksObtained}</td>
                    <td className="text-center">{subj.totalMarks}</td>
                    <td className="text-center">{subj.percentage ?? Math.round((subj.marksObtained / (subj.totalMarks || 1)) * 100)}%</td>
                    <td className={`text-center font-bold ${gradeColor(subj.grade)}`}>{subj.grade}</td>
                    <td className={`text-center font-semibold ${subj.isPass === false ? "fail" : "pass"}`}>
                      {subj.isPass === false ? "Fail" : "Pass"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-slate-50">
                  <td>Total</td>
                  <td className="text-center">{exam.totalObtained}</td>
                  <td className="text-center">{exam.totalMarks}</td>
                  <td className="text-center">{exam.percentage.toFixed(1)}%</td>
                  <td className={`text-center ${gradeColor(exam.grade || overallGrade)}`}>{exam.grade || overallGrade}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ))}

        {/* Summary Stats */}
        <div className="rc-summary">
          <div className="rc-stat">
            <div className="rc-stat-label">Total Average</div>
            <div className="rc-stat-value">{totalPercentage.toFixed(1)}%</div>
          </div>
          <div className="rc-stat">
            <div className="rc-stat-label">Overall Grade</div>
            <div className={`rc-stat-value ${gradeColor(overallGrade)}`}>{overallGrade}</div>
          </div>
          <div className="rc-stat">
            <div className="rc-stat-label">Class Position</div>
            <div className="rc-stat-value">{classPosition ? rankSuffix(classPosition) : "—"}</div>
            {classTotal && <div className="rc-stat-sub">out of {classTotal} students</div>}
          </div>
          <div className="rc-stat">
            <div className="rc-stat-label">Status</div>
            <div className={`rc-stat-value ${overallGrade === "F" ? "fail" : "pass"}`}>
              {overallGrade === "F" ? "Fail" : "Pass"}
            </div>
          </div>
        </div>

        {/* Remarks */}
        {remarks && (
          <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-200 text-sm">
            <span className="font-semibold text-slate-700">Remarks: </span>
            <span className="text-slate-600">{remarks}</span>
          </div>
        )}

        {/* Signatures */}
        <div className="rc-footer">
          <div className="rc-sig">
            <div className="rc-sig-line">Class Teacher</div>
          </div>
          <div className="rc-sig">
            <div className="rc-sig-line">Principal</div>
          </div>
        </div>
      </div>

      {/* Print Button */}
      <button
        onClick={handlePrint}
        className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
      >
        Print Report Card
      </button>
    </div>
  );
}
