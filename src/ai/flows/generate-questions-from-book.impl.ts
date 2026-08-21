/**
 * @fileOverview Genkit implementation for generating exam questions from a
 * class textbook PDF — split out of generate-questions-from-book.ts (the
 * 'use server' entrypoint) so genkit/opentelemetry/pdf-parse aren't eagerly
 * imported into Next's server-action manifest, which loads for every route.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { PDFParse } from 'pdf-parse';
import type { GenerateQuestionsFromBookInput, GenerateQuestionsFromBookOutput } from './generate-questions-from-book';

// Extract plain text from a base64 PDF data URL. Used instead of sending the
// raw PDF as a media part so any OpenRouter model (incl. text-only ones like
// gpt-4o-mini) can read the book — Gemini was the only provider that natively
// understood PDFs. Returns '' if nothing usable was extracted.
async function extractBookText(dataUrl: string): Promise<string> {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const buffer = Buffer.from(base64, 'base64');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? '';
  } finally {
    await parser.destroy();
  }
}

const GenerateQuestionsFromBookInputSchema = z.object({
  bookPdfDataUrl: z.string().describe("The textbook as a base64 data URL (data:application/pdf;base64,...)."),
  subjectName: z.string().describe("The subject this book is for (e.g. 'Physics')."),
  topicHint: z.string().optional().describe("Optional chapter/topic to focus on — if omitted, draw from the whole book."),
  mcqCount: z.number().min(0).max(30).describe("Number of multiple-choice questions to generate."),
  shortAnswerCount: z.number().min(0).max(30).describe("Number of short-answer questions to generate."),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).describe("Target difficulty level."),
});

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

const generateQuestionsFromBookFlow = ai.defineFlow(
  {
    name: 'generateQuestionsFromBookFlow',
    inputSchema: GenerateQuestionsFromBookInputSchema,
    outputSchema: GenerateQuestionsFromBookOutputSchema,
  },
  async (input) => {
    // Prefer text extraction — works with every model on every provider.
    // Fall back to sending the PDF as a media part only when the PDF has no
    // extractable text (e.g. scanned/OCR pages) so vision-capable models can
    // still attempt it.
    let pdfText = '';
    let useMedia = false;
    try {
      pdfText = (await extractBookText(input.bookPdfDataUrl)).trim();
      if (pdfText.length < 50) useMedia = true;
    } catch {
      useMedia = true;
    }

    const rules = `You are an exam-question author for a school. Using ONLY the content of the attached textbook (subject: ${input.subjectName}${input.topicHint ? `, focused on: ${input.topicHint}` : ''}), generate exactly ${input.mcqCount} multiple-choice questions and ${input.shortAnswerCount} short-answer questions at ${input.difficulty} difficulty.

Rules:
- Every question must be answerable strictly from the book's content — do not invent facts not in the text.
- MCQ options must have exactly 4 choices, only one correct.
- correctAnswer for an MCQ must be copied verbatim from its options.
- Keep questionText concise and unambiguous.
- Vary which part of the book each question draws from — do not cluster all questions on one page/topic unless topicHint narrows it.`;

    const prompt = useMedia
      ? [{ media: { url: input.bookPdfDataUrl } }, { text: rules }]
      : [
          {
            text: `${rules}\n\nThe textbook content is provided below as plain text.\n\n=== BOOK CONTENT START ===\n${pdfText.length > 120000 ? pdfText.slice(0, 120000) + '\n[...truncated]' : pdfText}\n=== BOOK CONTENT END ===`,
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

export async function runGenerateQuestionsFromBookFlow(
  input: GenerateQuestionsFromBookInput
): Promise<GenerateQuestionsFromBookOutput> {
  return generateQuestionsFromBookFlow(input);
}
