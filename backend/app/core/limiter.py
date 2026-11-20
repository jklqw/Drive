"""Distributed rate limiting with a safe in-process fallback.

Redis is the authoritative counter store in production so limits remain
consistent across worker processes. If Redis is briefly unavailable, SlowAPI's
in-memory fallback keeps the endpoints protected instead of failing open.
"""

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def user_key(request: Request) -> str:
    """Key per authenticated principal; never trust a client-supplied user id."""
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.REDIS_URL,
    headers_enabled=False,
    swallow_errors=True,
    in_memory_fallback_enabled=True,
)
