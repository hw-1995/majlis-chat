import type { Retrieved, SourceDoc } from '../types';

/**
 * Lexical retrieval with BM25, running entirely in the browser.
 *
 * BM25 needs no API key, no vector store and no build step, so anyone who
 * clones the repo sees real retrieval immediately. It matches words, not
 * meaning — which is why it is one half of the hybrid retriever in
 * src/retrieval/hybrid.ts rather than the whole story.
 */

const K1 = 1.5; // term-frequency saturation
const B = 0.75; // length normalisation

/**
 * A passage only counts as relevant above this score. Without a floor, BM25
 * always returns *something*: "what is this" would match every passage that
 * happens to contain "is", and the answer would be built from noise.
 */
export const MIN_SCORE = 2.5;

/**
 * Passages scoring under this fraction of the best match are dropped too, so a
 * strong hit is not padded out with weak ones that only share a common word.
 */
export const RELATIVE_CUTOFF = 0.35;

/** Arabic combining marks (harakat) and the tatweel elongation character. */
const ARABIC_MARKS = /[ً-ْٰـ]/g;
const HAN = /\p{Script=Han}/u;
const HAN_RUN = /\p{Script=Han}+/gu;

/**
 * Words that carry no topic of their own. Questions are full of them ("how do
 * I…", "什么是…", "كيف…"), and left in they make every passage look slightly
 * relevant. Arabic entries are in normalized form (see `normalize`).
 */
const STOPWORDS = new Set<string>([
  // English
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'do', 'does', 'did',
  'what', 'which', 'who', 'whom', 'how', 'why', 'when', 'where', 'can', 'could', 'should',
  'would', 'will', 'shall', 'may', 'might', 'must', 'i', 'me', 'my', 'we', 'our', 'you',
  'your', 'it', 'its', 'this', 'that', 'these', 'those', 'there', 'here', 'of', 'to', 'in',
  'on', 'for', 'with', 'by', 'at', 'from', 'about', 'as', 'and', 'or', 'but', 'if', 'then',
  'so', 'not', 'no', 'any', 'all', 'some', 'get', 'have', 'has', 'had', 'tell', 'please',
  // Chinese (as bigrams, matching how Han text is tokenized)
  '什么', '怎么', '怎样', '如何', '为什', '么样', '可以', '能不', '不能', '是否', '是不',
  '不是', '我们', '你们', '他们', '我的', '你的', '一下', '请问', '这个', '那个', '哪些',
  '多少',
  // Arabic (normalized)
  'ما', 'ماذا', 'من', 'كيف', 'هل', 'هو', 'هي', 'في', 'على', 'الي', 'عن', 'ان', 'او',
  'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'لا', 'كم', 'متي', 'اين', 'لماذا', 'يمكن',
  'يمكنني', 'اريد',
]);

/**
 * Fold away orthographic variation that makes lexical search miss: Arabic
 * writers omit diacritics and use the alef/ya/ta-marbuta forms
 * interchangeably; NFKC turns full-width Latin and digits (common in Chinese
 * input) into their ordinary forms.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(ARABIC_MARKS, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

/**
 * Chinese is not written with spaces, so there are no "words" to split on.
 * Overlapping character pairs (bigrams) are the standard dictionary-free
 * answer: 重置密码 becomes 重置 · 置密 · 密码, and a query for 密码 matches.
 * The odd pairs that straddle two words (置密) simply never match anything.
 */
function hanTokens(run: string): string[] {
  const chars = [...run];
  if (chars.length === 1) return chars;
  const pairs: string[] = [];
  for (let i = 0; i < chars.length - 1; i += 1) pairs.push(chars[i] + chars[i + 1]);
  return pairs;
}

const ARABIC_LETTER = /[\u0621-\u064A]/;
const ARABIC_PREFIXES = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال'];
const ARABIC_SUFFIXES = ['ات', 'ون', 'ين', 'ها', 'ي', 'ه'];

/**
 * Light stemming: strip the most common affixes so that inflected forms meet.
 * Deliberately conservative — a stemmer that is too eager merges unrelated
 * words, which is worse for retrieval than missing a match.
 *
 *   English: plural / third-person "s"  (costs → cost, notes → note)
 *   Arabic:  the article and a few clitics, then plural and pronoun suffixes
 *            (الملاحظات / ملاحظاتي / ملاحظة → ملاحظ)
 */
export function stem(token: string): string {
  if (ARABIC_LETTER.test(token)) {
    let word = token;
    for (const prefix of ARABIC_PREFIXES) {
      if (word.startsWith(prefix) && word.length - prefix.length >= 3) {
        word = word.slice(prefix.length);
        break;
      }
    }
    // Up to two suffixes, so ملاحظاتي loses both ي and ات.
    for (let pass = 0; pass < 2; pass += 1) {
      const suffix = ARABIC_SUFFIXES.find(
        (s) => word.endsWith(s) && word.length - s.length >= 3,
      );
      if (!suffix) break;
      word = word.slice(0, -suffix.length);
    }
    return word;
  }
  if (/^[a-z]+$/.test(token) && token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

export function tokenize(text: string): string[] {
  const spaced = normalize(text).replace(HAN_RUN, (run) => ` ${run} `);
  const tokens: string[] = [];
  for (const piece of spaced.split(/[^\p{L}\p{N}]+/u)) {
    if (piece.length === 0) continue;
    if (HAN.test(piece)) tokens.push(...hanTokens(piece));
    else tokens.push(piece);
  }
  // Stopwords are checked before stemming, against the word as written.
  return tokens.filter((token) => !STOPWORDS.has(token)).map(stem);
}

interface IndexedDoc {
  doc: SourceDoc;
  termFreq: Map<string, number>;
  length: number;
}

export interface SearchOptions {
  topK?: number;
  /** Absolute floor; pass 0 to disable (the hybrid retriever does its own gating). */
  minScore?: number;
  relativeCutoff?: number;
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

  /** Score every document, best first, with no cut-off applied. */
  rank(query: string): Retrieved[] {
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

    return scored.filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  }

  search(query: string, topKOrOptions: number | SearchOptions = 3): Retrieved[] {
    const options =
      typeof topKOrOptions === 'number' ? { topK: topKOrOptions } : topKOrOptions;
    const { topK = 3, minScore = MIN_SCORE, relativeCutoff = RELATIVE_CUTOFF } = options;

    const ranked = this.rank(query);
    if (ranked.length === 0) return [];
    const best = ranked[0].score;
    return ranked
      .filter((entry) => entry.score >= minScore && entry.score >= best * relativeCutoff)
      .slice(0, topK);
  }
}
