
import { FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Document } from "@/lib/queries/documents";

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function DocumentRow({ document }: { document: Document }) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-card transition-colors">
      <div className="flex items-center gap-4 overflow-hidden">
        <div className="p-2 rounded-md bg-muted text-muted-foreground shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="font-medium truncate" title={document.filename}>
            {document.filename}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatBytes(document.sizeBytes)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        {document.status === "pending" && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Uploading...</span>
          </div>
        )}
        {document.status === "processing" && (
          <div className="flex items-center gap-2 text-primary text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing...</span>
          </div>
        )}
        {document.status === "ready" && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>Ready</span>
          </div>
        )}
        {document.status === "failed" && (
          <div className="flex items-center gap-2 text-destructive text-sm" title={document.errorMessage || "Failed to process document"}>
            <AlertCircle className="w-4 h-4" />
            <span className="max-w-[120px] truncate hidden sm:inline-block">
              {document.errorMessage || "Failed"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
