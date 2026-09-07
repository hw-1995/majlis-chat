import { composeAnswer, toTokens, TOKEN_DELAY_MS, type MockSource } from './mockAnswer';
import type { Message } from '../types';

/**
 * In-browser fallback provider.
 *
 * A static build (GitHub Pages) has no dev server, so there is no /api/chat to
 * POST to. Rather than shipping a demo that is dead on arrival, the same mock
 * answer is streamed locally. It exercises the identical client path — token
 * callbacks, abort, `/drop` — so what a visitor sees matches what a developer
 * sees running it locally.
 */
export async function streamLocal(
  messages: Message[],
  sources: MockSource[],
  resumeFrom: string,
  signal: AbortSignal,
  onToken: (token: string) => void,
): Promise<void> {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const question = lastUser?.content ?? '';

  const full = composeAnswer(question, sources);
  const remaining = full.startsWith(resumeFrom) ? full.slice(resumeFrom.length) : full;
  const tokens = toTokens(remaining);

  const shouldDrop = question.includes('/drop') && resumeFrom.length === 0;
  const cutoff = shouldDrop ? Math.floor(tokens.length / 2) : tokens.length;

  for (let i = 0; i < cutoff; i += 1) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    await delay(TOKEN_DELAY_MS, signal);
    onToken(tokens[i]);
  }

  if (shouldDrop) {
    throw new Error('Stream ended before completion');
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
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
