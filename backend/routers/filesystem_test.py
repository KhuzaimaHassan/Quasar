from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any, Dict

from core.security import verify_internal_secret
import tools.filesystem as fs

router = APIRouter(prefix="/tools/filesystem", tags=["Filesystem Tool Test"])

class FilesystemTestRequest(BaseModel):
    workspace_id: str
    action: str
    params: Dict[str, Any]

@router.post("/test", dependencies=[Depends(verify_internal_secret)])
async def test_filesystem_tool(req: FilesystemTestRequest):
    workspace_id = req.workspace_id
    action = req.action
    params = req.params

    try:
        if action == "read_file":
            return fs.read_file(workspace_id, params["path"])
        elif action == "write_file":
            return fs.write_file(workspace_id, params["path"], params["content"])
        elif action == "list_files":
            return fs.list_files(workspace_id, params.get("path_prefix", ""))
        elif action == "delete_file":
            return fs.delete_file(workspace_id, params["path"])
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {action}")
    except fs.FilesystemError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
