import { describe, expect, it } from 'vitest';
import { composeAnswer, detectLang, pickMockTool, planMockReply, toTokens } from './mockAnswer';
import { executeTool } from '../agent/tools';

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

describe('pickMockTool', () => {
  it('routes price questions to estimate_cost in every language', () => {
    for (const q of [
      'What would Team cost for 5 people for a year?',
      '团队版 5 个人用一年多少钱',
      'كم تكلفة خطة Team لـ 5 أعضاء لمدة سنة؟',
    ]) {
      const tool = pickMockTool(q);
      expect(tool?.name).toBe('estimate_cost');
      expect(JSON.parse(tool?.arguments ?? '')).toEqual({ plan: 'team', seats: 5, months: 12, billing: 'yearly' });
    }
  });

  it('routes arithmetic and time questions, and leaves the rest alone', () => {
    expect(pickMockTool('what is 12 * (3 + 4)?')?.name).toBe('calculate');
    expect(pickMockTool('现在几点')?.name).toBe('get_current_time');
    expect(pickMockTool('How do I reset my password?')).toBeNull();
  });
});

describe('planMockReply with tools', () => {
  const question = { role: 'user' as const, content: '团队版 5 个人用一年多少钱' };

  it('asks for a tool only when tools are enabled', () => {
    expect(planMockReply([question], [], true).kind).toBe('tool_call');
    expect(planMockReply([question], [], false).kind).toBe('text');
  });

  it('answers from the tool result once it is in the conversation', () => {
    const call = planMockReply([question], [], true);
    if (call.kind !== 'tool_call') throw new Error('expected a tool call');
    const output = executeTool(call.name, call.arguments);
    const reply = planMockReply(
      [question, { role: 'assistant', content: '' }, { role: 'tool', content: output, name: call.name }],
      [{ title: '价格', text: '专业版每人每月 8 美元。' }],
      true,
    );
    expect(reply.kind).toBe('text');
    if (reply.kind === 'text') {
      expect(reply.text).toContain('600');
      expect(reply.text).toContain('[1]');
    }
  });
});
