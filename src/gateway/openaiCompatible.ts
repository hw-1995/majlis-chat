import { createSseParser } from '../lib/sse';
import type { StreamEvent } from '../types';
import {
  ProviderError,
  type ChatTurn,
  type Provider,
  type ProviderRequest,
  type ToolSpec,
} from './types';

/**
 * Adapter for the OpenAI Chat Completions wire format.
 *
 * Most vendors expose this same shape — DeepSeek, OpenAI, Qwen (DashScope
 * compatible mode), Moonshot, OpenRouter — so one adapter covers all of them;
 * only the base URL and model name differ.
 *
 * The request goes straight from the visitor's browser to the vendor with the
 * visitor's own key. Nothing passes through a server of ours, so the demo
 * costs us nothing and the key is never seen by anyone but the vendor.
 */

export interface OpenAiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
}

/* ---------------------------------------------------------------------------
 * Pure part: turning streamed chunks into StreamEvents. Kept free of fetch so
 * the awkward cases — tool-call arguments split across many chunks, a stream
 * that stops early — can be unit tested.
 * ------------------------------------------------------------------------ */

interface PartialCall {
  id: string;
  name: string;
  arguments: string;
}

interface ChunkChoice {
  delta?: {
    content?: string | null;
    tool_calls?: {
      index: number;
      id?: string;
      function?: { name?: string; arguments?: string };
    }[];
  };
  finish_reason?: string | null;
}

export interface OpenAiAccumulator {
  /** Feed one SSE `data:` payload; returns the events it produced. */
  push(data: string): StreamEvent[];
  /** Call when the byte stream ends. Throws if the response was cut off. */
  end(): StreamEvent[];
}

export function createOpenAiAccumulator(): OpenAiAccumulator {
  const calls = new Map<number, PartialCall>();
  let sawFinish = false;
  let completed = false;

  function complete(): StreamEvent[] {
    if (completed) return [];
    completed = true;
    // Tool calls are only emitted once whole: their arguments arrive as JSON
    // fragments, and half a JSON object is not something anyone can execute.
    const events: StreamEvent[] = [...calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, call]) => ({ type: 'tool_call', ...call }));
    events.push({ type: 'done' });
    return events;
  }

  return {
    push(data: string): StreamEvent[] {
      if (data.trim() === '[DONE]') return complete();

      let chunk: { choices?: ChunkChoice[]; error?: { message?: string } };
      try {
        chunk = JSON.parse(data);
      } catch {
        return []; // keep-alives and anything else that is not JSON
      }
      if (chunk.error) {
        throw new ProviderError('server', chunk.error.message ?? 'Provider error', false);
      }

      const events: StreamEvent[] = [];
      for (const choice of chunk.choices ?? []) {
        const delta = choice.delta ?? {};
        if (typeof delta.content === 'string' && delta.content.length > 0) {
          events.push({ type: 'token', value: delta.content });
        }
        for (const part of delta.tool_calls ?? []) {
          const call = calls.get(part.index) ?? { id: '', name: '', arguments: '' };
          if (part.id) call.id = part.id;
          if (part.function?.name) call.name += part.function.name;
          if (part.function?.arguments) call.arguments += part.function.arguments;
          calls.set(part.index, call);
        }
        if (choice.finish_reason) sawFinish = true;
      }
      return events;
    },

    end(): StreamEvent[] {
      if (completed) return [];
      // Some compatible servers omit the closing [DONE]; a finish_reason is an
      // equally clear signal that the answer is whole.
      if (sawFinish) return complete();
      throw new Error('Stream ended before completion');
    },
  };
}

/* ---------------------------------------------------------------------------
 * Request mapping
 * ------------------------------------------------------------------------ */

export function toOpenAiMessages(turns: ChatTurn[]): unknown[] {
  return turns.map((turn) => {
    if (turn.role === 'tool') {
      return { role: 'tool', tool_call_id: turn.toolCallId, content: turn.content };
    }
    if (turn.role === 'assistant' && turn.toolCalls?.length) {
      return {
        role: 'assistant',
        content: turn.content.length > 0 ? turn.content : null,
        tool_calls: turn.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: call.arguments },
        })),
      };
    }
    return { role: turn.role, content: turn.content };
  });
}

export function toOpenAiTools(tools: ToolSpec[]): unknown[] {
  return tools.map((tool) => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

/** Join base URL and path without doubling or dropping the slash. */
export function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

async function errorFromResponse(response: Response): Promise<ProviderError> {
  let detail = '';
  try {
    const body = await response.text();
    const parsed = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    detail =
      (typeof parsed.error === 'string' ? parsed.error : parsed.error?.message) ??
      parsed.message ??
      body;
  } catch {
    // body was empty or not JSON; the status code is enough
  }
  const status = response.status;
  const message = `${status}${detail ? `: ${detail}` : ''}`;
  if (status === 401 || status === 403) return new ProviderError('auth', message, false);
  // A 429 is usually an exhausted quota, not a blip, so it is not retried.
  if (status === 429) return new ProviderError('rate_limit', message, false);
  if (status >= 500) return new ProviderError('server', message, true);
  return new ProviderError('bad_request', message, false);
}

/* ---------------------------------------------------------------------------
 * The provider
 * ------------------------------------------------------------------------ */

export function createOpenAiProvider(config: OpenAiConfig): Provider {
  return {
    id: 'openai-compatible',
    // Chat Completions has no "continue this text" primitive, so a dropped
    // stream is retried from the start of the answer.
    supportsResume: false,

    async stream(request: ProviderRequest, onEvent): Promise<void> {
      const body: Record<string, unknown> = {
        model: config.model,
        messages: toOpenAiMessages(request.turns),
        stream: true,
        // Low temperature: a help-centre answer should be the same answer
        // each time it is asked, not a creative variation.
        temperature: config.temperature ?? 0.2,
      };
      if (request.tools?.length) body.tools = toOpenAiTools(request.tools);

      let response: Response;
      try {
        response = await fetch(endpoint(config.baseUrl, 'chat/completions'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: request.signal,
        });
      } catch (error) {
        if (request.signal.aborted) throw error;
        // fetch rejects with a bare TypeError for both "offline" and "the
        // vendor does not allow browser calls (CORS)"; the browser will not say
        // which. Not retried: a CORS refusal fails identically every time.
        throw new ProviderError('network', error instanceof Error ? error.message : 'Network error', false);
      }

      if (!response.ok || !response.body) throw await errorFromResponse(response);

      const accumulator = createOpenAiAccumulator();
      const parser = createSseParser((event) => {
        for (const out of accumulator.push(event.data)) onEvent(out);
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      parser.flush();
      for (const out of accumulator.end()) onEvent(out);
    },
  };
}
