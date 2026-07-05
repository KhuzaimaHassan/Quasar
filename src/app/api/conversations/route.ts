import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createConversationSchema } from '@/lib/validations/conversation'

export async function GET(req: Request) {
  try {
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

    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')

    const conversations = await db.conversation.findMany({
      where: {
        userId: user.id,
        ...(workspaceId ? { workspaceId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(conversations, { status: 200 })
  } catch (error) {
    console.error('GET /api/conversations error:', error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch conversations', statusCode: 500 }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
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

    const body = await req.json()
    const parsed = createConversationSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Bad Request', message: 'Invalid conversation payload', statusCode: 400 }, { status: 400 })
    }

    const { workspaceId, model } = parsed.data

    // If workspaceId is provided, optionally verify it exists and belongs to the user
    if (workspaceId) {
      const workspace = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: { userId: true },
      })
      if (!workspace || workspace.userId !== user.id) {
        // Return 404 so we don't leak existence of other users' workspaces
        return NextResponse.json({ error: 'Not Found', message: 'Workspace not found', statusCode: 404 }, { status: 404 })
      }
    }

    const newConversation = await db.conversation.create({
      data: {
        userId: user.id,
        workspaceId,
        model,
      },
    })

    return NextResponse.json(newConversation, { status: 201 })
  } catch (error) {
    console.error('POST /api/conversations error:', error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to create conversation', statusCode: 500 }, { status: 500 })
  }
}
