import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Optional

import pathspec
from pydantic import BaseModel, ConfigDict


class RepoConfig(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    root_path: Path
    gitignore_spec: Optional[pathspec.PathSpec] = None


def get_gitignore_spec(root_path: Path) -> pathspec.PathSpec:
    gitignore_path = root_path / ".gitignore"
    patterns = [".git/", ".venv/", "__pycache__/", "*.pyc"]
    if gitignore_path.exists():
        with open(gitignore_path, "r") as f:
            patterns.extend(f.readlines())
    return pathspec.PathSpec.from_lines("gitwildmatch", patterns)


def is_ignored(path: Path, root_path: Path, spec: Optional[pathspec.PathSpec]) -> bool:
    if spec is None:
        return False
    try:
        relative_path = path.relative_to(root_path)
        # Convert to posix style (forward slashes)
        posix_path = relative_path.as_posix()
        # If it's a directory, append a slash to match directory patterns (like .venv/)
        if path.is_dir() and not posix_path.endswith('/'):
            posix_path += '/'
        return spec.match_file(posix_path)
    except ValueError:
        return False


class GitCloneError(ValueError):
    """Raised when cloning a repository fails or times out."""
    pass


def clone_repo(url: str) -> Path:
    """Clone a GitHub repository to a temporary directory."""
    temp_dir = Path(tempfile.mkdtemp(prefix="repo_reader_"))
    git_env = {
        **os.environ,
        "GIT_TERMINAL_PROMPT": "0",
        "GIT_SSH_COMMAND": "ssh -o BatchMode=yes",
    }
    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", "--", url, str(temp_dir)],
            check=True,
            capture_output=True,
            timeout=60,
            env=git_env,
        )
        return temp_dir
    except subprocess.TimeoutExpired:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
        raise GitCloneError(f"Git clone timed out after 60 seconds for '{url}'")
    except subprocess.CalledProcessError as e:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
        err_msg = e.stderr.decode(errors="replace").strip() if e.stderr else str(e)
        raise GitCloneError(f"Git clone failed: {err_msg}")
    except Exception as e:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
        raise GitCloneError(f"Failed to clone repository: {str(e)}")


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


def verify_repo_limits(root_path: Path, gitignore_spec: Optional[Any] = None) -> None:
    """Verify that the repository does not exceed size and file count limits."""
    max_files = int(os.getenv("MAX_REPO_FILES", "200"))
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
