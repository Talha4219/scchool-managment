import { query, checkDbConnection } from "@/lib/db";
import type { CSSProperties } from "react";
import AutoPrint from "./auto-print";

export const dynamic = "force-dynamic";

const rankSuffix = (n: number | null | undefined): string => {
  if (!n) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const gradeColor = (grade: string): string => {
  if (grade.startsWith("A")) return "color: #059669;";
  if (grade === "B") return "color: #2563eb;";
  if (grade === "C") return "color: #4f46e5;";
  if (grade === "D") return "color: #d97706;";
  return "color: #dc2626;";
};

const cell = "padding:6px 8px;";
const th: CSSProperties = { background: "#1e40af", color: "white", padding: "6px 8px", textAlign: "left" };
const thc: CSSProperties = { background: "#1e40af", color: "white", padding: "6px 8px", textAlign: "center" };

export default async function ReportCardPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ school?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const schoolName = sp.school ? decodeURIComponent(sp.school) : "Classora";

  const isOnline = await checkDbConnection();
  if (!isOnline) {
    return <div style={{ padding: 24, fontFamily: "sans-serif" }}>Database unavailable.</div>;
  }

  const res = await query(
    `SELECT rc.*, s.name as student_name, s.admission_number, ay.name as academic_year_name
     FROM report_cards rc
     JOIN students s ON s.id = rc.student_id
     JOIN academic_years ay ON ay.id = rc.academic_year_id
     WHERE rc.id = $1`,
    [id]
  );
  if (res.rows.length === 0) {
    return <div style={{ padding: 24, fontFamily: "sans-serif" }}>Report card not found.</div>;
  }
  const rc = res.rows[0];
  const examResults: any[] = Array.isArray(rc.exam_results) ? rc.exam_results : [];
  const terms: any[] = Array.isArray(rc.term_results) ? rc.term_results : [];
  const annual: any = rc.annual || null;

  const infoRow = (label: string, value: string, style: CSSProperties = {}) => (
    <div>
      <span style={{ color: "#64748b" }}>{label} </span>
      <strong style={{ color: "#0f172a", ...style }}>{value}</strong>
    </div>
  );

  const subjectTable = (subjects: any[]) => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
      <thead>
        <tr>
          <th style={th}>Subject</th>
          <th style={thc}>Obtained</th>
          <th style={thc}>Total</th>
          <th style={thc}>%</th>
          <th style={thc}>Grade</th>
          <th style={thc}>Result</th>
        </tr>
      </thead>
      <tbody>
        {subjects.map((s, i) => (
          <tr key={i}>
            <td style={{ ...cssObj(cell), fontWeight: 600 }}>{s.subjectName || ""}</td>
            <td style={{ ...cssObj(cell), textAlign: "center" }}>{s.obtained ?? s.marksObtained ?? ""}</td>
            <td style={{ ...cssObj(cell), textAlign: "center" }}>{s.total ?? s.totalMarks ?? ""}</td>
            <td style={{ ...cssObj(cell), textAlign: "center" }}>{(s.percentage ?? 0).toFixed(1)}%</td>
            <td style={{ ...cssObj(cell), textAlign: "center", fontWeight: 700, color: gradeColor(s.grade) }}>{s.grade || ""}</td>
            <td style={{ ...cssObj(cell), textAlign: "center", fontWeight: 600, color: s.isPass === false ? "#dc2626" : "#16a34a" }}>
              {s.isPass === false ? "Fail" : "Pass"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const stat = (label: string, value: string, valueStyle = {}) => (
    <div style={{ padding: 10, borderRadius: 6, textAlign: "center", border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginTop: 2, ...valueStyle }}>{value}</div>
    </div>
  );

  return (
    <>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; color:#1e293b; padding:24px; font-size: 12px; }
        @media print { body { padding:0; } @page { margin: 14mm; } }
        table { width: 100%; border-collapse: collapse; }
        tr:nth-child(even) td { background:#f8fafc; }
        .print-only { display: none; }
        @media print { .print-only { display: block; } }
      `}</style>
      <AutoPrint />
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", borderBottom: "3px solid #2563eb", paddingBottom: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1e40af", letterSpacing: -0.5 }}>{schoolName}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Academic Report Card</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginTop: 10, textTransform: "uppercase", letterSpacing: 1 }}>
            Student Performance Report
          </div>
        </div>

        {/* Student info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", fontSize: 12, margin: "16px 0", padding: "10px 14px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
          {infoRow("Student Name:", rc.student_name || "")}
          {infoRow("Admission No:", rc.admission_number || "—")}
          {infoRow("Class / Section:", `${rc.class_name || ""}${rc.section_name ? ` / ${rc.section_name}` : ""}`)}
          {infoRow("Academic Year:", rc.academic_year_name || "—")}
          {infoRow("Date Issued:", rc.generated_at || "")}
          {infoRow("Overall Grade:", rc.overall_grade || "", { color: gradeColor(rc.overall_grade) })}
        </div>

        {/* Term summary */}
        {terms.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #e2e8f0" }}>
              Term Summary
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={th}>Term</th>
                  <th style={thc}>%</th>
                  <th style={thc}>Grade</th>
                  <th style={thc}>Points</th>
                  <th style={thc}>Position</th>
                  <th style={thc}>Result</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((t, i) => (
                  <tr key={i}>
                    <td style={{ ...cssObj(cell), fontWeight: 600 }}>{t.termName || ""}</td>
                    <td style={{ ...cssObj(cell), textAlign: "center" }}>{(t.percentage ?? 0).toFixed(1)}%</td>
                    <td style={{ ...cssObj(cell), textAlign: "center", fontWeight: 700, color: gradeColor(t.grade) }}>{t.grade || ""}</td>
                    <td style={{ ...cssObj(cell), textAlign: "center" }}>{(t.points ?? 0).toFixed(1)}</td>
                    <td style={{ ...cssObj(cell), textAlign: "center" }}>{t.position ? `${rankSuffix(t.position)} of ${t.totalStudents}` : "—"}</td>
                    <td style={{ ...cssObj(cell), textAlign: "center", fontWeight: 600, color: t.isPass ? "#16a34a" : "#dc2626" }}>{t.isPass ? "Pass" : "Fail"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Annual summary */}
        {annual && (
          <div style={{ marginBottom: 18, pageBreakInside: "avoid" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #e2e8f0" }}>
              Annual Result
              {annual.position ? (
                <span style={{ float: "right", color: "#64748b", fontWeight: 400 }}>
                  Position: {rankSuffix(annual.position)} of {annual.totalStudents}
                </span>
              ) : null}
            </div>
            {Array.isArray(annual.subjectAverages) && annual.subjectAverages.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th style={th}>Subject</th>
                    <th style={thc}>Average %</th>
                    <th style={thc}>Grade</th>
                    <th style={thc}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {annual.subjectAverages.map((s: any, i: number) => (
                    <tr key={i}>
                      <td style={{ ...cssObj(cell), fontWeight: 600 }}>{s.subjectName || ""}</td>
                      <td style={{ ...cssObj(cell), textAlign: "center" }}>{(s.percentage ?? 0).toFixed(1)}%</td>
                      <td style={{ ...cssObj(cell), textAlign: "center", fontWeight: 700, color: gradeColor(s.grade) }}>{s.grade || ""}</td>
                      <td style={{ ...cssObj(cell), textAlign: "center", fontWeight: 600, color: s.isPass ? "#16a34a" : "#dc2626" }}>{s.isPass ? "Pass" : "Fail"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, margin: "12px 0" }}>
              {stat("Annual Average", `${(annual.percentage ?? 0).toFixed(1)}%`)}
              {stat("Annual Grade", annual.grade || "", { color: gradeColor(annual.grade) })}
              {stat("Promotion", annual.isPromoted ? "Promoted" : "Not Promoted", { color: annual.isPromoted ? "#16a34a" : "#dc2626" })}
              {stat("Points", `${(annual.points ?? 0).toFixed(1)}`)}
            </div>
            {annual.promotionNote ? (
              <p style={{ marginTop: 4, fontSize: 11, color: "#64748b", fontStyle: "italic" }}>{annual.promotionNote}</p>
            ) : null}
          </div>
        )}

        {/* Per-exam tables */}
        {examResults.map((exam: any, idx: number) => (
          <div key={idx} style={{ marginBottom: 18, pageBreakInside: "avoid" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #e2e8f0" }}>
              {exam.examName || ""}
              {exam.sectionPosition ? (
                <span style={{ float: "right", color: "#64748b", fontWeight: 400 }}>
                  Position: {rankSuffix(exam.sectionPosition)} of {exam.sectionTotal}
                </span>
              ) : null}
            </div>
            {subjectTable(exam.subjects || [])}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, background: "#f8fafc", padding: "6px 8px", fontSize: 11, borderTop: "1px solid #e2e8f0" }}>
              <span>Total: {exam.totalObtained ?? ""} / {exam.totalMarks ?? ""} ({(exam.percentage ?? 0).toFixed(1)}%)</span>
              <span style={{ color: gradeColor(exam.grade || rc.overall_grade) }}>Grade: {exam.grade || rc.overall_grade || ""}</span>
            </div>
          </div>
        ))}

        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, margin: "18px 0" }}>
          {stat("Total Average", `${(Number(rc.total_percentage) || 0).toFixed(1)}%`)}
          {stat("Overall Grade", rc.overall_grade || "", { color: gradeColor(rc.overall_grade) })}
          {stat("Class Position", rankSuffix(rc.class_position), {})}
          {stat("Status", rc.overall_grade === "F" ? "Fail" : "Pass", { color: rc.overall_grade === "F" ? "#dc2626" : "#16a34a" })}
        </div>

        {/* Remarks */}
        {rc.remarks ? (
          <div style={{ margin: "16px 0", padding: 10, background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12 }}>
            <span style={{ fontWeight: 600, color: "#334155" }}>Remarks: </span>
            <span style={{ color: "#475569" }}>{rc.remarks}</span>
          </div>
        ) : null}

        {/* Signatures */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "2px solid #e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, fontSize: 11 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #1e293b", width: 140, margin: "30px auto 0", paddingTop: 4, color: "#64748b" }}>Class Teacher</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #1e293b", width: 140, margin: "30px auto 0", paddingTop: 4, color: "#64748b" }}>Principal</div>
          </div>
        </div>

        {/* Back link (hidden on print) */}
        <div className="print-only" style={{ marginTop: 16, textAlign: "center" }}>
          <a href="/exams/report-cards" style={{ color: "#2563eb", fontSize: 12 }}>← Back to Report Cards</a>
        </div>
      </div>
    </>
  );
}

function cssObj(css: string): CSSProperties {
  const obj: Record<string, string> = {};
  for (const pair of css.split(";")) {
    const i = pair.indexOf(":");
    if (i > -1) {
      const k = pair.slice(0, i).trim();
      const v = pair.slice(i + 1).trim();
      if (k) obj[k] = v;
    }
  }
  return obj;
}