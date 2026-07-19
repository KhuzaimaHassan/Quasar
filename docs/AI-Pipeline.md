# AI Pipeline

## Overview

The AI pipeline is the core of Quasar. It handles everything from accepting a user message to streaming a response back — including model selection, context assembly, RAG retrieval injection, and token tracking. This document covers the chat completion pipeline. Agent-specific orchestration is in [Agents.md](Agents.md).

---

## Models Supported

| Model | Provider | Use case |
|-------|----------|----------|
| `gemini-3.5-flash` | Google | Default (free tier, server-provided key, used unless user adds key) |
| `claude-sonnet-4-5` | Anthropic | Available once BYOK (Issue #13) ships |
| `gpt-4o` | OpenAI | Available once BYOK (Issue #13) ships |

Model is stored per-conversation and switchable mid-conversation by the user.

---

## Model Strategy

Quasar uses a default-free-plus-BYOK approach. By default, it uses Google's free tier for Gemini 3.5 Flash via a server-provided API key to manage development costs. Premium models like Claude and GPT-4o will be available once the Bring Your Own Key (BYOK) functionality is shipped (Issue #13). For full reasoning, see the new ADR in [Decisions.md](Decisions.md).

---

## SDK

Use **Vercel AI SDK** (`ai` package) for all LLM calls in Next.js:

```typescript
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

const modelMap = {
  'gemini-3.5-flash': google('gemini-3.5-flash'),
  'claude-sonnet-4-5': anthropic('claude-sonnet-4-5'),
  'gpt-4o': openai('gpt-4o'),
};
```

The SDK handles:
- Streaming via SSE (Server-Sent Events)
- Unified interface across providers
- `useChat` React hook on the client side
- Tool calling schema

---

## Context Assembly

For every chat request, the pipeline assembles the prompt in this order:

```
1. System prompt
2. Long-term memory facts (from memories table, top 5 by relevance)
3. Conversation history (from Redis buffer or DB, last N tokens)
4. RAG context (retrieved chunks, if workspace has documents)
5. User message
```

### Token Budget

| Slot | Max tokens |
|------|-----------|
| System prompt | 500 |
| Memory facts | 300 |
| Conversation history | 6,000 |
| RAG context | 3,000 |
| User message | 1,000 |
| Response (reserved) | 2,000 |
| **Total** | **~12,800** |

Adjust these as you learn actual usage patterns. The conversation history slot shrinks first when budget is tight.

---

## System Prompt

Keep the system prompt short and factual. Avoid roleplay framing.

```
You are Quasar, an AI developer workspace assistant.

Context about the user:
- Name: {user.display_name}
- Preferred language/framework: {memory.preferred_framework}
- Current workspace: {workspace.name}

You have access to the user's uploaded documents (context provided below).
When citing a document, mention the filename. Be concise and specific.
If you don't know something, say so rather than guessing.
```

Update this as you discover what produces the best outputs.

---

## Streaming Implementation

### API Route (`/api/chat`)

```typescript
import { streamText, StreamData, createUIMessageStreamResponse, toUIMessageStream } from 'ai';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs';
import { retrieveContext, buildSystemPrompt, resolveCitations } from '@/lib/rag';

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const { messages, conversationId, model } = await req.json();

  // 1. Load context (RAG chunks)
  const chunks = await retrieveContext(conversationId, messages[messages.length - 1].content);
  const citations = await resolveCitations(chunks);

  // 2. Stream Setup
  const data = new StreamData();
  if (citations.length > 0) {
    data.appendMessageAnnotation({ type: 'data-citations', citations });
  }

  const result = await streamText({
    model: modelMap[model],
    system: buildSystemPrompt(chunks),
    messages,
    onFinish: async ({ text, usage }) => {
      // 3. Persist after stream ends
      await saveMessage({ conversationId, role: 'assistant', content: text, tokens: usage.totalTokens, metadata: { citations } });
      data.close();
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
    data
  });
}
```

### Client (`useChat` hook)

```typescript
const { messages, input, handleSubmit, isLoading, stop } = useChat({
  api: '/api/chat',
  body: { conversationId, model },
  onFinish: (message) => {
    // Update conversation title if first message
  },
});
```

---

## Token Tracking

After every completion:
1. Add `usage.totalTokens` (which is `usage.inputTokens + usage.outputTokens`) to `messages.token_count` for the assistant message.
2. Increment `conversations.total_tokens` with `usage.totalTokens`.
3. Display raw token counts in the UI (conversation headers and message hover states).

> [!NOTE]
> **Cost Estimation Deferred**: Cost estimation mapping is deferred to the Milestone 6 cost dashboard. Since the current default model (Gemini free tier) has no meaningful per-token cost to display right now, we do not attempt to show dollar amounts in the chat interface.

Store raw token counts in the DB, compute cost at display time so pricing changes don't require a migration.

---

## Tool Calling

From M5 onward, the chat pipeline can invoke MCP tools. The Vercel AI SDK handles tool calling with streaming:

```typescript
const result = await streamText({
  model: modelMap[model],
  tools: {
    createGithubIssue: {
      description: 'Create a GitHub issue in the user\'s repository',
      parameters: z.object({
        repo: z.string(),
        title: z.string(),
        body: z.string(),
      }),
      execute: async ({ repo, title, body }) => mcpClient.github.createIssue(repo, title, body),
    },
  },
  // ...
});
```

---

## Prompt Engineering Notes

> Fill this section as you learn from real usage.

- **Be specific in the system prompt about output format** — if you want code in fenced blocks, say so.
- **Don't instruct the model to "always" do things** — it tends to ignore persistent instructions. Rely on the context structure instead.
- **RAG quality > prompt quality** — if retrieved chunks are irrelevant, no prompt will save the answer. Invest in retrieval before prompt tuning.
- **Temperature**: Use `temperature: 0.3` for coding tasks, `0.7` for conversational responses. Make this configurable per conversation.

---

## Error Handling

| Error | Handling |
|-------|----------|
| Rate limit (429) | Exponential backoff with jitter; surface "trying again" to user |
| Context too long | Trim conversation history (oldest first), retry |
| Model unavailable | Fall back to secondary model; log the incident |
| Stream interrupted | Client retries with `Last-Event-ID`; server replays from last chunk |

---

## Observability

All LLM calls are traced via LangSmith (from M6). Every trace captures:
- Model used
- Full prompt (system + messages)
- Token counts
- Latency (time to first token, total time)
- Whether RAG context was injected and how many chunks

See [Deployment.md](Deployment.md) for LangSmith setup.
