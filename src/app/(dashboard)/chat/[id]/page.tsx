"use client";

import { use, useState, useRef } from "react";
import { ConversationList } from "../ConversationList";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";

interface DraftMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  isPending?: boolean;
}

export default function DynamicChatPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap the Promise params for Client Components in Next.js 15+
  const resolvedParams = use(params);
  const conversationId = resolvedParams.id;

  const [draftMessages, setDraftMessages] = useState<DraftMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSend = (content: string) => {
    // Append a user message to draftMessages immediately
    const userMsg: DraftMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    
    // Append a pending assistant placeholder
    const pendingMsg: DraftMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      isPending: true,
    };
    
    setDraftMessages((prev) => [...prev, userMsg, pendingMsg]);
    setIsSending(true);

    // TODO: Issue #9 replaces this stub with a real streaming call to /api/chat using the Vercel AI SDK.
    timeoutRef.current = setTimeout(() => {
      setDraftMessages((prev) => 
        prev.map(msg => 
          msg.id === pendingMsg.id 
            ? { ...msg, isPending: false, content: "This is a placeholder response. Streaming will be wired in Issue #9." }
            : msg
        )
      );
      setIsSending(false);
      timeoutRef.current = null;
    }, 1200);
  };

  const handleStop = () => {
    // Clear the pending timeout if still running
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Remove the pending assistant placeholder from draftMessages
    setDraftMessages((prev) => prev.filter(msg => !msg.isPending));
    setIsSending(false);
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="hidden md:flex h-full shrink-0">
        <ConversationList />
      </div>

      <div className="flex flex-1 flex-col bg-muted/10 h-full relative">
        <MessageList conversationId={conversationId} draftMessages={draftMessages as any} />
        <ChatInput onSend={handleSend} isSending={isSending} onStop={handleStop} />
      </div>
    </div>
  );
}
