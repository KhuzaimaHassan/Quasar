import os
from typing import List, Dict
from core import storage

class FilesystemError(Exception):
    pass

def safe_storage_path(workspace_id: str, user_path: str) -> str:
    """
    Validates the path to prevent directory traversal and absolute path access.
    Returns the normalized Supabase Storage key.
    """
    # Reject absolute paths or directory traversal attempts
    if user_path.startswith('/'):
        raise FilesystemError(f"Absolute paths are not allowed: {user_path}")
    if '..' in user_path.split('/'):
        raise FilesystemError(f"Directory traversal is not allowed: {user_path}")
    
    # Clean the path and remove redundant slashes, ensure forward slash for cloud storage
    clean_path = os.path.normpath(user_path).replace('\\', '/')
    
    # Just in case normpath resolves to something unexpected, double check
    if clean_path.startswith('/') or clean_path.startswith('..'):
         raise FilesystemError(f"Invalid path after normalization: {user_path}")
    
    # For list_files where path_prefix might be empty or '.'
    if clean_path == '.':
        return f"agent-sandbox/{workspace_id}"
        
    return f"agent-sandbox/{workspace_id}/{clean_path}"

def read_file(workspace_id: str, path: str) -> str:
    storage_path = safe_storage_path(workspace_id, path)
    try:
        raw_bytes = storage.download_file(storage_path)
        return raw_bytes.decode('utf-8')
    except UnicodeDecodeError:
        raise FilesystemError("Failed to decode file as UTF-8 text. Binary content is not supported.")
    except Exception as e:
        raise FilesystemError(f"Failed to read file '{path}': {str(e)}")

def write_file(workspace_id: str, path: str, content: str) -> Dict[str, str]:
    storage_path = safe_storage_path(workspace_id, path)
    try:
        storage.upload_text(storage_path, content)
        return {"status": "success", "path": path}
    except Exception as e:
        raise FilesystemError(f"Failed to write file '{path}': {str(e)}")

def list_files(workspace_id: str, path_prefix: str = '') -> List[str]:
    # We might pass an empty string for the root
    if path_prefix:
        storage_prefix = safe_storage_path(workspace_id, path_prefix)
    else:
        storage_prefix = f"agent-sandbox/{workspace_id}"
        
    try:
        raw_paths = storage.list_objects(storage_prefix)
        
        # We need to strip "agent-sandbox/{workspace_id}/" from the results
        base_len = len(f"agent-sandbox/{workspace_id}/")
        
        clean_paths = []
        for p in raw_paths:
            # list_objects returns paths prefixed with the search prefix if provided.
            # But the underlying list_objects in storage.py returns absolute paths based on prefix.
            if p.startswith(f"agent-sandbox/{workspace_id}/"):
                clean_paths.append(p[base_len:])
            elif p.startswith(f"agent-sandbox/{workspace_id}"):
                # Edge case where it might be exactly the root folder itself without slash
                pass
            else:
                # Fallback if storage.list_objects behaves differently
                clean_paths.append(p)
                
        return clean_paths
    except Exception as e:
        raise FilesystemError(f"Failed to list files: {str(e)}")

def delete_file(workspace_id: str, path: str) -> Dict[str, str]:
    storage_path = safe_storage_path(workspace_id, path)
    try:
        storage.delete_object(storage_path)
        return {"status": "success", "path": path}
    except Exception as e:
        raise FilesystemError(f"Failed to delete file '{path}': {str(e)}")
