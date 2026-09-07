import type { Retrieved, SourceDoc } from '../types';

/**
 * Lexical retrieval with BM25, running entirely in the browser.
 *
 * Chosen over embeddings for the demo because it needs no API key, no vector
 * store and no build step, so anyone who clones the repo sees real retrieval
 * immediately. The trade-off is real: BM25 matches words, not meaning, so a
 * query phrased with different vocabulary than the source will miss. In
 * production this is the lexical half of a hybrid search — see the "Hybrid
 * retrieval" section of DEVELOPMENT_GUIDE.md.
 */

const K1 = 1.5; // term-frequency saturation
const B = 0.75; // length normalisation

/** Arabic combining marks (harakat) and the tatweel elongation character. */
const ARABIC_MARKS = /[ً-ْٰـ]/g;

/**
 * Fold away the orthographic variation that makes Arabic lexical search miss:
 * writers omit diacritics, and the alef/ya/ta-marbuta forms are used
 * interchangeably. Latin text is simply lowercased.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(ARABIC_MARKS, '')
    .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ -> ا
    .replace(/ى/g, 'ي') // ى -> ي
    .replace(/ة/g, 'ه'); // ة -> ه
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

interface IndexedDoc {
  doc: SourceDoc;
  termFreq: Map<string, number>;
  length: number;
}

export class Bm25Index {
  private docs: IndexedDoc[] = [];
  private docFreq = new Map<string, number>();
  private avgLength = 0;

  constructor(docs: SourceDoc[] = []) {
    if (docs.length > 0) this.addAll(docs);
  }

  addAll(docs: SourceDoc[]): void {
    for (const doc of docs) {
      const tokens = tokenize(`${doc.title} ${doc.text}`);
      const termFreq = new Map<string, number>();
      for (const token of tokens) {
        termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
      }
      for (const term of termFreq.keys()) {
        this.docFreq.set(term, (this.docFreq.get(term) ?? 0) + 1);
      }
      this.docs.push({ doc, termFreq, length: tokens.length });
    }
    const total = this.docs.reduce((sum, d) => sum + d.length, 0);
    this.avgLength = this.docs.length > 0 ? total / this.docs.length : 0;
  }

  /** Standard BM25 inverse document frequency, smoothed so it never goes negative. */
  private idf(term: string): number {
    const n = this.docFreq.get(term) ?? 0;
    const N = this.docs.length;
    return Math.log(1 + (N - n + 0.5) / (n + 0.5));
  }

  search(query: string, topK = 3): Retrieved[] {
    const terms = tokenize(query);
    if (terms.length === 0 || this.docs.length === 0) return [];

    const scored = this.docs.map((indexed) => {
      let score = 0;
      for (const term of terms) {
        const freq = indexed.termFreq.get(term);
        if (!freq) continue;
        const denominator =
          freq + K1 * (1 - B + (B * indexed.length) / (this.avgLength || 1));
        score += this.idf(term) * ((freq * (K1 + 1)) / denominator);
      }
      return { doc: indexed.doc, score };
    });

    return scored
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
