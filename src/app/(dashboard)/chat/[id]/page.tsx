"use client";

import { use, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ConversationList } from "../ConversationList";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { useMessages } from "@/lib/queries/conversations";
import { toInitialMessages, getMessageText } from "@/lib/chat-utils";

export default function DynamicChatPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap the Promise params for Client Components in Next.js 15+
  const resolvedParams = use(params);
  const conversationId = resolvedParams.id;

  const { data: persistedMessages = [], isLoading } = useMessages(conversationId);

  // Mount the actual chat only when initial messages are loaded, so useChat initializes correctly
  if (isLoading) {
    return (
      <div className="flex h-full w-full overflow-hidden">
        <div className="hidden md:flex h-full shrink-0">
          <ConversationList />
        </div>
        <div className="flex flex-1 items-center justify-center bg-muted/10">
          <span className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
        </div>
      </div>
    );
  }

  return <ChatContainer conversationId={conversationId} persistedMessages={persistedMessages} />;
}

function ChatContainer({ conversationId, persistedMessages }: { conversationId: string, persistedMessages: any[] }) {
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    headers: {
      'x-conversation-id': conversationId
    }
  }), [conversationId]);

  const initMsgs = useMemo(() => toInitialMessages(persistedMessages), [persistedMessages]);

  // @ts-ignore - The ai/react vs @ai-sdk/react type definitions conflict in this setup
  const { messages, sendMessage, stop, status, error } = useChat({
    transport,
    messages: initMsgs,
  });

  const isSending = status === 'submitted' || status === 'streaming';

  const handleSend = (content: string) => {
    sendMessage({ role: 'user', content, conversationId } as any);
  };

  // We filter out any messages from useChat that are already persisted in the database.
  const draftMessages = messages
    .filter((msg: any) => !persistedMessages.some((p: any) => p.id === msg.id))
    .map((msg: any, index: number, array: any[]) => {
      const isLast = index === array.length - 1;
      const isStreamingMessage = isLast && msg.role === 'assistant' && status === 'streaming';
      return {
        id: msg.id,
        role: msg.role,
        content: getMessageText(msg),
        createdAt: msg.createdAt ? new Date(msg.createdAt).toISOString() : new Date().toISOString(),
        isPending: false,
        isStreaming: isStreamingMessage,
      };
    });

  // Vercel AI SDK only appends the assistant message once the stream actually begins.
  // To show immediate feedback (the bouncing dots), we inject a stub if a request is actively inflight.
  const lastMessage = draftMessages.length > 0 ? draftMessages[draftMessages.length - 1] : persistedMessages[persistedMessages.length - 1];
  if (isSending && lastMessage?.role === 'user') {
    draftMessages.push({
      id: 'optimistic-pending',
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      isPending: true,
      isStreaming: false,
    });
  }

  // Surface any errors gracefully in the UI instead of hanging silently
  if (error) {
    draftMessages.push({
      id: 'error-stub',
      role: 'assistant',
      content: `Error: ${error.message || 'Something went wrong.'}`,
      createdAt: new Date().toISOString(),
      isPending: false,
      isStreaming: false,
    });
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="hidden md:flex h-full shrink-0">
        <ConversationList />
      </div>

      <div className="flex flex-1 flex-col bg-muted/10 h-full relative">
        <MessageList conversationId={conversationId} draftMessages={draftMessages} />
        <ChatInput onSend={handleSend} isSending={isSending} onStop={stop} />
      </div>
    </div>
  );
}
