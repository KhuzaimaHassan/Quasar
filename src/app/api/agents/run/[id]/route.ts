import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: agentRunId } = await params
    const { userId: clerkId } = await auth()

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be signed in', statusCode: 401 }, { status: 401 })
    }

    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
    if (!user) {
      return NextResponse.json({ error: 'Not Found', message: 'User record not found in database', statusCode: 404 }, { status: 404 })
    }

    const run = await db.agentRun.findUnique({
      where: { id: agentRunId },
      include: { conversation: { select: { userId: true } } },
    })

    if (!run || run.conversation.userId !== user.id) {
      return NextResponse.json({ error: 'Not Found', message: 'AgentRun not found', statusCode: 404 }, { status: 404 })
    }

    return NextResponse.json(run, { status: 200 })
  } catch (error) {
    console.error('GET /api/agents/run/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch agent run', statusCode: 500 }, { status: 500 })
  }
}
