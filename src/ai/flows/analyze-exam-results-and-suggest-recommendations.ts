'use server';
/**
 * @fileOverview An AI agent that analyzes exam results for a class, identifies common strengths and weaknesses,
 * and provides personalized study recommendations for individual students.
 *
 * - analyzeExamResultsAndSuggestRecommendations - A function that handles the exam result analysis and recommendation generation process.
 * - AnalyzeExamResultsAndSuggestRecommendationsInput - The input type for the analyzeExamResultsAndSuggestRecommendations function.
 * - AnalyzeExamResultsAndSuggestRecommendationsOutput - The return type for the analyzeExamResultsAndSuggestRecommendations function.
 *
 * The actual genkit prompt/flow definitions live in the sibling .impl.ts
 * file, imported here only via a dynamic import() inside the function body
 * — every 'use server' file gets eagerly scanned into Next's server-action
 * manifest, which loads for every route (including error pages), so a
 * top-level import of genkit here would pull its opentelemetry
 * instrumentation into that always-loaded path. See next.config.ts's
 * serverExternalPackages comment.
 */

import { z } from 'zod';

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
  const { runAnalyzeExamResultsAndSuggestRecommendationsFlow } = await import('./analyze-exam-results-and-suggest-recommendations.impl');
  return runAnalyzeExamResultsAndSuggestRecommendationsFlow(input);
}
