/**
 * @fileOverview Genkit implementation for generating personalized parent
 * progress reports — split out of generate-parent-progress-report.ts (the
 * 'use server' entrypoint) so genkit/opentelemetry aren't eagerly imported
 * into Next's server-action manifest, which loads for every route.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { GenerateParentProgressReportInput, GenerateParentProgressReportOutput } from './generate-parent-progress-report';

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

const GenerateParentProgressReportOutputSchema = z.object({
  reportMessage: z.string().describe("The personalized progress report message for the parent."),
});

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

The message should be formatted as a letter or email body, starting with a polite greeting and ending with a professional closing. Sign the letter with the teacher's exact name, {{{teacherName}}}, after a closing like "Sincerely," — use the exact name given, do not invent a different signature. Only output the report message, nothing else.`,
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

export async function runGenerateParentProgressReportFlow(
  input: GenerateParentProgressReportInput
): Promise<GenerateParentProgressReportOutput> {
  return generateParentProgressReportFlow(input);
}
