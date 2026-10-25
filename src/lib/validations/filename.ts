import { z } from 'zod'

export const filenameSchema = z.string().min(1, 'Filename is required').max(255).refine(
  (name) => name !== '.' && name !== '..' && !/[/\\\x00-\x1F\x7F]/.test(name) && !/%(?:2e|2f|5c|00|25)/i.test(name),
  'Use a filename without directory separators or control characters',
)
