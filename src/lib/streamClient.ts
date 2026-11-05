import { ProviderError, type ChatTurn, type Provider, type ToolCallRef, type ToolSpec } from '../gateway/types';
import type { SourceDoc } from '../types';

/**
 * Stream one model response through a provider, retrying a dropped connection.
 *
 * What a retry does depends on the provider:
 *   - providers that can continue (the bundled mock) are sent the text already
 *     received as `resumeFrom`, and pick up mid-sentence;
 *   - providers that cannot (the OpenAI Chat Completions format has no
 *     continuation primitive) start the answer again, and `onReset` tells the
 *     UI to clear the partial text so the restart does not duplicate it.
 *
 * Never retried: a user pressing Stop, and errors that would fail the same way
 * again (a bad key, an exhausted quota, a CORS refusal).
 */

export interface StreamTurnOptions {
  provider: Provider;
  turns: ChatTurn[];
  tools?: ToolSpec[];
  sources?: SourceDoc[];
  signal: AbortSignal;
  onToken: (token: string) => void;
  /** The partial answer was discarded because the provider restarts on retry. */
  onReset?: () => void;
  /** Fired before each retry so the UI can say "reconnecting" instead of stalling. */
  onRetry?: (attempt: number, delayMs: number) => void;
  maxRetries?: number;
}

export interface TurnResult {
  text: string;
  toolCalls: ToolCallRef[];
}

export function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/** Exponential backoff with full jitter, so retries from many clients spread out. */
export function backoffDelay(attempt: number, base = 400, cap = 8000): number {
  const ceiling = Math.min(cap, base * 2 ** attempt);
  return Math.random() * ceiling;
}

export function isRetryable(error: unknown): boolean {
  if (isAbort(error)) return false;
  if (error instanceof ProviderError) return error.retryable;
  return true; // a mid-stream drop or an unexpected failure is worth one more try
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

export async function streamTurn(options: StreamTurnOptions): Promise<TurnResult> {
  const { provider, turns, tools, sources = [], signal, onToken, onReset, onRetry } = options;
  const maxRetries = options.maxRetries ?? 2;

  let text = '';
  let toolCalls: ToolCallRef[] = [];
  let attempt = 0;

  for (;;) {
    toolCalls = [];
    try {
      await provider.stream(
        { turns, tools, sources, resumeFrom: provider.supportsResume ? text : '', signal },
        (event) => {
          if (event.type === 'token') {
            text += event.value;
            onToken(event.value);
          } else if (event.type === 'tool_call') {
            toolCalls.push({ id: event.id, name: event.name, arguments: event.arguments });
          }
        },
      );
      return { text, toolCalls };
    } catch (error) {
      if (signal.aborted || !isRetryable(error) || attempt >= maxRetries) throw error;

      if (!provider.supportsResume && text.length > 0) {
        text = '';
        onReset?.();
      }
      const delay = backoffDelay(attempt);
      onRetry?.(attempt + 1, delay);
      await sleep(delay, signal);
      attempt += 1;
    }
  }
}
