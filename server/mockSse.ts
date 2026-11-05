import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  planMockReply,
  shouldDrop,
  toTokens,
  TOKEN_DELAY_MS,
  type MockSource,
  type MockTurn,
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
  turns?: MockTurn[];
  tools?: string[];
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

  const turns = body.turns ?? [];
  const sources = body.sources ?? [];
  const resumeFrom = body.resumeFrom ?? '';

  const reply = planMockReply(turns, sources, (body.tools?.length ?? 0) > 0);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  if (reply.kind === 'tool_call') {
    const call = { type: 'tool_call', id: `mock_${Date.now()}`, name: reply.name, arguments: reply.arguments };
    res.write(`data: ${JSON.stringify(call)}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
    return;
  }

  const full = reply.text;
  const remaining = full.startsWith(resumeFrom) ? full.slice(resumeFrom.length) : full;
  const tokens = toTokens(remaining);

  const drop = shouldDrop(turns, resumeFrom);
  const cutoff = drop ? Math.floor(tokens.length / 2) : tokens.length;

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  for (let i = 0; i < cutoff; i += 1) {
    if (closed) return;
    res.write(`data: ${JSON.stringify({ type: 'token', value: tokens[i] })}\n\n`);
    await new Promise((resolve) => setTimeout(resolve, TOKEN_DELAY_MS));
  }

  if (drop) {
    // Destroy without sending `done`: exactly what a dropped connection looks like.
    res.destroy();
    return;
  }

  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
}
