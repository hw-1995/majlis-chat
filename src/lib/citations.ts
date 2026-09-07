/**
 * Citation markers.
 *
 * The model is asked to write inline markers like `[1]` that refer to the
 * retrieved sources it was given. Splitting them out of the text lets the UI
 * render each marker as a control that highlights the matching source, which
 * is the whole point of showing citations: a claim the reader cannot trace is
 * a claim they have to take on faith.
 */

export type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'citation'; index: number };

const MARKER = /\[(\d{1,2})\]/g;

/**
 * Split assistant text into plain runs and citation markers.
 *
 * `sourceCount` bounds which markers are treated as citations: a model that
 * hallucinates `[9]` when it was handed three sources should have that render
 * as literal text, not as a control that points nowhere.
 */
export function parseSegments(text: string, sourceCount: number): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  MARKER.lastIndex = 0;
  let match = MARKER.exec(text);
  while (match !== null) {
    const oneBased = Number(match[1]);
    const index = oneBased - 1;

    if (index >= 0 && index < sourceCount) {
      if (match.index > cursor) {
        segments.push({ kind: 'text', value: text.slice(cursor, match.index) });
      }
      segments.push({ kind: 'citation', index });
      cursor = match.index + match[0].length;
    }
    match = MARKER.exec(text);
  }

  if (cursor < text.length) {
    segments.push({ kind: 'text', value: text.slice(cursor) });
  }
  return segments;
}

/** Distinct source indices cited in `text`, in the order they first appear. */
export function citedIndices(text: string, sourceCount: number): number[] {
  const seen: number[] = [];
  for (const segment of parseSegments(text, sourceCount)) {
    if (segment.kind === 'citation' && !seen.includes(segment.index)) {
      seen.push(segment.index);
    }
  }
  return seen;
}
