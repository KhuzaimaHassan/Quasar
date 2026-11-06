"""Run synchronous graph work without blocking FastAPI's event loop."""
import asyncio
from typing import Any
from .generation import AgentGenerationTimeout, generation_budget


async def claim_run_for_resume(connection: Any, thread_id: str) -> bool:
    claimed = await connection.fetchval(
        '''UPDATE "AgentRun" SET status = 'running'
           WHERE "threadId" = $1 AND status = 'awaiting_approval' RETURNING id''',
        thread_id,
    )
    return claimed is not None


async def execute_graph(graph: Any, graph_input: Any, config: Any) -> Any:
    def run() -> Any:
        with generation_budget():
            for _ in graph.stream(graph_input, config):
                pass
        return graph.get_state(config)

    return await asyncio.to_thread(run)


def agent_error_message(error: Exception, thread_id: str) -> str:
    if isinstance(error, AgentGenerationTimeout):
        return f"The agent reached its generation time limit before producing approved changes. Try a smaller task. Reference: {thread_id}"
    status = getattr(error, "code", None) or getattr(error, "status_code", None)
    if status in (429, 500, 502, 503, 504):
        return f"The agent provider is temporarily unavailable ({status}). Try again later. Reference: {thread_id}"
    return f"The agent could not complete the task. Try again later. Reference: {thread_id}"
