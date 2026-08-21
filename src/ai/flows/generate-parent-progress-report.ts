'use server';
/**
 * @fileOverview A Genkit flow for generating personalized parent progress reports.
 *
 * - generateParentProgressReport - A function that handles the generation of parent progress reports.
 * - GenerateParentProgressReportInput - The input type for the generateParentProgressReport function.
 * - GenerateParentProgressReportOutput - The return type for the generateParentProgressReport function.
 *
 * The actual genkit prompt/flow definitions live in the sibling .impl.ts file,
 * imported here only via a dynamic import() inside the function body — every
 * 'use server' file gets eagerly scanned into Next's server-action manifest,
 * which loads for every route (including error pages), so a top-level import
 * of genkit here would pull its opentelemetry instrumentation into that
 * always-loaded path. See next.config.ts's serverExternalPackages comment.
 */

import { z } from 'zod';
import { getSession } from '@/app/actions/auth';

const GenerateParentProgressReportInputSchema = z.object({
  studentName: z.string().describe("The student's full name."),
  className: z.string().describe("The name of the class or section the student is in."),
  teacherName: z.string().describe("The name of the teacher drafting the report."),
  academicPerformance: z.array(
    z.object({
      subject: z.string().describe("The subject name (e.g., 'Mathematics', 'English')."),
      grade: z.string().describe("The grade received in the subject (e.g., 'A', 'B+', 'Satisfactory')."),
    })
  ).describe("An array of subjects and their corresponding grades for the student."),
  attendanceRecord: z.object({
    totalDays: z.number().describe("Total number of school days in the reporting period."),
    absentDays: z.number().describe("Number of days the student was absent."),
    tardyDays: z.number().describe("Number of days the student was tardy."),
  }).describe("The student's attendance record for the reporting period."),
  teacherComments: z.string().optional().describe("Optional general comments or observations from the teacher."),
});
export type GenerateParentProgressReportInput = z.infer<typeof GenerateParentProgressReportInputSchema>;

const GenerateParentProgressReportOutputSchema = z.object({
  reportMessage: z.string().describe("The personalized progress report message for the parent."),
});
export type GenerateParentProgressReportOutput = z.infer<typeof GenerateParentProgressReportOutputSchema>;

export async function generateParentProgressReport(input: GenerateParentProgressReportInput): Promise<GenerateParentProgressReportOutput> {
  // Sign the letter with the logged-in user's name (e.g. the class teacher or
  // admin drafting it) instead of a hardcoded name. Falls back to the caller's
  // teacherName if the session can't be resolved (e.g. running via genkit dev).
  const session = await getSession().catch(() => null);
  const teacherName = session?.name?.trim() || input.teacherName;
  const effectiveInput: GenerateParentProgressReportInput = { ...input, teacherName };

  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    const mockMessage = `Dear Parent/Guardian of ${effectiveInput.studentName},

I am writing to provide you with an academic and behavioral update for ${effectiveInput.studentName} in ${effectiveInput.className}.

Academic Standing:
${effectiveInput.academicPerformance.map(p => `- ${p.subject}: Grade ${p.grade}`).join("\n")}

Attendance Log:
- Total Logged Days: ${effectiveInput.attendanceRecord.totalDays}
- Absences: ${effectiveInput.attendanceRecord.absentDays} day(s)
- Tardy Marks: ${effectiveInput.attendanceRecord.tardyDays} day(s)
- Presence Rate: ${(((effectiveInput.attendanceRecord.totalDays - effectiveInput.attendanceRecord.absentDays) / effectiveInput.attendanceRecord.totalDays) * 100).toFixed(1)}%

Instructor's Direct Observations:
"${effectiveInput.teacherComments || "No additional commentary registered."}"

${effectiveInput.studentName} has demonstrated solid engagement in our curriculum. We recommend reviewing the grade items listed above to prepare for the upcoming end-of-term evaluations. Should you have any questions, please reach out to schedule an instructor consultation.

Best regards,
${effectiveInput.teacherName}
Classora Academics Department`;

    return { reportMessage: mockMessage };
  }
  const { runGenerateParentProgressReportFlow } = await import('./generate-parent-progress-report.impl');
  return runGenerateParentProgressReportFlow(effectiveInput);
}
