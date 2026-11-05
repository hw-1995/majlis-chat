import { describe, expect, it } from 'vitest';
import { currentTime, estimateCost, executeTool, TOOL_SPECS } from './tools';

describe('estimateCost', () => {
  it('prices monthly billing per seat per month', () => {
    expect(estimateCost({ plan: 'pro', months: 3 }).total_usd).toBe(24);
    expect(estimateCost({ plan: 'team', seats: 5 }).total_usd).toBe(60);
  });

  it('charges 10 months for every 12 on yearly billing, in whole years', () => {
    const year = estimateCost({ plan: 'team', seats: 5, months: 12, billing: 'yearly' });
    expect(year).toMatchObject({ months_charged: 10, total_usd: 600 });
    const partial = estimateCost({ plan: 'pro', months: 14, billing: 'yearly' });
    expect(partial).toMatchObject({ months: 24, months_charged: 20, total_usd: 160 });
  });

  it('validates its arguments', () => {
    expect(() => estimateCost({ plan: 'gold' })).toThrow(/plan/);
    expect(() => estimateCost({ plan: 'team', seats: 0 })).toThrow(/seats/);
    expect(() => estimateCost({ plan: 'team', seats: 2.5 })).toThrow(/seats/);
  });
});

describe('currentTime', () => {
  it('formats in the requested zone', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const result = currentTime({ timezone: 'Asia/Dubai' }, now);
    expect(result.iso_utc).toBe('2026-01-01T00:00:00.000Z');
    expect(result.local).toMatch(/04:00/);
  });
});

describe('executeTool', () => {
  it('returns JSON for every outcome, errors included', () => {
    expect(JSON.parse(executeTool('calculate', '{"expression":"6*7"}'))).toEqual({
      expression: '6*7',
      result: 42,
    });
    expect(JSON.parse(executeTool('calculate', '{"expression":"6*"}')).error).toBeDefined();
    expect(JSON.parse(executeTool('nope', '{}')).error).toMatch(/Unknown tool/);
    expect(JSON.parse(executeTool('estimate_cost', 'not json')).error).toBeDefined();
    expect(JSON.parse(executeTool('estimate_cost', '[1]')).error).toMatch(/object/);
    expect(JSON.parse(executeTool('get_current_time', '{"timezone":"Mars/Base"}')).error).toBeDefined();
  });

  it('has a spec for every tool it runs', () => {
    expect(TOOL_SPECS.map((t) => t.name).sort()).toEqual(['calculate', 'estimate_cost', 'get_current_time']);
  });
});
