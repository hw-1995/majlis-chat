import type { SourceDoc } from '../types';
import type { Embedder } from './types';

/**
 * Brute-force vector search. With a few dozen passages a linear scan takes
 * microseconds; an approximate index (HNSW, IVF) only pays off at tens of
 * thousands of vectors, which is when a vector database earns its keep.
 */

export interface VectorHit {
  doc: SourceDoc;
  score: number;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

export function passageText(doc: SourceDoc): string {
  return `${doc.title}. ${doc.text}`;
}

export class VectorIndex {
  private constructor(
    private readonly embedder: Embedder,
    private readonly docs: SourceDoc[],
    private readonly vectors: Float32Array[],
  ) {}

  /** Embeds every passage once, up front; queries then cost one embedding each. */
  static async build(embedder: Embedder, docs: SourceDoc[]): Promise<VectorIndex> {
    const vectors = await embedder.embed(docs.map(passageText), 'passage');
    return new VectorIndex(embedder, docs, vectors);
  }

  async rank(query: string): Promise<VectorHit[]> {
    const [q] = await this.embedder.embed([query], 'query');
    return this.docs
      .map((doc, i) => ({ doc, score: cosine(q, this.vectors[i]) }))
      .sort((a, b) => b.score - a.score);
  }
}
