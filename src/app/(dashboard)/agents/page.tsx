import { Bot } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

export default function AgentsPage() {
  return (
    <div className="flex flex-col h-full w-full p-6 lg:p-10 max-w-6xl mx-auto gap-8">
      <PageHeader 
        title="Agents" 
        description="Create and manage autonomous AI agents to perform complex multi-step workflows."
        icon={Bot}
        action={<Button>Create Agent</Button>}
      />
      <EmptyState 
        icon={Bot}
        title="Coming Soon"
        description="Autonomous agents and custom tool integrations will be available in Phase 4."
      />
    </div>
  );
}
