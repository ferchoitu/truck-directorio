#!/usr/bin/env bash
#
# One-shot import of the Railway database into the local PostgreSQL.
#
#   RAILWAY_DATABASE_URL='postgresql://...' bash 10-migrate-from-railway.sh
#
# Take the URL from the Railway dashboard (Postgres service -> Variables ->
# DATABASE_PUBLIC_URL). Pass it on the command line as shown so it lands in the
# process environment and not in ~/.bash_history; it is never echoed here.
#
# Expect a few hours: the dump is ~6 GB of data and rebuilding the two
# pg_trgm GIN indexes over 2.2M carrier names is the slow part. The script is
# resumable — the dump file is kept and reused if the restore fails.
set -euo pipefail

DB_NAME="${DB_NAME:-yotruck}"
DB_USER="${DB_USER:-yotruck}"
DUMP_DIR="${DUMP_DIR:-/var/backups/yotruck}"
DUMP_FILE="${DUMP_DIR}/railway-migration.dump"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m!! %s\033[0m\n' "$*" >&2; exit 1; }

[[ -n "${RAILWAY_DATABASE_URL:-}" ]] || die "Set RAILWAY_DATABASE_URL (see header)."

mkdir -p "$DUMP_DIR"

# The dump and the restored database coexist on the same disk: roughly 2 GB of
# compressed dump plus ~6 GB of tables and indexes, plus WAL churn during the
# load. On a 50 GB KVM 1 that is a real constraint, and running out of space
# mid-restore leaves a half-loaded database rather than a clean failure.
AVAIL_GB="$(df -BG --output=avail "$DUMP_DIR" | tail -1 | tr -dc '0-9')"
echo "Free space on $(df --output=target "$DUMP_DIR" | tail -1): ${AVAIL_GB} GB"
if [[ "$AVAIL_GB" -lt 20 ]]; then
  die "Need ~20 GB free to import safely, found ${AVAIL_GB} GB. Free space first."
fi

# ---------------------------------------------------------------------------
# 1. Dump
# ---------------------------------------------------------------------------
if [[ -s "$DUMP_FILE" ]]; then
  log "Reusing existing dump at ${DUMP_FILE} ($(du -h "$DUMP_FILE" | cut -f1))"
  echo "    Delete it to force a fresh dump."
else
  log "Dumping from Railway (this is the step that bills egress)"
  # --no-owner / --no-acl: the roles on Railway do not exist here, and the
  # local objects should all belong to $DB_USER.
  # Custom format (-Fc) so the restore can run in parallel and skip objects.
  pg_dump \
    --format=custom \
    --no-owner \
    --no-acl \
    --verbose \
    --file="$DUMP_FILE" \
    "$RAILWAY_DATABASE_URL"
  log "Dump complete: $(du -h "$DUMP_FILE" | cut -f1)"
fi

# ---------------------------------------------------------------------------
# 2. Restore
# ---------------------------------------------------------------------------
log "Preparing local database for a bulk load"
# Raised only for the duration of the import, then put back below. The GIN
# builds over 2.2M carrier names are what consume this. Scaled to the box: on a
# 4 GB KVM 1 a 2 GB setting would push the build straight into swap.
TOTAL_RAM_MB="$(free -m | awk '/^Mem:/{print $2}')"
CPUS="$(nproc)"
if [[ "$TOTAL_RAM_MB" -lt 6000 ]]; then IMPORT_MWM="1GB"; else IMPORT_MWM="2GB"; fi
echo "    ${CPUS} vCPU, ${TOTAL_RAM_MB} MB RAM -> maintenance_work_mem=${IMPORT_MWM}"

sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -c "ALTER DATABASE ${DB_NAME} SET maintenance_work_mem = '${IMPORT_MWM}'" \
  -c "ALTER DATABASE ${DB_NAME} SET synchronous_commit = off" >/dev/null

log "Restoring into ${DB_NAME} (${CPUS} job(s))"
# One job per vCPU. Parallel restore on a single core makes the index builds
# fight each other for the same CPU while multiplying peak memory.
# --clean --if-exists makes a retry safe: a half finished restore is wiped
# rather than merged into.
sudo -u postgres pg_restore \
  --dbname="$DB_NAME" \
  --jobs="$CPUS" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --verbose \
  "$DUMP_FILE" || die "pg_restore failed. Fix the cause and re-run; the dump is kept."

log "Restoring normal settings"
sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -c "ALTER DATABASE ${DB_NAME} RESET maintenance_work_mem" \
  -c "ALTER DATABASE ${DB_NAME} RESET synchronous_commit" >/dev/null

# Every object arrived owned by the restoring superuser; hand it to the app role.
log "Granting ownership to ${DB_USER}"
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};
DO \$\$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO ${DB_USER}', r.tablename);
  END LOOP;
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO ${DB_USER}', r.sequencename);
  END LOOP;
END
\$\$;
SQL

# The planner has no statistics for freshly restored tables. Without this the
# first hours of traffic run on default estimates and pick bad plans.
log "ANALYZE (planner statistics)"
sudo -u postgres psql -d "$DB_NAME" -c "ANALYZE VERBOSE" >/dev/null

# ---------------------------------------------------------------------------
# 3. Verify
# ---------------------------------------------------------------------------
log "Row counts"
sudo -u postgres psql -d "$DB_NAME" <<'SQL'
SELECT 'carriers'      AS table, count(*) FROM carriers
UNION ALL SELECT 'inspections',   count(*) FROM inspections
UNION ALL SELECT 'violations',    count(*) FROM violations
UNION ALL SELECT 'safety_scores', count(*) FROM safety_scores
UNION ALL SELECT 'subscribers',   count(*) FROM subscribers;

SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;

-- The trgm indexes are the ones worth confirming: without them the search
-- endpoint degrades to a sequential scan over 2.2M rows.
SELECT indexname FROM pg_indexes
 WHERE tablename = 'carriers' AND indexname LIKE '%trgm%';
SQL

cat <<EOF

Compare those counts against Railway before you cut DNS over. Once they match:

  1. bash deploy/scripts/20-deploy.sh
  2. Point DNS at this VPS
  3. Leave Railway running a few days, then delete the service

The dump is still at ${DUMP_FILE}. Delete it once you are confident — it is
several GB and the daily backup job covers you from then on.
EOF
