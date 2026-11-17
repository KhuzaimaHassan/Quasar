import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stopChatGeneration } from '@/lib/chat-generation-store'
import { stopChatSchema } from '@/lib/validations/chat-stop'
import { stopChatRateLimiter } from '@/lib/rate-limit'
import { RateLimitUnavailableError } from '@/lib/rate-limit-store'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    if (!(await stopChatRateLimiter.limit(clerkId)).success) return NextResponse.json({ error: 'Too many stop requests. Please try again shortly.' }, { status: 429, headers })
    const input = stopChatSchema.safeParse(await req.json().catch(() => null))
    if (!input.success) return NextResponse.json({ error: 'Invalid stop request.' }, { status: 400, headers })
    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
    const { id } = await params
    if (!user) return NextResponse.json({ error: 'Response not found.' }, { status: 404, headers })
    const result = await stopChatGeneration({ userId: user.id, conversationId: id, generationId: input.data.generationId }, input.data.text)
    if (result === 'missing') return NextResponse.json({ error: 'Response not found. Reload the chat before trying again.' }, { status: 404, headers })
    return NextResponse.json({ status: result }, { headers })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to save the stopped response. Please try again.' }, { status: error instanceof RateLimitUnavailableError ? 503 : 500, headers })
  }
}
