import { useCallback, useMemo, useRef, useState } from 'react';
import { CORPUS } from '../data/corpus';
import { Bm25Index } from '../lib/bm25';
import { citedIndices } from '../lib/citations';
import { createTextStore } from '../lib/textStore';
import { isAbort, streamChat } from '../lib/streamClient';
import { trimToBudget } from '../lib/tokens';
import type { ChatStatus, Message, SourceDoc } from '../types';

/** Small enough that trimming is observable in a short demo conversation. */
const CONTEXT_BUDGET_TOKENS = 800;
const TOP_K = 3;

let nextId = 0;
const makeId = (): string => `m${(nextId += 1)}`;

/**
 * Ground the answer in the retrieved passages and require inline markers, so
 * the UI has something to anchor its citation controls to.
 */
function buildSystemPrompt(sources: SourceDoc[]): string {
  const listed = sources
    .map((source, i) => `[${i + 1}] ${source.title}\n${source.text}`)
    .join('\n\n');
  return [
    'Answer using only the sources below.',
    'Cite each claim with an inline marker such as [1] that matches the source number.',
    'If the sources do not answer the question, say so plainly.',
    '',
    listed,
  ].join('\n');
}

export function useChat() {
  const index = useMemo(() => new Bm25Index(CORPUS), []);
  const streamStore = useMemo(() => createTextStore(), []);

  const [messages, setMessages] = useState<Message[]>([]);
  const [sources, setSources] = useState<SourceDoc[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [droppedTurns, setDroppedTurns] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const lastQuestionRef = useRef<string>('');

  const run = useCallback(
    async (question: string, history: Message[]) => {
      const controller = new AbortController();
      abortRef.current = controller;
      lastQuestionRef.current = question;

      setStatus('retrieving');
      setNotice(null);
      streamStore.set('');

      const retrieved = index.search(question, TOP_K).map((entry) => entry.doc);
      setSources(retrieved);

      const system: Message = {
        id: 'system',
        role: 'system',
        content: buildSystemPrompt(retrieved),
      };
      const budgeted = trimToBudget([system, ...history], CONTEXT_BUDGET_TOKENS);
      setDroppedTurns(budgeted.dropped);

      setStatus('streaming');
      try {
        const answer = await streamChat({
          messages: budgeted.kept,
          sources: retrieved,
          signal: controller.signal,
          onToken: streamStore.append,
          onRetry: () => setNotice('reconnecting'),
        });
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: 'assistant',
            content: answer,
            citations: citedIndices(answer, retrieved.length),
          },
        ]);
        setStatus('idle');
      } catch (error) {
        // An abort is the user pressing Stop: keep the partial answer they
        // already read rather than discarding it.
        const partial = streamStore.get();
        if (isAbort(error) || controller.signal.aborted) {
          if (partial.length > 0) {
            setMessages((prev) => [
              ...prev,
              {
                id: makeId(),
                role: 'assistant',
                content: partial,
                citations: citedIndices(partial, retrieved.length),
              },
            ]);
          }
          setStatus('idle');
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: makeId(),
              role: 'assistant',
              content: partial,
              citations: citedIndices(partial, retrieved.length),
              error: error instanceof Error ? error.message : 'Request failed',
            },
          ]);
          setStatus('error');
        }
      } finally {
        streamStore.set('');
        setNotice(null);
        abortRef.current = null;
      }
    },
    [index, streamStore],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || status === 'streaming' || status === 'retrieving') return;

      // The request is fired outside the state updater on purpose: updaters
      // must stay pure, and StrictMode invokes them twice in development —
      // starting the stream inside one would send every message twice.
      const userMessage: Message = { id: makeId(), role: 'user', content: trimmed };
      const next = [...messages, userMessage];
      setMessages(next);
      void run(trimmed, next);
    },
    [messages, run, status],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    const question = lastQuestionRef.current;
    if (question.length === 0) return;
    // Drop the failed assistant turn before trying again.
    const last = messages[messages.length - 1];
    const next = last?.error ? messages.slice(0, -1) : messages;
    setMessages(next);
    void run(question, next);
  }, [messages, run]);

  return {
    messages,
    sources,
    status,
    notice,
    droppedTurns,
    streamStore,
    send,
    stop,
    retry,
  };
}
