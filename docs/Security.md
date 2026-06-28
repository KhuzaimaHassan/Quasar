# Security

## Overview

Quasar handles API keys, user data, and document uploads. This document covers the security practices in place across the stack.

---

## Authentication and Authorisation

### Authentication
All routes are protected by Clerk. The session is validated server-side on every request using `auth()` from `@clerk/nextjs`. There are no client-side-only auth checks.

```typescript
// Every API route starts with this
const { userId } = auth();
if (!userId) return new Response('Unauthorized', { status: 401 });
```

### Authorisation (ownership checks)
Every database query that accesses user data must include a `userId` filter. Never trust a resource ID from the client alone — always verify ownership.

```typescript
// WRONG — no ownership check
const workspace = await prisma.workspace.findUnique({ where: { id: params.id } });

// CORRECT — ownership enforced
const workspace = await prisma.workspace.findUnique({
  where: { id: params.id, userId: userId },  // userId from Clerk, not from client
});
if (!workspace) return new Response('Not found', { status: 404 });
```

Return 404 (not 403) when a resource belongs to another user — this avoids leaking the existence of other users' resources.

---

## API Keys

### How keys are stored
- **Anthropic and OpenAI API keys**: Environment variables only (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`). Never stored in the database. Never sent to the client.
- **User's GitHub OAuth token**: Stored in `users.preferences` jsonb column (encrypted at rest via Supabase's encryption). Only the authenticated user can access it.

### What never goes in the database
- Passwords (Clerk handles this)
- API keys for Anthropic/OpenAI
- Supabase service role key
- Any symmetric encryption keys

### .gitignore
Ensure `.env.local`, `.env`, `.env.production` are in `.gitignore`. Never commit secrets. Use `git-secrets` or `pre-commit` hooks to catch accidental key commits.

---

## Input Validation

All API route inputs are validated with **Zod** before reaching any database or LLM call.

```typescript
import { z } from 'zod';

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  settings: z.record(z.unknown()).optional().default({}),
});

const body = createWorkspaceSchema.safeParse(await req.json());
if (!body.success) return new Response(JSON.stringify(body.error), { status: 422 });
```

Never pass raw `req.body` or `req.json()` to Prisma without validation.

---

## File Upload Security

### Allowed file types
Only `application/pdf` and `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX) are accepted. Validate MIME type server-side (not just the filename extension).

### Storage path scoping
Every uploaded file is stored under `workspaces/{workspace_id}/{uuid}-{filename}`. Presigned URLs are scoped to this path — users cannot upload to other workspaces' paths.

### File size limit
Cap uploads at 25 MB on the Supabase Storage bucket policy. Return a clear error if the file exceeds the limit.

---

## MCP Tool Safety

The filesystem tool (`tools/filesystem.py`) operates in a sandboxed directory. Any path that traverses out of the sandbox is rejected:

```python
def safe_path(workspace_id: str, user_path: str) -> str:
    base = Path(f"/tmp/quasar/{workspace_id}").resolve()
    target = (base / user_path).resolve()
    if not str(target).startswith(str(base)):
        raise ValueError("Path traversal attempt blocked")
    return str(target)
```

The `run_command` tool executes inside a Docker container with:
- No network access
- Read-only filesystem except the workspace directory
- 30-second timeout
- Non-root user

---

## Agent Safety Constraints

Agents can take real-world actions (commit to GitHub, write files). Safety constraints:

- **Confirmation required** before committing to `main` or deleting files — surface an approval step in the UI.
- **Max 20 tool calls per agent run** — prevent runaway agents.
- **5-minute timeout on all agent runs**.
- **Reviewer node** validates code before Executor runs it.
- **Logging** — every tool call is stored in `agent_runs.tool_calls` for audit.

---

## Data Privacy

### What is stored
- Conversation history (messages) — stored in PostgreSQL.
- Uploaded documents and their chunks — stored in Supabase Storage and PostgreSQL.
- Long-term memories (extracted facts) — stored in PostgreSQL.
- LLM call traces — sent to LangSmith.

### User data deletion
Provide a "delete my account" flow that removes:
1. All messages
2. All conversations
3. All documents and their storage files
4. All chunks
5. All memories
6. The user record

Cascade deletes are set in Prisma schema so deleting the `users` record removes all related data.

### LangSmith data
LLM traces (including message content) are sent to LangSmith. For a portfolio project this is acceptable. For a production system with user data, review LangSmith's data retention policy or use a self-hosted alternative (Langfuse).

---

## Rate Limiting

Apply rate limits on:
- `POST /api/chat` — 20 requests per minute per user
- `POST /api/documents/upload-url` — 10 uploads per hour per user
- `POST /api/agents/run` — 5 agent runs per hour per user

Use Upstash Redis with a sliding window algorithm for rate limiting in Next.js:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '1 m'),
});

const { success } = await ratelimit.limit(userId);
if (!success) return new Response('Too many requests', { status: 429 });
```

---

## CORS

The Next.js API routes are only called from the same origin (same Vercel deployment). CORS headers are not needed for Next.js routes.

The FastAPI service is internal (not public-facing). Configure it to only accept requests from the Next.js service's IP in production. In local dev, allow `localhost:3000`.

---

## Dependency Security

- Run `npm audit` as part of CI.
- Run `pip install safety && safety check` for the FastAPI service in CI.
- Enable Dependabot on the GitHub repo for automated dependency update PRs.
- Keep direct dependencies minimal — each extra dependency is an attack surface.
