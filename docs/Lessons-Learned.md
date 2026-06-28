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

> Fill this in after completing Milestone 1.

**Topics to reflect on:**
- How long did Clerk setup actually take vs estimate?
- Was Prisma straightforward or did migrations cause problems?
- What was the first unexpected issue you hit?

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
