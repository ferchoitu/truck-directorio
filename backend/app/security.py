import hmac
import threading
import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException, Response, status

from app.config import get_settings

_attempts: dict[str, deque[float]] = defaultdict(deque)
_attempts_lock = threading.Lock()
_WINDOW_SECONDS = 60


def require_scraping_api_key(x_api_key: str = Header(default="")) -> str:
    """Fail closed unless the operator API key is configured and valid."""
    configured_key = get_settings().scraping_api_key
    if not configured_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scraping API is not configured",
        )
    if not hmac.compare_digest(x_api_key, configured_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    return x_api_key


def limit_scraping_starts(
    response: Response,
    api_key: str = Header(default="", alias="X-API-Key"),
) -> None:
    """Small in-process safety limit; API-key auth remains the primary control."""
    limit = get_settings().scraping_start_rate_limit_per_minute
    if limit < 1:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scraping rate limit is not configured",
        )

    now = time.monotonic()
    with _attempts_lock:
        attempts = _attempts[api_key]
        while attempts and now - attempts[0] >= _WINDOW_SECONDS:
            attempts.popleft()
        if len(attempts) >= limit:
            retry_after = max(1, int(_WINDOW_SECONDS - (now - attempts[0])) + 1)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Scraping start rate limit exceeded",
                headers={"Retry-After": str(retry_after)},
            )
        attempts.append(now)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(limit - len(attempts))


def reset_scraping_rate_limiter() -> None:
    """Test helper."""
    with _attempts_lock:
        _attempts.clear()
