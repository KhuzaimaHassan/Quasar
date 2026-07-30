from typing import TypedDict, Optional
import logging
from google import genai

from core.config import settings
from .schemas import PlanOutput, CodeOutput, ReviewOutput
from langgraph.types import Command
from langgraph.graph import END

logger = logging.getLogger(__name__)

class AgentState(TypedDict, total=False):
    task: str
    conversation_id: str
    workspace_id: str
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
    
    plan_output: PlanOutput = response.parsed
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
    
    code_output: CodeOutput = response.parsed
    
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
    
    review_output: ReviewOutput = response.parsed
    
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
            goto="human_approval",
            update={
                "review_notes": notes
            }
        )

from langgraph.types import interrupt
import tools.filesystem as fs
from langgraph.graph import StateGraph, START
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool

def human_approval(state: AgentState):
    generated_files = state.get("generated_files", {})
    summary = "The following files will be written:\n\n"
    for path, content in generated_files.items():
        summary += f"--- {path} ---\n{content}\n\n"
        
    is_approved = interrupt({"msg": summary, "pendingFiles": list(generated_files.keys())})
    
    if isinstance(is_approved, dict):
        approved = is_approved.get("approved", False)
    else:
        approved = bool(is_approved)

    if not approved:
        return Command(
            goto=END,
            update={"error": "Cancelled by user"}
        )
        
    return Command(goto="executor")

def executor(state: AgentState):
    workspace_id = state.get("workspace_id")
    generated_files = state.get("generated_files", {})
    tool_calls = state.get("tool_calls", []) or []
    
    updated_tool_calls = list(tool_calls)
    
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
checkpointer = PostgresSaver(pool)
checkpointer.setup()

builder = StateGraph(AgentState)
builder.add_node("planner", planner)
builder.add_node("coder", coder)
builder.add_node("reviewer", reviewer)
builder.add_node("human_approval", human_approval)
builder.add_node("executor", executor)

builder.add_edge(START, "planner")
builder.add_edge("planner", "coder")
builder.add_edge("coder", "reviewer")
builder.add_edge("executor", END)

graph = builder.compile(checkpointer=checkpointer)
