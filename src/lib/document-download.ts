interface DownloadDocument {
  filename: string;
  storagePath: string;
  workspace: { userId: string };
}

export interface DocumentDownloadDependencies {
  authenticate: () => Promise<string | null>;
  findUser: (clerkId: string) => Promise<{ id: string } | null>;
  findDocument: (documentId: string) => Promise<DownloadDocument | null>;
  signDownload: (storagePath: string, filename: string) => Promise<string | null>;
}

const privateHeaders = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization' };

/** Authorize each click, then issue a fresh, short-lived file capability. */
export async function downloadDocument(documentId: string, dependencies: DocumentDownloadDependencies): Promise<Response> {
  const error = (message: string, status: number) => Response.json({ message, statusCode: status }, { status, headers: privateHeaders });
  try {
    const clerkId = await dependencies.authenticate();
    if (!clerkId) return error('You must be signed in', 401);
    const user = await dependencies.findUser(clerkId);
    if (!user) return error('Document not found', 404);
    const document = await dependencies.findDocument(documentId);
    if (!document || document.workspace.userId !== user.id) return error('Document not found', 404);

    const url = await dependencies.signDownload(document.storagePath, document.filename);
    if (!url) return error('The file could not be downloaded. Please try again.', 503);
    return new Response(null, { status: 302, headers: { ...privateHeaders, Location: url } });
  } catch {
    return error('The file could not be downloaded. Please try again.', 503);
  }
}
