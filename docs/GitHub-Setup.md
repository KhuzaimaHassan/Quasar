# GitHub Setup

Complete instructions for creating the Quasar repository, labels, milestones, and all 38 issues.

---

## 1. Create the Repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `quasar`
3. Description: `AI-powered developer workspace — RAG, agents, and tool integrations`
4. Visibility: **Public** (portfolio project — make it visible)
5. Add a README: No (you already have one)
6. .gitignore: **Node**
7. License: **MIT**
8. Click **Create repository**

---

## 2. Push Your Docs

```bash
cd Quasar
git init
git add .
git commit -m "docs: initial project planning and documentation"
git remote add origin https://github.com/your-username/quasar.git
git push -u origin main
```

---

## 3. Create Labels

Go to **Issues → Labels → New label** for each of the following.

| Label | Color | Description |
|-------|-------|-------------|
| `feat` | `#185FA5` (blue) | New user-facing feature |
| `infra` | `#0F6E56` (green) | Infrastructure, config, DevOps |
| `ai` | `#854F0B` (amber) | AI, LLM, RAG, agents |
| `ux` | `#3C3489` (purple) | UI and frontend work |
| `bug` | `#A32D2D` (red) | Something broken |
| `docs` | `#5F5E5A` (gray) | Documentation only |
| `blocked` | `#993C1D` (coral) | Waiting on something external |

Delete the default GitHub labels (enhancement, help wanted, etc.) — they add noise.

---

## 4. Create Milestones

Go to **Issues → Milestones → New milestone** for each:

| Title | Description | Due date |
|-------|-------------|----------|
| `M1: Foundation` | Auth, database, workspace UI, first deploy | Week 2 from start |
| `M2: Chat` | Streaming chat, markdown, file upload, history | Week 4 |
| `M3: RAG` | Document ingestion, embeddings, retrieval, citations | Week 7 |
| `M4: Memory` | Short-term buffer, long-term memory, memory UI | Week 9 |
| `M5: Agents` | MCP tools, LangGraph pipeline, code generation | Week 12 |
| `M6: Production` | Evals, monitoring, Docker, CI/CD, final deploy | Week 14 |

---

## 5. Open All Issues

Open each issue below. Assign the milestone and label as listed. You can use the GitHub CLI for speed:

```bash
gh issue create --title "Title" --label "feat" --milestone "M1: Foundation" --body "..."
```

Or open them manually through the GitHub UI.

---

### Milestone 1 — Foundation

**#1** — Init Next.js 14 project with TypeScript + ESLint + Prettier
- Label: `infra`
- Body: `npx create-next-app@latest quasar --typescript --tailwind --app --src-dir`. Configure ESLint, Prettier, and `@typescript-eslint`. Add `lint`, `type-check` scripts to package.json.

**#2** — Integrate Clerk auth (sign-up, sign-in, middleware, route protection)
- Label: `infra`
- Body: Install `@clerk/nextjs`. Set up `middleware.ts` with `clerkMiddleware`. Add `<ClerkProvider>` to root layout. Test sign-up → redirect to `/dashboard`.

**#3** — Set up PostgreSQL + Prisma schema (users, workspaces)
- Label: `infra`
- Body: Install `prisma` and `@prisma/client`. Define `users` and `workspaces` models in `schema.prisma`. Run `prisma migrate dev --name init`. Test connection with `prisma studio`.

**#4** — Workspace CRUD (create, list, switch, delete)
- Label: `feat`
- Body: API routes: `GET /api/workspaces`, `POST /api/workspaces`, `PATCH /api/workspaces/:id`, `DELETE /api/workspaces/:id`. Use Prisma for DB queries. Validate input with Zod.

**#5** — Shell layout (sidebar, nav, workspace switcher)
- Label: `ux`
- Body: Persistent left sidebar with: workspace switcher dropdown, conversation list (placeholder), nav links (Chat, Documents, Memory, Settings). Responsive — collapses on mobile.

**#6** — Deploy to Vercel + configure preview branches
- Label: `infra`
- Body: Connect GitHub repo to Vercel. Set all env vars in Vercel dashboard. Verify preview deployment on a test branch. Add `NEXTAUTH_URL` override for preview environments.

---

### Milestone 2 — Chat

**#7** — Conversations table + Prisma model + API routes
- Label: `infra`
- Body: Add `conversations` and `messages` tables to schema. Migrate. Implement `GET /api/conversations`, `POST /api/conversations`, `DELETE /api/conversations/:id`. Include `GET /api/conversations/:id/messages`.

**#8** — Chat UI (message list, input, send/stop controls)
- Label: `ux`
- Body: Main chat panel with scrollable message list, sticky input at bottom, send button (keyboard shortcut: Cmd+Enter), stop button (appears during streaming), loading skeleton while history loads.

**#9** — Streaming responses via Vercel AI SDK + Claude
- Label: `ai`
- Body: Implement `POST /api/chat` using `streamText` from `ai` with `@ai-sdk/anthropic`. Wire to `useChat` on the client. Confirm tokens stream visibly. Persist assistant message on `onFinish`.

**#10** — Markdown + code syntax highlighting in messages
- Label: `ux`
- Body: Render assistant messages through `react-markdown` + `rehype-highlight` (or `react-syntax-highlighter`). Ensure fenced code blocks render with language label and copy button. Style inline code distinctly.

**#11** — File and image upload in chat (Supabase Storage)
- Label: `feat`
- Body: Paperclip button opens file picker. Accepts PDF, DOCX, PNG, JPEG. Upload to Supabase Storage via presigned URL. Show thumbnail/filename preview in message input. Include file in message metadata.

**#12** — Token usage tracking per message and conversation total
- Label: `ai`
- Body: Store `token_count` on each `messages` row using `usage.totalTokens` from `onFinish`. Increment `conversations.total_tokens`. Show running token count in conversation header.

**#13** — Model switcher (Claude / GPT-4) in conversation settings
- Label: `feat`
- Body: Dropdown in conversation header to switch model. Saves to `conversations.model`. Current message uses the selected model. Show model name next to each assistant message.

---

### Milestone 3 — RAG

**#14** — Document upload UI (drag-and-drop, progress bar)
- Label: `ux`
- Body: Documents page in workspace. Drag-and-drop zone (react-dropzone) accepting PDF and DOCX. Upload progress bar via Supabase Storage's upload progress callback. Document list with status badge.

**#15** — FastAPI ingestion service (parse → chunk → store)
- Label: `ai`
- Body: Set up FastAPI project structure in `/backend`. Install `fastapi`, `uvicorn`, `pymupdf`, `python-docx`, `langchain`. Implement `POST /ingest` endpoint. Parse file, split with RecursiveCharacterTextSplitter (512 tokens, 64 overlap), store chunks to DB.

**#16** — Embed chunks (OpenAI text-embedding-3-small → pgvector)
- Label: `ai`
- Body: After chunking, embed each chunk using `openai.embeddings.create`. Enable `pgvector` extension on PostgreSQL. Add `embedding vector(1536)` column to `chunks`. Batch embed (100 chunks/call max).

**#17** — Semantic retrieval (cosine similarity via pgvector)
- Label: `ai`
- Body: Implement `POST /retrieve` in FastAPI. Embed the query. Run `ORDER BY embedding <=> $query_vector LIMIT 10`. Filter by workspace and similarity threshold (> 0.7). Return top-5 chunks with similarity scores.

**#18** — Inject retrieved chunks into chat context (with citations)
- Label: `ai`
- Body: Before calling Claude, call `POST /retrieve` with the user's message. Build `<context>` block from top chunks. After stream ends, save chunk IDs to `message_sources` table. Render citation pills below assistant message in UI.

**#19** — Document library UI (list, status badge, delete)
- Label: `ux`
- Body: Documents page shows list of workspace documents: filename, size, status badge (pending/processing/ready/failed), date. Poll status every 3s while status is pending/processing. Delete button with confirmation dialog.

**#20** — Re-rank retrieved chunks (Reciprocal Rank Fusion)
- Label: `ai`
- Body: After vector retrieval (top-10), apply RRF scoring combining vector similarity and BM25 keyword score (rank-bm25 library). Return top-5 after re-ranking. Log pre/post rerank positions for evaluation.

---

### Milestone 4 — Memory

**#21** — Redis setup with sliding window conversation buffer
- Label: `infra`
- Body: Add Upstash Redis to the stack. Install `ioredis`. Implement `get_conversation_context(conversation_id)` — stores last N messages in `conv:{id}:buffer` with 24h TTL. Used in `POST /api/chat` context assembly.

**#22** — Memory extraction and conversation compression
- Label: `ai`
- Body: When buffer exceeds 5000 tokens, compress oldest half into a summary using Claude. Store summary in `conv:{id}:summary` (7d TTL). Prepend summary to context on next request. Test that key details survive compression.

**#23** — Long-term memory DB (memories table)
- Label: `infra`
- Body: Add `memories` table to Prisma schema. Add composite unique constraint `(user_id, scope, key)`. Implement `POST /api/memory`, `GET /api/memory`, `PATCH /api/memory/:id`, `DELETE /api/memory/:id`, `DELETE /api/memory`.

**#24** — Preference capture from conversations
- Label: `ai`
- Body: After each conversation session (or on a schedule), run memory extraction prompt over last N messages. Parse JSON output. Upsert into memories table. Only persist confidence ≥ 0.7. Test with 5 different conversation types.

**#25** — Memory panel UI
- Label: `ux`
- Body: Memory page accessible from sidebar. Group memories by scope (Preferences, Projects, Style, Facts). Inline editing of value field. Delete button per memory. "Clear all" button with confirmation. "Add manually" form.

---

### Milestone 5 — Agents

**#26** — MCP gateway — GitHub tool
- Label: `ai`
- Body: `tools/github.py` in FastAPI. Tools: `list_repos`, `get_file`, `create_or_update_file`, `create_issue`, `list_open_prs`, `create_branch`. Auth via GitHub token stored in `users.preferences`. Test each tool independently.

**#27** — MCP filesystem tool (sandboxed read/write)
- Label: `ai`
- Body: `tools/filesystem.py`. Sandboxed to `/tmp/quasar/{workspace_id}/`. Tools: `read_file`, `write_file`, `list_files`, `delete_file`. Reject any path that traverses out of the sandbox (`../` etc). Log all operations.

**#28** — LangGraph state machine (Planner → Coder → Reviewer nodes)
- Label: `ai`
- Body: Install `langgraph`. Define `AgentState` TypedDict. Implement Planner, Researcher, Coder, Reviewer, Executor nodes. Wire with `StateGraph`, add conditional edge from Reviewer back to Coder if review fails. Compile and test with a simple task.

**#29** — agent_runs table + API (start, poll, cancel)
- Label: `infra`
- Body: Add `agent_runs` table to Prisma schema. Implement `POST /api/agents/run` (start), `GET /api/agents/run/:id` (poll), `POST /api/agents/run/:id/cancel`. Persist `state_graph` jsonb after each node completes (resumability).

**#30** — Agent task UI (step trace, tool call log)
- Label: `ux`
- Body: Agent panel in chat sidebar. Show plan steps as a checklist (✅ done, 🔄 running, ⏸ waiting). Show tool calls log (tool name, inputs, result). Poll `GET /api/agents/run/:id` every 2s while running. Cancel button.

**#31** — Code generation flow (generate files + commit to GitHub)
- Label: `feat`
- Body: End-to-end: user asks "build X" → Planner decomposes → Coder generates files → Reviewer approves → Executor commits to GitHub branch. Show generated files as expandable code blocks in the chat. Link to the GitHub commit.

---

### Milestone 6 — Production

**#32** — LangSmith integration (trace LLM calls + agent runs)
- Label: `ai`
- Body: Set `LANGCHAIN_TRACING_V2=true` and `LANGCHAIN_API_KEY` in FastAPI env. Verify traces appear in LangSmith dashboard for both chat completions and agent runs. Add project tags (`quasar`, `production`, `staging`).

**#33** — Cost dashboard (token usage, cost per conversation, trends)
- Label: `feat`
- Body: Settings → Usage page. Show: total tokens this month, estimated cost breakdown (by model), top 10 most expensive conversations, daily token usage chart (recharts). Compute cost from stored token counts + hardcoded price per model.

**#34** — Prompt eval suite (golden Q&A pairs, automated regression)
- Label: `ai`
- Body: Create 20 golden Q&A pairs over test documents. Store in `evals/golden_set.json`. Write `evals/run_evals.py` that runs each question through the RAG pipeline and checks if the answer contains expected facts. Run as part of CI on push to `main`.

**#35** — Dockerize FastAPI service
- Label: `infra`
- Body: Write `backend/Dockerfile` (python:3.11-slim base, copy requirements, copy source, expose 8000, CMD uvicorn). Write `docker-compose.yml` for local dev (postgres + redis + fastapi). Test: `docker compose up` → all services healthy.

**#36** — GitHub Actions CI (lint, type-check, test on every PR)
- Label: `infra`
- Body: `.github/workflows/ci.yml`. Jobs: frontend (npm ci, lint, type-check, test) and backend (pip install, ruff check, mypy, pytest). Run on `pull_request` targeting `main`. Block merge if CI fails.

**#37** — OpenTelemetry spans (latency per retrieval / agent step / LLM call)
- Label: `infra`
- Body: Install `opentelemetry-instrumentation-fastapi` and `opentelemetry-instrumentation-sqlalchemy`. Instrument FastAPI app. Export spans to Uptrace or Jaeger (local). Add custom spans around RAG retrieval and LangGraph node transitions.

**#38** — User feedback widget (thumbs up/down on responses)
- Label: `feat`
- Body: Thumbs up/down buttons appear on hover below each assistant message. Click stores feedback in a new `message_feedback` table (message_id, rating: 1/-1, comment: optional). Show feedback count in LangSmith via metadata tag. Use as signal for eval dataset curation.

---

## 6. Branch Strategy

```
main          ← production branch (protected, PR-only)
develop       ← integration branch (optional but recommended)
feat/m1-auth  ← feature branches, named feat/[milestone]-[topic]
```

Protect `main`: require at least 1 reviewer approval + CI passing before merge.

---

## 7. GitHub Project Board (Optional but Recommended)

Create a GitHub Project (board view) with columns:
- **Backlog** — issues not yet started
- **In Progress** — currently being worked on (limit: 2 issues at a time)
- **In Review** — PR open, awaiting review
- **Done** — merged and closed

Move issues across columns as you work. This gives you a professional project management view and looks good in portfolio screenshots.

---

## 8. Issue Template

Create `.github/ISSUE_TEMPLATE/feature.md`:

```markdown
---
name: Feature
about: New feature or task
---

## What
<!-- One sentence describing what this does -->

## Why
<!-- Why is this needed? What does it unblock? -->

## Acceptance criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Notes
<!-- Technical notes, links, decisions -->
```

---

## Quick Reference — All 38 Issues

| # | Title | Milestone | Labels |
|---|-------|-----------|--------|
| 1 | Init Next.js project | M1 | infra |
| 2 | Clerk auth integration | M1 | infra |
| 3 | PostgreSQL + Prisma schema | M1 | infra |
| 4 | Workspace CRUD | M1 | feat |
| 5 | Shell layout | M1 | ux |
| 6 | Deploy to Vercel | M1 | infra |
| 7 | Conversations table + API | M2 | infra |
| 8 | Chat UI | M2 | ux |
| 9 | Streaming via Vercel AI SDK | M2 | ai |
| 10 | Markdown + syntax highlighting | M2 | ux |
| 11 | File/image upload | M2 | feat |
| 12 | Token tracking | M2 | ai |
| 13 | Model switcher | M2 | feat |
| 14 | Document upload UI | M3 | ux |
| 15 | FastAPI ingestion service | M3 | ai |
| 16 | Embed chunks → pgvector | M3 | ai |
| 17 | Semantic retrieval | M3 | ai |
| 18 | RAG context injection + citations | M3 | ai |
| 19 | Document library UI | M3 | ux |
| 20 | Re-ranking (RRF) | M3 | ai |
| 21 | Redis + conversation buffer | M4 | infra |
| 22 | Memory extraction + compression | M4 | ai |
| 23 | Long-term memory DB | M4 | infra |
| 24 | Preference capture | M4 | ai |
| 25 | Memory panel UI | M4 | ux |
| 26 | MCP GitHub tool | M5 | ai |
| 27 | MCP filesystem tool | M5 | ai |
| 28 | LangGraph state machine | M5 | ai |
| 29 | agent_runs table + API | M5 | infra |
| 30 | Agent task UI | M5 | ux |
| 31 | Code generation + GitHub commit | M5 | feat |
| 32 | LangSmith integration | M6 | ai |
| 33 | Cost dashboard | M6 | feat |
| 34 | Prompt eval suite | M6 | ai |
| 35 | Dockerize FastAPI | M6 | infra |
| 36 | GitHub Actions CI | M6 | infra |
| 37 | OpenTelemetry spans | M6 | infra |
| 38 | User feedback widget | M6 | feat |
