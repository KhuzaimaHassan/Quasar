import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { updateConversationSchema } from '@/lib/validations/conversation'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be signed in', statusCode: 401 }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Not Found', message: 'User record not found in database', statusCode: 404 }, { status: 404 })
    }

    const conversation = await db.conversation.findUnique({
      where: { id },
    })

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json({ error: 'Not Found', message: 'Conversation not found', statusCode: 404 }, { status: 404 })
    }

    return NextResponse.json(conversation, { status: 200 })
  } catch (error) {
    console.error('GET /api/conversations/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch conversation', statusCode: 500 }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be signed in', statusCode: 401 }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Not Found', message: 'User record not found in database', statusCode: 404 }, { status: 404 })
    }

    const conversation = await db.conversation.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json({ error: 'Not Found', message: 'Conversation not found', statusCode: 404 }, { status: 404 })
    }

    const body = await req.json()
    const parsed = updateConversationSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Bad Request', message: 'Invalid conversation payload', statusCode: 400 }, { status: 400 })
    }

    const updated = await db.conversation.update({
      where: { id },
      data: parsed.data,
    })

    return NextResponse.json(updated, { status: 200 })
  } catch (error) {
    console.error('PATCH /api/conversations/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to update conversation', statusCode: 500 }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be signed in', statusCode: 401 }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Not Found', message: 'User record not found in database', statusCode: 404 }, { status: 404 })
    }

    const conversation = await db.conversation.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json({ error: 'Not Found', message: 'Conversation not found', statusCode: 404 }, { status: 404 })
    }

    await db.conversation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('DELETE /api/conversations/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to delete conversation', statusCode: 500 }, { status: 500 })
  }
}
