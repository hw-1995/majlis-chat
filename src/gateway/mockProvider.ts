import { createSseParser } from '../lib/sse';
import { planMockReply, shouldDrop, toTokens, TOKEN_DELAY_MS } from '../lib/mockAnswer';
import type { StreamEvent } from '../types';
import { ProviderError, type Provider, type ProviderRequest } from './types';

/**
 * The bundled mock, so the demo works with no API key.
 *
 * Two transports, one behaviour:
 *   - `http`: POSTs to /api/chat (the Vite dev-server middleware, or any
 *     endpoint speaking our wire format) and parses the SSE response — the
 *     same network path a real backend would take;
 *   - `local`: generates the same reply in the tab, for the static GitHub
 *     Pages build, which has no server to POST to.
 *
 * Both honour `resumeFrom`, so a dropped stream continues where it stopped.
 */

export function createMockProvider(transport: 'http' | 'local', url = '/api/chat'): Provider {
  return {
    id: `mock-${transport}`,
    supportsResume: true,
    stream: transport === 'http' ? (req, on) => streamHttp(url, req, on) : streamLocal,
  };
}

async function streamHttp(
  url: string,
  request: ProviderRequest,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      turns: request.turns,
      sources: request.sources,
      tools: request.tools?.map((tool) => tool.name),
      resumeFrom: request.resumeFrom,
    }),
    signal: request.signal,
  });
  if (!response.ok || !response.body) {
    throw new ProviderError('server', `${response.status} ${response.statusText}`, response.status >= 500);
  }

  let ended = false;
  const parser = createSseParser((event) => {
    let payload: StreamEvent;
    try {
      payload = JSON.parse(event.data) as StreamEvent;
    } catch {
      return; // keep-alives and anything that is not our wire format
    }
    if (payload.type === 'error') throw new ProviderError('server', payload.message, false);
    if (payload.type === 'done') ended = true;
    onEvent(payload);
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.flush();
  // A stream that stops without `done` was cut off — surface it so the caller
  // retries rather than presenting a truncated answer as complete.
  if (!ended) throw new Error('Stream ended before completion');
}

async function streamLocal(
  request: ProviderRequest,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const { turns, sources, resumeFrom, signal } = request;
  const reply = planMockReply(turns, sources, (request.tools?.length ?? 0) > 0);

  if (reply.kind === 'tool_call') {
    await delay(TOKEN_DELAY_MS * 8, signal); // a model takes a moment to decide
    onEvent({ type: 'tool_call', id: `mock_${Date.now()}`, name: reply.name, arguments: reply.arguments });
    onEvent({ type: 'done' });
    return;
  }

  const remaining = reply.text.startsWith(resumeFrom)
    ? reply.text.slice(resumeFrom.length)
    : reply.text;
  const tokens = toTokens(remaining);
  const drop = shouldDrop(turns, resumeFrom);
  const cutoff = drop ? Math.floor(tokens.length / 2) : tokens.length;

  for (let i = 0; i < cutoff; i += 1) {
    await delay(TOKEN_DELAY_MS, signal);
    onEvent({ type: 'token', value: tokens[i] });
  }
  if (drop) throw new Error('Stream ended before completion');
  onEvent({ type: 'done' });
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
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
