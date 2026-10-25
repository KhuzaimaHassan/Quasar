import uuid
import json
import asyncio
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from langgraph.types import Command
from langchain_core.runnables import RunnableConfig
from langchain_core.callbacks import BaseCallbackHandler
import asyncpg  # type: ignore[import-untyped]

from core.security import verify_internal_secret
from core.db import get_db
from core.langsmith_client import get_langsmith_tracer, redact_sensitive_data
from agents.main_graph import graph
from agents.execution import execute_graph, agent_error_message, claim_run_for_resume

router = APIRouter(prefix="/agents/run", tags=["Agents Run"])


class StartRunRequest(BaseModel):
    conversation_id: str
    workspace_id: str
    task: str
    execution_target: Literal["sandbox", "github"] = "sandbox"
    target_repo: Optional[str] = None

class ResumeRunRequest(BaseModel):
    approved: bool
    github_token: Optional[str] = None

class CheckRepoAccessRequest(BaseModel):
    github_token: str
    target_repo: str

@router.post("/", dependencies=[Depends(verify_internal_secret)])
async def start_run(req: StartRunRequest, db: asyncpg.Connection = Depends(get_db)):
    import logging
    thread_id = str(uuid.uuid4())
    try:
        await db.execute(
            """
            INSERT INTO "AgentRun" (id, "conversationId", "threadId", status, "startedAt", "toolCalls", "totalTokens")
            VALUES ($1, $2, $3, $4, now(), '[]'::jsonb, 0)
            """,
            str(uuid.uuid4()), req.conversation_id, thread_id, "running"
        )
        
        tracer = get_langsmith_tracer()
        callbacks: list[BaseCallbackHandler] = [tracer] if tracer else []
        config: RunnableConfig = {
            "configurable": {"thread_id": thread_id},
            "callbacks": callbacks,
            "tags": ["agent", req.execution_target]
        }
        
        try:
            state = await execute_graph(graph, {
                "task": req.task, 
                "conversation_id": req.conversation_id, 
                "workspace_id": req.workspace_id,
                "execution_target": req.execution_target,
                "target_repo": req.target_repo
            }, config)
        except Exception as e:
            logging.error("Agent run failed thread=%s type=%s", thread_id, type(e).__name__)
            await db.execute(
                """
                UPDATE "AgentRun" SET status = 'failed', "endedAt" = now(), "errorMessage" = $2 WHERE "threadId" = $1
                """, thread_id, agent_error_message(e, thread_id)
            )
            return {"status": "failed", "error": "Agent run failed"}
            
        values = state.values
        
        if values.get("error"):
            await db.execute(
                """
                UPDATE "AgentRun" SET status = 'failed', "endedAt" = now(), "errorMessage" = $2 WHERE "threadId" = $1
                """, thread_id, str(redact_sensitive_data(values.get("error")))
            )
            return {"status": "failed", "error": "Agent run failed"}
            
        interrupts = state.tasks[0].interrupts if getattr(state, "tasks", None) else []
        if not interrupts:
            raise RuntimeError("Agent did not pause at the approval gate")
        interrupt_payload = interrupts[0].value
        
        await db.execute(
            """
            UPDATE "AgentRun" SET status = 'awaiting_approval', "pendingApproval" = $1::jsonb WHERE "threadId" = $2
            """, json.dumps(interrupt_payload), thread_id
        )
        
        return {
            "threadId": thread_id,
            "status": "awaiting_approval",
            "pendingFiles": interrupt_payload.get("pendingFiles", [])
        }
    except Exception as e:
        logging.error("Unhandled agent start failure thread=%s type=%s", thread_id, type(e).__name__)
        await db.execute(
            '''UPDATE "AgentRun" SET status = 'failed', "endedAt" = now(), "errorMessage" = $2
               WHERE "threadId" = $1''', thread_id, agent_error_message(e, thread_id)
        )
        return {"status": "failed", "error": "Agent run failed"}

@router.post("/{thread_id}/resume", dependencies=[Depends(verify_internal_secret)])
async def resume_run(thread_id: str, req: ResumeRunRequest, db: asyncpg.Connection = Depends(get_db)):
    run_record = await db.fetchrow('SELECT id, status FROM "AgentRun" WHERE "threadId" = $1', thread_id)
    if not run_record:
        raise HTTPException(status_code=404, detail="AgentRun not found")
    if run_record["status"] != "awaiting_approval":
        raise HTTPException(status_code=409, detail="Agent run is not awaiting approval")
        
    tracer = get_langsmith_tracer()
    callbacks: list[BaseCallbackHandler] = [tracer] if tracer else []
    config: RunnableConfig = {
        "configurable": {"thread_id": thread_id},
        "callbacks": callbacks,
        "tags": ["agent", "resume"]
    }
    state = await asyncio.to_thread(graph.get_state, config)
    if not state or not state.next:
        raise HTTPException(status_code=409, detail="Graph is not paused for approval")
    # Only one approval/rejection can claim the paused run, even across workers.
    claimed = await claim_run_for_resume(db, thread_id)
    if not claimed:
        raise HTTPException(status_code=409, detail="Agent run was already resumed")

    try:
        final_state = await execute_graph(graph, Command(resume={"approved": req.approved, "github_token": req.github_token}), config)
    except Exception as e:
        import logging
        logging.error("Agent resume failed thread=%s type=%s", thread_id, type(e).__name__)
        await db.execute(
            """
            UPDATE "AgentRun" SET status = 'failed', "endedAt" = now(), "pendingApproval" = NULL, "errorMessage" = $2 WHERE "threadId" = $1
            """, thread_id, agent_error_message(e, thread_id)
        )
        return {"status": "failed", "error": "Agent run failed"}
        
    values = final_state.values
    
    status = "completed"
    error_msg = None
    if values.get("error") == "Cancelled by user":
        status = "cancelled"
    elif values.get("error"):
        status = "failed"
        error_msg = str(redact_sensitive_data(values.get("error")))
        
    await db.execute(
        """
        UPDATE "AgentRun" SET status = $1, "endedAt" = now(), "pendingApproval" = NULL,
        "errorMessage" = $3, "toolCalls" = $4::jsonb WHERE "threadId" = $2
        """, status, thread_id, error_msg, json.dumps(redact_sensitive_data(values.get("tool_calls", [])))
    )
    
    return {"threadId": thread_id, "status": status}

@router.post("/check-repo-access", dependencies=[Depends(verify_internal_secret)])
async def check_repo_access(req: CheckRepoAccessRequest):
    from tools.github import check_repo_write_access
    try:
        has_access = await asyncio.to_thread(check_repo_write_access, req.github_token, req.target_repo)
        return {"has_access": has_access}
    except Exception:
        import logging
        logging.exception("Repo access check failed for %s", req.target_repo)
        return {"has_access": False, "error": "Failed to check repository access"}
