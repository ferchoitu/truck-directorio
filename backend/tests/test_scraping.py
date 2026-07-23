import pytest
import respx
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Carrier, ScrapingJob
from app.schemas import ScrapingStartRequest
from app.services.run_input import build_run_input

APIFY = "https://api.apify.com/v2"


def test_run_input_main_uses_dot_range() -> None:
    body = ScrapingStartRequest(actor="main", usdot_range_start=100, usdot_range_end=199)
    assert build_run_input(body) == {
        "dot_start": 100,
        "max_results": 100,
        "is_premium_mode": False,
    }


def test_run_input_safety_uses_dot_numbers() -> None:
    body = ScrapingStartRequest(actor="safety", usdot_range_start=5, usdot_range_end=7)
    result = build_run_input(body)
    assert result["dotNumbers"] == ["5", "6", "7"]
    assert result["maxItems"] == 3


def test_run_input_new_ignores_range() -> None:
    body = ScrapingStartRequest(actor="new", days_back=14)
    result = build_run_input(body)
    assert result["daysBack"] == 14
    assert result["incremental"] is True


def test_run_input_requires_range_for_main() -> None:
    with pytest.raises(ValueError):
        build_run_input(ScrapingStartRequest(actor="main"))


@respx.mock
def test_start_scraping_launches_apify_run(client: TestClient, db: Session) -> None:
    route = respx.post(f"{APIFY}/acts/jungle_synthesizer~fmcsa-dot-crawler/runs").mock(
        return_value=Response(201, json={"data": {"id": "run-abc"}})
    )
    resp = client.post(
        "/api/scraping/start",
        json={"actor": "main", "usdot_range_start": 1000, "usdot_range_end": 1099},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "running"
    assert data["apify_run_id"] == "run-abc"

    sent = route.calls.last.request
    assert b'"dot_start":1000' in sent.content.replace(b" ", b"")
    assert "webhooks=" in str(sent.url)

    job = db.get(ScrapingJob, data["id"])
    assert job is not None and job.status == "running"


@respx.mock
def test_start_scraping_marks_job_failed_on_apify_error(
    client: TestClient, db: Session
) -> None:
    respx.post(f"{APIFY}/acts/jungle_synthesizer~fmcsa-dot-crawler/runs").mock(
        return_value=Response(500, json={"error": "boom"})
    )
    resp = client.post(
        "/api/scraping/start",
        json={"actor": "main", "usdot_range_start": 1, "usdot_range_end": 10},
    )
    assert resp.status_code == 502
    job = db.scalar(select(ScrapingJob))
    assert job is not None and job.status == "failed"


def test_start_scraping_validates_range(client: TestClient) -> None:
    resp = client.post(
        "/api/scraping/start",
        json={"actor": "main", "usdot_range_start": 100, "usdot_range_end": 1},
    )
    assert resp.status_code == 422


def test_scraping_routes_require_api_key(client: TestClient) -> None:
    resp = client.get("/api/scraping/jobs", headers={"X-API-Key": "wrong"})
    assert resp.status_code == 401


def test_scraping_start_is_rate_limited(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "scraping_start_rate_limit_per_minute", 1)
    invalid_body = {"actor": "main", "usdot_range_start": 100, "usdot_range_end": 1}

    assert client.post("/api/scraping/start", json=invalid_body).status_code == 422
    resp = client.post("/api/scraping/start", json=invalid_body)

    assert resp.status_code == 429
    assert int(resp.headers["Retry-After"]) >= 1


@respx.mock
def test_webhook_success_ingests_dataset(client: TestClient, db: Session) -> None:
    job = ScrapingJob(actor_id=get_settings().apify_actor_main, status="running")
    db.add(job)
    db.commit()

    respx.get(f"{APIFY}/datasets/ds-1/items").mock(
        return_value=Response(
            200,
            json=[{"usdotNumber": "777", "legalName": "Webhook Freight", "physicalState": "FL"}],
        )
    )
    resp = client.post(
        "/api/webhooks/apify",
        params={"job_id": job.id, "secret": "test-secret"},
        json={"eventType": "ACTOR.RUN.SUCCEEDED", "resource": {"defaultDatasetId": "ds-1"}},
    )
    assert resp.status_code == 200
    assert resp.json()["processed"] == 1

    carrier = db.scalar(select(Carrier).where(Carrier.usdot_number == "777"))
    assert carrier is not None and carrier.legal_name == "Webhook Freight"
    db.refresh(job)
    assert job.status == "completed"
    assert job.total_records == 1


def test_webhook_failed_run_marks_job(client: TestClient, db: Session) -> None:
    job = ScrapingJob(actor_id=get_settings().apify_actor_main, status="running")
    db.add(job)
    db.commit()

    resp = client.post(
        "/api/webhooks/apify",
        params={"job_id": job.id, "secret": "test-secret"},
        json={"eventType": "ACTOR.RUN.FAILED", "resource": {}},
    )
    assert resp.status_code == 200
    db.refresh(job)
    assert job.status == "failed"
