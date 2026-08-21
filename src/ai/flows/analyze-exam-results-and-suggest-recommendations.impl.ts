/**
 * @fileOverview Genkit implementation for analyzing exam results and
 * suggesting recommendations — split out of
 * analyze-exam-results-and-suggest-recommendations.ts (the 'use server'
 * entrypoint) so genkit/opentelemetry aren't eagerly imported into Next's
 * server-action manifest, which loads for every route.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type {
  AnalyzeExamResultsAndSuggestRecommendationsInput,
  AnalyzeExamResultsAndSuggestRecommendationsOutput,
} from './analyze-exam-results-and-suggest-recommendations';

const AnalyzeExamResultsAndSuggestRecommendationsInputSchema = z.object({
  className: z.string().describe('The name of the class.'),
  examName: z.string().describe('The name or title of the exam.'),
  examDetails: z
    .string()
    .describe('Detailed description of the exam, e.g., topics covered, maximum marks, format.'),
  studentResults:
    z.array(
      z.object({
        studentName: z.string().describe('The name of the student.'),
        score: z.number().describe('The score obtained by the student in the exam.'),
        detailedBreakdown:
          z.string().describe('A detailed breakdown of the student\'s performance, e.g., scores per topic or question types.'),
      })
    ).describe('An array of objects, each containing a student\'s name, score, and detailed performance breakdown.'),
  generalStrengths:
    z.string().optional().describe('Optional: Teacher\'s observation of common strengths across the class.'),
  generalWeaknesses:
    z.string().optional().describe('Optional: Teacher\'s observation of common weaknesses across the class.'),
});

const AnalyzeExamResultsAndSuggestRecommendationsOutputSchema = z.object({
  classSummary: z.object({
    commonStrengths: z.string().describe('A summary of common strengths observed across the class.'),
    commonWeaknesses: z.string().describe('A summary of common weaknesses observed across the class.'),
  }),
  studentRecommendations:
    z.array(
      z.object({
        studentName: z.string().describe('The name of the student.'),
        recommendations:
          z.string().describe('Personalized study recommendations for the student, focusing on areas for improvement.'),
      })
    ).describe('An array of objects, each containing a student\'s name and personalized study recommendations.'),
});

const analyzeExamResultsAndSuggestRecommendationsPrompt = ai.definePrompt({
  name: 'analyzeExamResultsAndSuggestRecommendationsPrompt',
  input: { schema: AnalyzeExamResultsAndSuggestRecommendationsInputSchema },
  output: { schema: AnalyzeExamResultsAndSuggestRecommendationsOutputSchema },
  prompt: `You are an AI assistant specialized in educational analytics. Your task is to analyze exam results for a class, identify common strengths and weaknesses, and provide personalized study recommendations for each student.

Class Name: {{{className}}}
Exam Name: {{{examName}}}
Exam Details: {{{examDetails}}}

{{#if generalStrengths}}
Teacher's observed general strengths: {{{generalStrengths}}}
{{/if}}

{{#if generalWeaknesses}}
Teacher's observed general weaknesses: {{{generalWeaknesses}}}
{{/if}}

Student Results:
{{#each studentResults}}
---
Student Name: {{{studentName}}}
Score: {{{score}}}
Detailed Breakdown: {{{detailedBreakdown}}}
---
{{/each}}

Based on the above information, provide:
1.  A concise summary of common strengths observed across the class.
2.  A concise summary of common weaknesses observed across the class.
3.  Personalized study recommendations for each student, focusing on their specific weaknesses and areas for improvement based on their score and detailed breakdown. Recommendations should be actionable and specific.

Ensure the output is in a JSON format matching the following structure:
{json
  "classSummary": {
    "commonStrengths": "...",
    "commonWeaknesses": "..."
  },
  "studentRecommendations": [
    {
      "studentName": "...",
      "recommendations": "..."
    }
    // ... for each student
  ]
}
`,
});

const analyzeExamResultsAndSuggestRecommendationsFlow = ai.defineFlow(
  {
    name: 'analyzeExamResultsAndSuggestRecommendationsFlow',
    inputSchema: AnalyzeExamResultsAndSuggestRecommendationsInputSchema,
    outputSchema: AnalyzeExamResultsAndSuggestRecommendationsOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeExamResultsAndSuggestRecommendationsPrompt(input);
    return output!;
  }
);

export async function runAnalyzeExamResultsAndSuggestRecommendationsFlow(
  input: AnalyzeExamResultsAndSuggestRecommendationsInput
): Promise<AnalyzeExamResultsAndSuggestRecommendationsOutput> {
  return analyzeExamResultsAndSuggestRecommendationsFlow(input);
}
