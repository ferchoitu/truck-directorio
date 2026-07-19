"""Periodic in-process updater: pulls newly registered carriers from the free
FMCSA census API (data.transportation.gov) and upserts them.

Runs inside the web process (single replica, MVP-simple — no extra Railway
service). Every UPDATE_INTERVAL_HOURS it fetches carriers whose add_date falls
in the lookback window and records the run in scraping_jobs with
actor_id='census-incremental'.
"""

import asyncio
import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import select

from app.database import SessionLocal
from app.models import ScrapingJob
from app.services.ingest import upsert_carrier

logger = logging.getLogger("updater")

CENSUS_URL = "https://data.transportation.gov/resource/az4n-8mr2.json"
UPDATE_INTERVAL_HOURS = 24
LOOKBACK_DAYS = 10  # overlap window; upserts make re-processing harmless
PAGE_SIZE = 10_000

FIELDS = (
    "dot_number,legal_name,phy_street,phy_city,phy_state,phy_zip,phone,"
    "carrier_operation,business_org_desc,power_units,status_code"
)

OPERATION_MAP = {"A": "Interstate", "B": "Intrastate Hazmat", "C": "Intrastate Non-Hazmat"}


def census_record_to_ingest(rec: dict[str, Any]) -> dict[str, Any]:
    """Map a raw census row to the field names upsert_carrier understands."""
    power = rec.get("power_units")
    try:
        vehicles: int | None = int(power) if power else None
    except ValueError:
        vehicles = None
    if vehicles is not None and vehicles > 150_000:  # MCS-150 typo garbage
        vehicles = None
    return {
        "usdot_number": rec.get("dot_number"),
        "legal_name": rec.get("legal_name"),
        "address": rec.get("phy_street"),
        "city": rec.get("phy_city"),
        "state": rec.get("phy_state"),
        "zip": rec.get("phy_zip"),
        "phone": rec.get("phone"),
        "operation_type": OPERATION_MAP.get(rec.get("carrier_operation", "")),
        "carrier_classification": rec.get("business_org_desc"),
        "total_vehicles": vehicles,
    }


def _socrata_headers() -> dict[str, str]:
    import os

    headers = {"User-Agent": "CarrierCheck/1.0 (+https://truck-directorio.vercel.app)"}
    token = os.environ.get("SOCRATA_APP_TOKEN", "")
    if token:
        headers["X-App-Token"] = token
    return headers


async def fetch_new_carriers(since: date) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    offset = 0
    async with httpx.AsyncClient(timeout=60, headers=_socrata_headers()) as client:
        while True:
            page: list[dict[str, Any]] | None = None
            last_exc: Exception | None = None
            # Anonymous Socrata access gets throttled in bursts (403/429);
            # back off hard before giving up.
            for attempt in range(5):
                try:
                    resp = await client.get(
                        CENSUS_URL,
                        params={
                            "$select": FIELDS,
                            "$where": (
                                f"add_date >= '{since.strftime('%Y%m%d')}' "
                                "AND status_code = 'A'"
                            ),
                            "$order": "dot_number",
                            "$limit": PAGE_SIZE,
                            "$offset": offset,
                        },
                    )
                    resp.raise_for_status()
                    page = resp.json()
                    break
                except (httpx.HTTPError, ValueError) as exc:
                    last_exc = exc
                    await asyncio.sleep(30 * (attempt + 1))
            if page is None:
                raise RuntimeError(f"Socrata fetch failed after retries: {last_exc}")
            records.extend(page)
            if len(page) < PAGE_SIZE:
                return records
            offset += PAGE_SIZE


def _last_run_at() -> datetime | None:
    with SessionLocal() as db:
        return db.scalar(
            select(ScrapingJob.completed_at)
            .where(ScrapingJob.actor_id == "census-incremental", ScrapingJob.status == "completed")
            .order_by(ScrapingJob.id.desc())
            .limit(1)
        )


async def run_incremental_update() -> int:
    """One update pass. Returns number of carriers processed."""
    now = datetime.now(UTC).replace(tzinfo=None)
    job = ScrapingJob(actor_id="census-incremental", status="running", started_at=now)
    with SessionLocal() as db:
        db.add(job)
        db.commit()
        job_id = job.id

    try:
        records = await fetch_new_carriers(date.today() - timedelta(days=LOOKBACK_DAYS))
        processed = 0
        with SessionLocal() as db:
            for rec in records:
                if upsert_carrier(db, census_record_to_ingest(rec)) is not None:
                    processed += 1
            db.commit()
        with SessionLocal() as db:
            job = db.get(ScrapingJob, job_id)
            if job:
                job.status = "completed"
                job.total_records = len(records)
                job.processed_records = processed
                job.completed_at = datetime.now(UTC).replace(tzinfo=None)
                db.commit()
        logger.info("census incremental: %s/%s carriers upserted", processed, len(records))
        return processed
    except Exception as exc:  # noqa: BLE001 - record failure, keep the loop alive
        with SessionLocal() as db:
            job = db.get(ScrapingJob, job_id)
            if job:
                job.status = "failed"
                job.error_message = str(exc)[:2000]
                job.completed_at = datetime.now(UTC).replace(tzinfo=None)
                db.commit()
        logger.exception("census incremental update failed")
        return 0


async def updater_loop() -> None:
    while True:
        last = _last_run_at()
        due = last is None or (
            datetime.now(UTC).replace(tzinfo=None) - last
            >= timedelta(hours=UPDATE_INTERVAL_HOURS)
        )
        if due:
            await run_incremental_update()
        await asyncio.sleep(3600)  # re-check hourly; survives restarts statelessly
