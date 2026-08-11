import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsageStats } from '@/lib/cost-aggregation'

export async function GET() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findUnique({ where: { clerkId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const usageStats = await getUsageStats(user.id)
    return NextResponse.json(usageStats, { status: 200 })
  } catch (error) {
    console.error('[USAGE_GET_ERROR]', error)
    return NextResponse.json(
      { error: 'Internal server error processing usage stats' },
      { status: 500 }
    )
  }
}
