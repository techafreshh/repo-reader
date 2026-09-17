# Repo Reader & AI Agents 🤖

A powerful suite of AI agents built with **Pydantic AI** and **FastAPI**, designed to explore, analyze, and explain codebases—whether they are local directories or live GitHub repositories.

## 🚀 Features

### 1. Repo Reader Agent (`repo_reader.py`)
A deep-analysis agent that can navigate repositories, search for logic, and explain code.
*   **Git-Aware**: Respects `.gitignore` and `.git` folders.
*   **GitHub Integration**: Clone and analyze any live public repository by pasting its URL.
*   **Tool-Rich**:
    *   `list_files`: Discover the codebase structure.
    *   `read_file`: Deep dive into source code.
    *   `search_code`: Regex-based grep across the repo.
    *   `get_file_structure`: Instant summaries of classes and functions.
    *   `find_references`: Trace how symbols are used across the project.

### 2. FastAPI Chat API (`chat_api.py`)
Expose the Repo Reader as a production-ready REST API.
*   **Session-Based Chat**: Maintains conversation history for continuous context. Sessions live in memory per process — after a restart, re-send the repo URL (your chat history stays in the browser).
*   **Async/Await**: High-performance asynchronous execution.
*   **Auto-Cleanup**: Temporary cloned repositories are wiped when the session is closed.

### 3. Dice Agent (`dice_agent.py`)
A minimal, conversational demonstration of tool-calling and the Pydantic AI framework.

---

## 🛠️ Setup & Installation

This project uses `uv` for lightning-fast dependency management.

1.  **Clone the project** (or create a new folder).
2.  **Install dependencies**:
    ```bash
    uv sync
    ```
3.  **Configure environment**:
    Create a `.env` file in the root and add your OpenRouter or OpenAI API key:
    ```env
    OPENROUTER_API_KEY=your_key_here
    ```

### Configuration

All settings are read from environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | — | API key for the model provider. |
| `MODEL_NAME` | `openrouter:deepseek/deepseek-v4-flash` | Provider-prefixed Pydantic AI model string for the repo reader agent. |
| `SESSION_ORPHAN_MAX_AGE_SECONDS` | `3600` | Age after which untracked temp repo clones are removed (on startup, then hourly). |
| `CORS_ALLOW_ORIGINS` | `*` | Comma-separated allowed origins. When `*`, credentials are disabled. |
| `ALLOW_LOCAL_REPO_TARGETS` | `true` | Allow initializing local filesystem paths. Set to `false` in production. |
| `MAX_MESSAGES_PER_HOUR` | `20` | Per-IP/per-session chat rate limit. |
| `MAX_REPO_INITS_PER_HOUR` | `10` | Per-IP repository initialization rate limit. |
| `RATE_LIMIT_WINDOW_SECONDS` | `3600` | Rate limit window. |
| `MAX_REPO_FILES` | `200` | Maximum files in an analyzed repository. |
| `MAX_REPO_SIZE_MB` | `50.0` | Maximum total repository size. |
| `LANGFUSE_*` | — | Optional Langfuse observability keys. |

---

## 📖 Usage

### Running the CLI Repo Reader
```bash
uv run repo_reader.py
```
*Input a local path or a GitHub URL (e.g., `https://github.com/pydantic/pydantic-ai`).*

### Running the FastAPI Server
```bash
uv run chat_api.py --port 7643
```
The server will start at `http://localhost:7643`. You can explore the interactive API docs at `/docs`.

### Running the Dice Agent
```bash
uv run dice_agent.py
```

---

## 🐳 Deployment (Docker & VPS)

This project includes a production-ready `docker-compose.yml` that serves both the **React Frontend (VoltChat)** and the **FastAPI Backend** securely on a VPS.

**Secure Architecture**:
- The **backend API** is completely hidden from the internet. It runs only on a private Docker network and exposes no ports to the host.
- The **frontend container** uses **Nginx** to serve the web app on port `80`.
- Nginx automatically acts as a reverse proxy, taking requests to `/api/` and securely forwarding them to the hidden backend.

### Deploying to a Server:
1. Clone the project to your VPS.
2. Ensure you have created a `.env` file in the root directory with your API keys (e.g., `OPENROUTER_API_KEY`).
3. Build and launch the containers:
   ```bash
   docker compose up -d --build
   ```
4. Your chat app is now live and accessible on your server's IP address or domain on port 80!

---

## 🧪 Testing the API

We've included a test script to verify the API functionality:
```bash
uv run python test_api.py
```

## 🏗️ Tech Stack

*   **Framework**: [Pydantic AI](https://github.com/pydantic/pydantic-ai)
*   **API**: [FastAPI](https://fastapi.tiangolo.com/)
*   **Terminal UI**: [Rich](https://github.com/Textualize/rich)
*   **Dependency Management**: [uv](https://github.com/astral-sh/uv)
*   **Models**: Supports OpenRouter, OpenAI, and more via standard provider prefixes.

---

## 📄 License
MIT
