# Quasar

> AI-powered developer workspace.

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk)](https://clerk.com/)

---

## Overview

Quasar is a modern, AI-first developer workspace designed to streamline workflows, manage context intelligently, and assist in deep technical problem-solving. 

It exists to bridge the gap between traditional development environments and next-generation AI assistants by providing a unified interface where code, documentation, architecture discussions, and AI agents seamlessly interact. 

**Target Users:** Software Engineers, System Architects, and Technical Product Managers.  
**Current Maturity:** Development

---

## Key Features

### ✅ Implemented
- **Frontend UI Shell:** Responsive Sidebar, dashboard layout, mobile navigation, and page shells.
- **Authentication:** Clerk integration with secure sign-in/sign-up flows.
- **Route Protection:** Next.js middleware securing internal workspace routes.
- **Dynamic Profile Integration:** Custom User Menu synced with Clerk.
- **Auth Webhooks:** API route with `svix` verification for handling user creation events.

### 🚧 In Progress
- **Database Foundation:** Integrating PostgreSQL via Prisma.
- **Workspace Data Model:** Building the core schema for users, documents, and chat history.

### 🔮 Planned
- **AI-Powered Chat Workspace:** Streaming LLM responses and multi-agent conversations.
- **Memory & RAG:** Context-aware retrieval for specific codebases.
- **Document Management:** Organizing technical documentation within workspaces.
- **Production Deployment:** CI/CD pipeline and highly available infrastructure.

---

## Technology Stack

**Frontend**
- Next.js (App Router)
- React
- Tailwind CSS
- Shadcn UI
- Lucide React

**Backend**
- Next.js API Routes (Serverless)

**Infrastructure / Auth**
- Clerk Authentication
- Svix (Webhook Verification)

*(Note: Database and AI components are planned for upcoming milestones and will be added to the stack as they are implemented.)*

---

## System Architecture

Quasar uses a modular, serverless architecture centered around Next.js App Router. The frontend leverages React Server Components for performance, while client-side state is kept minimal. Authentication is handled entirely by Clerk at the edge (via middleware).

For a detailed breakdown of the system components, data flow, and upcoming AI integrations, please refer to the [Architecture Documentation](docs/Architecture.md).

---

## Project Structure

```
src/
├── app/                  # Next.js App Router pages, layouts, and API routes
├── components/           # Reusable UI components (Shadcn, Layout, etc.)
├── lib/                  # Utility functions and shared logic
docs/                     # Comprehensive technical documentation
public/                   # Static assets
```

---

## Documentation

Quasar maintains detailed, markdown-based documentation in the `/docs` directory. 

| Document | Purpose | When to Read |
|-----------|---------|--------------|
| [Architecture.md](docs/Architecture.md) | Overall system design | Understanding high-level data flow and app structure |
| [Database.md](docs/Database.md) | Database schema and queries | Working with Prisma or modifying data models |
| [API.md](docs/API.md) | Backend endpoints | Integrating front-end features with the backend |
| [RAG.md](docs/RAG.md) | Retrieval-Augmented Generation | Developing context-aware AI features |
| [Memory.md](docs/Memory.md) | Long-term AI memory | Understanding how context is persisted |
| [Agents.md](docs/Agents.md) | AI Agent design | Extending or modifying agentic capabilities |
| [AI-Pipeline.md](docs/AI-Pipeline.md) | AI workflow execution | Understanding prompt engineering and token handling |
| [Deployment.md](docs/Deployment.md) | Hosting and CI/CD | Preparing for staging or production releases |
| [Decisions.md](docs/Decisions.md) | Architecture Decision Records | Reviewing *why* specific engineering choices were made |
| [Roadmap.md](docs/Roadmap.md) | Long-term project planning | Looking at future milestones and epics |
| [Lessons-Learned.md](docs/Lessons-Learned.md) | Engineering notes | Avoiding past mistakes and understanding edge cases |
| [GitHub-Setup.md](docs/GitHub-Setup.md) | Repository config | Setting up PR templates, actions, and issue tracking |

---

## Screenshots

*Landing Page [Placeholder]*  
*Dashboard [Placeholder]*  
*Chat Workspace [Placeholder]*  
*Documents [Placeholder]*  
*Settings [Placeholder]*  

---

## Getting Started

### Prerequisites
- Node.js >= 20
- npm >= 10
- A Clerk Account (for Authentication)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/KhuzaimaHassan/Quasar.git
   cd Quasar
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Variables

Create a `.env.local` file in the root directory and add your Clerk credentials:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/chat
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/chat
```

### Development

Run the Next.js development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Build

Create a production build:

```bash
npm run build
npm run start
```

---

## Current Status

- ✅ Frontend Foundation
- ✅ Authentication
- 🟡 Backend Foundation
- ⬜ Chat Streaming
- ⬜ RAG
- ⬜ Memory
- ⬜ Agents
- ⬜ Production Deployment

---

## Engineering Principles

- **Clean Architecture:** Strict separation of concerns between UI, business logic, and data access.
- **Type Safety:** End-to-end TypeScript enforcement to catch errors at compile-time.
- **Modular Design:** Reusable UI using Tailwind CSS and Radix primitives (Shadcn).
- **AI-First Architecture:** Architecture built specifically to support streaming LLMs and autonomous agents.
- **Security by Design:** Edge-level route protection and strict webhook verification.

---

## Known Limitations

- The database and Prisma client are not yet integrated.
- The Chat, Documents, Memory, and Settings views are currently static frontend shells without backend state.
- Notifications and Dark Mode toggles are placeholders and not yet functional.

---

## Roadmap

This is a high-level overview. For detailed epics and tasks, refer to [Roadmap.md](docs/Roadmap.md).

---

## Contributing

We welcome contributions! Please ensure all code passes `npm run lint` and `npm run type-check` before submitting Pull Requests.

---

## License

This project is licensed under the MIT License.
