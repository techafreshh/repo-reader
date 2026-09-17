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
sessions.py       in-memory session registry + temp-clone orphan sweep
repo_reader.py    agent definition, all agent tools, session init logic, CLI
chat_api.py       FastAPI app, HTTP/AG-UI endpoints, rate limiting
rate_limiter.py   in-memory sliding-window limiter
```

- `repo_reader.py` must contain **all** `@agent.tool` registrations. Do not add
  tools from `chat_api.py`; that coupled modules and broke import order.
- `sessions.sessions` is the single session registry. Do not reintroduce a
  bare module-level dict. Sessions are in-memory per process; after a
  restart clients re-initialize (chat history lives in the browser).

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
- No secrets in tracked files. `.env`, `frontend/.env`, and
  `docker-compose.override.yml` are gitignored.
- Frontend uses the `@/` path alias and shadcn/ui conventions.

## Gotchas

- Sessions are in-memory only; restarting the API clears them and users
  re-initialize by sending the repo URL again. Leftover temp clones are
  pruned on startup and periodically every hour in the background.
- `ALLOW_LOCAL_REPO_TARGETS` guards local filesystem paths; disable it in
  production to restrict analysis to remote Git repositories.
- `RateLimiter` is in-memory and per-process. Multi-worker deployments need a
  shared store.
- `SessionRegistry` is touched from both sync and async FastAPI paths; access
  is guarded by a lock. Keep new registry methods inside the lock, and do
  filesystem work (rmtree) outside it.
- CORS `allow_credentials` is only enabled when explicit origins are set; `*`
  disables credentials by design.
