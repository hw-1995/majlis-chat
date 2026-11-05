import { memo } from 'react';
import { CitedText } from './CitedText';
import { ToolSteps } from './ToolSteps';
import type { Strings } from '../i18n';
import type { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  sourceCount: number;
  onCite?: (index: number) => void;
  activeIndex?: number | null;
  strings: Strings;
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
  strings,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <article className={isUser ? 'bubble bubble--user' : 'bubble bubble--assistant'}>
      {message.steps ? <ToolSteps steps={message.steps} strings={strings} /> : null}
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
      {message.error ? (
        <p className="bubble__error">
          {strings.errors[(message.errorCode ?? 'unknown') as keyof Strings['errors']] ??
            strings.errors.unknown}
          <span className="bubble__error-detail" dir="ltr">
            {message.error}
          </span>
        </p>
      ) : null}
    </article>
  );
});
