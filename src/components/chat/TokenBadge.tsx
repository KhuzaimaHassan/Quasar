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
      className="text-[11px] font-medium text-muted-foreground/80 bg-muted/30 px-2 py-0.5 rounded-full border border-border/40 select-none"
      title={`${tokens.toLocaleString()} tokens total`}
    >
      {formatTokens(tokens)} tokens
    </span>
  );
}
