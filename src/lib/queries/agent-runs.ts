import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type AgentRunStatus = 'pending' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled'

export interface AgentRun {
  id: string
  conversationId: string
  threadId: string
  status: AgentRunStatus
  toolCalls: any
  totalTokens: number
  pendingApproval?: any
  errorMessage?: string | null
  startedAt: string
  endedAt?: string | null
}

export function useAgentRuns(conversationId: string | null) {
  return useQuery<AgentRun[]>({
    queryKey: ['agentRuns', conversationId],
    queryFn: async () => {
      if (!conversationId) throw new Error('conversationId is required')
      const res = await fetch(`/api/agents/run?conversationId=${conversationId}`)
      if (!res.ok) throw new Error('Failed to fetch agent runs')
      return res.json()
    },
    enabled: !!conversationId,
  })
}

export function useAgentRun(id: string | null) {
  return useQuery<AgentRun>({
    queryKey: ['agentRun', id],
    queryFn: async () => {
      if (!id) throw new Error('id is required')
      const res = await fetch(`/api/agents/run/${id}`)
      if (!res.ok) throw new Error('Failed to fetch agent run')
      return res.json()
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const run = query.state.data
      if (!run) return false
      const isPolling = run.status === 'running' || run.status === 'awaiting_approval'
      return isPolling ? 3000 : false
    },
  })
}

export function useStartAgentRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ conversationId, workspaceId, task }: { conversationId: string, workspaceId: string, task: string }) => {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, workspaceId, task }),
      })

      if (!res.ok) {
        let errMessage = 'Failed to start agent run'
        try {
          const err = await res.json()
          errMessage = err.message || errMessage
        } catch {}
        throw new Error(errMessage)
      }

      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agentRuns', variables.conversationId] })
    },
  })
}

export function useResumeAgentRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, approved }: { id: string, approved: boolean }) => {
      const res = await fetch(`/api/agents/run/${id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      })

      if (!res.ok) {
        let errMessage = 'Failed to resume agent run'
        try {
          const err = await res.json()
          errMessage = err.message || errMessage
        } catch {}
        throw new Error(errMessage)
      }

      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agentRun', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['agentRuns'] })
    },
  })
}

export function useCancelAgentRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await fetch(`/api/agents/run/${id}/cancel`, {
        method: 'POST',
      })

      if (!res.ok) {
        let errMessage = 'Failed to cancel agent run'
        try {
          const err = await res.json()
          errMessage = err.message || errMessage
        } catch {}
        throw new Error(errMessage)
      }

      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agentRun', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['agentRuns'] })
    },
  })
}
