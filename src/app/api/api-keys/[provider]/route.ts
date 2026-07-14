import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params
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

    await db.apiKey.delete({
      where: {
        userId_provider: {
          userId: user.id,
          provider,
        },
      },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    // Prisma throws P2025 if the record doesn't exist to delete
    if (error?.code === 'P2025') {
      return NextResponse.json({ success: true }, { status: 200 })
    }
    
    console.error('DELETE /api/api-keys/[provider] error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
