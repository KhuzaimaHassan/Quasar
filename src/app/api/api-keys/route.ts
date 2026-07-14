import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encrypt, maskKey } from '@/lib/encryption'
import { apiKeySchema } from '@/lib/validations/api-key'

export async function GET() {
  try {
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

    const apiKeys = await db.apiKey.findMany({
      where: { userId: user.id },
      select: {
        provider: true,
        keyPreview: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(apiKeys, { status: 200 })
  } catch (error) {
    console.error('GET /api/api-keys error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
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

    const body = await req.json()
    const parsed = apiKeySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { provider, apiKey } = parsed.data

    const encryptedKey = encrypt(apiKey)
    const keyPreview = maskKey(apiKey)

    const result = await db.apiKey.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider,
        },
      },
      update: {
        encryptedKey,
        keyPreview,
      },
      create: {
        userId: user.id,
        provider,
        encryptedKey,
        keyPreview,
      },
      select: {
        provider: true,
        keyPreview: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('POST /api/api-keys error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
