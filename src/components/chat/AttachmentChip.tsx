import { FileText } from "lucide-react";
import { attachmentFilePath, formatFileSize, isImageMimeType } from "@/lib/attachment-types";

interface AttachmentChipProps {
  id: string;
  conversationId?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export function AttachmentChip({ id, conversationId, filename, mimeType, sizeBytes, url }: AttachmentChipProps) {
  const isImage = isImageMimeType(mimeType);
  // Persisted messages resolve a fresh capability on every open/image load.
  // Optimistic drafts retain their just-uploaded URL until message persistence.
  const fileUrl = conversationId ? attachmentFilePath(conversationId, id) : url;

  if (isImage) {
    return (
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block group relative overflow-hidden rounded-lg border bg-muted/50 transition-opacity hover:opacity-90 max-w-[200px]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileUrl}
          alt={filename}
          className="h-auto w-full object-cover max-h-48"
          loading="lazy"
        />
        <div className="absolute inset-x-0 bottom-0 bg-background/80 px-2 py-1 text-[10px] backdrop-blur flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="truncate mr-2 font-medium">{filename}</span>
          <span className="shrink-0 text-muted-foreground">{formatFileSize(sizeBytes)}</span>
        </div>
      </a>
    );
  }

  // Non-image attachments (PDF/DOCX)
  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 transition-colors hover:bg-muted max-w-[250px]"
    >
      <div className="rounded-md bg-background p-1.5 shadow-sm shrink-0 text-muted-foreground">
        <FileText className="h-4 w-4" />
      </div>
      <div className="flex flex-col min-w-0 overflow-hidden">
        <span className="truncate text-sm font-medium leading-none mb-1 text-foreground">{filename}</span>
        <span className="text-[10px] text-muted-foreground leading-none">{formatFileSize(sizeBytes)}</span>
      </div>
    </a>
  );
}
