"""Bound model generation recovery without replaying graph or executor work."""
from contextlib import contextmanager
from contextvars import ContextVar
import time
from typing import Any, Iterator


GENERATION_BUDGET_SECONDS = 120.0
REQUEST_TIMEOUT_MS = 60_000
RETRY_DELAY_SECONDS = 1.0
TRANSIENT_STATUSES = frozenset({500, 502, 503, 504})
_deadline: ContextVar[float | None] = ContextVar("agent_generation_deadline", default=None)


class AgentGenerationTimeout(TimeoutError):
    """The run's shared generation budget has been exhausted."""


@contextmanager
def generation_budget() -> Iterator[None]:
    token = _deadline.set(time.monotonic() + GENERATION_BUDGET_SECONDS)
    try:
        yield
    finally:
        _deadline.reset(token)


def generate_content(client: Any, *, model: str, contents: str, config: dict[str, Any]) -> Any:
    # A direct node invocation still gets a finite budget. Normal graph execution
    # supplies one deadline shared by planner, coder, reviewer and revisions.
    deadline = _deadline.get()
    if deadline is None:
        deadline = time.monotonic() + GENERATION_BUDGET_SECONDS

    for attempt in range(2):
        remaining_ms = int((deadline - time.monotonic()) * 1000)
        if remaining_ms < 1:
            raise AgentGenerationTimeout("Agent generation time budget exhausted")
        request_config = {
            **config,
            "http_options": {
                "timeout": min(REQUEST_TIMEOUT_MS, remaining_ms),
                # Avoid multiplying this recovery policy by SDK-level retries.
                "retry_options": {"attempts": 1},
            },
        }
        try:
            response = client.models.generate_content(
                model=model, contents=contents, config=request_config,
            )
        except Exception as error:
            status = getattr(error, "code", None) or getattr(error, "status_code", None)
            if attempt or status not in TRANSIENT_STATUSES:
                raise
            # Only retry this failed generation. Never replay a graph, approval,
            # storage write or GitHub commit, and never retry quota/auth errors.
            if deadline - time.monotonic() <= RETRY_DELAY_SECONDS:
                raise AgentGenerationTimeout("Agent generation time budget exhausted") from error
            time.sleep(RETRY_DELAY_SECONDS)
        else:
            if time.monotonic() >= deadline:
                raise AgentGenerationTimeout("Agent generation time budget exhausted")
            return response

    raise AssertionError("Unreachable generation retry state")
