"use client";

import { ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspaces, useCreateWorkspace } from "@/lib/queries/workspaces";
import { useWorkspace } from "@/components/providers/workspace-provider";

export function WorkspaceSwitcher() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const { mutate: createWorkspace, isPending: isCreatingWorkspace } = useCreateWorkspace();
  const { activeWorkspace, setActiveWorkspace } = useWorkspace();
  
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const currentWorkspaceName = activeWorkspace?.name || "Select Workspace";

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createWorkspace({ name: newName }, {
      onSuccess: (newWs) => {
        setActiveWorkspace(newWs);
        setIsCreating(false);
        setNewName("");
      }
    });
  };

  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) setIsCreating(false) }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between px-2 py-1.5 h-auto text-sm font-medium"
        >
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="truncate">Loading...</span>
            </div>
          ) : (
            <>
              <span className="truncate">{currentWorkspaceName}</span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" align="start">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-medium uppercase">
          Workspaces
        </DropdownMenuLabel>
        
        {!isLoading && workspaces?.map((workspace: any) => (
          <DropdownMenuItem 
            key={workspace.id} 
            className="cursor-pointer"
            onSelect={() => setActiveWorkspace(workspace)}
          >
            <span className="truncate">{workspace.name}</span>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        {isCreating ? (
          <form onSubmit={handleCreate} className="px-2 py-1.5">
            <input
              autoFocus
              disabled={isCreatingWorkspace}
              placeholder="Workspace name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </form>
        ) : (
          <DropdownMenuItem 
            className="cursor-pointer text-muted-foreground"
            onSelect={(e) => {
              e.preventDefault(); // Keep dropdown open
              setIsCreating(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>New workspace</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
