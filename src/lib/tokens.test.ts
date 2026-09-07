import { describe, expect, it } from 'vitest';
import { estimateTokens, trimToBudget } from './tokens';
import type { Message } from '../types';

const msg = (id: string, role: Message['role'], content: string): Message => ({
  id,
  role,
  content,
});

describe('estimateTokens', () => {
  it('counts Latin text at roughly four characters per token', () => {
    expect(estimateTokens('abcdefgh')).toBe(2);
  });

  it('counts Arabic closer to one token per character', () => {
    expect(estimateTokens('مرحبا')).toBe(5);
  });

  it('is zero for empty text', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('never under-counts a mixed string', () => {
    const mixed = 'hello مرحبا';
    expect(estimateTokens(mixed)).toBeGreaterThanOrEqual(estimateTokens('hello'));
  });
});

describe('trimToBudget', () => {
  it('keeps everything when it fits', () => {
    const messages = [msg('1', 'user', 'hi'), msg('2', 'assistant', 'hello')];
    const result = trimToBudget(messages, 1000);
    expect(result.kept).toHaveLength(2);
    expect(result.dropped).toBe(0);
  });

  it('drops the oldest turns first', () => {
    const messages = [
      msg('1', 'user', 'x'.repeat(400)),
      msg('2', 'assistant', 'y'.repeat(400)),
      msg('3', 'user', 'recent'),
    ];
    // Budget 50: the recent turn costs ~6, each 400-char turn ~104.
    const result = trimToBudget(messages, 50);
    expect(result.kept.map((m) => m.id)).toEqual(['3']);
    expect(result.dropped).toBe(2);
  });

  it('always pins system messages', () => {
    const messages = [
      msg('sys', 'system', 'You are helpful'),
      msg('1', 'user', 'x'.repeat(4000)),
      msg('2', 'user', 'latest'),
    ];
    const result = trimToBudget(messages, 50);
    expect(result.kept[0].id).toBe('sys');
  });

  it('keeps the most recent message even when it alone exceeds the budget', () => {
    // Sending a truncated conversation is recoverable; sending none is not.
    const messages = [msg('1', 'user', 'x'.repeat(10000))];
    expect(trimToBudget(messages, 10).kept).toHaveLength(1);
  });

  it('handles an empty conversation', () => {
    expect(trimToBudget([], 100)).toEqual({ kept: [], dropped: 0, estimatedTokens: 0 });
  });
});
