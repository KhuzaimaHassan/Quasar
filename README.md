<div align="center">

# ✦ Quasar

### Your models. Your documents. One workspace.

An AI developer workspace for streaming conversations, answers with sources, and agents that pause for your approval.

**[Open the live app](https://qausar.vercel.app)** · **[Explore the architecture](docs/Architecture.md)** · **[Run locally](#run-locally)**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)

</div>

<p align="center">
  <img src="public/screenshots/01_chat_streaming.png" alt="Quasar Chat page with full workspace navigation, a formatted response, a Python code block, model selection, and the message composer" width="100%">
  <br>
  <sub>Chat · Streaming responses, formatted code, and conversation history.</sub>
</p>

## What you can do

| | Inside Quasar |
| :--- | :--- |
| 💬 **Chat across providers** | Stream responses, render code, and choose a model per conversation. Gemini Flash-Lite is the default; premium models require your own provider key. |
| 📚 **Ask your documents** | Upload PDF or DOCX files, follow indexing progress, and open source citations alongside answers. |
| 🧠 **Keep useful context** | Save and manage preferences that carry into future conversations. |
| 🤖 **Work with agents** | Follow Planner → Coder → Reviewer runs, inspect tool activity, and approve changes before execution. |
| 🗂️ **Separate your work** | Keep conversations, documents, memory, and agent runs scoped to individual workspaces. |
| 🔑 **Control your keys and usage** | Add encrypted provider keys in Settings and inspect recorded token and cost usage. |

## Explore the workspace

Actual pages from the deployed app. Each image opens at its original size.

### Documents

Upload files, follow their indexing status, and keep reference material together in a workspace.

![Quasar Documents page with workspace navigation, upload area, and three indexed PDFs](public/screenshots/readme-documents.jpg)

### Memory

Review and manage the preferences, project details, styles, and facts used in future conversations.

![Quasar Memory page with the preference form and all four memory categories](public/screenshots/readme-memory.jpg)

### Settings

Manage provider keys and review token usage and estimated costs in one place.

![Quasar Settings page showing provider key controls and usage analytics](public/screenshots/readme-settings.jpg)

[View the daily usage table →](public/screenshots/readme-settings-usage.jpg)

<details>
<summary><strong>Also on mobile</strong> — a compact view of Memory</summary>

<p align="center">
  <img src="public/screenshots/readme-mobile-memory.jpg" alt="Quasar Memory on mobile with stacked preference fields" width="260">
</p>

</details>

## Under the hood

| Layer | Built with |
| :--- | :--- |
| **Web & API** | Next.js App Router, React, TypeScript, Vercel AI SDK, Clerk |
| **Retrieval & agents** | FastAPI, LangGraph, Gemini embeddings, hybrid retrieval with reciprocal rank fusion |
| **Data & operations** | PostgreSQL / pgvector, Prisma, Supabase Storage, LangSmith, GitHub Actions |

The Next.js API owns user authorization and provider routing; FastAPI handles document processing, retrieval, and agent execution. Provider keys are encrypted with AES-256-GCM, and PostgreSQL enforces durable request quotas. Architectural tradeoffs—including deliberately deferred features—are recorded in the [ADRs](docs/Decisions.md).

> **Live demo:** The backend uses Render's free tier and can sleep while idle. Its first request may take around a minute to start; provider quotas also apply. The demo currently uses Clerk development mode.

## Run locally

Use **Node.js 20+** and **Python 3.11+**. The [environment setup guide](docs/Environment-Setup.md) covers credentials, the backend virtual environment, database setup, and migrations.

```bash
git clone https://github.com/KhuzaimaHassan/Quasar.git
cd Quasar
npm ci
```

After completing the environment setup, start the services in separate terminals:

```bash
# Frontend — repository root
npm run dev

# Backend — with its Python virtual environment activated
cd backend
python -m uvicorn main:app --reload --port 8000
```

Frontend checks run locally without model requests:

```bash
npm run type-check
npm run lint
npm test
npm run scan:secrets
```

See [Contributing](docs/Contributing.md) for backend checks, responsive verification, and the branch → PR → CI workflow.

## Go deeper

| Explore | Documentation |
| :--- | :--- |
| **System design** | [Architecture](docs/Architecture.md) · [Decision records](docs/Decisions.md) · [Database](docs/Database.md) |
| **AI features** | [Chat pipeline](docs/AI-Pipeline.md) · [RAG](docs/RAG.md) · [Agents](docs/Agents.md) · [Memory](docs/Memory.md) |
| **Build & deploy** | [Environment setup](docs/Environment-Setup.md) · [API reference](docs/API.md) · [Deployment](docs/Deployment.md) |
| **Engineering** | [Security](docs/Security.md) · [Performance](docs/Performance.md) · [Contributing](docs/Contributing.md) |
| **Project story** | [Roadmap](docs/Roadmap.md) · [Lessons learned](docs/Lessons-Learned.md) · [RAG evaluation](docs/rag-evaluation.prd.md) · [GitHub setup](docs/GitHub-Setup.md) |
