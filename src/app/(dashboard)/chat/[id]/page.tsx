"use client";

import { use, useMemo, useRef, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { useMessages, useConversation } from "@/lib/queries/conversations";
import { toInitialMessages, getMessageText, getChatErrorMessage } from "@/lib/chat-utils";
import { TokenBadge } from "@/components/chat/TokenBadge";
import { ModelSwitcher } from "@/components/chat/ModelSwitcher";
import type { UploadedAttachment, PersistedAttachment } from "@/lib/attachment-types";
import { isImageMimeType } from "@/lib/attachment-types";
import { useApiKeys } from "@/lib/queries/api-keys";
import { Provider } from "@/lib/models";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useWorkspaces } from "@/lib/queries/workspaces";
import { AgentPanel } from "@/components/agents/AgentPanel";
import Link from "next/link";
import { ConversationQueryError } from "@/lib/queries/conversations";

export default function DynamicChatPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap the Promise params for Client Components in Next.js 15+
  const resolvedParams = use(params);
  const conversationId = resolvedParams.id;

  const { data: persistedMessages = [], isLoading, error, refetch } = useMessages(conversationId);

  // Mount the actual chat only when initial messages are loaded, so useChat initializes correctly
  if (isLoading) {
    return (
      <div className="flex h-full w-full min-w-0 overflow-hidden">
        <div className="flex flex-1 items-center justify-center bg-muted/10">
          <span role="status" aria-label="Loading conversation" className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
        </div>
      </div>
    );
  }

  if (error) {
    const isNotFound = error instanceof ConversationQueryError && error.status === 404;
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">{isNotFound ? 'Conversation not found' : 'Unable to load conversation'}</h1>
        <p className="text-sm text-muted-foreground">
          {isNotFound ? 'This conversation does not exist or is not available to your account.' : 'Your messages could not be loaded. Please try again.'}
        </p>
        {isNotFound ? (
          <Link href="/chat" className="text-primary underline">Back to chats</Link>
        ) : (
          <button type="button" onClick={() => refetch()} className="text-primary underline">Try again</button>
        )}
      </div>
    );
  }

  return <ChatContainer key={conversationId} conversationId={conversationId} persistedMessages={persistedMessages} />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const [pendingAttachments, setPendingAttachments] = useState<PersistedAttachment[]>([]);

  const { messages, setMessages, sendMessage, regenerate, clearError, stop, status, error } = useChat({
    transport,
    messages: initMsgs,
  });

  // Sync useChat's internal state with the DB when not streaming.
  // This prevents duplicates because useChat assigns temporary client-side IDs to new messages,
  // which won't match the new Prisma UUIDs once they are persisted and refetched.
  const lastSyncedMessages = useRef(persistedMessages);
  useEffect(() => {
    if ((status === 'ready' || status === 'error') && lastSyncedMessages.current !== persistedMessages) {
      setMessages(toInitialMessages(persistedMessages));
      lastSyncedMessages.current = persistedMessages;
    }
  }, [persistedMessages, status, setMessages]);

  const queryClient = useQueryClient();
  const prevStatusRef = useRef(status);

  useEffect(() => {
    const wasActive = prevStatusRef.current === 'streaming' || prevStatusRef.current === 'submitted';
    if (wasActive && (status === 'ready' || status === 'error')) {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }, 500);

      // Additional invalidations to catch background LLM operations (e.g., auto-naming)
      // which may take a few seconds to complete on the server after the stream ends.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }, 3000);
    }
    prevStatusRef.current = status;
  }, [status, conversationId, queryClient]);

  const isSending = status === 'submitted' || status === 'streaming';

  const handleSend = async (content: string, attachments: UploadedAttachment[]) => {
    // Separate images (have .file) from non-images
    // PDF/DOCX chat attachments are downloadable files; document Q&A uses workspace indexing.
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
    setPendingAttachments(allAttachmentMeta);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { text: content, files: undefined } as any,
        { body: { conversationId, attachments: allAttachmentMeta.length > 0 ? allAttachmentMeta : undefined } }
      );
    }
  };

  // We filter out any messages from useChat that are already persisted in the database.
  const draftMessages = messages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((msg: any) => !persistedMessages.some((p: any) => p.id === msg.id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((msg: any, index: number, array: any[]) => {
      const isLast = index === array.length - 1;
      const isStreamingMessage = isLast && msg.role === 'assistant' && status === 'streaming';

      // For user draft messages, attach the pending attachments from this send
      const attachments = msg.role === 'user' ? pendingAttachments : undefined;

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
  if (error && !persistedMessages.at(-1)?.metadata?.generationError) {
    draftMessages.push({
      id: 'error-stub',
      role: 'assistant',
      content: `Error: ${getChatErrorMessage(error.message || 'Something went wrong.')}`,
      createdAt: new Date().toISOString(),
      isPending: false,
      isStreaming: false,
      attachments: undefined,
    });
  }

  const handleRetry = () => {
    if (persistedMessages.length > 0) {
      const lastMsg = persistedMessages[persistedMessages.length - 1];
      if (lastMsg.role === 'user' && lastMsg.content) {
        clearError();
        setMessages(toInitialMessages(persistedMessages));
        regenerate({ body: { conversationId, retryMessageId: lastMsg.id } });
      }
    }
  };

  return (
    <div className="flex h-full w-full min-w-0 overflow-hidden">
      <div className="flex flex-1 flex-col min-w-0 bg-muted/10 h-full relative">
        <ChatHeader conversationId={conversationId} />
        <MessageList draftMessages={draftMessages} persistedMessages={persistedMessages} onRetry={handleRetry} isSending={isSending} />
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

function ChatHeader({ conversationId }: { conversationId: string }) {
  const { data: conversation } = useConversation(conversationId);
  const { data: apiKeys } = useApiKeys();
  const { activeWorkspace, setActiveWorkspace } = useWorkspace();
  const { data: workspaces } = useWorkspaces();
  
  const lastSyncedConversationId = useRef<string | null>(null);

  // Force workspace synchronization on direct navigation or refresh.
  // We use a ref to ensure this only happens once per conversation ID,
  // preventing a race condition where it fights the WorkspaceSwitcher during navigation.
  useEffect(() => {
    if (conversation?.workspaceId && workspaces?.length) {
      if (lastSyncedConversationId.current !== conversation.id) {
        if (activeWorkspace?.id !== conversation.workspaceId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const correctWorkspace = workspaces.find((w: any) => w.id === conversation.workspaceId);
          if (correctWorkspace) {
            setActiveWorkspace(correctWorkspace);
          }
        }
        lastSyncedConversationId.current = conversation.id;
      }
    }
  }, [conversation?.id, conversation?.workspaceId, workspaces, activeWorkspace?.id, setActiveWorkspace]);

  if (!conversation) return null;

  const availableProviders = (apiKeys?.map((k: { provider: string }) => k.provider) || []) as Provider[];

  return (
    <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b bg-background/50 backdrop-blur-sm shrink-0 z-10 relative min-w-0">
      <div className="flex items-center min-w-0 flex-1 mr-2 sm:mr-4">
        <h2 className="text-xs sm:text-sm font-semibold text-foreground truncate">
          {conversation.title || 'New Conversation'}
        </h2>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <AgentPanel conversationId={conversationId} workspaceId={conversation.workspaceId} />
        <ModelSwitcher 
          conversationId={conversationId} 
          currentModel={conversation.model} 
          availableProviders={availableProviders} 
        />
        <TokenBadge conversationId={conversationId} />
      </div>
    </header>
  );
}
