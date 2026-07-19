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
from sqlalchemy import create_engine, text

from app.config import get_settings
from app.database import _normalize_url
from app.services.slugs import carrier_slug

# Aggressive TCP keepalives: the Railway proxy silently drops connections that
# look idle (e.g. while the server runs a statement); without keepalives the
# client blocks on recv() forever instead of erroring and retrying.
engine = create_engine(
    _normalize_url(get_settings().database_url),
    pool_pre_ping=True,
    connect_args={
        "connect_timeout": 15,
        "keepalives": 1,
        "keepalives_idle": 15,
        "keepalives_interval": 5,
        "keepalives_count": 3,
    },
)

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
WHERE usdot_number::bigint >= :lo AND usdot_number::bigint < :hi
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


def _copy_page(rows: list[tuple]) -> None:
    """COPY one page on a fresh connection; the Railway proxy kills long-lived ones."""
    last_exc: Exception | None = None
    for attempt in range(3):
        raw = engine.raw_connection()
        try:
            cur = raw.cursor()
            with cur.copy(
                "COPY census_staging (usdot_number, legal_name, address, city, state, "
                "zip, phone, operation_type, carrier_classification, total_vehicles, "
                "slug, is_active) FROM STDIN"
            ) as copy:
                for row in rows:
                    copy.write_row(row)
            raw.commit()
            return
        except Exception as exc:  # noqa: BLE001 - retry transient connection drops
            last_exc = exc
            print(f"  copy retry {attempt + 1}/3: {str(exc)[:120]}", flush=True)
            time.sleep(5 * (attempt + 1))
        finally:
            raw.close()
    raise RuntimeError(f"COPY failed after retries: {last_exc}")


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
    parser.add_argument(
        "--resume", action="store_true", help="continue from max DOT already in staging"
    )
    parser.add_argument(
        "--merge-only", action="store_true", help="skip fetching; merge existing staging"
    )
    parser.add_argument(
        "--merge-from", type=int, default=None, help="resume merge at this DOT number"
    )
    args = parser.parse_args()

    started = time.time()
    if args.merge_only:
        merged = _merge(started, merge_from=args.merge_from)
        print(f"DONE: {merged:,} merged", flush=True)
        return 0
    last_dot = "0"
    with engine.connect() as conn:
        conn.execute(text(STAGING_DDL))
        if args.resume:
            max_dot = conn.execute(
                text("SELECT max(usdot_number::bigint) FROM census_staging")
            ).scalar()
            if max_dot is not None:
                last_dot = str(max_dot)
                print(f"resuming after DOT {last_dot}", flush=True)
        else:
            conn.execute(text("TRUNCATE census_staging"))
        conn.commit()

    total = 0
    page_num = 0
    with httpx.Client() as client:
        while True:
            page = fetch_page(client, last_dot, not args.include_inactive)
            if not page:
                break
            page_num += 1
            rows = [r for r in (_row(rec) for rec in page) if r is not None]
            _copy_page(rows)
            total += len(rows)
            last_dot = page[-1]["dot_number"]
            print(
                f"page {page_num}: +{len(rows)} rows (total {total:,}, "
                f"last DOT {last_dot}, {time.time() - started:.0f}s)",
                flush=True,
            )
            if len(page) < PAGE_SIZE or (args.pages and page_num >= args.pages):
                break

    merged = _merge(started)
    print(f"DONE: {total:,} staged this run, {merged:,} merged total", flush=True)
    return 0


CHUNK_SPAN = 200_000  # DOT-number span per merge statement, keeps each one short


def _merge(started: float, merge_from: int | None = None) -> int:
    """Merge staging into carriers in short chunked statements.

    One 2.2M-row statement runs for minutes with zero client traffic and the
    Railway proxy kills the 'idle' connection — chunks keep each statement fast.
    """
    print("merging staging into carriers (chunked)...", flush=True)
    merged = 0
    with engine.connect() as conn:
        lo_max = conn.execute(
            text("SELECT min(usdot_number::bigint), max(usdot_number::bigint) FROM census_staging")
        ).one()
        conn.commit()
    if lo_max[0] is None:
        print("staging is empty, nothing to merge", flush=True)
        return 0

    lo = merge_from if merge_from is not None else lo_max[0]
    while lo <= lo_max[1]:
        hi = lo + CHUNK_SPAN
        for attempt in range(3):
            try:
                with engine.connect() as conn:
                    result = conn.execute(text(MERGE_SQL), {"lo": lo, "hi": hi})
                    conn.commit()
                merged += result.rowcount
                break
            except Exception as exc:  # noqa: BLE001 - retry transient connection drops
                print(f"  merge retry {attempt + 1}/3 [{lo},{hi}): {str(exc)[:100]}", flush=True)
                time.sleep(5 * (attempt + 1))
        else:
            raise RuntimeError(f"merge failed for chunk [{lo},{hi})")
        print(
            f"  merged through DOT {hi:,} ({merged:,} rows, {time.time() - started:.0f}s)",
            flush=True,
        )
        lo = hi

    with engine.connect() as conn:
        conn.execute(text("DROP TABLE census_staging"))
        conn.commit()
        count = conn.execute(text("SELECT count(*) FROM carriers")).scalar()
    print(f"carriers in DB: {count:,}", flush=True)
    return merged


if __name__ == "__main__":
    sys.exit(main())
