import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await fetch('/api/workspaces')
      if (!res.ok) throw new Error('Failed to fetch workspaces')
      return res.json()
    },
  })
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create workspace')
      return res.json()
    },
    onSuccess: async (workspace) => {
      // Put the created row in the cache before the switcher activates it.
      // Otherwise the provider sees an unknown workspace and resets selection.
      queryClient.setQueryData(['workspaces'], (current: typeof workspace[] | undefined) =>
        [...(current ?? []).filter((item) => item.id !== workspace.id), workspace]
      )
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}
