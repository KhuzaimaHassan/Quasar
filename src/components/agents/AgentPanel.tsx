import { useState } from 'react';
import { useAgentRuns, useStartAgentRun } from '@/lib/queries/agent-runs';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Bot, Loader2, AlertCircle } from 'lucide-react';
import { AwaitingApproval } from './AwaitingApproval';
import { RunResult } from './RunResult';
import { AgentRunHistory } from './AgentRunHistory';

export function AgentPanel({ conversationId, workspaceId }: { conversationId: string; workspaceId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: runs = [] } = useAgentRuns(conversationId);
  const startRun = useStartAgentRun();
  
  const [task, setTask] = useState('');
  const [executionTarget, setExecutionTarget] = useState<'sandbox' | 'github'>('sandbox');
  const [targetRepo, setTargetRepo] = useState('');

  // Find the most recent run
  const activeRun = runs.length > 0 ? runs[0] : null;
  const isResolved = activeRun?.status === 'completed' || activeRun?.status === 'failed' || activeRun?.status === 'cancelled';
  const showInput = !activeRun || isResolved;

  const handleStart = () => {
    if (!task.trim()) return;
    if (executionTarget === 'github' && !targetRepo.trim()) return;
    startRun.mutate({ 
      conversationId, 
      workspaceId, 
      task,
      executionTarget,
      targetRepo: executionTarget === 'github' ? targetRepo.trim() : undefined
    });
  };

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="h-8 gap-2">
        <Bot className="h-4 w-4" />
        Agent
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <div className="absolute top-14 right-4 z-20 w-[450px] max-w-[calc(100vw-32px)] bg-background border border-border shadow-xl rounded-xl flex flex-col max-h-[80vh] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2 font-medium text-sm">
          <Bot className="h-4 w-4 text-primary" />
          Agent Runs
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {startRun.isPending || activeRun?.status === 'pending' || activeRun?.status === 'running' ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="space-y-1">
              <h3 className="font-medium text-sm">Agent is working</h3>
              <p className="text-xs text-muted-foreground">Planning and generating — this can take up to a minute.</p>
            </div>
          </div>
        ) : activeRun?.status === 'awaiting_approval' ? (
          <AwaitingApproval run={activeRun} />
        ) : activeRun?.status === 'failed' && !showInput ? (
          <div className="space-y-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Agent Run Failed</p>
                <p className="text-xs opacity-90 break-words">{activeRun.errorMessage || 'An unknown error occurred.'}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setTask(task)} className="w-full">
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeRun && isResolved && <RunResult run={activeRun} />}
            <div className="space-y-2">
              <textarea 
                placeholder="Give the agent a complex, multi-step task..."
                value={task}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTask(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
              
              <div className="flex flex-col gap-2 pt-1 pb-2">
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="radio" 
                      name="executionTarget" 
                      value="sandbox"
                      checked={executionTarget === 'sandbox'}
                      onChange={() => setExecutionTarget('sandbox')}
                      className="accent-primary"
                    />
                    Generate files only
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="radio" 
                      name="executionTarget" 
                      value="github"
                      checked={executionTarget === 'github'}
                      onChange={() => setExecutionTarget('github')}
                      className="accent-primary"
                    />
                    Commit to GitHub
                  </label>
                </div>
                
                {executionTarget === 'github' && (
                  <input
                    type="text"
                    placeholder="owner/repo-name"
                    value={targetRepo}
                    onChange={(e) => setTargetRepo(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                )}
              </div>

              <Button onClick={handleStart} disabled={!task.trim() || (executionTarget === 'github' && !targetRepo.trim())} className="w-full" size="sm">
                Run Agent
              </Button>
              {startRun.isError && (
                <div className="p-3 mt-2 rounded-md bg-destructive/10 text-destructive text-sm flex items-start gap-2 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p className="leading-tight">{startRun.error?.message || 'Failed to start agent'}</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        <AgentRunHistory runs={runs} />
      </div>
    </div>
  );
}
