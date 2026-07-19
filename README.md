# CarrierCheck.io

FMCSA motor carrier directory: safety ratings, BASIC scores, inspections, and violations for 700,000+ US trucking companies, built from public FMCSA data.

## Architecture

| Layer | Tech | Hosting |
|---|---|---|
| Frontend | Next.js 14 (App Router, TypeScript, Tailwind) | Vercel |
| Backend | FastAPI + SQLAlchemy 2.0 + Alembic | Railway |
| Database | PostgreSQL + Redis | Railway |
| Scraping | Apify actors (via API + webhooks) | Apify |

```
backend/    FastAPI app, models, Apify integration, Alembic migrations, tests
frontend/   Next.js app: home, search, carrier profiles (ISR)
data/       Keyword research exports
```

## Backend setup

Requires Python 3.12+ and a local PostgreSQL.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

cp .env.example .env        # edit DATABASE_URL, APIFY_TOKEN, APIFY_WEBHOOK_SECRET

createdb carriercheck        # or create the DB any other way
alembic upgrade head         # apply migrations

uvicorn app.main:app --reload --port 8000
```

API docs at http://localhost:8000/docs.

Run tests (no database needed — they use in-memory SQLite):

```bash
pytest tests/
```

### Key endpoints

```
GET  /api/health
GET  /api/carriers                  filters: state, operation_type, safety_rating, min/max_vehicles + pagination
GET  /api/carriers/search?q=        by name (ILIKE) or exact USDOT/MC number
GET  /api/carriers/top?limit=       biggest fleets first (used for ISR prerendering)
GET  /api/carriers/by-slug/{slug}
GET  /api/carriers/{usdot}
GET  /api/carriers/{usdot}/safety   BASIC scores + inspections + top-10 violations
POST /api/scraping/start            {usdot_range_start, usdot_range_end, actor: main|safety|new}
GET  /api/scraping/jobs
GET  /api/scraping/jobs/{id}
POST /api/webhooks/apify            Apify completion callback (?secret=&job_id=)
```

### Scraping flow

1. `POST /api/scraping/start` creates a `scraping_jobs` row and launches the Apify actor with a completion webhook pointing at `{PUBLIC_BASE_URL}/api/webhooks/apify?secret=...&job_id=...`.
2. When the run finishes, Apify calls the webhook; the backend downloads the dataset, normalizes field names (`app/services/ingest.py`), and upserts carriers (plus safety scores / inspections / violations for the safety actor).
3. The job row tracks status, total and processed record counts.

For the initial population, run batches of ~1,000 USDOT numbers at a time and respect Apify/FMCSA rate limits.

## Frontend setup

Requires Node 18+.

```bash
cd frontend
npm install
cp .env.example .env.local   # point NEXT_PUBLIC_API_URL at the backend
npm run dev
```

- `/` — home with the main search box
- `/search?q=` — results with pagination (25/page)
- `/carrier/[slug]` — ISR profile pages, `revalidate: 86400`, prerenders the top 10,000 carriers by fleet size at build time via `/api/carriers/top`

`npm run typecheck` and `npm run build` must pass before deploying.

## Deploy

**Railway (backend):** create a service from `backend/`, add PostgreSQL and Redis plugins, set the variables from `backend/.env.example` (Railway injects `DATABASE_URL`/`REDIS_URL`; `postgres://` URLs are normalized automatically). The `Procfile` runs migrations before starting uvicorn. Set `PUBLIC_BASE_URL` to the public Railway URL so Apify webhooks can reach it.

**Vercel (frontend):** import `frontend/` as the root directory, set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL`.

## Ground rules

1. TypeScript strict, zero `any`. Pydantic for API validation. SQLAlchemy 2.0 typed models.
2. Public data only — never personal driver information.
3. Rate-limit scraping; respect government servers.
4. MVP first, no over-engineering.
