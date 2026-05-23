from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
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
    get_gitignore_spec, 
    clone_repo, 
    ModelMessage
)

app = FastAPI(title="Repo Reader API")

# --- CORS Middleware ---
# Allows your frontend (e.g. React/Vite on localhost:3000 or 5173) to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your specific frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Log everything about the request to find the mismatch."""
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

# --- In-Memory State ---
# In a production app, use a database and persistent storage (like Redis)
sessions: Dict[str, Dict] = {}

def get_friendly_name(target: str) -> str:
    """Get a user-friendly name from the repository target URL or path."""
    if target.startswith(("http://", "https://", "git@", "github.com")):
        # Extract repo name from URL
        parts = target.rstrip("/").split("/")
        if parts:
            name = parts[-1]
            if name.endswith(".git"):
                name = name[:-4]
            return name
    else:
        # Extract folder name
        try:
            return Path(target).name or target
        except Exception:
            return target
    return target


# --- Schemas ---

class InitializeRequest(BaseModel):
    repo_target: str  # Can be a local path or GitHub URL

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

class ChatResponse(BaseModel):
    response: str
    # we return history in a format that can be sent back
    # history: List[dict] 

def get_session(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions[session_id]

SessionDep = Annotated[Dict, Depends(get_session)]

def _initialize_session_logic(target: str, session_id: str):
    """Internal helper to setup a session from a target path/URL."""
    try:
        if target.startswith(("http://", "https://", "git@")):
            root = clone_repo(target)
            is_temp = True
        else:
            root = Path(target).resolve()
            is_temp = False

        if not root.exists() or not root.is_dir():
            raise Exception(f"Invalid repository path: {target}")

        config = RepoConfig(
            root_path=root,
            gitignore_spec=get_gitignore_spec(root)
        )

        sessions[session_id] = {
            "config": config,
            "is_temp": is_temp,
            "temp_path": root if is_temp else None,
            "history": []
        }
        return root
    except Exception as e:
        raise e

# --- Endpoints ---

@app.post("/initialize", response_model=InitializeResponse)
async def initialize_repo(request_body: Optional[InitializeRequest] = None, repo_target: Optional[str] = None):
    """Initialize a repo. Accepts target from body OR query string."""
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat", response_model=ChatResponse)
async def chat_with_repo(
    request_body: Optional[ChatRequest] = None, 
    session_id: Optional[str] = None, 
    message: Optional[str] = None
):
    """Chat with repo. Accepts data from body OR query string."""
    sid = session_id or (request_body.session_id if request_body else None)
    msg = message or (request_body.message if request_body else None)
    history = request_body.history if request_body else None

    if not sid or not msg:
        raise HTTPException(status_code=400, detail="session_id and message are required")

    session = sessions.get(sid)
    if not session:
        # Check if the message looks like a repository URL or path
        is_url = msg.startswith(("http://", "https://", "git@", "github.com"))
        is_path = os.path.isabs(msg) or (msg.startswith(".") and ("/" in msg or "\\" in msg))
        
        if is_url or is_path:
            try:
                root = _initialize_session_logic(msg, sid)
                friendly_name = get_friendly_name(msg)
                return ChatResponse(
                    response=f"✅ Repository initialized from: **{msg}**\n\nI've analyzed the codebase **{friendly_name}**. What would you like to know about it?"
                )
            except Exception as e:
                return ChatResponse(
                    response=f"❌ Failed to initialize repository: {str(e)}\n\nPlease ensure the URL or path is correct."
                )
        else:
            return ChatResponse(
                response="👋 Welcome! To get started, please **drop a repository URL** (e.g., a GitHub link) or a local directory path here."
            )

    config = session["config"]
    # If no history provided in request, use the one in session
    hist = history if history is not None else session["history"]

    try:
        # Run the agent using the async run method
        result = await agent.run(
            msg,
            deps=config,
            message_history=hist
        )

        # Update history in session
        session["history"] = result.new_messages()

        return ChatResponse(
            response=result.output
        )

    except Exception as e:
        import traceback
        print(f"Error in chat_with_repo: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/stream")
async def chat_with_repo_stream(
    request_body: Optional[ChatRequest] = None,
    session_id: Optional[str] = None,
    message: Optional[str] = None
):
    """Streaming version. Accepts data from body OR query string."""
    sid = session_id or (request_body.session_id if request_body else None)
    msg = message or (request_body.message if request_body else None)
    history = request_body.history if request_body else None

    if not sid or not msg:
        raise HTTPException(status_code=400, detail="session_id and message are required")

    session = sessions.get(sid)
    if not session:
        is_url = msg.startswith(("http://", "https://", "git@", "github.com"))
        is_path = os.path.isabs(msg) or (msg.startswith(".") and ("/" in msg or "\\" in msg))
        
        async def init_generator():
            if is_url or is_path:
                try:
                    root = _initialize_session_logic(msg, sid)
                    friendly_name = get_friendly_name(msg)
                    yield f"✅ Repository initialized from: **{msg}**\n\nI've analyzed the codebase **{friendly_name}**. What would you like to know about it?"
                except Exception as e:
                    yield f"❌ Failed to initialize repository: {str(e)}\n\nPlease ensure the URL or path is correct."
            else:
                yield "👋 Welcome! To get started, please **drop a repository URL** (e.g., a GitHub link) or a local directory path here."
        
        return StreamingResponse(init_generator(), media_type="text/event-stream")

    config = session["config"]
    hist = history if history is not None else session["history"]
    # Reset tool events for this request
    config.tool_events = []

    async def event_generator():
        try:
            # Use run_stream for real-time word generation
            async with agent.run_stream(
                msg,
                deps=config,
                message_history=hist
            ) as result:
                # Yield any tool events that accumulated during tool execution
                for event in config.tool_events:
                    yield f"__THOUGHT__:{event}\n"

                async for message in result.stream_text():
                    yield message
                
                # After stream finishes, update the session history
                session["history"] = result.new_messages()
                
        except Exception as e:
            import traceback
            print(f"Error in chat_with_repo_stream: {e}")
            traceback.print_exc()
            yield f"\n\n[Error]: {str(e)}"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/tree/{session_id}")
async def get_file_tree(session_id: str):
    """Return a nested JSON file tree for the loaded repository."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

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

if __name__ == "__main__":
    import uvicorn
    import sys
    
    # Simple port parsing from command line
    port = 7643
    if "--port" in sys.argv:
        try:
            port_idx = sys.argv.index("--port")
            port = int(sys.argv[port_idx + 1])
        except (IndexError, ValueError):
            pass
            
    uvicorn.run(app, host="0.0.0.0", port=port)
