# Quasar

> AI-powered developer workspace — streaming chat, document RAG, and multi-model support.

**Live Demo:** [https://quasar.vercel.app](https://quasar.vercel.app/)

> **Note on the document ingestion service:** The RAG backend runs on Render's free tier, which spins down after 15 minutes of inactivity. The first document upload or retrieval call after an idle period may take 30–60 seconds to respond. This is expected and not a bug — subsequent calls are fast.

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk)](https://clerk.com/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)

---

## What Quasar Does

Quasar is a production-deployed AI developer workspace. It lets you:

- **Chat with multiple AI models** — Gemini (free, default), Claude Sonnet, and GPT-4o (via your own API key)
- **Upload documents and ask questions about them** — full retrieval-augmented generation (RAG): upload a PDF or DOCX, watch it get ingested and embedded, then ask questions and receive responses with cited sources
- **Organise conversations into workspaces** — multi-workspace support with per-workspace document libraries and conversation history
- **Track token usage** — per-message and running conversation totals
- **Attach images to messages** — inline image uploads understood directly by the model

---

## Key Features

### ✅ Fully Implemented

- **Streaming Chat** — real-time token streaming with Gemini 3.5 Flash (free default) or Gemini 2.5 Pro
- **Bring Your Own Key (BYOK)** — Claude Sonnet 5 and GPT-4o unlocked by adding your own Anthropic/OpenAI API key in Settings; keys are encrypted at rest with AES-256-GCM
- **Full RAG Pipeline** — upload PDF/DOCX → parse (PyMuPDF / python-docx) → chunk (500-token target, 60-token overlap) → embed (Gemini embedding-001, 768 dims) → store in pgvector → retrieve (cosine similarity + BM25 re-ranking via RRF) → inject as context → cite sources in responses
- **Document Library** — per-workspace document management with live status polling (pending → processing → ready / failed), delete with Supabase Storage cleanup
- **Multi-Workspace** — create and switch between workspaces; each workspace has its own conversations and documents
- **Token Tracking** — per-message token counts stored in the database; running total shown in the chat header
- **File and Image Attachments** — paperclip upload with presigned Supabase URLs; images are passed directly to the model as multimodal input; PDFs/DOCX go through the RAG pipeline
- **Model Switcher** — per-conversation model selection; changes are persisted immediately to the database
- **Authentication** — Clerk with email/password and OAuth; webhook-driven database sync on sign-up; secure route protection
- **Markdown Rendering** — streaming-aware markdown with syntax highlighting and copy buttons via `streamdown`
- **Responsive Layout** — desktop sidebar, mobile hamburger drawer, accessible at any viewport

### 🔮 Planned

- **Memory** (M4) — short-term conversation buffer (Redis) + long-term preference extraction
- **Agents** (M5) — LangGraph state machine, MCP tool integrations (GitHub, filesystem)
- **Production Evals** (M6) — LangSmith tracing, prompt eval suite, cost dashboard

---

## Screenshots

[screenshot: chat interface with streaming response]

[screenshot: documents page showing upload zone and document list with status badges]

[screenshot: settings page — BYOK API key management]

[screenshot: mobile view — hamburger nav open]

---

## Technology Stack

### Frontend
- **Next.js 16** (App Router, Turbopack)
- **React 19** with TypeScript
- **Tailwind CSS v4** with Shadcn UI component primitives
- **Vercel AI SDK** (`useChat`, `streamText`, `DefaultChatTransport`) for streaming
- **TanStack Query** for data fetching and cache invalidation
- **Clerk** for authentication
- **Supabase JS** (Storage for file uploads)

### Backend — Next.js API Routes
- **Prisma** ORM with PostgreSQL (Supabase)
- **pgvector** extension for semantic search
- Clerk webhook integration (user.created / user.deleted)
- AES-256-GCM BYOK key encryption

### Backend — FastAPI (RAG Service)
- **Python 3.11** / **FastAPI** with asyncpg connection pool
- **PyMuPDF** (PDF parsing) + **python-docx** (DOCX parsing)
- **Google Gemini** embedding-001 (768-dimensional embeddings)
- **rank-bm25** for BM25 keyword scoring
- **asyncpg** raw SQL for pgvector operations

### Infrastructure
- **Vercel** — Next.js hosting (production)
- **Render** — FastAPI Docker container (free tier)
- **Supabase** — PostgreSQL + pgvector + Storage
- **Docker / Docker Compose** — local FastAPI development
- **Clerk** — authentication SaaS

---

## Architecture

```
Browser → Clerk (Auth) → Next.js (Vercel)
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         Supabase         Prisma/Supabase    Clerk Webhooks
         Storage          PostgreSQL          (user sync)
              │               │
              └───────────────┤
                              │  (chat retrieval / doc ingest)
                        FastAPI (Render)
                              │
                        Supabase pgvector
```

For a detailed breakdown of the architecture, data flow, and every design decision, see the [`docs/`](docs/) folder:

| Document | Purpose |
|----------|---------|
| [Architecture.md](docs/Architecture.md) | System design and data flow |
| [RAG.md](docs/RAG.md) | Full RAG pipeline: parsing → chunking → embedding → retrieval → citation |
| [Decisions.md](docs/Decisions.md) | Architecture Decision Records (ADRs) — the *why* behind every major choice |
| [Database.md](docs/Database.md) | Prisma schema, pgvector setup, query patterns |
| [API.md](docs/API.md) | All API endpoints (Next.js routes + FastAPI) |
| [Security.md](docs/Security.md) | BYOK encryption, route protection, ownership model |
| [Deployment.md](docs/Deployment.md) | Vercel + Render deployment guide |
| [Roadmap.md](docs/Roadmap.md) | Milestone plan and backlog |
| [Lessons-Learned.md](docs/Lessons-Learned.md) | Hard-won engineering notes |

---

## Getting Started

### Prerequisites
- Node.js >= 20
- npm >= 10
- A [Clerk](https://clerk.com) account (free)
- A [Supabase](https://supabase.com) project with the `pgvector` extension enabled (free)
- A Google AI Studio API key for Gemini (free tier available)

### Clone & Install

```bash
git clone https://github.com/KhuzaimaHassan/Quasar.git
cd Quasar
npm install
```

### Environment Variables

Create `.env.local` in the project root. See [docs/Environment-Setup.md](docs/Environment-Setup.md) for the full setup guide.

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/chat
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/chat

# Supabase / PostgreSQL
DATABASE_URL="postgresql://..."           # Pooled connection (pgbouncer)
DIRECT_URL="postgresql://..."             # Direct connection (migrations only)
NEXT_PUBLIC_SUPABASE_URL="https://..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# Gemini (free tier sufficient)
GOOGLE_GENERATIVE_AI_API_KEY="..."

# BYOK Encryption — generate with: node -e "require('crypto').randomBytes(32).toString('base64').then(k => console.log(k))"
# Or: openssl rand -base64 32
ENCRYPTION_KEY="<32-byte-base64-key>"

# FastAPI service (local dev)
INTERNAL_SERVICE_SECRET="dev_internal_secret"
FASTAPI_SERVICE_URL="http://localhost:8000"
```

> **Important:** `ENCRYPTION_KEY` must decode to exactly 32 bytes when base64-decoded. Use `openssl rand -base64 32` or the Node.js snippet above to generate a valid key.

### Run Locally

**Next.js frontend:**
```bash
npm run dev
```

**FastAPI RAG service (requires Docker):**
```bash
docker compose up
```

Or run directly with uvicorn:
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The app will be available at `http://localhost:3000`.

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/               # Sign-in / sign-up pages (Clerk)
│   ├── (dashboard)/          # Protected workspace pages
│   │   ├── chat/             # Chat UI and conversation list
│   │   ├── documents/        # Document library and upload
│   │   └── settings/         # BYOK API key management
│   └── api/                  # Next.js API routes
│       ├── chat/             # Streaming chat handler (Vercel AI SDK)
│       ├── conversations/    # Conversation CRUD + messages + attachments
│       ├── workspaces/       # Workspace CRUD
│       ├── api-keys/         # BYOK key storage (AES-256-GCM)
│       └── webhooks/clerk/   # Clerk user.created / user.deleted sync
├── components/               # Reusable UI (layout, chat, documents)
└── lib/                      # Utilities, queries, models, encryption

backend/                      # FastAPI RAG service
├── main.py
├── routers/
│   ├── ingest.py             # POST /ingest — full ingestion pipeline
│   └── health.py
└── core/
    ├── parsing.py            # PDF + DOCX text extraction
    ├── chunking.py           # Token-aware chunking
    ├── embeddings.py         # Gemini embedding-001
    └── db.py                 # asyncpg pool management

docs/                         # Architecture docs and ADRs
prisma/                       # Prisma schema and migrations
```

---

## Current Status

| Milestone | Status |
|-----------|--------|
| M1 — Foundation (auth, DB, UI shell) | ✅ Complete |
| M2 — Chat (streaming, BYOK, history, attachments) | ✅ Complete |
| M3 — RAG (ingestion, retrieval, citations) | ✅ Complete |
| M4 — Memory | 🔲 Planned |
| M5 — Agents (MCP + LangGraph) | 🔲 Planned |
| M6 — Production evals and monitoring | 🔲 Planned |

---

## Engineering Principles

- **Type Safety** — end-to-end TypeScript from API routes to UI components
- **Security by Design** — application-level AES-256-GCM encryption for BYOK keys; 404-masking for all resource ownership checks; Clerk at the proxy layer plus per-route auth guards
- **Single Source of Truth** — all conversation state (model, tokens, messages) is DB-authoritative; the UI derives from it
- **Graceful Degradation** — RAG cold-start handled with timeout + fallback; streaming errors surface in-UI rather than hanging

---

## Contributing

This is a portfolio project but contributions and feedback are welcome. Please ensure all code passes `npm run lint` and `npm run type-check` before opening a pull request.

---

## License

MIT License
