import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient, type Message } from '@prisma/client';
import { PostgresRateLimiter, RateLimitUnavailableError, type RateLimitStore } from '@/lib/rate-limit-store';
import { DEFAULT_MODEL_ID, MODEL_CATALOG, getModelLabel, resolveModelId } from '@/lib/models';
import { toInitialMessages, getMessageText, getChatErrorMessage } from '@/lib/chat-utils';
import { createConversationSchema, updateConversationSchema } from '@/lib/validations/conversation';
import { estimateCost, isFreeTierModel } from '@/lib/pricing';
import { getGenerationErrorMessage } from '@/lib/generation-errors';
import { canRetryMessage, chatMessagesSchema } from '@/lib/validations/chat';
import { canRetryDocument, shouldPollDocument, STALE_UPLOAD_MS } from '@/lib/document-status';
import { createDocumentUploadSchema } from '@/lib/validations/document';
import { uploadUrlSchema } from '@/lib/validations/attachment';

test('legacy free chat IDs resolve to the active free model without unlocking premium models', () => {
  for (const id of ['gemini-1.5-flash', 'gemini-3.5-flash', 'gemini-3.6-flash']) {
    assert.equal(resolveModelId(id), DEFAULT_MODEL_ID);
  }
  assert.equal(DEFAULT_MODEL_ID, 'gemini-3.5-flash-lite');
  assert.equal(resolveModelId('gemini-3.8-flash'), 'gemini-3.8-flash');
  for (const model of MODEL_CATALOG.filter((item) => item.provider !== 'google' || item.id.includes('pro'))) {
    assert.equal(model.requiresKey, true);
    assert.equal(resolveModelId(model.id), model.id);
  }
  assert.equal(resolveModelId('unknown-model'), 'unknown-model');
});

test('conversation validation supplies the default, accepts legacy aliases, and rejects unknown models', () => {
  assert.equal(createConversationSchema.parse({}).model, DEFAULT_MODEL_ID);
  assert.equal(updateConversationSchema.parse({ model: 'gemini-3.5-flash' }).model, DEFAULT_MODEL_ID);
  assert.equal(createConversationSchema.safeParse({ model: 'invented-model' }).success, false);
});

test('historical labels and free-tier classification do not depend on the active catalog', () => {
  assert.equal(getModelLabel('gemini-3.5-flash'), 'Gemini 3.5 Flash');
  assert.equal(getModelLabel('claude-sonnet-4-5'), 'Claude Sonnet 4.5');
  assert.equal(isFreeTierModel('gemini-3.5-flash'), true);
  assert.equal(isFreeTierModel(DEFAULT_MODEL_ID), true);
  assert.equal(isFreeTierModel('claude-sonnet-5'), false);
  assert.equal(estimateCost('gemini-3.5-flash', 500, 500), 0);
  assert.equal(estimateCost('unknown-historical-model', 500, 500), null);
});

test('persisted history uses AI SDK UIMessage parts and retains user/assistant roles', () => {
  const base = { conversationId: 'test', metadata: {}, tokenCount: 0, createdAt: new Date(0) };
  const messages: Message[] = [
    { ...base, id: 'user-message', role: 'user', content: 'First question' },
    { ...base, id: 'assistant-message', role: 'assistant', content: 'First answer' },
  ];
  const restored = toInitialMessages(messages);
  assert.deepEqual(restored.map((message) => message.role), ['user', 'assistant']);
  assert.deepEqual(restored.map(getMessageText), ['First question', 'First answer']);
  assert.equal(restored[0].parts[0].type, 'text');
});

test('API error bubbles display their message and reference instead of raw JSON', () => {
  assert.equal(getChatErrorMessage(JSON.stringify({ error: 'Quota service unavailable.', requestId: 'test-reference' })), 'Quota service unavailable. Reference: test-reference');
  assert.equal(getChatErrorMessage('Missing API key'), 'Missing API key');
});

test('provider failures distinguish timeouts and quota without exposing raw provider details', () => {
  assert.match(getGenerationErrorMessage(new DOMException('private-detail', 'TimeoutError'), 'Gemini'), /time limit/);
  assert.match(getGenerationErrorMessage({ statusCode: 429 }, 'Gemini'), /quota/);
  assert.match(getGenerationErrorMessage({ statusCode: 403 }, 'Gemini'), /API key/);
  assert.match(getGenerationErrorMessage({ statusCode: 503 }, 'Gemini'), /temporarily unavailable/);
  assert.match(getGenerationErrorMessage({ cause: { statusCode: 503 } }, 'Gemini'), /temporarily unavailable/);
  assert.doesNotMatch(getGenerationErrorMessage(new Error('private-detail'), 'Gemini'), /private-detail/);
});

test('chat rejects malformed history and only retries the latest owned orphan', () => {
  assert.equal(chatMessagesSchema.safeParse([null]).success, false);
  assert.equal(chatMessagesSchema.safeParse([{ role: 'assistant', content: 'old answer' }]).success, false);
  assert.equal(chatMessagesSchema.safeParse([{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }]).success, true);
  const latest = { id: 'owned-user-message', role: 'user', content: 'Hello' };
  assert.equal(canRetryMessage(latest, latest.id, 'Hello'), true);
  assert.equal(canRetryMessage(latest, 'other-conversation-message', 'Hello'), false);
  assert.equal(canRetryMessage({ ...latest, role: 'assistant' }, latest.id, 'Hello'), false);
  assert.equal(canRetryMessage(latest, latest.id, 'Changed content'), false);
  assert.equal(canRetryMessage(null, latest.id, 'Hello'), false);
});

test('document recovery avoids infinite stale-upload polling and does not retry indexed files', () => {
  const now = Date.now();
  const stale = { status: 'pending', updatedAt: new Date(now - STALE_UPLOAD_MS).toISOString() };
  assert.equal(shouldPollDocument(stale, now), false);
  assert.equal(canRetryDocument(stale, now), true);
  assert.equal(shouldPollDocument({ ...stale, updatedAt: new Date(now).toISOString() }, now), true);
  assert.equal(canRetryDocument({ ...stale, status: 'ready', chunkCount: 1 }, now), false);
  assert.equal(canRetryDocument({ ...stale, status: 'ready', chunkCount: 0 }, now), true);
  assert.equal(canRetryDocument({ ...stale, status: 'failed' }, now), true);
  assert.equal(canRetryDocument({ ...stale, status: 'processing' }, now), false);
});

test('both upload APIs reject path-bearing filenames before signing storage URLs', () => {
  const base = { filename: 'QA notes.pdf', mimeType: 'application/pdf', sizeBytes: 100 };
  const workspaceId = randomUUID();
  assert.equal(uploadUrlSchema.safeParse(base).success, true);
  assert.equal(createDocumentUploadSchema.safeParse({ ...base, workspaceId }).success, true);
  for (const filename of ['../private.pdf', 'folder/private.pdf', 'folder\\private.pdf', 'folder%2fprivate.pdf', '.', '..', 'file' + String.fromCharCode(0) + '.pdf']) {
    assert.equal(uploadUrlSchema.safeParse({ ...base, filename }).success, false);
    assert.equal(createDocumentUploadSchema.safeParse({ ...base, workspaceId, filename }).success, false);
  }
  assert.equal(createDocumentUploadSchema.safeParse({ ...base, workspaceId, sizeBytes: 1.5 }).success, false);
});

test('denied quotas stay denied with a meaningful reset and a scoped, hashed identifier', async () => {
  const calls: unknown[][] = [];
  const store: RateLimitStore = {
    async consume(...args) {
      calls.push(args);
      return { admitted: false, timestamps: [900, 950] };
    },
  };
  const limiter = new PostgresRateLimiter(store, 'chat', 2, 100, () => 'hashed', () => 999);
  assert.deepEqual(await limiter.limit('private-user'), { success: false, limit: 2, remaining: 0, reset: 1000 });
  assert.deepEqual(calls, [['chat:hashed', 2, 100, 999]]);
});

test('quota store failures fail closed with a safe service-unavailable error', async () => {
  const store: RateLimitStore = { async consume() { throw new Error('private-connection-detail'); } };
  await assert.rejects(
    new PostgresRateLimiter(store, 'chat', 20, 60_000).limit('test-user'),
    (error: unknown) => error instanceof RateLimitUnavailableError && !error.message.includes('private-connection-detail'),
  );
});

function getTestDatabaseUrl(): string | undefined {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.TEST_DATABASE_HOST) return undefined;
  const url = new URL(`postgresql://${process.env.TEST_DATABASE_HOST}:5432`);
  url.username = process.env.TEST_DATABASE_USER ?? '';
  url.password = process.env.TEST_DATABASE_PASSWORD ?? '';
  url.pathname = `/${process.env.TEST_DATABASE_NAME ?? ''}`;
  return url.toString();
}

const testDatabaseUrl = getTestDatabaseUrl();
test('PostgreSQL enforces a sliding window atomically across independent connections', { skip: !testDatabaseUrl }, async () => {
  assert.ok(testDatabaseUrl);
  assert.ok(['localhost', '127.0.0.1', 'postgres'].includes(new URL(testDatabaseUrl).hostname), 'Integration tests require an isolated local/CI database');
  const { createRateLimitStore } = await import('@/lib/rate-limit');
  const first = new PrismaClient({ datasourceUrl: testDatabaseUrl });
  const second = new PrismaClient({ datasourceUrl: testDatabaseUrl });
  const scope = `test:${randomUUID()}`;
  let now = Date.now();
  const one = new PostgresRateLimiter(createRateLimitStore(first), scope, 3, 1000, (id) => id, () => now);
  const two = new PostgresRateLimiter(createRateLimitStore(second), scope, 3, 1000, (id) => id, () => now);
  try {
    const concurrent = await Promise.all(Array.from({ length: 12 }, (_, index) => (index % 2 ? one : two).limit('same-user')));
    assert.equal(concurrent.filter((result) => result.success).length, 3);
    assert.equal((await one.limit('other-user')).success, true);
    now += 999;
    assert.equal((await two.limit('same-user')).success, false);
    now += 1;
    assert.equal((await one.limit('same-user')).success, true);
    const row = await first.rateLimitBucket.findUniqueOrThrow({ where: { key: `${scope}:same-user` } });
    assert.equal(row.timestamps.length, 1);
  } finally {
    await first.rateLimitBucket.deleteMany({ where: { key: { startsWith: `${scope}:` } } });
    await Promise.all([first.$disconnect(), second.$disconnect()]);
  }
});
