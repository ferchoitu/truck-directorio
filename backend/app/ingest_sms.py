"""Bulk-ingest FMCSA SMS monthly data: real BASIC measures, itemized
inspections and violations (24-month window), all free from
datahub.transportation.gov.

Datasets:
    basics       SMS AB PassProperty (4y6x-dmck)   ~695k carriers, BASIC measures
    inspections  SMS Input - Inspection (rbkj-cgst) ~5.8M rows
    violations   SMS Input - Violation (8mt8-2mdr)  ~6.7M rows

Usage:
    python -m app.ingest_sms basics
    python -m app.ingest_sms inspections [--resume]
    python -m app.ingest_sms violations [--resume]

Same connection rules as ingest_census: fresh connection per page, TCP
keepalives, chunked merges (the Railway proxy kills long idle-looking
connections).
"""

import argparse
import sys
import time
from datetime import date, datetime

import httpx
from sqlalchemy import text

from app.ingest_census import engine  # keepalive-enabled engine

BASE = "https://datahub.transportation.gov/resource"
PAGE_SIZE = 50_000
CHUNK_SPAN = 200_000

DATASETS = {
    "basics": "4y6x-dmck",
    "inspections": "rbkj-cgst",
    "violations": "8mt8-2mdr",
}

SELECTS = {
    "basics": (
        ":id,dot_number,insp_total,unsafe_driv_measure,unsafe_driv_ac,"
        "hos_driv_measure,hos_driv_ac,driv_fit_measure,driv_fit_ac,"
        "contr_subst_measure,contr_subst_ac,veh_maint_measure,veh_maint_ac"
    ),
    "inspections": (
        ":id,dot_number,insp_date,insp_level_id,report_state,driver_oos_total,"
        "vehicle_oos_total,unsafe_viol,fatigued_viol,dr_fitness_viol,"
        "subt_alcohol_viol,vh_maint_viol,hm_viol"
    ),
    "violations": (
        ":id,dot_number,viol_code,section_desc,insp_date,oos_indicator,severity_weight"
    ),
}

STAGING_DDL = {
    "basics": """
        CREATE UNLOGGED TABLE IF NOT EXISTS sms_ab_staging (
            dot_number varchar(20), insp_total integer,
            unsafe_driv_measure numeric, unsafe_driv_ac boolean,
            hos_driv_measure numeric, hos_driv_ac boolean,
            driv_fit_measure numeric, driv_fit_ac boolean,
            contr_subst_measure numeric, contr_subst_ac boolean,
            veh_maint_measure numeric, veh_maint_ac boolean
        )
    """,
    "inspections": """
        CREATE UNLOGGED TABLE IF NOT EXISTS sms_insp_staging (
            dot_number varchar(20), inspection_date date, inspection_type varchar(100),
            state varchar(10), oos_drivers integer, oos_vehicles integer,
            violations_found integer
        )
    """,
    "violations": """
        CREATE UNLOGGED TABLE IF NOT EXISTS sms_viol_staging (
            dot_number varchar(20), violation_code varchar(20),
            violation_description text, violation_date date,
            oos_indicator boolean, severity_weight integer
        )
    """,
}

STAGING_TABLE = {
    "basics": "sms_ab_staging",
    "inspections": "sms_insp_staging",
    "violations": "sms_viol_staging",
}


def _int(v: str | None) -> int | None:
    try:
        return int(v) if v not in (None, "") else None
    except ValueError:
        return None


def _num(v: str | None) -> float | None:
    try:
        return float(v) if v not in (None, "") else None
    except ValueError:
        return None


def _date(v: str | None) -> date | None:
    if not v:
        return None
    for fmt in ("%d-%b-%y", "%Y-%m-%d"):
        try:
            return datetime.strptime(v.strip()[:10].upper().title(), fmt).date()
        except ValueError:
            continue
    return None


def _bool(v: str | None) -> bool | None:
    if v is None:
        return None
    return str(v).strip().lower() in ("y", "yes", "true", "1")


def _row_basics(r: dict) -> tuple | None:
    dot = (r.get("dot_number") or "").strip()
    if not dot.isdigit():
        return None
    return (
        dot,
        _int(r.get("insp_total")),
        _num(r.get("unsafe_driv_measure")), _bool(r.get("unsafe_driv_ac")),
        _num(r.get("hos_driv_measure")), _bool(r.get("hos_driv_ac")),
        _num(r.get("driv_fit_measure")), _bool(r.get("driv_fit_ac")),
        _num(r.get("contr_subst_measure")), _bool(r.get("contr_subst_ac")),
        _num(r.get("veh_maint_measure")), _bool(r.get("veh_maint_ac")),
    )


def _row_inspections(r: dict) -> tuple | None:
    dot = (r.get("dot_number") or "").strip()
    if not dot.isdigit():
        return None
    viol = sum(
        _int(r.get(k)) or 0
        for k in ("unsafe_viol", "fatigued_viol", "dr_fitness_viol",
                  "subt_alcohol_viol", "vh_maint_viol", "hm_viol")
    )
    level = r.get("insp_level_id")
    return (
        dot,
        _date(r.get("insp_date")),
        f"Level {level}" if level else None,
        (r.get("report_state") or "").strip()[:10] or None,
        _int(r.get("driver_oos_total")),
        _int(r.get("vehicle_oos_total")),
        viol,
    )


def _row_violations(r: dict) -> tuple | None:
    dot = (r.get("dot_number") or "").strip()
    if not dot.isdigit():
        return None
    return (
        dot,
        (r.get("viol_code") or "").strip()[:20] or None,
        (r.get("section_desc") or "").strip() or None,
        _date(r.get("insp_date")),
        _bool(r.get("oos_indicator")),
        _int(r.get("severity_weight")),
    )


ROW_BUILDERS = {
    "basics": _row_basics,
    "inspections": _row_inspections,
    "violations": _row_violations,
}

COPY_COLS = {
    "basics": (
        "dot_number, insp_total, unsafe_driv_measure, unsafe_driv_ac, "
        "hos_driv_measure, hos_driv_ac, driv_fit_measure, driv_fit_ac, "
        "contr_subst_measure, contr_subst_ac, veh_maint_measure, veh_maint_ac"
    ),
    "inspections": (
        "dot_number, inspection_date, inspection_type, state, oos_drivers, "
        "oos_vehicles, violations_found"
    ),
    "violations": (
        "dot_number, violation_code, violation_description, violation_date, "
        "oos_indicator, severity_weight"
    ),
}


def stage(kind: str, resume: bool, max_pages: int) -> int:
    table = STAGING_TABLE[kind]
    last_id = ""
    with engine.connect() as conn:
        conn.execute(text(STAGING_DDL[kind]))
        if resume:
            conn.execute(
                text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS _src_id text")
            )
            last_id = conn.execute(text(f"SELECT max(_src_id) FROM {table}")).scalar() or ""
        else:
            conn.execute(text(f"DROP TABLE {table}"))
            conn.execute(text(STAGING_DDL[kind]))
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN _src_id text"))
        conn.commit()
    if last_id:
        print(f"resuming after :id {last_id}", flush=True)

    build = ROW_BUILDERS[kind]
    total = 0
    page_num = 0
    started = time.time()
    with httpx.Client() as client:
        while True:
            params = {
                "$select": SELECTS[kind],
                "$order": ":id",
                "$limit": PAGE_SIZE,
            }
            if last_id:
                params["$where"] = f":id > '{last_id}'"
            page = None
            for attempt in range(5):
                try:
                    resp = client.get(f"{BASE}/{DATASETS[kind]}.json", params=params, timeout=180)
                    resp.raise_for_status()
                    page = resp.json()
                    break
                except (httpx.HTTPError, ValueError) as exc:
                    print(f"  fetch retry {attempt + 1}/5: {str(exc)[:100]}", flush=True)
                    time.sleep(10 * (attempt + 1))
            if page is None:
                raise RuntimeError("fetch failed after retries")
            if not page:
                break
            page_num += 1
            rows = []
            for rec in page:
                built = build(rec)
                if built is not None:
                    rows.append(built + (rec[":id"],))
            _copy_page_with_src(kind, rows)
            total += len(rows)
            last_id = page[-1][":id"]
            print(
                f"page {page_num}: +{len(rows)} (total {total:,}, {time.time() - started:.0f}s)",
                flush=True,
            )
            if len(page) < PAGE_SIZE or (max_pages and page_num >= max_pages):
                break
    return total


def _copy_page_with_src(kind: str, rows: list[tuple]) -> None:
    last_exc: Exception | None = None
    for attempt in range(3):
        raw = engine.raw_connection()
        try:
            cur = raw.cursor()
            with cur.copy(
                f"COPY {STAGING_TABLE[kind]} ({COPY_COLS[kind]}, _src_id) FROM STDIN"
            ) as copy:
                for row in rows:
                    copy.write_row(row)
            raw.commit()
            return
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            print(f"  copy retry {attempt + 1}/3: {str(exc)[:120]}", flush=True)
            time.sleep(5 * (attempt + 1))
        finally:
            raw.close()
    raise RuntimeError(f"COPY failed: {last_exc}")


def _chunked(sql_delete: str | None, sql_insert: str, table: str, snapshot: str) -> int:
    with engine.connect() as conn:
        lo_max = conn.execute(
            text(f"SELECT min(dot_number::bigint), max(dot_number::bigint) FROM {table}")
        ).one()
        conn.commit()
    if lo_max[0] is None:
        print("staging vacio", flush=True)
        return 0

    merged = 0
    lo = lo_max[0]
    started = time.time()
    while lo <= lo_max[1]:
        hi = lo + CHUNK_SPAN
        params = {"lo": lo, "hi": hi, "snapshot": snapshot}
        for attempt in range(3):
            try:
                with engine.connect() as conn:
                    if sql_delete:
                        conn.execute(text(sql_delete), params)
                    result = conn.execute(text(sql_insert), params)
                    conn.commit()
                merged += result.rowcount
                break
            except Exception as exc:  # noqa: BLE001
                print(f"  merge retry {attempt + 1}/3 [{lo},{hi}): {str(exc)[:100]}", flush=True)
                time.sleep(5 * (attempt + 1))
        else:
            raise RuntimeError(f"merge failed [{lo},{hi})")
        print(f"  merged through DOT {hi:,} ({merged:,} rows, {time.time() - started:.0f}s)", flush=True)
        lo = hi
    return merged


MERGE = {
    "basics": (
        """
        DELETE FROM safety_scores ss USING carriers c, sms_ab_staging s
        WHERE ss.carrier_id = c.id AND c.usdot_number = s.dot_number
          AND s.dot_number::bigint >= :lo AND s.dot_number::bigint < :hi
        """,
        """
        INSERT INTO safety_scores (carrier_id, basic_category, score, percentile, alert_status, measured_date)
        SELECT c.id, v.cat, round(v.measure::numeric, 2), NULL,
               CASE WHEN v.alert THEN 'alert' ELSE 'ok' END, CAST(:snapshot AS date)
        FROM sms_ab_staging s
        JOIN carriers c ON c.usdot_number = s.dot_number
        CROSS JOIN LATERAL (VALUES
            ('Unsafe Driving', s.unsafe_driv_measure, s.unsafe_driv_ac),
            ('HOS Compliance', s.hos_driv_measure, s.hos_driv_ac),
            ('Driver Fitness', s.driv_fit_measure, s.driv_fit_ac),
            ('Controlled Substances/Alcohol', s.contr_subst_measure, s.contr_subst_ac),
            ('Vehicle Maintenance', s.veh_maint_measure, s.veh_maint_ac)
        ) AS v(cat, measure, alert)
        WHERE s.insp_total > 0 AND v.measure IS NOT NULL
          AND s.dot_number::bigint >= :lo AND s.dot_number::bigint < :hi
        """,
    ),
    "inspections": (
        None,
        """
        INSERT INTO inspections (carrier_id, inspection_date, inspection_type, state,
                                 oos_drivers, oos_vehicles, violations_found)
        SELECT c.id, s.inspection_date, s.inspection_type, s.state,
               s.oos_drivers, s.oos_vehicles, s.violations_found
        FROM sms_insp_staging s
        JOIN carriers c ON c.usdot_number = s.dot_number
        WHERE s.dot_number::bigint >= :lo AND s.dot_number::bigint < :hi
        """,
    ),
    "violations": (
        None,
        """
        INSERT INTO violations (carrier_id, violation_code, violation_description,
                                violation_date, oos_indicator, severity_weight)
        SELECT c.id, s.violation_code, s.violation_description, s.violation_date,
               s.oos_indicator, s.severity_weight
        FROM sms_viol_staging s
        JOIN carriers c ON c.usdot_number = s.dot_number
        WHERE s.dot_number::bigint >= :lo AND s.dot_number::bigint < :hi
        """,
    ),
}

TARGET_TABLE = {"inspections": "inspections", "violations": "violations"}


def stream_violations(resume_file: str) -> int:
    """Stage-less ingest: resolve carrier_id per page and COPY straight into
    violations. Uses ~1GB less disk than the staging path; checkpoint file
    makes it resumable."""
    import os

    last_id = ""
    if os.path.exists(resume_file):
        with open(resume_file) as fh:
            last_id = fh.read().strip()
        print(f"resuming after :id {last_id}", flush=True)
    else:
        with engine.connect() as conn:
            conn.execute(text("TRUNCATE violations"))
            conn.commit()
        print("truncated violations", flush=True)

    total = 0
    page_num = 0
    started = time.time()
    with httpx.Client() as client:
        while True:
            params = {"$select": SELECTS["violations"], "$order": ":id", "$limit": PAGE_SIZE}
            if last_id:
                params["$where"] = f":id > '{last_id}'"
            page = None
            for attempt in range(5):
                try:
                    resp = client.get(
                        f"{BASE}/{DATASETS['violations']}.json", params=params, timeout=180
                    )
                    resp.raise_for_status()
                    page = resp.json()
                    break
                except (httpx.HTTPError, ValueError) as exc:
                    print(f"  fetch retry {attempt + 1}/5: {str(exc)[:100]}", flush=True)
                    time.sleep(10 * (attempt + 1))
            if page is None:
                raise RuntimeError("fetch failed after retries")
            if not page:
                break
            page_num += 1

            rows = [r for r in (_row_violations(rec) for rec in page) if r is not None]
            dots = sorted({r[0] for r in rows})

            last_exc: Exception | None = None
            for attempt in range(3):
                try:
                    with engine.connect() as conn:
                        id_map = dict(
                            conn.execute(
                                text(
                                    "SELECT usdot_number, id FROM carriers "
                                    "WHERE usdot_number = ANY(:dots)"
                                ),
                                {"dots": dots},
                            ).all()
                        )
                        conn.commit()
                    resolved = [
                        (id_map[r[0]],) + r[1:] for r in rows if r[0] in id_map
                    ]
                    raw = engine.raw_connection()
                    try:
                        cur = raw.cursor()
                        with cur.copy(
                            "COPY violations (carrier_id, violation_code, "
                            "violation_description, violation_date, oos_indicator, "
                            "severity_weight) FROM STDIN"
                        ) as copy:
                            for row in resolved:
                                copy.write_row(row)
                        raw.commit()
                    finally:
                        raw.close()
                    total += len(resolved)
                    break
                except Exception as exc:  # noqa: BLE001
                    last_exc = exc
                    print(f"  page retry {attempt + 1}/3: {str(exc)[:120]}", flush=True)
                    time.sleep(5 * (attempt + 1))
            else:
                raise RuntimeError(f"page failed: {last_exc}")

            last_id = page[-1][":id"]
            with open(resume_file, "w") as fh:
                fh.write(last_id)
            print(
                f"page {page_num}: +{len(rows)} ({total:,} insertadas, "
                f"{time.time() - started:.0f}s)",
                flush=True,
            )
            if len(page) < PAGE_SIZE:
                break

    import os as _os
    _os.unlink(resume_file)
    print(f"DONE violations (direct): {total:,} rows, {time.time() - started:.0f}s", flush=True)
    return total


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("kind", choices=["basics", "inspections", "violations"])
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--pages", type=int, default=0)
    parser.add_argument("--merge-only", action="store_true")
    parser.add_argument(
        "--direct", action="store_true",
        help="violations only: stream straight into the final table (no staging)",
    )
    args = parser.parse_args()

    if args.direct:
        if args.kind != "violations":
            parser.error("--direct only supports violations")
        stream_violations("/tmp/sms_violations_checkpoint.txt")
        return 0

    started = time.time()
    if not args.merge_only:
        staged = stage(args.kind, args.resume, args.pages)
        print(f"staged: {staged:,}", flush=True)

    # Itemized SMS data fully replaces prior contents (it's a rolling 24-month
    # window snapshot); BASIC merge deletes per-carrier instead.
    if args.kind in TARGET_TABLE and not args.pages:
        with engine.connect() as conn:
            conn.execute(text(f"TRUNCATE {TARGET_TABLE[args.kind]}"))
            conn.commit()
        print(f"truncated {TARGET_TABLE[args.kind]}", flush=True)

    delete_sql, insert_sql = MERGE[args.kind]
    merged = _chunked(delete_sql, insert_sql, STAGING_TABLE[args.kind], date.today().isoformat())
    with engine.connect() as conn:
        conn.execute(text(f"DROP TABLE IF EXISTS {STAGING_TABLE[args.kind]}"))
        conn.commit()
    print(f"DONE {args.kind}: {merged:,} rows merged, {time.time() - started:.0f}s", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
