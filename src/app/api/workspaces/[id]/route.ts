import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { updateWorkspaceSchema } from '@/lib/validations/workspace'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    // Resolve the promise for params in Next.js 15+ routing constraints
    const resolvedParams = await params
    const workspaceId = resolvedParams.id

    // Check ownership
    const existingWorkspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    })

    if (!existingWorkspace || existingWorkspace.userId !== user.id) {
      // Return 404 to obscure the existence of workspaces belonging to other users
      return NextResponse.json({ error: 'Not Found', message: 'Workspace not found', statusCode: 404 }, { status: 404 })
    }

    const body = await req.json()
    const parsed = updateWorkspaceSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Bad Request', message: 'Invalid payload', statusCode: 400 }, { status: 400 })
    }

    const updatedWorkspace = await db.workspace.update({
      where: { id: workspaceId },
      data: parsed.data as any,
    })

    return NextResponse.json(updatedWorkspace, { status: 200 })
  } catch (error) {
    console.error(`PATCH /api/workspaces/[id] error:`, error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to update workspace', statusCode: 500 }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const resolvedParams = await params
    const workspaceId = resolvedParams.id

    // Check ownership
    const existingWorkspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    })

    if (!existingWorkspace || existingWorkspace.userId !== user.id) {
      // Return 404 to obscure the existence of workspaces belonging to other users
      return NextResponse.json({ error: 'Not Found', message: 'Workspace not found', statusCode: 404 }, { status: 404 })
    }

    /* 
     * EXPLANATION OF CASCADING DELETES:
     * Currently, the Prisma schema has `onDelete: Cascade` on the Workspace -> User relation 
     * (`user User @relation(fields: [userId], references: [id], onDelete: Cascade)`).
     * This means that if the parent USER is deleted, this WORKSPACE will automatically be deleted by the database.
     * It does NOT mean deleting the Workspace will delete the User (which would be catastrophic).
     * 
     * FUTURE MILESTONES:
     * Once we introduce Conversations, Messages, and Documents inside M2 and M3, those models will have 
     * a relation pointing to the Workspace. We MUST ensure that those future relations also have 
     * `onDelete: Cascade` pointing back to Workspace. That way, executing this `db.workspace.delete()` 
     * will automatically cascade downward and permanently wipe all conversations, messages, and RAG 
     * documents associated with this specific workspace.
     */
    await db.workspace.delete({
      where: { id: workspaceId },
    })

    return NextResponse.json({ message: 'Workspace deleted successfully' }, { status: 200 })
  } catch (error) {
    console.error(`DELETE /api/workspaces/[id] error:`, error)
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to delete workspace', statusCode: 500 }, { status: 500 })
  }
}
