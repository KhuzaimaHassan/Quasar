import type { Prisma } from '@prisma/client'
import { db } from './db'
import { classifyCompletion, type SavedReply } from './chat-completion'

type Identity = { userId: string; conversationId: string; generationId: string }
type JsonRecord = Prisma.JsonObject
const record = (value: Prisma.JsonValue): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value : {}

async function lockGeneration(tx: Prisma.TransactionClient, identity: Identity) {
  const rows = await tx.$queryRaw<{ id: string; metadata: Prisma.JsonValue }[]>`
    SELECT m."id", m."metadata" FROM "messages" m
    JOIN "conversations" c ON c."id" = m."conversationId"
    WHERE c."userId" = ${identity.userId} AND c."id" = ${identity.conversationId}
      AND m."role" = 'user' AND m."metadata"->'generation'->>'id' = ${identity.generationId}
    FOR UPDATE OF m
  `
  return rows.length === 1 ? rows[0] : undefined
}

export async function beginRetryGeneration(
  userId: string, conversationId: string, messageId: string,
  generation: { id: string; state: string; modelId: string }, database = db,
) {
  return database.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ metadata: Prisma.JsonValue }[]>`
      SELECT m."metadata" FROM "messages" m JOIN "conversations" c ON c."id" = m."conversationId"
      WHERE m."id" = ${messageId} AND m."role" = 'user' AND c."id" = ${conversationId} AND c."userId" = ${userId}
      FOR UPDATE OF m
    `
    if (!rows[0]) return false
    const metadata = record(rows[0].metadata)
    const previous = record(metadata.generation ?? null)
    if (previous.state === 'active' || previous.state === 'settled') return false
    await tx.message.update({ where: { id: messageId }, data: { metadata: { ...metadata, generation, generationError: null } as Prisma.InputJsonObject } })
    return true
  })
}

export async function setGenerationCitations(identity: Identity, citations: Prisma.InputJsonValue[], database = db) {
  return database.$transaction(async tx => {
    const row = await lockGeneration(tx, identity)
    if (!row) return false
    const metadata = record(row.metadata)
    const generation = record(metadata.generation ?? null)
    if (generation.state !== 'active') return false
    await tx.message.update({ where: { id: row.id }, data: { metadata: { ...metadata, generation: { ...generation, citations } } as Prisma.InputJsonObject } })
    return true
  })
}

/** Stop endpoint and model callbacks compete under the same owned user-row lock. */
export async function settleChatGeneration(
  identity: Identity,
  outcome: { reply?: SavedReply; error?: { message: string; requestId: string } },
  database = db,
): Promise<'saved' | 'settled' | 'missing'> {
  return database.$transaction(async tx => {
    const row = await lockGeneration(tx, identity)
    if (!row) return 'missing'
    const metadata = record(row.metadata)
    const generation = record(metadata.generation ?? null)
    if (generation.state !== 'active') return 'settled'
    if (typeof generation.modelId !== 'string') return 'missing'
    const reply = outcome.reply
    if (reply) {
      await tx.message.create({ data: {
        conversationId: identity.conversationId, role: 'assistant', content: reply.text, tokenCount: reply.tokenCount,
        metadata: {
          modelId: generation.modelId, generationId: identity.generationId,
          citations: Array.isArray(generation.citations) ? generation.citations : [],
          completion: reply.completion, tokenUsageAvailable: reply.tokenUsageAvailable,
        } as Prisma.InputJsonObject,
      } })
      await tx.conversation.update({ where: { id: identity.conversationId }, data: { totalTokens: { increment: reply.tokenCount } } })
    }
    await tx.message.update({ where: { id: row.id }, data: { metadata: {
      ...metadata, generation: { ...generation, state: reply ? 'settled' : 'failed' },
      generationError: reply ? null : outcome.error ?? { message: 'No complete response received.', requestId: identity.generationId },
    } as Prisma.InputJsonObject } })
    return 'saved'
  })
}

export function stopChatGeneration(identity: Identity, text: string, database = db) {
  return settleChatGeneration(identity, text.trim() ? { reply: {
    text, tokenCount: 0, tokenUsageAvailable: false, completion: classifyCompletion('aborted'),
  } } : { error: { message: 'Generation was stopped before a complete response was received.', requestId: identity.generationId } }, database)
}
