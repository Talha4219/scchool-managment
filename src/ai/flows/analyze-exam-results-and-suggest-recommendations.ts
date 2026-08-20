'use server';
/**
 * @fileOverview An AI agent that analyzes exam results for a class, identifies common strengths and weaknesses,
 * and provides personalized study recommendations for individual students.
 *
 * - analyzeExamResultsAndSuggestRecommendations - A function that handles the exam result analysis and recommendation generation process.
 * - AnalyzeExamResultsAndSuggestRecommendationsInput - The input type for the analyzeExamResultsAndSuggestRecommendations function.
 * - AnalyzeExamResultsAndSuggestRecommendationsOutput - The return type for the analyzeExamResultsAndSuggestRecommendations function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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

export type AnalyzeExamResultsAndSuggestRecommendationsInput = z.infer<
  typeof AnalyzeExamResultsAndSuggestRecommendationsInputSchema
>;

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

export type AnalyzeExamResultsAndSuggestRecommendationsOutput = z.infer<
  typeof AnalyzeExamResultsAndSuggestRecommendationsOutputSchema
>;

export async function analyzeExamResultsAndSuggestRecommendations(
  input: AnalyzeExamResultsAndSuggestRecommendationsInput
): Promise<AnalyzeExamResultsAndSuggestRecommendationsOutput> {
  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    const studentRecommendations = input.studentResults.map(res => {
      let recs = "";
      if (res.score >= 90) {
        recs = `Excellent overall performance (${res.score}/100) in ${input.examName}. To continue excelling, focus on advanced applications and challenge problems. Maintain active class participation.`;
      } else if (res.score >= 80) {
        recs = `Strong standing (${res.score}/100). Focus on bridging the gap in concepts identified in their breakdown: "${res.detailedBreakdown}". Reviewing formulas and practicing 3-4 additional word problems weekly is highly recommended.`;
      } else {
        recs = `Targeted support recommended (${res.score}/100). Needs dedicated study on details: "${res.detailedBreakdown}". Recommend attending weekly teacher office hours, re-attempting textbook practice sections, and dedicating 30 minutes daily to test prep.`;
      }
      return {
        studentName: res.studentName,
        recommendations: recs
      };
    });

    return {
      classSummary: {
        commonStrengths: input.generalStrengths || "Foundational concepts, basic algebraic simplifications, and active class participation.",
        commonWeaknesses: input.generalWeaknesses || "Calculus integration mechanisms, translating word problems into formulas, and complex calculations under exam timing."
      },
      studentRecommendations
    };
  }
  return analyzeExamResultsAndSuggestRecommendationsFlow(input);
}

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
