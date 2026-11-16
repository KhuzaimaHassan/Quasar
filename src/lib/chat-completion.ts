import { getGenerationErrorMessage } from './generation-errors'

export type ChatCompletion = {
  status: 'complete' | 'incomplete'
  finishReason: string
  message?: string
}

export const CONTINUE_RESPONSE_PROMPT = 'Continue your previous answer from where it stopped. Do not repeat the existing text. Complete any unfinished section. If the earlier answer made unverified current-events claims, clarify that limitation rather than inventing updates.'

export function classifyCompletion(finishReason: string): ChatCompletion {
  if (finishReason === 'stop') return { status: 'complete', finishReason }
  const messages: Record<string, string> = {
    length: 'Response reached the model’s output limit. The text below may be incomplete.',
    'content-filter': 'Response was limited by the provider’s safety filters.',
    aborted: 'Generation was stopped. The partial response has been kept.',
    timeout: 'Generation reached its time limit. The partial response has been kept.',
    error: 'Generation failed before finishing. The partial response has been kept.',
  }
  return { status: 'incomplete', finishReason, message: messages[finishReason] ?? 'The model did not confirm a complete response. The partial text has been kept.' }
}

export function readCompletion(metadata: unknown): ChatCompletion | undefined {
  if (!metadata || typeof metadata !== 'object' || !('completion' in metadata)) return
  const value = metadata.completion
  if (!value || typeof value !== 'object' || !('finishReason' in value) || typeof value.finishReason !== 'string') return
  // Derive the user-facing copy from our allowlist, not provider metadata.
  return classifyCompletion(value.finishReason)
}

export type SavedReply = { text: string; tokenCount: number; tokenUsageAvailable: boolean; completion: ChatCompletion }

/** One settlement per request even when error/abort/end callbacks overlap. */
export function createReplyRecorder(options: {
  modelLabel: string
  timedOut: () => boolean
  saveReply: (reply: SavedReply) => Promise<void>
  recordFailure: (message: string) => Promise<void>
}) {
  let partialText = ''
  let settlement: Promise<void> | undefined
  const settle = (text: string, tokenCount: number | undefined, completion: ChatCompletion, emptyMessage: string) => {
    if (!settlement) {
      settlement = Promise.resolve().then(() => text.trim()
        ? options.saveReply({ text, tokenCount: tokenCount ?? 0, tokenUsageAvailable: tokenCount !== undefined, completion })
        : options.recordFailure(emptyMessage))
    }
    return settlement
  }
  return {
    onChunk({ chunk }: { chunk: { type: string; text?: string } }) {
      if (chunk.type === 'text-delta') partialText += chunk.text ?? ''
    },
    onFinish({ text, usage, finishReason }: { text: string; usage: { totalTokens?: number }; finishReason: string }) {
      return settle(text, usage.totalTokens, classifyCompletion(finishReason), `${options.modelLabel} returned no answer. Choose another model or try again later.`)
    },
    onError({ error }: { error: unknown }) {
      return settle(partialText, undefined, classifyCompletion('error'), getGenerationErrorMessage(error, options.modelLabel))
    },
    onAbort() {
      const reason = options.timedOut() ? 'timeout' : 'aborted'
      return settle(partialText, undefined, classifyCompletion(reason), options.timedOut()
        ? getGenerationErrorMessage(new DOMException('Timed out', 'TimeoutError'), options.modelLabel)
        : 'Generation was stopped before a complete response was received.')
    },
  }
}
