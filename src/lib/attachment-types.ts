/** Represents a fully uploaded attachment ready to be sent with a message */
export interface UploadedAttachment {
  /** Unique ID for this attachment (UUID generated during upload) */
  id: string
  /** Original filename */
  filename: string
  /** MIME type of the file */
  mimeType: string
  /** File size in bytes */
  sizeBytes: number
  /** Path in Supabase Storage */
  storagePath: string
  /** Signed download URL for display */
  url: string
  /** 
   * Raw File object — only present for images.
   * Needed to pass into sendMessage's files param for multimodal AI input.
   */
  file?: File
}

/** Tracks an attachment through its upload lifecycle in the ChatInput UI */
export interface AttachmentUpload {
  /** Client-generated UUID */
  id: string
  /** Original file reference */
  file: File
  /** Original filename */
  filename: string
  /** MIME type */
  mimeType: string
  /** File size in bytes */
  sizeBytes: number
  /** Upload state */
  status: 'uploading' | 'done' | 'error'
  /** Error message if status is 'error' */
  errorMessage?: string
  /** Storage path after upload completes */
  storagePath?: string
  /** Signed download URL after upload completes */
  url?: string
  /** Local object URL for image preview (revoked on cleanup) */
  previewUrl?: string
}

/** Attachment metadata as persisted in the message's metadata JSON field */
export interface PersistedAttachment {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  storagePath: string
  url: string
}

/** Helper: is this MIME type an image? */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType === 'image/png' || mimeType === 'image/jpeg'
}

/** Helper: format bytes into human-readable string */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
