import { parseSegments } from '../lib/citations';

interface CitedTextProps {
  text: string;
  sourceCount: number;
  onCite?: (index: number) => void;
  activeIndex?: number | null;
}

/**
 * Renders assistant text with `[n]` markers turned into controls that point at
 * the source they came from. Markers outside the range of retrieved sources
 * fall through as literal text — see parseSegments.
 */
export function CitedText({ text, sourceCount, onCite, activeIndex }: CitedTextProps) {
  const segments = parseSegments(text, sourceCount);

  return (
    <>
      {segments.map((segment, i) =>
        segment.kind === 'text' ? (
          <span key={i}>{segment.value}</span>
        ) : (
          <button
            key={i}
            type="button"
            className={
              activeIndex === segment.index ? 'citation citation--active' : 'citation'
            }
            onClick={() => onCite?.(segment.index)}
            aria-label={`Source ${segment.index + 1}`}
          >
            {segment.index + 1}
          </button>
        ),
      )}
    </>
  );
}
