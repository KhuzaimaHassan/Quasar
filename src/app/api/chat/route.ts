import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { streamText, createUIMessageStreamResponse, toUIMessageStream } from 'ai'
import { google } from '@ai-sdk/google'
import { convertToModelMessages } from '@/lib/chat-utils'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const user = await db.user.findUnique({ where: { clerkId } })
    if (!user) {
      return new NextResponse('User not found', { status: 404 })
    }

    const json = await req.json().catch(() => ({}));
    
    const messages = json.messages;
    const url = new URL(req.url);
    const fallbackMessage = Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1] : {};
    const conversationId = json.conversationId || json.data?.conversationId || url.searchParams.get('conversationId') || req.headers.get('x-conversation-id') || fallbackMessage?.conversationId;

    if (!conversationId || !messages || !Array.isArray(messages)) {
      return new NextResponse(`Invalid request payload: ${JSON.stringify(json)}`, { status: 400 })
    }

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
    })

    if (!conversation || conversation.userId !== user.id) {
      return new NextResponse('Conversation not found', { status: 404 })
    }

    // Persist the new user message immediately BEFORE calling the model
    const lastMessage = messages[messages.length - 1]
    
    // Flatten its parts to a single string for storage
    let userMessageContent = ''
    if (typeof lastMessage.content === 'string') {
      userMessageContent = lastMessage.content
    } else if (Array.isArray(lastMessage.parts)) {
      userMessageContent = lastMessage.parts.map((p: any) => p.text || '').join('')
    } else {
      userMessageContent = JSON.stringify(lastMessage.content)
    }

    await db.message.create({
      data: {
        conversationId,
        role: 'user',
        content: userMessageContent,
        tokenCount: 0,
      },
    })

    // TODO: Context assembly (Memory / RAG context) arrives in later milestones
    const systemPrompt = "You are Quasar, an AI developer workspace assistant. Be concise and specific. Focus ONLY on answering the user's latest message. Do not repeat or re-answer previous questions from the chat history."

    const modelMessages = await convertToModelMessages(messages);
    console.log('[CHAT] Final Model Messages:', JSON.stringify(modelMessages.map(m => ({ role: m.role, len: m.content.length })), null, 2));

    const result = streamText({
      model: google('gemini-3.5-flash'),
      system: systemPrompt,
      messages: modelMessages,
      async onFinish({ text, usage }) {
        // Persist the assistant's response
        await db.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: text,
            tokenCount: usage.totalTokens,
          },
        })

        // Increment the conversation's total tokens
        await db.conversation.update({
          where: { id: conversationId },
          data: {
            totalTokens: {
              increment: usage.totalTokens,
            },
          },
        })
      },
    })

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ 
        stream: result.stream,
        onError: (err) => {
          console.error('[STREAM_GENERATION_ERROR]', err)
          return err instanceof Error ? err.message : String(err)
        }
      })
    })
    
  } catch (error) {
    console.error('[CHAT_ERROR]', error)
    return NextResponse.json(
      { error: 'Internal server error processing chat' },
      { status: 500 }
    )
  }
}
