import { z } from 'zod'

export const createConversationSchema = z
  .object({
    workspaceId: z.string().uuid().optional(),
    model: z.string().optional().default('gemini-3.5-flash'),
  })
  .strict()

export const updateConversationSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    model: z.string().optional(),
  })
  .strict()
