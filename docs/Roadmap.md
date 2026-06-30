# Roadmap

## Current Milestones (v1.0)

| Milestone | Status | Target |
|-----------|--------|--------|
| M1 — Foundation (auth, DB, UI) | 🔄 In progress | Week 2 |
| M2 — Chat (streaming, history) | 🔲 Not started | Week 4 |
| M3 — RAG (ingestion, retrieval) | 🔲 Not started | Week 7 |
| M4 — Memory (short + long-term) | 🔲 Not started | Week 9 |
| M5 — Agents (MCP + LangGraph) | 🔲 Not started | Week 12 |
| M6 — Production (evals, CI/CD) | 🔲 Not started | Week 14 |

Update statuses as you go: 🔲 Not started → 🔄 In progress → ✅ Done → ⚠️ Blocked

---

## v1.0 Feature Freeze

The following features are **in scope for v1.0**. Everything else goes below in the backlog.

- [x] Workspace-based project organisation
- [x] Streaming chat with Claude and GPT-4
- [x] Document upload + RAG retrieval
- [x] Short-term conversation memory
- [x] Long-term user preference memory
- [x] MCP tool integrations (GitHub, filesystem)
- [x] LangGraph multi-agent pipeline
- [x] Token cost dashboard
- [x] LangSmith tracing
- [x] Docker + GitHub Actions deployment

---

## v1.1 Backlog (Post-launch improvements)

These are improvements to existing features. Pick from this list once v1.0 is shipped and stable.

### RAG Improvements
- [ ] Codebase ingestion — parse and chunk code files by AST boundaries (function/class level)
- [ ] Hybrid search — combine vector similarity with BM25 keyword search (better for exact term matching)
- [ ] Cross-encoder re-ranking (replace RRF with sentence-transformers cross-encoder)
- [ ] Document preview panel — show source document at the cited page when user clicks a citation
- [ ] Incremental re-ingestion — update only changed chunks when a document is re-uploaded
- [ ] Support for PPTX, XLSX, HTML, Markdown file types

### Chat
- [ ] Conversation branching — fork a conversation from any message
- [ ] System prompt editor — let users write and save custom system prompts per workspace
- [ ] Chat export — export conversation as Markdown or PDF
- [ ] Message reactions (thumbs up/down) for fine-tuning signal

### Memory
- [ ] Memory confidence decay — lower confidence of old memories not recently reinforced
- [ ] Memory import/export — JSON dump of all user memories
- [ ] Scoped memory per workspace (some facts are project-specific, not user-wide)

### Agents
- [ ] Figma MCP tool — "implement this component from Figma" workflow
- [ ] PostgreSQL MCP tool — run read-only SQL against user's own DB
- [ ] Browser MCP tool — web scraping, screenshot, form filling
- [ ] Human-in-the-loop approvals UI — explicit approve/reject before each tool call
- [ ] Agent templates — pre-built agent workflows (e.g., "PR review agent", "doc generation agent")

### Developer Experience
- [ ] API key management UI — let users bring their own Anthropic/OpenAI keys
- [ ] Prompt playground — test prompts with different models and parameters side-by-side
- [ ] Cost alerts — notify user when monthly spend exceeds a threshold

---

## v2.0 Ideas (Future)

These are bigger features that require significant architectural work. Capture them here so they don't get lost.

### Voice Mode
Real-time voice conversation using Whisper (STT) and a TTS provider.
- Requires streaming audio pipeline — significantly more complex than text.
- Latency budget: < 800ms to first spoken word.
- Blocker: stable v1.0 first.

### Multi-user Workspaces
Allow multiple users to share a workspace (team collaboration).
- Requires row-level security on all workspace-scoped tables.
- Requires access control layer (owner, editor, viewer roles).
- Requires collaborative UI (presence indicators, live cursors in chat).

### Plugin System
Let third-party developers write MCP tools and publish them to a Quasar plugin directory.
- Requires plugin sandboxing (Deno or WASM).
- Requires a plugin marketplace UI.

### Self-Hosted Deployment
Docker Compose bundle that deploys the entire stack (Next.js + FastAPI + PostgreSQL + Redis) with a single command.
- Target users: companies with data residency requirements.

### Fine-tuning Pipeline
Allow users to fine-tune a model on their conversation history and documents.
- Requires significant ML infrastructure.
- Likely out of scope for a portfolio project.

---

## Won't Build (and Why)

| Feature | Reason |
|---------|--------|
| Mobile app | Web is sufficient for dev tooling; native adds major complexity |
| Real-time collaboration (Google Docs-style) | CRDT/OT is a large independent project |
| Video/audio file RAG | Transcription pipeline adds complexity without proportional learning value |
| Marketplace / monetisation | This is a portfolio project, not a startup |
