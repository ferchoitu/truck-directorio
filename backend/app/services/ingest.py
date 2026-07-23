"""Normalize official FMCSA records and upsert carriers into PostgreSQL."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Carrier
from app.services.slugs import carrier_slug


def _pick(record: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in record and record[key] not in (None, ""):
            return record[key]
    return None


def _first(value: Any) -> Any:
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _as_int(value: Any) -> int | None:
    try:
        return int(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def _as_str(value: Any, max_len: int) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text[:max_len] or None


def upsert_carrier(db: Session, record: dict[str, Any]) -> Carrier | None:
    """Upsert a normalized FMCSA carrier record without erasing richer values."""
    usdot = _as_str(_pick(record, "usdot_number", "dot_number"), 20)
    if not usdot or not usdot.isdigit():
        return None

    carrier = db.scalar(select(Carrier).where(Carrier.usdot_number == usdot))
    if carrier is None:
        carrier = Carrier(usdot_number=usdot)
        db.add(carrier)

    fields: dict[str, Any] = {
        "mc_number": _as_str(_first(_pick(record, "mc_number", "docket_number")), 20),
        "legal_name": _as_str(_pick(record, "legal_name"), 255),
        "dba_name": _as_str(_pick(record, "dba_name"), 255),
        "address": _as_str(_pick(record, "address", "phy_street"), 10_000),
        "city": _as_str(_pick(record, "city", "phy_city"), 100),
        "state": _as_str(_pick(record, "state", "phy_state"), 10),
        "zip": _as_str(_pick(record, "zip", "phy_zip"), 20),
        "phone": _as_str(_pick(record, "phone", "telephone"), 50),
        "email": _as_str(_pick(record, "email", "email_address"), 255),
        "operation_type": _as_str(_pick(record, "operation_type"), 100),
        "carrier_classification": _as_str(_pick(record, "carrier_classification"), 100),
        "total_vehicles": _as_int(_pick(record, "total_vehicles", "power_units", "nbr_power_unit")),
        "total_drivers": _as_int(_pick(record, "total_drivers", "driver_total")),
        "authority_status": _as_str(_pick(record, "authority_status"), 50),
        "safety_rating": _as_str(_pick(record, "safety_rating"), 50),
        "duns_number": _as_str(_pick(record, "duns_number", "dun_bradstreet_no"), 20),
    }
    for attr, value in fields.items():
        if value is not None:
            setattr(carrier, attr, value)

    if carrier.slug is None:
        carrier.slug = carrier_slug(carrier.legal_name, usdot)
    carrier.last_scraped_at = datetime.now(UTC).replace(tzinfo=None)
    return carrier
