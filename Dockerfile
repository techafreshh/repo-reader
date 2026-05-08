FROM python:3.13-slim

WORKDIR /app

# Install git since repo-reader might need it to clone repositories
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependencies first to leverage Docker cache
COPY pyproject.toml uv.lock ./

# Install dependencies using uv
RUN uv sync --frozen --no-dev

# Copy the rest of the application code
COPY . .

# Expose the API port
EXPOSE 7643

# Command to run the application
CMD ["uv", "run", "chat_api.py", "--port", "7643"]
