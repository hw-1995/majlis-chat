import { describe, expect, it } from 'vitest';
import { Bm25Index, normalize, tokenize } from './bm25';
import type { SourceDoc } from '../types';

const docs: SourceDoc[] = [
  { id: 'a', title: 'Offside', text: 'A player is offside if nearer to the goal line', lang: 'en' },
  { id: 'b', title: 'Penalty', text: 'A penalty kick is taken from the penalty mark', lang: 'en' },
  { id: 'c', title: 'Extra time', text: 'Extra time is two periods of fifteen minutes', lang: 'en' },
];

describe('normalize', () => {
  it('lowercases Latin text', () => {
    expect(normalize('Offside RULE')).toBe('offside rule');
  });

  it('strips Arabic diacritics', () => {
    expect(normalize('مَلْعَب')).toBe('ملعب');
  });

  it('folds alef variants to a bare alef', () => {
    expect(normalize('أحمد')).toBe('احمد');
    expect(normalize('إسم')).toBe('اسم');
    expect(normalize('آخر')).toBe('اخر');
  });

  it('folds alef maqsura and ta marbuta', () => {
    expect(normalize('مرمى')).toBe('مرمي');
    expect(normalize('مباراة')).toBe('مباراه');
  });
});

describe('tokenize', () => {
  it('splits on punctuation and drops empties', () => {
    expect(tokenize('goal, kick; and — run')).toEqual(['goal', 'kick', 'and', 'run']);
  });

  it('keeps digits', () => {
    expect(tokenize('90 minutes')).toEqual(['90', 'minutes']);
  });

  it('tokenizes Arabic on whitespace', () => {
    expect(tokenize('ركلة جزاء')).toEqual(['ركله', 'جزاء']);
  });
});

describe('Bm25Index', () => {
  it('ranks the document containing the query term first', () => {
    const results = new Bm25Index(docs).search('penalty');
    expect(results[0].doc.id).toBe('b');
  });

  it('returns nothing for a term absent from the corpus', () => {
    expect(new Bm25Index(docs).search('basketball')).toEqual([]);
  });

  it('returns nothing for an empty query', () => {
    expect(new Bm25Index(docs).search('   ')).toEqual([]);
  });

  it('respects topK', () => {
    // "is" appears in every document, so all three match.
    expect(new Bm25Index(docs).search('is', 2)).toHaveLength(2);
  });

  it('scores in descending order', () => {
    const results = new Bm25Index(docs).search('penalty kick taken');
    const scores = results.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('gives a rare term more weight than a common one', () => {
    const index = new Bm25Index(docs);
    const rare = index.search('offside')[0].score;
    const common = index.search('is')[0].score;
    expect(rare).toBeGreaterThan(common);
  });

  it('matches Arabic across orthographic variation', () => {
    const arabic: SourceDoc[] = [
      { id: 'ar', title: 'ركلة الجزاء', text: 'تُنفَّذ ركلة الجزاء من علامة الجزاء', lang: 'ar' },
      { id: 'ar2', title: 'التسلل', text: 'يكون اللاعب متسللا إذا كان أقرب إلى خط المرمى', lang: 'ar' },
    ];
    // Query written without diacritics still reaches the diacritised source.
    const results = new Bm25Index(arabic).search('ركلة الجزاء');
    expect(results[0].doc.id).toBe('ar');
  });

  it('handles an empty index', () => {
    expect(new Bm25Index([]).search('anything')).toEqual([]);
  });
});
