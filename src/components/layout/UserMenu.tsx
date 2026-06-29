"use client";

import { LogOut, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  isCollapsed?: boolean;
}

export function UserMenu({ isCollapsed = false }: UserMenuProps) {
  // Placeholder data
  const user = {
    displayName: "John Doe",
    email: "john.doe@example.com",
    initials: "JD",
    plan: "Pro",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={`w-full flex items-center h-auto py-2 hover:bg-accent ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-3 px-2'}`}
        >
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{user.initials}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex items-center justify-between flex-1 overflow-hidden">
              <span className="truncate text-sm font-medium">{user.displayName}</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-bold tracking-wide rounded-sm bg-primary/10 text-primary border-none">
                {user.plan}
              </Badge>
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 mb-2" align={isCollapsed ? "center" : "start"} side="right" sideOffset={12}>
        <DropdownMenuLabel className="font-normal p-3">
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold leading-none">{user.displayName}</p>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-bold tracking-wide rounded-sm bg-primary/10 text-primary border-none">{user.plan}</Badge>
            </div>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="p-1">
          <DropdownMenuItem className="cursor-pointer gap-2 py-2 rounded-md">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Upgrade to Pro</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer gap-2 py-2 rounded-md">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span>Settings</span>
          </DropdownMenuItem>
        </div>
        
        <DropdownMenuSeparator />
        <div className="p-1">
          <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive gap-2 py-2 rounded-md">
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
