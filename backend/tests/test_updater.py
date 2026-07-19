import respx
from httpx import Response
from sqlalchemy.orm import Session

from app.models import Carrier
from app.services.ingest import upsert_carrier
from app.updater import CENSUS_URL, census_record_to_ingest

RAW_CENSUS_ROW = {
    "dot_number": "4600001",
    "legal_name": "NEW HAULER LLC",
    "phy_street": "1 NEW RD",
    "phy_city": "AUSTIN",
    "phy_state": "TX",
    "phy_zip": "78701",
    "phone": "5125550100",
    "carrier_operation": "A",
    "business_org_desc": "LLC",
    "power_units": "3",
    "status_code": "A",
}


def test_census_record_mapping(db: Session) -> None:
    carrier = upsert_carrier(db, census_record_to_ingest(RAW_CENSUS_ROW))
    db.commit()
    assert carrier is not None
    row = db.query(Carrier).filter_by(usdot_number="4600001").one()
    assert row.legal_name == "NEW HAULER LLC"
    assert row.state == "TX"
    assert row.operation_type == "Interstate"
    assert row.total_vehicles == 3
    assert row.slug == "new-hauler-llc-usdot-4600001"


def test_census_record_mapping_caps_garbage_fleet() -> None:
    mapped = census_record_to_ingest({**RAW_CENSUS_ROW, "power_units": "4504505"})
    assert mapped["total_vehicles"] is None


@respx.mock
def test_fetch_new_carriers_paginates() -> None:
    import asyncio

    from app.updater import fetch_new_carriers

    route = respx.get(CENSUS_URL).mock(
        side_effect=[
            Response(200, json=[RAW_CENSUS_ROW]),
        ]
    )
    from datetime import date

    records = asyncio.run(fetch_new_carriers(date(2026, 7, 9)))
    from urllib.parse import unquote_plus

    assert len(records) == 1
    assert "add_date >= '20260709'" in unquote_plus(str(route.calls.last.request.url))
