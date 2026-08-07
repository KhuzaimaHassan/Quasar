import { AgentRun } from '@/lib/queries/agent-runs';
import { CheckCircle2, XCircle, FileCode, AlertCircle } from 'lucide-react';

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

  if (run.status === 'failed') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">Agent Run Failed</p>
            <p className="text-xs opacity-90 break-words">{run.errorMessage || 'An unknown error occurred during the agent run.'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Completed status
  const toolCalls = Array.isArray(run.toolCalls) ? run.toolCalls : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const githubCalls = toolCalls.filter((call: any) => call.tool === 'github.create_or_update_file');
  const isGithubRun = githubCalls.length > 0;
  
  const writtenFiles = toolCalls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((call: any) => call.tool === 'filesystem.write_file' || call.tool === 'github.create_or_update_file')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((call: any) => ({
      path: call.args?.file_path || call.args?.path || call.path || 'Unknown file',
      url: call.result?.commit?.html_url || call.result?.content?.html_url
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium mb-2 text-emerald-700 dark:text-emerald-400">Run Completed Successfully</p>
          {writtenFiles.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {isGithubRun ? "Committed files:" : "Files written:"}
              </p>
              <div className="space-y-1">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {writtenFiles.map((file: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs font-mono bg-background/50 px-2 py-1 rounded border border-border/50 truncate">
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className="h-3 w-3 shrink-0" />
                      <span className="truncate">{file.path}</span>
                    </div>
                    {isGithubRun && file.url && (
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline shrink-0 ml-2">
                        View Commit
                      </a>
                    )}
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
