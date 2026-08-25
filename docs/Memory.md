# Memory

## Overview

Quasar maintains two types of memory to make conversations feel persistent and personalised:

| Type | Storage | Scope | Lifespan |
|------|---------|-------|----------|
| Short-term | In-Memory (DB backed) | Per-conversation | 30-message window (ADR-011) |
| Long-term | PostgreSQL | Per-user | Permanent (until deleted) |

Short-term memory is the conversation's sliding window — it prevents the context from growing unboundedly as a conversation gets long. Long-term memory captures durable facts about the user: their preferred frameworks, ongoing projects, coding style.

---

## Short-Term Memory (Conversation Buffer)

### Problem

LLMs have a fixed context window. While modern models (like Gemini 1.5) have massive context windows (1M+ tokens), sending the entire history of a very long conversation on every turn wastes tokens and increases latency.

### Solution: Message-Count Cap

Instead of complex Redis-based compression (as originally considered in ADR-006), we implemented a simple, robust message-count cap. The application retains only the last 30 messages in the context window.

```typescript
// src/app/api/chat/route.ts
const historyCap = modelMessages.slice(-30);
```

### Rationale

Given Gemini 1.5's large context window, 30 messages comfortably fit without approaching limits. This approach avoids the infrastructure overhead of Redis and the LLM cost/latency of running background compression prompts. It is simple, stateless, and effective for this project's scale.

---

## Long-Term Memory (User Facts)

### What Gets Stored

The memory extraction step identifies durable facts worth remembering:

| Scope | Key examples |
|-------|-------------|
| `preference` | `language: TypeScript`, `test_framework: vitest` |
| `project` | `current: Quasar`, `stack: Next.js + FastAPI` |
| `style` | `code: functional`, `comments: minimal` |
| `fact` | `company: SIEHS`, `role: Data Engineer` |

### Extraction Mechanism

We run a background extraction step every 5th user message in a conversation. It uses Vercel's `generateObject` with a strict Zod schema.

```typescript
const { object } = await generateObject({
  model: google('gemini-1.5-flash'), // Always uses server default key, never BYOK
  schema: z.object({
    memories: z.array(z.object({
      scope: z.enum(['preference', 'project', 'style', 'fact']),
      key: z.string(),
      value: z.string(),
      confidence: z.number().min(0).max(1)
    }))
  }),
  // ...
});
```
*Note: Extraction always uses the server's default Gemini key, even if the user is employing a BYOK model for the chat itself. This protects user credits from background processing costs.*

### Storage

```typescript
// Upsert — update value if key exists, insert if not
await db.memory.upsert({
  where: { userId_scope_key: { userId: user.id, scope: mem.scope, key: mem.key } },
  update: { value: mem.value, confidence: mem.confidence },
  create: { userId: user.id, scope: mem.scope, key: mem.key, value: mem.value, confidence: mem.confidence },
});
```

### Retrieval at Prompt Time

At the start of every request, fetch the top memories (confidence >= 0.7) for the user and inject them into the system prompt:

```typescript
const memories = await db.memory.findMany({
  where: { userId: user.id, confidence: { gte: 0.7 } },
  orderBy: { lastUpdated: "desc" },
  take: 10,
});
```

Injected as:
```
Known about the user:
- preference | language: TypeScript
- project | current: Quasar
```

---

## Memory UI

The `/memory` page provides a complete dashboard to manage long-term memories.

Users can:
- View all stored memories grouped by scope (Preferences, Projects, Style, Facts).
- Edit individual memory values inline by clicking them.
- Delete any memory via a trash icon.
- Add memories manually via an inline form (e.g., "Always use async/await").
- Clear all memories entirely.

The UI is built using React Query hooks (`useMemories`, `useUpdateMemory`, etc.) for instant optimistic UI updates without page reloads.

---

## Privacy Considerations

- Users can delete all memories at any time — provide a "clear memory" button.
- Do not store sensitive data in memory (passwords, API keys, personal identifiers).
- The extraction prompt should be instructed to skip anything that looks like credentials.
- Store only the minimum needed for personalisation.
- Log when memories are created/updated/deleted for auditability.

---

## Failure Modes

| Failure | Handling |
|---------|----------|
| Context window exceeded | Automatically trimmed to last 30 messages in memory (ADR-011) |
| Extraction produces malformed JSON | Catch parse error, skip extraction for that session, log |
| Memory conflicts (contradictory facts) | New value overwrites old; log the conflict for review |
| User deletes memory mid-conversation | Re-fetch memories before each request, not once at session start |
