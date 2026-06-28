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
┌────────────────────────────────────────────┐
│  Planner     → breaks task into steps       │
│  Researcher  → retrieves context (RAG + web)│
│  Coder       → generates code files        │
│  Reviewer    → validates, catches errors    │
│  Executor    → calls MCP tools, runs code  │
└────────────────────────────────────────────┘
  ↓
Agent run completed (status: completed)
  ↓
Result streamed back to chat
```

---

## LangGraph State

The state object is passed through every node and persisted to `agent_runs.state_graph` after each step (enables resumability):

```python
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END

class AgentState(TypedDict):
    task: str                    # Original user instruction
    plan: list[str]              # Steps from Planner
    current_step: int            # Which step we're on
    research: str                # Context from Researcher
    generated_files: dict        # filename → content
    review_notes: str            # Reviewer's feedback
    tool_calls: list[dict]       # Log of MCP calls made
    final_output: str            # Summary for user
    error: str | None            # Set if a node fails
```

---

## Agent Nodes

### Planner

Decomposes the user's task into an ordered list of concrete steps.

```python
async def planner(state: AgentState) -> AgentState:
    response = await llm.ainvoke([
        SystemMessage("You are a technical planner. Break the task into clear, atomic steps."),
        HumanMessage(f"Task: {state['task']}\nOutput a numbered list of steps. Max 8 steps.")
    ])
    state["plan"] = parse_steps(response.content)
    return state
```

Planner runs once at the start. Its output is the roadmap for the rest of the run.

### Researcher

Gathers context needed for the current step — from the user's documents (RAG) and optionally from web search.

```python
async def researcher(state: AgentState) -> AgentState:
    step = state["plan"][state["current_step"]]
    chunks = await rag_retrieve(step, workspace_id=...)
    state["research"] = format_chunks(chunks)
    return state
```

Only runs when the current step requires external knowledge. Skip for purely generative steps (e.g., "write a utility function").

### Coder

Generates code files based on the plan step and research context.

```python
async def coder(state: AgentState) -> AgentState:
    step = state["plan"][state["current_step"]]
    response = await llm.ainvoke([
        SystemMessage("You are a senior engineer. Write clean, typed, production-ready code."),
        HumanMessage(f"""
Step: {step}
Research context: {state['research']}
Existing files: {list(state['generated_files'].keys())}

Output each file as:
<file path="src/components/TodoList.tsx">
...code...
</file>
""")
    ])
    files = parse_file_blocks(response.content)
    state["generated_files"].update(files)
    return state
```

### Reviewer

Validates the generated files before execution.

```python
async def reviewer(state: AgentState) -> AgentState:
    files_summary = "\n".join(
        f"{path}:\n{content[:500]}..." for path, content in state["generated_files"].items()
    )
    response = await llm.ainvoke([
        SystemMessage("You are a code reviewer. Check for bugs, missing imports, and security issues."),
        HumanMessage(f"Review these files:\n{files_summary}")
    ])
    state["review_notes"] = response.content
    return state
```

If the reviewer identifies critical issues, route back to Coder (conditional edge).

### Executor

Calls MCP tools to perform real-world actions: commit files to GitHub, create issues, run shell commands.

```python
async def executor(state: AgentState) -> AgentState:
    for path, content in state["generated_files"].items():
        result = await mcp.github.create_or_update_file(
            repo=state["target_repo"],
            path=path,
            content=content,
            message=f"feat: {state['plan'][state['current_step']]}",
        )
        state["tool_calls"].append({"tool": "github.create_file", "path": path, "result": result})
    return state
```

---

## State Graph Definition

```python
workflow = StateGraph(AgentState)

workflow.add_node("planner", planner)
workflow.add_node("researcher", researcher)
workflow.add_node("coder", coder)
workflow.add_node("reviewer", reviewer)
workflow.add_node("executor", executor)

workflow.set_entry_point("planner")
workflow.add_edge("planner", "researcher")
workflow.add_edge("researcher", "coder")
workflow.add_conditional_edges(
    "reviewer",
    lambda state: "coder" if needs_revision(state) else "executor",
)
workflow.add_edge("executor", END)

app = workflow.compile()
```

---

## MCP Tool Integrations

### GitHub (`tools/github.py`)

| Tool | Description |
|------|-------------|
| `list_repos` | List user's repositories |
| `get_file` | Read a file from a repo |
| `create_or_update_file` | Write/overwrite a file (auto-commits) |
| `create_issue` | Create a GitHub issue |
| `list_open_prs` | List open pull requests |
| `create_branch` | Create a new branch |

Auth: GitHub OAuth token stored per user in `users.preferences`.

### Filesystem (`tools/filesystem.py`)

Sandboxed read/write within a per-workspace directory at `/tmp/quasar/{workspace_id}/`.

| Tool | Description |
|------|-------------|
| `read_file` | Read a file from workspace sandbox |
| `write_file` | Write/create a file in sandbox |
| `list_files` | List files in a directory |
| `delete_file` | Delete a file |
| `run_command` | Run a shell command in sandbox (Docker-isolated) |

> `run_command` is dangerous. Sandbox all execution in a Docker container with no network access and a timeout.

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
| `pending` | Run created, not yet started |
| `running` | Currently executing |
| `completed` | All steps finished successfully |
| `failed` | Error in a node, run halted |
| `cancelled` | User cancelled mid-run |

State is saved to `agent_runs.state_graph` after each node completes. If the service crashes mid-run, the run can be resumed from the last saved state.

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

- **Human-in-the-loop for destructive actions** — before Executor commits to `main` or deletes files, prompt the user for confirmation.
- **Max steps**: Hard cap at 8 plan steps per run to prevent runaway agents.
- **Max tool calls**: Hard cap at 20 MCP calls per run.
- **Timeout**: Entire agent run must complete within 5 minutes. Surface a timeout error if exceeded.
- **No network in code execution sandbox** — prevents the agent from making external requests during `run_command`.
