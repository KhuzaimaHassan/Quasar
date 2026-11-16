import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { saveExtractedMemory, saveManualMemory, updateManualMemory } from '@/lib/memory-store';
import { createMemorySchema, extractedMemorySchema, updateMemorySchema } from '@/lib/validations/memory';

const fact = { scope: 'preference' as const, key: 'language', value: 'TypeScript', confidence: 0.9 };

test('memory requests cannot opt out of protection or forge extraction metadata', () => {
  const manual = { scope: fact.scope, key: fact.key, value: fact.value };
  assert.equal(createMemorySchema.safeParse(manual).success, true);
  assert.equal(updateMemorySchema.safeParse({ value: 'Python' }).success, true);
  for (const extra of [{ isUserManaged: false }, { confidence: 0.2 }, { userId: 'another-user' }]) {
    assert.equal(createMemorySchema.safeParse({ ...manual, ...extra }).success, false);
    assert.equal(updateMemorySchema.safeParse({ value: 'Python', ...extra }).success, false);
  }
});

test('invalid or low-confidence extracted memories never reach persistence', async () => {
  assert.equal(extractedMemorySchema.safeParse(fact).success, true);
  for (const input of [
    { ...fact, key: '' }, { ...fact, value: '' }, { ...fact, scope: 'unknown' },
    { ...fact, confidence: 0.6 }, { ...fact, confidence: 1.1 },
    { ...fact, confidence: NaN }, { ...fact, isUserManaged: false },
  ]) {
    let calls = 0;
    const database = { $executeRaw: () => { calls += 1; throw new Error('Unexpected database write'); } } as unknown as Parameters<typeof saveExtractedMemory>[2];
    await assert.rejects(saveExtractedMemory('owner', input as typeof fact, database), { name: 'ZodError' });
    assert.equal(calls, 0);
  }
});

function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.TEST_DATABASE_HOST) return undefined;
  const url = new URL(`postgresql://${process.env.TEST_DATABASE_HOST}:5432`);
  url.username = process.env.TEST_DATABASE_USER ?? '';
  url.password = process.env.TEST_DATABASE_PASSWORD ?? '';
  url.pathname = `/${process.env.TEST_DATABASE_NAME ?? ''}`;
  return url.toString();
}

const databaseUrl = testDatabaseUrl();
test('PostgreSQL protects manual memories, including concurrent edits and legacy rows', { skip: !databaseUrl }, async t => {
  assert.ok(databaseUrl);
  assert.ok(['localhost', '127.0.0.1', 'postgres'].includes(new URL(databaseUrl).hostname), 'Use an isolated local/CI database, never a hosted account');
  const first = new PrismaClient({ datasourceUrl: databaseUrl });
  const second = new PrismaClient({ datasourceUrl: databaseUrl });
  const run = randomUUID();
  const owner = await first.user.create({ data: { clerkId: `memory-qa-${run}`, email: `${run}@example.invalid` } });
  const other = await first.user.create({ data: { clerkId: `memory-other-${run}`, email: `other-${run}@example.invalid` } });
  try {
    await t.test('migration preserves every old value and confidence while protecting ambiguous origins', async () => {
      const migration = readFileSync('prisma/migrations/20261116090000_protect_user_managed_memories/migration.sql', 'utf8');
      await first.$transaction(async tx => {
        // This temporary pre-migration table shadows public.Memory only on this
        // transaction's connection and is dropped automatically on commit.
        await tx.$executeRawUnsafe('CREATE TEMPORARY TABLE "Memory" ("id" TEXT PRIMARY KEY, "value" TEXT NOT NULL, "confidence" DOUBLE PRECISION NOT NULL) ON COMMIT DROP');
        await tx.$executeRaw`INSERT INTO "Memory" ("id", "value", "confidence") VALUES ('old-auto', 'Unchanged low-confidence fact', 0.65), ('old-manual', 'User correction', 1)`;
        await tx.$executeRawUnsafe(migration);
        const rows = await tx.$queryRaw<{ id: string; value: string; confidence: number; isUserManaged: boolean }[]>`SELECT * FROM "Memory" ORDER BY "id"`;
        assert.deepEqual(rows, [
          { id: 'old-auto', value: 'Unchanged low-confidence fact', confidence: 0.65, isUserManaged: true },
          { id: 'old-manual', value: 'User correction', confidence: 1, isUserManaged: true },
        ]);
      });
    });

    await t.test('new automatic facts can update, but a manual correction freezes the value and timestamp', async () => {
      assert.equal(await saveExtractedMemory(owner.id, fact, first), 1);
      const initial = await first.memory.findUniqueOrThrow({ where: { userId_scope_key: { userId: owner.id, scope: fact.scope, key: fact.key } } });
      assert.equal(initial.isUserManaged, false);
      assert.equal(await saveExtractedMemory(owner.id, { ...fact, value: 'JavaScript' }, second), 1);
      const updated = await second.memory.findUniqueOrThrow({ where: { id: initial.id } });
      assert.equal(updated.value, 'JavaScript');
      assert.equal(updated.isUserManaged, false);
      const manual = await updateManualMemory(owner.id, initial.id, 'Rust — user’s choice', first);
      assert.equal(manual.confidence, 1);
      assert.equal(manual.isUserManaged, true);
      assert.equal(await saveExtractedMemory(owner.id, { ...fact, value: 'Outdated inference', confidence: 1 }, second), 0);
      const preserved = await first.memory.findUniqueOrThrow({ where: { id: initial.id } });
      assert.deepEqual(preserved, manual);
      await assert.rejects(updateManualMemory(other.id, initial.id, 'Foreign edit', second), { code: 'P2025' });
    });

    await t.test('manual add/upsert wins against a concurrent first extraction', async () => {
      const key = 'first-write-race';
      await Promise.all([
        saveManualMemory(owner.id, { scope: fact.scope, key, value: 'Manual value' }, first),
        ...Array.from({ length: 12 }, (_, i) => saveExtractedMemory(owner.id, { ...fact, key, value: `Automatic ${i}` }, second)),
      ]);
      const rows = await first.memory.findMany({ where: { userId: owner.id, key } });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].value, 'Manual value');
      assert.equal(rows[0].isUserManaged, true);
      assert.equal(rows[0].confidence, 1);
    });

    await t.test('manual edit remains authoritative regardless of concurrent extraction order', async () => {
      const key = 'edit-race';
      await saveExtractedMemory(owner.id, { ...fact, key }, first);
      const row = await first.memory.findUniqueOrThrow({ where: { userId_scope_key: { userId: owner.id, scope: fact.scope, key } } });
      await Promise.all([
        ...Array.from({ length: 12 }, (_, i) => saveExtractedMemory(owner.id, { ...fact, key, value: `Old chat ${i}` }, i % 2 ? first : second)),
        updateManualMemory(owner.id, row.id, 'Corrected by user', second),
      ]);
      const result = await first.memory.findUniqueOrThrow({ where: { id: row.id } });
      assert.equal(result.value, 'Corrected by user');
      assert.equal(result.isUserManaged, true);
      assert.equal(result.confidence, 1);
    });

    await t.test('protection is isolated by user and scope; legacy-shaped inserts default to protected', async () => {
      await saveManualMemory(owner.id, { scope: fact.scope, key: 'shared-key', value: 'Owner preference' }, first);
      assert.equal(await saveExtractedMemory(other.id, { ...fact, key: 'shared-key' }, second), 1);
      assert.equal(await saveExtractedMemory(owner.id, { ...fact, scope: 'project', key: 'shared-key' }, first), 1);
      const legacy = await first.memory.create({ data: { userId: owner.id, scope: 'fact', key: 'legacy-client', value: 'Keep this', confidence: 0.65 } });
      assert.equal(legacy.isUserManaged, true);
      assert.equal(await saveExtractedMemory(owner.id, { ...fact, scope: 'fact', key: legacy.key, value: 'Replacement' }, second), 0);
      assert.equal((await first.memory.findUniqueOrThrow({ where: { id: legacy.id } })).value, 'Keep this');
    });
  } finally {
    await first.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
    await Promise.all([first.$disconnect(), second.$disconnect()]);
  }
});
