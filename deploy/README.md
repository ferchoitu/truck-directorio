# Deploying YoTruck on a Hostinger VPS

Moves the whole stack off Railway and Vercel onto a single Hostinger VPS. The
recurring cost afterwards is the VPS alone, replacing the Railway bill.

Written for a **KVM 1** (1 vCPU, 4 GB RAM, 50 GB NVMe, Ubuntu 24.04) and sized
automatically for a KVM 2/3 when you move up — `00-bootstrap.sh` reads the
hardware and picks the profile, so the upgrade path is "restore a snapshot on
the bigger box and re-run the scripts", not a rewrite.

Nothing about the application changes. Next.js keeps running as it does today,
with SSR, ISR and the 30-day revalidate on carrier pages, so the SEO setup is
untouched. Two small code changes support the move:

- [`lib/api.ts`](../frontend/lib/api.ts) prefers `INTERNAL_API_URL`, so
  server-side rendering reaches uvicorn over loopback instead of the public
  internet.
- [`carrier/[slug]/page.tsx`](../frontend/app/carrier/%5Bslug%5D/page.tsx) reads
  the build-time prerender count from `PRERENDER_CARRIER_COUNT` instead of
  hardcoding 10.000.

## Layout on the box

```
                        nginx :443
                            │
              ┌─────────────┴─────────────┐
       /api/  │                           │  everything else
              ▼                           ▼
    uvicorn 127.0.0.1:8000      next start 127.0.0.1:3000
              │                           │
              │      INTERNAL_API_URL     │
              └───────────◀───────────────┘
              ▼
    postgres 127.0.0.1:5432   (listen_addresses = localhost)
```

`/api-access` is a Next.js page, not an API route. The trailing slash in
nginx's `location /api/` is what keeps the two apart — don't drop it.

## Sizing

| | KVM 1 (now) | KVM 2 |
| --- | --- | --- |
| Postgres profile | `tuning-4gb.conf` | `tuning-8gb.conf` |
| `shared_buffers` | 768 MB | 2 GB |
| Parallel query | off | 1 worker/gather |
| `UVICORN_WORKERS` | 1 | 2 |
| `PRERENDER_CARRIER_COUNT` | 500 | 10000 |
| Swap | 6 GB | 4 GB |
| Backup retention | 3 days | 7 days |

The prerender count is the important one. `dynamicParams` defaults to true, so
profiles not baked at build time are rendered on the first request and then
cached for the same 30 days a prerendered page gets. Prerendering 10.000 pages
on one vCPU is an hour of build; 500 is a few minutes, and the only difference
a visitor can observe is one slow first load on an uncommon profile.

## Files

| Path | Purpose |
| --- | --- |
| `scripts/00-bootstrap.sh` | Provisions a fresh VPS, detects the hardware, picks the Postgres profile |
| `scripts/10-migrate-from-railway.sh` | `pg_dump` from Railway → `pg_restore` locally, then verifies |
| `scripts/20-deploy.sh` | Build + restart both tiers, with a smoke test. This is the deploy command |
| `scripts/30-backup.sh` | Nightly `pg_dump`, retention scaled to the disk, integrity-checked |
| `scripts/40-disk-guard.sh` | Caps the Next.js ISR cache so a crawl cannot fill the volume |
| `systemd/yotruck-api.service` | uvicorn, `$UVICORN_WORKERS`, loopback-bound |
| `systemd/yotruck-web.service` | `next start` |
| `nginx/yotruck.conf` | TLS front, `/api/` split, apex→www redirect |
| `postgres/tuning-4gb.conf` | Postgres settings for a KVM 1 |
| `postgres/tuning-8gb.conf` | Postgres settings for a KVM 2 |

---

## 1. Provision

SSH in as root and run:

```bash
apt-get update && apt-get install -y git
git clone <your-repo-url> /srv/yotruck
bash /srv/yotruck/deploy/scripts/00-bootstrap.sh
```

It detects the box, installs the matching Postgres profile, and prints the
generated `DATABASE_URL` along with the right `UVICORN_WORKERS` and
`PRERENDER_CARRIER_COUNT` for the hardware. The password is also at
`/root/.yotruck-db-password`, root-readable only — it is generated on the box
so it never travels through a terminal you don't control.

## 2. Environment files

**`/srv/yotruck/backend/.env`** — copy from `.env.example` and set:

```
DATABASE_URL=postgresql://yotruck:<from step 1>@127.0.0.1:5432/yotruck
UVICORN_WORKERS=1
ENABLE_UPDATER=true
PADDLE_ENVIRONMENT=production
PADDLE_API_KEY=<from Paddle>
PADDLE_WEBHOOK_SECRET=<from Paddle>
```

**`/srv/yotruck/frontend/.env.production.local`**:

```
NEXT_PUBLIC_API_URL=https://www.yotruck.com
INTERNAL_API_URL=http://127.0.0.1:8000
PRERENDER_CARRIER_COUNT=500
NEXT_PUBLIC_PADDLE_ENVIRONMENT=production
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=<from Paddle>
```

Then lock them down:

```bash
chown yotruck:yotruck /srv/yotruck/backend/.env /srv/yotruck/frontend/.env.production.local
chmod 600 /srv/yotruck/backend/.env /srv/yotruck/frontend/.env.production.local
```

`NEXT_PUBLIC_*` values are compiled into the bundle at build time. Editing them
later without re-running step 5 changes nothing.

## 3. Import the database

Take `DATABASE_PUBLIC_URL` from the Railway dashboard (Postgres service →
Variables) and:

```bash
RAILWAY_DATABASE_URL='postgresql://...' bash /srv/yotruck/deploy/scripts/10-migrate-from-railway.sh
```

On one vCPU, budget the better part of a day and start it in `tmux`. The dump
is the part Railway bills egress for; rebuilding the two `pg_trgm` GIN indexes
over 2.2M carrier names is the part that takes the longest, and it cannot be
parallelised on a single core. If the restore dies, re-run — the dump file is
kept and reused.

The script checks for 20 GB free before starting and ends by printing row
counts and database size. **Compare them against Railway before continuing.**

## 4. Services and nginx

```bash
cp /srv/yotruck/deploy/systemd/*.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable yotruck-api yotruck-web

cp /srv/yotruck/deploy/nginx/yotruck.conf /etc/nginx/sites-available/yotruck
ln -sf /etc/nginx/sites-available/yotruck /etc/nginx/sites-enabled/yotruck
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

The deploy script calls `systemctl restart` as the `yotruck` user, so give it
exactly that and nothing more:

```bash
cat > /etc/sudoers.d/yotruck <<'EOF'
yotruck ALL=(root) NOPASSWD: /usr/bin/systemctl restart yotruck-api, /usr/bin/systemctl restart yotruck-web
EOF
chmod 440 /etc/sudoers.d/yotruck
```

## 5. Build and start

```bash
sudo -u yotruck bash /srv/yotruck/deploy/scripts/20-deploy.sh
```

The script waits for `/api/health` before building, on purpose: the frontend
build calls the API, and building against a dead one produces a site full of
"Carrier not found" pages without failing loudly. It caps Node's heap below
what the box has so V8 collects garbage instead of getting OOM-killed, and
finishes with a smoke test across the home page, a state page, the sitemap
index, `/api-access` and a live carrier profile.

On one vCPU the build is the slow step and the site will feel sluggish while it
runs. Deploy when traffic is low.

## 6. TLS, then DNS

**What actually happened on 2026-08-13**, because the plan above did not survive
contact with the providers:

- **Hostinger cannot host this zone.** `PUT /api/dns/v1/zones/yotruck.com`
  returns `[DNS:4009] Domain not found` — Hostinger only serves DNS for domains
  in the account, and yotruck.com is registered at GoDaddy. The earlier `GET`
  returning `[]` reads like an empty zone; it is not, it is a missing one.
- **The zone lives at GoDaddy now**, on ns77/ns78.domaincontrol.com. GoDaddy
  refuses to show the record editor while the nameservers point elsewhere, so
  the records could not be staged before the switch — NS first, records second,
  with a short window where GoDaddy served its default parked zone.
- **The certificate was issued before the cutover** with a DNS-01 challenge
  (`/root/acme-dns-hook.sh`), so HTTPS was valid from the first request. The
  renewal config was switched to the nginx authenticator afterwards — leaving
  it on the manual hook would have failed silently at renewal time.

The zone at GoDaddy, for reference:

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 187.127.9.37 |
| CNAME | www | yotruck.com |
| TXT | @ | google-site-verification=X4at1BVkS27Ngdj… |

Two things that were on Vercel and did **not** move: the CAA records
(`letsencrypt.org`, `pki.goog`, `sectigo.com`) and the `_acme-challenge` TXTs.
The CAA absence is permissive, not blocking — with no CAA at all any CA may
issue, so renewal works; re-add them when convenient to restore the
restriction.

One trap worth remembering: adding `_acme-challenge.www` to a zone whose `www`
was served by a wildcard **breaks `www`**. A wildcard does not apply to a name
that exists in the zone (RFC 4592), and creating a record *under* `www` makes
`www` exist. That took www.yotruck.com down until an explicit `A www` record
was added.

Verify from outside:

```bash
curl -I https://www.yotruck.com/
curl -s https://www.yotruck.com/api/health
curl -I https://yotruck.com/          # expect 301 to www
```

Certbot installs its own renewal timer. Confirm with `systemctl list-timers |
grep certbot`.

## 7. Cron jobs

Railway did the backups for you. Now you do, and on a 50 GB disk you also need
the cache guard:

```bash
cp /srv/yotruck/deploy/scripts/30-backup.sh     /usr/local/bin/yotruck-backup
cp /srv/yotruck/deploy/scripts/40-disk-guard.sh /usr/local/bin/yotruck-disk-guard
chmod +x /usr/local/bin/yotruck-backup /usr/local/bin/yotruck-disk-guard

crontab -e
# 15 3 * * *   /usr/local/bin/yotruck-backup     >> /var/log/yotruck-backup.log 2>&1
# */30 * * * * /usr/local/bin/yotruck-disk-guard >> /var/log/yotruck-disk.log   2>&1
```

Run both once by hand to confirm they work.

**Why the disk guard matters here.** There are 2.2M carrier URLs in your
sitemaps and `dynamicParams` is on, so every profile Googlebot visits gets
rendered and written to the on-disk ISR cache, where it sits for the 30-day
revalidate window. Next.js does not cap that cache. A few hundred thousand
crawled profiles is an ordinary month for a directory this size, and at tens of
KB each that is tens of GB on a 50 GB volume that also holds a 6 GB database.
Evicting entries is harmless — the next request regenerates the page.

Note what the backups protect: the dumps sit on the same disk as the database,
which covers a bad migration but not a dead VPS. Turn on Hostinger's VPS
snapshots as well, or sync the `subscribers` dump off-box — that table is the
only genuinely irreplaceable data, since everything else can be re-ingested
free from FMCSA.

## 8. Decommission Railway

Leave it running a few days with DNS already cut over. Once you're confident,
delete the services. Don't skip the Paddle side: the webhook URL in the Paddle
dashboard still points at the Railway host and must be updated to
`https://www.yotruck.com/api/billing/webhook`, or subscriptions will silently
stop syncing.

---

## Operating it

```bash
# Logs
journalctl -u yotruck-api -f
journalctl -u yotruck-web -f
tail -f /var/log/nginx/yotruck.error.log

# Deploy a change
cd /srv/yotruck && git pull
sudo -u yotruck bash deploy/scripts/20-deploy.sh

# Health at a glance
df -h /                                    # disk is the tightest resource
free -h                                    # swap in use = something is wrong
sudo -u postgres psql -d yotruck -c "SELECT pg_size_pretty(pg_database_size('yotruck'))"
du -sh /srv/yotruck/frontend/.next/cache   # ISR cache
```

### Monthly FMCSA reingest

The daily census updater runs inside the API process (`ENABLE_UPDATER=true`).
The SMS datasets are a separate manual job, and on one vCPU it is genuinely
heavy — run it overnight, in `tmux`, and expect the site to be slow while it
goes:

```bash
cd /srv/yotruck/backend
sudo -u yotruck .venv/bin/python -m app.ingest_sms basics
sudo -u yotruck .venv/bin/python -m app.ingest_sms inspections --resume
sudo -u yotruck .venv/bin/python -m app.ingest_sms violations --resume
sudo -u postgres psql -d yotruck -c "ANALYZE"
```

### When to move to a KVM 2

Concrete triggers, in the order they will probably arrive:

- **`df -h` past 75%.** The first and most likely one. 50 GB is the real
  constraint, not RAM.
- **Sustained swap use in `free -h`.** Swap should be idle at steady state; if
  it isn't, Postgres and Node are fighting over 4 GB.
- **Load average above ~2 for hours.** One vCPU shared by nginx, Node,
  uvicorn and Postgres, with ISR misses rendering on demand.
- **Deploys becoming disruptive.** If a build makes the site visibly slow for
  long enough to matter, you've outgrown the core.

The upgrade is not a migration: snapshot, resize, re-run `00-bootstrap.sh` so
it installs the 8 GB profile, raise `UVICORN_WORKERS` and
`PRERENDER_CARRIER_COUNT`, redeploy.

### Things that will bite

- **Single point of failure.** Everything is on one box now. That is the trade
  you made for the cost and it is reasonable at this stage, but a VPS outage is
  a full site outage with no managed failover behind it. Snapshots turn that
  from a disaster into an afternoon.
- **`UVICORN_WORKERS` above 1 multiplies the census updater.** `ENABLE_UPDATER`
  starts the loop in every uvicorn worker, so two workers means two concurrent
  daily pulls against data.transportation.gov. The upserts make it harmless but
  wasteful — worth fixing before you raise the worker count.
