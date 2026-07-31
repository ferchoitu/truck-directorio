"""Paddle billing helpers: webhook signature checks, API keys, and quota accounting."""

import hashlib
import hmac
import secrets
import time
from datetime import UTC, date, datetime

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Subscriber

# Paddle signs each webhook with a timestamp; anything older is treated as a replay.
MAX_SIGNATURE_AGE_SECONDS = 300

QUOTA_PERIOD_DAYS = 30

# Monthly request allowance per plan. Each step up buys a better unit rate
# ($0.98 / $0.67 / $0.50 per 1k) so upgrading is always the cheaper move.
PLAN_QUOTAS = {"growth": 50000, "standard": 150000, "pro": 300000}


def parse_signature(header: str) -> tuple[int, str] | None:
    """Split a `ts=...;h1=...` Paddle-Signature header into its parts."""
    ts: str | None = None
    h1: str | None = None
    for part in header.split(";"):
        key, _, value = part.partition("=")
        key = key.strip()
        if key == "ts":
            ts = value.strip()
        elif key == "h1":
            h1 = value.strip()
    if not ts or not h1 or not ts.isdigit():
        return None
    return int(ts), h1


def verify_webhook(raw_body: bytes, signature_header: str | None, secret: str) -> bool:
    """Constant-time HMAC check over Paddle's `{ts}:{raw_body}` signed payload."""
    if not secret or not signature_header:
        return False
    parsed = parse_signature(signature_header)
    if parsed is None:
        return False
    ts, provided = parsed
    if abs(time.time() - ts) > MAX_SIGNATURE_AGE_SECONDS:
        return False
    signed_payload = f"{ts}:".encode() + raw_body
    expected = hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided)


def hash_api_key(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode()).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """Mint a key. Returns (plaintext, sha256_hash, display_prefix).

    The plaintext is never persisted — callers must hand it to the customer in the
    same response or it is gone for good.
    """
    env_tag = "live" if get_settings().paddle_environment == "live" else "test"
    plaintext = f"yt_{env_tag}_{secrets.token_urlsafe(32)}"
    return plaintext, hash_api_key(plaintext), plaintext[:14]


def issue_api_key(db: Session, subscriber: Subscriber) -> str:
    """Rotate the subscriber's key, returning the new plaintext exactly once."""
    plaintext, key_hash, prefix = generate_api_key()
    subscriber.api_key_hash = key_hash
    subscriber.api_key_prefix = prefix
    # Column is naive; keep it UTC-consistent with the server_default timestamps.
    subscriber.api_key_issued_at = datetime.now(UTC).replace(tzinfo=None)
    db.commit()
    return plaintext


def consume_quota(db: Session, subscriber: Subscriber) -> bool:
    """Count one request against the rolling monthly allowance.

    Returns False when the subscriber is already at their limit.
    """
    today = date.today()
    start = subscriber.usage_period_start
    if start is None or (today - start).days >= QUOTA_PERIOD_DAYS:
        subscriber.usage_period_start = today
        subscriber.usage_count = 0
    if subscriber.usage_count >= subscriber.monthly_quota:
        db.commit()
        return False
    subscriber.usage_count += 1
    db.commit()
    return True


async def _paddle_get(path: str) -> dict | None:
    settings = get_settings()
    if not settings.paddle_api_key:
        return None
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.paddle_api_base}{path}",
            headers={"Authorization": f"Bearer {settings.paddle_api_key}"},
        )
    if response.status_code != 200:
        return None
    return response.json().get("data")


async def fetch_transaction(transaction_id: str) -> dict | None:
    """Look up a transaction in Paddle so we never trust a client-supplied id."""
    return await _paddle_get(f"/transactions/{transaction_id}")


async def fetch_customer(customer_id: str) -> str | None:
    """Resolve a Paddle customer id to an email address."""
    data = await _paddle_get(f"/customers/{customer_id}")
    return (data or {}).get("email")
