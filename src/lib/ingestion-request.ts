// Leave time for the route to record a failure before Vercel's 120-second limit.
export const INGESTION_TIMEOUT_MS = 90_000

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
