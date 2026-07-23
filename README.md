# CarrierCheck.io

FMCSA motor carrier directory: 2.2M+ active US trucking companies with real SMS BASIC measures, inspection history, and violations — all built from free public FMCSA data.

**Live**: frontend at https://truck-directorio.vercel.app · API at https://backend-production-9a9f.up.railway.app ([docs](https://backend-production-9a9f.up.railway.app/docs))

## Current status (2026-07-19)

| Data | Rows | Source | Cost |
|---|---|---|---|
| Active carriers (name, address, phone, fleet) | 2,224,489 | FMCSA Census — data.transportation.gov `az4n-8mr2` | $0 |
| Real BASIC measures (5 categories + alerts) | 1,826,639 | SMS AB — datahub.transportation.gov `4y6x-dmck` | $0 |
| Itemized inspections (24-month window) | 5,683,534 | SMS Input Inspection — `rbkj-cgst` | $0 |
| Itemized violations (code, description, severity, OOS) | 6,675,983 | SMS Input Violation — `8mt8-2mdr` | $0 |
| Enrichment: email, DBA, MC, DUNS | selective | Apify actors (pay-per-record) | paid |

Database: ~3.5GB of the 4.9GB Railway volume. **Constraint: stay on the $5 Railway plan** — see [Bulk ingestion rules](#bulk-ingestion-rules).

Shipped: search over 2.2M rows in ~0.5s (pg_trgm), 52 state pages, chunked sitemaps (50k URLs each), robots.txt, JSON-LD, ISR profiles.

Pending: weekly new-carrier cron + monthly SMS refresh, Google Search Console submission, monetization (AdSense/affiliates), blog content.

## Architecture

| Layer | Tech | Hosting |
|---|---|---|
| Frontend | Next.js 14 (App Router, TypeScript, Tailwind) | Vercel (auto-deploy from GitHub, root `frontend/`) |
| Backend | FastAPI + SQLAlchemy 2.0 + Alembic | Railway (deploy via `railway up` from `backend/`) |
| Database | PostgreSQL (+ Redis, reserved for caching) | Railway |
| Bulk data | Census + SMS open-data ingestion scripts | run locally against Railway's public DB URL |
| Enrichment | Apify actors (via API + webhooks) | Apify |

```
backend/    FastAPI app, models, migrations, bulk ingestion scripts, Apify integration, tests
frontend/   Next.js app: home, search, state pages, carrier profiles (ISR), sitemaps
data/       Keyword research exports
```

## Data pipelines

### 1. Bulk: FMCSA Census (free, primary population)

```bash
cd backend
DATABASE_URL=<railway-public-url> python -m app.ingest_census            # full load, active only
DATABASE_URL=<railway-public-url> python -m app.ingest_census --resume   # continue after a cut
```

Streams `data.transportation.gov/resource/az4n-8mr2` (keyset pagination, 50k/page) into an unlogged staging table via COPY, then merges in chunked statements. `COALESCE` merge never overwrites richer fields (email, DBA, MC) that came from Apify.

### 2. Bulk: SMS safety data (free, monthly refresh)

```bash
python -m app.ingest_sms basics                 # BASIC measures, ~700k carriers, ~3 min
python -m app.ingest_sms inspections            # 5.8M rows, staging + chunked merge, ~15 min
python -m app.ingest_sms violations --direct    # 6.7M rows, stage-less streaming, ~15 min
```

`--direct` resolves `carrier_id` per page in Python and COPYs straight into the final table — no staging, ~1GB less disk. Checkpoint file makes it resumable. Itemized tables are truncated and fully replaced each run (SMS is a rolling 24-month window).

### 3. Enrichment: Apify actors (paid, selective)

`POST /api/scraping/start` launches an actor with a completion webhook → backend downloads the dataset and upserts (`app/services/ingest.py`, field-name tolerant). Verify connection with `python -m app.check_apify`.

| Actor | Input | Use |
|---|---|---|
| `jungle_synthesizer/fmcsa-dot-crawler` (main) | `dot_start`, `max_results`, `is_premium_mode` | email, DBA, MC, DUNS (non-premium already includes email + safety rating) |
| `parseforge/fmcsa-carrier-safety-scraper` (safety) | `dotNumbers[]`, `maxItems` | SAFER snapshot on demand |
| `curative_blanket/fmcsa-new-carrier-feed` (new) | `daysBack`, `incremental` | superseded by free Socrata `add_date` queries |

Use Apify only for carriers worth enriching (traffic-driven), not bulk — the free census covers the rest.

### Bulk ingestion rules

Hard-won on the $5 Railway plan (4.9GB volume) and its public TCP proxy:

1. **The proxy silently kills idle-looking connections** (long COPY/merge statements). Always: TCP keepalives (built into the scripts' engine), fresh connection per page, chunked merge statements, `--resume`/checkpoint flags.
2. **No staging tables for datasets >1GB** — use `--direct` streaming.
3. **One dataset at a time, `VACUUM` after big merges** — space churn, not data size, is what fills the disk.
4. If space gets tight: normalize violation descriptions into a code lookup table (~500MB reserve).

### Data quality rules

- Census `power_units` is self-reported (form MCS-150) and contains garbage (4.5M "vehicles" on a fruit stand). Sanity rules: values >150k nulled at ingest; fleets >1,000 with zero inspections nulled; fleets >5,000 require proportional inspection evidence.
- SMS BASIC **percentiles are not public** (FAST Act) — we store and display the raw SMS *measures* + acute/critical alert flags.
- SAFER "record not found" marks a carrier inactive; never creates stub rows.
- Public business data only — never personal driver information.

## Backend setup

Requires Python 3.12+ and a local PostgreSQL.

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env         # edit DATABASE_URL, APIFY_TOKEN, APIFY_WEBHOOK_SECRET
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Tests run against in-memory SQLite — no database needed: `pytest tests/`

### Key endpoints

```
GET  /api/health
GET  /api/carriers                  filters: state, operation_type, safety_rating, min/max_vehicles + pagination
GET  /api/carriers/search?q=        name (pg_trgm ILIKE) or exact USDOT/MC number
GET  /api/carriers/top?limit=       biggest fleets first (ISR prerendering)
GET  /api/carriers/slugs?page=      50k-slug pages feeding the sitemaps
GET  /api/carriers/by-slug/{slug}
GET  /api/carriers/{usdot}
GET  /api/carriers/{usdot}/safety   5 BASIC measures + latest 50 inspections + latest 10 violations
POST /api/scraping/start            operator-only; X-API-Key required; rate limited
GET  /api/scraping/jobs[/{id}]      operator-only; X-API-Key required
POST /api/webhooks/apify            Apify completion callback (?secret=&job_id=)
```

## Frontend setup

Requires Node 18+.

```bash
cd frontend
npm install
cp .env.example .env.local   # point NEXT_PUBLIC_API_URL at the backend
npm run dev
```

Routes:

- `/` — search box + browse-by-state links
- `/search?q=` — paginated results (25/page)
- `/carrier/[slug]` — ISR profiles (`revalidate: 86400`, top 10k prerendered), JSON-LD, BASIC measures with alert badges, inspection history, recent violations
- `/state/[xx]` — 52 SSG state listing pages
- `/sitemap.xml` → `/sitemaps/[id]` — chunked sitemaps, 50k URLs each, generated on demand with 24h cache
- `/robots.txt`

`npm run typecheck` and `npm run build` must pass before deploying.

**ISR gotcha**: pages prerender at build time — data ingested after a build won't appear on already-prerendered pages for 24h unless you trigger a rebuild (empty commit push).

## Deploy

**Railway (backend):** project `carriercheck` with Postgres + Redis. Deploys via `railway up` from `backend/` (the directory is linked to the service; not GitHub-connected). `railway.toml` runs `alembic upgrade head` before uvicorn; healthcheck timeout is 600s to allow index builds. `PUBLIC_BASE_URL` points at the public Railway URL so Apify webhooks can reach it. Set `SCRAPING_API_KEY` to a long random secret for operator endpoints; `/api/scraping/start` defaults to 5 requests/minute per API key (`SCRAPING_START_RATE_LIMIT_PER_MINUTE`).

**Vercel (frontend):** project `truck-directorio`, GitHub auto-deploy, root directory `frontend/`, env `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_SITE_URL`. Every push to `main` redeploys.

## Ground rules

1. TypeScript strict, zero `any`. Pydantic for API validation. SQLAlchemy 2.0 typed models.
2. Public data only — never personal driver information.
3. Free government open data for bulk; paid scraping only for selective enrichment.
4. Rate-limit external calls; respect government servers.
5. Stay on the $5 Railway plan (see bulk ingestion rules).
6. MVP first, no over-engineering.
