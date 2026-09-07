import { memo } from 'react';
import { CitedText } from './CitedText';
import type { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  sourceCount: number;
  onCite?: (index: number) => void;
  activeIndex?: number | null;
}

/**
 * Memoised: completed messages never change, so they must not re-render while
 * a later turn is streaming.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  sourceCount,
  onCite,
  activeIndex,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <article className={isUser ? 'bubble bubble--user' : 'bubble bubble--assistant'}>
      <div className="bubble__body">
        {isUser ? (
          message.content
        ) : (
          <CitedText
            text={message.content}
            sourceCount={sourceCount}
            onCite={onCite}
            activeIndex={activeIndex}
          />
        )}
      </div>
      {message.error ? <p className="bubble__error">{message.error}</p> : null}
    </article>
  );
});
