import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { postToBackend } from '@/lib/backend-request'

export const maxDuration = 180

// We provide this cancel endpoint rather than just having clients call `resume` with `approved: false` 
// to give callers (and the frontend UI) a clean, explicitly named action for rejection. 
// NOTE: True mid-computation cancellation isn't supported by this design — a run can only be 
// cancelled while it's safely paused at the human approval gate, not while it's actively computing.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: agentRunId } = await params
    const { userId: clerkId } = await auth()

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be signed in', statusCode: 401 }, { status: 401 })
    }

    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
    if (!user) {
      return NextResponse.json({ error: 'Not Found', message: 'User not found', statusCode: 404 }, { status: 404 })
    }

    const run = await db.agentRun.findUnique({
      where: { id: agentRunId },
      include: { conversation: { select: { userId: true } } },
    })

    if (!run || run.conversation.userId !== user.id) {
      return NextResponse.json({ error: 'Not Found', message: 'Agent run not found', statusCode: 404 }, { status: 404 })
    }
    if (run.status !== 'awaiting_approval') return NextResponse.json({ message: 'Agent run is not awaiting approval' }, { status: 409 })

    const fastApiUrl = process.env.FASTAPI_SERVICE_URL
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET

    if (!fastApiUrl || !internalSecret) {
      console.error('Missing FASTAPI_SERVICE_URL or INTERNAL_SERVICE_SECRET')
      return NextResponse.json({ error: 'Internal Server Error', message: 'Configuration error', statusCode: 500 }, { status: 500 })
    }

    try {
      // Call the exact same resume mechanism but explicitly with { approved: false }
      const response = await postToBackend(fastApiUrl, internalSecret, `/agents/run/${run.threadId}/resume`, { approved: false })

      if (!response.ok) {
        if (response.status === 409) return NextResponse.json({ message: 'This run was already resumed or rejected' }, { status: 409 })
        console.error('FastAPI agent cancel error:', response.status)
        return NextResponse.json({ error: 'Bad Gateway', message: 'Agent service failed to cancel', statusCode: 502 }, { status: 502 })
      }

      const data = await response.json()
      return NextResponse.json(data, { status: 200 })
    } catch (fetchError: unknown) {
      console.error('Agent cancel handoff failed:', { type: fetchError instanceof Error ? fetchError.name : 'UnknownError' })
      const timedOut = fetchError instanceof Error && fetchError.name === 'TimeoutError'
      return NextResponse.json({ message: timedOut ? 'The rejection request timed out. Check run history before trying again.' : 'Agent service is unavailable' }, { status: timedOut ? 504 : 503 })
    }
  } catch (error) {
    console.error('POST /api/agents/run/[id]/cancel error:', error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to cancel agent run', statusCode: 500 }, { status: 500 })
  }
}
