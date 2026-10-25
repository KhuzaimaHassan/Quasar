export const STALE_UPLOAD_MS = 5 * 60_000

type DocumentState = { status: string; updatedAt: string | Date; chunkCount?: number }

export function isStaleUpload(document: DocumentState, now = Date.now()): boolean {
  const updatedAt = document.updatedAt instanceof Date ? document.updatedAt.getTime() : Date.parse(document.updatedAt)
  return document.status === 'pending' && now - updatedAt >= STALE_UPLOAD_MS
}

export function canRetryDocument(document: DocumentState, now = Date.now()): boolean {
  return document.status === 'failed' || (document.status === 'ready' && document.chunkCount === 0) || isStaleUpload(document, now)
}

export function shouldPollDocument(document: DocumentState, now = Date.now()): boolean {
  return document.status === 'processing' || (document.status === 'pending' && !isStaleUpload(document, now))
}
