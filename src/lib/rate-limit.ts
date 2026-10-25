import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { PostgresRateLimiter } from './rate-limit-store';

// Keep quota enforcement durable without depending on a separately hosted Redis.
// Atomic admission is required: do not replace this with an in-memory fallback.
export function createRateLimitStore(database: Pick<typeof db, '$queryRaw' | 'rateLimitBucket'> = db) {
  return {
    async consume(key: string, maximum: number, windowMs: number, now: number) {
      const timestamp = BigInt(now);
      const cutoff = BigInt(now - windowMs);
      const admitted = await database.$queryRaw<{ timestamps: bigint[] }[]>`
      INSERT INTO "rate_limit_buckets" AS bucket ("key", "timestamps", "updatedAt")
      VALUES (${key}, ARRAY[${timestamp}]::BIGINT[], NOW())
      ON CONFLICT ("key") DO UPDATE
      SET "timestamps" = ARRAY(
        SELECT stamp FROM unnest(bucket."timestamps") AS stamp
        WHERE stamp > ${cutoff} ORDER BY stamp
      ) || ${timestamp}::BIGINT,
      "updatedAt" = NOW()
      WHERE (
        SELECT COUNT(*) FROM unnest(bucket."timestamps") AS stamp
        WHERE stamp > ${cutoff}
      ) < ${maximum}
      RETURNING "timestamps"
    `;
      const row = admitted[0] ?? await database.rateLimitBucket.findUnique({ where: { key } });
      return { admitted: admitted.length > 0, timestamps: row?.timestamps.map(Number) ?? [] };
    },
  };
}

const store = createRateLimitStore();

function createLimiter(scope: string, maximum: number, windowMs: number) {
  return new PostgresRateLimiter(store, scope, maximum, windowMs, (identifier) =>
    createHash('sha256').update(identifier).digest('hex')
  );
}

export const chatRateLimiter = createLimiter('chat', 20, 60_000);
export const uploadRateLimiter = createLimiter('upload', 10, 3_600_000);
export const ingestionRateLimiter = createLimiter('ingest', 10, 3_600_000);
export const agentRunRateLimiter = createLimiter('agent', 5, 3_600_000);
