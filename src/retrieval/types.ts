/**
 * Turns text into vectors whose distance reflects meaning. Implementations:
 * the in-browser Transformers.js model (embedder.ts) and a tiny stub in tests.
 *
 * `kind` exists because e5-family models are trained with "query: " and
 * "passage: " prefixes and lose accuracy without them.
 */
export interface Embedder {
  id: string;
  embed(texts: string[], kind: 'query' | 'passage'): Promise<Float32Array[]>;
}

export type MatchKind = 'keyword' | 'semantic';
