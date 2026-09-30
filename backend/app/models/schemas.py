"""Pydantic response models. Shapes deliberately mirror the frontend's existing
JSON files (year2.json / groups.json / prices.json) so the Phase 7 cutover is a
URL swap, not a reshape."""
import datetime

from pydantic import BaseModel, Field, RootModel


class SeasonOut(BaseModel):
    label: str
    fiscal: str
    start_date: datetime.date
    end_date: datetime.date


class PickOut(BaseModel):
    name: str
    ticker: str
    prices: list[float | None]
    changes: list[float | None]
    return_: float | None = Field(alias="return")
    rationale: str | None = None

    model_config = {"populate_by_name": True}


class BenchmarkOut(BaseModel):
    name: str | None
    ticker: str
    prices: list[float | None]
    changes: list[float | None]
    return_: float | None = Field(alias="return")

    model_config = {"populate_by_name": True}


class DashboardOut(BaseModel):
    label: str
    fiscal: str
    dates: list[datetime.date]
    people: list[PickOut]
    benchmarks: list[BenchmarkOut]
    korch_return: float | None = Field(alias="korchReturn")

    model_config = {"populate_by_name": True}


class CohortsOut(RootModel[dict[str, list[float]]]):
    """{cohort name: [5 cumulative returns]} — the exact groups.json shape."""


class DiamondHandsRow(BaseModel):
    name: str | None
    ticker: str
    start: float
    end: float
    change: float


class LiveQuote(BaseModel):
    price: float
    date: datetime.date


class LivePersonRow(BaseModel):
    name: str
    ticker: str
    close: float | None


class LivePricesOut(BaseModel):
    updated: datetime.datetime
    source: str
    quotes: dict[str, LiveQuote]
    people: list[LivePersonRow]


class SeasonHistoryRow(BaseModel):
    fiscal: str
    ticker: str
    opening_price: float
    return_: float | None = Field(alias="return")

    model_config = {"populate_by_name": True}


class ParticipantHistoryOut(BaseModel):
    id: int
    full_name: str
    seasons: list[SeasonHistoryRow]
