# Lessons Learned

This is a running log. Add entries as you build — what surprised you, what broke, what you'd do differently. This document becomes useful when you're interviewing or writing about the project.

---

## How to Use This File

After finishing each milestone (or whenever something significant happens), add a dated entry. Be honest — the failures are more instructive than the wins.

```
## YYYY-MM-DD — [Topic]

**What happened**: Describe the situation.
**What I tried**: What approaches you took.
**What worked**: The solution.
**What I'd do differently**: If you had to start over.
```

---

## Placeholder Entries (fill these in as you go)

---

### M1 — Foundation

**Issue #72: Project Initialization**

- **Structural Foundation for Scalability**:
  - *What happened*: Needed a clean base for a fast-scaling AI application.
  - *Why it happened*: Messy imports and inconsistent routing paradigms (App Router vs Pages Router) often plague Next.js projects as they grow.
  - *How we solved it*: Initialized Next.js 14 specifically using the App Router for optimal streaming support. Enforced strict TypeScript/ESLint rules and set up path aliases (`@/*` to `src/*`) to guarantee clean, refactorable imports from day one.

**Issue #76: Frontend Shell Layout**

- **Managing Server vs. Client Component Boundaries**:
  - *What happened*: Building a responsive sidebar, mobile navigation, and workspace switcher required interactivity.
  - *Why it happened*: Next.js App Router defaults to Server Components, but UI elements requiring state (like toggling a sidebar or a dropdown) must run on the client, leading to potential hydration mismatches if not isolated properly.
  - *How we solved it*: We strategically placed the `"use client"` directive on specific interactive components (like the sidebar toggler and dropdowns) while keeping the root layout server-rendered. We also combined this with robust CSS to handle mobile and desktop responsive states seamlessly.

**Issue #73: Frontend Shell & Authentication**

- **Inconsistent Sign-Out Routing**: We found that signing out from different components (Avatar vs Sidebar) led to different routes (`/` vs `/sign-in`). 
  - *Why it happened*: Clerk's components and our custom sign-out buttons had different fallback redirect configurations.
  - *How we solved it*: We aligned the fallback redirect URLs to explicitly point to our designated routes (`/chat` for authenticated fallbacks, and `/sign-in` for sign-out fallbacks) across all Clerk components and middleware.

**Issue #74: Database & Webhooks**

- **Prisma Version and directUrl Deprecation**:
  - *What happened*: Initial setup with Prisma `v6+` threw errors because `directUrl` is no longer supported directly inside `schema.prisma`.
  - *Why it happened*: Prisma recently overhauled their configuration, requiring a `prisma.config.ts` file instead.
  - *How we solved it*: We intentionally downgraded Prisma and `@prisma/client` to `v5.22.0`. This allowed us to keep the standard `directUrl` string within `schema.prisma`, which is simpler and maintains compatibility with the requested architecture.

- **Supabase Pooler Password Encoding**:
  - *What happened*: Running `npx prisma migrate dev` failed with `P1000: Authentication failed`.
  - *Why it happened*: The Supabase auto-generated password contained special characters (e.g., `/`, `:`) and the user had accidentally included the placeholder brackets `[` and `]` in the `.env` strings. 
  - *How we solved it*: We stripped the placeholder brackets and strictly URL-encoded the special characters in the password (e.g., `/` to `%2F`, `:` to `%3A`) for both `DATABASE_URL` and `DIRECT_URL`.

- **Testing Webhooks Locally**:
  - *What happened*: The newly created Clerk webhook wasn't writing to the local Prisma database.
  - *Why it happened*: Clerk's production servers cannot send HTTP POST requests directly to `localhost:3000`, and our local `.env` still had a placeholder `whsec_` secret, causing Svix to reject any payloads.
  - *How we solved it*: We used `ngrok` to expose the local server to the public internet, updated the Clerk webhook dashboard with the ngrok URL, and synced the new signing secret into `.env.local`.

**Issue #75: Workspace CRUD & Global State**

- **Svix Webhook Signature Mismatches**:
  - *What happened*: Webhook signature verification randomly failed with `No matching signature found`.
  - *Why it happened*: We were parsing the request via `req.json()` and immediately calling `JSON.stringify()`. This stripped out natural whitespace/formatting from the original payload, fundamentally altering the string that Svix was trying to cryptographically verify.
  - *How we solved it*: We swapped to `await req.text()`, pulling the raw, unadulterated string directly from the Next.js request object before passing it into `wh.verify()`.

- **Disjointed UI State (Switcher vs Header)**:
  - *What happened*: The Sidebar workspace switcher updated its local state, but the top Header breadcrumb remained stale.
  - *Why it happened*: The components didn't share state, and standard React Query caching only synchronizes server data, not active UI selections.
  - *How we solved it*: We lifted the state up into a lightweight React Context (`WorkspaceProvider`) wrapped around the root layout, allowing both the Switcher and the Header to read/write the `activeWorkspace` instantaneously.

- **Prisma JSON Typing vs Zod**:
  - *What happened*: TypeScript threw an error when passing Zod's `z.record(z.string(), z.unknown())` into Prisma's JSON column.
  - *Why it happened*: Prisma enforces a strict `InputJsonValue` type which guarantees JSON serializability, while Zod's `unknown` is too broad for the compiler to automatically trust.
  - *How we solved it*: Since we trust Zod's runtime validation of the record, we satisfied the compiler by safely casting the `parsed.data` payload before injection.

**Issue: Bug-Fix Audit & Code Hardening**

- **Next.js 16 Route Protection Constraints**:
  - *What happened*: Unauthenticated users could face silent redirect loops or 401 errors.
  - *Why it happened*: Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts`. Also, Clerk's proxy runtime requires explicit `NEXT_PUBLIC_CLERK_SIGN_IN_URL` environment variables to prevent inference failures. Furthermore, wrapping unauthenticated routes in a provider that fetches authenticated data causes 401s.
  - *How we solved it*: We moved `WorkspaceProvider` strictly into the `(dashboard)` layout, explicitly defined fallback URLs in `.env`, and adopted the `proxy.ts` convention to ensure deterministic route protection.

- **Prisma Foreign Key Performance**:
  - *What happened*: The `GET /api/workspaces` route performed a full table scan for every request.
  - *Why it happened*: Searching a large database via `where: { userId }` without a database index creates massive O(n) performance bottlenecks at scale.
  - *How we solved it*: We added `@@index([userId])` to the `Workspace` model in Prisma, ensuring lightning-fast O(log n) index scans for all workspace lookups.

- **Prisma Type-Safety with JSON**:
  - *What happened*: Strict TypeScript checking failed on the `PATCH` route for updating workspaces.
  - *Why it happened*: Spreading `parsed.data` containing `settings: Record<string, unknown>` clashed with Prisma's extremely rigid internal `Prisma.InputJsonValue` definitions.
  - *How we solved it*: We forcefully cast the update payload using `parsed.data as Prisma.WorkspaceUpdateInput`, allowing Prisma's own generated typings to natively handle the JSON mapping without TS spreading conflicts.

- **Clean Webhook Cascades**:
  - *What happened*: Deleting a user in Clerk left orphaned database records.
  - *Why it happened*: The `user.deleted` webhook was not enabled or handled.
  - *How we solved it*: We mapped the `user.deleted` payload to `db.user.delete()`. Because we had configured `onDelete: Cascade` in the Prisma schema, deleting the User natively triggered the database to automatically wipe all associated Workspaces in one transaction, completely eliminating the need for manual cleanup code.

---

### M2 — Chat

**Issue #78: Conversation Data Layer & API Routes**

- **Database Cascades and Data Retention**:
  - *What happened*: Deciding how to handle conversations when users delete workspaces.
  - *Why it happened*: If a user deletes a workspace, they might not want to lose all their chat history from that workspace, but if they delete their entire account, data must be fully purged.
  - *How we solved it*: We implemented split cascading logic. We used `onDelete: SetNull` for the `workspaceId` relation (safely orphaning the conversation to preserve chat history if a workspace is deleted) but used `onDelete: Cascade` for the `userId` relation (ensuring strict GDPR-style data deletion if the user is deleted).

- **Optimizing Chat History Sorting**:
  - *What happened*: Fetching messages for a conversation requires chronological ordering.
  - *Why it happened*: Querying `ORDER BY createdAt ASC` on large chat histories requires an expensive in-memory sort operation by the database ($O(N \log N)$).
  - *How we solved it*: We added a composite index `@@index([conversationId, createdAt])` to the `Message` model. This allows PostgreSQL to read the records directly off the B-Tree index in perfectly pre-sorted order, turning it into a lightning-fast $O(1)$ read.

- **Next.js 15 Dynamic Route Params**:
  - *What happened*: We hit an error: `params is a Promise and must be unwrapped with await`.
  - *Why it happened*: Next.js 15+ changed dynamic route parameters in Page components and Route Handlers to be asynchronous Promises rather than synchronous objects.
  - *How we solved it*: We correctly typed all dynamic params as `Promise<{ id: string }>` and explicitly `await`ed them inside `async` components and API routes. We also learned to use `_req: Request` to satisfy TypeScript when the Request object is unused but the second `params` argument is required.

**Issue #79: Chat UI & Optimistic State**

- **Smart Auto-Scrolling UX**:
  - *What happened*: Forcing the chat to scroll to the bottom on every new message creates a frustrating experience if the user is scrolling up to read chat history.
  - *Why it happened*: Standard `useEffect` implementations blindly scroll to `scrollHeight` whenever the messages array changes.
  - *How we solved it*: We added an `onScroll` listener to track the distance from the bottom (`scrollHeight - scrollTop - clientHeight`). If that distance exceeds 100px, we flag the user as "scrolled up" and pause the auto-scroll behavior until they manually return to the bottom.

- **Native Auto-Resizing Textareas**:
  - *What happened*: We needed an input box that grows with the text but caps at a maximum height before scrolling.
  - *Why it happened*: Textareas natively have static rows. Usually, developers reach for external libraries like `react-textarea-autosize`.
  - *How we solved it*: We implemented a zero-dependency solution using a `useEffect` that listens to the content. It resets `style.height = 'auto'` (to shrink if text is deleted) and immediately sets it to `textarea.scrollHeight + 'px'`. By adding Tailwind's `max-h-40`, the CSS engine seamlessly takes over to provide internal scrolling once the height limit is reached.

- **Platform-Agnostic Modifiers**:
  - *What happened*: We wanted to support sending messages via keyboard shortcuts.
  - *Why it happened*: Mac users expect `Cmd+Enter`, while Windows/Linux users expect `Ctrl+Enter`.
  - *How we solved it*: We checked `e.metaKey || e.ctrlKey` during the `onKeyDown` event, providing a universally accessible shortcut without hardcoding platform-specific navigator checks.

**Issue #80: Vercel AI SDK & Infinite Loops**

- **useChat Hook Object References**:
  - *What happened*: The application spun infinitely, and API endpoints were hammered with hundreds of requests.
  - *Why it happened*: We passed inline object literals (`new DefaultChatTransport({...})` and `toInitialMessages(...)`) directly into the `useChat` hook. Because these objects were created fresh on every render, the hook detected "changed" options and triggered a state update, causing an aggressive infinite re-render loop.
  - *How we solved it*: We aggressively memoized the transport configuration and initial messages array using React's `useMemo` hook, stabilizing the references and breaking the render loop.

- **Graceful Failures in React Query**:
  - *What happened*: Visiting an old or deleted conversation URL caused the app to hang on a loading spinner indefinitely.
  - *Why it happened*: Our `/api/conversations/[id]/messages` endpoint correctly returned a 404 when the ID wasn't found in the DB. However, React Query's default behavior is to retry failed requests. Combined with the render loop, this paralyzed the application.
  - *How we solved it*: We added `retry: false` to the `useMessages` query configuration, ensuring that 404s fail instantly and predictably.

- **Navigating Free Tier API Limits**:
  - *What happened*: We continually hit 429 Rate Limit Errors while trying to build out the chat streaming functionality with Claude 3.5 Sonnet.
  - *Why it happened*: Premium models have strict usage quotas that are quickly exhausted during high-velocity local development.
  - *How we solved it*: We pivoted to a "Free Tier Default / BYOK Premium" strategy. We set `gemini-3.5-flash` as the default model using a server-side API key for unlimited dev testing, and formally deferred premium models to a future "Bring Your Own Key" (BYOK) milestone (Issue #13).

**Issue #81: Markdown Parsing & Streaming UI**

- **Graceful Streaming Markdown**:
  - *What happened*: Standard Markdown parsers (like `react-markdown`) glitch and throw errors when fed incomplete markdown tokens during a live stream.
  - *Why it happened*: Parsers expect complete, closed tags (like a closing ``` for a code block). While streaming, these tags arrive character by character.
  - *How we solved it*: We swapped to `streamdown`, Vercel's purpose-built streaming markdown renderer. It natively understands incomplete markdown states and provides smooth progressive rendering with built-in syntax highlighting and copy buttons.

- **Standard Markdown White-Space Quirks**:
  - *What happened*: Users pasting unformatted python code into the chat input saw their code chopped up — parts of it collapsed into single sentences, and other parts snapped into code blocks.
  - *Why it happened*: Standard Markdown ignores single newlines in paragraphs, but automatically parses any line starting with 4+ spaces as an indented code block.
  - *How we solved it*: We applied a `whitespace-pre-wrap` CSS class to the user message container. This preserves the original newlines of un-indented lines, preventing them from collapsing into an unreadable wall of text when a user forgets to use triple backticks.

**Issue #82: File and Image Uploads in Chat**

- **AI SDK Multi-Modal "Empty Text" Erasure**:
  - *What happened*: Sending an image without any accompanying text caused the backend to crash with `Error: Invalid prompt: messages must not be empty`.
  - *Why it happened*: Our backend utility function `convertToModelMessages` was aggressively filtering out any user message where the string `content` was empty, failing to realize the Vercel AI SDK actually stores uploaded image data inside separate `experimental_attachments` or `parts` arrays while leaving the text `content` blank.
  - *How we solved it*: We rewrote the utility to safely preserve messages if they contain either text or attachments, effectively preventing the AI SDK from erasing multimodal messages.

- **AI SDK CoreMessage Schema Strictness**:
  - *What happened*: Trying to migrate from the deprecated `{ type: 'image' }` format to the newer `{ type: 'file' }` format caused the Gemini provider to crash with `ModelMessage[] schema` validation errors.
  - *Why it happened*: Although the AI SDK logs deprecation warnings urging developers to use the new `file` format, the specific `@ai-sdk/google` provider version we had installed did not fully support passing a `URL` object inside a `file` block.
  - *How we solved it*: We purposefully reverted back to the "deprecated" `image` type format because it perfectly passes schema validation and works cleanly with Gemini, opting to tolerate the terminal warning over a broken application.

**Issue #83: Displaying Token Usage & React Query States**

- **Double-Rendering of Messages During Streams**:
  - *What happened*: Eagerly invalidating the `messages` query right after a stream finished caused the UI to briefly show duplicates of the user prompt and AI response.
  - *Why it happened*: Vercel's `useChat` hook assigns temporary client-side UUIDs to messages during streaming. When the stream finishes and the backend saves them to the DB, they get permanent database UUIDs. Because we were fetching the DB messages but *not* clearing the temporary client messages from `useChat`, the UI rendered both sets side-by-side because their IDs didn't match.
  - *How we solved it*: We aggressively synced the client-side state. By pulling the `setMessages` function out of `useChat` and running a `useEffect` that calls `setMessages(toInitialMessages(persistedMessages))` whenever the stream stops, we forcefully overwrite the temporary client IDs with the permanent database IDs behind the scenes, instantly collapsing the duplicates.

---

### M3 — RAG

**Issue #110: FastAPI Service Foundation & Prisma pgvector**

- **Prisma pgvector Extension Setup**:
  - *What happened*: Running `prisma migrate dev` with `postgresqlExtensions` failed on Supabase.
  - *Why it happened*: Prisma creates a temporary shadow database to calculate schema diffs. The `CREATE EXTENSION vector` command failed on the shadow DB because the Supabase `postgres` user doesn't have superuser rights over dynamically created shadow databases.
  - *How we solved it*: We manually created the shadow database in the Supabase dashboard (`quasar_shadow`) and provided its connection string directly to Prisma using `shadowDatabaseUrl` in our `.env` file. This bypassed Prisma's dynamic shadow database creation and allowed the migration to succeed.
  
- **Anaconda and Local Python Environments**:
  - *What happened*: We struggled to test the FastAPI app within the internal Windows sandbox due to a corrupted Anaconda environment throwing `init_fs_encoding` errors.
  - *Why it happened*: The terminal had a broken base Anaconda setup that crashed Python on startup.
  - *How we solved it*: We located the host machine's native Python installation at `AppData\Local\Programs\Python\Python313\python.exe` and used that absolute path to bypass the corrupted environment, successfully creating a `venv` and launching the server.

**Issue #85: Document Upload & Ingestion Pipeline**

- **Prisma Client Windows File Locks**:
  - *What happened*: Running `npx prisma generate` failed with `EPERM: operation not permitted` renaming the `query_engine-windows.dll.node` file.
  - *Why it happened*: We added new Prisma models (`Document`, `Chunk`) but ran the generator while the Next.js dev server was active. Windows places strict file locks on compiled `.node` binaries while the server process uses them.
  - *How we solved it*: We learned the hard way that stopping the Next.js dev server entirely is required before generating Prisma clients on Windows machines to avoid frustrating file permission errors.

- **Supabase PgBouncer and asyncpg Caching**:
  - *What happened*: The FastAPI ingestion endpoint threw `InvalidSQLStatementNameError: prepared statement "__asyncpg_stmt_1__" does not exist`.
  - *Why it happened*: Supabase's connection pooler (PgBouncer) runs in "transaction mode". `asyncpg` natively tries to optimize queries using prepared statements, but transaction poolers shuffle underlying server connections, causing prepared statements to be lost mid-session.
  - *What happened*: Supabase's connection pooler (PgBouncer) runs in "transaction mode". `asyncpg` natively tries to optimize queries using prepared statements, but transaction poolers shuffle underlying server connections, causing prepared statements to be lost mid-session.
  - *How we solved it*: We passed `statement_cache_size=0` explicitly into `asyncpg.create_pool()`, disabling prepared statements and allowing it to work seamlessly behind PgBouncer.

- **Postgres Datetime Timezone Strictness via asyncpg**:
  - *What happened*: Inserting `datetime.now(timezone.utc)` into the `createdAt` column crashed `asyncpg` with a `TypeError: can't subtract offset-naive and offset-aware datetimes`.
  - *What happened*: Prisma generated the column as `timestamp(3)` (which means `timestamp without time zone` in Postgres defaults), but our Python code explicitly passed a timezone-aware object, causing `asyncpg`'s strict type encoder to fail when mapping types.
  - *How we solved it*: We stripped the Python `datetime` injection entirely and instead used Postgres's native `now()` function inside the raw SQL `INSERT` string. This delegated the responsibility of generating the correct timestamp to Postgres directly, matching Prisma's behavior perfectly and completely bypassing Python's timezone offset headaches.

**Issue #88: Semantic Retrieval & pgvector Thresholds**

- **Similarity Threshold Tuning with Gemini Embeddings**:
  - *What happened*: Retrieving chunks with `gemini-embedding-001` yielded similarity scores (e.g., `0.719`) that were dangerously close to our theoretical `0.7` cutoff, even for highly relevant chunks.
  - *What happened*: Different embedding models cluster vectors differently in high-dimensional space. Gemini tends to group even disparate texts somewhat closely compared to other models, meaning a generic `0.7` cosine distance threshold is actually very strict for this specific model.
  - *How we solved it*: We logged the exact similarity scores during retrieval (`1 - (embedding <=> query)`) to empirically validate our cutoffs. We kept `0.7` for now, but documented that it might need lowering to `0.6` or `0.65` if users experience missing context, proving that embedding thresholds cannot be blindly inherited from other projects.
  
- **PowerShell vs curl JSON Escaping**:
  - *What happened*: Testing the FastAPI `/retrieve` endpoint manually via the PowerShell terminal failed with JSON decode errors and malformed URL errors.
  - *What happened*: Windows PowerShell's native `curl` is an alias for `Invoke-WebRequest`, which breaks standard `curl` syntax. Even when using `curl.exe`, PowerShell aggressively mangles double-quotes inside single-quoted strings (e.g., `-d '{"key": "value"}'`), stripping the quotes before the JSON reaches the API.
  - *How we solved it*: Instead of fighting shell escaping rules, we wrote a tiny, throwaway Python script (`urllib.request`) to programmatically hit the endpoint, ensuring the JSON body and custom `X-Internal-Secret` headers were transmitted perfectly.

**Issue #89: Chat Integration & Streaming Citations**

- **AI SDK Versioning & API Churn**:
  - *What happened*: The build failed because `StreamData` was not found in the `ai` module, despite being heavily referenced in older SDK documentation for streaming custom annotations.
  - *Why it happened*: Vercel AI SDK v3/v4 frequently deprecates and removes exports. Specifically, `StreamData` and `data` properties in `createUIMessageStreamResponse` were phased out or shifted in favor of built-in annotations.
  - *How we solved it*: Rather than fighting the SDK version mismatches to stream custom `data-citations`, we leaned on our resilient database architecture. We appended the citations strictly to the backend database via the `onFinish` callback, allowing the frontend to load the citations natively on refresh without complex stream-merging logic.

- **Prisma InputJsonValue Strictness**:
  - *What happened*: TypeScript compilation failed when trying to inject our `{ citations: Citation[] }` object into Prisma's `metadata` column.
  - *Why it happened*: Prisma's `InputJsonValue` explicitly checks for standard JSON shapes, and custom TypeScript interfaces (like `Citation[]`) lack the implicit string index signatures that Prisma's types demand.
  - *How we solved it*: We forcefully cast the object as `any` (or `Prisma.InputJsonValue`) during insertion. Since we already strictly validate the shape before sending it to the DB, overriding the compiler here avoids massive type gymnastic overhead while maintaining runtime safety.

**Issue #90: Document Deletion & Race Conditions**

- **Supabase Storage Cleanup & Race Conditions**:
  - *What happened*: Deleting a document required both removing the DB record and deleting the physical file from the Supabase `uploads` bucket, but doing so while ingestion was running could corrupt the state.
  - *Why it happened*: If a document is currently `processing`, the FastAPI backend might be actively reading from the DB or pushing chunks. Deleting the DB row out from under it causes catastrophic failures.
  - *How we solved it*: We implemented a strict API-level guard that returns a `409 Conflict` if the document status is `processing`. We also leveraged Prisma's `onDelete: Cascade` so that wiping the parent Document natively flushes all associated Chunks without requiring manual chunk cleanup logic.

- **Handling Pending Mutations in UI**:
  - *What happened*: Users could double-click the delete button while the request was in flight, triggering duplicate API calls and UI glitches.
  - *Why it happened*: Destructive actions without UI locks are inherently unsafe.
  - *How we solved it*: We tied the delete button's `disabled` state directly to the `isPending` flag from the React Query mutation, instantly freezing the button and rendering a spinner the millisecond the action starts.

**Issue #91: Re-ranking (Reciprocal Rank Fusion)**

- **Isolating the Re-ranking Algorithm**:
  - *What happened*: We needed to verify that the RRF algorithm correctly bumped chunks with exact keyword matches, but standing up the entire FastAPI/Database ingestion pipeline just to test math felt extremely heavy.
  - *Why it happened*: True end-to-end RAG pipelines are complex state machines. Re-ranking sits precisely in the middle and expects a perfectly formatted candidate pool from the DB.
  - *How we solved it*: We wrote a completely isolated `test_rerank.py` script that fed hardcoded dummy chunks directly into the `rerank_chunks` function. This let us prove mathematically that the RRF formula `1/(60 + vector_rank) + 1/(60 + bm25_rank)` correctly pulled a poorly-vector-ranked chunk to the top strictly based on its exact BM25 keyword match, giving us 100% confidence before wiring it into the live `/retrieve` endpoint.

**Topics to reflect on:**
- What chunking strategy worked best, and how did you evaluate it?
- What was the hardest part of the ingestion pipeline?
- What similarity threshold worked well, and how did you find it?
- Did retrieval quality meet your expectations? What fell short?
- How did you handle the FastAPI ↔ Next.js communication?

---

### M4 — Memory

**Issue #92 & #93: Rethinking Short-Term Memory**

- **Dropping Redis for Message-Count Caps**:
  - *What happened*: We originally planned to use Redis to store conversation buffers and run LLM-based summary compression when the buffer got too large. We discarded this entirely.
  - *Why it happened*: Modern LLMs (specifically Gemini 1.5 Flash, our default) have enormous context windows (1M+ tokens). The theoretical fear of overflowing the context window in a standard web chat session is effectively obsolete.
  - *How we solved it*: We implemented a simple, stateless array slice (`modelMessages.slice(-30)`) in the Next.js API route. This caps the context to the last 30 messages, completely avoiding the infrastructure overhead of Redis and the latency/cost of running background summarization prompts.

**Issue #94 & #95: Long-Term Memory Extraction**

- **Protecting User BYOK Credits**:
  - *What happened*: We needed to run a background LLM prompt to extract durable facts from the conversation every 5 messages, but users might be using expensive BYOK models (Claude 3.5 Sonnet / GPT-4o) for the main chat.
  - *Why it happened*: Burning a user's personal API credits on silent background system tasks is a poor user experience and creates billing anxiety.
  - *How we solved it*: We hardcoded the memory extraction pipeline to *always* use the server's default `GOOGLE_GENERATIVE_AI_API_KEY` with `gemini-1.5-flash`. This protects the user's credits and guarantees we have a model that natively supports structured JSON output (`generateObject` with Zod) for reliable extraction.

- **Strict Zod Schemas for LLM Output**:
  - *What happened*: We needed the LLM to return exactly the enum values our Prisma database expected for the `scope` column (`preference`, `project`, `style`, `fact`).
  - *Why it happened*: LLMs are prone to hallucinating categories (e.g., returning `framework` instead of `preference`).
  - *How we solved it*: We used Vercel AI SDK's `generateObject` and enforced `z.enum(['preference', 'project', 'style', 'fact'])` directly in the schema. The SDK automatically handles retries and prompt shaping to ensure the LLM strictly adheres to our database constraints.

**Issue #96: Memory Management UI**

- **React Query Optimistic Updates & Inline Editing**:
  - *What happened*: We wanted the Memory panel to feel instantaneous when users update their preferences.
  - *Why it happened*: Traditional form submissions or page reloads feel too heavy for tweaking a single memory value.
  - *How we solved it*: We built an inline editing mode into the `MemoryRow` component (clicking the value turns it into an input). We paired this with React Query mutations that instantly invalidate the `['memories']` cache key on success, causing the UI to seamlessly refresh the data in the background without any loading spinners disrupting the user flow.

---

### M5 — Agents

**Issue #123: LangGraph Proof-of-Life & State Persistence**

- **LangGraph vs Prisma State Management**:
  - *What happened*: We abandoned Prisma JSON columns for LangGraph state in favor of LangGraph's native `PostgresSaver`.
  - *Why it happened*: Managing complex conversational graphs with human-in-the-loop (`interrupt()`) required deep state-diffing, threading, and native resumability that manually updating a JSON column could not robustly handle without reinventing the wheel.
  - *How we solved it*: We restricted Prisma's `AgentRun` model to be a lightweight status index (`running`, `completed`, `cancelled`) and let `langgraph-checkpoint-postgres` manage its own internal tables side-by-side using raw `asyncpg`.

- **Supabase PgBouncer and psycopg3 (PostgresSaver)**:
  - *What happened*: LangGraph's `PostgresSaver` relies on `psycopg3`, which natively attempts to use prepared statements. This crashed instantly with `DuplicatePreparedStatement` errors on Supabase.
  - *Why it happened*: Supabase's PgBouncer runs in "transaction mode", which shuffles underlying server connections and destroys prepared statement continuity.
  - *How we solved it*: We explicitly disabled prepared statements in `psycopg_pool.ConnectionPool` by passing `prepare_threshold=None` into the kwargs, allowing `PostgresSaver` to work flawlessly behind the transaction pooler.

- **LangGraph Dynamic Routing (`Command`)**:
  - *What happened*: The graph continued executing the `finalize` node even when the user explicitly rejected approval (`approve: False`) during the `interrupt()`.
  - *Why it happened*: We had originally defined a static edge: `builder.add_edge("await_approval", "finalize")`. In modern LangGraph, static edges can aggressively override or conflict with dynamic routing returned by `Command(goto=...)` inside a node.
  - *How we solved it*: We removed the static edge entirely. We updated the `await_approval` node to explicitly return `Command(goto="finalize")` on approval and `Command(goto=END)` on rejection, cleanly embracing dynamic routing for human-in-the-loop decisions.

**Issue #97: GitHub Tool & Token Resolution**

- **Resolving Third-Party OAuth Tokens via Clerk**:
  - *What happened*: We needed to act on behalf of the user on GitHub, but storing OAuth tokens in our database introduces significant security and lifecycle management risks.
  - *Why it happened*: Traditional apps store tokens in the DB, but this means you have to manually handle token expiration, refresh flows, and revocation.
  - *How we solved it*: We utilized Clerk's `Use custom credentials` feature to hook into our own GitHub OAuth App. We then wrote a Next.js helper `getGithubToken` that dynamically calls `clerkClient().users.getUserOauthAccessToken()`. This safely fetches a fresh token per request natively from Clerk, completely eliminating the need to store or rotate GitHub tokens in our PostgreSQL database.
  
- **Handling API Error Granularity in Tools**:
  - *What happened*: The standalone Python GitHub tool originally surfaced raw HTTP errors.
  - *Why it happened*: Basic `httpx` logic throws generic exceptions on failures. If the user misconfigured their GitHub scopes (e.g., forgot the `repo` scope), the LangGraph agent would just see a raw 403 or 401.
  - *How we solved it*: We implemented a `_handle_response_errors` wrapper that intercepts all `httpx` errors and parses the response JSON to raise specific `GitHubAPIError` exceptions. This ensures that when scopes are missing, the exact granular failure reason is logged and passed up to the LangGraph layer, making debugging OAuth configurations trivial.

**Issue #98: Filesystem Tool & Sandboxing**

- **Abandoning Local Disk for Cloud Storage**:
  - *What happened*: We completely redesigned the filesystem tool to use Supabase Storage instead of the local `/tmp` directory.
  - *Why it happened*: Free-tier cloud deployments (like Render) spin down containers when idle. If an agent writes a file to the local disk, and the container sleeps before the user checks it, the disk is wiped and the file is permanently lost.
  - *How we solved it*: We built the filesystem primitives (`read_file`, `write_file`) directly over `supabase.storage`. This perfectly mirrors the LangGraph `PostgresSaver` philosophy: anything that needs to survive a container restart must be pushed to a durable remote store.

- **Accepting Infeasibility Over Security Regressions**:
  - *What happened*: We formally abandoned the `run_command` tool (executing arbitrary shell commands).
  - *Why it happened*: Real sandboxing requires launching an isolated Docker container with strict network blocks. A FastAPI service running inside a restrictive Render container cannot natively launch sibling Docker containers.
  - *How we solved it*: Rather than compromising security by executing commands natively in the shared FastAPI process (a severe security regression), we chose to honestly document the architectural constraint and omit the feature entirely via ADR-015.

**Issue #99: LangGraph Orchestration & Testing**

- **Structured Output Reliability over Free-Text Parsing**:
  - *What happened*: Extracting lists of files and plans from standard Markdown or XML outputs often failed due to inconsistent LLM formatting.
  - *Why it happened*: LLMs routinely add conversational filler or misformat code blocks, causing regex parsers to break mid-execution.
  - *How we solved it*: We abandoned regex parsing entirely and utilized the `google-genai` SDK's native `response_schema` parameter by passing rigidly defined Pydantic `BaseModel` objects. This forces the model into strict JSON compliance and allows the SDK to return deeply validated Python objects directly via `response.parsed`.

- **LLM Rate Limits in Multi-Agent Loops**:
  - *What happened*: Our automated test to verify the 3-cycle Coder ↔ Reviewer rejection loop failed with a `503 UNAVAILABLE` and Quota Exceeded error.
  - *Why it happened*: Multi-agent graphs can recursively call the LLM in tight loops. A 3-cycle rejection generated 7 API requests (1 Planner, 3 Coders, 3 Reviewers) in under 30 seconds, immediately tripping Gemini's Free Tier 5 RPM limit.
  - *How we solved it*: We documented the limitation as an expected environmental constraint. In production environments with higher tier limits this won't crash, but it proves that un-capped automated agent loops are financially and operationally dangerous without hard-coded circuit breakers (like our `current_revision < 3` check).

**Issue #100: Permanent Agent Runs REST API**

- **Graceful Failure in Synchronous Streaming**:
  - *What happened*: The integration test for starting an agent run failed with a `502 Bad Gateway`.
  - *Why it happened*: The backend LLM provider (Gemini) threw a `503 Service Unavailable` due to high demand. Because the FastAPI `start_run` endpoint executed `graph.stream(...)` synchronously without an explicit try/except block, the LLM exception bubbled up through LangGraph, causing FastAPI to crash and return a `500 Internal Server Error`, which Next.js caught and surfaced as `502`.
  - *How we solved it*: We wrapped the `graph.stream` execution in a `try...except` block in the FastAPI endpoints. When an exception occurs, we execute a raw SQL update against the `AgentRun` table to instantly set the status to `failed` with the error message, and gracefully return a `200 OK` JSON response indicating failure, preventing total API crashes.

**Issue #101: Agent UI Integration**

- **Honest Loading States over Fake Progress**:
  - *What happened*: When designing the Agent UI, we faced the constraint that the LangGraph pipeline executes in a single, blocking synchronous request. There is no websocket or server-sent-event stream that emits "Planner started," "Coder finished" events.
  - *Why it happened*: We deliberately chose a simpler, synchronous architecture for the FastAPI / LangGraph boundary (#99, #100) to prioritize reliability over complex streaming infrastructure.
  - *How we solved it*: Rather than building a fake, time-based step tracker that misrepresents the system's actual execution, we opted for an "honest" loading state ("Planning and generating — this can take up to a minute"). This manages user expectations without introducing UI deception. Once interrupted, we render the exact `pendingApproval` state (plan + files) retrieved natively from the database.

**Issue #102: GitHub Commit Integration**

- **Clerk v7 OAuth Provider Naming**:
  - *What happened*: The GitHub execution path immediately failed saying no GitHub account was connected, even when the user was fully logged in with GitHub.
  - *Why it happened*: Clerk v7 deprecated the `oauth_github` string for the `getUserOauthAccessToken` method. We were querying the old provider string, so Clerk silently returned an empty array instead of the token.
  - *How we solved it*: We updated the provider parameter to simply `github`, resolving the issue immediately and correctly fetching the user's token.

- **Debugging Silent 404s in Next.js 15 Route Handlers**:
  - *What happened*: Next.js API routes were returning opaque 404s when attempting to hit the `resume` endpoint from the UI.
  - *Why it happened*: When multiple layers (Auth, DB Lookups, Authorization checks) can return 404, standard `Not Found` messages make debugging impossible, especially since Next.js 15's strict `await params` requirement can easily introduce bugs where DB queries run with unresolved objects.
  - *How we solved it*: We injected verbose `DEBUG: ...` strings directly into the JSON response payloads for each failure point (e.g., `"DEBUG: AgentRun not found in DB with id..."`). This allowed us to instantly trace errors from the browser's Network tab without diving blindly into server logs.

---

### M6 — Production

> Fill this in after completing Milestone 6.

**Topics to reflect on:**
- What did LangSmith reveal that you wouldn't have seen otherwise?
- What broke in Docker that worked fine locally?
- What did you learn about CI/CD that you'll apply to future projects?
- What's the actual cost per 1000 conversations, based on real data?

---

## General Notes

> Add any notes that don't fit a milestone here.

### Vercel AI SDK 4 Type Definitions Issue
When using `@ai-sdk/react@4.0.17`, there is an internal type conflict regarding the `initialMessages` property on the `useChat` hook options. The compiler throws a `TS2353` error (`Object literal may only specify known properties`), but the property is essential at runtime to prepopulate the chat state and prevent race conditions where aggressive client-state synchronization wipes server-loaded messages on refresh. The current workaround is placing a `// @ts-ignore` immediately above the `initialMessages` property inside the options object.

---

## Resources That Actually Helped

> As you find genuinely useful resources (docs pages, blog posts, videos), link them here. Avoid dumping everything — only the things you'd recommend to someone else building this.

| Resource | What it helped with |
|----------|---------------------|
| | |

## 2026-08-03 - Agent Safety Check (Issue #102)

**What happened**: Conducted a targeted adversarial security check to verify the boundary between agent plan generation and actual execution, ensuring agents cannot bypass human approval before taking external, hard-to-undo actions (like committing to GitHub).
**What I tried**: Designed specialized test scripts interacting directly with the FASTAPI endpoint to simulate unauthorized repository access, revision-loop bypasses, XSS payloads in the approval UI, and DB spoofing on callback.
**What worked**: The system effectively resisted execution boundaries. Loop caps (max 3 revisions) were strictly enforced in LangGraph via main_graph.py. React automatically mitigated XSS payloads via JSX standard rendering. Finally, the callback payload takes no target metadata, making spoofing impossible.
**What I'd do differently**: Found that github_token is persistently stored in plain view inside LangGraph checkpoints tables because it is part of AgentState. Going forward, sensitive ephemeral tokens should NOT be stored in LangGraph state. They should be passed just-in-time via a separate secure transient cache or fetched immediately during execution.
