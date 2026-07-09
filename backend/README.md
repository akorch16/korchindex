# KORCH backend

The deliberately overengineered data layer for [KORCH](https://akorch16.github.io/korchindex/),
built as a system-design practice project: Postgres (with a read-replica seam),
Redis cache-aside (Phase 2), a circuit-breaker-wrapped price-ingestion job
(Phase 3), FastAPI in front. The static site keeps working unchanged until the
Phase 7 cutover. Full phased plan lives with the repo owner; this README covers
running what exists today (Phases 0–1).

## Run it

```bash
docker compose up -d postgres redis          # or any local Postgres 16 + Redis
pip install -e ".[dev]"
python migrations/migrate.py                 # forward-only, tracked in schema_migrations
python scripts/derive_cohorts.py             # optional: regenerate cohort memberships
python scripts/seed_from_json.py             # idempotent backfill from ../src/data/*.json
uvicorn app.main:app --reload                # http://localhost:8000/docs
pytest                                       # integration tests against the seeded DB
```

## Endpoints

| Endpoint | Pool | Notes |
|---|---|---|
| `GET /api/health` | both | pings primary, replica, Redis |
| `GET /api/seasons` | replica | |
| `GET /api/seasons/{fiscal}/dashboard` | replica | people + benchmarks + KORCH return; quarterly changes derived in SQL via `FIRST_VALUE()` window functions, never stored |
| `GET /api/seasons/{fiscal}/leaderboard` | replica | |
| `GET /api/cohorts?season=FY25` | replica | derived cohorts recomputed via `AVG() GROUP BY`; unresolved ones served from the published-series audit table |
| `GET /api/diamond-hands` | replica | |
| `GET /api/live-prices` | **primary** | the one write-then-read path |
| `GET /api/participants/{id}/history` | replica | |

The replica pool falls back to the primary until Phase 5 stands up real
streaming replication — routers already choose pools explicitly, so the
cutover is config, not code.

## Cohort derivation

`groups.json` shipped only pre-averaged cohort series with no membership data.
`scripts/derive_cohorts.py` recovers membership by subset-search: each
published series is the exact mean of member change-vectors, so four
simultaneous quarterly constraints identify the members (equivalence-classed
by ticker, since same-ticker picks are mathematically interchangeable).
**13 of 24 cohorts fully derived**, including a k=4 school cohort found
uniquely among ~100k combinations; the rest fall back to the published series
with the specific obstruction documented per cohort (`scripts/derived/
cohort_memberships.json`). Notable findings: KORCH = the equal-weight mean of
all 41 picks; "Everyone" = the roster minus one interchangeable CRWD holder;
the source sheet counts Tim Morris in both Men and Women.
