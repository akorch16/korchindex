"""Phase 2/3 behavior tests: cache-aside hit/miss + invalidation, breaker
trip/fail-fast/recovery, and the ingestion job end-to-end with a faked Yahoo."""
import asyncio
import datetime

import httpx
import pybreaker
import pytest

from app import cache, db
from app.circuit import LoggingListener
from app.ingestion import ingest_job, yahoo_client
from app.main import app


@pytest.fixture
async def client():
    await db.connect()
    await cache.invalidate_prefix("")  # start every test cold
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await db.disconnect()
    await cache.close()


# ------------------------------------------------------------- cache-aside --
async def test_miss_then_hit(client):
    r1 = await client.get("/api/seasons/FY25/dashboard")
    assert r1.headers["X-Cache"] == "MISS"
    r2 = await client.get("/api/seasons/FY25/dashboard")
    assert r2.headers["X-Cache"] == "HIT"
    assert r2.json() == r1.json()  # cached payload is byte-for-byte equivalent


async def test_live_prices_invalidation(client):
    await client.get("/api/live-prices")
    assert (await client.get("/api/live-prices")).headers["X-Cache"] == "HIT"
    deleted = await cache.invalidate_prefix("live:prices:")
    assert deleted >= 1
    assert (await client.get("/api/live-prices")).headers["X-Cache"] == "MISS"


async def test_redis_down_degrades_to_postgres(client, monkeypatch):
    async def broken_get(*a, **k):
        raise ConnectionError("redis is down")

    monkeypatch.setattr(cache.client(), "get", broken_get)
    r = await client.get("/api/seasons/FY25/dashboard")
    assert r.status_code == 200
    assert r.headers["X-Cache"] == "MISS"


# ---------------------------------------------------------- circuit breaker --
def test_breaker_trips_fails_fast_and_recovers():
    breaker = pybreaker.CircuitBreaker(fail_max=3, reset_timeout=0.2, listeners=[LoggingListener()])
    calls = {"n": 0}

    def flaky(should_fail):
        calls["n"] += 1
        if should_fail:
            raise ConnectionError("yahoo 403")
        return "quote"

    # pybreaker re-raises the underlying error until the threshold call, which
    # itself surfaces as CircuitBreakerError as the circuit trips.
    for expected in (ConnectionError, ConnectionError, pybreaker.CircuitBreakerError):
        with pytest.raises(expected):
            breaker.call(flaky, True)
    assert breaker.current_state == "open"

    # Open circuit: call is rejected WITHOUT invoking the function (fail fast).
    before = calls["n"]
    with pytest.raises(pybreaker.CircuitBreakerError):
        breaker.call(flaky, True)
    assert calls["n"] == before

    # After the cooldown it half-opens; one success closes it.
    import time

    time.sleep(0.25)
    assert breaker.call(flaky, False) == "quote"
    assert breaker.current_state == "closed"


# ------------------------------------------------------------ ingestion job --
async def test_ingest_job_with_fake_yahoo(monkeypatch):
    today = datetime.date.today()

    def fake_fetch(ticker):
        if ticker == "BRAG":  # one genuinely bad ticker must not sink the run
            raise ValueError("no price data for BRAG")
        return {"price": 123.45, "date": today}

    monkeypatch.setattr(ingest_job, "fetch_quote", fake_fetch)

    rc = await ingest_job.run()  # ~10s: keeps the real 300ms inter-request throttle
    assert rc == 0

    import asyncpg

    from app.config import settings

    conn = await asyncpg.connect(settings.database_url)
    try:
        run_row = await conn.fetchrow("SELECT * FROM ingestion_runs ORDER BY id DESC LIMIT 1")
        assert run_row["tickers_succeeded"] > 25
        assert run_row["tickers_failed"] == 1
        assert run_row["breaker_state"] == "closed"
        quote = await conn.fetchrow("SELECT * FROM live_quotes WHERE ticker = 'PLTR'")
        assert float(quote["price"]) == 123.45
        stale = await conn.fetchrow("SELECT * FROM live_quotes WHERE ticker = 'BRAG'")
        assert float(stale["price"]) != 123.45  # previous value kept
    finally:
        await conn.close()
