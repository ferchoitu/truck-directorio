# YoTruck

FMCSA motor carrier directory: 2.2M+ active US trucking companies with real SMS BASIC measures, inspection history, and violations — all built from free public FMCSA data.

**Canonical production domain**: https://www.yotruck.com · API at https://backend-production-9a9f.up.railway.app ([docs](https://backend-production-9a9f.up.railway.app/docs))

## Current status (2026-07-31)

| Data | Rows | Source | Cost |
|---|---|---|---|
| Active carriers (name, address, phone, fleet) | 2,224,489 | FMCSA Census — data.transportation.gov `az4n-8mr2` | $0 |
| Real BASIC measures (5 categories + alerts) | 1,826,639 | SMS AB — datahub.transportation.gov `4y6x-dmck` | $0 |
| Itemized inspections (24-month window) | 5,683,534 | SMS Input Inspection — `rbkj-cgst` | $0 |
| Itemized violations (code, description, severity, OOS) | 6,675,983 | SMS Input Violation — `8mt8-2mdr` | $0 |
| Contact enrichment (email, DBA, phone) | monthly | SMS Input Census `kjg3-diqy` | $0 |
| Authority, MC and insurance | daily/monthly | FMCSA Operating Authority datasets | $0 |

Database: ~3.5GB of the 4.9GB Railway volume. **Constraint: stay on the $5 Railway plan** — see [Bulk ingestion rules](#bulk-ingestion-rules).

Shipped: search over 2.2M rows in ~0.5s (pg_trgm), 52 state pages, chunked sitemaps (50k URLs each), robots.txt, JSON-LD, ISR profiles, [metered API plans](#monetization) and [affiliate placements](#2-affiliate-offers).

Pending: weekly new-carrier cron + monthly SMS refresh, Paddle credentials + domain approval (see [Billing](#1-api-plans-paddle)), signing affiliate programs, blog content.

**Early traffic** (Google Search Console, first 3 days 27–29/07/2026): 36 clicks, 1.17k impressions, 3.1% CTR, average position 21.3. The CTR is roughly double the norm for that position, so titles and snippets are working — the ceiling is ranking, not click-through.

## Architecture

| Layer | Tech | Hosting |
|---|---|---|
| Frontend | Next.js 14 (App Router, TypeScript, Tailwind) | Vercel (auto-deploy from GitHub, root `frontend/`) |
| Backend | FastAPI + SQLAlchemy 2.0 + Alembic | Railway (deploy via `railway up` from `backend/`) |
| Database | PostgreSQL (+ Redis, reserved for caching) | Railway |
| Bulk data | Census + SMS open-data ingestion scripts | run locally against Railway's public DB URL |
| Enrichment | Additional official FMCSA open datasets | data.transportation.gov |

```
backend/    FastAPI app, models, migrations, official FMCSA ingestion scripts, tests
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

Streams `data.transportation.gov/resource/az4n-8mr2` (keyset pagination, 50k/page) into an unlogged staging table via COPY, then merges in chunked statements. `COALESCE` merge never overwrites richer fields imported from other official FMCSA datasets.

### 2. Bulk: SMS safety data (free, monthly refresh)

```bash
python -m app.ingest_sms basics                 # BASIC measures, ~700k carriers, ~3 min
python -m app.ingest_sms inspections            # 5.8M rows, staging + chunked merge, ~15 min
python -m app.ingest_sms violations --direct    # 6.7M rows, stage-less streaming, ~15 min
```

`--direct` resolves `carrier_id` per page in Python and COPYs straight into the final table — no staging, ~1GB less disk. Checkpoint file makes it resumable. Itemized tables are truncated and fully replaced each run (SMS is a rolling 24-month window).

### 3. Official enrichment datasets (free)

Use FMCSA's public datasets rather than paid third-party scraping:

- `kjg3-diqy` — active carrier census with email, DBA, phone, fleet and registration details.
- FMCSA Operating Authority datasets — MC/FF/MX authority and insurance information.
- SAFER Company Snapshot — free official one-carrier lookup for fields that are not available in bulk; integrate directly and rate-limit responsibly only if product demand requires it.

The backend intentionally contains no paid scraping triggers or third-party scraping credentials.

### Bulk ingestion rules

Hard-won on the $5 Railway plan (4.9GB volume) and its public TCP proxy:

1. **The proxy silently kills idle-looking connections** (long COPY/merge statements). Always: TCP keepalives (built into the scripts' engine), fresh connection per page, chunked merge statements, `--resume`/checkpoint flags.
2. **No staging tables for datasets >1GB** — use `--direct` streaming.
3. **One dataset at a time, `VACUUM` after big merges** — space churn, not data size, is what fills the disk.
4. If space gets tight: normalize violation descriptions into a code lookup table (~500MB reserve).

### Data quality rules

- Census `power_units` is self-reported (form MCS-150) and contains garbage (4.5M "vehicles" on a fruit stand). Sanity rules: values >150k nulled at ingest; fleets >1,000 with zero inspections nulled; fleets >5,000 require proportional inspection evidence.
- SMS BASIC **percentiles are not public** (FAST Act) — we store and display the raw SMS *measures* + acute/critical alert flags.
- Never infer an inactive carrier from a failed external lookup; use an explicit official status field.
- Public business data only — never personal driver information.

## Backend setup

Requires Python 3.12+ and a local PostgreSQL.

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env         # edit DATABASE_URL and optional SOCRATA_APP_TOKEN
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
```

These stay **public and unauthenticated** — the website renders from them server-side, so gating them would break the site. Everything sold to customers lives under `/api/v1/*` instead:

```
GET  /api/v1/carriers               same filters as above
GET  /api/v1/carriers/search?q=
GET  /api/v1/carriers/top?limit=
GET  /api/v1/carriers/by-slug/{slug}
GET  /api/v1/carriers/{usdot}
GET  /api/v1/carriers/{usdot}/safety
GET  /api/v1/usage                  quota consumed this period (does not itself consume quota)

POST /api/billing/webhook           Paddle events, HMAC-verified
POST /api/billing/claim             exchange a completed transaction for an API key
```

`/api/v1/*` requires `Authorization: Bearer <key>` and bills one request against a rolling 30-day quota.

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
- `/api-access` — API plans, endpoint table, Paddle checkout
- `/api-access/success` — one-time API key delivery after checkout (`noindex`)
- `/blog` — long-form SEO content
- `/sitemap.xml` → `/sitemaps/[id]` — chunked sitemaps, 50k URLs each, generated on demand with 24h cache
- `/robots.txt`

`npm run typecheck` and `npm run build` must pass before deploying.

**ISR gotcha**: pages prerender at build time — data ingested after a build won't appear on already-prerendered pages for 24h unless you trigger a rebuild (empty commit push).

## Monetization

Two lines that both work at low traffic and neither of which gates an indexed page.

### 1. API plans (Paddle)

Growth is $49/mo for 50,000 requests against `/api/v1/*`. Product `pro_01kyw5xvn971kg0gkj7bea7hsb`, price `pri_01kyw5zy3982s8ntx3mebyr2sm`.

Flow: Paddle overlay checkout → `subscription.created` webhook provisions a `subscribers` row → the success page exchanges the transaction id for an API key via `POST /api/billing/claim`.

- **Only a SHA-256 hash of the key is stored.** The plaintext is shown once and is unrecoverable; claiming again *rotates* and invalidates the previous key.
- Webhooks verify Paddle's `ts=..;h1=..` HMAC over `{ts}:{raw_body}` with a 300s replay window. An unsigned request is rejected with 401.
- The plan is resolved from the Paddle price id (`_plan_for()` in `routers/billing.py`), not hardcoded. New tiers need one entry there plus one in `PLAN_QUOTAS`.
- An unrecognised price still provisions on the entry plan — by webhook time the customer has already paid.
- Price ids are **not secret** (they ship in the public frontend bundle) and are committed. API keys, client tokens and webhook secrets never are.

Backend env: `PADDLE_ENVIRONMENT`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_PRICE_ID_GROWTH`.
Frontend env: `NEXT_PUBLIC_PADDLE_ENVIRONMENT`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_PRICE_GROWTH`.

Until the client token and price are both set, the checkout button **falls back to a mailto link** so the CTA is never dead.

Still required before taking payments: register the webhook destination at `/api/billing/webhook` for `subscription.*`, approve the domain in Paddle, complete seller verification, and run `alembic upgrade head` (migration `0004` creates `subscribers`).

### 2. Affiliate offers

Rendered on carrier profiles **below** the carrier's own data — never above the atomic-answer block that drives AI citations.

- Links carry `rel="sponsored nofollow noopener noreferrer"`. Google requires `sponsored` for paid links; omitting it across 2.2M pages invites a manual action.
- A commission disclosure is always visible next to the offers (FTC).
- The section renders **nothing** until a partner URL is configured, so unsigned programs never leave dead links.
- Category is chosen by **violations per inspection**, never by raw violation count — nearly every inspected carrier has *some* violation, so a `> 0` test routes the whole directory to one offer. `>= 2` per inspection (or any BASIC alert) → compliance; clean record with ≤10 power units → factoring; otherwise insurance + ELD.

Env: `NEXT_PUBLIC_AFF_INSURANCE_URL`, `NEXT_PUBLIC_AFF_ELD_URL`, `NEXT_PUBLIC_AFF_FACTORING_URL`, `NEXT_PUBLIC_AFF_COMPLIANCE_URL`.

### Deliberately not built: consumer paywall

Metering profile views (5 free/month, then paid tiers) was considered and rejected on 2026-07-31. At ~360 visits/month the meter would almost never trigger, so it would earn roughly nothing while risking the SEO that is just starting to work — paywalling indexed pages without Google's declared metered-paywall JSON-LD is cloaking. Revisit at 5–10k visits/month.

## Crawler policy

ClaudeBot is blocked; **every other bot is deliberately allowed**. It was generating 902K of 907K edge requests in 24h (99.4%) at a 0.8% cache hit rate, which also drove ~235K function invocations.

Blocked in two places: the `rules` array in `frontend/app/robots.ts`, **and** a Vercel WAF rule on `User-Agent contains "ClaudeBot"`. The WAF rule is account configuration, not in this repo — it will not survive a move off Vercel.

Googlebot, OAI-SearchBot and PerplexityBot stay allowed on purpose: carrier pages carry an `atomicAnswer()` GEO/AEO block written to be cited in AI answers. **Do not enable Vercel's blanket AI-bot protection** — it would catch those too.

## Deploy

**Railway (backend):** project `carriercheck` with Postgres + Redis. Deploys via `railway up` from `backend/` (the directory is linked to the service; not GitHub-connected). `railway.toml` runs `alembic upgrade head` before uvicorn; healthcheck timeout is 600s to allow index builds.

**Vercel (frontend):** project `truck-directorio`, GitHub auto-deploy, root directory `frontend/`, env `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_SITE_URL=https://www.yotruck.com`, plus the Paddle and affiliate variables from [Monetization](#monetization). Every push to `main` redeploys. Add both `www.yotruck.com` and `yotruck.com` to the Vercel project, make `www` primary, and redirect the apex domain to `www`.

## Ground rules

1. TypeScript strict, zero `any`. Pydantic for API validation. SQLAlchemy 2.0 typed models.
2. Public data only — never personal driver information.
3. Use free official government data; add direct, rate-limited official lookups only when a field is unavailable in bulk.
4. Rate-limit external calls; respect government servers.
5. Stay on the $5 Railway plan (see bulk ingestion rules).
6. MVP first, no over-engineering.
7. **Never gate an indexed page.** Organic search is the whole traffic engine; monetize through the API, affiliates and ads, not by paywalling `/carrier/*`. Any paid link must carry `rel="sponsored"`.
8. Credentials live in env vars only — never in the repo, never in a chat transcript. Price ids are public and may be committed; keys, tokens and webhook secrets may not.
