import { useState } from 'react';
import { AgentRun, useResumeAgentRun, useCancelAgentRun } from '@/lib/queries/agent-runs';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/alert-dialog';
import { Loader2, Check, X } from 'lucide-react';



export function AwaitingApproval({ run }: { run: AgentRun }) {
  const resumeRun = useResumeAgentRun();
  const cancelRun = useCancelAgentRun();
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const pendingState = run.pendingApproval;
  if (!pendingState) return null;

  const msg = pendingState.msg || "The following files will be written:";
  const pendingFiles = pendingState.pendingFiles || [];

  const handleApprove = () => {
    resumeRun.mutate({ id: run.id, approved: true });
  };

  const handleReject = () => {
    cancelRun.mutate({ id: run.id });
    setShowRejectDialog(false);
  };

  const isPending = resumeRun.isPending || cancelRun.isPending;

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="space-y-1">
          <h3 className="font-medium text-sm">Processing...</h3>
          <p className="text-xs text-muted-foreground">This can take a moment as files are written.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-sm">Action Summary</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{msg}</p>
        
        {pendingFiles.length > 0 && (
          <div className="space-y-2 mt-4">
            <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Affected Files</h4>
            <ul className="list-disc list-inside text-sm space-y-1">
              {pendingFiles.map((file: string, i: number) => (
                <li key={i} className="font-mono text-xs">{file}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <Button onClick={handleApprove} className="flex-1 gap-2" size="sm">
          <Check className="h-4 w-4" />
          Approve & Write Files
        </Button>
        
        <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive hover:text-destructive gap-2" size="sm">
              <X className="h-4 w-4" />
              Reject
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject these changes?</AlertDialogTitle>
              <AlertDialogDescription>
                The agent&apos;s run will be cancelled and none of these files will be written. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Go Back</AlertDialogCancel>
              <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Reject Run
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
