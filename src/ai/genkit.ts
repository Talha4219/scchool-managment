import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
  // gemini-2.5-flash and gemini-2.0-flash were both retired by Google
  // ("no longer available") — pinning to the "latest" alias so this stops
  // breaking every time Google sunsets a dated model name.
  model: 'googleai/gemini-flash-latest',
});
