from typing import TypedDict, Optional, Literal, cast
import logging
from google import genai

from core.config import settings
from .schemas import PlanOutput, CodeOutput, ReviewOutput
from langgraph.types import Command, interrupt
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool
import tools.filesystem as fs
import tools.github as gh
logger = logging.getLogger(__name__)

class AgentState(TypedDict, total=False):
    task: str
    conversation_id: str
    workspace_id: str
    execution_target: Literal['sandbox', 'github']
    target_repo: Optional[str]
    plan: list[str]
    current_revision: int
    generated_files: dict[str, str]
    review_notes: str
    tool_calls: list[dict]
    final_output: str
    error: Optional[str]

client = genai.Client(api_key=settings.GOOGLE_API_KEY)

def planner(state: AgentState) -> dict:
    task = state["task"]

    response = client.models.generate_content(
        model='gemini-3.5-flash',
        contents=f"Decompose the following task into clear, atomic steps. MAXIMUM 8 steps.\n\nTask: {task}",
        config={
            "response_mime_type": "application/json",
            "response_schema": PlanOutput,
        }
    )

    plan_output = cast(PlanOutput, response.parsed)
    steps = plan_output.steps

    if len(steps) > 8:
        logger.warning(f"Planner generated {len(steps)} steps, truncating to 8.")
        steps = steps[:8]

    return {"plan": steps}

def coder(state: AgentState) -> dict:
    task = state.get("task", "")
    plan = state.get("plan", [])
    review_notes = state.get("review_notes", "")

    prompt = f"Task: {task}\n\nPlan to execute:\n"
    for i, step in enumerate(plan):
        prompt += f"{i+1}. {step}\n"

    if review_notes:
        prompt += f"\nPrevious Reviewer Feedback:\n{review_notes}\n"

    prompt += "\nGenerate the necessary code files to fulfill the task and address any reviewer feedback."

    response = client.models.generate_content(
        model='gemini-3.5-flash',
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": CodeOutput,
        }
    )

    code_output = cast(CodeOutput, response.parsed)

    # Merge generated files into the state dictionary (path -> content)
    current_files = state.get("generated_files", {}) or {}
    merged_files = dict(current_files)

    for gen_file in code_output.files:
        merged_files[gen_file.path] = gen_file.content

    return {"generated_files": merged_files}

def reviewer(state: AgentState):
    plan = state.get("plan", [])
    generated_files = state.get("generated_files", {})
    current_revision = state.get("current_revision", 0)

    prompt = "Review the following generated files against the plan.\n\nPlan:\n"
    for i, step in enumerate(plan):
        prompt += f"{i+1}. {step}\n"

    prompt += "\nGenerated Files:\n"
    for path, content in generated_files.items():
        prompt += f"--- {path} ---\n{content}\n\n"

    prompt += "Identify any bugs, missing requirements, or syntax errors. If issues are found, set approved to false and list them in notes. If the files perfectly fulfill the plan, set approved to true."

    response = client.models.generate_content(
        model='gemini-3.5-flash',
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": ReviewOutput,
        }
    )

    review_output = cast(ReviewOutput, response.parsed)

    notes = review_output.notes
    if review_output.issues:
        notes += "\nIssues identified:\n" + "\n".join(f"- {issue}" for issue in review_output.issues)

    if not review_output.approved:
        if current_revision < 3:
            return Command(
                goto="coder",
                update={
                    "review_notes": notes,
                    "current_revision": current_revision + 1
                }
            )
        else:
            return Command(
                goto=END,
                update={
                    "review_notes": notes,
                    "error": f"Reviewer rejected changes after max revisions (3). Last notes: {notes}"
                }
            )
    else:
        return Command(
            goto="executor",
            update={
                "review_notes": notes
            }
        )


def executor(state: AgentState):
    workspace_id = state.get("workspace_id", "")
    generated_files = state.get("generated_files", {})
    tool_calls = state.get("tool_calls", []) or []
    execution_target = state.get("execution_target", "sandbox")
    target_repo = state.get("target_repo")
    task = state.get("task", "Automated commit by Quasar Agent")

    if execution_target == "github" and target_repo:
        summary = f"{len(generated_files)} files will be committed to {target_repo}:\n\n"
    else:
        summary = f"{len(generated_files)} files will be written to your sandbox:\n\n"

    for path, content in generated_files.items():
        summary += f"--- {path} ---\n{content}\n\n"

    resume_payload = interrupt({"msg": summary, "pendingFiles": list(generated_files.keys())})

    if isinstance(resume_payload, dict):
        approved = resume_payload.get("approved", False)
        github_token = resume_payload.get("github_token")
    else:
        approved = bool(resume_payload)
        github_token = None

    if not approved:
        return {"error": "Cancelled by user"}

    updated_tool_calls = list(tool_calls)

    if execution_target == "github":
        if not target_repo or not github_token:
            return {"error": "GitHub execution requested but target_repo or github_token is missing."}

        for path, content in generated_files.items():
            if len(updated_tool_calls) >= 20:
                logger.warning("Max tool calls (20) reached. Halting executor.")
                break

            try:
                res = gh.create_or_update_file(
                    token=github_token,
                    repo=target_repo,
                    path=path,
                    content=content,
                    message=f"Agent: {task[:50]}..."
                )
                updated_tool_calls.append({
                    "tool": "github.create_or_update_file",
                    "path": path,
                    "result": res
                })
            except Exception as e:
                updated_tool_calls.append({
                    "tool": "github.create_or_update_file",
                    "path": path,
                    "error": str(e)
                })
                return {"tool_calls": updated_tool_calls, "error": f"GitHub commit failed on {path}: {str(e)}"}

        return {"tool_calls": updated_tool_calls, "final_output": f"Successfully committed {len(generated_files)} files to {target_repo}."}
    else:
        for path, content in generated_files.items():
            if len(updated_tool_calls) >= 20:
                logger.warning("Max tool calls (20) reached. Halting executor.")
                break

            try:
                res = fs.write_file(workspace_id, path, content)
                updated_tool_calls.append({
                    "tool": "filesystem.write_file",
                    "path": path,
                    "result": res
                })
            except Exception as e:
                updated_tool_calls.append({
                    "tool": "filesystem.write_file",
                    "path": path,
                    "error": str(e)
                })
                return {"tool_calls": updated_tool_calls, "error": f"Tool execution failed on {path}: {str(e)}"}

        return {"tool_calls": updated_tool_calls, "final_output": f"Successfully wrote {len(generated_files)} files to sandbox."}

db_url = settings.DATABASE_URL.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")
pool = ConnectionPool(conninfo=db_url, kwargs={'autocommit': True, 'prepare_threshold': None})
checkpointer = PostgresSaver(pool) # type: ignore
checkpointer.setup()

builder = StateGraph(AgentState)
builder.add_node("planner", planner)
builder.add_node("coder", coder)
builder.add_node("reviewer", reviewer)
builder.add_node("executor", executor)

builder.add_edge(START, "planner")
builder.add_edge("planner", "coder")
builder.add_edge("coder", "reviewer")
builder.add_edge("executor", END)

graph = builder.compile(checkpointer=checkpointer)
