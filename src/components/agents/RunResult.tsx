import { AgentRun } from '@/lib/queries/agent-runs';
import { CheckCircle2, XCircle, FileCode } from 'lucide-react';

export function RunResult({ run }: { run: AgentRun }) {
  if (run.status === 'cancelled') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted text-sm">
          <XCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1 text-foreground">Run Cancelled</p>
            <p className="text-muted-foreground">This run was cancelled, no files were written.</p>
          </div>
        </div>
      </div>
    );
  }

  // Completed status
  const toolCalls = Array.isArray(run.toolCalls) ? run.toolCalls : [];
  // Filter tool calls to only those that wrote files (if we want to be specific, or list all write_file tool calls)
  const writtenFiles = toolCalls
    .filter((call: any) => call.tool === 'write_file' || call.tool === 'create_or_update_file')
    .map((call: any) => call.args?.file_path || call.args?.path || 'Unknown file');

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium mb-2 text-emerald-700 dark:text-emerald-400">Run Completed Successfully</p>
          {writtenFiles.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Files written:</p>
              <div className="space-y-1">
                {writtenFiles.map((file: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono bg-background/50 px-2 py-1 rounded border border-border/50 truncate">
                    <FileCode className="h-3 w-3 shrink-0" />
                    <span className="truncate">{file}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Completed without writing files.</p>
          )}
        </div>
      </div>
    </div>
  );
}
