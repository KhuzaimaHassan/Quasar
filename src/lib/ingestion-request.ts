// Observed Render startup consumed ~87 seconds before the app became ready.
// Allow handoff margin and leave 30 seconds for the route to return a safe error.
export const INGESTION_TIMEOUT_MS = 150_000

export async function requestIngestion(
  serviceUrl: string,
  internalSecret: string,
  documentId: string,
  timeoutMs = INGESTION_TIMEOUT_MS,
): Promise<Response> {
  return fetch(`${serviceUrl.replace(/\/$/, '')}/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': internalSecret,
    },
    body: JSON.stringify({ document_id: documentId }),
    signal: AbortSignal.timeout(timeoutMs),
  })
}
