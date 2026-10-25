import { useState } from "react";
import { FileText, Loader2, CheckCircle, AlertCircle, Trash2, RotateCcw } from "lucide-react";
import { Document, useDeleteDocument, useRetryDocument } from "@/lib/queries/documents";
import { canRetryDocument, isStaleUpload } from "@/lib/document-status";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function DocumentRow({ document }: { document: Document }) {
  const { mutate: deleteDocument, isPending: isDeleting } = useDeleteDocument();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const retry = useRetryDocument();

  const isProcessing = document.status === "processing";
  const needsIndexing = document.status === 'ready' && document.chunkCount === 0;

  return (
    <div className={`flex items-center justify-between p-4 border rounded-lg bg-card transition-colors ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}>
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

      <div className="flex flex-wrap justify-end items-center gap-2 shrink-0 ml-4 max-w-[60%]">
        {document.status === "pending" && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            {isStaleUpload(document) ? <AlertCircle className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isStaleUpload(document) ? 'Upload interrupted' : 'Uploading...'}</span>
          </div>
        )}
        {document.status === "processing" && (
          <div className="flex items-center gap-2 text-primary text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing...</span>
          </div>
        )}
        {document.status === "ready" && !needsIndexing && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>Ready</span>
          </div>
        )}
        {needsIndexing && <span className="text-sm text-muted-foreground">Needs indexing</span>}
        {document.status === "failed" && (
          <div className="flex items-center gap-2 text-destructive text-sm" title={document.errorMessage || "Failed to process document"}>
            <AlertCircle className="w-4 h-4" />
            <span className="max-w-[120px] truncate hidden sm:inline-block">
              {document.errorMessage || "Failed"}
            </span>
          </div>
        )}

        {canRetryDocument(document) && (
          <Button variant="outline" size="sm" disabled={retry.isPending || isDeleting}
            aria-label={`Retry processing ${document.filename}`}
            onClick={() => retry.mutate({ documentId: document.id, workspaceId: document.workspaceId })}>
            {retry.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            <span className="ml-1">Retry</span>
          </Button>
        )}
        {retry.isError && <span role="alert" className="max-w-48 text-xs text-destructive">{retry.error.message}</span>}
        
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2 h-8 w-8 text-muted-foreground hover:text-destructive"
              disabled={isProcessing || isDeleting || retry.isPending}
              aria-label={`Delete ${document.filename}`}
              title={isProcessing ? "Cannot delete while processing" : "Delete document"}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the document &quot;{document.filename}&quot; from the workspace. 
                Any associated chunks and vectors will also be removed. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  deleteDocument({ documentId: document.id });
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
