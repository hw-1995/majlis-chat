import { useCallback, useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { StreamingBubble } from './StreamingBubble';
import type { TextStore } from '../lib/textStore';
import type { Message } from '../types';

interface MessageListProps {
  messages: Message[];
  sourceCount: number;
  streamStore: TextStore;
  onCite: (index: number) => void;
  activeIndex: number | null;
  emptyState: string;
  emptyHint: string;
}

/** Treat the viewer as "following" the stream while within this many pixels. */
const STICKY_THRESHOLD_PX = 80;

export function MessageList({
  messages,
  sourceCount,
  streamStore,
  onCite,
  activeIndex,
  emptyState,
  emptyHint,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottomIfFollowing = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    // Only auto-scroll when the reader is already at the bottom. Yanking the
    // viewport while someone is reading back through the transcript is worse
    // than letting new text arrive off-screen.
    if (distance <= STICKY_THRESHOLD_PX) {
      element.scrollTop = element.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottomIfFollowing();
  }, [messages.length, scrollToBottomIfFollowing]);

  return (
    <div className="transcript" ref={scrollRef}>
      {messages.length === 0 ? (
        <div className="empty">
          <p className="empty__title">{emptyState}</p>
          <p className="empty__hint">{emptyHint}</p>
        </div>
      ) : null}

      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          sourceCount={sourceCount}
          onCite={onCite}
          activeIndex={activeIndex}
        />
      ))}

      <StreamingBubble
        store={streamStore}
        sourceCount={sourceCount}
        onGrow={scrollToBottomIfFollowing}
      />
    </div>
  );
}
