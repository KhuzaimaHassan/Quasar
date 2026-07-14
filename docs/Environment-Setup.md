# Environment Setup

Complete local development setup from scratch. Follow these steps in order.

---

## Prerequisites

Install these before anything else.

### Node.js 20+
```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
node --version  # should print v20.x.x
```

### Python 3.11+
```bash
# Using pyenv (recommended)
curl https://pyenv.run | bash
pyenv install 3.11.9
pyenv global 3.11.9
python --version  # should print Python 3.11.x
```

### Docker Desktop
Download from [docker.com/get-started](https://www.docker.com/get-started). Required for running PostgreSQL and Redis locally.

```bash
docker --version    # confirm installation
docker compose version
```

### Git
```bash
git --version  # confirm git is installed
```

### GitHub CLI (optional but useful)
```bash
# macOS
brew install gh

# Windows (Chocolatey)
choco install gh

gh auth login  # authenticate with your GitHub account
```

---

## Accounts to Create

You need accounts with these services before starting:

| Service | Free tier | What it's used for |
|---------|-----------|-------------------|
| [Google AI Studio](https://aistudio.google.com) | Free | Gemini API access |
| [Anthropic](https://console.anthropic.com) | Pay-as-you-go | Claude API |
| [OpenAI](https://platform.openai.com) | Pay-as-you-go | GPT-4 + embeddings |
| [Clerk](https://clerk.com) | Free | Authentication |
| [Supabase](https://supabase.com) | Free | PostgreSQL + pgvector + Storage |
| [Upstash](https://upstash.com) | Free | Redis |
| [LangSmith](https://smith.langchain.com) | Free | LLM tracing (M6) |
| [Vercel](https://vercel.com) | Free | Frontend hosting |
| [GitHub](https://github.com) | Free | Code + CI/CD |

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/quasar.git
cd quasar
```

---

## Step 2: Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com).
2. Go to **Settings → Database** and copy:
   - **Connection string (pooled)** → `DATABASE_URL`
   - **Connection string (direct)** → `DIRECT_URL`
3. Go to **Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`
4. Go to **Storage → Create bucket** named `documents`. Set it to **private**.
5. Enable pgvector: Go to **SQL Editor** and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

---

## Step 3: Set Up Clerk

1. Create a new application at [clerk.com](https://clerk.com).
2. Enable **GitHub** and **Google** as social login providers.
3. Go to **API Keys** and copy:
   - **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret key** → `CLERK_SECRET_KEY`
4. Go to **Webhooks → Add endpoint**:
   - URL: `https://your-preview-url.vercel.app/api/webhooks/clerk` (set this after Vercel deploy)
   - Events: `user.created`
   - Copy the **Signing Secret** → `CLERK_WEBHOOK_SECRET`

---

## Step 4: Set Up Upstash Redis

1. Create a new Redis database at [upstash.com](https://upstash.com).
2. Copy the **Redis URL** → `REDIS_URL`

---

## Step 4.5: Set Up Google AI Studio

1. Go to [aistudio.google.com](https://aistudio.google.com).
2. Create an API key (note that it's created as an auth key by default).
3. Copy the **API key** → `GOOGLE_GENERATIVE_AI_API_KEY`

---

## Step 5: Configure Environment Variables

### Next.js

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database (Supabase)
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI Providers
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Security
# Generate this via: openssl rand -base64 32 (Backup securely, losing this permanently breaks all stored API keys)
ENCRYPTION_KEY=your_base64_encryption_key_here

# FastAPI service
FASTAPI_SERVICE_URL=http://localhost:8000

# Redis
REDIS_URL=redis://...

# LangSmith (add in M6)
# LANGCHAIN_API_KEY=ls_...
# LANGCHAIN_PROJECT=quasar
# LANGCHAIN_TRACING_V2=true
```

### FastAPI Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
REDIS_URL=redis://...
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Step 6: Install Dependencies

### Frontend

```bash
# From project root
npm install
```

### Backend

```bash
cd backend
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

---

## Step 7: Run Database Migrations

```bash
# From project root
npx prisma migrate dev --name init
```

This creates all tables in your Supabase database. Verify with:

```bash
npx prisma studio
# Opens a browser UI showing all tables
```

---

## Step 8: Start the Development Servers

You need two terminals open simultaneously.

**Terminal 1 — Next.js**
```bash
# From project root
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

**Terminal 2 — FastAPI** (only needed from M3 onward)
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
uvicorn main:app --reload --port 8000
```
FastAPI docs available at [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Step 9: Verify Everything Works

1. Open [http://localhost:3000](http://localhost:3000)
2. Click **Sign up** — create an account with Google or GitHub
3. You should be redirected to the dashboard
4. Check the Supabase dashboard — a row should appear in the `users` table
5. Create a workspace — verify it appears in the `workspaces` table
6. Send a chat message — verify it streams and appears in the `messages` table

---

## Common Issues

### `Can't reach database server`
- Check `DATABASE_URL` is correct in `.env.local`
- Confirm Supabase project is not paused (free tier pauses after 1 week of inactivity)
- Try the direct URL instead of the pooled URL for migrations

### `Clerk: Invalid publishable key`
- Confirm `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` starts with `pk_test_` (dev) or `pk_live_` (prod)
- Restart the dev server after changing env vars (`Ctrl+C` then `npm run dev`)

### `pgvector type "vector" does not exist`
- The pgvector extension was not enabled. Run in Supabase SQL editor:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```

### `FastAPI: ModuleNotFoundError`
- Confirm the virtual environment is activated (`source venv/bin/activate`)
- Confirm you ran `pip install -r requirements.txt` inside the `backend/` directory

### `Prisma: Environment variable not found: DATABASE_URL`
- Confirm `.env.local` is in the project root (not inside `src/` or `backend/`)
- Prisma reads from `.env`, not `.env.local` by default. Either rename the file or add `--env-file .env.local` to the prisma command.

### Next.js changes not reflected
- Hard refresh the browser (`Cmd+Shift+R` / `Ctrl+Shift+R`)
- Restart the dev server if you changed environment variables

---

## Useful Commands

```bash
# Frontend
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Run ESLint
npm run type-check   # Run tsc --noEmit
npm run test         # Run Vitest

# Prisma
npx prisma migrate dev     # Apply new migrations
npx prisma migrate reset   # Reset DB and re-apply all migrations (DESTROYS DATA)
npx prisma studio          # Open DB GUI
npx prisma generate        # Regenerate Prisma client after schema change

# FastAPI
uvicorn main:app --reload --port 8000   # Dev server
pytest                                   # Run tests
ruff check .                             # Lint
mypy .                                   # Type check

# Docker
docker compose up postgres redis   # Start only DB and Redis locally
docker compose down                # Stop all containers
docker compose logs fastapi        # View FastAPI logs
```
