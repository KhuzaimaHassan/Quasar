import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'
import { uploadUrlSchema } from '@/lib/validations/attachment'
import { randomUUID } from 'crypto'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: conversationId } = await params
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

    // Ownership check on the parent conversation
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    })

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Conversation not found', statusCode: 404 },
        { status: 404 }
      )
    }

    // Validate request body
    const body = await req.json()
    const parsed = uploadUrlSchema.safeParse(body)

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

    const { filename, mimeType, sizeBytes } = parsed.data
    const attachmentId = randomUUID()

    // Build the storage path: uploads/chat-attachments/{conversationId}/{uuid}-{filename}
    const storagePath = `chat-attachments/${conversationId}/${attachmentId}-${filename}`

    // Generate a presigned upload URL (valid for 2 minutes)
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

    // Also generate a signed download URL (valid for 1 hour) for immediate display
    const { data: downloadData } = await supabaseAdmin.storage
      .from('uploads')
      .createSignedUrl(storagePath, 3600) // 1 hour

    return NextResponse.json(
      {
        uploadUrl: data.signedUrl,
        token: data.token,
        storagePath,
        attachmentId,
        url: downloadData?.signedUrl ?? null,
        filename,
        mimeType,
        sizeBytes,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('POST /api/conversations/[id]/attachments/upload-url error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to process upload request', statusCode: 500 },
      { status: 500 }
    )
  }
}
