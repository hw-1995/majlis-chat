import { describe, expect, it } from 'vitest';
import { runAgent } from './runAgent';
import { TOOL_SPECS } from './tools';
import type { Provider, ProviderRequest } from '../gateway/types';
import type { StreamEvent, ToolStep } from '../types';

/** A provider that answers each round from a script and records what it was asked. */
function scripted(rounds: ((req: ProviderRequest, on: (e: StreamEvent) => void) => void)[]) {
  const requests: ProviderRequest[] = [];
  const provider: Provider = {
    id: 'test',
    supportsResume: false,
    async stream(req, on) {
      requests.push({ ...req, turns: [...req.turns] });
      const round = rounds[Math.min(requests.length - 1, rounds.length - 1)];
      round(req, on);
    },
  };
  return { provider, requests };
}

const callTool = (name: string, args: object) => (_r: ProviderRequest, on: (e: StreamEvent) => void) => {
  on({ type: 'tool_call', id: `call_${name}`, name, arguments: JSON.stringify(args) });
  on({ type: 'done' });
};
const say = (text: string) => (_r: ProviderRequest, on: (e: StreamEvent) => void) => {
  on({ type: 'token', value: text });
  on({ type: 'done' });
};

const base = {
  turns: [{ role: 'user' as const, content: 'How much is Team for 5 people for a year?' }],
  sources: [],
  signal: new AbortController().signal,
};

describe('runAgent', () => {
  it('runs the requested tool and feeds the result back', async () => {
    const { provider, requests } = scripted([
      callTool('estimate_cost', { plan: 'team', seats: 5, months: 12, billing: 'yearly' }),
      say('That is $600 a year.'),
    ]);
    const tokens: string[] = [];
    const steps: ToolStep[] = [];
    const result = await runAgent({
      ...base,
      provider,
      tools: TOOL_SPECS,
      onToken: (t) => tokens.push(t),
      onStep: (s) => steps.push(s),
    });

    expect(result.text).toBe('That is $600 a year.');
    expect(result.steps).toHaveLength(1);
    expect(JSON.parse(result.steps[0].result ?? '')).toMatchObject({ total_usd: 600 });
    expect(steps.map((s) => s.status)).toEqual(['running', 'done']);

    // Round two sees the assistant's call and the tool's answer, linked by id.
    const second = requests[1].turns;
    expect(second.at(-2)).toMatchObject({ role: 'assistant', toolCalls: [{ id: 'call_estimate_cost' }] });
    expect(second.at(-1)).toMatchObject({ role: 'tool', toolCallId: 'call_estimate_cost', name: 'estimate_cost' });
  });

  it('marks a failing tool as an error but keeps going', async () => {
    const { provider } = scripted([callTool('calculate', { expression: '1/0' }), say('Cannot divide by zero.')]);
    const result = await runAgent({ ...base, provider, tools: TOOL_SPECS, onToken: () => {} });
    expect(result.steps[0].status).toBe('error');
    expect(result.text).toBe('Cannot divide by zero.');
  });

  it('withholds tools on the last step so a looping model must answer', async () => {
    const { provider, requests } = scripted([callTool('calculate', { expression: '1+1' })]);
    await runAgent({ ...base, provider, tools: TOOL_SPECS, maxSteps: 3, onToken: () => {} });
    expect(requests).toHaveLength(3);
    expect(requests.map((r) => r.tools?.length ?? 0)).toEqual([3, 3, 0]);
  });

  it('separates text written before and after a tool round', async () => {
    const { provider } = scripted([
      (_r, on) => {
        on({ type: 'token', value: 'Let me check.' });
        on({ type: 'tool_call', id: 'c1', name: 'calculate', arguments: '{"expression":"2*3"}' });
        on({ type: 'done' });
      },
      say('It is 6.'),
    ]);
    const tokens: string[] = [];
    const result = await runAgent({ ...base, provider, tools: TOOL_SPECS, onToken: (t) => tokens.push(t) });
    expect(result.text).toBe('Let me check.\nIt is 6.');
    expect(tokens.join('')).toBe(result.text);
  });

  it('sends no tools at all when none are enabled', async () => {
    const { provider, requests } = scripted([say('Plain answer.')]);
    await runAgent({ ...base, provider, onToken: () => {} });
    expect(requests[0].tools).toBeUndefined();
  });
});
