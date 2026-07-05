import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

    // Ownership check on the parent conversation
    const conversation = await db.conversation.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json({ error: 'Not Found', message: 'Conversation not found', statusCode: 404 }, { status: 404 })
    }

    // Fetch messages for this conversation
    const messages = await db.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(messages, { status: 200 })
  } catch (error) {
    console.error('GET /api/conversations/[id]/messages error:', error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch messages', statusCode: 500 }, { status: 500 })
  }
}
