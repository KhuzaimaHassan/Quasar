import { cn, formatRelativeTime } from "@/lib/utils";

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import type { PersistedAttachment } from "@/lib/attachment-types";
import { AttachmentChip } from "./AttachmentChip";
import { CitationChip, type CitationProps } from "./CitationChip";

export interface MessageProps {
  id: string;
  role: string;
  content: string;
  createdAt: string | Date;
  attachments?: PersistedAttachment[];
  tokenCount?: number;
  citations?: CitationProps[];
}

interface MessageBubbleProps {
  message: MessageProps;
  isPending?: boolean;
  isStreaming?: boolean;
}

const streamdownComponents = {
  table: ({ children, ...props }: any) => (
    <div className="overflow-x-auto my-4 rounded-xl border border-border">
      <table className="w-full text-sm text-left divide-y divide-border" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }: any) => (
    <th className="bg-muted/50 px-4 py-2 font-semibold" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: any) => (
    <td className="px-4 py-2" {...props}>
      {children}
    </td>
  ),
};

export function MessageBubble({ message, isPending, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full mb-4 group",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "relative max-w-[85%] sm:max-w-[75%] px-4 py-3 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
            : "bg-muted text-foreground rounded-2xl rounded-bl-sm"
        )}
      >
        {/* Render attachments above the text if they exist */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {message.attachments.map((attachment) => (
              <AttachmentChip key={attachment.id} {...attachment} />
            ))}
          </div>
        )}

        {isPending ? (
          <div className="flex items-center h-5 gap-1 px-1">
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
          </div>
        ) : (
          <div className="w-full break-words leading-relaxed">
            {isUser ? (
              <div className="whitespace-pre-wrap [&_[data-streamdown='code-block']]:text-foreground [&_[data-streamdown='inline-code']]:text-foreground [&_[data-streamdown='table-wrapper']]:text-foreground">
                <Streamdown mode="static" components={streamdownComponents} plugins={{ code }}>
                  {message.content}
                </Streamdown>
              </div>
            ) : (
              <Streamdown
                mode={isStreaming ? "streaming" : "static"}
                isAnimating={isStreaming}
                plugins={{ code }}
                components={streamdownComponents}
              >
                {message.content}
              </Streamdown>
            )}
          </div>
        )}

        {/* Render citations below the text for assistant messages */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {message.citations.map((citation, i) => (
              <CitationChip key={`${citation.documentId}-${i}`} {...citation} />
            ))}
          </div>
        )}

        {/* Hover Timestamp */}
        <span
          className={cn(
            "absolute -bottom-5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap",
            isUser ? "right-1" : "left-1"
          )}
        >
          {formatRelativeTime(message.createdAt)}
          {!isUser && !isStreaming && !isPending && message.tokenCount ? ` · ${message.tokenCount.toLocaleString()} tokens` : ""}
        </span>
      </div>
    </div>
  );
}
