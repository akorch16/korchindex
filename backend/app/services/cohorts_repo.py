"""Cohort series. Derived cohorts are a real GROUP BY over member picks'
price-derived changes; non-derived cohorts serve the published series verbatim
(cohort_series_published). Both come back in groups.json's flat-dict shape."""
import asyncpg

DERIVED_SQL = """
WITH openings AS (
    SELECT pk.id AS pick_id, pk.ticker, ps.price AS opening
    FROM picks pk
    JOIN checkpoints c0 ON c0.season_id = pk.season_id AND c0.seq_no = 0
    JOIN price_snapshots ps ON ps.ticker = pk.ticker AND ps.snapshot_date = c0.checkpoint_date
),
member_changes AS (
    SELECT co.name, c.seq_no,
           CASE WHEN c.seq_no = 0 THEN 0.0
                ELSE (ps.price - o.opening) / o.opening END AS chg
    FROM cohorts co
    JOIN seasons s           ON s.id = co.season_id
    JOIN cohort_memberships cm ON cm.cohort_id = co.id
    JOIN picks pk            ON pk.participant_id = cm.participant_id AND pk.season_id = co.season_id
    JOIN openings o          ON o.pick_id = pk.id
    JOIN checkpoints c       ON c.season_id = co.season_id
    LEFT JOIN price_snapshots ps
           ON ps.ticker = pk.ticker AND ps.snapshot_date = c.checkpoint_date
    WHERE co.derived AND s.fiscal = $1
)
SELECT name, seq_no, round(AVG(chg)::numeric, 6)::float8 AS value
FROM member_changes
GROUP BY name, seq_no
"""

PUBLISHED_SQL = """
SELECT co.name, sp.checkpoint_seq AS seq_no, sp.cumulative_return::float8 AS value
FROM cohorts co
JOIN seasons s ON s.id = co.season_id
JOIN cohort_series_published sp ON sp.cohort_id = co.id
WHERE NOT co.derived AND s.fiscal = $1
"""


async def cohort_series(pool: asyncpg.Pool, fiscal: str) -> dict[str, list[float]]:
    out: dict[str, dict[int, float]] = {}
    for sql in (DERIVED_SQL, PUBLISHED_SQL):
        for r in await pool.fetch(sql, fiscal):
            out.setdefault(r["name"], {})[r["seq_no"]] = r["value"]
    return {
        name: [vals.get(i, 0.0) for i in range(max(vals) + 1)]
        for name, vals in sorted(out.items())
    }
