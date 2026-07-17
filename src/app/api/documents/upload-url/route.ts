import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'
import { createDocumentUploadSchema } from '@/lib/validations/document'
import { randomUUID } from 'crypto'

export async function POST(req: Request) {
  try {
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

    // Validate request body
    const body = await req.json()
    const parsed = createDocumentUploadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Unprocessable Entity',
          message: parsed.error.issues.map((i) => i.message).join('; '),
          statusCode: 422,
        },
        { status: 422 }
      )
    }

    const { workspaceId, filename, mimeType, sizeBytes } = parsed.data

    // Ownership check on the workspace
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { userId: true },
    })

    if (!workspace || workspace.userId !== user.id) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Workspace not found', statusCode: 404 },
        { status: 404 }
      )
    }

    const documentId = randomUUID()

    // Build the storage path: documents/{workspaceId}/{uuid}-{filename}
    // Note: bucket is 'uploads'
    const storagePath = `documents/${workspaceId}/${documentId}-${filename}`

    // Generate a presigned upload URL
    const { data, error } = await supabaseAdmin.storage
      .from('uploads')
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      console.error('Supabase signed upload URL error:', error)
      return NextResponse.json(
        { error: 'Internal Server Error', message: 'Failed to generate upload URL', statusCode: 500 },
        { status: 500 }
      )
    }

    // Create the Document row immediately in 'pending' state
    await db.document.create({
      data: {
        id: documentId,
        workspaceId,
        filename,
        storagePath,
        mimeType,
        sizeBytes,
        status: 'pending',
      },
    })

    return NextResponse.json(
      {
        uploadUrl: data.signedUrl,
        documentId,
        storagePath,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('POST /api/documents/upload-url error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to process upload request', statusCode: 500 },
      { status: 500 }
    )
  }
}
