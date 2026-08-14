#!/usr/bin/env bash
#
# Build and (re)start both tiers. Safe to re-run — this is the deploy command.
#
#   sudo -u yotruck bash deploy/scripts/20-deploy.sh
#
# Run from anywhere; paths are resolved against the repo root.
set -euo pipefail

APP_HOME="${APP_HOME:-/srv/yotruck}"
BACKEND="${APP_HOME}/backend"
FRONTEND="${APP_HOME}/frontend"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m!! %s\033[0m\n' "$*" >&2; exit 1; }

[[ -f "${BACKEND}/.env" ]] || die "Missing ${BACKEND}/.env"
[[ -f "${FRONTEND}/.env.production.local" ]] || die "Missing ${FRONTEND}/.env.production.local"

# systemd expands ${UVICORN_WORKERS} into the uvicorn command line. If it is
# unset the unit starts with a bare `--workers` and dies on an argument error
# that looks nothing like a missing env var.
grep -qE '^UVICORN_WORKERS=[0-9]+' "${BACKEND}/.env" \
  || die "Set UVICORN_WORKERS in ${BACKEND}/.env (1 per vCPU: $(nproc) here)."

TOTAL_RAM_MB="$(free -m | awk '/^Mem:/{print $2}')"
CPUS="$(nproc)"
log "Box: ${CPUS} vCPU, ${TOTAL_RAM_MB} MB RAM"

# Disk fills quietly here — node_modules, two .next trees during the build, the
# ISR cache and the nightly dumps all share one volume.
AVAIL_GB="$(df -BG --output=avail "$APP_HOME" | tail -1 | tr -dc '0-9')"
[[ "$AVAIL_GB" -ge 5 ]] || die "Only ${AVAIL_GB} GB free on ${APP_HOME}. The build needs room."

# ---------------------------------------------------------------------------
# Backend
# ---------------------------------------------------------------------------
log "Backend: virtualenv"
if [[ ! -d "${BACKEND}/.venv" ]]; then
  python3.12 -m venv "${BACKEND}/.venv"
fi
"${BACKEND}/.venv/bin/pip" install --quiet --upgrade pip
"${BACKEND}/.venv/bin/pip" install --quiet -r "${BACKEND}/requirements.txt"

log "Backend: migrations"
(cd "$BACKEND" && "${BACKEND}/.venv/bin/alembic" upgrade head)

log "Backend: restart"
sudo systemctl restart yotruck-api

# The frontend build calls the API — generateStaticParams in
# app/carrier/[slug]/page.tsx prerenders 10k profiles, and every page fetches
# through lib/api.ts. Building against a dead API silently produces a site full
# of "Carrier not found", so block until it answers.
log "Waiting for the API to come up"
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    echo "    healthy after ${i}s"
    break
  fi
  [[ $i -eq 30 ]] && die "API did not become healthy. Check: journalctl -u yotruck-api -n 50"
  sleep 1
done

# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------
log "Frontend: dependencies"
(cd "$FRONTEND" && npm ci --no-audit --no-fund)

log "Frontend: build"
# NEXT_PUBLIC_* values are inlined at build time, so .env.production.local has
# to be correct *now* — changing it later without rebuilding does nothing.
#
# The heap ceiling is set below what the box has, not at it. Node's default is
# a fraction of total RAM and it will happily grow into territory that gets the
# whole process (or Postgres) OOM-killed; capping it makes V8 collect garbage
# instead, trading build time for surviving the build.
if [[ "$TOTAL_RAM_MB" -lt 6000 ]]; then
  export NODE_OPTIONS="--max-old-space-size=1536"
else
  export NODE_OPTIONS="--max-old-space-size=3072"
fi
PRERENDER="$(grep -E '^PRERENDER_CARRIER_COUNT=' "${FRONTEND}/.env.production.local" | cut -d= -f2 || true)"
echo "    NODE_OPTIONS=${NODE_OPTIONS}, prerendering ${PRERENDER:-10000 (default)} carrier pages"
echo "    On one vCPU this is the slow step — minutes per thousand pages."

(cd "$FRONTEND" && npm run build)

log "Frontend: restart"
sudo systemctl restart yotruck-web

log "Waiting for the web tier"
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 -o /dev/null http://127.0.0.1:3000/ 2>/dev/null; then
    echo "    healthy after ${i}s"
    break
  fi
  [[ $i -eq 30 ]] && die "Web did not become healthy. Check: journalctl -u yotruck-web -n 50"
  sleep 1
done

# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------
log "Smoke test"
fail=0
check() {
  local label="$1" url="$2"
  local code
  code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 20 "$url" 2>/dev/null || echo 000)"
  if [[ "$code" == "200" ]]; then
    printf '    \033[32mok\033[0m   %-28s %s\n' "$label" "$code"
  else
    printf '    \033[31mFAIL\033[0m %-28s %s\n' "$label" "$code"
    fail=1
  fi
}

check "api health"      "http://127.0.0.1:8000/api/health"
check "api stats"       "http://127.0.0.1:8000/api/carriers/stats"
check "api search"      "http://127.0.0.1:8000/api/carriers/search?q=swift&per_page=1"
check "home"            "http://127.0.0.1:3000/"
check "sitemap index"   "http://127.0.0.1:3000/sitemap.xml"
check "state page"      "http://127.0.0.1:3000/state/tx"
check "api-access page" "http://127.0.0.1:3000/api-access"

# A carrier profile, picked from live data so the check survives any dataset.
slug="$(curl -fsS --max-time 10 'http://127.0.0.1:8000/api/carriers/top?limit=1' 2>/dev/null \
        | sed -n 's/.*"slug":"\([^"]*\)".*/\1/p' | head -1)"
if [[ -n "$slug" ]]; then
  check "carrier profile" "http://127.0.0.1:3000/carrier/${slug}"
else
  printf '    \033[33mskip\033[0m %-28s (no slug returned)\n' "carrier profile"
fi

[[ $fail -eq 0 ]] || die "Smoke test failed — the old build is gone, so fix this before walking away."

log "Deployed"
systemctl --no-pager status yotruck-api yotruck-web | grep -E 'Active:|●' || true
