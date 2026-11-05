import type { Bm25Index } from '../lib/bm25';
import { detectLang } from '../lib/mockAnswer';
import type { SourceDoc } from '../types';
import type { MatchKind } from './types';
import type { VectorHit, VectorIndex } from './vectorIndex';

/**
 * Hybrid retrieval: keyword search (BM25) and semantic search (embeddings),
 * fused with Reciprocal Rank Fusion.
 *
 * Why both. BM25 is exact about rare words — a product name, an error code,
 * "2FA" — but misses paraphrase: "多少钱" shares no characters with "价格".
 * Embeddings catch paraphrase and even cross-language matches, but are vague
 * about exact terms and score everything as somewhat similar. Each covers the
 * other's blind spot.
 *
 * Why RRF. The two scores are on unrelated scales (BM25 is unbounded, cosine
 * sits in a narrow band near 0.8 for this model), so adding them is
 * meaningless. RRF ignores the scores and uses only positions:
 *   fused(d) = Σ 1 / (k + rank_i(d))
 * A document near the top of either list rises; one near the top of both
 * rises most. k = 60 is the constant from the original paper and damps the
 * difference between rank 1 and rank 2.
 */

export const RRF_K = 60;

/**
 * Semantic hits are only trusted above an absolute floor and close to the best
 * hit. Embedding models never say "nothing matches" — an unrelated question
 * still gets a nearest neighbour — so without a floor every off-topic question
 * would come back with confident-looking sources. These values suit
 * multilingual-e5-small and are a starting point to tune against real queries.
 */
export const SEMANTIC_MIN_SCORE = 0.82;
export const SEMANTIC_MARGIN = 0.04;

export interface HybridHit {
  doc: SourceDoc;
  score: number;
  match: MatchKind[];
}

export function rrf(lists: { kind: MatchKind; docs: SourceDoc[] }[], k = RRF_K): HybridHit[] {
  const fused = new Map<string, HybridHit>();
  for (const { kind, docs } of lists) {
    docs.forEach((doc, rank) => {
      const hit = fused.get(doc.id) ?? { doc, score: 0, match: [] };
      hit.score += 1 / (k + rank + 1);
      if (!hit.match.includes(kind)) hit.match.push(kind);
      fused.set(doc.id, hit);
    });
  }
  return [...fused.values()].sort((a, b) => b.score - a.score);
}

export function trustedSemantic(hits: VectorHit[], minScore = SEMANTIC_MIN_SCORE, margin = SEMANTIC_MARGIN): SourceDoc[] {
  if (hits.length === 0 || hits[0].score < minScore) return [];
  const best = hits[0].score;
  return hits.filter((h) => h.score >= minScore && h.score >= best - margin).map((h) => h.doc);
}

/**
 * Semantic search finds an article in any language, so one topic can arrive
 * as its English, Chinese and Arabic versions at once. Keep one per topic,
 * preferring the reader's language, so the model gets three different
 * articles rather than one article three times.
 */
export function onePerTopic(hits: HybridHit[], lang: SourceDoc['lang']): HybridHit[] {
  const byTopic = new Map<string, HybridHit>();
  const order: string[] = [];
  for (const hit of hits) {
    const topic = hit.doc.topic ?? hit.doc.id;
    const current = byTopic.get(topic);
    if (!current) {
      byTopic.set(topic, { ...hit, match: [...hit.match] });
      order.push(topic);
      continue;
    }
    current.score += hit.score;
    for (const m of hit.match) if (!current.match.includes(m)) current.match.push(m);
    if (current.doc.lang !== lang && hit.doc.lang === lang) current.doc = hit.doc;
  }
  return order.map((t) => byTopic.get(t) as HybridHit).sort((a, b) => b.score - a.score);
}

export async function hybridSearch(
  query: string,
  bm25: Bm25Index,
  vectors: VectorIndex,
  topK = 3,
): Promise<HybridHit[]> {
  const keyword = bm25.search(query, 10).map((r) => r.doc);
  const semantic = trustedSemantic(await vectors.rank(query));
  const fused = rrf([
    { kind: 'keyword', docs: keyword },
    { kind: 'semantic', docs: semantic },
  ]);
  return onePerTopic(fused, detectLang(query)).slice(0, topK);
}
