# RAG (Retrieval-Augmented Generation)

## Overview

Quasar lets users upload text-based PDF and DOCX documents to a workspace. When they chat, the system retrieves the most relevant chunks from those documents and injects them into the LLM's context. This allows the model to answer questions about documents it has never seen in training. Codebase ingestion remains planned.

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
| PDF | `PyMuPDF` | Extracts selectable text; uses local Tesseract OCR for pages containing images, including scanned pages |
| DOCX | `python-docx` + local Tesseract | Extracts paragraph text and OCRs embedded PNG, JPEG, TIFF, and BMP images |

OCR runs locally in the backend container; document bytes and OCR text are not sent to a separate vision API. The Docker image installs Tesseract with English language data. Local backend developers must install Tesseract and make its executable available on `PATH`; set `OCR_LANGUAGE` to a language installed in Tesseract when needed (defaults to `eng`). If OCR is required but Tesseract or the selected language data is missing, ingestion fails with a visible document error rather than silently indexing empty content. PyMuPDF's partial OCR output follows selectable page text, so reading order may not match the original page layout. OCR output for DOCX media is appended after the document's paragraph text, so original image placement and layout are not preserved. Unsupported DOCX media formats such as SVG/EMF are currently skipped. See the [PyMuPDF OCR documentation](https://pymupdf.readthedocs.io/en/latest/page.html#Page.get_textpage_ocr) and [Tesseract installation guide](https://tesseract-ocr.github.io/tessdoc/Installation.html).

TXT, Markdown, and AST-aware code ingestion are planned capabilities, not current upload formats. PDF/DOCX files attached directly in chat are downloadable attachments; upload them in Documents to index their contents for Q&A.

Failed documents, abandoned uploads older than five minutes, and historical ready documents with zero chunks can be retried manually without uploading another copy. Concurrent ingestion requests are admitted atomically; indexed documents are not re-embedded by Retry. Upload URL creation and ingestion requests each have a separate per-user limit of 10/hour. No retries are started automatically by the UI.

Saved source citations use the authenticated document download route, which checks workspace ownership and signs a fresh 60-second URL on each click. They no longer depend on the historical upload-time URL. Chat attachments have a separate conversation-owned renewal route; renewing a chat attachment does not index it. See the [API reference](API.md) and [fix history](Fix-History.md) for PRs #125–126.

---

## Chunking Strategy

### Parameters (tune these as you learn)

| Parameter | Default | Notes |
|-----------|---------|-------|
| Chunk size | 500 tokens | Target size for paragraph/sentence accumulation |
| Overlap | 60 tokens | Preserves context across chunks |
| Min fragment size | 30 tokens | Discard small fragments, but retain a whole short document when nothing else remains |

### Algorithm

We implement a manual recursive paragraph and sentence splitter:

```python
from google.genai import local_tokenizer
from functools import lru_cache

@lru_cache(maxsize=1)
def get_tokenizer():
    return local_tokenizer.LocalTokenizer("gemini-2.5-flash")

def count_tokens(text: str) -> int:
    return get_tokenizer().count_tokens(text).total_tokens
```

Always split by **tokens**, not characters. We first split by double newlines (`\n\n`) to preserve paragraphs, and if a single paragraph exceeds the token limit, we recursively break it down by sentence boundaries (`.!?`). We greedily accumulate these units until the target token size is met.

### Metadata per chunk

Chunks currently store an empty `metadata` object. Document filename and the chunk index are stored in dedicated columns and returned by the retrieval join:

```json
{
  "document_filename": "technical_spec.pdf",
  "chunkIndex": 0
}
```

The UI cites the filename with a signed source link. Page numbers, section headings, and character offsets are not currently persisted. Tokenizer model assets load on the first chunking request rather than during service startup.

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
        rows = await conn.fetch(sql, emb_str, workspace_id, 0.65, top_k * 2)

    # 3. Re-rank
    return rerank(query, [dict(r) for r in rows])[:top_k]
```

### Similarity Threshold

The current retrieval cutoff is `similarity > 0.65`, applied before BM25/RRF. A paired experiment on the golden-set workspace on 2026-11-26 compared `0.70`, `0.65`, and `0.60` using the same query embeddings, vector candidates, BM25 reranking, and top-5 output:

| Threshold | Expected source found in top 5 | Negative queries returning chunks | Mean returned chunks per query |
|-----------|--------------------------------:|---------------------------------:|-------------------------------:|
| `> 0.70` | 6/11 | 0/3 | 0.71 |
| `> 0.65` | 10/11 | 0/3 | 1.79 |
| `> 0.60` | 10/11 | 0/3 | 2.43 |

`0.65` was selected because it recovered four additional expected document sources while preserving empty retrieval for all three negative queries. Lowering to `0.60` found no additional expected source and returned more chunks.

An answer-level RAGAS comparison focused on the four known-gap queries that gained their expected source at `0.65`:

| Threshold | Source hit@5 | Faithfulness | Answer relevancy | Context precision | Context recall |
|-----------|-------------:|-------------:|-----------------:|------------------:|---------------:|
| `> 0.70` | 0/4 | 0.9375 | 0.0000 | 0.0000 | 0.0000 |
| `> 0.65` | 4/4 | 1.0000 | 0.8565 | 0.9375 | 1.0000 |

At both thresholds the three negative queries returned no chunks and passed the existing refusal phrase check (3/3). This is a focused benchmark, not a guarantee for every workspace: it covers 11 document queries and only three negatives, and the refusal check is a phrase heuristic. `resume_teletabib` remains below the selected threshold at its recorded similarity of `0.5810`.

The historical `0.70` value was inherited from planning before `gemini-embedding-001` was chosen. Thresholds should be evaluated against the embedding model and representative queries rather than copied from another system.

### pgvector operators

| Operator | Distance metric |
|----------|----------------|
| `<=>` | Cosine distance (use this — standard for text) |
| `<->` | L2 / Euclidean distance |
| `<#>` | Inner product |

---

## Re-ranking

After vector retrieval, results are re-ranked using **Reciprocal Rank Fusion (RRF)** to combine vector similarity with BM25 keyword matching for optimal precision.

Implementation details:
- **Candidate Pool**: The vector search retrieves a `2x` candidate pool (e.g., requests 10 chunks if `top_k` is 5) to give the re-ranker a meaningful set to sort.
- **BM25**: Uses the lightweight, pure Python `rank-bm25` library for fast, on-the-fly keyword scoring of the candidates.
- **RRF Formula**: `rrf_score = 1/(60 + vector_rank) + 1/(60 + bm25_rank)` (using 1-indexed ranks and k=60).
- **Execution**: The candidates are scored, re-ranked by RRF, and trimmed down to the final `top_k` before returning.

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
