"""Two asyncpg pools: primary (writes + read-after-write paths) and replica
(historical reads). Until Phase 5 stands up a real streaming replica, the
replica pool simply points at the primary — routers already pass the pool they
want, so the read/write split is exercised from day one and the cutover to a
real replica is a config change, not a code change."""
import asyncpg

from .config import settings

primary: asyncpg.Pool | None = None
replica: asyncpg.Pool | None = None


async def connect() -> None:
    global primary, replica
    primary = await asyncpg.create_pool(settings.database_url, min_size=1, max_size=5)
    replica_url = settings.database_url_replica or settings.database_url
    replica = await asyncpg.create_pool(replica_url, min_size=1, max_size=5)


async def disconnect() -> None:
    if primary:
        await primary.close()
    if replica:
        await replica.close()
