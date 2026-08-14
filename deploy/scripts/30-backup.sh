#!/usr/bin/env bash
#
# Nightly database backup.
#
# Railway took care of this; self-hosting does not. Install with:
#   sudo cp deploy/scripts/30-backup.sh /usr/local/bin/yotruck-backup
#   sudo chmod +x /usr/local/bin/yotruck-backup
#   sudo crontab -e
#     15 3 * * * /usr/local/bin/yotruck-backup >> /var/log/yotruck-backup.log 2>&1
set -euo pipefail

DB_NAME="${DB_NAME:-yotruck}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/yotruck}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/yotruck-${STAMP}.dump"

mkdir -p "$BACKUP_DIR"

# Retention scales with the disk. Each full dump is ~1.5-2 GB compressed, so
# seven of them is ~14 GB — a third of a KVM 1's 50 GB volume, competing with
# the database, the ISR cache and the build output. Three days is still enough
# to notice and roll back a bad migration.
DISK_GB="$(df -BG --output=size "$BACKUP_DIR" | tail -1 | tr -dc '0-9')"
if [[ "$DISK_GB" -lt 80 ]]; then
  KEEP_DAILY="${KEEP_DAILY:-3}"
else
  KEEP_DAILY="${KEEP_DAILY:-7}"
fi

# A backup that fills the disk takes the site down with it — the database
# cannot write WAL on a full volume. Bail before creating the problem.
AVAIL_GB="$(df -BG --output=avail "$BACKUP_DIR" | tail -1 | tr -dc '0-9')"
if [[ "$AVAIL_GB" -lt 5 ]]; then
  echo "[$(date -Is)] ABORT: only ${AVAIL_GB} GB free, refusing to dump" >&2
  exit 1
fi

# The bulk of the database is FMCSA data that can be re-ingested for free from
# the public datasets. What is genuinely irreplaceable is `subscribers` — the
# paying customers and their API key hashes. It gets its own small, fast dump
# so a restore of just that table never has to wait on the 6 GB one.
# Output goes through a redirect rather than pg_dump's --file, on purpose: the
# dump runs as the postgres user, which has no write access to a backup
# directory owned by the app user. Redirecting makes root's shell create the
# file and hands postgres nothing but a pipe.
echo "[$(date -Is)] subscribers-only dump"
sudo -u postgres pg_dump --format=custom --table=subscribers "$DB_NAME" \
  > "${BACKUP_DIR}/subscribers-${STAMP}.dump"

echo "[$(date -Is)] full dump -> ${TARGET}"
sudo -u postgres pg_dump --format=custom --compress=6 "$DB_NAME" > "$TARGET"

# A dump that cannot be listed is not a backup. This catches truncation and
# disk-full silently producing a corrupt file.
echo "[$(date -Is)] verifying"
sudo -u postgres pg_restore --list "$TARGET" >/dev/null || {
  echo "[$(date -Is)] CORRUPT DUMP, removing ${TARGET}" >&2
  rm -f "$TARGET"
  exit 1
}

echo "[$(date -Is)] pruning older than ${KEEP_DAILY} days"
find "$BACKUP_DIR" -name 'yotruck-*.dump'     -mtime "+${KEEP_DAILY}" -delete
find "$BACKUP_DIR" -name 'subscribers-*.dump' -mtime "+30"            -delete

echo "[$(date -Is)] done: $(du -h "$TARGET" | cut -f1), disk $(df -h "$BACKUP_DIR" | awk 'NR==2{print $5" used"}')"

# NOTE: these copies live on the same disk as the database. That covers
# "I dropped a table", not "the VPS is gone". Sync them off-box — Hostinger's
# VPS snapshots, or an rclone job to any object store — before you rely on it.
