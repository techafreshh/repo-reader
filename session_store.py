import json
import os
import shutil
import sqlite3
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

from repo_config import RepoConfig, get_gitignore_spec


class SessionStore:
    """SQLite-backed session registry with an in-memory cache.

    Session metadata survives process restarts. The repository path is
    persisted so the ``RepoConfig`` (which holds a non-serializable
    ``pathspec.PathSpec``) can be rebuilt on first access.
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or os.getenv("SESSION_DB_PATH", "sessions.db")
        self._lock = threading.Lock()
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        with self._lock:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    root_path TEXT NOT NULL,
                    is_temp INTEGER NOT NULL DEFAULT 0,
                    temp_path TEXT,
                    history TEXT NOT NULL DEFAULT '[]',
                    created_at REAL NOT NULL
                )
                """
            )
            self._conn.commit()

    def _build_session(self, root_path: Path, is_temp: bool, temp_path: Optional[str], history: Any) -> Dict[str, Any]:
        return {
            "config": RepoConfig(root_path=root_path, gitignore_spec=get_gitignore_spec(root_path)),
            "is_temp": is_temp,
            "temp_path": Path(temp_path) if temp_path else None,
            "history": history if isinstance(history, list) else [],
        }

    def _row_to_session(self, row: sqlite3.Row) -> Dict[str, Any]:
        try:
            history = json.loads(row["history"] or "[]")
        except (json.JSONDecodeError, TypeError):
            history = []
        return self._build_session(
            Path(row["root_path"]),
            bool(row["is_temp"]),
            row["temp_path"],
            history,
        )

    def create(
        self,
        session_id: str,
        root_path: Path,
        is_temp: bool = False,
        temp_path: Optional[Path] = None,
        history: Optional[list] = None,
    ) -> Dict[str, Any]:
        session = self._build_session(
            Path(root_path),
            is_temp,
            str(temp_path) if temp_path else None,
            history or [],
        )
        with self._lock:
            self._conn.execute(
                """
                INSERT OR REPLACE INTO sessions
                    (session_id, root_path, is_temp, temp_path, history, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    str(root_path),
                    int(is_temp),
                    str(temp_path) if temp_path else None,
                    json.dumps(session["history"]),
                    time.time(),
                ),
            )
            self._conn.commit()
            self._cache[session_id] = session
        return session

    def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            if session_id in self._cache:
                return self._cache[session_id]
            row = self._conn.execute(
                "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
            ).fetchone()
            if row is None:
                return None
            session = self._row_to_session(row)
            self._cache[session_id] = session
            return session

    def pop(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
            ).fetchone()
            self._cache.pop(session_id, None)
            if row is None:
                return None
            self._conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
            self._conn.commit()
            return self._row_to_session(row)

    def update_history(self, session_id: str, history: list) -> None:
        with self._lock:
            if session_id in self._cache:
                self._cache[session_id]["history"] = history
            self._conn.execute(
                "UPDATE sessions SET history = ? WHERE session_id = ?",
                (json.dumps(history), session_id),
            )
            self._conn.commit()

    def __contains__(self, session_id: str) -> bool:
        with self._lock:
            if session_id in self._cache:
                return True
            row = self._conn.execute(
                "SELECT 1 FROM sessions WHERE session_id = ?", (session_id,)
            ).fetchone()
            return row is not None

    def cleanup_orphans(self) -> None:
        """Drop rows whose temp clone is gone and remove stale leftover clones.

        Only temp directories older than ``SESSION_ORPHAN_MAX_AGE_SECONDS``
        (default 3600) are deleted, so a concurrently running instance's fresh
        clones are never removed.
        """
        max_age = int(os.getenv("SESSION_ORPHAN_MAX_AGE_SECONDS", "3600"))
        cutoff = time.time() - max_age

        with self._lock:
            rows = self._conn.execute(
                "SELECT session_id, temp_path FROM sessions WHERE is_temp = 1"
            ).fetchall()
            live_temp_paths = set()
            stale_ids = []
            for row in rows:
                temp_path = row["temp_path"]
                if temp_path and Path(temp_path).exists():
                    live_temp_paths.add(temp_path)
                else:
                    stale_ids.append(row["session_id"])

            if stale_ids:
                self._conn.executemany(
                    "DELETE FROM sessions WHERE session_id = ?",
                    [(sid,) for sid in stale_ids],
                )
                self._conn.commit()
                for sid in stale_ids:
                    self._cache.pop(sid, None)

        temp_root = Path(tempfile.gettempdir())
        for candidate in temp_root.glob("repo_reader_*"):
            if not candidate.is_dir() or str(candidate) in live_temp_paths:
                continue
            try:
                if candidate.stat().st_mtime > cutoff:
                    continue
                shutil.rmtree(candidate)
            except OSError:
                pass


store = SessionStore()
