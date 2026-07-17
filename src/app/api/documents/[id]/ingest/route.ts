import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: documentId } = await params
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

    const document = await db.document.findUnique({
      where: { id: documentId },
      include: { workspace: { select: { userId: true } } },
    })

    if (!document || document.workspace.userId !== user.id) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Document not found', statusCode: 404 },
        { status: 404 }
      )
    }

    if (document.status !== 'pending') {
      return NextResponse.json(
        { error: 'Conflict', message: 'Document is already processing or finished', statusCode: 409 },
        { status: 409 }
      )
    }

    const fastApiUrl = process.env.FASTAPI_SERVICE_URL
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET

    if (!fastApiUrl || !internalSecret) {
      console.error('Missing FASTAPI_SERVICE_URL or INTERNAL_SERVICE_SECRET')
      await db.document.update({
        where: { id: documentId },
        data: { status: 'failed', errorMessage: 'Internal configuration error' },
      })
      return NextResponse.json(
        { error: 'Internal Server Error', message: 'Configuration error', statusCode: 500 },
        { status: 500 }
      )
    }

    // Server-to-server call to FastAPI
    try {
      const response = await fetch(`${fastApiUrl}/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ document_id: documentId }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('FastAPI ingestion error:', response.status, errorText)
        await db.document.update({
          where: { id: documentId },
          data: { status: 'failed', errorMessage: `Ingestion service returned ${response.status}` },
        })
        return NextResponse.json(
          { error: 'Bad Gateway', message: 'Ingestion service failed', statusCode: 502 },
          { status: 502 }
        )
      }

      const data = await response.json()
      return NextResponse.json(data, { status: 202 })
    } catch (fetchError: any) {
      console.error('Fetch to FastAPI failed:', fetchError)
      await db.document.update({
        where: { id: documentId },
        data: { status: 'failed', errorMessage: 'Ingestion service is unreachable' },
      })
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'Ingestion service is down', statusCode: 503 },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error('POST /api/documents/[id]/ingest error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to process ingest request', statusCode: 500 },
      { status: 500 }
    )
  }
}
