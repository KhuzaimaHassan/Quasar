import { Client } from 'langsmith'

export const isTracingEnabled =
  (process.env.LANGCHAIN_TRACING_V2 === 'true' || process.env.LANGCHAIN_TRACING_V2 === '1') &&
  Boolean(process.env.LANGCHAIN_API_KEY)

let clientInstance: Client | null = null
function getClient(): Client {
  if (!clientInstance) {
    clientInstance = new Client({
      apiKey: process.env.LANGCHAIN_API_KEY,
      apiUrl: process.env.LANGCHAIN_ENDPOINT || 'https://api.smith.langchain.com',
    })
  }
  return clientInstance
}

/**
 * Redacts secrets and sensitive fields from trace metadata
 */
export function sanitizeTraceMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  const sensitiveKeys = ['key', 'secret', 'token', 'password', 'authorization']

  for (const [k, v] of Object.entries(metadata)) {
    const isSensitive = sensitiveKeys.some(s => k.toLowerCase().includes(s) && !k.toLowerCase().includes('count'))
    if (isSensitive) {
      sanitized[k] = '[REDACTED]'
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      sanitized[k] = sanitizeTraceMetadata(v as Record<string, unknown>)
    } else {
      sanitized[k] = v
    }
  }

  return sanitized
}

/**
 * Executes an LLM generation with LangSmith tracing enabled when configured.
 * Gracefully degrades to direct execution if tracing fails or is unconfigured.
 */
export async function traceChatGeneration<T>(
  name: string,
  executor: () => Promise<T> | T,
  metadata?: Record<string, unknown>
): Promise<T> {
  if (!isTracingEnabled) {
    return await executor()
  }

  const runId = crypto.randomUUID()
  const client = getClient()
  const startTime = Date.now()

  try {
    await client.createRun({
      id: runId,
      name,
      run_type: 'llm',
      project_name: process.env.LANGCHAIN_PROJECT || 'quasar',
      inputs: metadata ? sanitizeTraceMetadata(metadata) : {},
      start_time: startTime,
      extra: {
        metadata: metadata ? sanitizeTraceMetadata(metadata) : {},
        tags: ['chat', 'nextjs-api'],
      },
    })
  } catch (err) {
    console.warn('[LANGSMITH_CREATE_RUN_ERROR]', err)
  }

  try {
    const result = await executor()
    try {
      await client.updateRun(runId, {
        outputs: { success: true, latencyMs: Date.now() - startTime },
        end_time: Date.now(),
      })
    } catch (err) {
      console.warn('[LANGSMITH_UPDATE_RUN_ERROR]', err)
    }
    return result
  } catch (err) {
    try {
      await client.updateRun(runId, {
        error: err instanceof Error ? err.message : String(err),
        end_time: Date.now(),
      })
    } catch (updateErr) {
      console.warn('[LANGSMITH_UPDATE_RUN_ERROR]', updateErr)
    }
    throw err
  }
}
