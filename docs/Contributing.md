# Contributing

This project is built solo (for now) but documented as if it were a team project — which is good practice and looks better in a portfolio.

---

## Development Workflow

### Branches

```
main          ← protected, production-ready at all times
feat/*        ← new features (e.g., feat/m2-streaming-chat)
fix/*         ← bug fixes (e.g., fix/message-save-on-disconnect)
docs/*        ← documentation only
chore/*       ← dependency updates, config changes
```

Branch naming: `[type]/[milestone]-[short-description]`
Examples: `feat/m3-rag-ingestion`, `fix/m2-token-count`, `docs/m1-architecture`

### Commit Style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add document upload progress indicator
fix: correct token count on streamed messages
docs: update RAG pipeline explanation
chore: upgrade @ai-sdk/anthropic to 0.0.55
refactor: extract context assembly into separate module
test: add golden set for RAG evaluation
```

Keep commits small and focused. One logical change per commit.

### Opening a Pull Request

Even when working solo, open PRs instead of pushing directly to `main`. This:
- Runs CI before the code lands in main
- Keeps a record of what changed and why
- Looks more professional in the GitHub activity feed

PR description template:
```markdown
## What
Brief description of the change.

## Why
What this unblocks or fixes.

## Testing
How you tested this. Include screenshots for UI changes.

## Checklist
- [ ] Types pass (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (if applicable)
- [ ] Docs updated (if behaviour changed)
```

---

## Code Standards

### TypeScript (Frontend + Next.js API)

- Strict mode on (`"strict": true` in tsconfig)
- No `any` without a comment explaining why
- Prefer `const` over `let`; never `var`
- All API route handlers must have explicit return types
- Zod validation on all API inputs

### Python (FastAPI)

- Type hints on all function signatures
- `ruff` for linting (configured in `pyproject.toml`)
- `mypy` for type checking
- `pytest` for tests

### File naming

| Type | Convention | Example |
|------|-----------|---------|
| React components | PascalCase | `ChatMessage.tsx` |
| Hooks | camelCase with `use` prefix | `useConversation.ts` |
| API routes | lowercase, Next.js convention | `route.ts` inside `app/api/chat/` |
| Utilities | camelCase | `assembleContext.ts` |
| Python modules | snake_case | `rag_retrieve.py` |

---

## Project Structure

```
quasar/
├── src/
│   ├── app/                  ← Next.js App Router pages
│   │   ├── (auth)/           ← Sign-in, sign-up pages
│   │   ├── (dashboard)/      ← Protected pages (chat, docs, memory)
│   │   └── api/              ← Next.js API routes
│   ├── components/           ← Reusable React components
│   │   ├── chat/             ← Chat-specific components
│   │   ├── layout/           ← Sidebar, nav, shell
│   │   └── ui/               ← shadcn/ui components (auto-generated)
│   ├── lib/                  ← Shared utilities
│   │   ├── db.ts             ← Prisma client singleton
│   │   ├── auth.ts           ← Clerk helpers
│   │   └── context.ts        ← Context assembly for LLM
│   └── types/                ← Shared TypeScript types
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── backend/                  ← FastAPI service
│   ├── main.py
│   ├── tools/                ← MCP tools
│   ├── rag/                  ← Ingestion and retrieval
│   ├── agents/               ← LangGraph nodes
│   ├── requirements.txt
│   └── Dockerfile
├── evals/                    ← Evaluation suite
│   ├── golden_set.json
│   └── run_evals.py
├── docs/                     ← All documentation
├── .github/
│   ├── workflows/
│   └── ISSUE_TEMPLATE/
└── README.md
```

---

## Testing

### Frontend

```bash
npm run test          # Run Vitest unit tests
npm run test:e2e      # Run Playwright end-to-end tests (M6)
```

Write unit tests for:
- Context assembly function (`assembleContext`)
- Token counting utilities
- Zod schemas
- Any function with non-trivial logic

Don't unit test API routes or React components unless they have complex logic. Integration tests (e2e) cover the user-facing behaviour.

### Backend

```bash
cd backend
pytest                        # All tests
pytest tests/test_rag.py      # Specific file
pytest -v -k "test_chunking"  # Specific test
```

Write tests for:
- Chunking strategy
- Retrieval pipeline (use a test PostgreSQL with pgvector)
- MCP tool path safety (filesystem traversal prevention)
- Agent state transitions

---

## Running Locally

See [Deployment.md](Deployment.md) for full local setup instructions.

Quick start:

```bash
# Terminal 1 — Next.js
npm install && npm run dev

# Terminal 2 — FastAPI (from M3)
cd backend && uvicorn main:app --reload

# Terminal 3 — services (optional, or use Supabase cloud)
docker compose up postgres redis
```
