import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from langgraph.types import Command

from core.security import verify_internal_secret
from core.db import get_db
from agents.test_graph import graph
import asyncpg

router = APIRouter(prefix="/agents/test", tags=["Agents Test"])

class StartRequest(BaseModel):
    conversation_id: str
    task: str

class ResumeRequest(BaseModel):
    approve: bool

@router.post("/start", dependencies=[Depends(verify_internal_secret)])
async def start_graph(req: StartRequest, db: asyncpg.Connection = Depends(get_db)):
    thread_id = str(uuid.uuid4())
    
    # Create the AgentRun row to track status
    await db.execute(
        """
        INSERT INTO "AgentRun" (id, "conversationId", "threadId", status, "startedAt", "toolCalls", "totalTokens")
        VALUES ($1, $2, $3, $4, now(), '[]'::jsonb, 0)
        """,
        str(uuid.uuid4()), req.conversation_id, thread_id, "running"
    )
    
    # Configure the thread_id for LangGraph checkpointer
    config = {"configurable": {"thread_id": thread_id}}
    
    # Invoke the graph until it hits the interrupt() pause
    for event in graph.stream({"task": req.task}, config):
        pass
    
    # Fetch current state from the checkpointer
    state = graph.get_state(config)
    
    # Extract the generated response to return it to the caller
    generated_response = state.values.get("response")
    
    return {
        "threadId": thread_id,
        "status": "awaiting_approval",
        "generatedResponse": generated_response
    }

@router.post("/{thread_id}/resume", dependencies=[Depends(verify_internal_secret)])
async def resume_graph(thread_id: str, req: ResumeRequest, db: asyncpg.Connection = Depends(get_db)):
    # Ensure AgentRun exists before resuming
    run_record = await db.fetchrow(
        'SELECT id FROM "AgentRun" WHERE "threadId" = $1',
        thread_id
    )
    if not run_record:
        raise HTTPException(status_code=404, detail="AgentRun not found")
        
    config = {"configurable": {"thread_id": thread_id}}
    
    # Check if the graph actually has a pending state to resume
    state = graph.get_state(config)
    if not state or not state.next:
        raise HTTPException(status_code=400, detail="Graph is not currently paused/awaiting approval")
        
    # Resume the graph by supplying the approval boolean to the interrupt
    for event in graph.stream(Command(resume=req.approve), config):
        pass
        
    final_state = graph.get_state(config)
    
    # Update AgentRun in database
    new_status = "completed" if req.approve else "cancelled"
    await db.execute(
        """
        UPDATE "AgentRun"
        SET status = $1, "endedAt" = now()
        WHERE "threadId" = $2
        """,
        new_status, thread_id
    )
    
    return final_state.values
