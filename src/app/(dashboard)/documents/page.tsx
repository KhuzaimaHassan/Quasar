"use client";

import { FileText, Loader2 } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { DocumentUploadZone } from "@/components/documents/DocumentUploadZone";
import { DocumentRow } from "@/components/documents/DocumentRow";
import { useDocuments } from "@/lib/queries/documents";
import { useWorkspace } from "@/components/providers/workspace-provider";

export default function DocumentsPage() {
  const { activeWorkspace } = useWorkspace();
  const { data: documents, isLoading } = useDocuments(activeWorkspace?.id ?? null);

  return (
    <div className="flex flex-col h-full w-full p-6 lg:p-10 max-w-6xl mx-auto gap-8">
      <PageHeader 
        title="Documents" 
        description="Upload and manage files to use as context for your AI models."
        icon={FileText}
      />
      
      <div className="flex flex-col gap-8">
        <DocumentUploadZone />
        
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Your Documents</h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : documents && documents.length > 0 ? (
            <div className="flex flex-col gap-3">
              {documents.map((doc) => (
                <DocumentRow key={doc.id} document={doc} />
              ))}
            </div>
          ) : (
            <EmptyState 
              icon={FileText}
              title="No documents uploaded yet"
              description="Drag and drop your PDF or DOCX files above to get started."
            />
          )}
        </div>
      </div>
    </div>
  );
}
