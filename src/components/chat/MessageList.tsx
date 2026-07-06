"use client";

import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/lib/queries/conversations";
import { MessageBubble, type MessageProps } from "./MessageBubble";
import { cn } from "@/lib/utils";

interface DraftMessage extends MessageProps {
  isPending?: boolean;
}

interface MessageListProps {
  conversationId: string;
  draftMessages: DraftMessage[];
}

export function MessageList({ conversationId, draftMessages }: MessageListProps) {
  const { data: persistedMessages = [], isLoading } = useMessages(conversationId);
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

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "flex w-full",
              i % 2 === 0 ? "justify-start" : "justify-end"
            )}
          >
            <div className="w-[60%] h-12 bg-muted animate-pulse rounded-2xl"></div>
          </div>
        ))}
      </div>
    );
  }

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
          />
        ))}
      </div>
    </div>
  );
}
