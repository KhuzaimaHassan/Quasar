import { z } from 'zod';
import { filenameSchema } from './validations/filename';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from './validations/attachment';

const storedAttachmentSchema = z.object({
  id: z.string().min(1).max(128),
  filename: filenameSchema,
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  storagePath: z.string(),
});

/** Message metadata is client supplied; never sign a path outside this conversation. */
export function findStoredAttachment(messages: { metadata: unknown }[], conversationId: string, attachmentId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(conversationId)) return null;
  for (const { metadata } of messages) {
    if (!metadata || typeof metadata !== 'object' || !('attachments' in metadata) || !Array.isArray(metadata.attachments)) continue;
    for (const value of metadata.attachments) {
      const parsed = storedAttachmentSchema.safeParse(value);
      if (!parsed.success || parsed.data.id !== attachmentId) continue;
      const file = parsed.data;
      const prefix = `chat-attachments/${conversationId}/`;
      if (!file.storagePath.startsWith(prefix)) return null;
      const leaf = file.storagePath.slice(prefix.length);
      const suffix = `-${file.filename}`;
      if (!leaf.endsWith(suffix)) return null;
      // The server's storage UUID differs from the historical client attachment ID.
      const storageId = leaf.slice(0, -suffix.length);
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(storageId)) return null;
      return file;
    }
  }
  return null;
}

export interface AttachmentDownloadDependencies {
  authenticate: () => Promise<string | null>;
  findUser: (clerkId: string) => Promise<{ id: string } | null>;
  findConversation: (conversationId: string) => Promise<{ userId: string } | null>;
  findMessages: (conversationId: string) => Promise<{ metadata: unknown }[]>;
  signFile: (storagePath: string) => Promise<string | null>;
}

const privateHeaders = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization' };

export async function downloadAttachment(conversationId: string, attachmentId: string, dependencies: AttachmentDownloadDependencies): Promise<Response> {
  const error = (message: string, status: number) => Response.json({ message, statusCode: status }, { status, headers: privateHeaders });
  try {
    const clerkId = await dependencies.authenticate();
    if (!clerkId) return error('You must be signed in', 401);
    const user = await dependencies.findUser(clerkId);
    if (!user) return error('Attachment not found', 404);
    const conversation = await dependencies.findConversation(conversationId);
    if (!conversation || conversation.userId !== user.id) return error('Attachment not found', 404);
    const messages = await dependencies.findMessages(conversationId);
    const file = findStoredAttachment(messages, conversationId, attachmentId);
    if (!file) return error('Attachment not found', 404);
    const url = await dependencies.signFile(file.storagePath);
    if (!url) return error('The attachment is unavailable. Please try again.', 503);
    return new Response(null, { status: 302, headers: { ...privateHeaders, Location: url } });
  } catch {
    return error('The attachment is unavailable. Please try again.', 503);
  }
}
