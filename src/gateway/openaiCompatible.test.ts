import { describe, expect, it } from 'vitest';
import {
  createOpenAiAccumulator,
  endpoint,
  toOpenAiMessages,
  toOpenAiTools,
} from './openaiCompatible';
import type { StreamEvent } from '../types';

const chunk = (delta: object, finish: string | null = null): string =>
  JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finish }] });

function run(payloads: string[]): StreamEvent[] {
  const acc = createOpenAiAccumulator();
  const events = payloads.flatMap((p) => acc.push(p));
  return [...events, ...acc.end()];
}

describe('createOpenAiAccumulator', () => {
  it('turns content deltas into tokens and [DONE] into done', () => {
    expect(run([chunk({ role: 'assistant', content: '' }), chunk({ content: 'Hel' }), chunk({ content: 'lo' }), '[DONE]'])).toEqual([
      { type: 'token', value: 'Hel' },
      { type: 'token', value: 'lo' },
      { type: 'done' },
    ]);
  });

  it('reassembles tool-call arguments that arrive in fragments', () => {
    const events = run([
      chunk({ tool_calls: [{ index: 0, id: 'call_1', function: { name: 'calculate', arguments: '' } }] }),
      chunk({ tool_calls: [{ index: 0, function: { arguments: '{"expr' } }] }),
      chunk({ tool_calls: [{ index: 0, function: { arguments: 'ession":"2*3"}' } }] }),
      chunk({}, 'tool_calls'),
      '[DONE]',
    ]);
    expect(events).toEqual([
      { type: 'tool_call', id: 'call_1', name: 'calculate', arguments: '{"expression":"2*3"}' },
      { type: 'done' },
    ]);
  });

  it('keeps parallel tool calls apart and in order', () => {
    const events = run([
      chunk({ tool_calls: [{ index: 1, id: 'b', function: { name: 'get_current_time', arguments: '{}' } }] }),
      chunk({ tool_calls: [{ index: 0, id: 'a', function: { name: 'calculate', arguments: '{"expression":"1"}' } }] }),
      chunk({}, 'tool_calls'),
      '[DONE]',
    ]);
    expect(events.filter((e) => e.type === 'tool_call').map((e) => (e as { id: string }).id)).toEqual(['a', 'b']);
  });

  it('accepts a finish_reason in place of a missing [DONE]', () => {
    expect(run([chunk({ content: 'ok' }), chunk({}, 'stop')]).at(-1)).toEqual({ type: 'done' });
  });

  it('throws when the stream stops without finishing', () => {
    const acc = createOpenAiAccumulator();
    acc.push(chunk({ content: 'half an ans' }));
    expect(() => acc.end()).toThrow('Stream ended before completion');
  });

  it('surfaces an error object sent inside the stream', () => {
    const acc = createOpenAiAccumulator();
    expect(() => acc.push(JSON.stringify({ error: { message: 'quota exceeded' } }))).toThrow('quota exceeded');
  });

  it('ignores payloads that are not JSON', () => {
    expect(createOpenAiAccumulator().push(': keep-alive')).toEqual([]);
  });

  it('emits done only once', () => {
    const acc = createOpenAiAccumulator();
    expect(acc.push('[DONE]')).toEqual([{ type: 'done' }]);
    expect(acc.end()).toEqual([]);
  });
});

describe('request mapping', () => {
  it('maps tool calls and tool results to the Chat Completions shape', () => {
    const mapped = toOpenAiMessages([
      { role: 'user', content: 'cost?' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'estimate_cost', arguments: '{}' }] },
      { role: 'tool', content: '{"total":96}', toolCallId: 'c1', name: 'estimate_cost' },
    ]);
    expect(mapped).toEqual([
      { role: 'user', content: 'cost?' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'c1', type: 'function', function: { name: 'estimate_cost', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'c1', content: '{"total":96}' },
    ]);
  });

  it('wraps tool specs as functions', () => {
    expect(toOpenAiTools([{ name: 'x', description: 'd', parameters: { type: 'object' } }])).toEqual([
      { type: 'function', function: { name: 'x', description: 'd', parameters: { type: 'object' } } },
    ]);
  });

  it('joins base URL and path with exactly one slash', () => {
    expect(endpoint('https://api.deepseek.com', 'chat/completions')).toBe('https://api.deepseek.com/chat/completions');
    expect(endpoint('https://api.openai.com/v1/', '/chat/completions')).toBe('https://api.openai.com/v1/chat/completions');
  });
});
