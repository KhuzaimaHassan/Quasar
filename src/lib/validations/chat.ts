import { z } from 'zod'

const messageSchema = z.looseObject({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(100_000).optional(),
  parts: z.array(z.looseObject({ type: z.string(), text: z.string().max(100_000).optional() })).max(50).optional(),
})

export const chatMessagesSchema = z.array(messageSchema).min(1).refine(
  (messages) => messages[messages.length - 1].role === 'user',
  'The last message must be a user message',
)

export function canRetryMessage(
  message: { id: string; role: string; content: string } | null,
  retryMessageId: string,
  content: string,
): boolean {
  return message?.id === retryMessageId && message.role === 'user' && message.content === content
}
