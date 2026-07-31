import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Subscriber
from app.schemas import ClaimKeyRequest, ClaimKeyResponse
from app.services.billing import (
    PLAN_QUOTAS,
    fetch_customer,
    fetch_transaction,
    issue_api_key,
    verify_webhook,
)

router = APIRouter(prefix="/api/billing", tags=["billing"])

# Paddle subscription statuses we mirror verbatim; anything else is stored as-is.
ACTIVE_STATUSES = {"active", "trialing"}

DEFAULT_PLAN = "growth"


def _price_id(data: dict) -> str | None:
    for item in data.get("items") or []:
        price = item.get("price") or {}
        if price.get("id"):
            return price["id"]
    return None


def _plan_for(data: dict) -> str:
    """Resolve which plan a subscription is on from its Paddle price id.

    Falls back to the entry plan instead of rejecting: by the time a webhook
    arrives the customer has already been charged, so an unrecognised price
    should still provision rather than leave them with nothing.
    """
    settings = get_settings()
    prices = {
        settings.paddle_price_id_growth: "growth",
        settings.paddle_price_id_standard: "standard",
        settings.paddle_price_id_pro: "pro",
    }
    # Unconfigured tiers leave an empty-string key behind; drop it so a payload
    # with no price does not accidentally match one of them.
    prices.pop("", None)
    return prices.get(_price_id(data) or "") or DEFAULT_PLAN


async def _upsert_subscription(db: Session, data: dict) -> None:
    subscription_id = data.get("id")
    if not subscription_id:
        return

    subscriber = db.scalar(
        select(Subscriber).where(
            Subscriber.paddle_subscription_id == subscription_id
        )
    )
    status = data.get("status") or "active"
    customer_id = data.get("customer_id")
    plan = _plan_for(data)
    quota = PLAN_QUOTAS.get(plan, PLAN_QUOTAS[DEFAULT_PLAN])

    if subscriber is None:
        # Paddle's subscription payload carries no email, only a customer reference.
        email = await fetch_customer(customer_id) if customer_id else None
        subscriber = Subscriber(
            email=email or "",
            paddle_subscription_id=subscription_id,
            paddle_customer_id=customer_id,
            plan=plan,
            status=status,
            monthly_quota=quota,
        )
        db.add(subscriber)
    else:
        subscriber.status = status
        if customer_id:
            subscriber.paddle_customer_id = customer_id
        # Plan changes arrive as subscription.updated; move the allowance with it.
        if subscriber.plan != plan:
            subscriber.plan = plan
            subscriber.monthly_quota = quota

    db.commit()


@router.post("/webhook")
async def paddle_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    # The signature covers the exact bytes Paddle sent, so verify before parsing.
    raw_body = await request.body()
    signature = request.headers.get("Paddle-Signature")
    if not verify_webhook(raw_body, signature, get_settings().paddle_webhook_secret):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Malformed payload")

    event_type = payload.get("event_type", "")
    data = payload.get("data") or {}

    if event_type.startswith("subscription."):
        await _upsert_subscription(db, data)

    # Always 200 on a verified event: Paddle retries anything else, and we do not
    # want retries for event types we simply do not act on.
    return {"received": True}


@router.post("/claim", response_model=ClaimKeyResponse)
async def claim_key(
    body: ClaimKeyRequest, db: Session = Depends(get_db)
) -> ClaimKeyResponse:
    """Exchange a completed Paddle transaction for a freshly minted API key.

    Calling this again rotates the key — the previously issued one stops working.
    """
    transaction = await fetch_transaction(body.transaction_id)
    if not transaction or transaction.get("status") != "completed":
        raise HTTPException(status_code=404, detail="No completed transaction found")

    subscription_id = transaction.get("subscription_id")
    if not subscription_id:
        raise HTTPException(
            status_code=400, detail="Transaction is not tied to a subscription"
        )

    subscriber = db.scalar(
        select(Subscriber).where(
            Subscriber.paddle_subscription_id == subscription_id
        )
    )
    if subscriber is None:
        raise HTTPException(
            status_code=409,
            detail="Subscription not provisioned yet — retry in a few seconds",
        )
    if subscriber.status not in ACTIVE_STATUSES:
        raise HTTPException(status_code=403, detail="Subscription is not active")

    plaintext = issue_api_key(db, subscriber)
    return ClaimKeyResponse(
        api_key=plaintext,
        plan=subscriber.plan,
        monthly_quota=subscriber.monthly_quota,
    )
