"""Scheduled price ingestion: python -m app.ingestion.ingest_job

Replaces scripts/update-prices.mjs. For every ticker in the latest season
(plus its benchmarks): fetch the latest quote from Yahoo behind the shared
circuit breaker, upsert live_quotes, then explicitly invalidate the Redis
live-prices keys (warm-on-write's simpler cousin). Every run writes an
ingestion_runs row — breaker state, counts, per-ticker failures — which the
old script never recorded.

Failure semantics:
  - individual ticker failure: logged, previous quote stands, run continues
  - breaker OPEN (3 consecutive failures): remaining tickers are skipped
    without network calls; /api/live-prices is unaffected (it reads Postgres)
  - zero successes: exit 1 so the scheduler surfaces the run as failed
"""
import asyncio
import datetime
import json
import logging
import sys

import asyncpg
import pybreaker

from .. import cache
from ..circuit import yahoo_breaker
from ..config import settings
from .yahoo_client import fetch_quote

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("korch.ingest")

TICKERS_SQL = """
WITH latest AS (SELECT id FROM seasons ORDER BY start_date DESC LIMIT 1)
SELECT DISTINCT ticker FROM picks      WHERE season_id = (SELECT id FROM latest)
UNION
SELECT DISTINCT ticker FROM benchmarks WHERE season_id = (SELECT id FROM latest)
ORDER BY ticker
"""

UPSERT_SQL = """
INSERT INTO live_quotes (ticker, price, quote_date, source)
VALUES ($1, $2, $3, 'yahoo_finance_chart_v8')
ON CONFLICT (ticker) DO UPDATE
  SET price = EXCLUDED.price, quote_date = EXCLUDED.quote_date,
      source = EXCLUDED.source, updated_at = now()
"""


async def run() -> int:
    conn = await asyncpg.connect(settings.database_url)
    started = datetime.datetime.now(datetime.timezone.utc)
    succeeded, skipped, failed = 0, 0, []
    try:
        tickers = [r["ticker"] for r in await conn.fetch(TICKERS_SQL)]
        log.info("ingesting %d tickers (breaker: fail_max=%d, reset=%ss)",
                 len(tickers), yahoo_breaker.fail_max, yahoo_breaker.reset_timeout)
        for ticker in tickers:
            try:
                quote = yahoo_breaker.call(fetch_quote, ticker)
            except pybreaker.CircuitBreakerError:
                skipped += 1
                continue  # open circuit: no network call was made
            except Exception as exc:
                failed.append(f"{ticker} ({exc})")
                continue
            finally:
                await asyncio.sleep(0.3)
            await conn.execute(UPSERT_SQL, ticker, quote["price"], quote["date"])
            succeeded += 1

        await conn.execute(
            """INSERT INTO ingestion_runs
                 (started_at, finished_at, tickers_attempted, tickers_succeeded,
                  tickers_failed, breaker_state, failed_tickers)
               VALUES ($1, now(), $2, $3, $4, $5, $6)""",
            started, len(tickers), succeeded, len(failed) + skipped,
            yahoo_breaker.current_state, json.dumps(failed),
        )

        if succeeded:
            busted = await cache.invalidate_prefix("live:prices:")
            log.info("invalidated %d cache key(s)", busted)
        log.info("done: %d updated, %d failed, %d skipped (breaker %s)",
                 succeeded, len(failed), skipped, yahoo_breaker.current_state)
        for f in failed:
            log.info("kept previous quote for %s", f)
        return 0 if succeeded else 1
    finally:
        await cache.close()
        await conn.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
