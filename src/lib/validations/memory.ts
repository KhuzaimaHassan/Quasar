import { z } from "zod"

export const createMemorySchema = z.object({
  scope: z.enum(['preference', 'project', 'style', 'fact']),
  key: z.string().min(1, "Key is required"),
  value: z.string().min(1, "Value is required"),
}).strict()

export const updateMemorySchema = z.object({
  value: z.string().min(1, "Value is required"),
}).strict()

export const extractedMemorySchema = createMemorySchema.extend({
  confidence: z.number().gt(0.6).max(1),
}).strict()

export type CreateMemoryInput = z.infer<typeof createMemorySchema>
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>
