import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
        { error: 'Not Found', message: 'User record not found', statusCode: 404 },
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

    if (document.status === 'processing') {
      return NextResponse.json(
        { error: 'Conflict', message: 'Document is still processing. Please wait until ingestion finishes to delete it.', statusCode: 409 },
        { status: 409 }
      )
    }

    // Delete DB record first (Chunk rows cascade automatically)
    await db.document.delete({
      where: { id: documentId },
    })

    // Attempt to delete from Supabase storage using storagePath
    try {
      const { error } = await supabaseAdmin.storage
        .from('uploads')
        .remove([document.storagePath])
      
      if (error) {
        console.error('Failed to delete file from Supabase storage:', error)
      }
    } catch (storageError) {
      console.error('Storage deletion exception:', storageError)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('DELETE /api/documents/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to delete document', statusCode: 500 },
      { status: 500 }
    )
  }
}
