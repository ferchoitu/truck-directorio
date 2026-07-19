from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Carrier
from app.services.ingest import ingest_dataset

MAIN_RECORD = {
    "usdotNumber": "123456",
    "legalName": "ACME Trucking LLC",
    "dbaName": "ACME",
    "physicalAddress": "1 Main St",
    "physicalCity": "Dallas",
    "physicalState": "TX",
    "zipCode": "75001",
    "phone": "(555) 555-0100",
    "powerUnits": "12",
    "totalDrivers": 15,
    "operatingStatus": "AUTHORIZED",
}

SAFETY_RECORD = {
    "dotNumber": "123456",
    "safetyRating": "Satisfactory",
    "basicScores": [
        {"category": "Unsafe Driving", "score": "3.1", "percentile": 45, "alert": "none"}
    ],
    "inspections": [
        {"date": "2026-01-15", "type": "Level I", "vehicles": 1, "violations": 2, "state": "TX"}
    ],
    "violations": [
        {"code": "392.2", "description": "Speeding", "date": "01/15/2026", "oos": "true"}
    ],
}


def test_ingest_main_dataset_creates_carrier(db: Session) -> None:
    processed = ingest_dataset(db, [MAIN_RECORD], safety=False)
    assert processed == 1

    carrier = db.scalar(select(Carrier).where(Carrier.usdot_number == "123456"))
    assert carrier is not None
    assert carrier.legal_name == "ACME Trucking LLC"
    assert carrier.state == "TX"
    assert carrier.total_vehicles == 12
    assert carrier.slug == "acme-trucking-llc-usdot-123456"


def test_ingest_is_idempotent(db: Session) -> None:
    ingest_dataset(db, [MAIN_RECORD], safety=False)
    ingest_dataset(db, [{**MAIN_RECORD, "totalDrivers": 20}], safety=False)

    carriers = db.scalars(select(Carrier)).all()
    assert len(carriers) == 1
    assert carriers[0].total_drivers == 20


def test_ingest_skips_records_without_usdot(db: Session) -> None:
    processed = ingest_dataset(db, [{"legalName": "No DOT Inc"}], safety=False)
    assert processed == 0


# Real output shape of jungle_synthesizer/fmcsa-dot-crawler (captured 2026-07-19)
REAL_MAIN_RECORD = {
    "DOT_num": "3500001",
    "entity_type": "CARRIER",
    "legal_name": "INDUSTRIAL APPLIED TECHNOLOGIES LLC",
    "dba_name": "",
    "mc_mx_ff_numbers": None,
    "phone": "5017737904",
    "physical_address": "12640 DELTA ST, TAYLOR, MI, 48103, US",
    "power_units": 11,
    "drivers": 5,
    "carrier_operation": ["Interstate"],
    "DUNS_num": "",
    "email": "TBEARDEN.IATLLC@GMAIL.COM",
    "safety_rating": {"rating": "No rating", "rating_date": None, "type": "No review"},
}


def test_ingest_real_dot_crawler_record(db: Session) -> None:
    processed = ingest_dataset(db, [REAL_MAIN_RECORD], safety=False)
    assert processed == 1

    carrier = db.scalar(select(Carrier).where(Carrier.usdot_number == "3500001"))
    assert carrier is not None
    assert carrier.legal_name == "INDUSTRIAL APPLIED TECHNOLOGIES LLC"
    assert carrier.address == "12640 DELTA ST"
    assert carrier.city == "TAYLOR"
    assert carrier.state == "MI"
    assert carrier.zip == "48103"
    assert carrier.total_vehicles == 11
    assert carrier.total_drivers == 5
    assert carrier.operation_type == "Interstate"
    assert carrier.carrier_classification == "CARRIER"
    assert carrier.email == "TBEARDEN.IATLLC@GMAIL.COM"
    assert carrier.safety_rating is None  # "No rating" normalizes to null


def test_ingest_rated_carrier_keeps_rating(db: Session) -> None:
    record = {**REAL_MAIN_RECORD, "safety_rating": {"rating": "Satisfactory"}}
    ingest_dataset(db, [record], safety=False)
    carrier = db.scalar(select(Carrier))
    assert carrier is not None and carrier.safety_rating == "Satisfactory"


def test_ingest_safety_dataset(db: Session) -> None:
    ingest_dataset(db, [MAIN_RECORD], safety=False)
    processed = ingest_dataset(db, [SAFETY_RECORD], safety=True)
    assert processed == 1

    carrier = db.scalar(select(Carrier).where(Carrier.usdot_number == "123456"))
    assert carrier is not None
    assert carrier.safety_rating == "Satisfactory"
    assert len(carrier.safety_scores) == 1
    assert carrier.safety_scores[0].basic_category == "Unsafe Driving"
    assert float(carrier.safety_scores[0].score) == 3.1
    assert len(carrier.inspections) == 1
    assert carrier.violations[0].oos_indicator is True
    assert carrier.violations[0].violation_date is not None
