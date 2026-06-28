# API Reference

## Overview

Quasar has two API surfaces:

- **Next.js API Routes** — handles auth, CRUD, chat, and file orchestration.
- **FastAPI service** — handles RAG ingestion, retrieval, and agent execution.

All Next.js routes are at `/api/*`. FastAPI routes are at `http://fastapi-service:8000/*` (internal, not public-facing in production).

All requests require an authenticated session (Clerk JWT), except the Clerk webhook.

---

## Authentication

Every Next.js API route validates the session using Clerk:

```typescript
import { auth } from '@clerk/nextjs';

export async function GET(req: Request) {
  const { userId } = auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });
  // ...
}
```

---

## Next.js API Routes

### Users

#### `POST /api/webhooks/clerk`
Clerk webhook — syncs new users to the `users` table on sign-up.

```json
// Payload from Clerk
{
  "type": "user.created",
  "data": { "id": "user_abc", "email_addresses": [...] }
}
```

```json
// Response
{ "ok": true }
```

---

### Workspaces

#### `GET /api/workspaces`
List all workspaces for the authenticated user.

```json
// Response 200
[
  { "id": "uuid", "name": "My Project", "slug": "my-project", "createdAt": "..." },
  ...
]
```

#### `POST /api/workspaces`
Create a new workspace.

```json
// Request body
{ "name": "Quasar", "settings": {} }

// Response 201
{ "id": "uuid", "name": "Quasar", "slug": "quasar", "createdAt": "..." }
```

#### `PATCH /api/workspaces/:id`
Update workspace name or settings.

```json
// Request body
{ "name": "Quasar v2", "settings": { "defaultModel": "gpt-4o" } }

// Response 200
{ "id": "uuid", "name": "Quasar v2", ... }
```

#### `DELETE /api/workspaces/:id`
Delete a workspace and all its conversations and documents.

```json
// Response 200
{ "deleted": true }
```

---

### Conversations

#### `GET /api/conversations?workspaceId=:id`
List conversations in a workspace, ordered by `updated_at` desc.

```json
// Response 200
[
  { "id": "uuid", "title": "How does RAG work?", "model": "claude-sonnet-4-5", "updatedAt": "..." },
  ...
]
```

#### `POST /api/conversations`
Create a new conversation.

```json
// Request body
{ "workspaceId": "uuid", "model": "claude-sonnet-4-5" }

// Response 201
{ "id": "uuid", "title": "New conversation", "model": "claude-sonnet-4-5", ... }
```

#### `PATCH /api/conversations/:id`
Update title or model.

```json
// Request body
{ "title": "RAG implementation plan", "model": "gpt-4o" }
```

#### `DELETE /api/conversations/:id`
Delete conversation and all its messages.

---

### Messages

#### `GET /api/conversations/:id/messages`
Get all messages in a conversation (used for initial load; streaming handles new messages).

```json
// Response 200
[
  { "id": "uuid", "role": "user", "content": "...", "tokenCount": 24, "createdAt": "..." },
  { "id": "uuid", "role": "assistant", "content": "...", "tokenCount": 312, "sources": [...], "createdAt": "..." }
]
```

---

### Chat (Streaming)

#### `POST /api/chat`
Core chat completion endpoint. Returns a streaming SSE response consumed by `useChat`.

```json
// Request body
{
  "messages": [
    { "role": "user", "content": "Explain pgvector indexes" }
  ],
  "conversationId": "uuid",
  "workspaceId": "uuid",
  "model": "claude-sonnet-4-5"
}
```

Response: `text/event-stream` (Vercel AI SDK data stream format).

After stream ends, the server persists the assistant message to the DB (including token count and source citations if RAG was used).

---

### Documents

#### `GET /api/documents?workspaceId=:id`
List all documents in a workspace.

```json
// Response 200
[
  {
    "id": "uuid",
    "filename": "technical_spec.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 204800,
    "status": "ready",
    "createdAt": "..."
  }
]
```

#### `POST /api/documents/upload-url`
Request a presigned Supabase Storage upload URL. The client uploads directly to storage.

```json
// Request body
{ "workspaceId": "uuid", "filename": "spec.pdf", "mimeType": "application/pdf", "sizeBytes": 204800 }

// Response 200
{
  "uploadUrl": "https://supabase.co/storage/v1/object/...",
  "documentId": "uuid",
  "storagePath": "workspaces/uuid/spec.pdf"
}
```

#### `POST /api/documents/:id/ingest`
Called by the client after upload completes. Triggers FastAPI ingestion pipeline.

```json
// Response 202
{ "documentId": "uuid", "status": "processing" }
```

#### `GET /api/documents/:id`
Get document status (for polling after upload).

```json
// Response 200
{ "id": "uuid", "status": "ready", "chunkCount": 42 }
```

#### `DELETE /api/documents/:id`
Delete document, its chunks, and its storage file.

---

### Memory

#### `GET /api/memory`
Get all memories for the authenticated user.

```json
// Response 200
[
  { "id": "uuid", "scope": "preference", "key": "preferred_language", "value": "TypeScript", "confidence": 0.95 },
  ...
]
```

#### `POST /api/memory`
Manually add a memory.

```json
// Request body
{ "scope": "preference", "key": "preferred_test_framework", "value": "vitest" }
```

#### `PATCH /api/memory/:id`
Update a memory's value or confidence.

#### `DELETE /api/memory/:id`
Delete a single memory.

#### `DELETE /api/memory`
Delete all memories for the user.

---

### Agent Runs

#### `POST /api/agents/run`
Start an agent run from a user task.

```json
// Request body
{ "task": "Build a Todo App in Next.js", "conversationId": "uuid", "targetRepo": "my-org/my-repo" }

// Response 202
{ "runId": "uuid", "status": "pending" }
```

#### `GET /api/agents/run/:id`
Poll run status and step progress.

```json
// Response 200
{
  "id": "uuid",
  "status": "running",
  "currentStep": "coder",
  "plan": ["Set up Next.js project", "Create TodoList component", "..."],
  "toolCalls": [...],
  "startedAt": "..."
}
```

#### `POST /api/agents/run/:id/cancel`
Cancel a running agent run.

---

## FastAPI Internal Routes

These are called from Next.js API routes only — not exposed to the client directly.

#### `POST /ingest`
Trigger document ingestion.

```json
// Request body
{ "documentId": "uuid", "storagePath": "workspaces/uuid/spec.pdf", "workspaceId": "uuid" }
```

#### `POST /retrieve`
Retrieve relevant chunks for a query.

```json
// Request body
{ "query": "How does authentication work?", "workspaceId": "uuid", "topK": 5 }

// Response 200
{
  "chunks": [
    { "chunkId": "uuid", "content": "...", "similarity": 0.89, "metadata": { "filename": "spec.pdf", "page": 3 } }
  ]
}
```

#### `POST /agents/run`
Execute a LangGraph agent run (async — polls via Next.js `/api/agents/run/:id`).

---

## Error Responses

All errors follow this shape:

```json
{
  "error": "DOCUMENT_NOT_FOUND",
  "message": "No document found with id abc123",
  "statusCode": 404
}
```

| Code | Meaning |
|------|---------|
| 400 | Invalid request body |
| 401 | Not authenticated |
| 403 | Authenticated but not authorised (wrong user's resource) |
| 404 | Resource not found |
| 409 | Conflict (e.g., workspace slug already taken) |
| 422 | Validation error |
| 429 | Rate limit — LLM provider |
| 500 | Internal server error |
| 503 | FastAPI service unavailable |
