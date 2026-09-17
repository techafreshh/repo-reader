import os
import shutil
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional


class SessionRegistry:
    """In-memory registry of active sessions.

    A session holds exactly one fact: which repository is loaded. Chat
    history and the session id live in the browser, so sessions are not
    persisted; after a restart clients simply re-initialize.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._sessions: Dict[str, Dict[str, Any]] = {}

    def create(
        self,
        session_id: str,
        *,
        config: Any,
        is_temp: bool,
        temp_path: Optional[Path] = None,
    ) -> Dict[str, Any]:
        """Register a session, replacing any existing entry for the same id."""
        with self._lock:
            existing = self._sessions.pop(session_id, None)
            session = {"config": config, "is_temp": is_temp, "temp_path": temp_path}
            self._sessions[session_id] = session
        if existing and existing.get("is_temp") and existing.get("temp_path"):
            shutil.rmtree(existing["temp_path"], ignore_errors=True)
        return session

    def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._sessions.get(session_id)

    def pop(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._sessions.pop(session_id, None)

    def __contains__(self, session_id: str) -> bool:
        with self._lock:
            return session_id in self._sessions

    def cleanup_orphans(self) -> None:
        """Drop stale sessions and delete leftover temporary clones.

        Sessions whose temp clone has disappeared are removed from the
        registry. Any ``repo_reader_*`` directory in the temp folder that is
        not registered as live and is older than
        ``SESSION_ORPHAN_MAX_AGE_SECONDS`` (default 3600) is deleted, e.g.
        leftovers from crashed processes.
        """
        max_age = int(os.getenv("SESSION_ORPHAN_MAX_AGE_SECONDS", "3600"))
        cutoff = time.time() - max_age

        with self._lock:
            items = list(self._sessions.items())

        vanished_ids = []
        live_paths = set()
        for sid, session in items:
            temp_path = session.get("temp_path") if session.get("is_temp") else None
            if not temp_path:
                continue
            if Path(temp_path).exists():
                live_paths.add(str(Path(temp_path).resolve()))
            else:
                vanished_ids.append(sid)

        if vanished_ids:
            with self._lock:
                for sid in vanished_ids:
                    self._sessions.pop(sid, None)

        for candidate in Path(tempfile.gettempdir()).glob("repo_reader_*"):
            if not candidate.is_dir():
                continue
            try:
                if str(candidate.resolve()) in live_paths:
                    continue
                if candidate.stat().st_mtime > cutoff:
                    continue
                shutil.rmtree(candidate, ignore_errors=True)
            except OSError:
                pass


sessions = SessionRegistry()
