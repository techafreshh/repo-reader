from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Request
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
    AgentState,
    StateDeps,
    initialize_session_logic,
)
from repo_config import get_friendly_name, is_ignored
from session_store import store
from pydantic_ai.ui.ag_ui import AGUIAdapter
from rate_limiter import RateLimiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.cleanup_orphans()
    yield


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
    if session_id not in store:
        raise HTTPException(status_code=404, detail="Session not found")
    return store.get(session_id)

SessionDep = Annotated[Dict, Depends(get_session)]

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
        initialize_session_logic(target, session_id)
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
    session = store.get(session_id)
    if not session:
        return {"tree": [], "initialized": False}

    config = session["config"]
    root = config.root_path
    spec = config.gitignore_spec

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
    session = store.pop(session_id)
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
            deps=StateDeps(AgentState())
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
