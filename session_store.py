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
        db_file = Path(self.db_path)
        if db_file.parent and str(db_file.parent) != ".":
            db_file.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("PRAGMA busy_timeout=5000;")
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
                    created_at REAL NOT NULL,
                    last_accessed_at REAL
                )
                """
            )
            # Migrate existing tables missing last_accessed_at column
            columns = [col[1] for col in self._conn.execute("PRAGMA table_info(sessions)").fetchall()]
            if "last_accessed_at" not in columns:
                self._conn.execute("ALTER TABLE sessions ADD COLUMN last_accessed_at REAL")
                self._conn.execute("UPDATE sessions SET last_accessed_at = created_at WHERE last_accessed_at IS NULL")
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
        existing = self.get(session_id)
        if existing and existing.get("is_temp") and existing.get("temp_path"):
            old_temp = Path(existing["temp_path"])
            if old_temp.exists():
                try:
                    shutil.rmtree(old_temp, ignore_errors=True)
                except OSError:
                    pass

        session = self._build_session(
            Path(root_path),
            is_temp,
            str(temp_path) if temp_path else None,
            history or [],
        )
        now = time.time()
        with self._lock:
            self._conn.execute(
                """
                INSERT OR REPLACE INTO sessions
                    (session_id, root_path, is_temp, temp_path, history, created_at, last_accessed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    str(root_path),
                    int(is_temp),
                    str(temp_path) if temp_path else None,
                    json.dumps(session["history"]),
                    now,
                    now,
                ),
            )
            self._conn.commit()
            self._cache[session_id] = session
        return session

    def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        now = time.time()
        with self._lock:
            session = self._cache.get(session_id)
            if session is None:
                row = self._conn.execute(
                    "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
                ).fetchone()
                if row is None:
                    return None
                session = self._row_to_session(row)
                self._cache[session_id] = session

            self._conn.execute(
                "UPDATE sessions SET last_accessed_at = ? WHERE session_id = ?",
                (now, session_id),
            )
            self._conn.commit()
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
        now = time.time()
        with self._lock:
            if session_id in self._cache:
                self._cache[session_id]["history"] = history
            self._conn.execute(
                "UPDATE sessions SET history = ?, last_accessed_at = ? WHERE session_id = ?",
                (json.dumps(history), now, session_id),
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
        (default 3600) based on last activity are deleted, so actively used
        sessions are never removed.
        """
        max_age = int(os.getenv("SESSION_ORPHAN_MAX_AGE_SECONDS", "3600"))
        cutoff = time.time() - max_age

        with self._lock:
            rows = self._conn.execute(
                "SELECT session_id, temp_path, created_at, last_accessed_at FROM sessions WHERE is_temp = 1"
            ).fetchall()
            live_temp_paths = set()
            stale_ids = []
            for row in rows:
                temp_path = row["temp_path"]
                activity_time = row["last_accessed_at"] if row["last_accessed_at"] is not None else row["created_at"]
                if not temp_path or not Path(temp_path).exists():
                    stale_ids.append(row["session_id"])
                elif activity_time < cutoff:
                    stale_ids.append(row["session_id"])
                    try:
                        shutil.rmtree(temp_path, ignore_errors=True)
                    except OSError:
                        pass
                else:
                    live_temp_paths.add(str(Path(temp_path).resolve()))

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
            if not candidate.is_dir():
                continue
            try:
                candidate_resolved = str(candidate.resolve())
                if candidate_resolved in live_temp_paths:
                    continue
                if candidate.stat().st_mtime > cutoff:
                    continue
                shutil.rmtree(candidate, ignore_errors=True)
            except OSError:
                pass

    def close(self) -> None:
        with self._lock:
            self._cache.clear()
            try:
                self._conn.close()
            except Exception:
                pass


store = SessionStore()
