from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any, Dict

from core.security import verify_internal_secret
import tools.github as github

router = APIRouter(prefix="/tools/github", tags=["GitHub Tool Test"])

class GitHubTestRequest(BaseModel):
    github_token: str
    action: str
    params: Dict[str, Any]

@router.post("/test", dependencies=[Depends(verify_internal_secret)])
async def test_github_tool(req: GitHubTestRequest):
    token = req.github_token
    action = req.action
    params = req.params

    try:
        if action == "list_repos":
            return github.list_repos(token)
        elif action == "get_file":
            return github.get_file(token, params["repo"], params["path"])
        elif action == "create_or_update_file":
            return github.create_or_update_file(
                token, 
                params["repo"], 
                params["path"], 
                params["content"], 
                params["message"], 
                params.get("branch", "main")
            )
        elif action == "create_issue":
            return github.create_issue(token, params["repo"], params["title"], params["body"])
        elif action == "list_open_prs":
            return github.list_open_prs(token, params["repo"])
        elif action == "create_branch":
            return github.create_branch(token, params["repo"], params["branch_name"], params.get("from_branch", "main"))
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {action}")
    except github.GitHubAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
