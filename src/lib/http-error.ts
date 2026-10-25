export async function readHttpError(response: Response, fallback: string): Promise<string> {
  try {
    const data: unknown = await response.json()
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
      return data.message
    }
  } catch {
    // Platform errors may be plain text or HTML. Never display their raw body.
  }
  return response.status === 504
    ? 'The ingestion service took too long to respond. Please try again later.'
    : fallback
}
