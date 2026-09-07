import type { Message } from '../types';

/**
 * Context-window budgeting.
 *
 * A chat UI cannot simply concatenate every turn forever: the request grows
 * without bound, cost grows with it, and eventually the provider rejects the
 * call. This module decides what to keep.
 *
 * The estimator is deliberately a heuristic rather than a real tokenizer —
 * shipping a tokenizer to the browser costs far more bytes than the accuracy
 * is worth for a budget check. It is intentionally conservative (it
 * over-estimates) so we trim early rather than getting a 400 back.
 */

/**
 * Rough tokens-per-character ratios. Latin text averages ~4 characters per
 * token; CJK and Arabic script are far denser per character, so they are
 * counted closer to one token per character.
 */
const DENSE_SCRIPT = /[؀-ۿ一-鿿぀-ヿ]/u;

export function estimateTokens(text: string): number {
  let dense = 0;
  for (const char of text) {
    if (DENSE_SCRIPT.test(char)) dense += 1;
  }
  const latin = text.length - dense;
  return Math.ceil(latin / 4 + dense);
}

export function estimateMessageTokens(message: Message): number {
  // +4 approximates the per-message role/delimiter overhead most providers add.
  return estimateTokens(message.content) + 4;
}

export interface TrimResult {
  kept: Message[];
  dropped: number;
  estimatedTokens: number;
}

/**
 * Keep the conversation under `budget` tokens.
 *
 * System messages are pinned — they carry the instructions, so dropping them
 * changes the assistant's behaviour silently. Everything else is kept newest
 * first, and the most recent message always survives even if it alone blows
 * the budget: sending a truncated conversation is recoverable, sending an
 * empty one is not.
 */
export function trimToBudget(messages: Message[], budget: number): TrimResult {
  const system = messages.filter((m) => m.role === 'system');
  const rest = messages.filter((m) => m.role !== 'system');

  let used = system.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
  const kept: Message[] = [];

  for (let i = rest.length - 1; i >= 0; i -= 1) {
    const cost = estimateMessageTokens(rest[i]);
    const isMostRecent = i === rest.length - 1;
    if (!isMostRecent && used + cost > budget) break;
    kept.unshift(rest[i]);
    used += cost;
  }

  return {
    kept: [...system, ...kept],
    dropped: rest.length - kept.length,
    estimatedTokens: used,
  };
}
