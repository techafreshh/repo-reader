# Product Requirements Document — Repo Reader

## 1. Overview

Repo Reader is a web application that lets a user point an AI agent at a
codebase — either a public Git URL or a local directory — and ask questions
about it. The agent explores the repository with read-only tools and streams
explanations back into a chat UI.

## 2. Problem

Understanding an unfamiliar codebase is slow. Existing chat assistants cannot
inspect a live repository, and generic "paste your code" flows break down on
real projects. Repo Reader gives the model first-class, safe read access to a
repository so it can answer structural and behavioral questions with evidence.

## 3. Goals

- Let a user load a repository by URL or local path in one step.
- Answer only repository-related questions, citing real files and symbols.
- Stream responses and tool activity so the user sees progress.
- Keep the analyzed repository isolated and bounded in size.
- Protect the API from abuse with rate limiting.
- Deploy as a secure two-container stack (hidden backend + Nginx frontend).

## 4. Non-Goals

- Editing, writing, or executing code in the target repository.
- Persisting or sharing repositories between users.
- Multi-tenant authentication and user accounts.
- Supporting private repositories that require credentials.

## 5. Users

- **Developer / reviewer**: wants a guided tour of an unfamiliar repo.
- **Operator**: self-hosts the Docker stack and configures a model/provider key.

## 6. Functional Requirements

### 6.1 Session & repository management
- `POST /initialize` accepts a `repo_target` (URL or local path) in the body or
  query string and returns a `session_id`.
- URLs are shallow-cloned (`--depth 1`) into a temp directory; local paths are
  resolved in place.
- A session can be closed via `DELETE /session/{session_id}`, which removes the
  temp clone.
- Sessions are persisted in SQLite (`SESSION_DB_PATH`) and survive process
  restarts.
- On startup, stale rows and orphaned temp clones older than
  `SESSION_ORPHAN_MAX_AGE_SECONDS` are cleaned up.

### 6.2 Agent capabilities
The agent exposes read-only tools:
| Tool | Purpose |
|---|---|
| `initialize_repo` | Load a repo mid-conversation when no session exists. |
| `list_files` | Recursively list non-ignored files. |
| `read_file` | Read a text file's contents. |
| `search_code` | Regex search across the repo. |
| `get_file_structure` | Summarize `def`/`class` lines. |
| `find_references` | Locate usages of a symbol. |
| `analyze_python_ast` | Token-efficient class/function/docstring overview for `.py`. |

- All tools respect `.gitignore`, plus `.git/`, `.venv/`, `__pycache__/`.
- Tool failures return an error string rather than raising, so the agent can
  recover.
- The system prompt restricts the agent to repository-related questions.

### 6.3 API & streaming
- `POST /agui` implements the AG-UI protocol over SSE and streams text and
  tool-call events to the client.
- `GET /tree/{session_id}` returns a nested JSON file tree for the sidebar.
- Model selection is configurable via `MODEL_NAME`
  (provider-prefixed Pydantic AI string).

### 6.4 Limits & abuse protection
- `MAX_REPO_FILES` and `MAX_REPO_SIZE_MB` reject oversized repositories with a
  `400`.
- `MAX_MESSAGES_PER_HOUR` / `RATE_LIMIT_WINDOW_SECONDS` enforce a sliding-window
  limit per client IP and per session id (HTTP `429`).
- Repository initialization has its own limit (10/hour per IP).

### 6.5 Frontend
- Chat UI with streaming assistant messages, markdown and syntax-highlighted
  code, and collapsible tool-call parameters/results.
- Sidebar file explorer that refreshes when a repository is initialized.
- Demo mode when no backend URL is configured.
- Chat history and API URL persisted in browser storage.

## 7. Non-Functional Requirements

- **Security**: backend container exposes no host ports; Nginx reverse-proxies
  `/api/` internally. CORS origins are configurable; wildcard disables
  credentials.
- **Observability**: optional Langfuse/OpenTelemetry tracing keyed by session id.
- **Portability**: Python via `uv`, frontend via npm; Docker Compose deployment.

## 8. Configuration

See `.env.example` and the configuration table in `README.md`.

## 9. Success Metrics

- Repository loads and first answer streams end-to-end.
- Sessions survive an API restart.
- Oversized repos and rate-limited clients are rejected as specified.

## 10. Open Questions

- Multi-worker deployment will require a shared session/rate-limit store
  (currently SQLite is per-process/local file).
- Private repository access and authentication are out of scope pending demand.
