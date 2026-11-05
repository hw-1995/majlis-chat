import { describe, expect, it } from 'vitest';
import { Bm25Index, normalize, stem, tokenize } from './bm25';
import { CORPUS } from '../data/corpus';
import type { SourceDoc } from '../types';

const docs: SourceDoc[] = [
  { id: 'a', title: 'Refunds', text: 'A first payment can be refunded within thirty days', lang: 'en' },
  { id: 'b', title: 'Passwords', text: 'Reset your password from the sign-in page', lang: 'en' },
  { id: 'c', title: 'Storage', text: 'Each plan includes storage for attachments', lang: 'en' },
];

describe('normalize', () => {
  it('lowercases Latin text', () => {
    expect(normalize('Offline MODE')).toBe('offline mode');
  });

  it('strips Arabic diacritics', () => {
    expect(normalize('مَلْعَب')).toBe('ملعب');
  });

  it('folds alef variants, alef maqsura and ta marbuta', () => {
    expect(normalize('أحمد')).toBe('احمد');
    expect(normalize('إسم')).toBe('اسم');
    expect(normalize('مستوى')).toBe('مستوي');
    expect(normalize('ملاحظة')).toBe('ملاحظه');
  });

  it('turns full-width Latin and digits into ordinary ones', () => {
    expect(normalize('ＡＰＩ ６０')).toBe('api 60');
  });
});

describe('stem', () => {
  it('drops an English plural s but not a double s', () => {
    expect(stem('costs')).toBe('cost');
    expect(stem('notes')).toBe('note');
    expect(stem('access')).toBe('access');
    expect(stem('is')).toBe('is');
  });

  it('brings Arabic inflections of one word together', () => {
    const forms = ['ملاحظاتي', 'الملاحظات', 'ملاحظه'];
    expect(new Set(forms.map(stem))).toEqual(new Set(['ملاحظ']));
  });

  it('never cuts an Arabic word below three letters', () => {
    expect(stem('الي')).toBe('الي');
  });
});

describe('tokenize', () => {
  it('splits on punctuation and removes stopwords', () => {
    expect(tokenize('How do I reset my password?')).toEqual(['reset', 'password']);
  });

  it('keeps digits', () => {
    expect(tokenize('60 requests')).toEqual(['60', 'request']);
  });

  it('turns Chinese into overlapping character pairs', () => {
    expect(tokenize('重置密码')).toEqual(['重置', '置密', '密码']);
  });

  it('separates Chinese from embedded Latin words', () => {
    expect(tokenize('API限流')).toEqual(['api', '限流']);
  });

  it('drops Chinese question words', () => {
    expect(tokenize('什么')).toEqual([]);
  });

  it('removes Arabic stopwords in their normalized form', () => {
    expect(tokenize('كيف أعيد')).toEqual(['اعيد']);
  });

  it('leaves nothing for a question made only of stopwords', () => {
    expect(tokenize('What is this')).toEqual([]);
    expect(tokenize('ما هذا')).toEqual([]);
  });
});

describe('Bm25Index', () => {
  it('ranks the document containing the query term first', () => {
    // A three-document index produces small scores, so the floor is lifted here.
    expect(new Bm25Index(docs).search('password', { minScore: 0 })[0].doc.id).toBe('b');
  });

  it('returns nothing for a term absent from the corpus', () => {
    expect(new Bm25Index(docs).search('basketball')).toEqual([]);
  });

  it('returns nothing for an empty or stopword-only query', () => {
    expect(new Bm25Index(docs).search('   ')).toEqual([]);
    expect(new Bm25Index(docs).search('what is this')).toEqual([]);
  });

  it('respects topK', () => {
    const results = new Bm25Index(docs).search('refunded password storage', {
      topK: 2,
      minScore: 0,
      relativeCutoff: 0,
    });
    expect(results).toHaveLength(2);
  });

  it('scores in descending order', () => {
    const scores = new Bm25Index(CORPUS).rank('export notes pdf').map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('drops weak matches below the absolute floor', () => {
    // "pro" appears in many articles, so on its own it scores low everywhere.
    const index = new Bm25Index(CORPUS);
    expect(index.rank('pro').length).toBeGreaterThan(0);
    expect(index.search('pro')).toEqual([]);
  });

  it('handles an empty index', () => {
    expect(new Bm25Index([]).search('anything')).toEqual([]);
  });
});

describe('retrieval over the demo corpus', () => {
  const index = new Bm25Index(CORPUS);
  const top = (query: string): string | undefined => index.search(query)[0]?.doc.id;

  it('answers English questions from the English article', () => {
    expect(top('How do I reset my password?')).toBe('password-en');
    expect(top('How much does Pro cost?')).toBe('plans-en');
  });

  it('answers Chinese questions from the Chinese article', () => {
    expect(top('怎么重置密码')).toBe('password-zh');
    expect(top('注销账号以后还能恢复吗')).toBe('deleteAccount-zh');
  });

  it('answers Arabic questions from the Arabic article', () => {
    expect(top('كيف أعيد تعيين كلمة المرور؟')).toBe('password-ar');
    expect(top('تصدير الملاحظات')).toBe('export-ar');
  });

  it('finds nothing for questions the knowledge base does not cover', () => {
    expect(index.search('Who won the 2022 World Cup?')).toEqual([]);
    expect(index.search('怎样才能快速致富')).toEqual([]);
    expect(index.search('What is this')).toEqual([]);
  });
});
