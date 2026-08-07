import os
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool
from langgraph.types import interrupt, Command
from google import genai

from core.config import settings

class AgentState(TypedDict, total=False):
    task: str
    response: str
    approved: bool
    confirmation: str

client = genai.Client(api_key=settings.GOOGLE_API_KEY)

# Initialize the Postgres connection pool with autocommit as required by PostgresSaver
# psycopg3 does not support pgbouncer=true query parameter, so we strip it.
db_url = settings.DATABASE_URL.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")
# Also, we must disable prepared statements for pgbouncer (prepare_threshold=None)
pool = ConnectionPool(conninfo=db_url, kwargs={'autocommit': True, 'prepare_threshold': None})
checkpointer = PostgresSaver(pool)  # type: ignore
checkpointer.setup()

def generate(state: AgentState):
    task = state["task"]
    # Generate a short response
    response = client.models.generate_content(
        model='gemini-3.5-flash',
        contents=f"Respond concisely to the following task:\n\n{task}"
    )
    return {"response": response.text}

def await_approval(state: AgentState):
    # Call interrupt() to pause the graph here.
    # The value passed to Command(resume=...) will be returned by this interrupt call.
    is_approved = interrupt({"msg": "Please approve", "response": state.get("response")})

    if not is_approved:
        # If the user rejects, go straight to END (do not proceed to finalize)
        return Command(goto=END)

    return Command(goto="finalize")

def finalize(state: AgentState):
    # Only reached after resuming with approve=True
    return {"approved": True, "confirmation": "Finalized successfully!"}

# Wire up the graph
builder = StateGraph(AgentState)
builder.add_node("generate", generate)
builder.add_node("await_approval", await_approval)
builder.add_node("finalize", finalize)

builder.add_edge(START, "generate")
builder.add_edge("generate", "await_approval")
# Dynamic routing via Command in await_approval replaces the static edge
builder.add_edge("finalize", END)

# Compile with the PostgresSaver checkpointer
graph = builder.compile(checkpointer=checkpointer)
