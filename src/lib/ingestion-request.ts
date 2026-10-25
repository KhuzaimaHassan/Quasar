import { BACKEND_REQUEST_TIMEOUT_MS, postToBackend } from '@/lib/backend-request'

// Observed Render startup consumed ~87 seconds before the app became ready.
// Allow handoff margin and leave 30 seconds for the route to return a safe error.
export const INGESTION_TIMEOUT_MS = BACKEND_REQUEST_TIMEOUT_MS

export async function requestIngestion(
  serviceUrl: string,
  internalSecret: string,
  documentId: string,
  timeoutMs = INGESTION_TIMEOUT_MS,
): Promise<Response> {
  return postToBackend(serviceUrl, internalSecret, '/ingest', { document_id: documentId }, { timeoutMs })
}
