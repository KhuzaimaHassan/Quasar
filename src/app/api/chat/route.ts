import { auth } from '@clerk/nextjs/server'
import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { streamText, createUIMessageStreamResponse, toUIMessageStream, generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { convertToModelMessages } from '@/lib/chat-utils'
import { retrieveContext, buildSystemPrompt, resolveCitations } from '@/lib/rag'
import { extractMemories } from '@/lib/memory-extraction'
import { BACKGROUND_MODEL_ID, MODEL_CATALOG, resolveModelId } from '@/lib/models'
import { decrypt } from '@/lib/encryption'
import { chatRateLimiter } from '@/lib/rate-limit'
import { RateLimitUnavailableError } from '@/lib/rate-limit-store'
import { getGenerationErrorMessage } from '@/lib/generation-errors'
import { chatMessagesSchema, canRetryMessage } from '@/lib/validations/chat'
import { traceChatGeneration, sanitizeTraceMetadata } from '@/lib/langsmith'

export const maxDuration = 90

export async function POST(req: Request) {
  const requestId = crypto.randomUUID()
  let stage = 'authentication'
  let recordFailure: ((message: string) => Promise<void>) | undefined
  try {
    const { userId: clerkId } = await auth()
    
    if (!clerkId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    stage = 'request_quota'
    const { success } = await chatRateLimiter.limit(clerkId)
    if (!success) {
      return new NextResponse('Too Many Requests: You have exceeded the rate limit of 20 requests per minute.', { status: 429 })
    }

    stage = 'conversation'
    const user = await db.user.findUnique({ where: { clerkId } })
    if (!user) {
      return new NextResponse('User not found', { status: 404 })
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      return NextResponse.json({ error: 'Invalid chat request.', requestId }, { status: 400 })
    }
    
    const validatedMessages = chatMessagesSchema.safeParse(json.messages)
    if (!validatedMessages.success) {
      return NextResponse.json({ error: 'Invalid chat messages.', requestId }, { status: 400 })
    }
    const messages = validatedMessages.data;
    const url = new URL(req.url);
    const fallbackMessage = messages[messages.length - 1];
    const conversationId = json.conversationId || json.data?.conversationId || url.searchParams.get('conversationId') || req.headers.get('x-conversation-id') || fallbackMessage?.conversationId;

    if (typeof conversationId !== 'string' || !conversationId) {
      return new NextResponse('A conversation and at least one message are required.', { status: 400 })
    }

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
    })

    if (!conversation || conversation.userId !== user.id) {
      return new NextResponse('Conversation not found', { status: 404 })
    }

    const modelId = resolveModelId(conversation.model)
    const catalogEntry = MODEL_CATALOG.find((model) => model.id === modelId)
    if (!catalogEntry) {
      return new NextResponse('This conversation uses an unavailable model. Select a model from the menu.', { status: 400 })
    }

    // Persist the new user message immediately BEFORE calling the model
    const lastMessage = messages[messages.length - 1]
    
    // Flatten its parts to a single string for storage
    let userMessageContent = ''
    if (typeof lastMessage.content === 'string') {
      userMessageContent = lastMessage.content
    } else if (Array.isArray(lastMessage.parts)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userMessageContent = lastMessage.parts.map((p: any) => p.text || '').join('')
    }

    const attachments = Array.isArray(json.attachments) ? json.attachments : undefined

    stage = 'message_persistence'
    const retryMessageId = typeof json.retryMessageId === 'string' ? json.retryMessageId : undefined
    const retryMessage = retryMessageId ? await db.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    }) : null
    if (retryMessageId && !canRetryMessage(retryMessage, retryMessageId, userMessageContent)) {
      return new NextResponse('The message to retry was not found in this conversation.', { status: 400 })
    }

    const persistedUserMessage = retryMessage ?? await db.message.create({
      data: {
        conversationId,
        role: 'user',
        content: userMessageContent,
        tokenCount: 0,
        metadata: attachments && attachments.length > 0 ? { attachments } : {},
      },
    })

    const recordGenerationFailure = async (message: string) => {
      try {
        const metadata = persistedUserMessage.metadata && typeof persistedUserMessage.metadata === 'object' && !Array.isArray(persistedUserMessage.metadata)
          ? persistedUserMessage.metadata : {}
        await db.message.update({
          where: { id: persistedUserMessage.id },
          data: { metadata: { ...metadata, generationError: { message, requestId } } },
        })
      } catch {
        console.error('[GENERATION_ERROR_PERSISTENCE_FAILED]', { requestId })
      }
    }
    recordFailure = recordGenerationFailure

    stage = 'context'
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
    
    stage = 'model_initialization'
    const { provider } = catalogEntry;
    let languageModel;

    if (catalogEntry.requiresKey) {
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
        await recordGenerationFailure(`Add your ${provider} API key in Settings to use ${catalogEntry.label}.`)
        return new NextResponse(`Missing API key for provider: ${provider}. Please configure it in settings.`, { status: 400 });
      }

      try {
        const decryptedKey = decrypt(apiKeyRow.encryptedKey);
        
        if (provider === 'anthropic') {
          const { createAnthropic } = await import('@ai-sdk/anthropic');
          const anthropic = createAnthropic({ apiKey: decryptedKey });
          languageModel = anthropic(modelId);
        } else if (provider === 'openai') {
          const { createOpenAI } = await import('@ai-sdk/openai');
          const openai = createOpenAI({ apiKey: decryptedKey });
          languageModel = openai(modelId);
        } else if (provider === 'google') {
          const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
          const googleBYOK = createGoogleGenerativeAI({ apiKey: decryptedKey });
          languageModel = googleBYOK(modelId);
        } else {
          return new NextResponse(`Unsupported BYOK provider: ${provider}`, { status: 400 });
        }
      } catch (err) {
        await recordGenerationFailure(`Unable to use the ${provider} API key. Check its configuration in Settings.`)
        console.error(`[CHAT_ERROR] Failed to initialize BYOK model provider=${provider} model=${modelId}`, err instanceof Error ? err.message : String(err));
        return new NextResponse(`Failed to initialize ${provider} model. Your API key might be invalid.`, { status: 400 });
      }
    } else {
      if (provider === 'google') {
        languageModel = google(modelId);
      } else {
        return new NextResponse(`Unsupported default provider: ${provider}`, { status: 400 });
      }
    }

    stage = 'generation'
    const generationTimeout = AbortSignal.timeout(45_000)
    const result = await traceChatGeneration(
      `chat-${modelId}`,
      () =>
        streamText({
          model: languageModel,
          system: systemPrompt,
          messages: modelMessages,
          maxRetries: 0,
          abortSignal: AbortSignal.any([req.signal, generationTimeout]),
          onError: async ({ error }) => {
            await recordGenerationFailure(getGenerationErrorMessage(error, catalogEntry.label))
          },
          onAbort: async () => {
            const message = generationTimeout.aborted
              ? getGenerationErrorMessage(new DOMException('Timed out', 'TimeoutError'), catalogEntry.label)
              : 'Generation was stopped before a complete response was received.'
            await recordGenerationFailure(message)
          },
          providerOptions: provider === 'google' ? {
            google: { thinkingConfig: { thinkingLevel: 'low' } },
          } : undefined,
          async onFinish({ text, usage }) {
            if (!text.trim()) {
              await recordGenerationFailure(`${catalogEntry.label} returned no answer. Choose another model or try again later.`)
              return
            }
            // Persist the assistant's response
            // Keep the response and token total consistent if either write fails.
            const previousMetadata = persistedUserMessage.metadata && typeof persistedUserMessage.metadata === 'object' && !Array.isArray(persistedUserMessage.metadata)
              ? persistedUserMessage.metadata : {}
            await db.$transaction([db.message.create({
              data: {
                conversationId,
                role: 'assistant',
                content: text,
                tokenCount: usage.totalTokens,
                metadata: {
                  modelId,
                  citations: citations.map(({ documentId, filename, url, similarity }) => ({ documentId, filename, url, similarity })),
                },
              },
            }),

            // Increment the conversation's total tokens
            db.conversation.update({
              where: { id: conversationId },
              data: {
                totalTokens: {
                  increment: usage.totalTokens,
                },
              },
            }),
            db.message.update({
              where: { id: persistedUserMessage.id },
              data: { metadata: { ...previousMetadata, generationError: null } },
            })])

            // Background memory extraction (Issue #95, Step 3)
            // Trigger every 5th message (using the request's messages array length)
            if (messages.length % 5 === 0) {
              after(() =>
                extractMemories(messages)
                  .then(async (facts) => {
                    for (const fact of facts) {
                      try {
                        await db.memory.upsert({
                          where: {
                            userId_scope_key: {
                              userId: user.id,
                              scope: fact.scope,
                              key: fact.key,
                            },
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
                          },
                        })
                      } catch (err) {
                        console.error('[MEMORY_UPSERT_ERROR] Failed to upsert fact:', err)
                      }
                    }
                  })
                  .catch((err) => {
                    console.error('[MEMORY_EXTRACTION_FATAL]', err)
                  })
              )
            }

            // Conversation auto-naming
            if (conversation.title === 'New conversation') {
              after(() =>
                generateText({
                  model: google(BACKGROUND_MODEL_ID),
                  maxOutputTokens: 64,
                  maxRetries: 0,
                  abortSignal: AbortSignal.timeout(10_000),
                  system:
                    "Generate an extremely concise title (3-6 words) for this conversation based on the user's first message. Reply ONLY with the raw title text.",
                  prompt: userMessageContent,
                })
                  .then(async ({ text }) => {
                    try {
                      await db.conversation.update({
                        where: { id: conversationId },
                        data: { title: text.trim().replace(/^["']|["']$/g, '') },
                      })
                    } catch (err) {
                      console.error('[AUTO_NAMING_DB_ERROR]', err)
                    }
                  })
                  .catch((err) => {
                    console.error('[AUTO_NAMING_FATAL_ERROR]', err)
                  })
              )
            }
          },
        }),
      sanitizeTraceMetadata({
        conversationId,
        workspaceId: conversation.workspaceId,
        modelId,
        provider,
      })
    )

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ 
        stream: result.stream,
        onError: (err) => {
          console.error('[STREAM_GENERATION_ERROR]', { requestId, type: err instanceof Error ? err.name : 'UnknownError' })
          return `${getGenerationErrorMessage(err, catalogEntry.label)} Reference: ${requestId}`
        }
      })
    })
    
  } catch (error) {
    console.error('[CHAT_ERROR]', { requestId, stage, type: error instanceof Error ? error.name : 'UnknownError' })
    await recordFailure?.('The chat request could not complete. Please try again later.')
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json({ error: error.message, requestId }, { status: 503 })
    }
    return NextResponse.json(
      { error: 'Unable to process the chat request. Please try again shortly.', requestId },
      { status: 500 }
    )
  }
}
