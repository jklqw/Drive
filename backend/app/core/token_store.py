"""Refresh/access token revocation with Redis primary and in-process fallback.

Production deployments use Redis so that revocation is shared across workers.
The local fallback keeps development and the test suite functional when Redis
is not running; it is never used to weaken any authorization decision.
"""

import asyncio
import time

from redis import asyncio as aioredis

from app.core.config import settings


class TokenRevocationStore:
    def __init__(self) -> None:
        self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        self._memory: dict[str, float] = {}
        self._use_redis = True

    async def revoke(self, jti: str, ttl_seconds: int) -> None:
        expires_at = time.time() + max(int(ttl_seconds), 1)
        self._memory[jti] = expires_at
        if self._use_redis:
            try:
                await asyncio.wait_for(self._redis.setex(f"sfmp:revoked:{jti}", max(int(ttl_seconds), 1), "1"), 0.5)
                return
            except Exception:
                self._use_redis = False

    async def is_revoked(self, jti: str) -> bool:
        expires_at = self._memory.get(jti)
        if expires_at is not None:
            if expires_at > time.time():
                return True
            self._memory.pop(jti, None)
        if self._use_redis:
            try:
                return bool(await asyncio.wait_for(self._redis.exists(f"sfmp:revoked:{jti}"), 0.5))
            except Exception:
                self._use_redis = False
        return False


token_store = TokenRevocationStore()
