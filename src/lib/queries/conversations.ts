import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useConversations(workspaceId?: string | null) {
  return useQuery({
    queryKey: ['conversations', workspaceId],
    queryFn: async () => {
      const url = workspaceId 
        ? `/api/conversations?workspaceId=${workspaceId}` 
        : '/api/conversations'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch conversations')
      return res.json()
    },
  })
}

export function useConversation(conversationId?: string | null) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}`)
      if (!res.ok) throw new Error('Failed to fetch conversation')
      return res.json()
    },
    enabled: !!conversationId,
    retry: false,
  })
}

export function useCreateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { workspaceId?: string; model?: string }) => {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create conversation')
      return res.json()
    },
    onSuccess: () => {
      // Invalidate both global and workspace-specific queries
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      return res.json()
    },
    enabled: !!conversationId,
    retry: false, // Don't retry infinitely on 404s
  })
}

export function useUpdateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { title?: string; model?: string } }) => {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update conversation')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete conversation')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}
