"""Idempotent backfill: existing JSON data files -> Postgres.

Sources (paths relative to this file):
  ../../src/data/year1.json, year2.json, groups.json, hold.json
  ../../public/live/prices.json
  ./derived/cohort_memberships.json   (produced by derive_cohorts.py)

Safe to re-run: every insert is ON CONFLICT DO NOTHING/UPDATE. Participant
identity is full_name with an explicit alias map for cross-year name drift;
names that fail to resolve are PRINTED for review, never silently duplicated.
"""
import asyncio
import datetime
import json
import os
import pathlib
import sys

import asyncpg

HERE = pathlib.Path(__file__).parent
DATA = HERE / ".." / ".." / "src" / "data"
PRICES = HERE / ".." / ".." / "public" / "live" / "prices.json"
DERIVED = HERE / "derived" / "cohort_memberships.json"
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://korch:korch@localhost:5432/korchindex")

# year1/hold.json names -> canonical (year2) names. Left side only lists names
# whose drift is confidently attributable to the same person.
ALIASES = {
    "Alex Armstrong": "Alexander Armstrong",
    "Karen Korchinski": "Karin Korchinski",
    "Natalie Tran": "Natalie Lee",
    "Theo Lee": "Theodore Lee",
    "Tim": "Tim Morris",
    "Brit": "Brittany Buckley",
    "Jamie": "Jamie Armstrong",
    "Leala": "Leala Wong",
    "Buckley": "Scott Buckley",
    "Chris Morris": "Christopher Morris",
    "Julia": "Julia Korchinski",
    "Feder": "Jason Feder",
}
# Names known to exist only in year1 with no confident year2 counterpart —
# kept as their own participants, listed here so they don't trip the
# "unrecognized name" warning. (Michelle Fried vs Michelle Sullivan and
# Suzanne Korchinski vs Suzy Walker are plausible but unconfirmed matches.)
YEAR1_ONLY_OK = {"Michelle Fried", "Suzanne Korchinski", "Olivia Hardley", "Betsy Arch",
                 "Adriana Withers", "Anthony Fryar", "Cynthia Withers", "Victoria Withers",
                 "Bibi Withers", "Isabelle Korchinski", "Jack Korchinski", "Scott Korchinski",
                 "Scott Mitchell", "Todd Grover", "Kelly Grover", "Adam Fried", "John Withers",
                 "Joe Hobbs", "Jim Korchinski", "Greg Arch", "Brett Morris", "Nicole Haylock",
                 "Alejandra Orozco"}

canon = lambda name: ALIASES.get(name.strip(), name.strip())
D = datetime.date.fromisoformat

year1 = json.loads((DATA / "year1.json").read_text())
year2 = json.loads((DATA / "year2.json").read_text())
groups = json.loads((DATA / "groups.json").read_text())
hold = json.loads((DATA / "hold.json").read_text())
live = json.loads(PRICES.read_text())
derived = json.loads(DERIVED.read_text())


async def main() -> None:
    conn = await asyncpg.connect(DATABASE_URL)
    warnings: list[str] = []
    try:
        async with conn.transaction():
            # ---- seasons + checkpoints -------------------------------------
            season_ids = {}
            for season in (year1, year2):
                sid = await conn.fetchval(
                    """INSERT INTO seasons (label, fiscal, start_date, end_date)
                       VALUES ($1,$2,$3::date,$4::date)
                       ON CONFLICT (fiscal) DO UPDATE SET label = EXCLUDED.label
                       RETURNING id""",
                    season["label"], season["fiscal"], D(season["dates"][0]), D(season["dates"][-1]),
                )
                season_ids[season["fiscal"]] = sid
                for seq, d in enumerate(season["dates"]):
                    await conn.execute(
                        """INSERT INTO checkpoints (season_id, seq_no, checkpoint_date)
                           VALUES ($1,$2,$3::date) ON CONFLICT (season_id, seq_no) DO NOTHING""",
                        sid, seq, D(d),
                    )

            # ---- participants ----------------------------------------------
            async def participant_id(name: str) -> int:
                return await conn.fetchval(
                    """INSERT INTO participants (full_name) VALUES ($1)
                       ON CONFLICT (full_name) DO UPDATE SET full_name = EXCLUDED.full_name
                       RETURNING id""",
                    canon(name),
                )

            known = {canon(p["name"]) for p in year2["people"]}
            for p in year2["people"]:
                await participant_id(p["name"])
            for p in year1["people"]:
                name = canon(p["name"])
                if name not in known and p["name"] not in YEAR1_ONLY_OK and name not in YEAR1_ONLY_OK:
                    warnings.append(f"year1 name not in alias map or year2 roster: {p['name']!r}")
                pid = await participant_id(p["name"])
                if p.get("gender") or p.get("role"):
                    await conn.execute(
                        "UPDATE participants SET gender = COALESCE($2, gender), role = COALESCE($3, role) WHERE id = $1",
                        pid, p.get("gender"), p.get("role"),
                    )

            # ---- picks + price snapshots -----------------------------------
            async def insert_snapshot(ticker: str, date: str, price, checkpoint_id=None):
                if price is None:
                    return
                existing = await conn.fetchval(
                    "SELECT price FROM price_snapshots WHERE ticker = $1 AND snapshot_date = $2::date",
                    ticker, D(date),
                )
                if existing is not None:
                    if abs(float(existing) - float(price)) > 1e-6:
                        raise AssertionError(
                            f"conflicting price for {ticker}@{date}: {existing} vs {price}"
                        )
                    return
                await conn.execute(
                    """INSERT INTO price_snapshots (ticker, checkpoint_id, snapshot_date, price)
                       VALUES ($1,$2,$3::date,$4) ON CONFLICT (ticker, snapshot_date) DO NOTHING""",
                    ticker, checkpoint_id, D(date), price,
                )

            for season in (year1, year2):
                sid = season_ids[season["fiscal"]]
                cps = {
                    r["seq_no"]: r["id"]
                    for r in await conn.fetch("SELECT id, seq_no FROM checkpoints WHERE season_id = $1", sid)
                }
                for p in season["people"]:
                    if p["prices"][0] is None:
                        warnings.append(f"{season['fiscal']}: no opening price for {p['name']} ({p['ticker']}); pick skipped")
                        continue
                    pid = await participant_id(p["name"])
                    await conn.execute(
                        """INSERT INTO picks (participant_id, season_id, ticker, opening_price, rationale)
                           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (participant_id, season_id) DO NOTHING""",
                        pid, sid, p["ticker"].strip(), p["prices"][0], p.get("rationale"),
                    )
                    for seq, price in enumerate(p["prices"]):
                        await insert_snapshot(p["ticker"].strip(), season["dates"][seq], price, cps[seq])
                for b in season["benchmarks"]:
                    await conn.execute(
                        """INSERT INTO benchmarks (season_id, ticker, display_name)
                           VALUES ($1,$2,$3) ON CONFLICT (season_id, ticker) DO NOTHING""",
                        sid, b["ticker"], b.get("name"),
                    )
                    for seq, price in enumerate(b["prices"]):
                        await insert_snapshot(b["ticker"], season["dates"][seq], price, cps[seq])

            # ---- cohorts ----------------------------------------------------
            fy25 = season_ids["FY25"]
            for name, series in groups.items():
                info = derived.get(name, {"category": "unknown", "derived": False, "members": []})
                cid = await conn.fetchval(
                    """INSERT INTO cohorts (season_id, name, category, derived)
                       VALUES ($1,$2,$3,$4)
                       ON CONFLICT (season_id, name) DO UPDATE
                         SET category = EXCLUDED.category, derived = EXCLUDED.derived
                       RETURNING id""",
                    fy25, name, info["category"], info["derived"],
                )
                await conn.execute("DELETE FROM cohort_memberships WHERE cohort_id = $1", cid)
                for member in info["members"]:
                    pid = await conn.fetchval("SELECT id FROM participants WHERE full_name = $1", canon(member))
                    if pid is None:
                        warnings.append(f"cohort {name}: member {member!r} not found")
                        continue
                    await conn.execute(
                        "INSERT INTO cohort_memberships (cohort_id, participant_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
                        cid, pid,
                    )
                for seq, val in enumerate(series):
                    await conn.execute(
                        """INSERT INTO cohort_series_published (cohort_id, checkpoint_seq, cumulative_return)
                           VALUES ($1,$2,$3)
                           ON CONFLICT (cohort_id, checkpoint_seq) DO UPDATE
                             SET cumulative_return = EXCLUDED.cumulative_return""",
                        cid, seq, val,
                    )

            # ---- diamond hands ---------------------------------------------
            await conn.execute("DELETE FROM diamond_hands_report")
            for row in hold:
                pid = await conn.fetchval("SELECT id FROM participants WHERE full_name = $1", canon(row["name"]))
                if pid is None:
                    warnings.append(f"diamond hands: {row['name']!r} has no participant row (kept with NULL participant)")
                await conn.execute(
                    """INSERT INTO diamond_hands_report (participant_id, ticker, start_price, end_price)
                       VALUES ($1,$2,$3,$4)""",
                    pid, row["ticker"].strip(), row["start"], row["end"],
                )

            # ---- live quotes -----------------------------------------------
            for ticker, q in live["quotes"].items():
                await conn.execute(
                    """INSERT INTO live_quotes (ticker, price, quote_date, source)
                       VALUES ($1,$2,$3::date,$4)
                       ON CONFLICT (ticker) DO UPDATE
                         SET price = EXCLUDED.price, quote_date = EXCLUDED.quote_date,
                             source = EXCLUDED.source, updated_at = now()""",
                    ticker, q["price"], D(q["date"]), live.get("source", "seed"),
                )

        # ---- report ---------------------------------------------------------
        counts = {}
        for table in ("seasons", "checkpoints", "participants", "picks", "price_snapshots",
                      "benchmarks", "cohorts", "cohort_memberships", "cohort_series_published",
                      "diamond_hands_report", "live_quotes"):
            counts[table] = await conn.fetchval(f"SELECT count(*) FROM {table}")
        for t, c in counts.items():
            print(f"{t:26s} {c}")
        for w in warnings:
            print(f"WARNING: {w}")
        assert counts["seasons"] == 2 and counts["checkpoints"] == 10
        assert counts["diamond_hands_report"] == len(hold)
        assert counts["cohorts"] == len(groups)
    finally:
        await conn.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"Seed failed: {e}", file=sys.stderr)
        sys.exit(1)
