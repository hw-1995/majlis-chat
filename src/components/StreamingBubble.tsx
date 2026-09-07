import { useEffect, useRef, useSyncExternalStore } from 'react';
import { CitedText } from './CitedText';
import type { TextStore } from '../lib/textStore';

interface StreamingBubbleProps {
  store: TextStore;
  sourceCount: number;
  /** Called on every token so the transcript can follow the text down. */
  onGrow?: () => void;
}

/**
 * The only component that re-renders per token.
 *
 * It subscribes directly to the text store rather than reading from React
 * state held higher up, which keeps the cost of a token constant instead of
 * proportional to the length of the conversation.
 */
export function StreamingBubble({ store, sourceCount, onGrow }: StreamingBubbleProps) {
  const text = useSyncExternalStore(store.subscribe, store.get);
  const onGrowRef = useRef(onGrow);
  onGrowRef.current = onGrow;

  useEffect(() => {
    onGrowRef.current?.();
  }, [text]);

  if (text.length === 0) return null;

  return (
    <article className="bubble bubble--assistant bubble--streaming">
      <div className="bubble__body">
        {/* `dir="auto"` lets the browser pick direction from the first strong
            character. During streaming that character can arrive several tokens
            in, so the paragraph may flip once the language becomes clear —
            which is correct behaviour, not a glitch. */}
        <span dir="auto">
          <CitedText text={text} sourceCount={sourceCount} />
        </span>
        <span className="caret" aria-hidden="true" />
      </div>
    </article>
  );
}
