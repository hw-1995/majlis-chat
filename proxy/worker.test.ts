import { describe, expect, it, vi } from 'vitest';
import { handle, MAX_BODY_BYTES } from './worker';

const env = { ALLOWED_ORIGINS: 'https://app.example' };

function post(path: string, init: { origin?: string; auth?: string | null; body?: string } = {}): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.origin !== undefined) headers.Origin = init.origin;
  else headers.Origin = 'https://app.example';
  if (init.auth !== null) headers.Authorization = init.auth ?? 'Bearer sk-visitor';
  return new Request(`https://relay.example${path}`, { method: 'POST', headers, body: init.body ?? '{"model":"m"}' });
}

describe('proxy worker', () => {
  it('forwards to the vendor with the visitor’s own key and streams the body back', async () => {
    const upstream = vi.fn(async () =>
      new Response('data: {"choices":[]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } }),
    );
    const response = await handle(post('/deepseek/chat/completions'), env, upstream as unknown as typeof fetch);
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(await response.text()).toContain('[DONE]');

    const [url, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-visitor');
    expect(init.signal).toBeDefined();
  });

  it('answers the CORS preflight', async () => {
    const preflight = new Request('https://relay.example/openai/chat/completions', {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example' },
    });
    const response = await handle(preflight, env, vi.fn() as unknown as typeof fetch);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });

  it('is not an open proxy', async () => {
    const never = vi.fn() as unknown as typeof fetch;
    expect((await handle(post('/deepseek/chat/completions', { origin: 'https://evil.example' }), env, never)).status).toBe(403);
    expect((await handle(post('/example.com/chat/completions'), env, never)).status).toBe(404);
    expect((await handle(post('/openai/files'), env, never)).status).toBe(404);
    expect((await handle(post('/openai/chat/completions', { auth: null }), env, never)).status).toBe(401);
    const big = 'x'.repeat(MAX_BODY_BYTES + 1);
    expect((await handle(post('/openai/chat/completions', { body: big }), env, never)).status).toBe(413);
    const get = new Request('https://relay.example/openai/chat/completions', { headers: { Origin: 'https://app.example' } });
    expect((await handle(get, env, never)).status).toBe(405);
    expect(never).not.toHaveBeenCalled();
  });

  it('passes vendor errors through with their status', async () => {
    const upstream = vi.fn(async () => new Response('{"error":{"message":"bad key"}}', { status: 401 }));
    const response = await handle(post('/openai/chat/completions'), env, upstream as unknown as typeof fetch);
    expect(response.status).toBe(401);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
  });

  it('reports an unreachable vendor as 502', async () => {
    const upstream = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const response = await handle(post('/qwen/chat/completions'), env, upstream as unknown as typeof fetch);
    expect(response.status).toBe(502);
  });
});
