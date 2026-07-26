import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { updateMemorySchema } from "@/lib/validations/memory"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const user = await db.user.findUnique({ where: { clerkId } })
    if (!user) {
      return new NextResponse("User not found", { status: 404 })
    }

    const resolvedParams = await params
    const memoryId = resolvedParams.id

    const memory = await db.memory.findUnique({
      where: { id: memoryId },
    })

    if (!memory || memory.userId !== user.id) {
      return new NextResponse("Not found", { status: 404 })
    }

    const json = await req.json()
    const body = updateMemorySchema.parse(json)

    const updatedMemory = await db.memory.update({
      where: { id: memoryId },
      data: {
        value: body.value,
      },
    })

    return NextResponse.json(updatedMemory)
  } catch (error) {
    console.error("[MEMORY_PATCH]", error)
    if (error instanceof Error && error.name === 'ZodError') {
      return new NextResponse("Invalid request data", { status: 422 })
    }
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const user = await db.user.findUnique({ where: { clerkId } })
    if (!user) {
      return new NextResponse("User not found", { status: 404 })
    }

    const resolvedParams = await params
    const memoryId = resolvedParams.id

    const memory = await db.memory.findUnique({
      where: { id: memoryId },
    })

    if (!memory || memory.userId !== user.id) {
      return new NextResponse("Not found", { status: 404 })
    }

    await db.memory.delete({
      where: { id: memoryId },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("[MEMORY_DELETE]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
