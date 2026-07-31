import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createAgentRunSchema } from '@/lib/validations/agent-run'

export const maxDuration = 60

export async function GET(req: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be signed in', statusCode: 401 }, { status: 401 })
    }

    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
    if (!user) {
      return NextResponse.json({ error: 'Not Found', message: 'User record not found in database', statusCode: 404 }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json({ error: 'Bad Request', message: 'conversationId query parameter is required', statusCode: 400 }, { status: 400 })
    }

    // Verify conversation ownership
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    })

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json({ error: 'Not Found', message: 'Conversation not found', statusCode: 404 }, { status: 404 })
    }

    const runs = await db.agentRun.findMany({
      where: { conversationId },
      orderBy: { startedAt: 'desc' },
    })

    return NextResponse.json(runs, { status: 200 })
  } catch (error) {
    console.error('GET /api/agents/run error:', error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch agent runs', statusCode: 500 }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be signed in', statusCode: 401 }, { status: 401 })
    }

    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
    if (!user) {
      return NextResponse.json({ error: 'Not Found', message: 'User not found', statusCode: 404 }, { status: 404 })
    }

    const body = await req.json()
    const validated = createAgentRunSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json({ error: 'Bad Request', message: 'Invalid input', issues: validated.error.issues, statusCode: 400 }, { status: 400 })
    }

    const { conversationId, workspaceId, task } = validated.data

    // Verify BOTH conversationId and workspaceId belong to this user
    const [conversation, workspace] = await Promise.all([
      db.conversation.findUnique({ where: { id: conversationId }, select: { userId: true } }),
      db.workspace.findUnique({ where: { id: workspaceId }, select: { userId: true } })
    ])

    if (!conversation || conversation.userId !== user.id || !workspace || workspace.userId !== user.id) {
      return NextResponse.json({ error: 'Not Found', message: 'Conversation or Workspace not found or unauthorized', statusCode: 404 }, { status: 404 })
    }

    const fastApiUrl = process.env.FASTAPI_SERVICE_URL
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET

    if (!fastApiUrl || !internalSecret) {
      console.error('Missing FASTAPI_SERVICE_URL or INTERNAL_SERVICE_SECRET')
      return NextResponse.json({ error: 'Internal Server Error', message: 'Configuration error', statusCode: 500 }, { status: 500 })
    }

    try {
      const response = await fetch(`${fastApiUrl}/agents/run/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ conversation_id: conversationId, workspace_id: workspaceId, task }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('FastAPI agent run error:', response.status, errorText)
        return NextResponse.json({ error: 'Bad Gateway', message: 'Agent service failed', statusCode: 502 }, { status: 502 })
      }

      const data = await response.json()
      return NextResponse.json(data, { status: 200 })
    } catch (fetchError: any) {
      console.error('Fetch to FastAPI failed:', fetchError)
      return NextResponse.json({ error: 'Service Unavailable', message: 'Agent service is down', statusCode: 503 }, { status: 503 })
    }
  } catch (error) {
    console.error('POST /api/agents/run error:', error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to start agent run', statusCode: 500 }, { status: 500 })
  }
}
