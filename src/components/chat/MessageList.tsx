"use client";

import { useEffect, useRef, useState } from "react";
import { MessageBubble, type MessageProps } from "./MessageBubble";
import { AlertCircle, RotateCcw } from "lucide-react";

interface DraftMessage extends MessageProps {
  isPending?: boolean;
  isStreaming?: boolean;
}

interface MessageListProps {
  draftMessages: DraftMessage[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  persistedMessages?: any[];
  onRetry?: () => void;
}

export function MessageList({ draftMessages, persistedMessages = [], onRetry }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

  // Combine persisted and local draft messages, extracting attachments and citations
  const mappedPersisted = persistedMessages.map((msg) => ({
    ...msg,
    attachments: msg.metadata?.attachments || undefined,
    citations: msg.metadata?.citations || undefined,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappedDrafts = draftMessages.map((msg: any) => {
    // Extract citations from AI SDK annotations (data parts)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const citationAnnotations = msg.annotations?.filter((a: any) => a.type === 'data-citations') || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const citations = citationAnnotations.flatMap((a: any) => a.citations || []);
    return {
      ...msg,
      citations: citations.length > 0 ? citations : undefined,
    };
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allMessages = [...mappedPersisted, ...mappedDrafts];

  // Detect orphaned user message: last persisted message is from user,
  // and there are no draft messages (streaming/pending) in progress
  const lastPersisted = mappedPersisted[mappedPersisted.length - 1];
  const hasOrphanedMessage =
    lastPersisted?.role === "user" &&
    draftMessages.length === 0;

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
      className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-3 sm:p-4 md:p-6 pb-0"
      aria-live="polite"
    >
      <div className="max-w-3xl w-full mx-auto flex flex-col pb-4 min-w-0">
        {allMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isPending={(msg as DraftMessage).isPending}
            isStreaming={(msg as DraftMessage).isStreaming}
          />
        ))}
        {hasOrphanedMessage && (
          <div className="flex justify-start mb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>No response received</span>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 ml-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  <RotateCcw className="w-3 h-3" />
                  Try again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
