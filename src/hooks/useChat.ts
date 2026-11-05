import { useCallback, useMemo, useRef, useState } from 'react';
import { CORPUS } from '../data/corpus';
import { Bm25Index } from '../lib/bm25';
import { citedIndices } from '../lib/citations';
import { createTextStore } from '../lib/textStore';
import { isAbort, streamTurn } from '../lib/streamClient';
import { trimToBudget } from '../lib/tokens';
import { buildProvider, type ModelSettings } from '../gateway/settings';
import { ProviderError, type ChatTurn } from '../gateway/types';
import type { ChatStatus, Message, SourceDoc } from '../types';

/** Small enough that trimming is observable in a short demo conversation. */
const CONTEXT_BUDGET_TOKENS = 1200;
const TOP_K = 3;

let nextId = 0;
const makeId = (): string => `m${(nextId += 1)}`;

/**
 * Ground the answer in the retrieved passages and require inline markers, so
 * the UI has something to anchor its citation controls to — and tell the model
 * what to do when the passages do not cover the question, which is the
 * difference between "I don't know" and a confident invention.
 */
export function buildSystemPrompt(sources: SourceDoc[]): string {
  const listed = sources.map((source, i) => `[${i + 1}] ${source.title}\n${source.text}`).join('\n\n');
  return [
    'You are the help-centre assistant for Qalam Notes, a note-taking app.',
    'Answer using only the sources below, in the same language as the question.',
    'Cite each claim with an inline marker such as [1] that matches the source number.',
    'If the sources do not answer the question, say plainly that the help centre does not cover it. Do not use outside knowledge.',
    '',
    sources.length > 0 ? listed : '(No sources were found for this question.)',
  ].join('\n');
}

function toTurns(messages: Message[]): ChatTurn[] {
  // A failed or empty assistant turn carries nothing worth resending, and some
  // vendors reject an assistant message with empty content outright.
  const usable = messages.filter(
    (m) => !(m.role === 'assistant' && (m.error || m.content.trim().length === 0)),
  );
  return usable.map((m) =>
    m.role === 'assistant'
      ? { role: 'assistant', content: m.content }
      : { role: m.role, content: m.content },
  );
}

export function errorCode(error: unknown): string {
  return error instanceof ProviderError ? error.code : 'unknown';
}

export function useChat(settings: ModelSettings) {
  const index = useMemo(() => new Bm25Index(CORPUS), []);
  const streamStore = useMemo(() => createTextStore(), []);

  const [messages, setMessages] = useState<Message[]>([]);
  const [sources, setSources] = useState<SourceDoc[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [droppedTurns, setDroppedTurns] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const lastQuestionRef = useRef<string>('');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const run = useCallback(
    async (question: string, history: Message[]) => {
      const controller = new AbortController();
      abortRef.current = controller;
      lastQuestionRef.current = question;
      const provider = buildProvider(settingsRef.current);

      setStatus('retrieving');
      setNotice(null);
      streamStore.set('');

      const retrieved = index.search(question, TOP_K).map((entry) => entry.doc);
      setSources(retrieved);

      const system: Message = { id: 'system', role: 'system', content: buildSystemPrompt(retrieved) };
      const budgeted = trimToBudget([system, ...history], CONTEXT_BUDGET_TOKENS);
      setDroppedTurns(budgeted.dropped);

      setStatus('streaming');
      const finish = (extra: Partial<Message>): void => {
        const content = streamStore.get();
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: 'assistant',
            content,
            citations: citedIndices(content, retrieved.length),
            ...extra,
          },
        ]);
      };

      try {
        await streamTurn({
          provider,
          turns: toTurns(budgeted.kept),
          sources: retrieved,
          signal: controller.signal,
          onToken: streamStore.append,
          onReset: () => streamStore.set(''),
          onRetry: () => setNotice('reconnecting'),
        });
        finish({});
        setStatus('idle');
      } catch (error) {
        if (isAbort(error) || controller.signal.aborted) {
          // The user pressed Stop: keep the partial answer they already read.
          if (streamStore.get().length > 0) finish({});
          setStatus('idle');
        } else {
          finish({
            error: error instanceof Error ? error.message : 'Request failed',
            errorCode: errorCode(error),
          });
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

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setSources([]);
    setDroppedTurns(0);
    setStatus('idle');
  }, []);

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
    clear,
  };
}
