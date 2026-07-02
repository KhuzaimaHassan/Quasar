"use client";

import { useState } from "react";
import { Search, Bell, Menu, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sidebar } from "./Sidebar";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/providers/workspace-provider";

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { activeWorkspace } = useWorkspace();

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b bg-background px-4 lg:px-6 z-30 shrink-0">
        
        {/* Left Side: Mobile Hamburger & Workspace Context */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden -ml-2 text-muted-foreground hover:text-foreground focus-visible:ring-2"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Quasar</span>
            <span className="text-muted-foreground" aria-hidden="true">/</span>
            <span className="font-medium text-foreground">{activeWorkspace?.name || 'Loading...'}</span>
          </nav>
        </div>

        {/* Center: Search */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="relative w-full max-w-md hidden md:flex items-center" role="search">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              placeholder="Search conversations, files, or commands..."
              className="w-full bg-muted/50 border-transparent pl-9 pr-4 focus-visible:bg-background focus-visible:ring-2 focus-visible:border-primary h-9 rounded-full transition-colors"
              aria-label="Search across your workspace"
            />
          </div>
        </div>

        {/* Right Side: Actions & Profile */}
        <div className="flex items-center gap-3 lg:gap-5 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-full hover:bg-accent/60 focus-visible:ring-2" aria-label="Toggle theme">
              <Moon className="h-[18px] w-[18px]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-full relative hover:bg-accent/60 focus-visible:ring-2" aria-label="View notifications">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary border-2 border-background" />
            </Button>
          </div>
          
          <UserButton 
            appearance={{
              elements: {
                userButtonAvatarBox: "h-8 w-8 border border-border hover:opacity-80 transition-opacity"
              }
            }}
          />
        </div>
      </header>

      {/* Mobile Sidebar Overlay & Drawer */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform duration-300 ease-in-out md:hidden shadow-xl",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full w-full bg-card flex flex-col [&>aside]:flex [&>aside]:w-full">
           <Sidebar />
        </div>
      </div>
    </>
  );
}
