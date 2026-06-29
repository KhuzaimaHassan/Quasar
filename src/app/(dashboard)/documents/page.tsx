import { FileText } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";

export default function DocumentsPage() {
  return (
    <div className="flex flex-col h-full w-full p-6 lg:p-10 max-w-6xl mx-auto gap-8">
      <PageHeader 
        title="Documents" 
        description="Upload and manage files to use as context for your AI models."
        icon={FileText}
      />
      <EmptyState 
        icon={FileText}
        title="Coming Soon"
        description="Document management and vector embeddings will be available in Phase 2."
      />
    </div>
  );
}
