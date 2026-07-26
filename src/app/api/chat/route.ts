import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { streamText, createUIMessageStreamResponse, toUIMessageStream } from 'ai'
import { google } from '@ai-sdk/google'
import { convertToModelMessages } from '@/lib/chat-utils'
import { retrieveContext, buildSystemPrompt, resolveCitations } from '@/lib/rag'
import { extractMemories } from '@/lib/memory-extraction'
import { MODEL_CATALOG } from '@/lib/models'
import { decrypt } from '@/lib/encryption'

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

    const attachments = Array.isArray(json.attachments) ? json.attachments : undefined

    await db.message.create({
      data: {
        conversationId,
        role: 'user',
        content: userMessageContent,
        tokenCount: 0,
        metadata: attachments && attachments.length > 0 ? { attachments } : {},
      },
    })

    // RAG Context Assembly
    const chunks = conversation.workspaceId 
      ? await retrieveContext(conversation.workspaceId, userMessageContent)
      : [];
      
    // Fetch top memories (Issue #95, Step 4)
    const topMemories = await db.memory.findMany({
      where: {
        userId: user.id,
        confidence: { gte: 0.7 }
      },
      orderBy: { lastUpdated: 'desc' },
      take: 10,
      select: { key: true, value: true }
    });

    const systemPrompt = buildSystemPrompt(chunks, topMemories);
    
    // Resolve citations for display
    const citations = await resolveCitations(chunks);

    let modelMessages = await convertToModelMessages(messages);

    // Short-term history cap (Issue #95, Step 1)
    // We only keep the last 30 messages. For a portfolio project, this simple array slice 
    // is entirely sufficient and avoids the overhead of Redis or token-based compression (per ADR-006).
    // The models we use (like Gemini 1.5 Flash) have massive context windows, so 30 messages is well within limits.
    if (modelMessages.length > 30) {
      modelMessages = modelMessages.slice(-30);
    }
    
    console.log('[CHAT] Final Model Messages:', JSON.stringify(modelMessages.map(m => ({ role: m.role, len: m.content?.length, isArray: Array.isArray(m.content) })), null, 2));

    // Look up the conversation's model provider
    const modelId = conversation.model;
    const catalogEntry = MODEL_CATALOG.find(m => m.id === modelId);
    
    if (!catalogEntry) {
      return new NextResponse(`Unknown model ID: ${modelId}`, { status: 400 });
    }

    const { provider } = catalogEntry;
    let languageModel;

    if (provider === 'google') {
      languageModel = google(modelId);
    } else if (provider === 'anthropic' || provider === 'openai') {
      // Look up user's API key
      const apiKeyRow = await db.apiKey.findUnique({
        where: {
          userId_provider: {
            userId: user.id,
            provider,
          },
        },
      });

      if (!apiKeyRow) {
        return new NextResponse(`Missing API key for provider: ${provider}. Please configure it in settings.`, { status: 400 });
      }

      try {
        const decryptedKey = decrypt(apiKeyRow.encryptedKey);
        
        if (provider === 'anthropic') {
          const { createAnthropic } = await import('@ai-sdk/anthropic');
          const anthropic = createAnthropic({ apiKey: decryptedKey });
          languageModel = anthropic(modelId);
        } else {
          const { createOpenAI } = await import('@ai-sdk/openai');
          const openai = createOpenAI({ apiKey: decryptedKey });
          languageModel = openai(modelId);
        }
      } catch (err) {
        console.error(`[CHAT_ERROR] Failed to initialize BYOK model provider=${provider} model=${modelId}`, err instanceof Error ? err.message : String(err));
        return new NextResponse(`Failed to initialize ${provider} model. Your API key might be invalid.`, { status: 400 });
      }
    } else {
      return new NextResponse(`Unsupported provider: ${provider}`, { status: 400 });
    }

    const result = streamText({
      model: languageModel,
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
            metadata: (citations.length > 0 ? { citations } : {}) as any,
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

        // Background memory extraction (Issue #95, Step 3)
        // Trigger every 5th message (using the request's messages array length)
        if (messages.length % 5 === 0) {
          extractMemories(messages).then(async (facts) => {
            for (const fact of facts) {
              try {
                await db.memory.upsert({
                  where: {
                    userId_scope_key: {
                      userId: user.id,
                      scope: fact.scope,
                      key: fact.key,
                    }
                  },
                  update: {
                    value: fact.value,
                    confidence: fact.confidence,
                  },
                  create: {
                    userId: user.id,
                    scope: fact.scope,
                    key: fact.key,
                    value: fact.value,
                    confidence: fact.confidence,
                  }
                });
              } catch (err) {
                console.error('[MEMORY_UPSERT_ERROR] Failed to upsert fact:', err);
              }
            }
          }).catch((err) => {
            console.error('[MEMORY_EXTRACTION_FATAL]', err);
          });
        }
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
