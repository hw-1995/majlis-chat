import { createSseParser } from './sse';
import { streamLocal } from './localProvider';
import type { Message, SourceDoc, StreamEvent } from '../types';

/**
 * Sentinel meaning "no backend — stream the mock in this tab". A static build
 * has no dev server to POST to, so a deployed demo falls back to it rather
 * than shipping a page that fails on first message.
 */
export const LOCAL_TRANSPORT = 'local';

const DEFAULT_URL: string =
  import.meta.env?.VITE_API_URL ??
  (import.meta.env?.DEV ? '/api/chat' : LOCAL_TRANSPORT);

export interface StreamOptions {
  messages: Message[];
  /** Retrieved context for this turn. Sent alongside the conversation so the
   *  provider can ground its answer and emit [n] citation markers. */
  sources?: SourceDoc[];
  signal: AbortSignal;
  onToken: (token: string) => void;
  /** Fired before each retry so the UI can say "reconnecting" instead of stalling. */
  onRetry?: (attempt: number, delayMs: number) => void;
  url?: string;
  maxRetries?: number;
}

export function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/** Exponential backoff with full jitter, so retries from many clients spread out. */
export function backoffDelay(attempt: number, base = 400, cap = 8000): number {
  const ceiling = Math.min(cap, base * 2 ** attempt);
  return Math.random() * ceiling;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Run one request to completion, feeding tokens to `onToken`.
 * Throws if the connection drops mid-stream so the caller can decide to retry.
 */
async function streamOnce(
  url: string,
  messages: Message[],
  sources: SourceDoc[],
  resumeFrom: string,
  signal: AbortSignal,
  onToken: (token: string) => void,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, sources, resumeFrom }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat request failed: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let streamEnded = false;

  const parser = createSseParser((event) => {
    let payload: StreamEvent;
    try {
      payload = JSON.parse(event.data) as StreamEvent;
    } catch {
      return; // Ignore keep-alives and anything that is not our wire format.
    }
    if (payload.type === 'token') onToken(payload.value);
    else if (payload.type === 'done') streamEnded = true;
    else if (payload.type === 'error') throw new Error(payload.message);
  });

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.flush();

  // A stream that stops without `done` was cut off — surface it so we retry
  // rather than presenting a truncated answer as if it were complete.
  if (!streamEnded) {
    throw new Error('Stream ended before completion');
  }
}

/**
 * Stream one assistant turn, retrying a dropped connection with backoff.
 *
 * On retry the text received so far is sent back as `resumeFrom`. The bundled
 * mock provider continues from it. Real providers differ: Anthropic supports
 * this directly by prefilling the assistant turn, while others have no
 * continuation primitive and will restart the turn — see DEVELOPMENT_GUIDE.md.
 *
 * A user-initiated abort is never retried.
 */
export async function streamChat(options: StreamOptions): Promise<string> {
  const {
    messages,
    sources = [],
    signal,
    onToken,
    onRetry,
    url = DEFAULT_URL,
    maxRetries = 2,
  } = options;

  let accumulated = '';
  let attempt = 0;

  const collect = (token: string): void => {
    accumulated += token;
    onToken(token);
  };

  for (;;) {
    try {
      if (url === LOCAL_TRANSPORT) {
        await streamLocal(messages, sources, accumulated, signal, collect);
      } else {
        await streamOnce(url, messages, sources, accumulated, signal, collect);
      }
      return accumulated;
    } catch (error) {
      if (isAbort(error) || signal.aborted) throw error;
      if (attempt >= maxRetries) throw error;

      const delay = backoffDelay(attempt);
      onRetry?.(attempt + 1, delay);
      await sleep(delay, signal);
      attempt += 1;
    }
  }
}
