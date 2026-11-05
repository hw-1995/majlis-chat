import { describe, expect, it } from 'vitest';
import { CORPUS } from '../data/corpus';
import { Bm25Index } from '../lib/bm25';
import type { SourceDoc } from '../types';
import { hybridSearch, onePerTopic, rrf, trustedSemantic } from './hybrid';
import type { Embedder } from './types';
import { cosine, VectorIndex } from './vectorIndex';

/**
 * A stand-in for a real embedding model: each dimension is a "concept" that
 * several words in several languages map to. Enough to show that semantic
 * search matches by meaning where keyword search cannot.
 */
const CONCEPTS: RegExp[] = [
  /price|pricing|cost|多少钱|价格|费用|美元|سعر|أسعار|تكلف|دولار/i,
  /password|密码|كلمة المرور/i,
  /refund|退款|استرداد/i,
  /export|导出|تصدير/i,
];
const stub: Embedder = {
  id: 'stub',
  async embed(texts, kind) {
    return texts.map((text) => {
      const v = new Float32Array(CONCEPTS.length + 2);
      CONCEPTS.forEach((re, i) => {
        if (re.test(text)) v[i] = 1;
      });
      v[CONCEPTS.length] = 0.3; // every text is a little alike, as with real models
      // A question about none of these concepts points somewhere else entirely.
      if (kind === 'query' && v.slice(0, CONCEPTS.length).every((x) => x === 0)) v[CONCEPTS.length + 1] = 1;
      return v;
    });
  },
};

const doc = (id: string, lang: SourceDoc['lang'] = 'en', topic = id): SourceDoc => ({ id, title: id, text: '', lang, topic });

describe('rrf', () => {
  it('rewards documents found by both retrievers', () => {
    const fused = rrf([
      { kind: 'keyword', docs: [doc('a'), doc('b')] },
      { kind: 'semantic', docs: [doc('b'), doc('c')] },
    ]);
    expect(fused[0].doc.id).toBe('b');
    expect(fused[0].match).toEqual(['keyword', 'semantic']);
    expect(fused.map((h) => h.doc.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('trustedSemantic', () => {
  it('returns nothing when even the best match is weak', () => {
    expect(trustedSemantic([{ doc: doc('a'), score: 0.7 }])).toEqual([]);
  });

  it('keeps only hits close to the best one', () => {
    const hits = [
      { doc: doc('a'), score: 0.9 },
      { doc: doc('b'), score: 0.88 },
      { doc: doc('c'), score: 0.83 },
    ];
    expect(trustedSemantic(hits).map((d) => d.id)).toEqual(['a', 'b']);
  });
});

describe('onePerTopic', () => {
  it('keeps one article per topic, in the reader’s language', () => {
    const fused = rrf([
      { kind: 'semantic', docs: [doc('plans-en', 'en', 'plans'), doc('plans-zh', 'zh', 'plans'), doc('trial-zh', 'zh', 'trial')] },
    ]);
    const result = onePerTopic(fused, 'zh');
    expect(result.map((h) => h.doc.id)).toEqual(['plans-zh', 'trial-zh']);
  });
});

describe('cosine', () => {
  it('is 1 for the same direction and 0 for orthogonal or empty vectors', () => {
    expect(cosine(Float32Array.from([1, 2]), Float32Array.from([2, 4]))).toBeCloseTo(1);
    expect(cosine(Float32Array.from([1, 0]), Float32Array.from([0, 1]))).toBe(0);
    expect(cosine(Float32Array.from([0, 0]), Float32Array.from([1, 1]))).toBe(0);
  });
});

describe('hybridSearch', () => {
  const bm25 = new Bm25Index(CORPUS);

  it('finds by meaning what keyword search misses', async () => {
    const vectors = await VectorIndex.build(stub, CORPUS);
    // "费用" (fee) does not appear in the Chinese pricing article.
    const question = '费用';
    expect(bm25.search(question, 3).map((r) => r.doc.topic)).not.toContain('plans');
    const hits = await hybridSearch(question, bm25, vectors);
    expect(hits[0].doc.id).toBe('plans-zh');
    expect(hits[0].match).toContain('semantic');
  });

  it('still declines an off-topic question', async () => {
    const vectors = await VectorIndex.build(stub, CORPUS);
    expect(await hybridSearch('Who won the 2022 World Cup?', bm25, vectors)).toEqual([]);
  });
});
