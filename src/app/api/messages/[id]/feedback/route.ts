import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const feedbackSchema = z.object({
  rating: z.union([z.literal(1), z.literal(-1)]),
}).strict()

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const message = await db.message.findUnique({
      where: { id },
      include: { conversation: { select: { userId: true } } },
    })

    if (!message || message.conversation.userId !== user.id) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const body = await req.json()
    const { rating } = feedbackSchema.parse(body)

    const feedback = await db.messageFeedback.upsert({
      where: { messageId: id },
      update: { rating },
      create: { messageId: id, rating },
    })

    return NextResponse.json(feedback, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('POST /api/messages/[id]/feedback error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const message = await db.message.findUnique({
      where: { id },
      include: { conversation: { select: { userId: true } } },
    })

    if (!message || message.conversation.userId !== user.id) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    try {
      await db.messageFeedback.delete({
        where: { messageId: id },
      })
    } catch {
      // Prisma throws if the record doesn't exist, which is fine (idempotent delete)
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('DELETE /api/messages/[id]/feedback error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
