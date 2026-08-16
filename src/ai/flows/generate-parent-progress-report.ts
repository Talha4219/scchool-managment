'use server';
/**
 * @fileOverview A Genkit flow for generating personalized parent progress reports.
 *
 * - generateParentProgressReport - A function that handles the generation of parent progress reports.
 * - GenerateParentProgressReportInput - The input type for the generateParentProgressReport function.
 * - GenerateParentProgressReportOutput - The return type for the generateParentProgressReport function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
  if (!process.env.GEMINI_API_KEY) {
    const mockMessage = `Dear Parent/Guardian of ${input.studentName},

I am writing to provide you with an academic and behavioral update for ${input.studentName} in ${input.className}.

Academic Standing:
${input.academicPerformance.map(p => `- ${p.subject}: Grade ${p.grade}`).join("\n")}

Attendance Log:
- Total Logged Days: ${input.attendanceRecord.totalDays}
- Absences: ${input.attendanceRecord.absentDays} day(s)
- Tardy Marks: ${input.attendanceRecord.tardyDays} day(s)
- Presence Rate: ${(((input.attendanceRecord.totalDays - input.attendanceRecord.absentDays) / input.attendanceRecord.totalDays) * 100).toFixed(1)}%

Instructor's Direct Observations:
"${input.teacherComments || "No additional commentary registered."}"

${input.studentName} has demonstrated solid engagement in our curriculum. We recommend reviewing the grade items listed above to prepare for the upcoming end-of-term evaluations. Should you have any questions, please reach out to schedule an instructor consultation.

Best regards,
${input.teacherName}
Classora Academics Department`;

    return { reportMessage: mockMessage };
  }
  return generateParentProgressReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateParentProgressReportPrompt',
  input: { schema: GenerateParentProgressReportInputSchema },
  output: { schema: GenerateParentProgressReportOutputSchema },
  prompt: `You are an AI assistant tasked with generating a personalized and professional student progress report for a parent.
Craft a concise, encouraging, and informative message based on the provided student data.

Student Name: {{{studentName}}}
Class: {{{className}}}
Teacher: {{{teacherName}}}

Academic Performance:
{{#each academicPerformance}}
- {{this.subject}}: {{this.grade}}
{{/each}}

Attendance:
Total Days: {{{attendanceRecord.totalDays}}}
Absent Days: {{{attendanceRecord.absentDays}}}
Tardy Days: {{{attendanceRecord.tardyDays}}}

{{#if teacherComments}}
Teacher's Additional Comments: {{{teacherComments}}}
{{/if}}

Draft a polite and informative message for the parent, summarizing the student's academic progress and attendance. If there are any areas of concern, phrase them constructively. Emphasize positive aspects where appropriate. Do not make up information that is not provided in the input.

The message should be formatted as a letter or email body, starting with a polite greeting and ending with a professional closing. Only output the report message, nothing else.`,
});

const generateParentProgressReportFlow = ai.defineFlow(
  {
    name: 'generateParentProgressReportFlow',
    inputSchema: GenerateParentProgressReportInputSchema,
    outputSchema: GenerateParentProgressReportOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
