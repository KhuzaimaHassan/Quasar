# Architecture Decision Records (ADRs)

Each decision is recorded here with the context, options considered, and rationale. This is a living document — add a new record whenever you make a significant technical choice.

---

## ADR-001: Next.js API Routes First, FastAPI from M3

**Status**: Accepted  
**Date**: Project planning

**Context**: The project needs a backend API. Two options are Next.js API Routes (TypeScript, same codebase) and FastAPI (Python, separate service).

**Options considered**:
1. Next.js only throughout
2. FastAPI only throughout
3. Next.js for CRUD + FastAPI for AI workloads

**Decision**: Option 3. Use Next.js API Routes for M1 and M2 (auth, CRUD, chat). Introduce FastAPI in M3 for RAG and agents.

**Rationale**: Python's AI ecosystem (LangGraph, unstructured, sentence-transformers, PyMuPDF) is significantly richer than Node.js equivalents for the specific workloads in M3–M5. However, running two services from day one adds setup complexity that slows early milestones down. The split at M3 is the right trade-off.

**Consequences**: Next.js API routes must forward requests to FastAPI once it's introduced. Add a `FASTAPI_SERVICE_URL` env var. In production, FastAPI is a separate Docker container.

---

## ADR-002: pgvector Over Pinecone

**Status**: Accepted  
**Date**: Project planning

**Context**: RAG requires a vector store for storing and querying chunk embeddings.

**Options considered**:
1. pgvector (PostgreSQL extension)
2. Pinecone (managed vector DB)
3. Weaviate (self-hosted vector DB)

**Decision**: pgvector.

**Rationale**: Keeps infrastructure simple — one database service instead of two. pgvector is production-ready for the expected scale (< 500k chunks). Supabase has native pgvector support. Avoids another API key and billing account. HNSW indexes in pgvector (added in pg 0.5.0) have strong recall at scale.

**When to revisit**: If chunks exceed ~1M rows and query latency exceeds 100ms at p95, evaluate Pinecone.

---

## ADR-003: Clerk Over Auth.js / NextAuth

**Status**: Accepted  
**Date**: Project planning

**Context**: The app needs authentication with social login (Google, GitHub), session management, and user sync to the database.

**Options considered**:
1. Clerk (managed auth SaaS)
2. Auth.js / NextAuth (open-source, self-managed)
3. Supabase Auth (tightly coupled to Supabase)

**Decision**: Clerk.

**Rationale**: Clerk's free tier covers this project's scale. Its prebuilt components (`<SignIn>`, `<UserButton>`) eliminate the auth UI entirely. Clerk's webhook makes DB sync straightforward. Auth.js requires more configuration, especially for token rotation and session strategy.

**Consequences**: Adds a vendor dependency. If Clerk pricing changes, migrating to Auth.js is non-trivial. Acceptable for a portfolio project.

---

## ADR-004: Prisma Over Raw SQL / Drizzle

**Status**: Accepted  
**Date**: Project planning

**Context**: Need an ORM or query builder for PostgreSQL in Next.js.

**Options considered**:
1. Prisma (type-safe ORM with migration tooling)
2. Drizzle (lightweight, SQL-like TypeScript ORM)
3. Raw pg / postgres.js (no ORM)

**Decision**: Prisma.

**Rationale**: Prisma's migration system (`prisma migrate`) is mature and well-documented. Its type generation means TypeScript catches schema mismatches at compile time. Drizzle is newer with less community tooling. Raw SQL is faster but removes type safety.

**Consequence**: Prisma doesn't natively support pgvector — vector insertion requires `$executeRaw`. This is a known limitation and the workaround is documented in Database.md.

---

## ADR-005: Vercel AI SDK for Streaming

**Status**: Accepted  
**Date**: M2 planning

**Context**: Need to stream LLM responses from Claude and OpenAI to the browser.

**Options considered**:
1. Vercel AI SDK (`ai` package)
2. Custom SSE implementation using the Anthropic SDK directly
3. LangChain's streaming callbacks

**Decision**: Vercel AI SDK.

**Rationale**: The SDK provides a unified interface for both Anthropic and OpenAI, handles SSE setup, and provides the `useChat` React hook for zero-boilerplate client-side streaming. The SDK also handles tool calling with streaming, which will be needed in M5.

**Consequences**: The SDK abstracts away some LLM API details. If a feature requires direct API access (e.g., Anthropic's extended thinking), use the Anthropic SDK directly and handle streaming manually for that route.

---

## ADR-006: Redis for Short-Term Memory Buffer

**Status**: Deferred to M4  
**Date**: M4 planning

**Context**: Need a fast sliding-window buffer for conversation history.

**Decision**: Use Upstash Redis (serverless Redis, no infra to manage). Implement a simple PostgreSQL fallback for local development without Redis.

**Rationale**: Upstash has a generous free tier and serverless pricing. A `conversation_summaries` table in PostgreSQL covers the M4 prototype — Redis is added only when the polling overhead becomes a real issue.

---

## ADR-007: Render Free Tier for FastAPI Hosting

**Status**: Accepted  
**Date**: M3 deployment

**Context**: Need to host the FastAPI Docker container in production for free (portfolio project).

**Options considered**:
1. Railway
2. Fly.io
3. Render
4. AWS ECS (overkill for this project)

**Decision**: Render free tier.

**Rationale**: Both Railway and Fly.io dropped their free tiers since this ADR was originally written. Render provides a completely free tier for Docker containers. We knowingly accepted Render's cold-start tradeoff (service sleeps after 15 minutes of inactivity, causing a 30-60 second cold start on the next request) because this is a portfolio project and cost-efficiency is the priority. We mitigated the UX impact by adding a 6-second timeout with graceful degradation on the frontend chat retrieval call, while giving the ingestion endpoint a generous 60-second budget to outlast cold starts.

**When to revisit**: If the cold starts become unacceptable for real users, migrate to a paid tier on Render or Railway.

**Mitigation implemented**: Chat retrieval has a 6-second timeout with graceful degradation (missing context is non-fatal). The `/ingest` endpoint has a 60-second budget, which comfortably outlasts Render's cold-start window. A banner in the README warns users about the first-request latency.

---

## ADR-008: LangSmith Over Custom Logging

**Status**: Accepted  
**Date**: M6 planning

**Context**: Need observability for LLM calls and agent runs.

**Decision**: LangSmith.

**Rationale**: LangSmith is purpose-built for LLM tracing. It integrates automatically with LangGraph and LangChain with zero code changes (just env vars). Building custom logging for LLM calls would require significant effort to get to parity.

**Consequences**: LangSmith is a SaaS product — data leaves the application. Acceptable for a portfolio project. For production with sensitive data, evaluate self-hosted alternatives (Langfuse, Phoenix).

---

## ADR-009: Default to Gemini Free Tier, BYOK for Premium Models Later

**Status**: Accepted  
**Date**: M2 planning

**Context**: As a solo developer managing API costs during active development, providing open access to premium models like Claude Sonnet 3.5 or GPT-4o is cost-prohibitive.

**Options considered**:
1. Paying for Claude/GPT-4 myself
2. Free Gemini tier
3. BYOK-only from day one

**Decision**: Default to the free Gemini tier (Gemini 3.5 Flash), and implement Bring Your Own Key (BYOK) for premium models later.

**Status update (M2)**: BYOK is now implemented. Users can add Anthropic (Claude Sonnet 5) or OpenAI (GPT-4o) API keys in Settings. Keys are encrypted at rest per ADR-010.

**Rationale**: The free Gemini tier allows users to experience the application immediately without setup friction or me absorbing high costs. BYOK-only from day one adds too much onboarding friction for a portfolio project.

**Consequences**: 
- Google's free tier rate limits are lower than paid tiers.
- Google's free tier terms permit using inputs/outputs to improve their products, which should be disclosed to users eventually.
- BYOK requires secure key storage, which is deferred to Issue #13.

---

## ADR-010: BYOK Key Storage — Application-Level Encryption

**Status**: Accepted  
**Date**: M2 implementation

**Context**: For BYOK, we must store user-provided billing credentials (API keys for Claude, OpenAI, etc.). A breach could result in severe financial loss for users.

**Decision**: Use application-level AES-256-GCM encryption with an `ENCRYPTION_KEY` environment variable.

**Rationale**: Disk-level database encryption (like AWS RDS encryption at rest) only protects against physical theft of the hard drive. If an attacker gains SQL access or dumps the database, disk-level encryption is transparent and useless. Application-level encryption ensures the database only ever sees ciphertext. We use AES-256-GCM because it provides authenticated encryption (verifying data wasn't tampered with) along with confidentiality.

**Consequences**:
- The plaintext `ENCRYPTION_KEY` must be securely injected into the application environment.
- If `ENCRYPTION_KEY` is lost or rotated without re-encrypting data, all stored user API keys become permanently unrecoverable.
- API keys are only decrypted in-memory per-request and never returned to the client in plaintext.
