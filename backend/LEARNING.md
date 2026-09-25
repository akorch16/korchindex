# KORCH overengineering — where we started, where we are, what's left

A system-design practice log. Goal: rebuild KORCH's data layer as a real
distributed system (not because 40 users need it, but so every interview
pattern exists somewhere you built and can narrate) without ever breaking the
live site.

---

## Before → After

| | Before | After (now) |
|---|---|---|
| **Data storage** | 4 JSON files compiled into the JS bundle at build time | Normalized Postgres schema (11 tables) — `src/data/*.json` still exist and still ship the static site unchanged |
| **Returns** | Precomputed in a spreadsheet, baked into `year1.json`/`year2.json` as `prices[5]`/`changes[4]` arrays | Derived at query time via SQL window functions (`FIRST_VALUE() OVER (PARTITION BY ... ORDER BY seq_no)`) — nothing precomputed is stored |
| **Cohorts** ("Scott's vs Alex's", "Boomers", etc.) | `groups.json` — pre-averaged series with **no record of who's in each cohort** | Membership *solved* by search (13/24 cohorts fully derived, rest documented fallback) and stored in a real `cohort_memberships` join table; series recomputed via `AVG() ... GROUP BY` |
| **Live prices** | One JSON file (`public/live/prices.json`), rewritten daily by a GitHub Actions cron running a Node script, fetched client-side | `live_quotes` Postgres table, written by a Python ingestion job, read through a cache-aside layer |
| **Yahoo Finance calls** | Sequential per-ticker fetch, try/catch per ticker, all-or-nothing exit if every ticker failed, no request timeout | Same fetch logic, but every call goes through a shared circuit breaker (3 consecutive failures → trips, skips remaining tickers with zero network calls, auto-recovers after 60s), plus a 10s timeout the old script never had |
| **Caching** | None — nothing to cache, it's a static file | Redis cache-aside in front of every read endpoint; `X-Cache: HIT/MISS` header; two different invalidation strategies depending on whether the data actually changes |
| **Read scaling** | N/A (static CDN) | Every repo function takes an explicit connection pool; historical reads already route to a "replica" pool (currently aliased to the primary — the code seam exists before the infrastructure does) |
| **Observability on ingestion** | Zero — a failed cron run just logged to GitHub Actions and vanished | Every ingestion run writes a row to `ingestion_runs`: ticker counts, breaker state, which tickers failed and why |
| **Backend language** | None | Python + FastAPI, raw `asyncpg` + hand-written SQL (no ORM — the SQL itself is the point) |
| **Hosting** | GitHub Pages (`gh-pages` branch), free, static | Still GitHub Pages for the frontend. Backend has no host yet — see "What's remaining" |
| **Tests** | None | 21 passing (pytest): JSON-parity checks (SQL output vs. the shipped JSON, matching to 1e-6), cache hit/miss/degradation, breaker trip/fail-fast/recovery, ingestion end-to-end |

**What did not change:** the live site at akorch16.github.io/korchindex, its build process, its GitHub Actions deploy workflow, or any file under `src/`. This was deliberate — everything above lives in a new `backend/` directory, developed and verified in isolation.

---

## What's done: Phases 0–3

All merged into PR #6 (draft — https://github.com/akorch16/korchindex/pull/6), on branch `claude/korchindex-integration-3zpvvw`.

**Phase 0 — Schema & seed**
- `backend/migrations/0001_init.sql`, `0002_live_and_reporting.sql` + a tiny forward-only runner (`migrate.py`) — not Alembic, on purpose; the DDL is the learning artifact.
- `backend/scripts/derive_cohorts.py` — the standout piece. Recovered *who's actually in each cohort* by treating it as a constraint-satisfaction problem: every published cohort series is provably the exact mean of its members' return vectors, so a subset-sum search over 4 simultaneous quarterly constraints (with ticker-equivalence collapsing and domain priors like gender/couples) can recover membership. 13/24 cohorts fully solved; the other 11 documented with the exact reason they're ambiguous (e.g. two people hold identical tickers, so which one is "in" the cohort is genuinely undecidable from the data). Notable finds: KORCH = the equal-weight mean of literally all 41 picks; the sheet double-counts Tim Morris in both Men and Women.
- `backend/scripts/seed_from_json.py` — idempotent backfill from the existing JSON, with an explicit cross-year name-alias map ("Karen"/"Karin Korchinski", etc.) instead of silently duping people.

**Phase 1 — FastAPI**
- `backend/app/` — 8 endpoints, all read-only, mirroring the existing JSON shapes so a future frontend cutover is a URL swap, not a reshape.
- Verified byte-for-byte against the shipped data: prices/changes match to 1e-6, cohort series to 1e-4.

**Phase 2 — Redis cache-aside**
- `backend/app/cache.py` — `get_or_compute(key, ttl, fn)` sitting between routers and the DB.
- Measured: 31.7ms on a cache MISS, 2.3ms on a HIT.
- Two invalidation philosophies, deliberately different: historical data (season dashboards, cohorts) uses a 24h TTL purely as a backstop — the real invalidation is explicit, on reseed. Live prices use a 15-minute TTL *and* explicit deletion the moment the ingestion job commits new data to Postgres.
- Redis outages degrade to reading Postgres directly — caching failure never becomes API failure.

**Phase 3 — Circuit breaker**
- `backend/app/circuit.py`, `backend/app/ingestion/` — Python port of `update-prices.mjs` wrapped in `pybreaker.CircuitBreaker(fail_max=3, reset_timeout=60)`.
- **Verified against a real failure, not a mock**: run from this sandbox (whose proxy 403s Yahoo), the breaker tripped exactly as designed —
  ```
  failure 1/3 (403 Forbidden)
  failure 2/3 (403 Forbidden)
  failure 3/3 (403 Forbidden)
  circuit 'yahoo-finance': closed -> open
  done: 0 updated, 2 failed, 32 skipped (breaker open)
  ```
  32 tickers skipped with **zero** network calls once the breaker opened, the run was logged with `breaker_state=open`, and `/api/live-prices` kept serving last-known-good data the entire time because the read path never checks breaker state.

---

## What's remaining: Phases 4–7

These need infrastructure I can't provision myself (no cloud account, no SSH keys, no domain).

| Phase | What it is | What it needs from you |
|---|---|---|
| **4 — VPS deploy** | Stand up a small box (Hetzner CX22 ~€4.5/mo or DigitalOcean ~$6/mo), run the existing `backend/docker-compose.yml`, front it with Caddy for HTTPS | Create the VPS account/box, give me its IP + SSH access (or run the provided commands yourself) |
| **5 — Real read replica** | A second Postgres container doing actual streaming replication (`wal_level=replica`, `pg_basebackup -R`) — the "replica" pool currently just points at the primary; this makes it real | Comes after Phase 4; no extra decision needed beyond "go" |
| **6 — In-cluster cron** | Move the ingestion job off GitHub Actions onto a `supercronic` container on the VPS, talking to Postgres over the private network instead of needing it exposed publicly | Comes after Phase 4 |
| **7 — Frontend cutover** | Repoint `Dashboard.jsx`/`ArchiveY1.jsx`/`Live.jsx` at the live API instead of the compiled-in JSON | **Your explicit go-ahead** — this is the one with a real tradeoff: today the site survives anything (static CDN); after cutover its uptime depends on one small box with no redundancy. That's the deal you're accepting for the practice value, not something to slide into by accident. |

Also deliberately **not** on this list, on purpose (good interview material in its own right):
- **Kafka** — no fan-out exists; the only thing that reacts to a price update is one cache key.
- **Idempotency keys** — no client-initiated writes anywhere; the only writer is the ingestion job, already idempotent via `ON CONFLICT`.
- **Real Robinhood integration** — no public API exists, only unsupported reverse-engineered endpoints with real credential/ToS risk. Yahoo stays the price source; "brokerage feed adapter" is narrative framing only.

---

## Your to-do list

1. **Review/merge PR #6** — https://github.com/akorch16/korchindex/pull/6. Nothing user-facing changes if you merge it; it's purely additive.
2. **When ready for Phase 4:** spin up a VPS (Hetzner or DigitalOcean, pick one) and a domain/subdomain for the API (e.g. `api.korchindex.yourdomain.com`). Hand me the IP + SSH access, and I'll write the deploy workflow, Caddy config, and get it live.
3. **Decide when you want Phase 7 (cutover)** — flag it explicitly when you're ready; I won't do it silently given the availability tradeoff above.
4. **Optional, anytime:** run `python scripts/derive_cohorts.py` yourself and read the report (`backend/README.md` has the run instructions) — it's a genuinely interesting constraint-satisfaction exercise if you want to poke at the 11 undetermined cohorts by hand with information only you have (e.g. actually knowing who's Canadian).
