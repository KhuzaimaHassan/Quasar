# RAG (Retrieval-Augmented Generation)

## Overview

Quasar lets users upload documents (PDFs, DOCX, codebases) to a workspace. When they chat, the system retrieves the most relevant chunks from those documents and injects them into the LLM's context. This allows the model to answer questions about documents it has never seen in training.

RAG is implemented in the FastAPI service (M3 onward).

---

## Pipeline

```
Upload
  → Parse raw text from file
  → Split text into chunks
  → Embed each chunk
  → Store chunks + embeddings in pgvector

Query
  → Embed the user's query
  → Cosine similarity search against workspace chunks
  → Re-rank results
  → Inject top-k chunks into prompt
  → Stream LLM response with citations
```

---

## Supported File Types

| Type | Parser | Notes |
|------|--------|-------|
| PDF | `PyMuPDF` (fitz) | Fast, handles scanned PDFs with OCR fallback |
| DOCX | `python-docx` | Preserves headings as chunk metadata |
| TXT / MD | Built-in | Direct text, split on headings |
| Code files | Built-in | Split by function/class boundary (AST-aware) |

Start with PDF and DOCX. Add code file support in M5 (needed for codebase RAG).

---

## Chunking Strategy

### Parameters (tune these as you learn)

| Parameter | Default | Notes |
|-----------|---------|-------|
| Chunk size | 512 tokens | Smaller = more precise retrieval, larger = more context per chunk |
| Overlap | 64 tokens | Prevents context loss at boundaries |
| Min chunk size | 100 tokens | Discard tiny fragments |

### Algorithm

We implement a manual recursive paragraph and sentence splitter:

```python
from google.genai import local_tokenizer

tokenizer = local_tokenizer.LocalTokenizer("gemini-2.5-flash")

def count_tokens(text: str) -> int:
    return tokenizer.count_tokens(text).total_tokens
```

Always split by **tokens**, not characters. We first split by double newlines (`\n\n`) to preserve paragraphs, and if a single paragraph exceeds the token limit, we recursively break it down by sentence boundaries (`.!?`). We greedily accumulate these units until the target token size is met.

### Metadata per chunk

Store this in the `metadata` jsonb column:

```json
{
  "page_number": 3,
  "section_heading": "Introduction",
  "document_filename": "technical_spec.pdf",
  "char_start": 1240,
  "char_end": 2800
}
```

This metadata is used for citation display in the UI ("Source: technical_spec.pdf, page 3").

---

## Embedding Models

| Model | Provider | Dimensions | Cost |
|-------|----------|-----------|------|
| `gemini-embedding-001` | Google Gemini | 768 | Generous Free Tier |
| `embed-english-v3.0` | Cohere | 1024 | $0.10 / 1M tokens |

**Start with `gemini-embedding-001`** — excellent quality and cost-effective.
> **Privacy Note**: Because we are utilizing the free-tier Gemini API, Google may use the uploaded document content to improve their models. Users should be aware of this, especially since documents may contain more sensitive material than typed chat messages.

The dimension must match the pgvector column definition (768). **Do not change embedding models after creating chunks** — you would need to re-embed all existing documents.

```python
from google import genai
from google.genai import types

client = genai.Client()

def embed(text: str) -> list[float]:
    response = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(
            output_dimensionality=768,
            task_type="RETRIEVAL_DOCUMENT" # Use RETRIEVAL_DOCUMENT for indexing, RETRIEVAL_QUERY for searching
        )
    )
    return response.embeddings[0].values
```

Batch embedding requests — embed up to 20 chunks per API call using a single batch request, and implement exponential backoff to handle free-tier rate limits gracefully.

---

## Storage in pgvector

```sql
-- Schema (already in Database.md, repeated here for context)
ALTER TABLE chunks ADD COLUMN embedding vector(768);

-- Insert
INSERT INTO chunks (document_id, chunk_index, content, embedding, metadata)
VALUES ($1, $2, $3, $4::vector, $5);
```

With Prisma, you need a raw query for vector insertion until Prisma adds native pgvector support:

```typescript
await prisma.$executeRaw`
  INSERT INTO chunks (id, document_id, chunk_index, content, embedding, metadata)
  VALUES (gen_random_uuid(), ${documentId}, ${index}, ${content}, ${embedding}::vector, ${metadata}::jsonb)
`;
```

---

## Retrieval

### Query Flow

```python
from core.embeddings import embed_query
from core.db import db

async def retrieve(query: str, workspace_id: str, top_k: int = 5) -> list[dict]:
    # 1. Embed the query (uses task_type="RETRIEVAL_QUERY" for Gemini)
    query_embedding = embed_query(query)
    emb_str = "[" + ",".join(map(str, query_embedding)) + "]"

    # 2. Cosine similarity search, scoped to workspace
    sql = '''
        SELECT c.id, c.content, c."chunkIndex", c.metadata,
               d.filename,
               1 - (c.embedding <=> $1::vector) AS similarity
        FROM "Chunk" c
        JOIN "Document" d ON c."documentId" = d.id
        WHERE d."workspaceId" = $2
          AND d.status = 'ready'
          AND 1 - (c.embedding <=> $1::vector) > $3
        ORDER BY c.embedding <=> $1::vector ASC
        LIMIT $4
    '''
    
    async with db.pool.acquire() as conn:
        rows = await conn.fetch(sql, emb_str, workspace_id, 0.7, top_k * 2)

    # 3. Re-rank
    return rerank(query, [dict(r) for r in rows])[:top_k]
```

### Similarity Threshold

The `> 0.7` threshold filters out low-relevance chunks. Tune this:
- Too high (> 0.85): misses relevant but paraphrased content.
- Too low (< 0.6): injects irrelevant noise into the prompt.

**Note:** The `0.7` default was inherited from planning done before `gemini-embedding-001` was chosen as the embedding model. It should be validated against real logged scores rather than trusted blindly, as Gemini's embeddings tend to cluster differently.

Log similarity scores per query so you can tune empirically.

### pgvector operators

| Operator | Distance metric |
|----------|----------------|
| `<=>` | Cosine distance (use this — standard for text) |
| `<->` | L2 / Euclidean distance |
| `<#>` | Inner product |

---

## Re-ranking

After vector retrieval, re-rank using a cross-encoder for better precision.

**Simple option** — Reciprocal Rank Fusion (no extra model):
```python
def rerank(query: str, chunks: list) -> list:
    # Combine vector similarity with BM25 keyword score
    # RRF formula: score = sum(1 / (k + rank_i)) for each ranking
    pass  # Implement or use rank_bm25 library
```

**Better option** — Cross-encoder re-ranking (requires model inference):
```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

scores = reranker.predict([(query, chunk.content) for chunk in chunks])
ranked = sorted(zip(chunks, scores), key=lambda x: x[1], reverse=True)
return [chunk for chunk, _ in ranked]
```

Start with RRF. Add the cross-encoder when you have enough test cases to evaluate the improvement.

---

## Context Injection

Retrieved chunks are injected into the prompt as a `<context>` block:

```
<context>
Source: technical_spec.pdf (page 3)
The authentication service validates tokens using RS256 signed JWTs...

Source: architecture.pdf (page 7)
The API gateway sits in front of all microservices and handles...
</context>

User question: How does authentication work in our system?
```

Key rules:
- Always include the source filename — enables citations in the UI.
- Cap injected context at ~3,000 tokens total.
- If no chunks pass the similarity threshold, do NOT inject the `<context>` block — tell the model to answer from its own knowledge.

---

## Chat Integration

The chat integration (Issue #89) ties the FastAPI retrieval backend with the Next.js chat API route (`/api/chat/route.ts`).

1. **Context Retrieval**: We call the helper `retrieveContext(workspaceId, userMessageText)`. It first does a cheap check in Postgres to ensure the workspace has at least one document in `ready` status. If so, it calls the internal FastAPI `/retrieve` endpoint using the `INTERNAL_SERVICE_SECRET`.
2. **System Prompt Construction**: `buildSystemPrompt` converts the retrieved chunks into a `<context>` block with source filenames. If no chunks are found or the request fails, it falls back to the base system prompt.
3. **Citation Resolution**: We map the returned `documentId`s to fresh, 1-hour presigned URLs via `supabaseAdmin`.
4. **Streaming Citations**: We use the Vercel AI SDK's `StreamData` class to append a non-transient custom data part (`type: 'data-citations'`) into the UI message stream. This ensures the frontend receives the citations concurrently with the text stream.
5. **Persistence**: In the `onFinish` callback, the citations array is saved to the newly created assistant Message's `metadata` field, ensuring it survives page refreshes.

## Citation UI

The UI displays citations as subtle pill-shaped chips below the assistant's message:

```
[📄 technical_spec.pdf] [📄 architecture.pdf]
```

Clicking a source opens the presigned URL in a new tab.

---

## Failure Modes to Handle

| Failure | Handling |
|---------|----------|
| Document parsing fails | Set `status: failed`, store `error_message`, surface in UI |
| Embedding API timeout | Retry with exponential backoff (3 attempts) |
| No chunks above threshold | Proceed without RAG context; note in response |
| Chunk table empty for workspace | Skip retrieval step entirely |
| Embedding dimension mismatch | Hard error — means model was changed after data was stored |

---

## Evaluation

Track these metrics to know if your RAG is working:

| Metric | How to measure |
|--------|---------------|
| Retrieval precision | Of top-5 chunks, how many are actually relevant? (manual spot-check) |
| Answer faithfulness | Does the answer contradict the retrieved chunks? (LangSmith eval) |
| Context utilisation | Are retrieved chunks actually used in the answer? |
| Similarity score distribution | Log p50/p90 of scores per query |

Set up a small golden dataset (10–20 Q&A pairs over test documents) in M6 for automated regression.
