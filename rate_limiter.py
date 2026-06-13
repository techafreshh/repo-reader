import time
import os
import threading
from collections import defaultdict
from typing import Dict, List

class RateLimiter:
    def __init__(self, default_limit: int = 20, default_window_seconds: int = 3600):
        self._lock = threading.Lock()
        
        # Read from environment variables if present, fallback to defaults
        env_limit = os.getenv("MAX_MESSAGES_PER_HOUR")
        self.limit = int(env_limit) if env_limit else default_limit
        
        env_window = os.getenv("RATE_LIMIT_WINDOW_SECONDS")
        self.window_seconds = int(env_window) if env_window else default_window_seconds
        
        # Dictionary mapping key (IP or Session ID) -> List of timestamps
        self.requests: Dict[str, List[float]] = defaultdict(list)

    def is_rate_limited(self, key: str) -> bool:
        """
        Check if the request limit for the given key is exceeded.
        If not rate limited, logs the current request timestamp.
        
        Returns True if rate limited, False if allowed.
        """
        if not key:
            return False
            
        now = time.time()
        cutoff = now - self.window_seconds
        
        with self._lock:
            # Filter out timestamps older than the cutoff window
            self.requests[key] = [t for t in self.requests[key] if t > cutoff]
            
            # Check if limit exceeded
            if len(self.requests[key]) >= self.limit:
                return True
                
            # Log current request
            self.requests[key].append(now)
            return False

    def remaining_requests(self, key: str) -> int:
        """
        Returns the number of remaining requests allowed for the given key.
        """
        if not key:
            return self.limit
            
        now = time.time()
        cutoff = now - self.window_seconds
        
        with self._lock:
            active_requests = [t for t in self.requests[key] if t > cutoff]
            return max(0, self.limit - len(active_requests))
