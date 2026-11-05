import { describe, expect, it } from 'vitest';
import { composeAnswer, detectLang, toTokens } from './mockAnswer';

const source = { title: 'Refunds', text: 'A first payment can be refunded within 30 days. More detail.' };

describe('detectLang', () => {
  it('recognises Arabic, Chinese and English', () => {
    expect(detectLang('كيف أعيد')).toBe('ar');
    expect(detectLang('怎么退款')).toBe('zh');
    expect(detectLang('how do refunds work')).toBe('en');
  });
});

describe('composeAnswer', () => {
  it('cites each source by number', () => {
    const answer = composeAnswer('refund?', [source]);
    expect(answer).toContain('A first payment can be refunded within 30 days [1]');
  });

  it('declines instead of improvising when nothing was retrieved', () => {
    expect(composeAnswer('who won the cup', [])).toContain("doesn't cover that question");
    expect(composeAnswer('怎样才能快速致富', [])).toContain('知识库里没有');
  });

  it('answers in the language of the question', () => {
    expect(composeAnswer('可以退款吗', [source])).toMatch(/^根据检索到的资料/);
  });
});

describe('toTokens', () => {
  it('reassembles to the original text', () => {
    for (const text of ['Hello there, world.', '根据资料：Qalam Notes 有三种套餐 [1]。', 'مرحبا بكم']) {
      expect(toTokens(text).join('')).toBe(text);
    }
  });

  it('streams Chinese in small pieces rather than whole sentences', () => {
    const tokens = toTokens('首次付款后三十天内可申请全额退款');
    expect(Math.max(...tokens.map((t) => t.length))).toBeLessThanOrEqual(2);
  });
});

describe('bestSentence', () => {
  it('quotes the sentence that matches the question, not just the first one', async () => {
    const { bestSentence } = await import('./mockAnswer');
    const text = 'Qalam Notes has three plans. Pro costs $8 per month for one person.';
    expect(bestSentence('How much does Pro cost?', text)).toBe('Pro costs $8 per month for one person');
  });
});
