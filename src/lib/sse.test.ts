import { describe, expect, it } from 'vitest';
import { createSseParser, type SseEvent } from './sse';

function collect(chunks: string[]): SseEvent[] {
  const events: SseEvent[] = [];
  const parser = createSseParser((e) => events.push(e));
  for (const chunk of chunks) parser.push(chunk);
  parser.flush();
  return events;
}

describe('createSseParser', () => {
  it('parses a single well-formed event', () => {
    expect(collect(['data: hello\n\n'])).toEqual([
      { event: undefined, data: 'hello', id: undefined },
    ]);
  });

  it('reassembles an event split across chunk boundaries', () => {
    // This is the case that matters: ReadableStream chunks do not respect
    // SSE framing, so a single event routinely arrives in pieces.
    expect(collect(['da', 'ta: hel', 'lo\n', '\n'])).toEqual([
      { event: undefined, data: 'hello', id: undefined },
    ]);
  });

  it('joins multiple data lines with a newline', () => {
    expect(collect(['data: line one\ndata: line two\n\n'])[0].data).toBe(
      'line one\nline two',
    );
  });

  it('handles CRLF line endings', () => {
    expect(collect(['data: hello\r\n\r\n'])[0].data).toBe('hello');
  });

  it('ignores comment lines used as keep-alives', () => {
    expect(collect([': ping\n\ndata: real\n\n'])).toHaveLength(1);
  });

  it('reads event and id fields', () => {
    const [event] = collect(['event: token\nid: 7\ndata: x\n\n']);
    expect(event).toEqual({ event: 'token', data: 'x', id: '7' });
  });

  it('strips exactly one leading space after the colon', () => {
    expect(collect(['data:  two spaces\n\n'])[0].data).toBe(' two spaces');
  });

  it('treats a field with no colon as an empty value', () => {
    expect(collect(['data\n\n'])[0].data).toBe('');
  });

  it('does not emit an event for a blank line with no data', () => {
    expect(collect(['\n\n\n'])).toEqual([]);
  });

  it('flushes a trailing event that was never terminated', () => {
    // Servers that close without a final blank line would otherwise lose
    // the last token.
    expect(collect(['data: last'])).toEqual([
      { event: undefined, data: 'last', id: undefined },
    ]);
  });

  it('emits a stream of events in order', () => {
    const events = collect(['data: a\n\ndata: b\n\ndata: c\n\n']);
    expect(events.map((e) => e.data)).toEqual(['a', 'b', 'c']);
  });

  it('resets the event name between events', () => {
    const events = collect(['event: first\ndata: a\n\ndata: b\n\n']);
    expect(events[1].event).toBeUndefined();
  });
});
