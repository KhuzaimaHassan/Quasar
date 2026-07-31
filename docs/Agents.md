# Agents

## Overview

Quasar's agent system lets users give complex, multi-step instructions — "build a Todo App in Next.js and commit it to my GitHub repo" — and have the system autonomously plan, code, review, and execute the work. This is implemented with **LangGraph** running inside the FastAPI service.

---

## Architecture

```
User task (from chat)
  ↓
Agent run created (agent_runs table, status: pending)
  ↓
LangGraph state machine starts
  ↓
┌─────────────────────────────────────────────┐
│  Planner          → breaks task into steps  │
│  Coder            → generates code files    │
│  Reviewer         → validates, catches bugs │
│  Human Approval   → interrupt() for consent │
│  Executor         → calls MCP tools         │
└─────────────────────────────────────────────┘
  ↓
Agent run completed (status: completed)
  ↓
Result streamed back to chat
```

---

## LangGraph State

The state object is passed through every node and persisted by LangGraph's internal checkpointer after each step (enables resumability):

```python
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END

class AgentState(TypedDict):
    task: str                    # Original user instruction
    plan: list[str]              # Steps from Planner
    current_revision: int        # Counter for Coder/Reviewer loops (max 3)
    generated_files: dict        # filename → content
    review_notes: str            # Reviewer's feedback
    tool_calls: list[dict]       # Log of MCP calls made
    final_output: str            # Summary for user
    error: str | None            # Set if a node fails
```

---

## Agent Nodes

### Planner

Decomposes the user's task into an ordered list of concrete steps. *(Note: The originally planned 'Researcher' node was skipped; reasoning is handled entirely by the Planner and Coder with their native context.)*

### Coder

Generates code files based on the plan steps and any previous reviewer notes. Merges output into `state["generated_files"]`.

### Reviewer

Validates the generated files before execution. If the reviewer identifies critical issues, the graph routes back to the Coder (incrementing `current_revision`). 

**Safety Cap**: The Coder ↔ Reviewer loop is hard-capped at a maximum of 3 revisions. If the files are still rejected on the 3rd revision, the run fails immediately with a clear error rather than looping indefinitely.

### Human Approval & Executor

On Reviewer approval, the graph hits a native `interrupt()` to pause execution and show the human exactly what files will be written.

Upon resumption (`Command(resume={"approved": True})`), the Executor node runs. *(Note: Currently, the Executor only targets the `#98` Filesystem Sandbox. GitHub commit integration is deliberately deferred to `#102`.)*

---

## State Graph Definition

```python
builder = StateGraph(AgentState)

builder.add_node("planner", planner)
builder.add_node("coder", coder)
builder.add_node("reviewer", reviewer)
builder.add_node("human_approval", human_approval)
builder.add_node("executor", executor)

builder.add_edge(START, "planner")
builder.add_edge("planner", "coder")
builder.add_edge("coder", "reviewer")
# Reviewer and Human Approval use Command(goto=...) for dynamic routing
builder.add_edge("executor", END)

graph = builder.compile(checkpointer=checkpointer)
```

---

## MCP Tool Integrations

### GitHub (`tools/github.py`)

*(Implemented ✅)* This standalone module provides six core GitHub API actions. Safety, validation, and human-in-the-loop approval logic is deliberately excluded from this module—those constraints are strictly enforced by the LangGraph orchestrator layer (#99).

| Tool | Description |
|------|-------------|
| `list_repos` | List user's repositories |
| `get_file` | Read a file from a repo |
| `create_or_update_file` | Write/overwrite a file (auto-commits) |
| `create_issue` | Create a GitHub issue |
| `list_open_prs` | List open pull requests |
| `create_branch` | Create a new branch |

Auth: GitHub OAuth tokens are never stored in our database. They are resolved fresh from Clerk for every tool invocation.

### Filesystem (`tools/filesystem.py`)

Sandboxed read/write within a per-workspace directory backed by Supabase Storage (`agent-sandbox/{workspace_id}/`).

| Tool | Description |
|------|-------------|
| `read_file` | Read a file from workspace sandbox |
| `write_file` | Write/create a file in sandbox |
| `list_files` | List files in a directory |
| `delete_file` | Delete a file |
| `run_command` | *(Not Implemented 🚫)* Deliberately excluded. See Decisions.md. |

> `run_command` was originally planned but judged unachievable for this deployment. Real Docker isolation isn't achievable from inside a FastAPI service that is itself just one process in one shared container on Render's free tier. Building an unisolated version instead would be a real security regression, not an acceptable shortcut.

### Figma (`tools/figma.py`)

Read-only. Useful for "implement this Figma component" tasks.

| Tool | Description |
|------|-------------|
| `get_file` | Get Figma file metadata |
| `get_component` | Get component spec (name, properties, styles) |

---

## Agent Run Lifecycle

| Status | Meaning |
|--------|---------|
| `running` | Currently executing |
| `awaiting_approval` | Paused at the human-in-the-loop gate |
| `completed` | All steps finished successfully |
| `failed` | Error in a node, run halted |
| `cancelled` | User explicitly rejected the execution |

State is natively managed by LangGraph's `PostgresSaver` checkpointer using the `threadId`. The `AgentRun` table in our database acts as a lightweight index, not a state-snapshot table, with one exception: `pendingApproval`. 
When the run is interrupted for human approval, we write the proposed files to `pendingApproval` in the `AgentRun` row. This allows the Next.js polling endpoint (`GET /api/agents/run/:id`) to read the pending files without querying FastAPI, maintaining a single source of truth.

> **Note on cancellation**: True mid-computation cancellation is not supported by this design. The `cancel` action is only meaningful while a run is paused at the approval gate (status `awaiting_approval`). It is effectively identical to resuming with `approved: false`, cleanly rejecting the run. If the service crashes mid-run, the run can be seamlessly resumed from the exact node where it left off.

---

## UI

The agent panel in the chat sidebar shows:

```
🤖 Agent run #42

✅ Planner   — 3 steps identified
✅ Researcher — 2 chunks retrieved
🔄 Coder     — generating files...
⏸  Reviewer
⏸  Executor

[Cancel run]
```

After completion:
```
✅ All steps complete

Files created:
  src/components/TodoList.tsx
  src/components/TodoItem.tsx

GitHub commit: feat/todo-app-scaffold → main
```

---

## Safety Constraints

- **Human-in-the-loop for destructive actions** — before Executor writes files, the graph utilizes LangGraph's native `interrupt()` primitive to pause execution and prompt the user. The UI then resumes the graph using `Command(resume=...)` to either approve or reject the action.
- **Max Planner Steps**: Hard cap at 8 plan steps per run to prevent runaway agents.
- **Max Revisions**: Hard cap of 3 iterations for the Coder ↔ Reviewer loop to prevent infinite generation loops.
- **Max tool calls**: Hard cap at 20 MCP calls per run.
