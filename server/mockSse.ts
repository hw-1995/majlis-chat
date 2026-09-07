import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  composeAnswer,
  toTokens,
  TOKEN_DELAY_MS,
  type MockSource,
} from '../src/lib/mockAnswer';

/**
 * Mock streaming provider, mounted as dev-server middleware.
 *
 * Exists so `npm run dev` works with no API key and no account. It speaks
 * exactly the wire format a real provider adapter would, so swapping in
 * Anthropic or OpenAI touches only this file.
 *
 * Two deliberate demo affordances:
 *   - a message containing "/drop" cuts the stream halfway, exercising the
 *     client's retry-and-resume path;
 *   - `resumeFrom` is honoured, so the retry continues rather than restarting.
 */

interface ChatRequestBody {
  messages?: { role: string; content: string }[];
  resumeFrom?: string;
  sources?: MockSource[];
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export async function mockSseMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
): Promise<void> {
  if (req.method !== 'POST') {
    next();
    return;
  }

  let body: ChatRequestBody = {};
  try {
    body = JSON.parse(await readBody(req)) as ChatRequestBody;
  } catch {
    res.statusCode = 400;
    res.end('Invalid JSON body');
    return;
  }

  const messages = body.messages ?? [];
  const sources = body.sources ?? [];
  const resumeFrom = body.resumeFrom ?? '';
  const question = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

  const full = composeAnswer(question, sources);
  const remaining = full.startsWith(resumeFrom) ? full.slice(resumeFrom.length) : full;
  const tokens = toTokens(remaining);

  const shouldDrop = question.includes('/drop') && resumeFrom.length === 0;
  const cutoff = shouldDrop ? Math.floor(tokens.length / 2) : tokens.length;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  for (let i = 0; i < cutoff; i += 1) {
    if (closed) return;
    res.write(`data: ${JSON.stringify({ type: 'token', value: tokens[i] })}\n\n`);
    await new Promise((resolve) => setTimeout(resolve, TOKEN_DELAY_MS));
  }

  if (shouldDrop) {
    // Destroy without sending `done`: exactly what a dropped connection looks like.
    res.destroy();
    return;
  }

  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
}
