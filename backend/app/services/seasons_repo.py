"""Season/dashboard queries. Quarterly changes are DERIVED in SQL from raw
price snapshots via window functions — nothing precomputed is stored."""
import asyncpg

SERIES_SQL = """
WITH series AS (
    SELECT pk.id AS pick_id,
           pa.full_name AS name,
           pk.ticker,
           pk.rationale,
           c.seq_no,
           ps.price,
           FIRST_VALUE(ps.price) OVER (PARTITION BY pk.id ORDER BY c.seq_no) AS opening
    FROM picks pk
    JOIN participants pa ON pa.id = pk.participant_id
    JOIN seasons s       ON s.id = pk.season_id
    JOIN checkpoints c   ON c.season_id = s.id
    LEFT JOIN price_snapshots ps
           ON ps.ticker = pk.ticker AND ps.snapshot_date = c.checkpoint_date
    WHERE s.fiscal = $1
)
SELECT name, ticker, rationale,
       array_agg(price::float8 ORDER BY seq_no) AS prices,
       (array_agg(
           CASE WHEN price IS NULL OR opening IS NULL THEN NULL
                ELSE round((price - opening) / opening, 6)::float8 END
           ORDER BY seq_no))[2:] AS changes
FROM series
GROUP BY pick_id, name, ticker, rationale
ORDER BY (array_agg(
           CASE WHEN price IS NULL OR opening IS NULL THEN NULL
                ELSE (price - opening) / opening END
           ORDER BY seq_no DESC))[1] DESC NULLS LAST
"""

BENCH_SQL = """
WITH series AS (
    SELECT b.id AS bench_id,
           b.display_name AS name,
           b.ticker,
           c.seq_no,
           ps.price,
           FIRST_VALUE(ps.price) OVER (PARTITION BY b.id ORDER BY c.seq_no) AS opening
    FROM benchmarks b
    JOIN seasons s     ON s.id = b.season_id
    JOIN checkpoints c ON c.season_id = s.id
    LEFT JOIN price_snapshots ps
           ON ps.ticker = b.ticker AND ps.snapshot_date = c.checkpoint_date
    WHERE s.fiscal = $1
)
SELECT name, ticker,
       array_agg(price::float8 ORDER BY seq_no) AS prices,
       (array_agg(
           CASE WHEN price IS NULL OR opening IS NULL THEN NULL
                ELSE round((price - opening) / opening, 6)::float8 END
           ORDER BY seq_no))[2:] AS changes
FROM series
GROUP BY bench_id, name, ticker
ORDER BY ticker
"""


async def list_seasons(pool: asyncpg.Pool) -> list[dict]:
    rows = await pool.fetch("SELECT label, fiscal, start_date, end_date FROM seasons ORDER BY start_date")
    return [dict(r) for r in rows]


async def season_row(pool: asyncpg.Pool, fiscal: str) -> dict | None:
    row = await pool.fetchrow("SELECT id, label, fiscal FROM seasons WHERE fiscal = $1", fiscal)
    return dict(row) if row else None


async def checkpoint_dates(pool: asyncpg.Pool, fiscal: str) -> list:
    rows = await pool.fetch(
        """SELECT c.checkpoint_date FROM checkpoints c
           JOIN seasons s ON s.id = c.season_id WHERE s.fiscal = $1 ORDER BY c.seq_no""",
        fiscal,
    )
    return [r["checkpoint_date"] for r in rows]


def _finish(rec: dict) -> dict:
    changes = rec.get("changes") or []
    rec["return"] = next((c for c in reversed(changes) if c is not None), None)
    return rec


async def leaderboard(pool: asyncpg.Pool, fiscal: str) -> list[dict]:
    rows = await pool.fetch(SERIES_SQL, fiscal)
    return [_finish(dict(r)) for r in rows]


async def benchmarks(pool: asyncpg.Pool, fiscal: str) -> list[dict]:
    rows = await pool.fetch(BENCH_SQL, fiscal)
    return [_finish(dict(r)) for r in rows]


async def dashboard(pool: asyncpg.Pool, fiscal: str) -> dict | None:
    season = await season_row(pool, fiscal)
    if season is None:
        return None
    people = await leaderboard(pool, fiscal)
    returns = [p["return"] for p in people if p["return"] is not None]
    return {
        "label": season["label"],
        "fiscal": season["fiscal"],
        "dates": await checkpoint_dates(pool, fiscal),
        "people": people,
        "benchmarks": await benchmarks(pool, fiscal),
        "korchReturn": round(sum(returns) / len(returns), 6) if returns else None,
    }
