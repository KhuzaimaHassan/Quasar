"use client";

import { useEffect, useRef, useState } from "react";
import { MessageBubble, type MessageProps } from "./MessageBubble";

interface DraftMessage extends MessageProps {
  isPending?: boolean;
  isStreaming?: boolean;
}

interface MessageListProps {
  draftMessages: DraftMessage[];
  persistedMessages?: any[];
}

export function MessageList({ draftMessages, persistedMessages = [] }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

  // Combine persisted and local draft messages
  const allMessages = [...persistedMessages, ...draftMessages];

  // Auto-scroll logic
  useEffect(() => {
    if (!scrollRef.current) return;
    
    // If the user hasn't manually scrolled up, auto-scroll to bottom
    if (!isUserScrolledUp) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages, isUserScrolledUp]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    
    // If we are more than 100px away from the bottom, consider the user "scrolled up"
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsUserScrolledUp(distanceFromBottom > 100);
  };

  if (allMessages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <p>Say something to start the conversation</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 md:p-6 pb-0"
      aria-live="polite"
    >
      <div className="max-w-3xl mx-auto flex flex-col pb-4">
        {allMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isPending={(msg as DraftMessage).isPending}
            isStreaming={(msg as DraftMessage).isStreaming}
          />
        ))}
      </div>
    </div>
  );
}
