import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


class RateLimiter:
    """Sliding-window limit per client IP, kept in memory.

    Good enough for one backend process. Behind Nginx the real client IP arrives in
    X-Forwarded-For; we wire that up when we deploy (Day 10).
    """

    def __init__(self, max_calls: int, window_seconds: int) -> None:
        self.max_calls = max_calls
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def __call__(self, request: Request) -> None:
        key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window_seconds:
            hits.popleft()
        if len(hits) >= self.max_calls:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please try again later.",
                headers={"Retry-After": str(self.window_seconds)},
            )
        hits.append(now)

    def reset(self) -> None:
        self._hits.clear()


signup_limiter = RateLimiter(max_calls=5, window_seconds=3600)
login_limiter = RateLimiter(max_calls=10, window_seconds=60)
