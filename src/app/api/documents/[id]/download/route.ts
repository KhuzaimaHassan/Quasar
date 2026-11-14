import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';
import { downloadDocument } from '@/lib/document-download';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return downloadDocument(id, {
    authenticate: async () => (await auth()).userId,
    findUser: (clerkId) => db.user.findUnique({ where: { clerkId }, select: { id: true } }),
    findDocument: (documentId) => db.document.findUnique({
      where: { id: documentId },
      select: { filename: true, storagePath: true, workspace: { select: { userId: true } } },
    }),
    signDownload: async (storagePath, filename) => {
      const { data, error } = await supabaseAdmin.storage.from('uploads')
        .createSignedUrl(storagePath, 60, { download: filename });
      return error ? null : data?.signedUrl ?? null;
    },
  });
}
