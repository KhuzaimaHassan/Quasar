import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';
import { downloadAttachment } from '@/lib/attachment-download';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const { id, attachmentId } = await params;
  return downloadAttachment(id, attachmentId, {
    authenticate: async () => (await auth()).userId,
    findUser: (clerkId) => db.user.findUnique({ where: { clerkId }, select: { id: true } }),
    findConversation: (conversationId) => db.conversation.findUnique({ where: { id: conversationId }, select: { userId: true } }),
    findMessages: (conversationId) => db.message.findMany({
      where: { conversationId, role: 'user' }, select: { metadata: true },
    }),
    signFile: async (storagePath) => {
      // Keep images inline and preserve the existing PDF/DOCX open-link behavior.
      const { data, error } = await supabaseAdmin.storage.from('uploads').createSignedUrl(storagePath, 60);
      return error ? null : data?.signedUrl ?? null;
    },
  });
}
