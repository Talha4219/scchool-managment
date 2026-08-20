/**
 * OpenRouter model adapter for Genkit.
 *
 * OpenRouter exposes an OpenAI-compatible API, so we translate Genkit's
 * GenerateRequest into OpenAI chat-completion messages, POST them to
 * https://openrouter.ai/api/v1/chat/completions, and map the response back
 * into a Genkit ModelResponseData.
 *
 * The model is registered as `openrouter/chat`. The actual upstream model is
 * chosen with OPENROUTER_MODEL (defaults to openai/gpt-4o-mini).
 *
 * Structured output: we deliberately declare `supports.constrained: 'none'`
 * so Genkit's built-in `simulateConstrainedGeneration` middleware injects the
 * output-schema instructions into the prompt and parses the returned JSON —
 * the exact same path Google's non-native-constrained models take.
 */

import { GenkitError } from 'genkit';
import type { GenerateRequest, GenerateResponseData, Genkit, Part } from 'genkit';

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

type OpenAiRole = 'system' | 'user' | 'assistant' | 'tool';

interface OpenAiMessage {
  role: OpenAiRole;
  content: unknown;
  tool_call_id?: string;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
}

function mapMediaPart(part: Extract<Part, { media: unknown }>): { type: 'image_url'; image_url: { url: string } } {
  return { type: 'image_url', image_url: { url: part.media.url } };
}

function toOpenAiContent(parts: Part[]): unknown[] {
  const content: unknown[] = [];
  for (const part of parts) {
    if ('text' in part && part.text) content.push({ type: 'text', text: part.text });
    else if ('media' in part && part.media) content.push(mapMediaPart(part));
  }
  return content.length ? content : [{ type: 'text', text: '' }];
}

function toOpenAiMessages(request: GenerateRequest): OpenAiMessage[] {
  const out: OpenAiMessage[] = [];
  for (const m of request.messages) {
    if (m.role === 'system') {
      const text = m.content.map(p => ('text' in p ? p.text : '')).filter(Boolean).join('\n');
      out.push({ role: 'system', content: text });
    } else if (m.role === 'model') {
      const text = m.content.filter(p => 'text' in p).map(p => p.text).join('\n');
      const toolCalls = m.content
        .filter((p): p is Extract<Part, { toolRequest: unknown }> => 'toolRequest' in p)
        .map((p, i) => ({
          id: p.toolRequest.ref || `call_${i}`,
          type: 'function' as const,
          function: { name: p.toolRequest.name, arguments: JSON.stringify(p.toolRequest.input ?? {}) },
        }));
      if (toolCalls.length) out.push({ role: 'assistant', content: text || null, tool_calls: toolCalls });
      else out.push({ role: 'assistant', content: text });
    } else if (m.role === 'user') {
      out.push({ role: 'user', content: toOpenAiContent(m.content) });
    } else if (m.role === 'tool') {
      const tr = m.content.find(p => 'toolResponse' in p);
      const resp = tr && 'toolResponse' in tr ? tr.toolResponse : undefined;
      out.push({
        role: 'tool',
        tool_call_id: resp?.ref || resp?.name || '',
        content: JSON.stringify(resp?.output ?? ''),
      });
    }
  }
  return out;
}

function mapFinishReason(reason?: string): GenerateResponseData['finishReason'] {
  switch (reason) {
    case 'stop': return 'stop';
    case 'length': return 'length';
    case 'content_filter': return 'blocked';
    case 'tool_calls': return 'stop';
    default: return 'other';
  }
}

/**
 * Defines and registers the OpenRouter model on the given Genkit instance.
 * Call this right after `genkit(...)` — before any prompt/flow runs — so the
 * default `model: 'openrouter/chat'` ref resolves from the registry.
 */
export function defineOpenRouterModel(ai: Genkit): void {
  ai.defineModel(
    {
      apiVersion: 'v2',
      name: 'openrouter/chat',
      label: 'OpenRouter (multi-model gateway)',
      supports: {
        multiturn: true,
        media: true,
        systemRole: true,
        tools: false,
        toolChoice: false,
        output: ['text', 'json'],
        constrained: 'none',
      },
    },
    async (request: GenerateRequest): Promise<GenerateResponseData> => {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new GenkitError({
          status: 'UNAUTHENTICATED',
          message: 'OPENROUTER_API_KEY is not set. Add it to your .env file (see .env.example) to enable OpenRouter AI.',
        });
      }

      const modelId = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
      const started = Date.now();
      const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: toOpenAiMessages(request),
          temperature: request.config?.temperature ?? 0.7,
          ...(typeof request.config?.maxOutputTokens === 'number'
            ? { max_tokens: request.config.maxOutputTokens }
            : {}),
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        const status =
          res.status === 401 ? 'UNAUTHENTICATED' : res.status === 429 ? 'RESOURCE_EXHAUSTED' : 'UNAVAILABLE';
        throw new GenkitError({
          status,
          message: `OpenRouter request failed (${res.status}): ${detail.slice(0, 500)}`,
        });
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      const content = data.choices?.[0]?.message?.content ?? '';

      return {
        message: { role: 'model', content: [{ text: content }] },
        finishReason: mapFinishReason(data.choices?.[0]?.finish_reason),
        latencyMs: Date.now() - started,
        usage: {
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
      };
    }
  );
}