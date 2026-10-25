-- Bounded, per-user sliding-window quotas shared by all server instances.
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "timestamps" BIGINT[] NOT NULL DEFAULT ARRAY[]::BIGINT[],
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "conversations" ALTER COLUMN "model" SET DEFAULT 'gemini-3.8-flash';
