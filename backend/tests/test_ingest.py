from sqlalchemy.orm import Session

from app.models import Carrier
from app.services.ingest import upsert_carrier


def test_upsert_carrier_accepts_official_census_fields(db: Session) -> None:
    carrier = upsert_carrier(
        db,
        {
            "dot_number": "123456",
            "legal_name": "OFFICIAL FREIGHT LLC",
            "dba_name": "Official Freight",
            "phy_street": "1 MAIN ST",
            "phy_city": "AUSTIN",
            "phy_state": "TX",
            "phy_zip": "78701",
            "telephone": "5125550100",
            "email_address": "dispatch@example.com",
            "nbr_power_unit": "12",
            "driver_total": "15",
            "dun_bradstreet_no": "123456789",
        },
    )
    db.commit()

    assert carrier is not None
    row = db.query(Carrier).filter_by(usdot_number="123456").one()
    assert row.email == "dispatch@example.com"
    assert row.total_vehicles == 12
    assert row.total_drivers == 15
    assert row.slug == "official-freight-llc-usdot-123456"


def test_upsert_carrier_does_not_erase_existing_values(db: Session) -> None:
    carrier = upsert_carrier(
        db,
        {"dot_number": "123456", "legal_name": "FIRST NAME", "email_address": "a@example.com"},
    )
    db.commit()
    assert carrier is not None

    upsert_carrier(db, {"dot_number": "123456", "legal_name": "UPDATED NAME"})
    db.commit()
    db.refresh(carrier)

    assert carrier.legal_name == "UPDATED NAME"
    assert carrier.email == "a@example.com"


def test_upsert_carrier_rejects_invalid_usdot(db: Session) -> None:
    assert upsert_carrier(db, {"dot_number": "not-a-number"}) is None
