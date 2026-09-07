# Development guide

Notes on why this is built the way it is, and where to extend it.

## Decision record

### 1. Hand-written SSE parsing over `EventSource`

`EventSource` is GET-only. A chat turn must POST the conversation, so the
response is read from `fetch(...).body.getReader()` and framed by hand.

The parser (`src/lib/sse.ts`) is incremental because `ReadableStream` chunk
boundaries have nothing to do with SSE event boundaries: `data: hello\n\n` can
arrive as `da`, `ta: hel`, `lo\n`, `\n`. It buffers partial lines, joins
multi-line `data:` fields with a newline, skips `:` comment keep-alives, and
strips exactly one space after the field colon.

Lone-CR line endings are not supported. This is a deliberate limit — no SSE
server in practice emits them, and supporting them requires holding a trailing
`\r` back until the next chunk arrives to know whether it is `\r\n`.

### 2. Treating a stream that stops without `done` as a failure

`streamOnce` throws if the reader finishes without a `done` event. Without that
check, a connection cut mid-answer looks identical to a complete answer, and the
user gets a truncated response presented as final. Retrying on a truncated
stream is recoverable; silently presenting one is not.

### 3. Full-jitter backoff

`backoffDelay` returns `random() * min(cap, base * 2^attempt)` rather than a
fixed exponential. If a provider blips, every client that was mid-stream retries
at the same moment; jitter spreads the reconnection so the recovery does not
become a second outage.

### 4. Resume rather than restart

The client accumulates what it has received and sends it as `resumeFrom` on
retry. The bundled mock continues from that offset.

Real providers differ, and this is worth knowing before promising it:
- **Anthropic** supports it directly — prefill the assistant turn with the
  partial text and the model continues from there.
- Providers with no continuation primitive will restart the turn. The client
  still produces a correct answer; the user just sees it start over.

### 5. Streaming text outside React state

See the README. The measurable point: with the text in `useState` on a shared
parent, every token re-renders the whole transcript, so per-token cost is
O(messages). With `useSyncExternalStore`, only the streaming bubble subscribes
and per-token cost is O(1).

This also explains why `MessageBubble` is wrapped in `memo` — without it, any
re-render of the list re-renders every historical message.

### 6. `content-visibility` instead of JS virtualisation

Chat bubbles have unpredictable heights, which is the case JS windowing handles
worst: you need measure-on-render plus an offset cache, and any error shows up
as scroll jitter. `content-visibility: auto` with `contain-intrinsic-size` lets
the engine skip layout and paint for offscreen bubbles with no bookkeeping.

The limit worth stating: it reduces rendering work, not the number of DOM nodes.
At tens of thousands of messages a windowing library becomes the right answer.

### 7. Effects fired outside state updaters

`useChat.send` builds the next message array, calls `setMessages`, and *then*
starts the request. Starting it inside the updater would fire twice under
StrictMode in development, because React intentionally double-invokes updaters
to surface impurity.

### 8. Citation markers validated against the source count

`parseSegments` only treats `[n]` as a citation when `n` is within the range of
sources actually retrieved. A model handed three sources will sometimes emit
`[7]`; rendering that as a control that points nowhere is worse than leaving it
as text, because it looks verified when it is not.

## Extending

### Hybrid retrieval

`Bm25Index.search` is the seam. Keep BM25 for exact terms and rare tokens, add a
vector search for paraphrase, and fuse the two rankings — Reciprocal Rank Fusion
is the usual choice because it needs no score normalisation between the two
systems:

```
score(d) = Σ over rankers  1 / (k + rank_r(d))       // k ≈ 60
```

Embeddings need a backend: computing them client-side means shipping a model,
and calling an embeddings API from the browser means exposing the key.

### Chunking

The corpus is one passage per document, which sidesteps chunking entirely. Real
corpora need splitting, and the trade-off is direct: small chunks retrieve
precisely but lose the context that makes an answer readable; large chunks read
well but dilute the BM25 signal and waste context budget. Overlapping windows of
roughly 200–400 tokens is the usual starting point.

### A real tokenizer

`estimateTokens` is a character-ratio heuristic that deliberately over-estimates
so the request is trimmed early rather than rejected by the provider. If exact
accounting matters — billing, or packing a context window tight — use the
provider's own token-counting endpoint rather than shipping a tokenizer to the
browser.

### Testing

The four pure modules in `src/lib` are pure functions specifically so they can
be tested without a DOM. Component tests would need `@testing-library/react`
plus a jsdom environment; the split is intentional — the logic worth testing is
the logic that has edge cases, and that is all in `src/lib`.
