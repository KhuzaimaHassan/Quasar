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

---

### M3 — RAG

> Fill this in after completing Milestone 3.

**Topics to reflect on:**
- What chunking strategy worked best, and how did you evaluate it?
- What was the hardest part of the ingestion pipeline?
- What similarity threshold worked well, and how did you find it?
- Did retrieval quality meet your expectations? What fell short?
- How did you handle the FastAPI ↔ Next.js communication?

---

### M4 — Memory

> Fill this in after completing Milestone 4.

**Topics to reflect on:**
- How accurate was the memory extraction prompt? Many false positives?
- Did users (you, as a user) find the memory panel useful?
- When did the short-term compression trigger, and did it lose important context?

---

### M5 — Agents

> Fill this in after completing Milestone 5.

**Topics to reflect on:**
- How often did the agent produce wrong code that the reviewer caught?
- What was the most surprising thing LangGraph did?
- How did you handle agent runs that timed out or got stuck in a loop?
- What MCP tool was hardest to implement? Why?
- Did the Planner produce sensible plans, or did it need heavy prompt engineering?

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

---

## Resources That Actually Helped

> As you find genuinely useful resources (docs pages, blog posts, videos), link them here. Avoid dumping everything — only the things you'd recommend to someone else building this.

| Resource | What it helped with |
|----------|---------------------|
| | |
