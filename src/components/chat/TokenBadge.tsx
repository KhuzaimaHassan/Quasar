"use client";

import { useConversation } from "@/lib/queries/conversations";

function formatTokens(num: number): string {
  if (!num) return "0";
  if (num < 1000) return num.toString();
  return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
}

export function TokenBadge({ conversationId }: { conversationId: string }) {
  const { data: conversation } = useConversation(conversationId);

  const tokens = conversation?.totalTokens || 0;
  
  // Gracefully hide if no tokens are captured yet
  if (tokens === 0) return null;

  return (
    <span 
      className="inline-flex items-center text-[10px] sm:text-[11px] font-medium text-muted-foreground/80 bg-muted/40 px-1.5 sm:px-2 py-0.5 rounded-full border border-border/50 select-none whitespace-nowrap shrink-0 tabular-nums"
      title={`${tokens.toLocaleString()} tokens total`}
    >
      <span>{formatTokens(tokens)}</span>
      <span className="hidden sm:inline ml-1">tokens</span>
      <span className="inline sm:hidden ml-0.5 text-[9px] opacity-70">tkn</span>
    </span>
  );
}
