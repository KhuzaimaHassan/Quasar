import uuid
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from langgraph.types import Command
import asyncpg

from core.security import verify_internal_secret
from core.db import get_db
from agents.main_graph import graph

router = APIRouter(prefix="/agents/run", tags=["Agents Run"])

from typing import Optional, Literal

class StartRunRequest(BaseModel):
    conversation_id: str
    workspace_id: str
    task: str
    execution_target: Literal["sandbox", "github"] = "sandbox"
    target_repo: Optional[str] = None
    github_token: Optional[str] = None

class ResumeRunRequest(BaseModel):
    approved: bool

@router.post("/", dependencies=[Depends(verify_internal_secret)])
async def start_run(req: StartRunRequest, db: asyncpg.Connection = Depends(get_db)):
    thread_id = str(uuid.uuid4())
    
    await db.execute(
        """
        INSERT INTO "AgentRun" (id, "conversationId", "threadId", status, "startedAt", "toolCalls", "totalTokens")
        VALUES ($1, $2, $3, $4, now(), '[]'::jsonb, 0)
        """,
        str(uuid.uuid4()), req.conversation_id, thread_id, "running"
    )
    
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        for event in graph.stream({
            "task": req.task, 
            "conversation_id": req.conversation_id, 
            "workspace_id": req.workspace_id,
            "execution_target": req.execution_target,
            "target_repo": req.target_repo,
            "github_token": req.github_token
        }, config):
            pass
    except Exception as e:
        await db.execute(
            """
            UPDATE "AgentRun" SET status = 'failed', "endedAt" = now() WHERE "threadId" = $1
            """, thread_id
        )
        return {"status": "failed", "error": str(e)}
        
    state = graph.get_state(config)
    values = state.values
    
    if values.get("error"):
        await db.execute(
            """
            UPDATE "AgentRun" SET status = 'failed', "endedAt" = now() WHERE "threadId" = $1
            """, thread_id
        )
        return {"status": "failed", "error": values.get("error")}
        
    interrupts = state.tasks[0].interrupts if getattr(state, "tasks", None) else []
    interrupt_payload = interrupts[0].value if interrupts else {"msg": "Pending approval", "pendingFiles": list(values.get("generated_files", {}).keys())}
    
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

@router.post("/{thread_id}/resume", dependencies=[Depends(verify_internal_secret)])
async def resume_run(thread_id: str, req: ResumeRunRequest, db: asyncpg.Connection = Depends(get_db)):
    run_record = await db.fetchrow('SELECT id FROM "AgentRun" WHERE "threadId" = $1', thread_id)
    if not run_record:
        raise HTTPException(status_code=404, detail="AgentRun not found")
        
    config = {"configurable": {"thread_id": thread_id}}
    state = graph.get_state(config)
    
    if not state or not state.next:
        raise HTTPException(status_code=400, detail="Graph is not currently paused")
        
    try:
        for event in graph.stream(Command(resume={"approved": req.approved}), config):
            pass
    except Exception as e:
        await db.execute(
            """
            UPDATE "AgentRun" SET status = 'failed', "endedAt" = now(), "pendingApproval" = NULL WHERE "threadId" = $1
            """, thread_id
        )
        return {"status": "failed", "error": str(e)}
        
    final_state = graph.get_state(config)
    values = final_state.values
    
    status = "completed"
    if values.get("error") == "Cancelled by user":
        status = "cancelled"
    elif values.get("error"):
        status = "failed"
        
    await db.execute(
        """
        UPDATE "AgentRun" SET status = $1, "endedAt" = now(), "pendingApproval" = NULL WHERE "threadId" = $2
        """, status, thread_id
    )
    
    return values
