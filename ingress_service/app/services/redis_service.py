import json
import logging
from typing import Any

import redis.asyncio as redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_redis_pool: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    global _redis_pool
    if _redis_pool is None:
        settings = get_settings()
        _redis_pool = redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    return _redis_pool


async def close_redis() -> None:
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.aclose()
        _redis_pool = None


class RedisOTP:
    def __init__(self, client: redis.Redis) -> None:
        self._redis = client

    async def set_otp(self, key: str, data: dict[str, Any], ttl: int = 300) -> None:
        await self._redis.set(key, json.dumps(data), ex=ttl)

    async def get_otp(self, key: str) -> dict[str, Any] | None:
        raw = await self._redis.get(key)
        if raw is None:
            return None
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("invalid JSON in redis key %s", key)
            return None
        return parsed if isinstance(parsed, dict) else None

    async def delete_keys(self, *keys: str) -> None:
        if keys:
            await self._redis.delete(*keys)

    async def acquire_lock(self, key: str, ttl: int = 30) -> bool:
        return bool(await self._redis.set(key, "1", nx=True, ex=ttl))

    async def release_lock(self, key: str) -> None:
        await self._redis.delete(key)

    async def incr_attempts(self, key: str, ttl: int = 300) -> int:
        count = await self._redis.incr(key)
        if count == 1:
            await self._redis.expire(key, ttl)
        return int(count)

    async def get_attempts(self, key: str) -> int:
        raw = await self._redis.get(key)
        if raw is None:
            return 0
        try:
            return int(raw)
        except ValueError:
            return 0
