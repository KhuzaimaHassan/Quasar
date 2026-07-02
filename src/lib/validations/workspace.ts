import { z } from 'zod'

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name must be at least 1 character').max(100, 'Name must be 100 characters or less'),
}).strict()

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name must be at least 1 character').max(100, 'Name must be 100 characters or less').optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
}).strict()
