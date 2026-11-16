import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { beginRetryGeneration, setGenerationCitations, settleChatGeneration, stopChatGeneration } from '@/lib/chat-generation-store'
import { stopChatSchema } from '@/lib/validations/chat-stop'
import { classifyCompletion } from '@/lib/chat-completion'

test('stop payload is bounded and cannot supply ownership, model, usage or terminal state', () => {
  const input = { generationId: randomUUID(), text: 'Visible partial text' }
  assert.equal(stopChatSchema.safeParse(input).success, true)
  assert.equal(stopChatSchema.safeParse({ ...input, text: '' }).success, true)
  for (const extra of [{ userId: 'other' }, { modelId: 'other' }, { tokenCount: 100 }, { state: 'active' }]) {
    assert.equal(stopChatSchema.safeParse({ ...input, ...extra }).success, false)
  }
  assert.equal(stopChatSchema.safeParse({ ...input, generationId: '../other' }).success, false)
  assert.equal(stopChatSchema.safeParse({ ...input, text: 'a'.repeat(100_001) }).success, false)
})

function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL
  if (!process.env.TEST_DATABASE_HOST) return
  const url = new URL(`postgresql://${process.env.TEST_DATABASE_HOST}:5432`)
  url.username = process.env.TEST_DATABASE_USER ?? ''
  url.password = process.env.TEST_DATABASE_PASSWORD ?? ''
  url.pathname = `/${process.env.TEST_DATABASE_NAME ?? ''}`
  return url.toString()
}
const databaseUrl = testDatabaseUrl()

test('PostgreSQL settles stop and late model callbacks once under ownership and row locks', { skip: !databaseUrl }, async t => {
  assert.ok(databaseUrl)
  assert.ok(['localhost', '127.0.0.1', 'postgres'].includes(new URL(databaseUrl).hostname), 'Use an isolated test database')
  const first = new PrismaClient({ datasourceUrl: databaseUrl })
  const second = new PrismaClient({ datasourceUrl: databaseUrl })
  const run = randomUUID()
  const owner = await first.user.create({ data: { clerkId: `chat-qa-${run}`, email: `${run}@example.invalid` } })
  const foreign = await first.user.create({ data: { clerkId: `chat-other-${run}`, email: `other-${run}@example.invalid` } })
  const reply = { text: 'Complete answer', tokenCount: 33, tokenUsageAvailable: true, completion: classifyCompletion('stop') }
  const start = async () => {
    const conversation = await first.conversation.create({ data: { userId: owner.id, model: 'gemini-4-hydrogen' } })
    const generationId = randomUUID()
    const parent = await first.message.create({ data: { conversationId: conversation.id, role: 'user', content: 'Synthetic QA',
      metadata: { attachments: [], generation: { id: generationId, state: 'active', modelId: conversation.model } },
    } })
    return { identity: { userId: owner.id, conversationId: conversation.id, generationId }, parent }
  }
  const answers = (id: string) => first.message.findMany({ where: { conversationId: id, role: 'assistant' } })
  try {
    await t.test('a completed answer wins before Stop and is not overwritten', async () => {
      const { identity } = await start()
      assert.equal(await settleChatGeneration(identity, { reply }, first), 'saved')
      assert.equal(await stopChatGeneration(identity, 'Older visible partial', second), 'settled')
      assert.equal((await answers(identity.conversationId))[0].content, reply.text)
      assert.equal((await first.conversation.findUniqueOrThrow({ where: { id: identity.conversationId } })).totalTokens, 33)
    })
    await t.test('stopped text and citations survive repeated Stop and late complete callbacks', async () => {
      const { identity, parent } = await start()
      const citations = [{ documentId: 'qa-doc', filename: 'QA.pdf', url: '/api/documents/qa-doc/download', similarity: 0.9 }]
      assert.equal(await setGenerationCitations(identity, citations, first), true)
      assert.equal(await stopChatGeneration(identity, 'Kept partial', first), 'saved')
      const results = await Promise.all(Array.from({ length: 8 }, (_, index) => index % 2
        ? settleChatGeneration(identity, { reply }, second) : stopChatGeneration(identity, 'Duplicate stop', first)))
      assert.ok(results.every(result => result === 'settled'))
      const rows = await answers(identity.conversationId)
      assert.equal(rows.length, 1)
      assert.equal(rows[0].content, 'Kept partial')
      const metadata = rows[0].metadata as { completion: { finishReason: string }; citations: unknown; tokenUsageAvailable: boolean }
      assert.equal(metadata.completion.finishReason, 'aborted')
      assert.equal(metadata.tokenUsageAvailable, false)
      assert.deepEqual(metadata.citations, citations)
      assert.equal(await setGenerationCitations(identity, [], second), false)
      assert.equal((await first.conversation.findUniqueOrThrow({ where: { id: identity.conversationId } })).totalTokens, 0)
      assert.equal((await first.message.findUniqueOrThrow({ where: { id: parent.id } })).role, 'user')
    })
    await t.test('concurrent Stop and model completion create one answer and one token increment', async () => {
      const { identity } = await start()
      const results = await Promise.all(Array.from({ length: 12 }, (_, index) => index % 2
        ? settleChatGeneration(identity, { reply }, first) : stopChatGeneration(identity, 'Race partial', second)))
      assert.equal(results.filter(result => result === 'saved').length, 1)
      const rows = await answers(identity.conversationId)
      assert.equal(rows.length, 1)
      assert.equal((await first.conversation.findUniqueOrThrow({ where: { id: identity.conversationId } })).totalTokens, rows[0].tokenCount)
    })
    await t.test('foreign users, conversations and unknown generation IDs cannot finalize a reply', async () => {
      const { identity } = await start()
      for (const wrong of [{ ...identity, userId: foreign.id }, { ...identity, conversationId: randomUUID() }, { ...identity, generationId: randomUUID() }]) {
        assert.equal(await stopChatGeneration(wrong, 'Forbidden', second), 'missing')
        assert.equal(await settleChatGeneration(wrong, { reply }, second), 'missing')
      }
      assert.equal((await answers(identity.conversationId)).length, 0)
    })
    await t.test('empty stop is retryable; active and completed turns cannot be regenerated concurrently', async () => {
      const { identity, parent } = await start()
      const next = { id: randomUUID(), state: 'active', modelId: 'gemini-4-hydrogen' }
      assert.equal(await beginRetryGeneration(owner.id, identity.conversationId, parent.id, next, second), false)
      assert.equal(await stopChatGeneration(identity, '', first), 'saved')
      assert.equal((await answers(identity.conversationId)).length, 0)
      assert.equal(await beginRetryGeneration(foreign.id, identity.conversationId, parent.id, next, second), false)
      assert.equal(await beginRetryGeneration(owner.id, identity.conversationId, parent.id, next, second), true)
      assert.equal(await settleChatGeneration(identity, { reply }, first), 'missing')
      assert.equal(await settleChatGeneration({ ...identity, generationId: next.id }, { reply }, second), 'saved')
      assert.equal(await beginRetryGeneration(owner.id, identity.conversationId, parent.id, { ...next, id: randomUUID() }, first), false)
      assert.equal((await answers(identity.conversationId)).length, 1)
    })
    await t.test('failed token update rolls back the assistant insert and generation settlement', async () => {
      const { identity } = await start()
      await first.conversation.update({ where: { id: identity.conversationId }, data: { totalTokens: 2_147_483_647 } })
      await assert.rejects(settleChatGeneration(identity, { reply }, second))
      assert.equal((await answers(identity.conversationId)).length, 0)
      await first.conversation.update({ where: { id: identity.conversationId }, data: { totalTokens: 0 } })
      assert.equal(await stopChatGeneration(identity, 'Still recoverable', first), 'saved')
    })
  } finally {
    await first.user.deleteMany({ where: { id: { in: [owner.id, foreign.id] } } })
    await Promise.all([first.$disconnect(), second.$disconnect()])
  }
})
