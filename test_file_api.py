"""Offline tests for the GET /file/{session_id} endpoint.

Runs against a temporary fixture repository via FastAPI's TestClient — no
server, network, or real API key required:

    uv run python test_file_api.py
    # or, if pytest is installed:
    uv run pytest test_file_api.py
"""

import atexit
import os
import shutil
import tempfile
from pathlib import Path

# The agent is constructed at import time and requires a provider key;
# the value is never used by these tests.
os.environ.setdefault("OPENROUTER_API_KEY", "test-dummy-key")
# The fixture repo is a local temp directory; force local targets on in case
# the surrounding environment disables them.
os.environ["ALLOW_LOCAL_REPO_TARGETS"] = "true"
# Per-request knob: keep the viewer cap small so the oversize test needs no
# multi-megabyte fixture (the endpoint reads this at request time).
os.environ["MAX_VIEW_FILE_MB"] = "1"

from fastapi.testclient import TestClient  # noqa: E402

import chat_api  # noqa: E402
from repo_reader import initialize_session_logic  # noqa: E402

SESSION_ID = "test-file-api-session"

REPO = Path(tempfile.mkdtemp(prefix="repo_reader_file_api_test_"))
atexit.register(shutil.rmtree, REPO, ignore_errors=True)

(REPO / "ok.py").write_text("print('hello')\n")
(REPO / ".gitignore").write_text("secret/\n")
(REPO / "secret").mkdir()
(REPO / "secret" / "env").write_text("TOKEN=x\n")
(REPO / ".git").mkdir()
(REPO / ".git" / "config").write_text("[core]\n")
(REPO / "subdir").mkdir()
(REPO / "big.txt").write_text("x" * (2 * 1024 * 1024))  # 2MB > 1MB cap
(REPO / "img.bin").write_bytes(bytes([0, 1, 2, 0]))

# Symlink escape attempt (skip silently on filesystems that forbid symlinks)
SYMLINK_CREATED = True
try:
    (REPO / "link_out").symlink_to("/etc/passwd")
except OSError:
    SYMLINK_CREATED = False

initialize_session_logic(str(REPO), SESSION_ID)

client = TestClient(chat_api.app)


def get_file(path: str, session_id: str = SESSION_ID):
    return client.get(f"/file/{session_id}", params={"path": path})


def test_serves_text_file_with_content():
    resp = get_file("ok.py")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {
        "path": "ok.py",
        "name": "ok.py",
        "content": "print('hello')\n",
        "binary": False,
        "size": len("print('hello')\n"),
    }


def test_rejects_relative_path_traversal():
    assert get_file("../escaped.txt").status_code == 404


def test_rejects_absolute_path_outside_repo():
    assert get_file("/etc/passwd").status_code == 404


def test_rejects_symlink_escape():
    if not SYMLINK_CREATED:
        return
    assert get_file("link_out").status_code == 404


def test_rejects_gitignored_file():
    assert get_file("secret/env").status_code == 403


def test_rejects_git_directory():
    assert get_file(".git/config").status_code == 403


def test_rejects_directory():
    assert get_file("subdir").status_code == 400


def test_missing_file_returns_404():
    assert get_file("missing.py").status_code == 404


def test_empty_path_returns_400():
    assert get_file("").status_code == 400


def test_unknown_session_returns_404():
    assert get_file("ok.py", session_id="no-such-session").status_code == 404


def test_oversized_text_file_returns_400():
    resp = get_file("big.txt")
    assert resp.status_code == 400
    assert "maximum display size" in resp.json()["detail"]


def test_binary_file_returns_metadata_only():
    resp = get_file("img.bin")
    assert resp.status_code == 200
    body = resp.json()
    assert body["binary"] is True
    assert body["content"] is None
    assert body["size"] == 4
    assert body["name"] == "img.bin"


def test_rate_limit_returns_429_when_exhausted():
    limiter = chat_api.file_view_limiter
    original_limit = limiter.limit
    try:
        limiter.requests.clear()
        limiter.limit = 2
        codes = [get_file("ok.py").status_code for _ in range(4)]
        assert codes == [200, 200, 429, 429]
    finally:
        limiter.requests.clear()
        limiter.limit = original_limit


if __name__ == "__main__":
    import traceback

    tests = [
        (name, fn)
        for name, fn in sorted(globals().items())
        if name.startswith("test_") and callable(fn)
    ]
    failed = []
    for name, fn in tests:
        try:
            fn()
            print(f"PASS {name}")
        except Exception:
            failed.append(name)
            print(f"FAIL {name}")
            traceback.print_exc()
    print(f"\n{len(tests) - len(failed)}/{len(tests)} passed")
    raise SystemExit(1 if failed else 0)
