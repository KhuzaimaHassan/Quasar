import { FolderGit2 } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
  return (
    <div className="flex flex-col h-full w-full p-6 lg:p-10 max-w-6xl mx-auto gap-8">
      <PageHeader 
        title="Projects" 
        description="Organize your chats, documents, and agents into dedicated workspaces."
        icon={FolderGit2}
        action={<Button>Create Project</Button>}
      />
      <EmptyState 
        icon={FolderGit2}
        title="Coming Soon"
        description="Project management and workspace isolation will be available in Phase 2."
      />
    </div>
  );
}
