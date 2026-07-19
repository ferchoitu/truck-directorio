"""Bulk-ingest the FMCSA Motor Carrier Census into the carriers table.

Source: data.transportation.gov dataset az4n-8mr2 (free Socrata API, ~4.5M rows,
~2.2M active). Streams pages with keyset pagination, COPYs them into an
unlogged staging table, then merges into carriers in one SQL statement that
never overwrites richer data already present (email, DBA, MC from Apify).

Usage:
    python -m app.ingest_census --pages 1          # smoke test (1 page)
    python -m app.ingest_census                    # full run, active carriers only

DATABASE_URL must point at the target database (use Railway's public URL when
running from outside Railway).
"""

import argparse
import sys
import time

import httpx
from sqlalchemy import text

from app.database import engine
from app.services.slugs import carrier_slug

DATASET_URL = "https://data.transportation.gov/resource/az4n-8mr2.json"
PAGE_SIZE = 50_000

FIELDS = (
    "dot_number,legal_name,phy_street,phy_city,phy_state,phy_zip,phone,"
    "carrier_operation,business_org_desc,power_units,status_code"
)

OPERATION_MAP = {
    "A": "Interstate",
    "B": "Intrastate Hazmat",
    "C": "Intrastate Non-Hazmat",
}

STAGING_DDL = """
CREATE UNLOGGED TABLE IF NOT EXISTS census_staging (
    usdot_number varchar(20),
    legal_name varchar(255),
    address text,
    city varchar(100),
    state varchar(10),
    zip varchar(20),
    phone varchar(50),
    operation_type varchar(100),
    carrier_classification varchar(100),
    total_vehicles integer,
    slug varchar(255),
    is_active boolean
)
"""

MERGE_SQL = """
INSERT INTO carriers (
    usdot_number, legal_name, address, city, state, zip, phone,
    operation_type, carrier_classification, total_vehicles, slug, is_active
)
SELECT DISTINCT ON (usdot_number)
    usdot_number, legal_name, address, city, state, zip, phone,
    operation_type, carrier_classification, total_vehicles, slug, is_active
FROM census_staging
ON CONFLICT (usdot_number) DO UPDATE SET
    legal_name = COALESCE(EXCLUDED.legal_name, carriers.legal_name),
    address = COALESCE(EXCLUDED.address, carriers.address),
    city = COALESCE(EXCLUDED.city, carriers.city),
    state = COALESCE(EXCLUDED.state, carriers.state),
    zip = COALESCE(EXCLUDED.zip, carriers.zip),
    phone = COALESCE(EXCLUDED.phone, carriers.phone),
    operation_type = COALESCE(EXCLUDED.operation_type, carriers.operation_type),
    carrier_classification = COALESCE(
        EXCLUDED.carrier_classification, carriers.carrier_classification
    ),
    total_vehicles = COALESCE(EXCLUDED.total_vehicles, carriers.total_vehicles),
    is_active = EXCLUDED.is_active,
    updated_at = now()
"""


def _clean(value: str | None, max_len: int) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value[:max_len] or None


def _row(rec: dict[str, str]) -> tuple | None:
    usdot = _clean(rec.get("dot_number"), 20)
    if not usdot or not usdot.isdigit():
        return None
    legal = _clean(rec.get("legal_name"), 255)
    try:
        vehicles = int(rec["power_units"]) if rec.get("power_units") else None
    except ValueError:
        vehicles = None
    return (
        usdot,
        legal,
        _clean(rec.get("phy_street"), 10_000),
        _clean(rec.get("phy_city"), 100),
        _clean(rec.get("phy_state"), 10),
        _clean(rec.get("phy_zip"), 20),
        _clean(rec.get("phone"), 50),
        OPERATION_MAP.get(rec.get("carrier_operation", "")),
        _clean(rec.get("business_org_desc"), 100),
        vehicles,
        carrier_slug(legal, usdot),
        rec.get("status_code") == "A",
    )


def fetch_page(client: httpx.Client, last_dot: str, active_only: bool) -> list[dict[str, str]]:
    where = f"dot_number > '{last_dot}'"
    if active_only:
        where += " AND status_code = 'A'"
    for attempt in range(5):
        try:
            resp = client.get(
                DATASET_URL,
                params={
                    "$select": FIELDS,
                    "$where": where,
                    "$order": "dot_number",
                    "$limit": PAGE_SIZE,
                },
                timeout=120,
            )
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            wait = 5 * (attempt + 1)
            print(f"  retry {attempt + 1}/5 after error: {exc} (waiting {wait}s)", flush=True)
            time.sleep(wait)
    raise RuntimeError("Socrata fetch failed after 5 retries")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=int, default=0, help="max pages (0 = all)")
    parser.add_argument(
        "--include-inactive", action="store_true", help="also ingest status_code != A"
    )
    args = parser.parse_args()

    started = time.time()
    with engine.connect() as conn:
        conn.execute(text(STAGING_DDL))
        conn.execute(text("TRUNCATE census_staging"))
        conn.commit()

    raw = engine.raw_connection()
    total = 0
    last_dot = "0"
    page_num = 0
    try:
        with httpx.Client() as client:
            while True:
                page = fetch_page(client, last_dot, not args.include_inactive)
                if not page:
                    break
                page_num += 1
                rows = [r for r in (_row(rec) for rec in page) if r is not None]
                cur = raw.cursor()
                with cur.copy(
                    "COPY census_staging (usdot_number, legal_name, address, city, state, "
                    "zip, phone, operation_type, carrier_classification, total_vehicles, "
                    "slug, is_active) FROM STDIN"
                ) as copy:
                    for row in rows:
                        copy.write_row(row)
                raw.commit()
                total += len(rows)
                last_dot = page[-1]["dot_number"]
                print(
                    f"page {page_num}: +{len(rows)} rows (total {total:,}, "
                    f"last DOT {last_dot}, {time.time() - started:.0f}s)",
                    flush=True,
                )
                if len(page) < PAGE_SIZE or (args.pages and page_num >= args.pages):
                    break
    finally:
        raw.close()

    print("merging staging into carriers...", flush=True)
    with engine.connect() as conn:
        conn.execute(text("SET statement_timeout = '30min'"))
        result = conn.execute(text(MERGE_SQL))
        conn.execute(text("DROP TABLE census_staging"))
        conn.commit()
        count = conn.execute(text("SELECT count(*) FROM carriers")).scalar()

    print(
        f"DONE: {total:,} staged, {result.rowcount:,} merged, "
        f"{count:,} carriers in DB, {time.time() - started:.0f}s total",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
