import os
import re
import logging
from typing import Any, Optional
from langsmith import Client
from langchain_core.tracers.langchain import LangChainTracer

from core.config import settings

logger = logging.getLogger(__name__)

# Keys that must ALWAYS be redacted
SENSITIVE_KEY_PATTERNS = [
    r"github_token",
    r"token",
    r"api_key",
    r"apikey",
    r"secret",
    r"password",
    r"encrypted_key",
    r"encryptedkey",
    r"private_key",
    r"authorization",
]

# Keys that contain words like "token" but are safe metrics
SAFE_KEY_WHITELIST = {
    "token_count",
    "tokencount",
    "totaltokens",
    "total_tokens",
    "prompttokens",
    "prompt_tokens",
    "completiontokens",
    "completion_tokens",
}

# Regex pattern for GitHub token string values
GITHUB_TOKEN_REGEX = re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{36,255}\b")


def redact_sensitive_data(val: Any) -> Any:
    """
    Recursively traverses dictionaries, lists, and strings to replace
    sensitive secrets (especially github_token and API keys) with '[REDACTED]'.
    """
    if val is None:
        return None

    if isinstance(val, dict):
        redacted_dict = {}
        for k, v in val.items():
            k_lower = str(k).lower()
            if k_lower in SAFE_KEY_WHITELIST:
                redacted_dict[k] = v
                continue

            # If the value is a nested collection, recurse into it first
            if isinstance(v, (dict, list, tuple, set)):
                redacted_dict[k] = redact_sensitive_data(v)
                continue

            # Check if leaf key name is sensitive
            is_sensitive = any(re.search(pattern, k_lower) for pattern in SENSITIVE_KEY_PATTERNS)
            if is_sensitive:
                redacted_dict[k] = "[REDACTED]"
            else:
                redacted_dict[k] = redact_sensitive_data(v)
        return redacted_dict

    elif isinstance(val, (list, tuple, set)):
        redacted_list = [redact_sensitive_data(item) for item in val]
        if isinstance(val, tuple):
            return tuple(redacted_list)
        elif isinstance(val, set):
            return set(redacted_list)
        return redacted_list

    elif isinstance(val, str):
        # Redact raw GitHub personal access tokens or bearer tokens if found in text
        if GITHUB_TOKEN_REGEX.search(val):
            return GITHUB_TOKEN_REGEX.sub("[REDACTED]", val)
        return val

    return val


def get_langsmith_client() -> Optional[Client]:
    """
    Constructs and returns a LangSmith Client with strict input/output redaction.
    Degrades gracefully to None if tracing is disabled or unconfigured.
    """
    tracing_enabled = (
        str(os.environ.get("LANGCHAIN_TRACING_V2", "")).lower() in ("true", "1")
        or settings.LANGCHAIN_TRACING_V2
    )
    api_key = os.environ.get("LANGCHAIN_API_KEY") or settings.LANGCHAIN_API_KEY

    if not tracing_enabled or not api_key:
        return None

    try:
        client = Client(
            api_url=settings.LANGCHAIN_ENDPOINT,
            api_key=api_key,
            hide_inputs=redact_sensitive_data,
            hide_outputs=redact_sensitive_data,
            anonymizer=redact_sensitive_data,
        )
        return client
    except Exception as e:
        logger.warning(f"Failed to initialize LangSmith client: {e}. Tracing will be disabled.")
        return None


def get_langsmith_tracer(project_name: Optional[str] = None) -> Optional[LangChainTracer]:
    """
    Returns a LangChainTracer hooked to the secure, redacting LangSmith client.
    Returns None if LangSmith is disabled or unconfigured.
    """
    client = get_langsmith_client()
    if not client:
        return None

    project = project_name or os.environ.get("LANGCHAIN_PROJECT") or settings.LANGCHAIN_PROJECT
    try:
        tracer = LangChainTracer(
            project_name=project,
            client=client,
        )
        return tracer
    except Exception as e:
        logger.warning(f"Failed to initialize LangChainTracer: {e}. Proceeding without tracing.")
        return None
