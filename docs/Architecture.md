# Architecture

## Overview

Quasar is a three-tier web application with a clear separation between the client layer, the backend/API layer, and the data/AI layer. The frontend is a Next.js app deployed on Vercel. The AI-heavy workloads (RAG, agents, embeddings) run in a separate FastAPI service deployed via Docker. Both talk to the same PostgreSQL database and Supabase Storage bucket.

---

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT LAYER (Vercel)                                      │
│  Next.js 14 · shadcn/ui · Tailwind · React Query           │
│  Clerk (auth) · Vercel AI SDK (streaming)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS / SSE
┌───────────────────────────▼─────────────────────────────────┐
│  BACKEND LAYER                                              │
│                                                             │
│  Next.js API Routes          FastAPI Service               │
│  (auth, CRUD, chat)          (RAG, agents, embeddings)     │
│                                                             │
│  MCP Gateway                                               │
│  (GitHub · Filesystem · Figma · PostgreSQL)                │
│                                                             │
│  LangGraph Pipeline                                        │
│  Planner → Researcher → Coder → Reviewer → Executor        │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  DATA / AI LAYER                                            │
│                                                             │
│  PostgreSQL + Prisma   pgvector (embeddings)               │
│  Redis (short-term memory)   Supabase Storage              │
│  Claude API   OpenAI API   LangSmith   OpenTelemetry       │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### Client Layer

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| Pages and routing | Next.js 14 App Router | URL structure, layouts, SSR |
| UI components | shadcn/ui + Tailwind | Design system, accessible components |
| State and cache | React Query (TanStack Query) | Server state, optimistic updates |
| Streaming | Vercel AI SDK (`useChat`) | SSE stream consumption, token rendering |
| Auth UI | Clerk components | Sign-up, sign-in, user button |

### Backend — Next.js API Routes

Used for M1 and M2. Handles:
- Auth webhook from Clerk (sync user to DB on first sign-in)
- Workspace CRUD
- Conversation and message CRUD
- Chat completions with streaming (via Vercel AI SDK + Claude)
- File upload orchestration (presign URL → Supabase Storage → trigger ingestion)

### Backend — FastAPI Service

Introduced in M3. Handles:
- Document ingestion pipeline (parse → chunk → embed → store)
- Semantic retrieval for RAG
- LangGraph agent execution
- MCP gateway endpoints

FastAPI is chosen here because Python has the richest ecosystem for document parsing (`unstructured`), embeddings (`sentence-transformers`, `openai`), and LangGraph.

### MCP Gateway

A thin router layer inside FastAPI that wraps external tool APIs in a standard MCP interface. Each tool is a separate module:
- `tools/github.py` — list repos, create issues, open PRs, commit files
- `tools/filesystem.py` — sandboxed read/write in a workspace directory
- `tools/figma.py` — fetch file metadata and component specs (read-only)
- `tools/postgres.py` — run read-only SQL queries against the user's own DB (future)

### LangGraph Pipeline

A finite-state machine with the following nodes:

```
START
  ↓
Planner       (decomposes the user task into steps)
  ↓
Researcher    (RAG retrieval + web search if needed)
  ↓
Coder         (generates code files or shell commands)
  ↓
Reviewer      (validates output, checks for errors)
  ↓
Executor      (runs code, commits to GitHub, calls MCP tools)
  ↓
END
```

State is persisted to `agent_runs` table so runs are resumable.

---

## Data Flow — Chat Request

```
User types message
  → useChat sends POST /api/chat
  → Next.js API route validates session (Clerk)
  → Fetches conversation history from PostgreSQL
  → If workspace has documents: calls FastAPI /retrieve
    → pgvector similarity search
    → top-k chunks returned
  → Injects chunks + history into Claude prompt
  → Streams response back via SSE
  → On stream end: persists message + token count to DB
```

## Data Flow — Document Ingestion

```
User uploads PDF
  → Client requests presigned URL from Next.js API
  → Client uploads directly to Supabase Storage
  → Next.js API creates document record (status: pending)
  → Next.js API calls FastAPI POST /ingest
    → Parses file (unstructured / PyMuPDF)
    → Splits into chunks (token-aware, with overlap)
    → Embeds each chunk (OpenAI / Cohere embeddings)
    → Stores chunks + embeddings in pgvector
  → Updates document status: ready
  → Client polls document status and shows success
```

---

## Key Design Decisions

See [Decisions.md](Decisions.md) for the full ADR list. The short versions:

- **Next.js API routes first, FastAPI only from M3** — avoids dual-service complexity in early milestones.
- **pgvector over Pinecone** — keeps infra simple; add Pinecone if chunks exceed ~1M.
- **PostgreSQL over Redis for memory in M4 prototype** — validate the logic first, then add Redis for performance.
- **Clerk over Auth.js** — faster to implement, better DX, free tier is sufficient.
- **Supabase Storage over S3** — same bucket as DB provider, row-level security, no extra account.

---

## Environments

| Environment | Frontend | Backend | DB |
|-------------|----------|---------|-----|
| Local dev | `localhost:3000` | `localhost:8000` | Local PostgreSQL |
| Preview | Vercel preview URL | — (calls local or prod) | Supabase cloud |
| Production | Vercel prod URL | Docker on Railway/Fly.io | Supabase cloud |
