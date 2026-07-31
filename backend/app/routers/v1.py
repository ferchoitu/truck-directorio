"""Commercial API surface: same data as the public site, behind an API key and quota.

The public `/api/carriers/*` routes stay open because the website itself renders
from them server-side. Everything sold to customers lives here instead.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Subscriber
from app.routers import carriers as public
from app.schemas import (
    CarrierDetail,
    CarrierListResponse,
    CarrierSafetyResponse,
    CarrierSummary,
    UsageResponse,
)
from app.services.billing import consume_quota, hash_api_key

router = APIRouter(prefix="/api/v1", tags=["v1"])

ACTIVE_STATUSES = {"active", "trialing"}


def resolve_subscriber(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Subscriber:
    """Map a bearer API key to an active subscriber, without billing a request."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Provide your API key as: Authorization: Bearer <key>",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(None, 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid API key")

    subscriber = db.scalar(
        select(Subscriber).where(Subscriber.api_key_hash == hash_api_key(token))
    )
    if subscriber is None:
        raise HTTPException(status_code=401, detail="Invalid API key")
    if subscriber.status not in ACTIVE_STATUSES:
        raise HTTPException(status_code=403, detail="Subscription is not active")
    return subscriber


def billed(
    subscriber: Subscriber = Depends(resolve_subscriber),
    db: Session = Depends(get_db),
) -> Subscriber:
    """Authenticate and count the call against the monthly allowance."""
    if not consume_quota(db, subscriber):
        raise HTTPException(
            status_code=429,
            detail=f"Monthly quota of {subscriber.monthly_quota} requests exhausted",
        )
    return subscriber


@router.get("/usage", response_model=UsageResponse)
def usage(
    subscriber: Subscriber = Depends(resolve_subscriber),
) -> UsageResponse:
    """Current quota consumption. Does not itself count against the quota."""
    return UsageResponse(
        plan=subscriber.plan,
        status=subscriber.status,
        monthly_quota=subscriber.monthly_quota,
        usage_count=subscriber.usage_count,
        remaining=max(subscriber.monthly_quota - subscriber.usage_count, 0),
        period_start=subscriber.usage_period_start,
    )


@router.get("/carriers", response_model=CarrierListResponse)
def list_carriers(
    state: str | None = None,
    operation_type: str | None = None,
    safety_rating: str | None = None,
    min_vehicles: int | None = Query(None, ge=0),
    max_vehicles: int | None = Query(None, ge=0),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: Subscriber = Depends(billed),
) -> CarrierListResponse:
    return public.list_carriers(
        state=state,
        operation_type=operation_type,
        safety_rating=safety_rating,
        min_vehicles=min_vehicles,
        max_vehicles=max_vehicles,
        page=page,
        per_page=per_page,
        db=db,
    )


@router.get("/carriers/search", response_model=CarrierListResponse)
def search_carriers(
    q: str = Query(min_length=1, max_length=100),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: Subscriber = Depends(billed),
) -> CarrierListResponse:
    return public.search_carriers(q=q, page=page, per_page=per_page, db=db)


@router.get("/carriers/top", response_model=list[CarrierSummary])
def top_carriers(
    limit: int = Query(1000, ge=1, le=10_000),
    db: Session = Depends(get_db),
    _: Subscriber = Depends(billed),
) -> list[CarrierSummary]:
    return public.top_carriers(limit=limit, db=db)


@router.get("/carriers/by-slug/{slug}", response_model=CarrierDetail)
def get_carrier_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    _: Subscriber = Depends(billed),
) -> CarrierDetail:
    return public.get_carrier_by_slug(slug=slug, db=db)


@router.get("/carriers/{usdot}", response_model=CarrierDetail)
def get_carrier(
    usdot: str,
    db: Session = Depends(get_db),
    _: Subscriber = Depends(billed),
) -> CarrierDetail:
    return public.get_carrier(usdot=usdot, db=db)


@router.get("/carriers/{usdot}/safety", response_model=CarrierSafetyResponse)
def get_carrier_safety(
    usdot: str,
    db: Session = Depends(get_db),
    _: Subscriber = Depends(billed),
) -> CarrierSafetyResponse:
    return public.get_carrier_safety(usdot=usdot, db=db)
