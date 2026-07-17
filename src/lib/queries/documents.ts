import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed'

export interface Document {
  id: string
  workspaceId: string
  filename: string
  mimeType: string
  sizeBytes: number
  status: DocumentStatus
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
}

export function useDocuments(workspaceId: string | null) {
  return useQuery<Document[]>({
    queryKey: ['documents', workspaceId],
    queryFn: async () => {
      if (!workspaceId) throw new Error('workspaceId is required')
      const res = await fetch(`/api/documents?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error('Failed to fetch documents')
      return res.json()
    },
    enabled: !!workspaceId,
    refetchInterval: (query) => {
      const docs = query.state.data
      if (!docs) return false
      const isPolling = docs.some(
        (d) => d.status === 'pending' || d.status === 'processing'
      )
      return isPolling ? 3000 : false
    },
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ file, workspaceId }: { file: File; workspaceId: string }) => {
      // 1. Get presigned upload URL
      const uploadUrlRes = await fetch('/api/documents/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      })

      if (!uploadUrlRes.ok) {
        const err = await uploadUrlRes.json()
        throw new Error(err.message || 'Failed to get upload URL')
      }

      const { uploadUrl, documentId } = await uploadUrlRes.json()

      // Invalidate so the UI immediately shows the new document in the list as 'pending'
      queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] })

      // 2. Upload file bytes directly to Supabase Storage
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to storage')
      }

      // 3. Trigger ingestion pipeline
      const ingestRes = await fetch(`/api/documents/${documentId}/ingest`, {
        method: 'POST',
      })

      if (!ingestRes.ok) {
        const err = await ingestRes.json()
        throw new Error(err.message || 'Failed to trigger ingestion')
      }

      return { documentId }
    },
    onSettled: (_, __, variables) => {
      // Re-fetch document list once done (or failed) to pick up 'processing', 'ready', or 'failed' status
      queryClient.invalidateQueries({ queryKey: ['documents', variables.workspaceId] })
    },
  })
}
