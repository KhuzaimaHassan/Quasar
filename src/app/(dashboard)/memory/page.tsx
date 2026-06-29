import { Brain } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

export default function MemoryPage() {
  return (
    <div className="flex flex-col h-full w-full p-6 lg:p-10 max-w-6xl mx-auto gap-8">
      <PageHeader 
        title="Memory" 
        description="Manage what Quasar remembers about your preferences, projects, and facts."
        icon={Brain}
        action={<Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">Clear all</Button>}
      />
      <EmptyState 
        icon={Brain}
        title="Coming Soon"
        description="Long-term persistent memory and personalized facts will be available in Phase 3."
      />
    </div>
  );
}
