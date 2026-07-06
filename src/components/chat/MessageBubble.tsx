import { cn, formatRelativeTime } from "@/lib/utils";

export interface MessageProps {
  id: string;
  role: string;
  content: string;
  createdAt: string | Date;
}

interface MessageBubbleProps {
  message: MessageProps;
  isPending?: boolean;
}

export function MessageBubble({ message, isPending }: MessageBubbleProps) {
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
        {isPending ? (
          <div className="flex items-center h-5 gap-1 px-1">
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
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
        </span>
      </div>
    </div>
  );
}
