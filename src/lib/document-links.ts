/** Persist a document identity, rather than an expiring storage capability. */
export function documentDownloadPath(documentId: string): string {
  return `/api/documents/${encodeURIComponent(documentId)}/download`;
}
