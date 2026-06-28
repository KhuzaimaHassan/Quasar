# Performance

## Overview

Performance in an AI-heavy app has two distinct concerns:

1. **LLM latency** — time to first token, stream duration, total response time.
2. **Infrastructure latency** — API route response time, DB query time, retrieval latency.

Both matter. A fast RAG retrieval still feels slow if the LLM takes 8 seconds to first token.

---

## Latency Targets

| Operation | Target (p50) | Target (p95) | Action if exceeded |
|-----------|-------------|-------------|-------------------|
| Time to first token (Claude Sonnet) | < 800 ms | < 1.5 s | Check context size, switch to faster model |
| Time to first token (GPT-4o) | < 600 ms | < 1.2 s | Check context size |
| RAG retrieval (pgvector query) | < 80 ms | < 200 ms | Check index, reduce top-k |
| Document ingestion (per page) | < 2 s | < 5 s | Batch embed, check embedding API |
| API route (non-AI) | < 100 ms | < 300 ms | Add DB index, cache |
| Page load (initial) | < 1.5 s | < 3 s | Code-split, prefetch conversations |

These are starting targets. Measure first, then tighten.

---

## LLM Latency

### Time to First Token (TTFT)

TTFT is the most important metric for perceived chat performance. It is dominated by:

1. **Context size** — larger context = longer prefill time. Keep the system prompt lean. Cap RAG context at 3,000 tokens.
2. **Model choice** — Claude Sonnet is faster than Opus; GPT-4o-mini is faster than GPT-4o. Offer a "fast mode" model selection.
3. **Network latency** — choose the LLM provider's nearest region. Anthropic defaults to US-East; check if EU is available for EU users.

### Measuring TTFT

```typescript
// In the API route
const start = Date.now();

const result = await streamText({
  model,
  messages,
  onChunk: ({ chunk }) => {
    if (chunk.type === 'text-delta' && !firstTokenTime) {
      const firstTokenTime = Date.now() - start;
      console.log(`TTFT: ${firstTokenTime}ms`);
      // Send to telemetry
    }
  },
});
```

Track TTFT in LangSmith as a custom metadata field.

---

## RAG Retrieval Performance

### pgvector Index

Use `IVFFlat` for < 500k chunks, `HNSW` for > 500k:

```sql
-- IVFFlat (faster build, lower recall at scale)
CREATE INDEX idx_chunks_embedding_ivf ON chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- HNSW (slower build, better recall at scale)
CREATE INDEX idx_chunks_embedding_hnsw ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

Set `lists` to `rows / 1000` for IVFFlat (so 100 lists for 100k chunks).

### Query Optimisation

Scope retrieval to the workspace first (reduces scan size):

```sql
SELECT c.id, c.content, 1 - (c.embedding <=> $1) AS similarity
FROM chunks c
INNER JOIN documents d ON c.document_id = d.id
WHERE d.workspace_id = $2        -- scope to workspace FIRST
  AND d.status = 'ready'
  AND 1 - (c.embedding <=> $1) > 0.7
ORDER BY similarity DESC
LIMIT 10;
```

Add a partial index on `documents(workspace_id)` where `status = 'ready'` to speed up the join.

### Embedding Cache

Cache query embeddings — the same question asked twice shouldn't re-embed:

```python
import hashlib
import json

async def embed_with_cache(text: str) -> list[float]:
    key = f"emb:{hashlib.md5(text.encode()).hexdigest()}"
    cached = await redis.get(key)
    if cached:
        return json.loads(cached)
    embedding = await embed(text)
    await redis.setex(key, 3600, json.dumps(embedding))  # 1h TTL
    return embedding
```

---

## Document Ingestion Performance

Ingestion is async and background — users don't wait for it. But it should complete in a reasonable time.

### Bottlenecks and fixes

| Bottleneck | Fix |
|-----------|-----|
| Embedding one chunk at a time | Batch in groups of 100 |
| Sequential page parsing | Parse pages in parallel with `asyncio.gather` |
| Single-threaded FastAPI | Use `asyncio` throughout; consider `ProcessPoolExecutor` for CPU-heavy parsing |
| Re-embedding unchanged documents | Track a content hash; skip if hash matches existing document |

### Batch embedding

```python
async def embed_chunks(chunks: list[str]) -> list[list[float]]:
    batch_size = 100
    results = []
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=batch,
        )
        results.extend([item.embedding for item in response.data])
    return results
```

---

## Database Performance

### Connection Pooling

Prisma in Next.js runs in serverless functions — each function invocation can open a new DB connection. Without pooling, this exhausts the PostgreSQL connection limit quickly.

Use **PgBouncer** (built into Supabase) or **Prisma Accelerate**:

```env
# Supabase provides a pooled connection string
DATABASE_URL="postgresql://...@db.supabase.co:6543/postgres?pgbouncer=true"

# Use this for Prisma to avoid prepared statement conflicts with PgBouncer
DIRECT_URL="postgresql://...@db.supabase.co:5432/postgres"
```

In `schema.prisma`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### Slow Query Logging

Enable `log_min_duration_statement = 100` in PostgreSQL to log queries taking > 100ms. Review these weekly.

### Key Indexes to Add

```sql
-- Message lookup (most frequent query)
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

-- Conversation list (sidebar)
CREATE INDEX idx_conversations_user_updated ON conversations(user_id, updated_at DESC);

-- Memory lookup
CREATE INDEX idx_memories_user_scope_confidence ON memories(user_id, scope, confidence DESC);

-- Document status polling
CREATE INDEX idx_documents_workspace_status ON documents(workspace_id, status);
```

---

## Frontend Performance

### Code Splitting

Next.js handles route-based splitting automatically. Additionally:
- Lazy-load the document preview panel (heavy PDF renderer)
- Lazy-load the agent trace panel
- Lazy-load markdown syntax highlighting (loads `rehype-highlight` which is ~40 KB)

```typescript
const DocumentPreview = dynamic(() => import('@/components/DocumentPreview'), {
  loading: () => <Skeleton className="h-96" />,
});
```

### Streaming UX

The streaming experience defines perceived performance. Get these right:

- Show a blinking cursor immediately (before the first token arrives) to signal the request is processing.
- Don't re-render the entire message list on each token — only re-render the streaming message.
- Scroll to bottom automatically as tokens arrive, but stop scrolling if the user scrolls up manually.
- Show "stop" button immediately on send (not after first token).

### Prefetching

Prefetch conversation messages when the user hovers over a conversation in the sidebar:

```typescript
<Link
  href={`/c/${conversation.id}`}
  onMouseEnter={() => queryClient.prefetchQuery(['messages', conversation.id], fetchMessages)}
>
  {conversation.title}
</Link>
```

---

## Profiling Tools

| Layer | Tool |
|-------|------|
| LLM call traces | LangSmith (latency per call, token counts) |
| API route latency | Vercel Analytics, OpenTelemetry spans |
| DB query time | `EXPLAIN ANALYZE` + slow query log |
| pgvector retrieval | `EXPLAIN ANALYZE` on the similarity query |
| FastAPI | OpenTelemetry + Uptrace |
| Frontend | Chrome DevTools Performance tab, Vercel Web Analytics |

---

## When to Optimise

The rule: measure first, then optimise the thing that's actually slow.

Before writing any optimisation:
1. Confirm the problem is real — measure, don't guess.
2. Identify which layer is slow (LLM, retrieval, DB, frontend, network).
3. Make the smallest change that fixes it.
4. Measure again to confirm it helped.

In the first two milestones, don't optimise at all — get things working first.
