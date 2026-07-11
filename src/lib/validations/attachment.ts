import { z } from 'zod'

/** Allowed MIME types for chat attachments */
export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

/** Maximum file size: 25MB in bytes */
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25MB

export const uploadUrlSchema = z
  .object({
    filename: z.string().min(1, 'Filename is required').max(255),
    mimeType: z.enum(ALLOWED_MIME_TYPES, {
      message: `File type not allowed. Accepted: PNG, JPEG, PDF, DOCX`,
    }),
    sizeBytes: z
      .number()
      .int()
      .positive('File size must be positive')
      .max(MAX_FILE_SIZE_BYTES, `File size must not exceed 25MB`),
  })
  .strict()

export type UploadUrlInput = z.infer<typeof uploadUrlSchema>
