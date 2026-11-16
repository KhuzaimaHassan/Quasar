import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { extractedMemorySchema, type CreateMemoryInput } from '@/lib/validations/memory';
import type { ExtractedFact } from '@/lib/memory-extraction';

type MemoryDatabase = Pick<typeof db, 'memory' | '$executeRaw'>;

export function saveManualMemory(userId: string, input: CreateMemoryInput, database: MemoryDatabase = db) {
  const { scope, key, value } = input;
  return database.memory.upsert({
    where: { userId_scope_key: { userId, scope, key } },
    update: { value, confidence: 1, isUserManaged: true },
    create: { userId, scope, key, value, confidence: 1, isUserManaged: true },
  });
}

export function updateManualMemory(userId: string, id: string, value: string, database: MemoryDatabase = db) {
  return database.memory.update({
    where: { id, userId },
    data: { value, confidence: 1, isUserManaged: true },
  });
}

export async function saveExtractedMemory(userId: string, input: ExtractedFact, database: MemoryDatabase = db) {
  const fact = extractedMemorySchema.parse(input);
  // The conflict predicate is checked while PostgreSQL holds the row lock.
  // A read-then-upsert check would allow an in-flight extraction to undo an edit.
  return database.$executeRaw`
    INSERT INTO "Memory" AS memory
      ("id", "userId", "scope", "key", "value", "confidence", "isUserManaged", "createdAt", "lastUpdated")
    VALUES
      (${randomUUID()}, ${userId}, ${fact.scope}, ${fact.key}, ${fact.value}, ${fact.confidence}, false, NOW(), NOW())
    ON CONFLICT ("userId", "scope", "key") DO UPDATE
    SET "value" = EXCLUDED."value", "confidence" = EXCLUDED."confidence", "lastUpdated" = NOW()
    WHERE memory."isUserManaged" = false
  `;
}
