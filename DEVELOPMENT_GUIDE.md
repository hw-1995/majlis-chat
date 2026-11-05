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

Every provider throws if its stream finishes without a `done` event (or `[DONE]`). Without that
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

### 9. A provider gateway instead of calling a vendor from the hook

`useChat` knows nothing about vendors. It asks a `Provider` to stream and gets
back the internal events: `token`, `tool_call`, `done` and `error`. Each
vendor's quirks stay inside its adapter:

- OpenAI-style streams send tool-call arguments as string fragments, keyed by
  index;
- the end of a stream is marked by `[DONE]` or by a `finish_reason`;
- 429 means "slow down" from some vendors and "out of credit" from others.

Errors leave the adapter as a `ProviderError` with a `code` and a `retryable`
flag. The retry loop asks only "is this retryable?", and the UI turns the code
into a sentence in the reader's language. A 401 is never retried. A 5xx is.

### 10. Bring-your-own-key, and why there is no backend

A key embedded in a static site is public. A key held on a backend means
paying for every visitor, and running a backend for a demo. Letting visitors
use their own key avoids both. The costs, and how each is handled:

- **Storage.** The key sits in the page. It is held in `sessionStorage` (it
  dies with the tab), and no third-party script runs at start-up.
- **CORS.** Some vendors refuse browser calls. `proxy/` relays those requests
  without ever holding a key.

### 11. A bounded agent loop

`runAgent` alternates between asking the model and running tools, and it stops
when the model answers in plain text. There are two guards:

- `maxSteps` (4), with tools withheld on the last step, so the model has to
  answer with what it has;
- tools return errors as data, not exceptions, so a bad argument becomes a
  message the model can correct (`seats must be a whole number`) instead of a
  dead conversation.

A dropped stream inside a tool round restarts only that round. Text and tool
steps from earlier rounds are kept, and `onReset(keep)` puts back exactly that
prefix.

### 12. Arithmetic without `eval`

The `calculate` tool's input is written by a model, which is steered by user
text, so it is untrusted. `new Function(expression)` would let a
prompt-injected "expression" run code in the tab that holds the visitor's API
key. The recursive-descent parser in `src/agent/calculator.ts` can only do
arithmetic. Its grammar is in the file header.

### 13. Semantic search in the browser, opt-in, loaded at runtime

Embeddings usually imply a backend. Here Transformers.js runs
`multilingual-e5-small` in WebAssembly, so the site stays static and keyless.
Three choices follow from the 120 MB download:

- **Off by default.** Most visitors never pay the cost.
- **Not bundled.** The library is imported from a CDN at runtime
  (`import(/* @vite-ignore */ url)`), so the first page load stays at about
  190 kB.
- **Two sources for each piece.** The library comes from jsDelivr or esm.sh,
  and the model from Hugging Face or hf-mirror.com, because the default hosts
  are not reachable everywhere. When everything fails, retrieval falls back to
  BM25.

**Fusion.** Results are combined with Reciprocal Rank Fusion:

```
score(d) = Σ over rankers  1 / (k + rank_r(d))       // k = 60
```

RRF uses positions only. BM25 scores are unbounded, while e5 cosine scores sit
in a narrow band near 0.8, so adding the two would let one ranker dominate
arbitrarily.

**Score floors.** An embedding model always has a nearest neighbour, even for
"who won the World Cup". So semantic hits must clear two floors:

- an absolute floor, 0.82;
- a margin of 0.04 from the best hit.

Without these, every off-topic question would arrive with confident-looking
sources, and the "say you don't know" instruction would never fire. Both
values are starting points for this model.

**One article per topic.** Because the model matches across languages, a
Chinese question can retrieve the English pricing article. Results are
collapsed by topic, and the reader's language is preferred.

## Extending

### Scaling retrieval

At 36 passages a linear scan over vectors costs microseconds. The changes worth
making as the corpus grows, roughly in order:

1. **Chunking.** Split long documents into overlapping windows of 200–400
   tokens. Small chunks retrieve precisely but lose context; large ones read
   well but dilute the match.
2. **Index offline.** Embed passages at build time or ingest time, not in each
   visitor's browser, and store the vectors.
3. **A vector database or ANN index** (pgvector, Qdrant, HNSW). This becomes
   worth it at tens of thousands of chunks.
4. **A reranker.** A cross-encoder can re-score the fused top 20 before the
   top 3 go to the model.
5. **Evaluation.** Keep a set of real questions with known answers, and
   measure recall@k and answer faithfulness before changing thresholds.

### Another vendor format

Write an adapter implementing `Provider` that emits `token`, `tool_call` and
`done`. For Anthropic's Messages API, the differences are:

- the system prompt is a top-level field;
- tool use arrives as `content_block_delta` events;
- partial answers can be continued by prefilling the assistant turn, so that
  adapter can set `supportsResume: true`.

### Tools that change things

Every current tool is read-only. A tool that changed something (a refund, a
cancellation) should not run when the model asks. It should show a
confirmation to the user and run only after they approve. `runAgent`'s
`runTool` hook is where that gate goes.

### A real tokenizer

`estimateTokens` is a character-ratio heuristic that deliberately over-estimates,
so the request is trimmed early rather than rejected by the provider. If exact
accounting matters, use the provider's own token-counting endpoint rather than
shipping a tokenizer to the browser.

### Testing

The logic with edge cases is kept in pure modules, which are tested without a
DOM:

- `src/lib`: parser, retrieval, budgeting, citations, retry;
- `src/agent`: calculator, tools, agent loop with scripted providers;
- `src/retrieval`: fusion, floors and topic collapsing, with a stub embedder;
- `proxy/`: allowlist, CORS and streaming, with a mocked `fetch`.

Component tests would need `@testing-library/react` and jsdom.
