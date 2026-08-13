"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Sidebar } from "./Sidebar";
import { UserButton, ClerkLoaded } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useTheme } from "next-themes";

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { activeWorkspace } = useWorkspace();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  // Close the mobile menu whenever the route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

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

        {/* Right Side: Actions & Profile */}
        <div className="flex items-center gap-3 lg:gap-5 shrink-0 ml-auto">
          <div className="hidden sm:flex items-center gap-1.5">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground rounded-full hover:bg-accent/60 focus-visible:ring-2" 
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Moon className="h-[18px] w-[18px]" />
            </Button>
          </div>
          
          <ClerkLoaded>
            <UserButton 
              appearance={{
                elements: {
                  userButtonAvatarBox: "h-8 w-8 border border-border hover:opacity-80 transition-opacity"
                }
              }}
            />
          </ClerkLoaded>
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
