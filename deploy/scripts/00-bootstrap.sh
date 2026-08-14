#!/usr/bin/env bash
#
# Provision a fresh Hostinger KVM 2 (Ubuntu 24.04) to run the whole stack:
# PostgreSQL 16, the FastAPI backend and the Next.js frontend, behind nginx.
#
# Run once, as root, on the VPS:
#   bash 00-bootstrap.sh
#
# It is idempotent — re-running it will not duplicate users, roles or swap.
set -euo pipefail

APP_USER="${APP_USER:-yotruck}"
APP_HOME="/srv/yotruck"
DB_NAME="${DB_NAME:-yotruck}"
DB_USER="${DB_USER:-yotruck}"
REPO_URL="${REPO_URL:-}"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "Run as root." >&2; exit 1; }

log "System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  build-essential curl ca-certificates gnupg git ufw fail2ban lsb-release \
  python3.12 python3.12-venv python3-pip \
  nginx certbot python3-certbot-nginx

# PostgreSQL from PGDG, not Ubuntu's default.
#
# Ubuntu 24.04 ships PostgreSQL 16, and Railway — the source of the initial
# import — runs 18. pg_dump refuses to read a server newer than itself, and an
# 18 dump does not restore into 16, so the stock package turns the data
# migration into a dead end that only shows up after everything else is built.
PG_MAJOR="${PG_MAJOR:-18}"
log "PostgreSQL ${PG_MAJOR} (PGDG)"
if ! [ -d "/usr/lib/postgresql/${PG_MAJOR}" ]; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSo /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    https://www.postgresql.org/media/keys/ACCC4CF8.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
  apt-get install -y -qq "postgresql-${PG_MAJOR}" "postgresql-contrib-${PG_MAJOR}"
fi

# The PGDG package does not always create a cluster, and when it does it lands
# on the next free port rather than 5432. Make the state explicit either way.
if ! pg_lsclusters -h | awk '{print $1}' | grep -qx "${PG_MAJOR}"; then
  pg_createcluster "${PG_MAJOR}" main -p 5432 --start
fi
pg_lsclusters

log "Node.js 20 LTS"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
node --version

log "Sizing"
TOTAL_RAM_MB="$(free -m | awk '/^Mem:/{print $2}')"
CPUS="$(nproc)"
echo "    ${CPUS} vCPU, ${TOTAL_RAM_MB} MB RAM"
if [[ "$TOTAL_RAM_MB" -lt 6000 ]]; then
  PROFILE="4gb"; SWAP_GB=6
else
  PROFILE="8gb"; SWAP_GB=4
fi
echo "    profile: ${PROFILE}"

# `next build` prerenders carrier pages and peaks well above its idle
# footprint. Without swap that peak lands on the OOM killer, which on this box
# means Postgres — the largest RSS — gets shot instead of the build. Swap is
# never touched at steady state; the 4 GB profile gets more of it precisely
# because the build has nowhere else to go.
log "Swap (${SWAP_GB} GB)"
if [[ ! -f /swapfile ]]; then
  fallocate -l "${SWAP_GB}G" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Only reach for swap under real pressure; this is a database host.
  sysctl -w vm.swappiness=10
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-yotruck.conf
fi
free -h

log "Application user"
if ! id "$APP_USER" >/dev/null 2>&1; then
  adduser --system --group --home "$APP_HOME" --shell /bin/bash "$APP_USER"
fi
mkdir -p "$APP_HOME" /var/backups/yotruck
chown -R "$APP_USER:$APP_USER" "$APP_HOME" /var/backups/yotruck

log "PostgreSQL role and database"
DB_PASSWORD_FILE="/root/.yotruck-db-password"
if [[ ! -f "$DB_PASSWORD_FILE" ]]; then
  # Generated on the box so the password never travels through a chat window,
  # a shell history file or a git remote.
  openssl rand -base64 32 | tr -d '/+=' | head -c 40 > "$DB_PASSWORD_FILE"
  chmod 600 "$DB_PASSWORD_FILE"
fi
DB_PASSWORD="$(cat "$DB_PASSWORD_FILE")"

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
fi

# pg_trgm backs the carrier name search (alembic 0002). Creating the extension
# needs superuser, so it happens here rather than inside the migration.
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c "CREATE EXTENSION IF NOT EXISTS pg_trgm"

log "PostgreSQL tuning (${PROFILE} profile)"
install -m 644 "$(dirname "$0")/../postgres/tuning-${PROFILE}.conf" \
  "/etc/postgresql/${PG_MAJOR}/main/conf.d/yotruck-tuning.conf"
systemctl restart "postgresql@${PG_MAJOR}-main"

log "Firewall"
# Postgres is never exposed: the API talks to it over the loopback interface.
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status verbose

log "Done"

# The two env files have to match the hardware, and getting them wrong is
# quiet: too many uvicorn workers on one vCPU just makes everything slower,
# and too high a prerender count turns the build into an hour of thrashing.
if [[ "$PROFILE" == "4gb" ]]; then
  SUGGEST_WORKERS=1
  SUGGEST_PRERENDER=500
else
  SUGGEST_WORKERS=2
  SUGGEST_PRERENDER=10000
fi

cat <<EOF

Detected: ${CPUS} vCPU / ${TOTAL_RAM_MB} MB  ->  ${PROFILE} profile

Next steps:

  1. Put the code in ${APP_HOME}  (git clone ${REPO_URL:-<your repo>} .)

  2. backend/.env — build DATABASE_URL without ever echoing the password:

       printf 'DATABASE_URL=postgresql://${DB_USER}:%s@127.0.0.1:5432/${DB_NAME}\n' \\
         "\$(cat ${DB_PASSWORD_FILE})" >> ${APP_HOME}/backend/.env

       UVICORN_WORKERS=${SUGGEST_WORKERS}
       ENABLE_UPDATER=true

     The password stays in ${DB_PASSWORD_FILE} (root only). Printing it here
     would put it in a terminal scrollback, a screen share or a transcript —
     which is the one thing generating it on the box was meant to avoid.

  3. frontend/.env.production.local
       NEXT_PUBLIC_API_URL=https://www.yotruck.com
       INTERNAL_API_URL=http://127.0.0.1:8000
       PRERENDER_CARRIER_COUNT=${SUGGEST_PRERENDER}

  4. Import the data:   bash deploy/scripts/10-migrate-from-railway.sh
  5. Build and start:   bash deploy/scripts/20-deploy.sh
  6. TLS:               certbot --nginx -d yotruck.com -d www.yotruck.com

EOF
