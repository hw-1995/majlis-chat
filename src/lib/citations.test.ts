import { describe, expect, it } from 'vitest';
import { citedIndices, parseSegments } from './citations';

describe('parseSegments', () => {
  it('splits a marker out of surrounding text', () => {
    expect(parseSegments('See [1] here', 3)).toEqual([
      { kind: 'text', value: 'See ' },
      { kind: 'citation', index: 0 },
      { kind: 'text', value: ' here' },
    ]);
  });

  it('converts one-based markers to zero-based indices', () => {
    expect(parseSegments('[2]', 3)).toEqual([{ kind: 'citation', index: 1 }]);
  });

  it('leaves an out-of-range marker as literal text', () => {
    // A model handed two sources sometimes invents [9]; it must not render
    // as a control that points at nothing.
    expect(parseSegments('claim [9]', 2)).toEqual([{ kind: 'text', value: 'claim [9]' }]);
  });

  it('leaves [0] as literal text', () => {
    expect(parseSegments('see [0]', 2)).toEqual([{ kind: 'text', value: 'see [0]' }]);
  });

  it('handles adjacent markers', () => {
    expect(parseSegments('[1][2]', 2)).toEqual([
      { kind: 'citation', index: 0 },
      { kind: 'citation', index: 1 },
    ]);
  });

  it('returns plain text unchanged', () => {
    expect(parseSegments('no markers', 2)).toEqual([
      { kind: 'text', value: 'no markers' },
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(parseSegments('', 2)).toEqual([]);
  });

  it('works on a partial marker mid-stream', () => {
    // Tokens arrive one at a time, so the text is frequently mid-marker.
    expect(parseSegments('answer [', 2)).toEqual([{ kind: 'text', value: 'answer [' }]);
  });
});

describe('citedIndices', () => {
  it('lists first-appearance order without duplicates', () => {
    expect(citedIndices('a [2] b [1] c [2]', 3)).toEqual([1, 0]);
  });

  it('returns empty when nothing is cited', () => {
    expect(citedIndices('plain answer', 3)).toEqual([]);
  });
});
