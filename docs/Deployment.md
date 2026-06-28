# Deployment

## Overview

Quasar uses a split deployment:

| Service | Platform | Trigger |
|---------|----------|---------|
| Next.js frontend + API routes | Vercel | Push to `main` |
| FastAPI backend (RAG + agents) | Docker → Railway or Fly.io | GitHub Actions on push to `main` |
| PostgreSQL + pgvector | Supabase | Managed |
| Redis | Upstash (serverless Redis) | Managed |
| File storage | Supabase Storage | Managed |

---

## Environments

| Environment | Branch | URL |
|-------------|--------|-----|
| Local | any | `localhost:3000` / `localhost:8000` |
| Preview | feature branches | Vercel preview URL (auto-generated) |
| Staging | `develop` | `staging.quasar.app` (optional) |
| Production | `main` | `quasar.app` |

---

## Environment Variables

### Next.js (`.env.local`)

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database
DATABASE_URL=postgresql://...

# AI providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# FastAPI service (internal)
FASTAPI_SERVICE_URL=http://localhost:8000   # or Railway URL in production

# Redis
REDIS_URL=redis://...

# LangSmith (M6)
LANGCHAIN_API_KEY=ls_...
LANGCHAIN_PROJECT=quasar
LANGCHAIN_TRACING_V2=true
```

### FastAPI (`.env`)

```env
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
REDIS_URL=redis://...
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
LANGCHAIN_API_KEY=ls_...
LANGCHAIN_PROJECT=quasar
LANGCHAIN_TRACING_V2=true
```

Never commit either file. Add to `.gitignore`. Set all variables in Vercel dashboard and GitHub Actions secrets.

---

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker Desktop
- PostgreSQL (local or Supabase)

### Setup

```bash
# Clone
git clone https://github.com/your-username/quasar.git
cd quasar

# Frontend
npm install
cp .env.example .env.local
# fill in .env.local
npx prisma migrate dev

# Start Next.js
npm run dev

# Backend (in a separate terminal)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

### Docker Compose (local)

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: quasar
      POSTGRES_USER: quasar
      POSTGRES_PASSWORD: quasar
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  fastapi:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: ./backend/.env
    depends_on:
      - postgres
      - redis

volumes:
  pgdata:
```

```bash
docker compose up postgres redis  # Start dependencies
npm run dev                        # Start Next.js
cd backend && uvicorn main:app --reload  # Start FastAPI
```

---

## FastAPI Docker Image

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and test locally:

```bash
cd backend
docker build -t quasar-backend .
docker run -p 8000:8000 --env-file .env quasar-backend
```

---

## GitHub Actions CI/CD

### File structure

```
.github/
  workflows/
    ci.yml         # Runs on every PR — lint, type-check, test
    deploy.yml     # Runs on push to main — deploy backend to Railway
```

### CI (`ci.yml`)

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r backend/requirements.txt
      - run: cd backend && ruff check .
      - run: cd backend && mypy .
      - run: cd backend && pytest
```

### Deploy (`deploy.yml`)

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ghcr.io/${{ github.repository }}/backend:latest
        env:
          DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
          DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}

      - name: Deploy to Railway
        run: railway up --service backend
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

  migrate:
    runs-on: ubuntu-latest
    needs: deploy-backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

Vercel deployment is automatic — Vercel's GitHub integration handles it. No extra workflow needed for the frontend.

---

## Database Migrations in Production

1. Migrations run in the `deploy.yml` workflow **after** the backend deploys but **before** traffic switches over.
2. All migrations must be backwards-compatible (no dropping columns while old code is live).
3. Use a two-step process for breaking changes: add column (deploy) → backfill data (deploy) → remove old column (deploy).

---

## LangSmith Setup (M6)

```python
# In FastAPI startup
import langsmith
from langsmith import Client

client = Client()

# All LangChain/LangGraph calls are automatically traced
# when LANGCHAIN_TRACING_V2=true is set
```

Access traces at `https://smith.langchain.com/projects/quasar`.

---

## Monitoring

| Tool | What it monitors |
|------|-----------------|
| LangSmith | LLM call latency, token usage, agent step traces |
| OpenTelemetry + Uptrace | HTTP request latency, error rates, DB query times |
| Vercel Analytics | Frontend page load, Core Web Vitals |
| Railway Metrics | CPU, memory, restart count for FastAPI container |

### OpenTelemetry setup (FastAPI)

```python
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

FastAPIInstrumentor.instrument_app(app)
SQLAlchemyInstrumentor().instrument()
```

---

## Rollback Plan

- **Frontend**: Vercel keeps previous deployment — instant rollback from dashboard.
- **Backend**: Railway keeps previous image — redeploy the previous tag via `railway rollback`.
- **Database**: Never run destructive migrations without a prior backup. Supabase provides daily automatic backups.
