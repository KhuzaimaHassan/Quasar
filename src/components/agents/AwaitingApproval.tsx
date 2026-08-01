import { useState } from 'react';
import { AgentRun, useResumeAgentRun, useCancelAgentRun } from '@/lib/queries/agent-runs';
import { Button } from '@/components/ui/button';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
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

// Reuse Streamdown components similar to MessageBubble
const streamdownComponents = {
  table: ({ children, ...props }: any) => (
    <div className="overflow-x-auto my-4 rounded-xl border border-border">
      <table className="w-full text-sm text-left divide-y divide-border" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }: any) => (
    <th className="bg-muted/50 px-4 py-2 font-semibold" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: any) => (
    <td className="px-4 py-2" {...props}>
      {children}
    </td>
  ),
};

export function AwaitingApproval({ run }: { run: AgentRun }) {
  const resumeRun = useResumeAgentRun();
  const cancelRun = useCancelAgentRun();
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const pendingState = run.pendingApproval;
  if (!pendingState) return null;

  const plan = pendingState.plan || [];
  const files = pendingState.files || [];

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
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Agent Plan</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
          {plan.map((step: string, i: number) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-sm">Files to Write</h3>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files modified.</p>
        ) : (
          <div className="space-y-4">
            {files.map((file: { path: string; content: string }, i: number) => (
              <div key={i} className="border border-border rounded-lg overflow-hidden bg-muted/10">
                <div className="bg-muted px-3 py-2 text-xs font-mono font-medium border-b border-border">
                  {file.path}
                </div>
                <div className="p-3 text-sm max-h-60 overflow-y-auto [&_[data-streamdown='code-block']]:text-foreground [&_[data-streamdown='inline-code']]:text-foreground">
                  <Streamdown mode="static" components={streamdownComponents} plugins={{ code }}>
                    {file.content}
                  </Streamdown>
                </div>
              </div>
            ))}
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
                The agent's run will be cancelled and none of these files will be written. This action cannot be undone.
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
