import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { userId: clerkId } = await auth()

    if (!clerkId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be signed in', statusCode: 401 },
        { status: 401 }
      )
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Not Found', message: 'User record not found in database', statusCode: 404 },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'workspaceId query parameter is required', statusCode: 400 },
        { status: 400 }
      )
    }

    // Verify workspace ownership
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { userId: true },
    })

    if (!workspace || workspace.userId !== user.id) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Workspace not found', statusCode: 404 },
        { status: 404 }
      )
    }

    // Fetch documents
    const documents = await db.document.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        workspaceId: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        // Intentionally not selecting storagePath to not leak internal paths if not needed
      },
    })

    return NextResponse.json(documents, { status: 200 })
  } catch (error) {
    console.error('GET /api/documents error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch documents', statusCode: 500 },
      { status: 500 }
    )
  }
}
