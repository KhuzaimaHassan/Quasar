import { z } from 'zod'
import { DEFAULT_MODEL_ID, MODEL_CATALOG, resolveModelId } from '@/lib/models'

const modelSchema = z.string().transform(resolveModelId).refine(
  (id) => MODEL_CATALOG.some((model) => model.id === id),
  'Select a supported model',
)

export const createConversationSchema = z
  .object({
    workspaceId: z.string().uuid().optional(),
    model: modelSchema.default(DEFAULT_MODEL_ID),
  })
  .strict()

export const updateConversationSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    model: modelSchema.optional(),
  })
  .strict()
