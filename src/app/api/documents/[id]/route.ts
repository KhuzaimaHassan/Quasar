import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: documentId } = await params
    const { userId: clerkId } = await auth()

    if (!clerkId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be signed in', statusCode: 401 },
        { status: 401 }
      )
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Not Found', message: 'User record not found in database', statusCode: 404 },
        { status: 404 }
      )
    }

    const document = await db.document.findUnique({
      where: { id: documentId },
      include: { workspace: { select: { userId: true } } },
    })

    if (!document || document.workspace.userId !== user.id) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Document not found', statusCode: 404 },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        id: document.id,
        workspaceId: document.workspaceId,
        filename: document.filename,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        status: document.status,
        errorMessage: document.errorMessage,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('GET /api/documents/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch document', statusCode: 500 },
      { status: 500 }
    )
  }
}
