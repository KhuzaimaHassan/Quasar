"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import { cn, formatRelativeTime } from "@/lib/utils";
import { navGroups } from "@/lib/nav";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { UserMenu } from "./UserMenu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelLeftClose, PanelLeftOpen, Search, Plus, ChevronDown, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useConversations, useCreateConversation, useUpdateConversation } from "@/lib/queries/conversations";
import { MODEL_CATALOG } from "@/lib/models";
import { ConversationCard } from "./ConversationCard";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newChatModel, setNewChatModel] = useState("gemini-3.5-flash");

  const { activeWorkspace } = useWorkspace();
  const { data: conversations = [], isLoading } = useConversations(activeWorkspace?.id);
  const { mutate: createConversation, isPending: isCreating } = useCreateConversation();
  const { mutate: updateConversation } = useUpdateConversation();

  const activeConversationId = params?.id as string | undefined;
  const activeConversation = activeConversationId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (conversations as any[]).find((c) => c.id === activeConversationId)
    : null;
  const selectedModel = activeConversation?.model ?? newChatModel;

  useEffect(() => {
    if (activeConversation?.model) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewChatModel(activeConversation.model);
    }
  }, [activeConversation?.model]);

  const currentModelName =
    MODEL_CATALOG.find((m) => m.id === selectedModel)?.label || MODEL_CATALOG[0]?.label;

  const handleNewChat = () => {
    createConversation(
      { workspaceId: activeWorkspace?.id, model: newChatModel },
      {
        onSuccess: (data) => {
          router.push(`/chat/${data.id}`);
        },
      }
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredConversations = (conversations as any[]).filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "flex h-full flex-col border-r bg-card transition-all duration-300 min-w-0",
          isCollapsed ? "w-[68px]" : "w-[280px] md:w-[320px]"
        )}
        aria-label="Sidebar Navigation"
      >
        {/* Header Row: Wordmark + Collapse Toggle */}
        <div className="p-3 flex items-center justify-between min-h-[60px] shrink-0">
          {!isCollapsed && (
            <div className="px-2">
              <span className="text-xl font-bold tracking-tight">Quasar</span>
            </div>
          )}
          {isCollapsed && (
            <div className="flex-1 flex justify-center">
              <span className="font-bold text-xl leading-none" aria-hidden="true">Q</span>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className={cn("hidden md:flex text-muted-foreground hover:text-foreground focus-visible:ring-2", isCollapsed ? "md:hidden" : "")}
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{isCollapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
          </Tooltip>
        </div>
        
        {/* Collapse toggle for mobile/collapsed state when wordmark is gone or minimal */}
        {isCollapsed && (
          <div className="hidden md:flex justify-center pb-2 shrink-0">
            <Button 
                variant="ghost" 
                size="icon"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-2"
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="h-[18px] w-[18px]" />
            </Button>
          </div>
        )}

        {/* Workspace Switcher */}
        <div className="px-3 pb-3 shrink-0">
          {!isCollapsed && <WorkspaceSwitcher />}
        </div>

        <Separator />

        {/* Flat Nav Links */}
        <div className="px-3 py-4 shrink-0">
          <nav className="flex flex-col gap-1.5">
            {navGroups.map((group, groupIdx) => (
              <div key={groupIdx} className="flex flex-col gap-1.5">
                {group.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const linkContent = (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                        isCollapsed && "justify-center px-0 py-2.5"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!isCollapsed && <span>{item.label}</span>}
                    </Link>
                  );
                  if (isCollapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent side="right" className="flex items-center gap-4">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return linkContent;
                })}
              </div>
            ))}
          </nav>
        </div>

        <Separator />

        {/* Conversation List Integration */}
        {!isCollapsed && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">Chats</h2>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] gap-1 text-muted-foreground font-medium px-1.5 rounded-md hover:bg-accent focus-visible:ring-2"
                      aria-label={`Select AI Model. Current model: ${currentModelName}`}
                    >
                      {currentModelName}
                      <ChevronDown className="h-3 w-3 opacity-50" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {MODEL_CATALOG.map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        onClick={() => setNewChatModel(model.id)}
                        className={cn(
                          "cursor-pointer text-xs",
                          selectedModel === model.id && "bg-accent text-accent-foreground font-medium"
                        )}
                      >
                        {model.label}
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
                className="h-6 w-6 text-muted-foreground hover:text-foreground focus-visible:ring-2"
                aria-label="Start new chat"
              >
                {isCreating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="px-4 pb-2 shrink-0">
              <div className="relative" role="search">
                <Search
                  className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  placeholder="Search chats..."
                  className="pl-8 h-8 text-xs bg-muted/50 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:border-primary transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search conversations"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 w-full min-w-0 [&>div>div]:!block [&>div>div]:!w-full">
              <div
                className="px-2 pb-4 space-y-1 w-full min-w-0"
                role="list"
                aria-label="Conversation list"
              >
                {isLoading ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">Loading chats...</div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    {searchQuery ? "No chats found." : "No conversations yet."}
                  </div>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  filteredConversations.map((chat: any) => (
                    <div key={chat.id} className="w-full min-w-0" onClick={() => router.push(`/chat/${chat.id}`)}>
                      <ConversationCard
                        title={chat.title}
                        time={formatRelativeTime(chat.updatedAt)}
                        model={MODEL_CATALOG.find((m) => m.id === chat.model)?.label || chat.model}
                        files={0}
                        isActive={params?.id === chat.id}
                        onRename={(newTitle) => {
                          updateConversation({ id: chat.id, data: { title: newTitle } });
                        }}
                      />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        <Separator />

        {/* Bottom Zone: User Menu */}
        <div className="p-3 flex flex-col gap-2 shrink-0">
          <div className={cn("mt-1", isCollapsed ? "mx-auto" : "")}>
            <UserMenu isCollapsed={isCollapsed} />
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
