from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Carrier
from app.services.slugs import carrier_slug


def seed(db: Session) -> None:
    for usdot, name, state, vehicles, rating in [
        ("100001", "Alpha Freight", "TX", 50, "Satisfactory"),
        ("100002", "Beta Logistics", "CA", 5, "Conditional"),
        ("100003", "Gamma Haulers", "TX", None, None),
    ]:
        db.add(
            Carrier(
                usdot_number=usdot,
                legal_name=name,
                state=state,
                total_vehicles=vehicles,
                safety_rating=rating,
                slug=carrier_slug(name, usdot),
            )
        )
    db.commit()


def test_health(client: TestClient) -> None:
    assert client.get("/api/health").json() == {"status": "ok"}


def test_list_carriers_filters_by_state(client: TestClient, db: Session) -> None:
    seed(db)
    data = client.get("/api/carriers", params={"state": "tx"}).json()
    assert data["total"] == 2
    assert all(item["state"] == "TX" for item in data["items"])


def test_list_carriers_pagination(client: TestClient, db: Session) -> None:
    seed(db)
    data = client.get("/api/carriers", params={"per_page": 2, "page": 2}).json()
    assert data["pages"] == 2
    assert len(data["items"]) == 1


def test_search_by_name(client: TestClient, db: Session) -> None:
    seed(db)
    data = client.get("/api/carriers/search", params={"q": "beta"}).json()
    assert data["total"] == 1
    assert data["items"][0]["usdot_number"] == "100002"


def test_search_by_usdot(client: TestClient, db: Session) -> None:
    seed(db)
    data = client.get("/api/carriers/search", params={"q": "100001"}).json()
    assert data["total"] == 1
    assert data["items"][0]["legal_name"] == "Alpha Freight"


def test_get_carrier_detail(client: TestClient, db: Session) -> None:
    seed(db)
    resp = client.get("/api/carriers/100001")
    assert resp.status_code == 200
    assert resp.json()["legal_name"] == "Alpha Freight"


def test_get_carrier_by_slug(client: TestClient, db: Session) -> None:
    seed(db)
    resp = client.get("/api/carriers/by-slug/alpha-freight-usdot-100001")
    assert resp.status_code == 200
    assert resp.json()["usdot_number"] == "100001"


def test_get_carrier_404(client: TestClient) -> None:
    assert client.get("/api/carriers/999999").status_code == 404


def test_top_carriers_ordered_by_fleet(client: TestClient, db: Session) -> None:
    seed(db)
    items = client.get("/api/carriers/top", params={"limit": 2}).json()
    assert [i["usdot_number"] for i in items] == ["100001", "100002"]


def test_safety_endpoint_empty(client: TestClient, db: Session) -> None:
    seed(db)
    data = client.get("/api/carriers/100001/safety").json()
    assert data["usdot_number"] == "100001"
    assert data["safety_scores"] == []


def test_stats_endpoint(client: TestClient, db: Session) -> None:
    seed(db)
    from app.routers.carriers import _stats_cache

    _stats_cache["data"] = None
    data = client.get("/api/carriers/stats").json()
    assert data["total_carriers"] == 3
    assert data["states"] == 2
    _stats_cache["data"] = None


def test_safety_includes_totals_and_monthly(client: TestClient, db: Session) -> None:
    from datetime import date as d

    from app.models import Inspection

    seed(db)
    carrier = db.query(Carrier).filter_by(usdot_number="100001").one()
    db.add_all(
        [
            Inspection(carrier_id=carrier.id, inspection_date=d(2026, 5, 1)),
            Inspection(carrier_id=carrier.id, inspection_date=d(2026, 5, 20)),
            Inspection(carrier_id=carrier.id, inspection_date=d(2026, 6, 3)),
        ]
    )
    db.commit()
    data = client.get("/api/carriers/100001/safety").json()
    assert data["inspections_total"] == 3
    assert {"month": "2026-05", "count": 2} in data["inspections_monthly"]


def test_carrier_slugs_for_sitemap(client: TestClient, db: Session) -> None:
    seed(db)
    slugs = client.get("/api/carriers/slugs", params={"per_page": 2, "page": 0}).json()
    assert len(slugs) == 2
    assert all(s.endswith(("-usdot-100001", "-usdot-100002")) for s in slugs)
    page2 = client.get("/api/carriers/slugs", params={"per_page": 2, "page": 1}).json()
    assert len(page2) == 1


def test_webhook_rejects_bad_secret(client: TestClient) -> None:
    resp = client.post(
        "/api/webhooks/apify",
        params={"job_id": 1, "secret": "wrong"},
        json={"eventType": "ACTOR.RUN.SUCCEEDED"},
    )
    assert resp.status_code == 401
