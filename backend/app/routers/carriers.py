import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Carrier, Inspection, Violation
from app.schemas import (
    CarrierDetail,
    CarrierListResponse,
    CarrierSafetyResponse,
    CarrierSummary,
    MonthlyCount,
    StateCount,
    StatsResponse,
    UpdatesResponse,
)
from app.services.slugs import usdot_from_slug

router = APIRouter(prefix="/api/carriers", tags=["carriers"])

US_STATE_CODES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
    "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
    "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
    "PR", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]

# Counts over millions of rows are expensive; refresh at most hourly.
_hourly_cache: dict[str, tuple[float, object]] = {}


def _cached(key: str):
    import time

    entry = _hourly_cache.get(key)
    if entry and time.time() - entry[0] < 3600:
        return entry[1]
    return None


def _store(key: str, value: object) -> None:
    import time

    _hourly_cache[key] = (time.time(), value)


@router.get("/stats", response_model=StatsResponse)
def stats(db: Session = Depends(get_db)) -> StatsResponse:
    cached = _cached("stats")
    if cached is not None:
        return cached  # type: ignore[return-value]
    from app.models import Inspection, SafetyScore, Violation

    data = StatsResponse(
        total_carriers=db.scalar(
            select(func.count()).select_from(Carrier).where(Carrier.is_active.is_(True))
        ) or 0,
        total_inspections=db.scalar(select(func.count()).select_from(Inspection)) or 0,
        total_violations=db.scalar(select(func.count()).select_from(Violation)) or 0,
        total_safety_scores=db.scalar(select(func.count()).select_from(SafetyScore)) or 0,
        scored_carriers=db.scalar(
            select(func.count(func.distinct(SafetyScore.carrier_id)))
        ) or 0,
        carriers_with_alerts=db.scalar(
            select(func.count(func.distinct(SafetyScore.carrier_id))).where(
                SafetyScore.alert_status == "alert"
            )
        ) or 0,
        states=db.scalar(
            select(func.count(func.distinct(Carrier.state))).where(
                Carrier.state.in_(US_STATE_CODES)
            )
        ) or 0,
    )
    _store("stats", data)
    return data


@router.get("/by-state", response_model=list[StateCount])
def carriers_by_state(db: Session = Depends(get_db)) -> list[StateCount]:
    cached = _cached("by_state")
    if cached is not None:
        return cached  # type: ignore[return-value]
    rows = db.execute(
        select(Carrier.state, func.count())
        .where(Carrier.is_active.is_(True), Carrier.state.in_(US_STATE_CODES))
        .group_by(Carrier.state)
        .order_by(func.count().desc())
    ).all()
    data = [StateCount(state=s, count=c) for s, c in rows]
    _store("by_state", data)
    return data


@router.get("/updates", response_model=UpdatesResponse)
def latest_updates(db: Session = Depends(get_db)) -> UpdatesResponse:
    cached = _cached("updates")
    if cached is not None:
        return cached  # type: ignore[return-value]
    from datetime import date, timedelta

    import httpx

    from app.models import Inspection
    from sqlalchemy import String, cast

    new_this_week: int | None = None
    week_ago = (date.today() - timedelta(days=7)).strftime("%Y%m%d")
    try:
        resp = httpx.get(
            "https://data.transportation.gov/resource/az4n-8mr2.json",
            params={
                "$select": "count(dot_number)",
                "$where": f"add_date >= '{week_ago}' AND status_code = 'A'",
            },
            timeout=10,
        )
        resp.raise_for_status()
        new_this_week = int(resp.json()[0]["count_dot_number"])
    except Exception:  # noqa: BLE001 - stat is best-effort
        new_this_week = None

    month_col = func.substr(cast(Inspection.inspection_date, String), 1, 7)
    latest = db.execute(
        select(month_col, func.count())
        .where(Inspection.inspection_date.is_not(None))
        .group_by(month_col)
        .order_by(month_col.desc())
        .limit(2)
    ).all()
    # The newest month in the file may be partial; take the fuller of the two.
    month, count = (None, 0)
    if latest:
        month, count = max(latest, key=lambda r: r[1])

    data = UpdatesResponse(
        new_carriers_this_week=new_this_week,
        inspections_month=month,
        inspections_last_month=count,
    )
    _store("updates", data)
    return data


def _paginate(db: Session, query: Select, page: int, per_page: int) -> CarrierListResponse:
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.offset((page - 1) * per_page).limit(per_page)).all()
    return CarrierListResponse(
        items=[CarrierSummary.model_validate(row) for row in rows],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


@router.get("", response_model=CarrierListResponse)
def list_carriers(
    state: str | None = None,
    operation_type: str | None = None,
    safety_rating: str | None = None,
    min_vehicles: int | None = Query(None, ge=0),
    max_vehicles: int | None = Query(None, ge=0),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> CarrierListResponse:
    query = select(Carrier).where(Carrier.is_active.is_(True))
    if state:
        query = query.where(Carrier.state == state.upper())
    if operation_type:
        query = query.where(Carrier.operation_type == operation_type)
    if safety_rating:
        query = query.where(Carrier.safety_rating == safety_rating)
    if min_vehicles is not None:
        query = query.where(Carrier.total_vehicles >= min_vehicles)
    if max_vehicles is not None:
        query = query.where(Carrier.total_vehicles <= max_vehicles)
    query = query.order_by(Carrier.total_vehicles.desc().nulls_last(), Carrier.id)
    return _paginate(db, query, page, per_page)


@router.get("/search", response_model=CarrierListResponse)
def search_carriers(
    q: str = Query(min_length=1, max_length=100),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> CarrierListResponse:
    term = q.strip()
    if term.isdigit():
        query = select(Carrier).where(
            or_(Carrier.usdot_number == term, Carrier.mc_number == term)
        )
    else:
        pattern = f"%{term}%"
        query = select(Carrier).where(
            or_(Carrier.legal_name.ilike(pattern), Carrier.dba_name.ilike(pattern))
        )
    query = query.order_by(Carrier.total_vehicles.desc().nulls_last(), Carrier.id)
    return _paginate(db, query, page, per_page)


@router.get("/top", response_model=list[CarrierSummary])
def top_carriers(
    limit: int = Query(1000, ge=1, le=10_000), db: Session = Depends(get_db)
) -> list[CarrierSummary]:
    rows = db.scalars(
        select(Carrier)
        .where(Carrier.is_active.is_(True), Carrier.slug.is_not(None))
        .order_by(Carrier.total_vehicles.desc().nulls_last(), Carrier.id)
        .limit(limit)
    ).all()
    return [CarrierSummary.model_validate(row) for row in rows]


@router.get("/slugs", response_model=list[str])
def carrier_slugs(
    page: int = Query(0, ge=0),
    per_page: int = Query(50_000, ge=1, le=50_000),
    db: Session = Depends(get_db),
) -> list[str]:
    """Slug pages for sitemap generation, ordered by id for stable chunking."""
    rows = db.scalars(
        select(Carrier.slug)
        .where(Carrier.is_active.is_(True), Carrier.slug.is_not(None))
        .order_by(Carrier.id)
        .offset(page * per_page)
        .limit(per_page)
    ).all()
    return [slug for slug in rows if slug]


@router.get("/by-slug/{slug}", response_model=CarrierDetail)
def get_carrier_by_slug(slug: str, db: Session = Depends(get_db)) -> CarrierDetail:
    carrier = db.scalar(select(Carrier).where(Carrier.slug == slug))
    if carrier is None and (usdot := usdot_from_slug(slug)):
        carrier = db.scalar(select(Carrier).where(Carrier.usdot_number == usdot))
    if carrier is None:
        raise HTTPException(status_code=404, detail="Carrier not found")
    return CarrierDetail.model_validate(carrier)


@router.get("/{usdot}", response_model=CarrierDetail)
def get_carrier(usdot: str, db: Session = Depends(get_db)) -> CarrierDetail:
    carrier = db.scalar(select(Carrier).where(Carrier.usdot_number == usdot))
    if carrier is None:
        raise HTTPException(status_code=404, detail="Carrier not found")
    return CarrierDetail.model_validate(carrier)


@router.get("/{usdot}/safety", response_model=CarrierSafetyResponse)
def get_carrier_safety(usdot: str, db: Session = Depends(get_db)) -> CarrierSafetyResponse:
    carrier = db.scalar(select(Carrier).where(Carrier.usdot_number == usdot))
    if carrier is None:
        raise HTTPException(status_code=404, detail="Carrier not found")
    # Explicit limited queries: mega fleets have tens of thousands of rows.
    inspections = db.scalars(
        select(Inspection)
        .where(Inspection.carrier_id == carrier.id)
        .order_by(Inspection.inspection_date.desc().nulls_last())
        .limit(50)
    ).all()
    violations = db.scalars(
        select(Violation)
        .where(Violation.carrier_id == carrier.id)
        .order_by(Violation.violation_date.desc().nulls_last())
        .limit(10)
    ).all()
    inspections_total = db.scalar(
        select(func.count()).select_from(Inspection).where(Inspection.carrier_id == carrier.id)
    ) or 0
    violations_total = db.scalar(
        select(func.count()).select_from(Violation).where(Violation.carrier_id == carrier.id)
    ) or 0
    # substr(date::text, 1, 7) -> 'YYYY-MM'; portable across Postgres and SQLite
    from sqlalchemy import String, cast

    month = func.substr(cast(Inspection.inspection_date, String), 1, 7)
    monthly = db.execute(
        select(month, func.count())
        .where(Inspection.carrier_id == carrier.id, Inspection.inspection_date.is_not(None))
        .group_by(month)
        .order_by(month)
    ).all()
    return CarrierSafetyResponse(
        usdot_number=carrier.usdot_number,
        safety_rating=carrier.safety_rating,
        safety_scores=carrier.safety_scores,
        inspections=inspections,
        violations=violations,
        inspections_total=inspections_total,
        violations_total=violations_total,
        inspections_monthly=[MonthlyCount(month=m, count=c) for m, c in monthly],
    )
