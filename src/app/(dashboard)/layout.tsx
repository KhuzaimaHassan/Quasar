import React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground focus:top-0 focus:left-0 outline-none"
      >
        Skip to content
      </a>

      {/* Desktop Sidebar (hidden on mobile, visible on md+) */}
      <div className="hidden md:flex h-full shrink-0 z-40">
        <Sidebar />
      </div>

      {/* Main Content Area: Stacked Header + Page Content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main id="main-content" className="flex-1 overflow-auto flex relative">
          {children}
        </main>
      </div>
    </div>
  );
}
