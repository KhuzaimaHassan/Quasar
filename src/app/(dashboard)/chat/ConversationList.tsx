"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Search, Plus, ChevronDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatRelativeTime } from "@/lib/utils";
import { ConversationCard } from "./ConversationCard";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useConversations, useCreateConversation } from "@/lib/queries/conversations";

export function ConversationList() {
  const router = useRouter();
  const params = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-5");
  
  const { activeWorkspace } = useWorkspace();
  const { data: conversations = [], isLoading } = useConversations(activeWorkspace?.id);
  const { mutate: createConversation, isPending: isCreating } = useCreateConversation();

  const models = [
    { id: "claude-sonnet-4-5", name: "Claude 4.5 Sonnet" },
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" }
  ];

  const currentModelName = models.find(m => m.id === selectedModel)?.name || "Claude 4.5 Sonnet";

  const handleNewChat = () => {
    createConversation(
      { workspaceId: activeWorkspace?.id, model: selectedModel },
      {
        onSuccess: (data) => {
          router.push(`/chat/${data.id}`);
        }
      }
    );
  };

  const filteredConversations = conversations.filter((c: any) => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                aria-label={`Select AI Model. Current model: ${currentModelName}`}
              >
                {currentModelName}
                <ChevronDown className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {models.map(model => (
                <DropdownMenuItem 
                  key={model.id} 
                  onClick={() => setSelectedModel(model.id)}
                  className={cn("cursor-pointer", selectedModel === model.id && "bg-accent text-accent-foreground font-medium")}
                >
                  {model.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={handleNewChat}
          disabled={isCreating}
          className="h-8 w-8 text-muted-foreground hover:text-foreground focus-visible:ring-2"
          aria-label="Start new chat"
        >
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-[18px] w-[18px]" />}
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
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Loading chats...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {searchQuery ? "No chats found." : "No conversations yet. Start a new chat above."}
          </div>
        ) : (
          filteredConversations.map((chat: any) => (
            <div key={chat.id} onClick={() => router.push(`/chat/${chat.id}`)}>
              <ConversationCard 
                title={chat.title}
                time={formatRelativeTime(chat.updatedAt)}
                model={models.find(m => m.id === chat.model)?.name || chat.model}
                files={0}
                isActive={params?.id === chat.id}
              />
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
