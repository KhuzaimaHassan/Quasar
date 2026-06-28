# Memory

## Overview

Quasar maintains two types of memory to make conversations feel persistent and personalised:

| Type | Storage | Scope | Lifespan |
|------|---------|-------|----------|
| Short-term | Redis | Per-conversation | 24 hours (TTL) |
| Long-term | PostgreSQL | Per-user | Permanent (until deleted) |

Short-term memory is the conversation's sliding window — it prevents the context from growing unboundedly as a conversation gets long. Long-term memory captures durable facts about the user: their preferred frameworks, ongoing projects, coding style.

---

## Short-Term Memory (Conversation Buffer)

### Problem

LLMs have a fixed context window. A long conversation will eventually exceed it. Naive solutions (truncate oldest messages, summarise everything) both lose important context.

### Solution: Sliding Window + Compression

Keep the last N tokens of the conversation in Redis. When messages age out of the window, run a compression step that summarises them and prepends the summary to the context.

```
Full conversation:
  [msg 1] [msg 2] [msg 3] ... [msg 40] [msg 41] [msg 42]

After window compression:
  [summary of msgs 1-35] [msg 36] [msg 37] ... [msg 42]
```

### Redis Keys

```
conv:{conversation_id}:buffer    → JSON array of message objects (last N)
conv:{conversation_id}:summary   → Compressed summary of older messages
```

Both keys have TTL of 24 hours (refreshed on each new message).

### Implementation

```python
MAX_BUFFER_TOKENS = 4000
SUMMARY_TRIGGER = 5000  # Compress when buffer exceeds this

async def get_conversation_context(conversation_id: str) -> list[Message]:
    buffer = await redis.get(f"conv:{conversation_id}:buffer")
    summary = await redis.get(f"conv:{conversation_id}:summary")

    messages = json.loads(buffer) if buffer else []
    total_tokens = sum(count_tokens(m["content"]) for m in messages)

    if total_tokens > SUMMARY_TRIGGER:
        # Compress oldest half
        to_compress = messages[:len(messages)//2]
        new_summary = await compress(to_compress, existing_summary=summary)
        messages = messages[len(messages)//2:]
        await redis.setex(f"conv:{conversation_id}:summary", 604800, new_summary)
        await redis.setex(f"conv:{conversation_id}:buffer", 86400, json.dumps(messages))

    # Prepend summary if it exists
    if summary:
        return [{"role": "system", "content": f"Summary of earlier conversation:\n{summary}"}] + messages

    return messages
```

### Compression Prompt

```
The following messages are from an earlier part of a conversation.
Summarise the key points, decisions made, code written, and any open questions.
Be concise — aim for under 300 tokens.

[messages]
```

---

## Long-Term Memory (User Facts)

### What Gets Stored

The memory extraction step runs after each conversation session (or on a schedule). It identifies durable facts worth remembering:

| Scope | Key examples |
|-------|-------------|
| `preference` | `preferred_language: TypeScript`, `preferred_test_framework: vitest` |
| `project` | `current_project: Quasar`, `project_stack: Next.js + FastAPI` |
| `style` | `code_style: functional, no classes`, `comment_style: minimal` |
| `fact` | `company: SIEHS`, `role: Data Engineer` |

### Extraction Prompt

```
Review this conversation and extract any durable facts about the user.
Output a JSON array. Each item: { scope, key, value, confidence }.
Confidence is 0.0–1.0. Only include facts with confidence > 0.6.
Only extract facts explicitly stated or strongly implied — do not infer.

[conversation summary or last N messages]
```

### Storage

```typescript
// Upsert — update value if key exists, insert if not
await prisma.memory.upsert({
  where: { userId_scope_key: { userId, scope, key } },
  update: { value, confidence, lastUpdated: new Date() },
  create: { userId, scope, key, value, confidence },
});
```

### Retrieval at Prompt Time

At the start of every request, fetch the top memories for the user and inject them into the system prompt:

```typescript
const memories = await prisma.memory.findMany({
  where: { userId, confidence: { gte: 0.7 } },
  orderBy: { lastUpdated: 'desc' },
  take: 10,
});

const memoryBlock = memories
  .map(m => `- ${m.key}: ${m.value}`)
  .join('\n');
```

Injected as:
```
Known about the user:
- preferred_language: TypeScript
- current_project: Quasar
- preferred_test_framework: vitest
```

---

## Memory UI

The memory panel (accessible from the workspace sidebar) shows:

```
┌─────────────────────────────────┐
│  Your memory                    │
│                                 │
│  Preferences                    │
│  ● preferred_language: TypeScript│
│  ● test_framework: vitest       │
│                                 │
│  Projects                       │
│  ● current_project: Quasar      │
│                                 │
│  [+ Add manually]  [Clear all]  │
└─────────────────────────────────┘
```

Users can:
- View all stored memories grouped by scope.
- Edit individual memory values inline.
- Delete any memory.
- Add memories manually (e.g., "Always use async/await, never .then()").

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
| Redis unavailable | Fall back to DB-only conversation history; degraded short-term memory but functional |
| Extraction produces malformed JSON | Catch parse error, skip extraction for that session, log |
| Memory conflicts (contradictory facts) | New value overwrites old; log the conflict for review |
| User deletes memory mid-conversation | Re-fetch memories before each request, not once at session start |
