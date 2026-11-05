import { useEffect, useState } from 'react';
import { CORPUS } from '../data/corpus';
import { loadBrowserEmbedder, type LoadProgress } from '../retrieval/embedder';
import type { Embedder } from '../retrieval/types';
import { VectorIndex } from '../retrieval/vectorIndex';

export type SemanticState =
  | { status: 'off' }
  | { status: 'loading'; percent: number }
  | { status: 'ready'; index: VectorIndex }
  | { status: 'failed'; message: string };

/** One load per page: toggling off and on again must not download twice. */
let cached: Promise<VectorIndex> | null = null;
/** Progress goes to whichever component instances are currently listening. */
const listeners = new Set<(p: LoadProgress) => void>();
const broadcast = (p: LoadProgress): void => listeners.forEach((listener) => listener(p));

/**
 * Loads the embedding model and indexes the knowledge base when semantic
 * search is switched on. Failure is not fatal: retrieval falls back to BM25
 * and the settings panel says why.
 */
export function useSemantic(enabled: boolean, load: (onProgress: (p: LoadProgress) => void) => Promise<Embedder> = loadBrowserEmbedder) {
  const [state, setState] = useState<SemanticState>({ status: 'off' });

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'off' });
      return;
    }
    let live = true;
    setState({ status: 'loading', percent: 0 });
    const onProgress = ({ percent }: LoadProgress): void => {
      if (live) setState({ status: 'loading', percent });
    };
    listeners.add(onProgress);
    if (!cached) {
      cached = load(broadcast).then((embedder) =>
        VectorIndex.build(embedder, CORPUS),
      );
      // A failed load may succeed later (network back, mirror reachable).
      cached.catch(() => {
        cached = null;
      });
    }
    cached.then(
      (index) => live && setState({ status: 'ready', index }),
      (error: unknown) =>
        live && setState({ status: 'failed', message: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      live = false;
      listeners.delete(onProgress);
    };
  }, [enabled, load]);

  return state;
}
