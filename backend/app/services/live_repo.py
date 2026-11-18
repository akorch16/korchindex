"""Live quotes (reads the primary pool — this is the one write-then-read path)
plus the extras: diamond hands and participant history."""
import asyncpg

CLOSES_SQL = """
SELECT pa.full_name AS name, pk.ticker, ps.price::float8 AS close
FROM picks pk
JOIN participants pa ON pa.id = pk.participant_id
JOIN seasons s       ON s.id = pk.season_id
JOIN checkpoints c   ON c.season_id = s.id AND c.seq_no = (
    SELECT max(seq_no) FROM checkpoints WHERE season_id = s.id)
LEFT JOIN price_snapshots ps
       ON ps.ticker = pk.ticker AND ps.snapshot_date = c.checkpoint_date
WHERE s.fiscal = $1
ORDER BY pa.full_name
"""


async def live_prices(pool: asyncpg.Pool, fiscal: str) -> dict:
    quotes = await pool.fetch("SELECT ticker, price::float8 AS price, quote_date, source, updated_at FROM live_quotes")
    people = await pool.fetch(CLOSES_SQL, fiscal)
    updated = max((q["updated_at"] for q in quotes), default=None)
    return {
        "updated": updated,
        "source": quotes[0]["source"] if quotes else "unseeded",
        "quotes": {q["ticker"]: {"price": q["price"], "date": q["quote_date"]} for q in quotes},
        "people": [dict(p) for p in people],
    }


async def diamond_hands(pool: asyncpg.Pool) -> list[dict]:
    rows = await pool.fetch(
        """SELECT pa.full_name AS name, d.ticker,
                  d.start_price::float8 AS start, d.end_price::float8 AS "end",
                  d.change::float8 AS change
           FROM diamond_hands_report d
           LEFT JOIN participants pa ON pa.id = d.participant_id
           ORDER BY d.change DESC"""
    )
    return [dict(r) for r in rows]


async def participant_history(pool: asyncpg.Pool, participant_id: int) -> dict | None:
    person = await pool.fetchrow("SELECT id, full_name FROM participants WHERE id = $1", participant_id)
    if person is None:
        return None
    rows = await pool.fetch(
        """WITH series AS (
               SELECT pk.id AS pick_id, s.fiscal, pk.ticker, pk.opening_price, c.seq_no, ps.price,
                      FIRST_VALUE(ps.price) OVER (PARTITION BY pk.id ORDER BY c.seq_no) AS opening
               FROM picks pk
               JOIN seasons s     ON s.id = pk.season_id
               JOIN checkpoints c ON c.season_id = s.id
               LEFT JOIN price_snapshots ps
                      ON ps.ticker = pk.ticker AND ps.snapshot_date = c.checkpoint_date
               WHERE pk.participant_id = $1
           )
           SELECT fiscal, ticker, opening_price::float8 AS opening_price,
                  (array_agg(
                      CASE WHEN price IS NULL OR opening IS NULL THEN NULL
                           ELSE round((price - opening) / opening, 6)::float8 END
                      ORDER BY seq_no DESC))[1] AS return
           FROM series
           GROUP BY pick_id, fiscal, ticker, opening_price
           ORDER BY fiscal""",
        participant_id,
    )
    return {"id": person["id"], "full_name": person["full_name"], "seasons": [dict(r) for r in rows]}
