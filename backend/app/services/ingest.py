"""Normalize Apify actor output and upsert it into PostgreSQL.

Actor outputs vary in field naming, so every lookup goes through `_pick`,
which tries a list of candidate keys.
"""

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Carrier, Inspection, SafetyScore, Violation
from app.services.slugs import carrier_slug


def _pick(record: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in record and record[key] not in (None, ""):
            return record[key]
    return None


def _first(value: Any) -> Any:
    """Unwrap single-value lists (e.g. carrier_operation: [\"Interstate\"])."""
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _parse_full_address(raw: str) -> tuple[str | None, str | None, str | None, str | None]:
    """Split 'STREET, CITY, ST, ZIP[, COUNTRY]' into (street, city, state, zip)."""
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    if parts and parts[-1].upper() in ("US", "USA", "CA", "MX"):
        parts = parts[:-1]
    if len(parts) < 4:
        return raw, None, None, None
    street = ", ".join(parts[:-3])
    city, state, zip_code = parts[-3], parts[-2], parts[-1]
    if len(state) > 2 or not state.isalpha():
        return raw, None, None, None
    return street, city, state, zip_code


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


def _as_date(value: Any) -> date | None:
    if value is None:
        return None
    text = str(value).strip()[:10]
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def upsert_carrier(db: Session, record: dict[str, Any]) -> Carrier | None:
    usdot = _as_str(
        _pick(record, "usdot_number", "usdotNumber", "dotNumber", "DOT_num", "usdot", "dot"), 20
    )
    if not usdot or not usdot.isdigit():
        return None

    carrier = db.scalar(select(Carrier).where(Carrier.usdot_number == usdot))
    if carrier is None:
        carrier = Carrier(usdot_number=usdot)
        db.add(carrier)

    legal_name = _as_str(_pick(record, "legal_name", "legalName", "name", "companyName"), 255)

    # Address may come pre-split or as one string: "STREET, CITY, ST, ZIP, US"
    street = _pick(record, "address", "street")
    city = _pick(record, "city", "physicalCity")
    state = _pick(record, "state", "physicalState", "stateCode")
    zip_code = _pick(record, "zip", "zipCode", "physicalZip")
    full = _pick(record, "physical_address", "physicalAddress")
    if isinstance(full, str) and city is None:
        street, city, state, zip_code = _parse_full_address(full)

    # safety_rating can be a plain string or {"rating": ..., "rating_date": ...}
    rating = _pick(record, "safety_rating", "safetyRating", "rating")
    if isinstance(rating, dict):
        rating = rating.get("rating")
    if isinstance(rating, str) and rating.strip().lower() in ("no rating", "none", "not rated"):
        rating = None

    fields: dict[str, Any] = {
        "mc_number": _as_str(
            _first(
                _pick(record, "mc_number", "mcNumber", "mc_mx_ff_numbers", "mcMxFfNumbers", "mc")
            ),
            20,
        ),
        "legal_name": legal_name,
        "dba_name": _as_str(_pick(record, "dba_name", "dbaName", "dba"), 255),
        "address": _as_str(street, 10_000),
        "city": _as_str(city, 100),
        "state": _as_str(state, 10),
        "zip": _as_str(zip_code, 20),
        "phone": _as_str(_pick(record, "phone", "telephone", "phoneNumber"), 50),
        "email": _as_str(_pick(record, "email", "emailAddress"), 255),
        "operation_type": _as_str(
            _first(_pick(record, "operation_type", "operationType", "carrier_operation", "carrierOperation")),
            100,
        ),
        "carrier_classification": _as_str(
            _pick(record, "carrier_classification", "classification", "entity_type", "entityType"),
            100,
        ),
        "total_vehicles": _as_int(
            _pick(record, "total_vehicles", "power_units", "powerUnits", "totalPowerUnits", "vehicles")
        ),
        "total_drivers": _as_int(_pick(record, "total_drivers", "totalDrivers", "drivers")),
        "authority_status": _as_str(
            _pick(record, "authority_status", "authorityStatus", "operatingStatus", "status"), 50
        ),
        "safety_rating": _as_str(rating, 50),
        "duns_number": _as_str(_pick(record, "duns_number", "DUNS_num", "dunsNumber", "duns"), 20),
    }
    for attr, value in fields.items():
        if value is not None:
            setattr(carrier, attr, value)

    if carrier.slug is None:
        carrier.slug = carrier_slug(carrier.legal_name, usdot)
    carrier.last_scraped_at = datetime.now(UTC).replace(tzinfo=None)
    return carrier


def _as_percent(value: Any) -> float | None:
    try:
        return float(str(value).replace("%", "").strip())
    except (TypeError, ValueError):
        return None


def _upsert_safer_snapshot(db: Session, record: dict[str, Any]) -> Carrier | None:
    """Ingest a SAFER company snapshot from parseforge/fmcsa-carrier-safety-scraper.

    This actor returns 24-month inspection summaries per category (not itemized
    events), crash totals, and operating status — stored as summary rows.
    """
    # Snapshot addresses are one unparsed blob; never overwrite the clean
    # address the main actor already gave us.
    slim = {k: v for k, v in record.items() if k not in ("physicalAddress", "mailingAddress")}
    carrier = upsert_carrier(db, slim)
    if carrier is None:
        return None
    db.flush()

    status = _as_str(record.get("operatingStatus"), 50)
    if status:
        carrier.authority_status = status
        carrier.is_active = status.upper() == "ACTIVE"

    measured = _as_date(record.get("latestUpdate"))
    us_inspections = record.get("usInspections") or {}

    carrier.safety_scores.clear()
    carrier.inspections.clear()
    for category, data in us_inspections.items():
        if not isinstance(data, dict):
            continue
        total = _as_int(data.get("inspections")) or 0
        oos = _as_int(data.get("outOfService")) or 0
        oos_pct = _as_percent(data.get("outOfServicePercent"))
        national = _as_percent(data.get("nationalAverage"))

        if total > 0 and oos_pct is not None:
            alert = None
            if national is not None:
                alert = "alert" if oos_pct > national else "ok"
            carrier.safety_scores.append(
                SafetyScore(
                    basic_category=f"{category.title()} Out-of-Service %",
                    score=oos_pct,
                    percentile=round(oos_pct),
                    alert_status=alert,
                    measured_date=measured,
                )
            )
        if total > 0:
            carrier.inspections.append(
                Inspection(
                    inspection_date=measured,
                    inspection_type=f"US {category.title()} (24-month summary)",
                    vehicles_inspected=total if category == "vehicle" else None,
                    drivers_inspected=total if category == "driver" else None,
                    oos_vehicles=oos if category == "vehicle" else None,
                    oos_drivers=oos if category == "driver" else None,
                )
            )
    return carrier


def upsert_safety_data(db: Session, record: dict[str, Any]) -> Carrier | None:
    """Ingest a record from the safety actor."""
    # SAFER "record not found": mark an existing carrier inactive, never create stubs.
    status = str(record.get("operatingStatus") or "").upper()
    if record.get("error") or status == "NOT FOUND":
        usdot = _as_str(
            _pick(record, "dotNumber", "DOT_num", "usdot_number", "usdotNumber", "usdot"), 20
        )
        if not usdot:
            return None
        carrier = db.scalar(select(Carrier).where(Carrier.usdot_number == usdot))
        if carrier is not None:
            carrier.is_active = False
        return carrier

    if "usInspections" in record:
        return _upsert_safer_snapshot(db, record)

    # Generic fallback: itemized basic scores / inspections / violations.
    carrier = upsert_carrier(db, record)
    if carrier is None:
        return None
    db.flush()  # ensure carrier.id

    scores = _pick(record, "basic_scores", "basicScores", "basics") or []
    if scores:
        carrier.safety_scores.clear()
        for score in scores:
            carrier.safety_scores.append(
                SafetyScore(
                    basic_category=_as_str(_pick(score, "basic_category", "category", "basic", "name"), 100),
                    score=_pick(score, "score", "measure", "value"),
                    percentile=_as_int(_pick(score, "percentile", "percent")),
                    alert_status=_as_str(_pick(score, "alert_status", "alert", "status"), 20),
                    measured_date=_as_date(_pick(score, "measured_date", "date", "snapshotDate")),
                )
            )

    inspections = _pick(record, "inspections", "inspectionHistory") or []
    if inspections:
        carrier.inspections.clear()
        for insp in inspections:
            carrier.inspections.append(
                Inspection(
                    inspection_date=_as_date(_pick(insp, "inspection_date", "date")),
                    inspection_type=_as_str(_pick(insp, "inspection_type", "type", "level"), 100),
                    vehicles_inspected=_as_int(_pick(insp, "vehicles_inspected", "vehicles")),
                    drivers_inspected=_as_int(_pick(insp, "drivers_inspected", "drivers")),
                    violations_found=_as_int(_pick(insp, "violations_found", "violations")),
                    oos_vehicles=_as_int(_pick(insp, "oos_vehicles", "vehicleOos")),
                    oos_drivers=_as_int(_pick(insp, "oos_drivers", "driverOos")),
                    state=_as_str(_pick(insp, "state", "reportState"), 10),
                )
            )

    violations = _pick(record, "violations", "violationHistory") or []
    if violations:
        carrier.violations.clear()
        for viol in violations:
            oos = _pick(viol, "oos_indicator", "oos", "outOfService")
            carrier.violations.append(
                Violation(
                    violation_code=_as_str(_pick(viol, "violation_code", "code"), 20),
                    violation_description=_as_str(_pick(viol, "violation_description", "description"), 10_000),
                    violation_date=_as_date(_pick(viol, "violation_date", "date")),
                    oos_indicator=None if oos is None else str(oos).lower() in ("true", "1", "y", "yes"),
                    severity_weight=_as_int(_pick(viol, "severity_weight", "severity", "weight")),
                )
            )

    return carrier


def ingest_dataset(db: Session, items: list[dict[str, Any]], *, safety: bool) -> int:
    """Ingest a full Apify dataset. Returns number of records processed."""
    processed = 0
    for record in items:
        result = upsert_safety_data(db, record) if safety else upsert_carrier(db, record)
        if result is not None:
            processed += 1
    db.commit()
    return processed
