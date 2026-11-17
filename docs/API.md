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
  { "id": "uuid", "title": "How does RAG work?", "model": "gemini-4-hydrogen", "updatedAt": "..." },
  ...
]
```

#### `POST /api/conversations`
Create a new conversation.

```json
// Request body
{ "workspaceId": "uuid", "model": "gemini-4-hydrogen" }

// Response 201
{ "id": "uuid", "title": "New conversation", "model": "gemini-4-hydrogen", ... }
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
  { "id": "uuid", "role": "assistant", "content": "...", "tokenCount": 312, "metadata": { "modelId": "gemini-4-hydrogen", "citations": [], "completion": { "status": "complete", "finishReason": "stop" }, "tokenUsageAvailable": true }, "createdAt": "..." }
]
```

#### `POST /api/messages/:id/feedback`
Set or update thumbs up/down feedback for a specific assistant message.

```json
// Request body
{ "rating": 1 } // 1 for thumbs up, -1 for thumbs down

// Response 200
{ "id": "uuid", "messageId": "uuid", "rating": 1, "comment": null, "createdAt": "...", "updatedAt": "..." }
```

#### `DELETE /api/messages/:id/feedback`
Clear feedback from a specific assistant message.

```json
// Response 204
// No content
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
  "conversationId": "uuid"
}
```

Response: `text/event-stream` (Vercel AI SDK data stream format).

The route obtains model and workspace from the authenticated account's owned conversation. It saves the user turn before generation. A nonempty assistant response is persisted with citations, reported token usage and completion metadata; partial errors/aborts preserve received text. `completion.status` is `complete` only for a confirmed `stop`; other categories produce a safe incomplete notice. Historical replies without this field remain unknown. Missing interrupted usage has `tokenUsageAvailable=false` and a zero storage placeholder rather than an invented token estimate.

Continue response uses the same endpoint as an explicit new user turn after the client reloads saved history. It preserves the earlier answer and consumes ordinary chat quota. It is not an automatic retry or a privileged continuation endpoint. The existing `retryMessageId` path reuses only the latest owned matching orphaned user turn. See [completion and recovery behavior](AI-Pipeline.md#continue-and-retry).

---

#### `POST /api/conversations/:id/stop`

Save a stopped response before closing the client stream. Requires authentication and ownership of the conversation and matching server-generated generation ID (available in the chat stream's `X-Generation-Id` header or the saved pending user-message metadata).

```json
{ "generationId": "uuid", "text": "Already visible partial answer" }
```

The strict payload accepts only the UUID and text (maximum 100,000 characters). Model identity/citations and terminal state are server controlled. `200 {"status":"saved"}` means this request finalized the generation; `200 {"status":"settled"}` preserves a prior terminal result without rewriting it. Empty text creates a retryable stopped user turn, not an empty assistant answer. Missing/foreign generations return the same 404, invalid input 400, account stop quota 429 and persistence failure a safe 500/503. Responses are private/no-store. Stop and model completion share a row-lock transaction, so only one assistant result/token increment is admitted. Stop does not guarantee immediate provider-side computation cancellation; see [stop persistence](AI-Pipeline.md#stop-persistence).

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
  "storagePath": "documents/uuid/uuid-spec.pdf"
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
{ "id": "uuid", "workspaceId": "uuid", "filename": "spec.pdf", "mimeType": "application/pdf", "sizeBytes": 204800, "status": "ready", "errorMessage": null, "createdAt": "...", "updatedAt": "..." }
```

#### `DELETE /api/documents/:id`
Delete document, its chunks, and its storage file.

#### `GET /api/documents/:id/download`
Resolve a saved source citation. Requires authentication and ownership of the document's workspace. Responds with a redirect to a fresh 60-second signed file URL. Responses are private/no-store. Unknown or foreign documents return 404; unavailable signing returns a safe 503. Citation links store document identity rather than depending on an expired upload-time URL. Added in [PR #125](https://github.com/KhuzaimaHassan/Quasar/pull/125).

#### `GET /api/conversations/:id/attachments/:attachmentId`
Resolve a saved chat attachment. Requires authentication and conversation ownership. Validates persisted metadata and the canonical storage path under that conversation before redirecting to a fresh 60-second URL. Inline image/PDF behavior is preserved; redirects/errors are private/no-store. Missing/foreign/invalid attachments return 404 and signing failure returns a safe 503. Client attachment IDs may differ from the server-generated storage UUID; both are supported. Added in [PR #126](https://github.com/KhuzaimaHassan/Quasar/pull/126).

---

### Memory

#### `GET /api/memory`
Get all memories for the authenticated user.

```json
// Response 200
[
  { "id": "uuid", "scope": "preference", "key": "preferred_language", "value": "TypeScript", "confidence": 1, "isUserManaged": true },
  ...
]
```

#### `POST /api/memory`
Manually add or replace the authenticated user's memory for the supplied scope/key. Saves confidence 1 and `isUserManaged=true`; automatic extraction cannot replace it. The server sets these fields; they are not accepted in the request.

```json
// Request body
{ "scope": "preference", "key": "preferred_test_framework", "value": "vitest" }
```

#### `PATCH /api/memory/:id`
Update an owned memory's value with `{ "value": "new value" }`. Saves confidence 1 and protects the correction from automatic extraction. Confidence, ownership and protection flags cannot be supplied by the client.

#### `DELETE /api/memory/:id`
Delete a single memory.

#### `DELETE /api/memory`
Delete all memories for the user.

---

### Agent Runs

#### `GET /api/agents/run`
List all agent runs for a conversation, ordered by `startedAt` desc.

```json
// Request query
// ?conversationId=uuid

// Response 200
[
  { "id": "uuid", "status": "completed", "task": "Build a Todo App", "startedAt": "..." },
  ...
]
```

#### `POST /api/agents/run`
Start a new agent run for a task.

```json
// Request body
{ "task": "Build a Todo App in Next.js", "conversationId": "uuid", "workspaceId": "uuid" }

// Response 202
{ "threadId": "uuid" }
```

#### `GET /api/agents/run/:id`
Poll run status and retrieve `pendingApproval` state when the graph is interrupted.

```json
// Response 200
{
  "id": "uuid",
  "status": "awaiting_approval",
  "pendingApproval": [
    { "path": "src/components/TodoList.tsx", "content": "...", "action": "create" }
  ],
  "startedAt": "...",
  "updatedAt": "..."
}
```

#### `POST /api/agents/run/:id/resume`
Resume a paused agent run with explicit human approval.

```json
// Request body
{ "approved": true }

// Response 200
{ "status": "completed" }
```

#### `POST /api/agents/run/:id/cancel`
Cancel an agent run explicitly when it is paused at the approval gate (equivalent to resuming with `approved: false`).

```json
// Response 200
{ "status": "cancelled" }
```

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
