"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSend: (content: string) => void;
  isSending: boolean;
  onStop: () => void;
}

export function ChatInput({ onSend, isSending, onStop }: ChatInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea logic
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to minimum to recalculate scrollHeight
    textarea.style.height = "auto";
    
    // The max-h-40 class handles the max height, so we just set it to scrollHeight
    // It will overflow and become scrollable automatically if scrollHeight > max-height
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [content]);

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;
    
    onSend(trimmed);
    setContent("");
    
    // Reset textarea focus
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Platform agnostic check for Cmd (Mac) or Ctrl (Win/Linux)
    const isModifier = e.metaKey || e.ctrlKey;
    
    if (e.key === "Enter" && isModifier) {
      e.preventDefault(); // Prevent a random newline from sneaking in
      handleSend();
    }
  };

  const isSendDisabled = !content.trim() || isSending;

  return (
    <div className="w-full max-w-3xl mx-auto p-4 md:p-6 shrink-0 bg-gradient-to-t from-background/80 to-transparent backdrop-blur-sm z-10">
      <div className="relative flex items-end gap-2 bg-background border shadow-sm rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:border-primary transition-all">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message... (Cmd/Ctrl + Enter to send)"
          className="flex-1 max-h-40 min-h-[44px] w-full resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Message input"
          rows={1}
        />
        
        <div className="p-2 shrink-0">
          {isSending ? (
            <Button
              size="icon"
              variant="default"
              className="h-8 w-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              onClick={onStop}
              aria-label="Stop generating"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="default"
              disabled={isSendDisabled}
              onClick={handleSend}
              className="h-8 w-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm disabled:opacity-50 transition-opacity"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="text-center mt-2 text-[10px] text-muted-foreground opacity-70">
        AI models can make mistakes. Check important info.
      </div>
    </div>
  );
}
