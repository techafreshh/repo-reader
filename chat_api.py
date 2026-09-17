import asyncio
from contextlib import asynccontextmanager
import json
import os
from pathlib import Path
import shutil
from typing import Dict, Optional, Annotated
import uuid

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from repo_reader import (
    agent,
    AgentState,
    StateDeps,
    initialize_session_logic,
    _resolve_safe_path,
    is_binary,
)
from repo_config import get_friendly_name, is_ignored
from sessions import sessions
from pydantic_ai.ui.ag_ui import AGUIAdapter
from rate_limiter import RateLimiter


async def _periodic_cleanup(interval_seconds: int = 3600):
    """Periodically prune stale orphaned temporary repository clones."""
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            await asyncio.to_thread(sessions.cleanup_orphans)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Warning] Background orphan cleanup failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    sessions.cleanup_orphans()
    cleanup_task = asyncio.create_task(_periodic_cleanup(3600))
    try:
        yield
    finally:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Repo Reader API", lifespan=lifespan)

# --- CORS Middleware ---
# Comma-separated list of allowed origins. Defaults to "*" for local dev.
# Credentials are only allowed when explicit origins are configured, since
# browsers reject the wildcard-with-credentials combination.
cors_origins = [o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "*").split(",") if o.strip()]
allow_all_origins = "*" in cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all_origins else cors_origins,
    allow_credentials=not allow_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "message": "Backend received an empty or invalid body."},
    )


# --- Schemas ---

class InitializeRequest(BaseModel):
    repo_target: str

class InitializeResponse(BaseModel):
    session_id: str
    message: str

def get_session(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

SessionDep = Annotated[Dict, Depends(get_session)]

# --- Rate Limiters ---
rate_limiter = RateLimiter(default_limit=20, default_window_seconds=3600, env_limit_var="MAX_MESSAGES_PER_HOUR")
repo_init_limiter = RateLimiter(default_limit=10, default_window_seconds=3600, env_limit_var="MAX_REPO_INITS_PER_HOUR")
file_view_limiter = RateLimiter(default_limit=60, default_window_seconds=3600, env_limit_var="MAX_FILE_VIEWS_PER_HOUR")

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
            detail=f"Rate limit exceeded. Maximum {repo_init_limiter.limit} repository initializations per hour."
        )

    target = repo_target or (request_body.repo_target if request_body else None)
    
    if not target:
        raise HTTPException(status_code=400, detail="repo_target is required in body or query string")
        
    session_id = str(uuid.uuid4())
    
    try:
        await asyncio.to_thread(initialize_session_logic, target, session_id)
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

    def build_tree(directory: Path) -> list:
        entries = []
        try:
            children = sorted(directory.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
        except (PermissionError, FileNotFoundError):
            return entries

        for child in children:
            if child.is_symlink() or is_ignored(child, root, spec):
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

@app.get("/file/{session_id}")
async def get_file_content(session_id: str, request: Request, path: str):
    """Return the raw text content or metadata of a file in the loaded repository."""
    client_ip = request.client.host if request.client else "unknown"
    if file_view_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Maximum {file_view_limiter.limit} file views per hour."
        )

    if not path or not path.strip():
        raise HTTPException(status_code=400, detail="Missing required 'path' query parameter")

    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    config = session["config"]
    root = config.root_path
    spec = config.gitignore_spec

    safe_path = _resolve_safe_path(root, path)
    if not safe_path or not safe_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found or outside repository: {path}")

    if safe_path.is_dir():
        raise HTTPException(status_code=400, detail=f"'{path}' is a directory, not a file")

    if is_ignored(safe_path, root, spec):
        raise HTTPException(status_code=403, detail=f"File '{path}' is ignored by .gitignore")

    rel_path = str(safe_path.relative_to(root)).replace("\\", "/")
    file_size = safe_path.stat().st_size

    if is_binary(safe_path):
        return {
            "path": rel_path,
            "name": safe_path.name,
            "content": None,
            "binary": True,
            "size": file_size,
        }

    max_file_size = int(float(os.getenv("MAX_VIEW_FILE_MB", "1.0")) * 1024 * 1024)
    if file_size > max_file_size:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum display size of {os.getenv('MAX_VIEW_FILE_MB', '1.0')}MB",
        )

    try:
        content = safe_path.read_text(encoding="utf-8", errors="replace")
        return {
            "path": rel_path,
            "name": safe_path.name,
            "content": content,
            "binary": False,
            "size": file_size,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {e}")

@app.delete("/session/{session_id}")
async def close_session(session_id: str):
    session = sessions.pop(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.get("is_temp") and session.get("temp_path"):
        temp_path = Path(session["temp_path"])
        if temp_path.exists():
            shutil.rmtree(temp_path, ignore_errors=True)
    
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
            body_json = json.loads(body)
    except Exception as e:
        print(f"[DEBUG] Error reading request body for rate limiting: {e}")

    # Extract session ID (threadId)
    session_id = body_json.get("threadId") or body_json.get("state", {}).get("session_id")

    # Check client IP rate limit
    if rate_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=429, 
            detail=f"Rate limit exceeded. Maximum {rate_limiter.limit} messages per hour."
        )

    # Check Session ID rate limit (if present)
    if session_id and rate_limiter.is_rate_limited(session_id):
        raise HTTPException(
            status_code=429, 
            detail=f"Rate limit exceeded. Maximum {rate_limiter.limit} messages per hour."
        )

    # Correlate OpenTelemetry/Langfuse traces with user session ID
    from contextlib import nullcontext
    context_manager = nullcontext()
    
    if session_id and os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY"):
        try:
            from langfuse import propagate_attributes
            context_manager = propagate_attributes(session_id=session_id)
        except Exception as e:
            print(f"[DEBUG] Failed to initialize propagate_attributes: {e}")

    with context_manager:
        return await AGUIAdapter.dispatch_request(
            request, 
            agent=agent,
            deps=StateDeps(AgentState(session_id=session_id or ""))
        )



if __name__ == "__main__":
    import uvicorn
    import sys
    import socket
    
    port = 7643
    if "--port" in sys.argv:
        try:
            port_idx = sys.argv.index("--port")
            port = int(sys.argv[port_idx + 1])
        except (IndexError, ValueError):
            pass

    host = "0.0.0.0"
    if "--host" in sys.argv:
        try:
            host_idx = sys.argv.index("--host")
            host = sys.argv[host_idx + 1]
        except IndexError:
            pass

    # Check if host is bindable. If not, fallback to 127.0.0.1 (local loopback)
    bindable = False
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind((host, port))
        bindable = True
    except Exception as e:
        print(f"[Warning] Failed to bind to {host}:{port} ({e})")
        
    if not bindable and host == "0.0.0.0":
        print(f"[Info] Attempting to fallback to 127.0.0.1 for local execution...")
        host = "127.0.0.1"
            
    uvicorn.run(app, host=host, port=port)
