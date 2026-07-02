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

---

### M2 — Chat

> Fill this in after completing Milestone 2.

**Topics to reflect on:**
- How did Vercel AI SDK streaming work in practice? Any rough edges?
- Did `useChat` handle edge cases well (network errors, retries)?
- What did you learn about token counting that surprised you?
- How did you handle the UX of streaming — typing indicator, stop button?

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
