# CLAUDE.md

Guidance for agents working in this repository.

## Project

Repo Reader: a FastAPI + Pydantic AI backend that explores code repositories,
with a React/Vite chat frontend ("VoltChat"). See `PRD.md` for requirements and
`README.md` for setup. `DESIGN.md` documents the frontend design system.

## Architecture

Layered backend — keep dependencies pointing downward (no cycles):

```
repo_config.py    pure repo primitives (RepoConfig, gitignore, clone, limits)
session_store.py  SQLite-backed session registry + in-memory cache
repo_reader.py    agent definition, all agent tools, session init logic, CLI
chat_api.py       FastAPI app, HTTP/AG-UI endpoints, rate limiting
rate_limiter.py   in-memory sliding-window limiter
```

- `repo_reader.py` must contain **all** `@agent.tool` registrations. Do not add
  tools from `chat_api.py`; that coupled modules and broke import order.
- `session_store.store` is the single session registry. Do not reintroduce a
  bare module-level dict. Sessions are rebuilt from persisted `root_path`.
- `RepoConfig` holds a non-serializable `pathspec.PathSpec`; only plain fields
  are written to SQLite, and the spec is rebuilt via `get_gitignore_spec`.

Frontend:

```
frontend/src/hooks/useChat.ts        core chat/streaming state (AG-UI client)
frontend/src/components/chat/*       chat UI
frontend/src/components/Sidebar.tsx  file tree + connection info
frontend/src/types/chat.ts           shared types
frontend/src/components/ui/*         shadcn/ui primitives (do not hand-edit)
```

## Commands

Backend (run from repo root):

```bash
uv sync
uv run chat_api.py --port 7643      # API server
uv run repo_reader.py <path|url>    # CLI agent
uv run test_api.py                  # integration smoke test (needs API running)
```

Frontend (run from `frontend/`):

```bash
npm install
npm run dev      # Vite dev server on :5453
npm run lint
npm run build
npm run test     # vitest
```

There is no backend pytest suite; verify imports with
`uv run python -c "import chat_api"`.

## Conventions

- Do not add comments to code unless necessary; use concise docstrings for
  non-obvious functions.
- Agent tools return plain strings and fail soft (`"Error: ..."`) instead of
  raising, so the model can recover.
- Configuration comes from environment variables. Add new keys to
  `.env.example` and the README table.
- `MODEL_NAME` selects the agent model; never hardcode a model string.
- No secrets in tracked files. `.env`, `frontend/.env`, `sessions.db`, and
  `docker-compose.override.yml` are gitignored.
- Frontend uses the `@/` path alias and shadcn/ui conventions.

## Gotchas

- Sessions are persisted by `SessionStore`; restarting the API keeps them, but
  temp clones live in `/tmp` and are pruned on startup when stale.
- `RateLimiter` is in-memory and per-process. Multi-worker deployments need a
  shared store.
- SQLite is written from both sync and async FastAPI paths; access is guarded by
  a lock. Keep new store methods inside the lock.
- CORS `allow_credentials` is only enabled when explicit origins are set; `*`
  disables credentials by design.
