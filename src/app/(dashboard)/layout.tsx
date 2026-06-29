import React from "react";

// Stub import for Sidebar - will be implemented in Step 5
function Sidebar() {
  return <div className="w-64 border-r bg-muted/20">Sidebar Stub</div>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
