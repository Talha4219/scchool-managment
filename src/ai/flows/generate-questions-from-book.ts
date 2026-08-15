'use server';
/**
 * @fileOverview A Genkit flow that generates exam questions/MCQs from a
 * class textbook PDF (base64 data URL, same convention as
 * course_materials/class_books storage — no blob storage in this app).
 *
 * - generateQuestionsFromBook - reads the PDF and drafts questions for review.
 * - GenerateQuestionsFromBookInput / Output - types for the above.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateQuestionsFromBookInputSchema = z.object({
  bookPdfDataUrl: z.string().describe("The textbook as a base64 data URL (data:application/pdf;base64,...)."),
  subjectName: z.string().describe("The subject this book is for (e.g. 'Physics')."),
  topicHint: z.string().optional().describe("Optional chapter/topic to focus on — if omitted, draw from the whole book."),
  mcqCount: z.number().min(0).max(30).describe("Number of multiple-choice questions to generate."),
  shortAnswerCount: z.number().min(0).max(30).describe("Number of short-answer questions to generate."),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).describe("Target difficulty level."),
});
export type GenerateQuestionsFromBookInput = z.infer<typeof GenerateQuestionsFromBookInputSchema>;

const GeneratedQuestionSchema = z.object({
  type: z.enum(['MCQ', 'ShortAnswer']),
  questionText: z.string(),
  options: z.array(z.string()).describe("Exactly 4 options for MCQ; empty array for ShortAnswer."),
  correctAnswer: z.string().describe("For MCQ, must exactly match one of the options. For ShortAnswer, a model answer."),
  marks: z.number().describe("Suggested marks for this question (MCQ=1, ShortAnswer=3-5)."),
  explanation: z.string().describe("One-sentence explanation of why the answer is correct."),
});

const GenerateQuestionsFromBookOutputSchema = z.object({
  questions: z.array(GeneratedQuestionSchema),
});
export type GenerateQuestionsFromBookOutput = z.infer<typeof GenerateQuestionsFromBookOutputSchema>;

export async function generateQuestionsFromBook(input: GenerateQuestionsFromBookInput): Promise<GenerateQuestionsFromBookOutput> {
  if (!process.env.GEMINI_API_KEY) {
    // Deterministic mock so the review/approve/add-to-exam UI is fully
    // testable without a live API key — mirrors generate-parent-progress-report's fallback.
    const questions: z.infer<typeof GeneratedQuestionSchema>[] = [];
    for (let i = 0; i < input.mcqCount; i++) {
      questions.push({
        type: 'MCQ',
        questionText: `[Mock] Sample ${input.difficulty} question ${i + 1} on ${input.topicHint || input.subjectName}?`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
        marks: 1,
        explanation: 'Mock explanation — set GEMINI_API_KEY for real AI-generated questions.',
      });
    }
    for (let i = 0; i < input.shortAnswerCount; i++) {
      questions.push({
        type: 'ShortAnswer',
        questionText: `[Mock] Explain a ${input.difficulty} concept ${i + 1} from ${input.topicHint || input.subjectName}.`,
        options: [],
        correctAnswer: 'Mock model answer.',
        marks: 4,
        explanation: 'Mock explanation — set GEMINI_API_KEY for real AI-generated questions.',
      });
    }
    return { questions };
  }
  return generateQuestionsFromBookFlow(input);
}

const generateQuestionsFromBookFlow = ai.defineFlow(
  {
    name: 'generateQuestionsFromBookFlow',
    inputSchema: GenerateQuestionsFromBookInputSchema,
    outputSchema: GenerateQuestionsFromBookOutputSchema,
  },
  async (input) => {
    const prompt = [
      { media: { url: input.bookPdfDataUrl } },
      {
        text: `You are an exam-question author for a school. Using ONLY the content of the attached textbook PDF (subject: ${input.subjectName}${input.topicHint ? `, focused on: ${input.topicHint}` : ''}), generate exactly ${input.mcqCount} multiple-choice questions and ${input.shortAnswerCount} short-answer questions at ${input.difficulty} difficulty.

Rules:
- Every question must be answerable strictly from the book's content — do not invent facts not in the text.
- MCQ options must have exactly 4 choices, only one correct.
- correctAnswer for an MCQ must be copied verbatim from its options.
- Keep questionText concise and unambiguous.
- Vary which part of the book each question draws from — do not cluster all questions on one page/topic unless topicHint narrows it.`,
      },
    ];

    // Gemini's shared capacity returns a transient 503/UNAVAILABLE under
    // load fairly often — that's specifically meant to be retried, so back
    // off and retry a few times before surfacing a failure to the user.
    const MAX_ATTEMPTS = 3;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { output } = await ai.generate({ prompt, output: { schema: GenerateQuestionsFromBookOutputSchema } });
        return output!;
      } catch (err: any) {
        lastErr = err;
        const isRetryable = err?.status === 'UNAVAILABLE' || err?.code === 503;
        if (!isRetryable || attempt === MAX_ATTEMPTS) throw err;
        await new Promise(r => setTimeout(r, attempt * 1500));
      }
    }
    throw lastErr;
  }
);
