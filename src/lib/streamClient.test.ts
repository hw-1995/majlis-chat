import { describe, expect, it, vi } from 'vitest';
import { streamTurn } from './streamClient';
import { ProviderError, type Provider, type ProviderRequest } from '../gateway/types';
import type { StreamEvent } from '../types';

/** A provider whose behaviour on each attempt is scripted by the test. */
function scripted(
  supportsResume: boolean,
  attempts: ((req: ProviderRequest, on: (e: StreamEvent) => void) => void)[],
): Provider & { requests: ProviderRequest[] } {
  const requests: ProviderRequest[] = [];
  return {
    id: 'test',
    supportsResume,
    requests,
    async stream(req, on) {
      requests.push(req);
      const attempt = attempts[requests.length - 1];
      attempt(req, on);
    },
  };
}

const base = { turns: [], signal: new AbortController().signal, onToken: () => {} };

describe('streamTurn', () => {
  it('returns the text and any tool calls', async () => {
    const provider = scripted(false, [
      (_r, on) => {
        on({ type: 'token', value: 'hi' });
        on({ type: 'tool_call', id: 'c', name: 'calculate', arguments: '{}' });
        on({ type: 'done' });
      },
    ]);
    const result = await streamTurn({ ...base, provider });
    expect(result).toEqual({ text: 'hi', toolCalls: [{ id: 'c', name: 'calculate', arguments: '{}' }] });
  });

  it('resumes from the partial text when the provider supports it', async () => {
    const provider = scripted(true, [
      (_r, on) => {
        on({ type: 'token', value: 'Hello ' });
        throw new Error('Stream ended before completion');
      },
      (_r, on) => {
        on({ type: 'token', value: 'world' });
        on({ type: 'done' });
      },
    ]);
    const result = await streamTurn({ ...base, provider });
    expect(provider.requests[1].resumeFrom).toBe('Hello ');
    expect(result.text).toBe('Hello world');
  }, 20000);

  it('restarts and clears the partial text when the provider cannot resume', async () => {
    const onReset = vi.fn();
    const provider = scripted(false, [
      (_r, on) => {
        on({ type: 'token', value: 'Hal' });
        throw new Error('dropped');
      },
      (_r, on) => {
        on({ type: 'token', value: 'Hello' });
        on({ type: 'done' });
      },
    ]);
    const result = await streamTurn({ ...base, provider, onReset });
    expect(provider.requests[1].resumeFrom).toBe('');
    expect(onReset).toHaveBeenCalledOnce();
    expect(result.text).toBe('Hello');
  }, 20000);

  it('does not retry an error that would fail the same way again', async () => {
    const provider = scripted(false, [
      () => {
        throw new ProviderError('auth', '401', false);
      },
    ]);
    await expect(streamTurn({ ...base, provider })).rejects.toThrow('401');
    expect(provider.requests).toHaveLength(1);
  });

  it('gives up after maxRetries', async () => {
    const fail = (): void => {
      throw new Error('dropped');
    };
    const provider = scripted(true, [fail, fail]);
    await expect(streamTurn({ ...base, provider, maxRetries: 1 })).rejects.toThrow('dropped');
    expect(provider.requests).toHaveLength(2);
  }, 20000);
});
