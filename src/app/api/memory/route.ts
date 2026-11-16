import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createMemorySchema } from "@/lib/validations/memory"
import { saveManualMemory } from "@/lib/memory-store"

export async function GET() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const user = await db.user.findUnique({ where: { clerkId } })
    if (!user) {
      return new NextResponse("User not found", { status: 404 })
    }

    const memories = await db.memory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(memories)
  } catch (error) {
    console.error("[MEMORY_GET]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const user = await db.user.findUnique({ where: { clerkId } })
    if (!user) {
      return new NextResponse("User not found", { status: 404 })
    }

    const json = await req.json()
    const body = createMemorySchema.parse(json)

    const memory = await saveManualMemory(user.id, body)

    return NextResponse.json(memory)
  } catch (error) {
    console.error("[MEMORY_POST]", error)
    if (error instanceof Error && error.name === 'ZodError') {
      return new NextResponse("Invalid request data", { status: 422 })
    }
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function DELETE() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const user = await db.user.findUnique({ where: { clerkId } })
    if (!user) {
      return new NextResponse("User not found", { status: 404 })
    }

    await db.memory.deleteMany({
      where: { userId: user.id },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("[MEMORY_DELETE_ALL]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
