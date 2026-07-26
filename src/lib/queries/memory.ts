import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Memory } from "@prisma/client"
import { CreateMemoryInput, UpdateMemoryInput } from "../validations/memory"

export function useMemories() {
  return useQuery({
    queryKey: ['memories'],
    queryFn: async () => {
      const res = await fetch('/api/memory')
      if (!res.ok) {
        throw new Error('Failed to fetch memories')
      }
      return res.json() as Promise<Memory[]>
    }
  })
}

export function useCreateMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateMemoryInput) => {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        throw new Error('Failed to create memory')
      }
      return res.json() as Promise<Memory>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    }
  })
}

export function useUpdateMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateMemoryInput }) => {
      const res = await fetch(`/api/memory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        throw new Error('Failed to update memory')
      }
      return res.json() as Promise<Memory>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    }
  })
}

export function useDeleteMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/memory/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error('Failed to delete memory')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    }
  })
}

export function useClearMemories() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/memory', {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error('Failed to clear memories')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    }
  })
}
