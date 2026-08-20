import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {defineOpenRouterModel} from '@/ai/providers/openrouter';

// Pick the AI provider via env vars:
//   - OPENROUTER_API_KEY set  -> OpenRouter gateway (model via OPENROUTER_MODEL)
//   - otherwise               -> Google AI Gemini (GEMINI_API_KEY)
const usingOpenRouter = !!process.env.OPENROUTER_API_KEY;

export const ai = genkit({
  plugins: usingOpenRouter ? [] : [googleAI()],
  // gemini-2.5-flash and gemini-2.0-flash were both retired by Google
  // ("no longer available") — pinning to the "latest" alias so this stops
  // breaking every time Google sunsets a dated model name.
  model: usingOpenRouter ? 'openrouter/chat' : 'googleai/gemini-flash-latest',
});

if (usingOpenRouter) {
  defineOpenRouterModel(ai);
}