import hashlib
import hmac
import json
import time
from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Subscriber
from app.services.billing import (
    consume_quota,
    generate_api_key,
    hash_api_key,
    issue_api_key,
    verify_webhook,
)

SECRET = "pdl_ntfset_test_secret"


def sign(body: bytes, secret: str = SECRET, ts: int | None = None) -> str:
    ts = ts if ts is not None else int(time.time())
    digest = hmac.new(secret.encode(), f"{ts}:".encode() + body, hashlib.sha256)
    return f"ts={ts};h1={digest.hexdigest()}"


def make_subscriber(db: Session, **overrides) -> tuple[Subscriber, str]:
    plaintext, key_hash, prefix = generate_api_key()
    fields = {
        "email": "buyer@example.com",
        "paddle_subscription_id": "sub_123",
        "paddle_customer_id": "ctm_123",
        "plan": "growth",
        "status": "active",
        "api_key_hash": key_hash,
        "api_key_prefix": prefix,
        "monthly_quota": 5,
        "usage_count": 0,
        "usage_period_start": date.today(),
    }
    fields.update(overrides)
    subscriber = Subscriber(**fields)
    db.add(subscriber)
    db.commit()
    return subscriber, plaintext


class TestWebhookSignature:
    def test_accepts_a_correctly_signed_body(self):
        body = b'{"event_type":"subscription.created"}'
        assert verify_webhook(body, sign(body), SECRET) is True

    def test_rejects_a_tampered_body(self):
        signature = sign(b'{"amount":"49"}')
        assert verify_webhook(b'{"amount":"1"}', signature, SECRET) is False

    def test_rejects_a_wrong_secret(self):
        body = b"{}"
        assert verify_webhook(body, sign(body), "pdl_ntfset_other") is False

    def test_rejects_a_stale_timestamp(self):
        body = b"{}"
        stale = int(time.time()) - 600
        assert verify_webhook(body, sign(body, ts=stale), SECRET) is False

    def test_rejects_missing_or_malformed_headers(self):
        body = b"{}"
        assert verify_webhook(body, None, SECRET) is False
        assert verify_webhook(body, "garbage", SECRET) is False
        assert verify_webhook(body, "ts=abc;h1=def", SECRET) is False

    def test_rejects_when_no_secret_is_configured(self):
        body = b"{}"
        assert verify_webhook(body, sign(body), "") is False


class TestWebhookEndpoint:
    def test_unsigned_request_is_rejected(self, client: TestClient):
        response = client.post("/api/billing/webhook", json={"event_type": "x"})
        assert response.status_code == 401

    def test_signed_event_provisions_a_subscriber(
        self, client: TestClient, db: Session, monkeypatch
    ):
        get_settings.cache_clear()
        monkeypatch.setenv("PADDLE_WEBHOOK_SECRET", SECRET)

        async def fake_customer(customer_id: str) -> str:
            return "buyer@example.com"

        monkeypatch.setattr("app.routers.billing.fetch_customer", fake_customer)

        payload = {
            "event_type": "subscription.created",
            "data": {
                "id": "sub_new",
                "status": "active",
                "customer_id": "ctm_new",
                "items": [{"price": {"id": "pri_growth"}}],
            },
        }
        body = json.dumps(payload).encode()
        response = client.post(
            "/api/billing/webhook",
            content=body,
            headers={
                "Paddle-Signature": sign(body),
                "Content-Type": "application/json",
            },
        )
        assert response.status_code == 200

        subscriber = db.query(Subscriber).filter_by(paddle_subscription_id="sub_new").one()
        assert subscriber.email == "buyer@example.com"
        assert subscriber.status == "active"
        assert subscriber.monthly_quota == 50000
        get_settings.cache_clear()


class TestEnvironmentResolution:
    """Frontend and backend must agree on what "live" means."""

    def _base_for(self, value: str, monkeypatch) -> str:
        monkeypatch.setenv("PADDLE_ENVIRONMENT", value)
        get_settings.cache_clear()
        try:
            return get_settings().paddle_api_base
        finally:
            get_settings.cache_clear()

    def test_live_and_production_both_mean_live(self, monkeypatch):
        for value in ("live", "production", "Production", "LIVE"):
            assert self._base_for(value, monkeypatch) == "https://api.paddle.com"

    def test_anything_else_stays_on_sandbox(self, monkeypatch):
        for value in ("sandbox", "", "staging"):
            assert self._base_for(value, monkeypatch) == "https://sandbox-api.paddle.com"


class TestPlanResolution:
    """The plan (and therefore the quota) comes from the Paddle price id."""

    def _plan_for(self, data: dict, monkeypatch, **prices: str) -> str:
        from app.routers.billing import _plan_for

        for tier in ("growth", "standard", "pro"):
            monkeypatch.setenv(
                f"PADDLE_PRICE_ID_{tier.upper()}", prices.get(tier, "")
            )
        get_settings.cache_clear()
        try:
            return _plan_for(data)
        finally:
            get_settings.cache_clear()

    def _item(self, price_id: str) -> dict:
        return {"items": [{"price": {"id": price_id}}]}

    def test_each_price_maps_to_its_own_plan(self, monkeypatch):
        configured = {"growth": "pri_g", "standard": "pri_s", "pro": "pri_p"}
        for plan, price in configured.items():
            assert (
                self._plan_for(self._item(price), monkeypatch, **configured) == plan
            )

    def test_unrecognised_price_still_provisions(self, monkeypatch):
        from app.routers.billing import DEFAULT_PLAN

        result = self._plan_for(
            self._item("pri_some_future_tier"), monkeypatch, growth="pri_g"
        )
        assert result == DEFAULT_PLAN

    def test_missing_items_does_not_crash(self, monkeypatch):
        from app.routers.billing import DEFAULT_PLAN

        assert self._plan_for({}, monkeypatch, growth="pri_g") == DEFAULT_PLAN

    def test_unconfigured_tier_cannot_be_claimed_by_a_priceless_payload(
        self, monkeypatch
    ):
        """An unset tier leaves an empty-string key behind.

        Without pruning it, a payload carrying no price id resolves to "" and
        would silently be granted that tier — handing out the top plan free.
        """
        from app.routers.billing import DEFAULT_PLAN

        # `pro` deliberately left unconfigured.
        assert (
            self._plan_for({}, monkeypatch, growth="pri_g", standard="pri_s")
            == DEFAULT_PLAN
        )
        assert (
            self._plan_for(self._item(""), monkeypatch, growth="pri_g")
            == DEFAULT_PLAN
        )


class TestApiKeyAuth:
    def test_missing_key_is_unauthorized(self, client: TestClient):
        assert client.get("/api/v1/carriers").status_code == 401

    def test_invalid_key_is_unauthorized(self, client: TestClient):
        response = client.get(
            "/api/v1/carriers", headers={"Authorization": "Bearer yt_test_nonsense"}
        )
        assert response.status_code == 401

    def test_valid_key_is_accepted(self, client: TestClient, db: Session):
        _, key = make_subscriber(db)
        response = client.get(
            "/api/v1/carriers", headers={"Authorization": f"Bearer {key}"}
        )
        assert response.status_code == 200

    def test_canceled_subscription_is_forbidden(self, client: TestClient, db: Session):
        _, key = make_subscriber(db, status="canceled")
        response = client.get(
            "/api/v1/carriers", headers={"Authorization": f"Bearer {key}"}
        )
        assert response.status_code == 403

    def test_public_routes_stay_open(self, client: TestClient):
        assert client.get("/api/carriers").status_code == 200


class TestQuota:
    def test_requests_are_counted_and_then_blocked(
        self, client: TestClient, db: Session
    ):
        subscriber, key = make_subscriber(db, monthly_quota=2)
        headers = {"Authorization": f"Bearer {key}"}

        assert client.get("/api/v1/carriers", headers=headers).status_code == 200
        assert client.get("/api/v1/carriers", headers=headers).status_code == 200
        assert client.get("/api/v1/carriers", headers=headers).status_code == 429

    def test_usage_endpoint_does_not_consume_quota(
        self, client: TestClient, db: Session
    ):
        subscriber, key = make_subscriber(db, monthly_quota=3)
        headers = {"Authorization": f"Bearer {key}"}

        client.get("/api/v1/usage", headers=headers)
        response = client.get("/api/v1/usage", headers=headers)
        assert response.json()["usage_count"] == 0
        assert response.json()["remaining"] == 3

    def test_period_rolls_over_after_30_days(self, db: Session):
        subscriber, _ = make_subscriber(
            db,
            monthly_quota=1,
            usage_count=1,
            usage_period_start=date.today() - timedelta(days=31),
        )
        assert consume_quota(db, subscriber) is True
        assert subscriber.usage_count == 1
        assert subscriber.usage_period_start == date.today()


class TestKeyIssuance:
    def test_rotation_invalidates_the_previous_key(self, client: TestClient, db: Session):
        subscriber, old_key = make_subscriber(db)
        new_key = issue_api_key(db, subscriber)

        assert new_key != old_key
        assert (
            client.get(
                "/api/v1/carriers", headers={"Authorization": f"Bearer {old_key}"}
            ).status_code
            == 401
        )
        assert (
            client.get(
                "/api/v1/carriers", headers={"Authorization": f"Bearer {new_key}"}
            ).status_code
            == 200
        )

    def test_plaintext_is_never_persisted(self, db: Session):
        subscriber, key = make_subscriber(db)
        assert subscriber.api_key_hash == hash_api_key(key)
        assert key not in (subscriber.api_key_hash or "")
        assert len(subscriber.api_key_hash) == 64
