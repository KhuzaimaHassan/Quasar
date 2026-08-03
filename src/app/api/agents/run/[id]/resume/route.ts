import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resumeAgentRunSchema } from '@/lib/validations/agent-run'
import { getGithubToken } from '@/lib/github-token'

export const maxDuration = 60

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: agentRunId } = await params
    const { userId: clerkId } = await auth()

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be signed in', statusCode: 401 }, { status: 401 })
    }

    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
    if (!user) {
      return NextResponse.json({ error: 'Not Found', message: 'DEBUG: User not found for clerkId ' + clerkId, statusCode: 404 }, { status: 404 })
    }

    const run = await db.agentRun.findUnique({
      where: { id: agentRunId },
      include: { conversation: { select: { userId: true } } },
    })

    if (!run) {
      return NextResponse.json({ error: 'Not Found', message: 'DEBUG: AgentRun not found in DB with id ' + agentRunId, statusCode: 404 }, { status: 404 })
    }
    
    if (run.conversation.userId !== user.id) {
      return NextResponse.json({ error: 'Not Found', message: 'DEBUG: AgentRun conversation userId mismatch', statusCode: 404 }, { status: 404 })
    }

    const body = await req.json()
    const validated = resumeAgentRunSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json({ error: 'Bad Request', message: 'Invalid input', issues: validated.error.issues, statusCode: 400 }, { status: 400 })
    }

    const { approved } = validated.data

    const fastApiUrl = process.env.FASTAPI_SERVICE_URL
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET

    if (!fastApiUrl || !internalSecret) {
      console.error('Missing FASTAPI_SERVICE_URL or INTERNAL_SERVICE_SECRET')
      return NextResponse.json({ error: 'Internal Server Error', message: 'Configuration error', statusCode: 500 }, { status: 500 })
    }

    // Try to fetch GitHub token regardless of executionTarget, 
    // since we don't have it easily available in this DB model, 
    // and passing it doesn't hurt if it's unused by FastAPI.
    const githubToken = await getGithubToken(clerkId) || undefined;

    try {
      const response = await fetch(`${fastApiUrl}/agents/run/${run.threadId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ 
          approved,
          github_token: githubToken ?? null
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('FastAPI agent resume error:', response.status, errorText)
        return NextResponse.json({ error: 'Bad Gateway', message: 'Agent service failed', statusCode: 502 }, { status: 502 })
      }

      const data = await response.json()
      return NextResponse.json(data, { status: 200 })
    } catch (fetchError: any) {
      console.error('Fetch to FastAPI failed:', fetchError)
      return NextResponse.json({ error: 'Service Unavailable', message: 'Agent service is down', statusCode: 503 }, { status: 503 })
    }
  } catch (error) {
    console.error('POST /api/agents/run/[id]/resume error:', error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to resume agent run', statusCode: 500 }, { status: 500 })
  }
}
