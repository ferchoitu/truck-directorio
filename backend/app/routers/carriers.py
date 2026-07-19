import math
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Carrier
from app.schemas import (
    CarrierDetail,
    CarrierListResponse,
    CarrierSafetyResponse,
    CarrierSummary,
)
from app.services.slugs import usdot_from_slug

router = APIRouter(prefix="/api/carriers", tags=["carriers"])


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
    return CarrierSafetyResponse(
        usdot_number=carrier.usdot_number,
        safety_rating=carrier.safety_rating,
        safety_scores=carrier.safety_scores,
        inspections=sorted(
            carrier.inspections, key=lambda i: i.inspection_date or date.min, reverse=True
        ),
        violations=sorted(
            carrier.violations, key=lambda v: v.violation_date or date.min, reverse=True
        )[:10],
    )
