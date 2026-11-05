# Majlis

[中文说明](README.zh-CN.md) · **Live demo:** https://hw-1995.github.io/majlis-chat/

A help-centre assistant built in React and TypeScript. It shows the pieces of an
LLM product that sit around the model:

- answers stream in, and every claim is cited back to the passage it came from;
- the visitor can plug in **their own** model API key (DeepSeek, OpenAI, Qwen,
  Kimi, OpenRouter or any OpenAI-compatible endpoint);
- the model can **call tools** to get exact numbers instead of guessing them;
- retrieval is **hybrid**: keyword search plus semantic search, run in the browser;
- everything works in English, Chinese and Arabic, including right-to-left layout.

It is a static site. There is no server to run and no key of ours to protect.
With no key entered, a bundled mock answers, so every feature can still be seen.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 111 unit tests
npm run build    # static site in dist/
```

---

## What it demonstrates

| Problem | How it is solved here |
|---|---|
| Streaming a POST response | Hand-written SSE parser over `fetch` + `ReadableStream` |
| One app, many model vendors | A provider gateway: each vendor's stream is converted into one internal event format |
| Not paying for visitors' usage | Bring-your-own-key. The key lives in `sessionStorage` and is sent only to the vendor |
| Wrong arithmetic from a model | Tool calling: a bounded agent loop runs a price calculator, a calculator and a clock |
| Paraphrased questions missing documents | Hybrid retrieval: BM25 and in-browser embeddings, fused with Reciprocal Rank Fusion |
| Off-topic questions | Score floors on both retrievers. With no source, the model is told to say so |
| A dropped connection | Full-jitter backoff. The mock resumes mid-answer; real vendors restart cleanly |
| An unbounded context window | Token budgeting that pins the system prompt and trims the oldest turns |
| Vendors that block browsers (CORS) | An optional key-less relay (Cloudflare Worker) in `proxy/` |
| Three languages and RTL | Trilingual knowledge base, language-aware tokenising, logical CSS properties |
| Re-render cost per token | Streaming text held in an external store, not React state |

---

## How a question is answered

```
question
  │
  ├─► BM25 keyword search ──────────┐
  │                                 ├─► RRF fusion ─► one article per topic ─► top 3 sources
  └─► embedding search (optional) ──┘     (score floors keep off-topic questions source-less)
  │
  ▼
system prompt: "answer only from these sources, cite with [n], say so if they don't cover it"
  │
  ▼
trimToBudget() ── keeps the system prompt, drops the oldest turns
  │
  ▼
agent loop (max 4 rounds)
  │   provider.stream() ──► tokens ──► only StreamingBubble re-renders
  │   if the model asks for a tool: run it in the page, append the result, ask again
  │   on the last round, no tools are offered, so the model must answer
  ▼
answer with [n] citations + the tool steps it used, shown in the transcript
```

### Provider gateway (`src/gateway/`)

Every model is reached through one interface:

```ts
interface Provider {
  id: string;
  supportsResume: boolean;
  stream(request, onEvent: (e: StreamEvent) => void): Promise<void>;
}
```

- `openaiCompatible.ts` speaks the OpenAI Chat Completions format, which
  DeepSeek, Qwen (DashScope), Kimi, OpenRouter and many others share. It
  reassembles tool-call arguments that arrive in fragments, and it maps HTTP
  errors to codes such as `auth`, `rate_limit`, `network` and `server`. The UI
  then explains the problem in the reader's language, and only retryable errors
  are retried.
- `mockProvider.ts` is the keyless demo. It runs over HTTP in development
  (`server/mockSse.ts`) and in the tab on the static build.

Adding a vendor with a different format (Anthropic's Messages API, say) means
writing one more adapter. Nothing above the gateway changes.

### Bring your own key

The demo has no key of its own, so nobody can spend the owner's quota. A
visitor who wants a real model opens **Model settings** and pastes their key.
That key:

- is kept in `sessionStorage`, so it is gone when the tab closes;
- is sent only to the vendor's own URL, never to this site;
- is never put in a URL or logged.

The page loads no third-party scripts at start-up. The only exception is the
opt-in semantic model, loaded from a CDN when the visitor switches it on.

### Tool calling (`src/agent/`)

The model cannot run code. It replies with a structured request, such as
`estimate_cost({"plan":"team","seats":5,"months":12,"billing":"yearly"})`. The
page runs that tool and sends the JSON result back, and the model writes the
answer from it. The tools:

| Tool | Why |
|---|---|
| `estimate_cost` | Prices come from the same table as the help article, so "$600" is computed, not predicted |
| `calculate` | A recursive-descent parser for arithmetic only. It never uses `eval`: the expression comes from a model, which comes from user input |
| `get_current_time` | Models do not know today's date |

All the tools are read-only. A tool that changed something, such as issuing a
refund, would need the user's confirmation first. The loop is capped at four
rounds, and tools are withheld on the last one, so a confused model cannot loop
and run up a bill. A failed tool returns `{"error": …}` rather than throwing, so
the model can see the error and recover.

### Hybrid retrieval (`src/lib/bm25.ts`, `src/retrieval/`)

- **BM25** handles exact terms. Tokenising is language-aware: Chinese is split
  into character bigrams, and Arabic is normalised (diacritics removed, letter
  variants folded, common prefixes and suffixes stripped). A score floor means
  "Who won the World Cup?" retrieves nothing, so the assistant declines instead
  of improvising.
- **Semantic search** is opt-in. It loads `multilingual-e5-small` with
  Transformers.js (WebAssembly), entirely in the browser, as a one-off download
  of about 120 MB. It matches by meaning ("费用" finds the pricing article) and
  across languages.
- **Reciprocal Rank Fusion** combines the two rankings by position, because a
  BM25 score and a cosine similarity are not on comparable scales.
- **One article per topic:** semantic search may return the English, Chinese
  and Arabic versions of one article. Only the version in the reader's language
  is kept.
- **Fallbacks.** The library is loaded from jsDelivr, or esm.sh if that fails.
  The model is loaded from Hugging Face, or hf-mirror.com if that fails. If
  neither works, search falls back to BM25 and the settings panel says why.

### Knowledge base

`src/data/corpus.ts` holds 12 help articles for **Qalam Notes**, a fictional
note-taking app, each written in English, Chinese and Arabic. The product is
invented on purpose: a model cannot answer from its training data, so a correct
answer shows that retrieval worked.

---

## Try these

| Question | What you see |
|---|---|
| `How much does Pro cost?` | Retrieval and a cited answer |
| `What would Team cost for 5 people for a year?` / `团队版 5 个人用一年多少钱` | A tool call (price calculator), then an answer from its result |
| `帮我算一下 12 * (3 + 4)` | The calculator tool |
| `Who won the 2022 World Cup?` / `怎样才能快速致富` | No sources, so the assistant says the help centre does not cover it |
| `كيف أعيد تعيين كلمة المرور؟` | Arabic, right to left |
| Any question + ` /drop` | The mock cuts the stream halfway. The client backs off, reconnects and resumes |
| Model settings → Semantic search | Download progress, then sources tagged *keyword* / *meaning* |

To use a real model, open **Model settings**, pick a provider and paste your
key. DeepSeek and Qwen both have low-cost keys.

---

## When a provider blocks browser calls

Some vendors do not send CORS headers, so a browser cannot call them directly.
The app reports this as a network error. `proxy/worker.ts` is a small
Cloudflare Worker that relays requests:

```bash
cd proxy && npx wrangler deploy
# then in the app: provider "Custom", base URL https://<your-worker>/deepseek
```

The relay **holds no key**: it passes the visitor's `Authorization` header
through. It is also restricted in four ways:

- vendor allowlist;
- chat completions path only;
- allowed origins only;
- request body size capped.

It pipes the SSE stream back unchanged, and it cancels the upstream request
when the visitor presses Stop. In a real product this is also where rate
limiting, a shared company key and audit logs would go.

---

## Layout

```
src/gateway/     Provider interface · OpenAI-compatible adapter · mock · settings (BYOK)
src/agent/       runAgent (tool loop) · tools · safe calculator
src/retrieval/   embedder (Transformers.js) · vector index · RRF hybrid search
src/lib/         sse · bm25 · tokens · citations · streamClient (retry/backoff) · textStore
src/hooks/       useChat (retrieve → budget → agent → cite) · useSemantic (model loading)
src/components/  transcript, streaming bubble, tool steps, settings, source panel
src/i18n/        English, Chinese and Arabic strings, direction map
src/data/        trilingual knowledge base
server/          mock SSE endpoint for `npm run dev`
proxy/           optional CORS relay (Cloudflare Worker)
```

## Limitations

- The knowledge base is 36 short passages, so there is no chunking and no
  vector database. A linear scan is fine at this size. `DEVELOPMENT_GUIDE.md`
  covers what changes at scale.
- Resume after a drop is seamless only with the mock. OpenAI-compatible
  vendors have no way to continue a partial answer, so the turn restarts.
- The semantic score floors were set for multilingual-e5-small, and they are a
  starting point. In a real product they would be tuned against logged
  questions.

## Licence

MIT
