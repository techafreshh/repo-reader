from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, AliasGenerator
from pydantic.alias_generators import to_camel
from typing import List, Dict, Optional, Annotated, Any
import uuid
import shutil
from pathlib import Path
import os

from repo_reader import (
    agent, 
    RepoConfig, 
    AgentState,
    StateDeps,
    get_gitignore_spec, 
    clone_repo, 
    RunContext,
    is_ignored
)
from pydantic_ai.ui.ag_ui import AGUIAdapter
from sessions import sessions
from rate_limiter import RateLimiter


app = FastAPI(title="Repo Reader API")

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.body()
    print(f"\n[DEBUG] !!! Validation Error !!!")
    print(f"Method: {request.method}")
    print(f"URL: {request.url}")
    print(f"Headers: {dict(request.headers)}")
    print(f"Query Params: {dict(request.query_params)}")
    print(f"Raw Body: '{body.decode()}'")
    print(f"Errors: {exc.errors()}\n")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": body.decode(), "message": "Backend received an empty or invalid body."},
    )

def get_friendly_name(target: str) -> str:
    """Get a user-friendly name from the repository target URL or path."""
    if target.startswith(("http://", "https://", "git@", "github.com")):
        parts = target.rstrip("/").split("/")
        if parts:
            name = parts[-1]
            if name.endswith(".git"):
                name = name[:-4]
            return name
    else:
        try:
            return Path(target).name or target
        except Exception:
            return target
    return target


# --- Schemas ---

class InitializeRequest(BaseModel):
    repo_target: str

class InitializeResponse(BaseModel):
    session_id: str
    message: str

class ChatRequest(BaseModel):
    model_config = ConfigDict(
        alias_generator=AliasGenerator(
            validation_alias=to_camel,
        ),
        populate_by_name=True,
    )
    session_id: str
    message: str
    history: Optional[List[Any]] = None

def get_session(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions[session_id]

SessionDep = Annotated[Dict, Depends(get_session)]

def verify_repo_limits(root_path: Path, gitignore_spec: Optional[Any] = None) -> None:
    """Verify that the repository does not exceed size and file count limits."""
    max_files = int(os.getenv("MAX_REPO_FILES", "100"))
    max_size_mb = float(os.getenv("MAX_REPO_SIZE_MB", "50.0"))
    max_size_bytes = int(max_size_mb * 1024 * 1024)

    file_count = 0
    total_size = 0

    for root, dirs, files in os.walk(root_path):
        if gitignore_spec:
            dirs[:] = [d for d in dirs if not is_ignored(Path(root) / d, root_path, gitignore_spec)]

        for file in files:
            path = Path(root) / file
            if gitignore_spec and is_ignored(path, root_path, gitignore_spec):
                continue
            
            file_count += 1
            if file_count > max_files:
                raise ValueError(
                    f"Repository exceeds the limit of {max_files} files. "
                    "Please choose a smaller repository."
                )

            try:
                total_size += path.stat().st_size
                if total_size > max_size_bytes:
                    raise ValueError(
                        f"Repository exceeds the limit of {max_size_mb}MB total size. "
                        "Please choose a smaller repository."
                    )
            except OSError:
                pass

def _initialize_session_logic(target: str, session_id: str):
    """Internal helper to setup a session from a target path/URL."""
    root = None
    is_temp = False
    try:
        if target.startswith(("http://", "https://", "git@")):
            root = clone_repo(target)
            is_temp = True
        else:
            root = Path(target).resolve()
            is_temp = False

        if not root.exists() or not root.is_dir():
            raise Exception(f"Invalid repository path: {target}")

        gitignore_spec = get_gitignore_spec(root)
        verify_repo_limits(root, gitignore_spec)

        config = RepoConfig(
            root_path=root,
            gitignore_spec=gitignore_spec
        )

        sessions[session_id] = {
            "config": config,
            "is_temp": is_temp,
            "temp_path": root if is_temp else None,
            "history": []
        }
        return root
    except Exception as e:
        if is_temp and root and root.exists():
            try:
                shutil.rmtree(root)
            except Exception:
                pass
        raise e


# --- AG-UI Tool: initialize_repo ---

@agent.tool
async def initialize_repo(ctx: RunContext[StateDeps[AgentState]], repo_target: str) -> str:
    """Initialize a repository from a URL or local path when no session exists yet."""
    session_id = ctx.deps.state.session_id
    try:
        root = _initialize_session_logic(repo_target, session_id)
        friendly_name = get_friendly_name(repo_target)
        return f"Repository '{friendly_name}' initialized. You can now explore the codebase."
    except Exception as e:
        return f"Failed to initialize repository: {str(e)}"

# --- Rate Limiters ---
rate_limiter = RateLimiter(default_limit=20, default_window_seconds=3600)
repo_init_limiter = RateLimiter(default_limit=10, default_window_seconds=3600)

# --- Endpoints ---

@app.post("/initialize", response_model=InitializeResponse)
async def initialize_repo_endpoint(
    request: Request,
    request_body: Optional[InitializeRequest] = None, 
    repo_target: Optional[str] = None
):
    """Initialize a repo. Accepts target from body OR query string."""
    client_ip = request.client.host if request.client else "unknown"
    if repo_init_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Maximum 10 repository initializations per hour."
        )

    target = repo_target or (request_body.repo_target if request_body else None)
    
    if not target:
        raise HTTPException(status_code=400, detail="repo_target is required in body or query string")
        
    session_id = str(uuid.uuid4())
    
    try:
        root = _initialize_session_logic(target, session_id)
        friendly_name = get_friendly_name(target)
        return InitializeResponse(
            session_id=session_id,
            message=f"Repository '{friendly_name}' initialized successfully."
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tree/{session_id}")
async def get_file_tree(session_id: str):
    """Return a nested JSON file tree for the loaded repository."""
    session = sessions.get(session_id)
    if not session:
        return {"tree": [], "initialized": False}

    config = session["config"]
    root = config.root_path
    spec = config.gitignore_spec

    from repo_reader import is_ignored

    def build_tree(directory: Path) -> list:
        entries = []
        try:
            children = sorted(directory.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
        except PermissionError:
            return entries

        for child in children:
            if is_ignored(child, root, spec):
                continue
            rel_path = str(child.relative_to(root)).replace("\\", "/")
            if child.is_dir():
                subtree = build_tree(child)
                entries.append({
                    "name": child.name,
                    "type": "directory",
                    "path": rel_path,
                    "children": subtree,
                })
            else:
                entries.append({
                    "name": child.name,
                    "type": "file",
                    "path": rel_path,
                })
        return entries

    tree = build_tree(root)
    return {"tree": tree}

@app.delete("/session/{session_id}")
async def close_session(session_id: str):
    session = sessions.pop(session_id, None)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["is_temp"] and session["temp_path"]:
        shutil.rmtree(session["temp_path"])
    
    return {"message": "Session closed and temporary files cleaned up"}

# --- Mount AG-UI endpoint ---

@app.post("/agui")
async def agui_endpoint(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    
    # Read body safely to check rate limits
    body_json = {}
    try:
        body = await request.body()
        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}
        request._receive = receive
        if body:
            import json
            body_json = json.loads(body)
    except Exception as e:
        print(f"[DEBUG] Error reading request body for rate limiting: {e}")

    # Extract session ID (threadId)
    session_id = body_json.get("threadId") or body_json.get("state", {}).get("session_id")

    # Check client IP rate limit
    if rate_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=429, 
            detail="Rate limit exceeded. Maximum 20 messages per hour."
        )

    # Check Session ID rate limit (if present)
    if session_id and rate_limiter.is_rate_limited(session_id):
        raise HTTPException(
            status_code=429, 
            detail="Rate limit exceeded. Maximum 20 messages per hour."
        )

    return await AGUIAdapter.dispatch_request(
        request, 
        agent=agent,
        deps=StateDeps(AgentState())
    )


if __name__ == "__main__":
    import uvicorn
    import sys
    
    port = 7643
    if "--port" in sys.argv:
        try:
            port_idx = sys.argv.index("--port")
            port = int(sys.argv[port_idx + 1])
        except (IndexError, ValueError):
            pass
            
    uvicorn.run(app, host="0.0.0.0", port=port)
