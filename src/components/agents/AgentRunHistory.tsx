import { AgentRun } from '@/lib/queries/agent-runs';
import { formatRelativeTime } from '@/lib/utils';
import { Bot, CheckCircle2, Clock, XCircle, AlertCircle, PlayCircle } from 'lucide-react';

export function AgentRunHistory({ runs }: { runs: AgentRun[] }) {
  if (!runs || runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Bot className="h-8 w-8 mb-3 opacity-20" />
        <p className="text-sm font-medium">No agent runs yet</p>
        <p className="text-xs opacity-70 text-center mt-1">Start a task to see history</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-8">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Past Runs</h3>
      <div className="space-y-2">
        {runs.map((run) => (
          <div key={run.id} className="flex flex-col gap-1.5 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors cursor-default">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium truncate flex-1" title={`Agent Run ${run.id.slice(0, 8)}`}>
                {`Agent Run ${run.id.slice(0, 8)}`}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={run.status} />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatRelativeTime(run.startedAt)}
                </span>
              </div>
            </div>
            
            {(run.status === 'awaiting_approval') && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Waiting for your approval
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AgentRun['status'] }) {
  switch (status) {
    case 'completed':
      return (
        <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wide text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
          <CheckCircle2 className="h-3 w-3" /> Done
        </span>
      );
    case 'running':
    case 'pending':
      return (
        <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wide text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded animate-pulse">
          <PlayCircle className="h-3 w-3" /> Running
        </span>
      );
    case 'awaiting_approval':
      return (
        <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wide text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
          <Clock className="h-3 w-3" /> Approval
        </span>
      );
    case 'failed':
      return (
        <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wide text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
          <AlertCircle className="h-3 w-3" /> Failed
        </span>
      );
    case 'cancelled':
      return (
        <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          <XCircle className="h-3 w-3" /> Cancelled
        </span>
      );
    default:
      return null;
  }
}
