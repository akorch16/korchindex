"""All read-only endpoints. Pool choice is explicit per endpoint: historical
reads take the replica pool (the Phase 5 read-scaling seam — it falls back to
the primary until a real replica exists); /api/live-prices deliberately reads
the primary, because it's the one write-then-read path in the system."""
from fastapi import APIRouter, HTTPException, Query

from .. import db
from ..models.schemas import (
    CohortsOut,
    DashboardOut,
    DiamondHandsRow,
    LivePricesOut,
    ParticipantHistoryOut,
    PickOut,
    SeasonOut,
)
from ..services import cohorts_repo, live_repo, seasons_repo

router = APIRouter(prefix="/api")


@router.get("/health")
async def health():
    status = {"primary": False, "replica": False, "redis": None}
    try:
        await db.primary.fetchval("SELECT 1")
        status["primary"] = True
    except Exception:
        pass
    try:
        await db.replica.fetchval("SELECT 1")
        status["replica"] = True
    except Exception:
        pass
    # Redis becomes load-bearing in Phase 2; reported but non-fatal here.
    try:
        import redis.asyncio as aioredis

        from ..config import settings

        r = aioredis.from_url(settings.redis_url)
        await r.ping()
        await r.aclose()
        status["redis"] = True
    except Exception:
        status["redis"] = False
    if not status["primary"]:
        raise HTTPException(status_code=503, detail=status)
    return {"status": "ok", **status}


@router.get("/seasons", response_model=list[SeasonOut])
async def seasons():
    return await seasons_repo.list_seasons(db.replica)


@router.get("/seasons/{fiscal}/dashboard", response_model=DashboardOut, response_model_by_alias=True)
async def dashboard(fiscal: str):
    result = await seasons_repo.dashboard(db.replica, fiscal)
    if result is None:
        raise HTTPException(status_code=404, detail=f"unknown season {fiscal!r}")
    return result


@router.get("/seasons/{fiscal}/leaderboard", response_model=list[PickOut], response_model_by_alias=True)
async def leaderboard(fiscal: str):
    if await seasons_repo.season_row(db.replica, fiscal) is None:
        raise HTTPException(status_code=404, detail=f"unknown season {fiscal!r}")
    return await seasons_repo.leaderboard(db.replica, fiscal)


@router.get("/cohorts", response_model=CohortsOut)
async def cohorts(season: str = Query(default="FY25")):
    series = await cohorts_repo.cohort_series(db.replica, season)
    if not series:
        raise HTTPException(status_code=404, detail=f"no cohorts for season {season!r}")
    return series


@router.get("/diamond-hands", response_model=list[DiamondHandsRow])
async def diamond_hands():
    return await live_repo.diamond_hands(db.replica)


@router.get("/live-prices", response_model=LivePricesOut)
async def live_prices(season: str = Query(default="FY25")):
    return await live_repo.live_prices(db.primary, season)


@router.get("/participants/{participant_id}/history", response_model=ParticipantHistoryOut, response_model_by_alias=True)
async def participant_history(participant_id: int):
    result = await live_repo.participant_history(db.replica, participant_id)
    if result is None:
        raise HTTPException(status_code=404, detail="unknown participant")
    return result
