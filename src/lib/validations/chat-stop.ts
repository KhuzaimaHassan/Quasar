import { z } from 'zod'

export const stopChatSchema = z.object({
  generationId: z.string().uuid(),
  text: z.string().max(100_000),
}).strict()
