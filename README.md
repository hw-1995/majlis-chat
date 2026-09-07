# Majlis

A streaming LLM chat interface in React + TypeScript, where every claim in the
answer is traceable back to the passage it came from — and the whole thing works
in Arabic, right-to-left, not as an afterthought.

Runs with **no API key**. A mock streaming provider is bundled — as dev-server
middleware locally, and as an in-browser fallback in a static build — so both
`npm run dev` and the deployed page work with nothing configured.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests for the SSE parser, BM25, budgeting, citations
```

---

## What this demonstrates

| Problem | How it is solved here |
|---|---|
| Streaming a POST response | Hand-written SSE parser over `fetch` + `ReadableStream` |
| Interrupting a turn | `AbortController`, with the partial answer kept rather than discarded |
| A dropped connection | Exponential backoff with jitter, resuming from the text already received |
| An unbounded context window | Token budgeting that pins system messages and trims oldest-first |
| "Where did that come from?" | BM25 retrieval + inline `[n]` markers wired to the source passage |
| Arabic / RTL | Logical CSS properties, per-passage `dir="auto"`, Arabic-aware tokenisation |
| Re-render cost per token | Streaming text held in an external store, not React state |

---

## How it works

```
question
   │
   ▼
BM25 index (in-browser, over src/data/corpus.ts)
   │  top 3 passages
   ▼
system prompt: "answer only from these sources, cite with [n]"
   │
   ▼
trimToBudget()  ── pins system, drops oldest turns
   │
   ▼
POST /api/chat ──► SSE: {"type":"token","value":"…"} × N, then {"type":"done"}
   │
   ▼
createSseParser() ──► textStore.append() ──► only StreamingBubble re-renders
   │
   ▼
on completion: parse [n] markers → citation controls → highlight source panel
```

### Retrieval is BM25, not embeddings

Deliberate. BM25 needs no API key, no vector store and no build step, so the
repo demonstrates real retrieval the moment it is cloned. The trade-off is
honest: BM25 matches words, not meaning, so a question phrased in different
vocabulary than the source will miss it. Production systems use hybrid search —
BM25 for exact terms and rare tokens, vectors for paraphrase — and fuse the two
rankings. `DEVELOPMENT_GUIDE.md` covers where that seam goes.

Arabic gets specific handling in `normalize()`: diacritics are stripped and the
alef, alef-maqsura and ta-marbuta variants are folded, because writers use them
interchangeably and naive tokenisation silently fails to match otherwise.

### Why not `EventSource`

`EventSource` only issues GET requests. A chat turn has to POST the
conversation, so the SSE framing is parsed by hand from a `ReadableStream`
(`src/lib/sse.ts`). Chunk boundaries do not respect event boundaries — a single
event routinely arrives split across reads — which is the main thing the parser
tests cover.

### Why the streaming text is not in React state

At roughly 30 tokens per second, holding the in-flight text in state re-renders
the entire transcript on every token, and that cost grows with the length of the
conversation: the longer you chat, the worse the typing feels. Instead the text
lives in a small external store (`src/lib/textStore.ts`) consumed through
`useSyncExternalStore`, so only `StreamingBubble` re-renders. Completed messages
are memoised and never re-render at all.

Offscreen messages are skipped with CSS `content-visibility: auto` rather than a
JS virtualisation library — chat bubbles have unpredictable heights, which is
precisely the case JS windowing handles worst.

### RTL

`dir` is set on the document element so portalled content inherits it. All
inline offsets use logical properties (`margin-inline-start`, `border-inline-start`,
`text-align: start`), so switching direction is a one-line change rather than a
parallel stylesheet — there is not a single `margin-left` in `global.css`.

Individual passages carry their own `dir="auto"`, so an Arabic source renders
right-to-left inside an English interface and vice versa. During streaming the
first strong directional character may arrive several tokens in, so a paragraph
can flip direction once the language becomes clear; that is correct BiDi
behaviour, not a glitch.

---

## Try these

- `what is offside?` — retrieval in English
- `ما هي ركلة الجزاء؟` — retrieval in Arabic; switch the UI to العربية
- `what is offside? /drop` — the mock cuts the connection halfway, so you can
  watch the client back off, reconnect and **resume from where it stopped**
  rather than restarting the answer

---

## Deploying

`npm run build` produces a static site. With no `VITE_API_URL` set, the client
falls back to `streamLocal` and streams the mock answer in the browser, so a
GitHub Pages build is a working demo rather than a page that fails on the first
message. The identical client path runs either way — same token callbacks, same
abort handling, same `/drop` behaviour.

A Pages workflow is included at `.github/workflows/deploy.yml`; it runs the
tests before publishing. `vite.config.ts` sets `base` to `/majlis-chat/` for a
project site — override with `BASE_PATH=/` for a root domain.

## Pointing it at a real model

`server/mockSse.ts` is the only file that speaks to a provider. Replace it with
an adapter that emits the same wire format:

```
data: {"type":"token","value":"…"}
data: {"type":"done"}
data: {"type":"error","message":"…"}
```

Then set `VITE_API_URL` (see `.env.example`). Nothing in `src/` changes.

One caveat on resume-after-drop: the client sends the text it already has as
`resumeFrom`. Anthropic supports continuing from it directly by prefilling the
assistant turn; providers without a continuation primitive will restart the
turn, and the client will still render a correct answer — just not a seamless one.

---

## Layout

```
src/lib/         sse.ts · bm25.ts · tokens.ts · citations.ts · streamClient.ts · textStore.ts
src/hooks/       useChat.ts          orchestration: retrieve → budget → stream → cite
src/components/  transcript, streaming bubble, composer, source panel
src/i18n/        English and Arabic strings, direction map
src/data/        the bilingual demo corpus
server/          mock streaming provider (dev-server middleware)
```

The four pure modules in `src/lib` carry the unit tests; they are pure functions
precisely so they can be tested without a browser.

## Licence

MIT
