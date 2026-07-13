"use client";

import { use, useMemo, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ConversationList } from "../ConversationList";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { useMessages, useConversation } from "@/lib/queries/conversations";
import { toInitialMessages, getMessageText } from "@/lib/chat-utils";
import { TokenBadge } from "@/components/chat/TokenBadge";
import type { UploadedAttachment, PersistedAttachment } from "@/lib/attachment-types";
import { isImageMimeType } from "@/lib/attachment-types";

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

  // Track attachments sent with each message for optimistic rendering
  // Maps a "send index" to the attachments for that send
  const pendingAttachmentsRef = useRef<PersistedAttachment[]>([]);

  // @ts-ignore - The ai/react vs @ai-sdk/react type definitions conflict in this setup
  const { messages, setMessages, sendMessage, stop, status, error } = useChat({
    transport,
    messages: initMsgs,
  });

  // Sync useChat's internal state with the DB when not streaming.
  // This prevents duplicates because useChat assigns temporary client-side IDs to new messages,
  // which won't match the new Prisma UUIDs once they are persisted and refetched.
  useEffect(() => {
    if (status === 'ready' && persistedMessages.length > 0) {
      setMessages(toInitialMessages(persistedMessages));
    }
  }, [persistedMessages, status, setMessages]);

  const queryClient = useQueryClient();
  const prevStatusRef = useRef(status);

  useEffect(() => {
    const wasActive = prevStatusRef.current === 'streaming' || prevStatusRef.current === 'submitted';
    if (wasActive && status === 'ready') {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      }, 500);
    }
    prevStatusRef.current = status;
  }, [status, conversationId, queryClient]);

  const isSending = status === 'submitted' || status === 'streaming';

  const handleSend = async (content: string, attachments: UploadedAttachment[]) => {
    // Separate images (have .file) from non-images
    // TODO: PDF/DOCX document content understanding is M3's RAG pipeline.
    // For now, they are uploaded and shown in the UI but NOT fed into the model's context.
    const imageAttachments = attachments.filter(a => isImageMimeType(a.mimeType) && a.file);
    const allAttachmentMeta: PersistedAttachment[] = attachments.map(a => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      storagePath: a.storagePath,
      url: a.url,
    }));

    // Store attachments for optimistic rendering
    pendingAttachmentsRef.current = allAttachmentMeta;

    // Build FileUIPart[] for images so the model can actually see them
    const fileParts: Array<{ type: 'file'; mediaType: string; url: string; filename: string }> = [];
    for (const img of imageAttachments) {
      // Convert the File to a data URL for the AI SDK
      const dataUrl = await fileToDataUrl(img.file!);
      fileParts.push({
        type: 'file',
        mediaType: img.mimeType,
        url: dataUrl,
        filename: img.filename,
      });
    }

    // Call sendMessage with text + files (images only), and pass attachment metadata via body
    if (fileParts.length > 0) {
      sendMessage(
        { text: content || ' ', files: fileParts },
        { body: { conversationId, attachments: allAttachmentMeta } }
      );
    } else {
      sendMessage(
        { text: content, files: undefined } as any,
        { body: { conversationId, attachments: allAttachmentMeta.length > 0 ? allAttachmentMeta : undefined } }
      );
    }
  };

  // We filter out any messages from useChat that are already persisted in the database.
  const draftMessages = messages
    .filter((msg: any) => !persistedMessages.some((p: any) => p.id === msg.id))
    .map((msg: any, index: number, array: any[]) => {
      const isLast = index === array.length - 1;
      const isStreamingMessage = isLast && msg.role === 'assistant' && status === 'streaming';

      // For user draft messages, attach the pending attachments from this send
      const attachments = msg.role === 'user' ? pendingAttachmentsRef.current : undefined;

      return {
        id: msg.id,
        role: msg.role,
        content: getMessageText(msg),
        createdAt: msg.createdAt ? new Date(msg.createdAt).toISOString() : new Date().toISOString(),
        isPending: false,
        isStreaming: isStreamingMessage,
        attachments,
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
      attachments: undefined,
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
      attachments: undefined,
    });
  }

function ChatHeader({ conversationId }: { conversationId: string }) {
  const { data: conversation } = useConversation(conversationId);
  
  if (!conversation) return null;

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-background/50 backdrop-blur-sm shrink-0 z-10">
      <h2 className="text-sm font-semibold text-foreground truncate mr-4">
        {conversation.title || 'New Conversation'}
      </h2>
      <TokenBadge conversationId={conversationId} />
    </header>
  );
}

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="hidden md:flex h-full shrink-0">
        <ConversationList />
      </div>

      <div className="flex flex-1 flex-col bg-muted/10 h-full relative">
        <ChatHeader conversationId={conversationId} />
        <MessageList draftMessages={draftMessages} persistedMessages={persistedMessages} />
        <ChatInput onSend={handleSend} isSending={isSending} onStop={stop} conversationId={conversationId} />
      </div>
    </div>
  );
}

/** Convert a File to a data URL string */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
