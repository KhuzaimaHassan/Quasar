# Quasar

> An AI-powered developer workspace — chat, RAG, agents, and tool access in one place.

Quasar is a production-grade AI SaaS built to demonstrate modern AI engineering: streaming LLM responses, retrieval-augmented generation over uploaded documents, persistent user memory, MCP-based tool integrations (GitHub, filesystem, Figma), and a LangGraph multi-agent orchestration layer — all in a clean Next.js interface.

---

## Product Vision

Software engineers lose hours context-switching between their editor, documentation, AI chat, and version control. Quasar collapses that into a single workspace: you bring your codebase, your documents, and your tools — Quasar brings the AI that understands all of them together.

**This is a portfolio/learning project** built to demonstrate:
- Modern full-stack development (Next.js 14, TypeScript, Prisma)
- Production AI integration (streaming, RAG, multi-agent)
- Real deployment practices (Docker, GitHub Actions, Vercel)
- Observability and evaluation (LangSmith, OpenTelemetry)

---

## Milestones

| Milestone | Focus | Est. Duration |
|-----------|-------|---------------|
| M1 | Foundation — auth, DB, basic UI | 2 weeks |
| M2 | Chat — streaming, markdown, history | 2 weeks |
| M3 | RAG — document ingestion and retrieval | 3 weeks |
| M4 | Memory — short-term and long-term | 2 weeks |
| M5 | Agents — MCP + LangGraph orchestration | 3 weeks |
| M6 | Production — evals, monitoring, CI/CD | 2 weeks |

---

## Tech Stack (Quick Reference)

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (M1–M2), FastAPI (M3+)
- **Database**: PostgreSQL + Prisma, pgvector (embeddings), Redis (memory)
- **AI**: Claude (Anthropic), GPT-4 (OpenAI), Vercel AI SDK, LangGraph
- **Storage**: Supabase Storage
- **Monitoring**: LangSmith, OpenTelemetry
- **Deployment**: Vercel (frontend), Docker + GitHub Actions (backend)

---

## Documentation

| File | Contents |
|------|----------|
| [Architecture.md](docs/Architecture.md) | System design, component relationships, data flow |
| [Database.md](docs/Database.md) | Schema, tables, relationships, migration notes |
| [AI-Pipeline.md](docs/AI-Pipeline.md) | LLM integration, streaming, prompt design |
| [RAG.md](docs/RAG.md) | Document ingestion, chunking, embeddings, retrieval |
| [Memory.md](docs/Memory.md) | Short-term buffer, long-term store, preference capture |
| [Agents.md](docs/Agents.md) | LangGraph FSM, agent nodes, MCP tool integrations |
| [API.md](docs/API.md) | All API routes, request/response shapes |
| [Deployment.md](docs/Deployment.md) | Docker, Vercel, GitHub Actions CI/CD |
| [Roadmap.md](docs/Roadmap.md) | Feature backlog, v2 ideas |
| [Decisions.md](docs/Decisions.md) | Architecture Decision Records (ADRs) |
| [Lessons-Learned.md](docs/Lessons-Learned.md) | Notes as the project progresses |
| [GitHub-Setup.md](docs/GitHub-Setup.md) | Repo setup, labels, milestones, all 38 issues |

---

## Project Status

🟡 **In planning** — documentation and schema finalized, development not yet started.
