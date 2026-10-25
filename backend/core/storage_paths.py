import posixpath
import re
from pathlib import PureWindowsPath


class FilesystemError(Exception):
    pass


def safe_storage_path(workspace_id: str, user_path: str) -> str:
    """Keep cloud keys inside one workspace regardless of the server's OS."""
    if not workspace_id or workspace_id in (".", "..") or any(char in workspace_id for char in "/\\\x00"):
        raise FilesystemError("Invalid workspace identifier")
    normalized = user_path.replace("\\", "/")
    if normalized.startswith("/") or PureWindowsPath(user_path).drive:
        raise FilesystemError("Absolute paths are not allowed")
    if ".." in normalized.split("/") or any(ord(char) < 32 or ord(char) == 127 for char in normalized):
        raise FilesystemError("Directory traversal is not allowed")
    if re.search(r"%(?:2e|2f|5c|00|25)", normalized, re.IGNORECASE):
        raise FilesystemError("Use plain relative paths without encoded path controls")
    clean_path = posixpath.normpath(normalized)
    if clean_path.startswith("/") or clean_path.startswith(".."):
        raise FilesystemError("Invalid path after normalization")
    root = f"agent-sandbox/{workspace_id}"
    return root if clean_path == "." else f"{root}/{clean_path}"
