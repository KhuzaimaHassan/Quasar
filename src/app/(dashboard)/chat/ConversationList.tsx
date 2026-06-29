"use client";

import { useState } from "react";
import { Search, Plus, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ConversationCard } from "./ConversationCard";
import { MOCK_CONVERSATIONS } from "@/lib/mock-data";

export function ConversationList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState("GPT-4");

  const models = ["GPT-4", "Claude 3.5 Sonnet", "Gemini 1.5 Pro"];

  return (
    <aside 
      className="flex h-full w-full max-w-sm md:w-[320px] flex-col border-r bg-background shrink-0 z-10"
      aria-label="Conversations"
    >
      <div className="p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Chats</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs gap-1 text-muted-foreground font-medium px-2 rounded-md hover:bg-accent focus-visible:ring-2"
                aria-label={`Select AI Model. Current model: ${selectedModel}`}
              >
                {selectedModel}
                <ChevronDown className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {models.map(model => (
                <DropdownMenuItem 
                  key={model} 
                  onClick={() => setSelectedModel(model)}
                  className={cn("cursor-pointer", selectedModel === model && "bg-accent text-accent-foreground font-medium")}
                >
                  {model}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button 
          size="icon" 
          variant="ghost" 
          className="h-8 w-8 text-muted-foreground hover:text-foreground focus-visible:ring-2"
          aria-label="Start new chat"
        >
          <Plus className="h-[18px] w-[18px]" />
        </Button>
      </div>
      
      <div className="px-4 pb-4 shrink-0">
        <div className="relative" role="search">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search chats..."
            className="pl-9 h-9 bg-muted/50 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:border-primary transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search conversations"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1" role="list" aria-label="Conversation list">
        {MOCK_CONVERSATIONS.map((chat) => (
          <ConversationCard 
            key={chat.id}
            title={chat.title}
            preview={chat.preview}
            time={chat.time}
            model={chat.model}
            files={chat.files}
            isActive={chat.isActive}
          />
        ))}
      </div>
    </aside>
  );
}
