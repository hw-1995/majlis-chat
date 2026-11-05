/**
 * Optional CORS relay for providers that refuse calls straight from a browser.
 *
 * Deploy it as a Cloudflare Worker (free tier is plenty), then in the app pick
 * "Custom" and set the base URL to  https://<your-worker>/<vendor>,
 * for example  https://majlis-proxy.example.workers.dev/openai .
 *
 * What it is — and is not:
 *   - It holds no API key. The visitor's own key arrives in the Authorization
 *     header and is passed through unchanged, so running it costs the owner
 *     nothing and no one can spend the owner's quota through it.
 *   - It is not an open proxy: only an allowlist of vendor hosts, only the
 *     chat completions path, only POST, only from allowed origins, with a body
 *     size cap.
 *   - It never logs or stores request bodies or headers.
 *   - It streams: the upstream body is piped straight back, so tokens arrive
 *     as the model produces them, and if the visitor presses Stop the
 *     upstream request is cancelled too (no tokens paid for after Stop).
 *
 * The app does not need this to run. It exists for the vendors whose CORS
 * policy blocks browsers, and as the place where server-side concerns
 * (rate limiting, a shared key, audit logs) would go in a real product.
 */

export const UPSTREAMS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

export const MAX_BODY_BYTES = 256 * 1024;

export interface Env {
  /** Comma-separated origins allowed to call the relay, e.g. "https://hw-1995.github.io". "*" allows any. */
  ALLOWED_ORIGINS?: string;
}

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.includes('*')) return origin ?? '*';
  return origin && allowed.includes(origin) ? origin : null;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function reply(status: number, message: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export async function handle(request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const origin = allowedOrigin(request, env);
  if (!origin) return reply(403, 'Origin not allowed');
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply(405, 'Only POST is supported', cors);

  // /<vendor>/chat/completions  →  <upstream>/chat/completions
  const url = new URL(request.url);
  const match = /^\/([a-z0-9-]+)(\/chat\/completions)$/.exec(url.pathname);
  if (!match) return reply(404, 'Use /<vendor>/chat/completions', cors);
  const upstream = UPSTREAMS[match[1]];
  if (!upstream) return reply(404, `Unknown vendor "${match[1]}"`, cors);

  const auth = request.headers.get('Authorization');
  if (!auth) return reply(401, 'Missing Authorization header — bring your own key', cors);

  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > MAX_BODY_BYTES) return reply(413, 'Request too large', cors);
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return reply(413, 'Request too large', cors);

  let response: Response;
  try {
    response = await fetchImpl(upstream + match[2], {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body,
      // The visitor pressing Stop closes their connection, which aborts this.
      signal: request.signal,
    });
  } catch {
    return reply(502, 'Could not reach the provider', cors);
  }

  // Pass the stream through untouched; only the CORS headers are added.
  const headers = new Headers(cors);
  headers.set('Content-Type', response.headers.get('Content-Type') ?? 'application/json');
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

export default { fetch: handle };
