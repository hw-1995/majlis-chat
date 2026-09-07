/**
 * Incremental Server-Sent Events parser.
 *
 * Written by hand rather than using EventSource because EventSource can only
 * issue GET requests, and a chat turn has to POST the conversation body. The
 * parser is fed arbitrary chunk boundaries from a ReadableStream, so a single
 * SSE event may arrive split across several `push()` calls.
 *
 * Supports LF and CRLF line endings. Lone-CR (classic Mac) endings are not
 * supported; no SSE server in practice emits them.
 */
export interface SseEvent {
  event?: string;
  data: string;
  id?: string;
}

export interface SseParser {
  push(chunk: string): void;
  /** Flush a trailing event that was not terminated by a blank line. */
  flush(): void;
}

export function createSseParser(onEvent: (event: SseEvent) => void): SseParser {
  let buffer = '';
  let dataLines: string[] = [];
  let eventName: string | undefined;
  let lastId: string | undefined;

  function dispatch(): void {
    if (dataLines.length === 0) {
      eventName = undefined;
      return;
    }
    onEvent({ event: eventName, data: dataLines.join('\n'), id: lastId });
    dataLines = [];
    eventName = undefined;
  }

  function handleLine(rawLine: string): void {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

    if (line === '') {
      dispatch();
      return;
    }
    // Lines beginning with a colon are comments; servers use them as keep-alives.
    if (line.startsWith(':')) return;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'data') dataLines.push(value);
    else if (field === 'event') eventName = value;
    else if (field === 'id') lastId = value;
    // `retry` is intentionally ignored: reconnection is handled by streamChat().
  }

  return {
    push(chunk: string): void {
      buffer += chunk;
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        handleLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    },
    flush(): void {
      if (buffer.length > 0) {
        handleLine(buffer);
        buffer = '';
      }
      dispatch();
    },
  };
}
