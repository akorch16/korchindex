"""Integration tests against the local seeded Postgres (run migrations +
seed_from_json.py first — see backend/README.md). One end-to-end test per
router plus the return-math parity that guards the window-function SQL."""
import json
import pathlib

import httpx
import pytest

from app import db
from app.main import app

DATA = pathlib.Path(__file__).parent / ".." / ".." / "src" / "data"


@pytest.fixture
async def client():
    await db.connect()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await db.disconnect()


async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["primary"] is True


async def test_seasons(client):
    r = await client.get("/api/seasons")
    assert [s["fiscal"] for s in r.json()] == ["FY24", "FY25"]


async def test_dashboard_matches_source_json(client):
    """The load-bearing check: SQL-derived changes must equal the precomputed
    arrays the frontend ships today."""
    r = await client.get("/api/seasons/FY25/dashboard")
    assert r.status_code == 200
    dash = r.json()
    src = json.loads((DATA / "year2.json").read_text())
    api_people = {p["name"]: p for p in dash["people"]}
    assert len(api_people) == len(src["people"])
    for sp in src["people"]:
        ap = api_people[sp["name"]]
        for a, b in zip(ap["changes"], sp["changes"]):
            if a is not None and b is not None:
                assert abs(a - b) <= 1e-6, (sp["name"], a, b)
    assert abs(dash["korchReturn"] - src["korchReturn"]) <= 1e-6


async def test_dashboard_404(client):
    r = await client.get("/api/seasons/FY99/dashboard")
    assert r.status_code == 404


async def test_cohorts_match_groups_json(client):
    r = await client.get("/api/cohorts", params={"season": "FY25"})
    cohorts = r.json()
    src = json.loads((DATA / "groups.json").read_text())
    assert set(cohorts) == set(src)
    for name, series in src.items():
        for a, b in zip(cohorts[name], series):
            assert abs(a - b) <= 1e-4, name


async def test_diamond_hands_sorted(client):
    rows = (await client.get("/api/diamond-hands")).json()
    assert len(rows) == 33
    changes = [r["change"] for r in rows]
    assert changes == sorted(changes, reverse=True)


async def test_live_prices_enriched(client):
    body = (await client.get("/api/live-prices")).json()
    assert body["quotes"] and body["people"]
    assert {"name", "ticker", "close"} <= set(body["people"][0])


async def test_participant_history(client):
    r = await client.get("/api/participants/1/history")
    assert r.status_code == 200
    assert r.json()["seasons"]
