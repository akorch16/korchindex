"""Cache-aside over Redis.

The pattern: request -> Redis GET -> hit returns the cached JSON payload;
miss computes from Postgres, SETs with a TTL, returns. Two invalidation
philosophies coexist deliberately (interview talking point):

  - Historical keys (season:*, cohorts:*, diamond-hands) are effectively
    immutable once a season closes — their 24h TTL is a pure safety net and
    the real invalidation is explicit (bust on reseed).
  - live:prices:* actually changes daily — the ingestion job explicitly
    deletes it right after committing to Postgres, and its short TTL is the
    backstop for the race window where a request lands between the Postgres
    commit and the cache delete.

Redis being down never takes reads down: every cache error degrades to
computing straight from Postgres.
"""
import json

import redis.asyncio as aioredis

from .config import settings

TTL_HISTORICAL = 24 * 3600
TTL_LIVE = 15 * 60

_client: aioredis.Redis | None = None


def client() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _client


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def get_or_compute(key: str, ttl: int, fn):
    """Returns (value, cache_hit). fn is an async callable hitting Postgres."""
    try:
        cached = await client().get(key)
        if cached is not None:
            return json.loads(cached), True
    except Exception:
        # Redis unreachable: serve from the source of truth, skip caching.
        return await fn(), False
    value = await fn()
    if value is not None:
        try:
            await client().set(key, json.dumps(value, default=str), ex=ttl)
        except Exception:
            pass
    return value, False


async def invalidate_prefix(prefix: str) -> int:
    """Delete every key under prefix (used by the ingestion job and reseeds)."""
    deleted = 0
    try:
        c = client()
        async for k in c.scan_iter(match=f"{prefix}*"):
            deleted += await c.delete(k)
    except Exception:
        pass
    return deleted
