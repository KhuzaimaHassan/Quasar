"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navGroups } from "@/lib/nav";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { UserMenu } from "./UserMenu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "flex h-full flex-col border-r bg-card transition-all duration-300",
          isCollapsed ? "w-[68px]" : "w-[260px]"
        )}
        aria-label="Sidebar Navigation"
      >
        {/* Top Zone: Logo + Workspace Switcher */}
        <div className="p-3 flex flex-col gap-3 min-h-[60px]">
          {!isCollapsed && (
            <div className="flex items-center px-2 pt-1 pb-2">
              <span className="text-xl font-bold tracking-tight">Quasar</span>
            </div>
          )}
          {isCollapsed ? (
            <div className="flex justify-center mt-2">
              <span className="font-bold text-xl leading-none" aria-hidden="true">Q</span>
            </div>
          ) : (
            <WorkspaceSwitcher />
          )}
        </div>

        <Separator />

        {/* Middle Zone: Nav Links */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="flex flex-col gap-6">
            {navGroups.map((group, groupIdx) => (
              <div key={groupIdx} className="flex flex-col gap-1.5">
                {!isCollapsed && (
                  <h4 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {group.label}
                  </h4>
                )}
                {isCollapsed && groupIdx !== 0 && (
                  <Separator className="my-2 mx-auto w-8" />
                )}
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
        </ScrollArea>

        <Separator />

        {/* Bottom Zone: Toggle & User Menu */}
        <div className="p-3 flex flex-col gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className={cn("text-muted-foreground hover:text-foreground focus-visible:ring-2", isCollapsed ? "mx-auto" : "ml-1")}
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{isCollapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
          </Tooltip>
          
          <div className={cn("mt-1", isCollapsed ? "mx-auto" : "")}>
            <UserMenu isCollapsed={isCollapsed} />
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
