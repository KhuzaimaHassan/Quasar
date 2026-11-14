import { FileText } from "lucide-react";
import { documentDownloadPath } from "@/lib/document-links";

export interface CitationProps {
  documentId: string;
  filename: string;
  url: string;
  similarity?: number;
}

export function CitationChip({ documentId, filename }: CitationProps) {
  return (
    <a
      href={documentDownloadPath(documentId)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Download source: ${filename}`}
      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground mr-2 mb-2"
    >
      <FileText className="h-3 w-3" />
      <span className="truncate max-w-[150px]">{filename}</span>
    </a>
  );
}
