import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createWorkspaceSchema } from '@/lib/validations/workspace'

export async function GET() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be signed in', statusCode: 401 }, { status: 401 })
    }

    // Look up the internal user ID
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Not Found', message: 'User record not found in database', statusCode: 404 }, { status: 404 })
    }

    const workspaces = await db.workspace.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(workspaces, { status: 200 })
  } catch (error) {
    console.error('GET /api/workspaces error:', error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch workspaces', statusCode: 500 }, { status: 500 })
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
    const parsed = createWorkspaceSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Bad Request', message: 'Invalid workspace payload', statusCode: 400 }, { status: 400 })
    }

    const { name } = parsed.data
    
    // Generate a URL-friendly slug with a random short suffix to guarantee global uniqueness
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'workspace'
    const randomSuffix = crypto.randomUUID().split('-')[0]
    const slug = `${baseSlug}-${randomSuffix}`

    const newWorkspace = await db.workspace.create({
      data: {
        userId: user.id,
        name,
        slug,
      },
    })

    return NextResponse.json(newWorkspace, { status: 201 })
  } catch (error) {
    console.error('POST /api/workspaces error:', error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to create workspace', statusCode: 500 }, { status: 500 })
  }
}
