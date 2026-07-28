import base64
import httpx

class GitHubAPIError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"GitHub API Error {status_code}: {message}")

def _handle_response_errors(response: httpx.Response):
    if response.status_code >= 400:
        error_msg = response.text
        try:
            error_msg = response.json().get("message", response.text)
        except Exception:
            pass
        
        if response.status_code == 401:
            raise GitHubAPIError(401, f"Unauthorized / Bad Token: {error_msg}")
        elif response.status_code == 403:
            raise GitHubAPIError(403, f"Forbidden / Rate Limit or Scopes missing: {error_msg}")
        elif response.status_code == 404:
            raise GitHubAPIError(404, f"Not Found: {error_msg}")
        else:
            raise GitHubAPIError(response.status_code, error_msg)

def _get_client(token: str) -> httpx.Client:
    return httpx.Client(
        base_url="https://api.github.com",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28"
        },
        timeout=10.0
    )

def list_repos(token: str) -> list[str]:
    with _get_client(token) as client:
        response = client.get("/user/repos?per_page=100&sort=updated")
        _handle_response_errors(response)
        repos = response.json()
        return [repo["full_name"] for repo in repos]

def get_file(token: str, repo: str, path: str) -> str:
    with _get_client(token) as client:
        response = client.get(f"/repos/{repo}/contents/{path}")
        _handle_response_errors(response)
        data = response.json()
        
        if type(data) is list:
            raise GitHubAPIError(400, "Path points to a directory, not a file.")
            
        content_b64 = data.get("content", "")
        return base64.b64decode(content_b64).decode("utf-8")

def create_or_update_file(token: str, repo: str, path: str, content: str, message: str, branch: str = "main") -> dict:
    with _get_client(token) as client:
        # Check if file exists to get its SHA
        sha = None
        check_resp = client.get(f"/repos/{repo}/contents/{path}?ref={branch}")
        if check_resp.status_code == 200:
            sha = check_resp.json().get("sha")
        elif check_resp.status_code != 404:
            _handle_response_errors(check_resp)
            
        payload = {
            "message": message,
            "content": base64.b64encode(content.encode("utf-8")).decode("utf-8"),
            "branch": branch
        }
        if sha:
            payload["sha"] = sha
            
        response = client.put(f"/repos/{repo}/contents/{path}", json=payload)
        _handle_response_errors(response)
        return response.json()

def create_issue(token: str, repo: str, title: str, body: str) -> str:
    with _get_client(token) as client:
        payload = {"title": title, "body": body}
        response = client.post(f"/repos/{repo}/issues", json=payload)
        _handle_response_errors(response)
        return response.json().get("html_url")

def list_open_prs(token: str, repo: str) -> list[dict]:
    with _get_client(token) as client:
        response = client.get(f"/repos/{repo}/pulls?state=open")
        _handle_response_errors(response)
        prs = response.json()
        return [{"number": pr["number"], "title": pr["title"], "url": pr["html_url"]} for pr in prs]

def create_branch(token: str, repo: str, branch_name: str, from_branch: str = "main") -> dict:
    with _get_client(token) as client:
        # Get SHA of base branch
        ref_resp = client.get(f"/repos/{repo}/git/ref/heads/{from_branch}")
        _handle_response_errors(ref_resp)
        sha = ref_resp.json()["object"]["sha"]
        
        # Create new branch
        payload = {
            "ref": f"refs/heads/{branch_name}",
            "sha": sha
        }
        create_resp = client.post(f"/repos/{repo}/git/refs", json=payload)
        _handle_response_errors(create_resp)
        return create_resp.json()
