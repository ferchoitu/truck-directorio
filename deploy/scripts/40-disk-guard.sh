#!/usr/bin/env bash
#
# Keeps the Next.js ISR cache from filling a 50 GB volume.
#
# Why this exists: dynamicParams is on and there are 2.2M carrier URLs, all of
# them in the sitemaps. Every one Googlebot visits gets rendered and written to
# the on-disk incremental cache, where it stays for the 30-day revalidate
# window. Next does not cap that cache. A crawl of a few hundred thousand
# profiles is a normal month for a directory this size and, at tens of KB per
# entry, it is tens of GB — on a box where the database already wants 6.
#
# Evicting an entry is cheap and safe: the next request for that page
# regenerates it, exactly as if its revalidate window had expired.
#
# Install:
#   sudo cp deploy/scripts/40-disk-guard.sh /usr/local/bin/yotruck-disk-guard
#   sudo chmod +x /usr/local/bin/yotruck-disk-guard
#   sudo crontab -e
#     */30 * * * * /usr/local/bin/yotruck-disk-guard >> /var/log/yotruck-disk.log 2>&1
set -euo pipefail

CACHE_DIR="${CACHE_DIR:-/srv/yotruck/frontend/.next/cache}"
# Ceiling for the cache itself, and the free-space floor that overrides it.
MAX_CACHE_GB="${MAX_CACHE_GB:-8}"
MIN_FREE_GB="${MIN_FREE_GB:-8}"

[[ -d "$CACHE_DIR" ]] || { echo "[$(date -Is)] no cache dir yet at ${CACHE_DIR}"; exit 0; }

cache_gb() { du -sBG "$CACHE_DIR" 2>/dev/null | cut -f1 | tr -dc '0-9'; }
free_gb()  { df -BG --output=avail "$CACHE_DIR" | tail -1 | tr -dc '0-9'; }

CACHE="$(cache_gb)"; FREE="$(free_gb)"
echo "[$(date -Is)] cache ${CACHE} GB / limit ${MAX_CACHE_GB} GB, free ${FREE} GB / floor ${MIN_FREE_GB} GB"

if [[ "$CACHE" -le "$MAX_CACHE_GB" && "$FREE" -ge "$MIN_FREE_GB" ]]; then
  echo "[$(date -Is)] within limits, nothing to do"
  exit 0
fi

# Evict oldest-accessed first, in slices, rechecking as we go. Least recently
# used is the right order here: those are the profiles nothing is asking for.
echo "[$(date -Is)] over limit, evicting"
EVICTED=0
for _ in $(seq 1 40); do
  mapfile -t batch < <(find "$CACHE_DIR" -type f -printf '%A@ %p\n' 2>/dev/null \
                       | sort -n | head -2000 | cut -d' ' -f2-)
  [[ ${#batch[@]} -eq 0 ]] && break
  rm -f "${batch[@]}"
  EVICTED=$((EVICTED + ${#batch[@]}))
  CACHE="$(cache_gb)"; FREE="$(free_gb)"
  [[ "$CACHE" -le "$MAX_CACHE_GB" && "$FREE" -ge "$MIN_FREE_GB" ]] && break
done

# Directory skeleton left behind by the eviction.
find "$CACHE_DIR" -type d -empty -delete 2>/dev/null || true

echo "[$(date -Is)] evicted ${EVICTED} entries -> cache ${CACHE} GB, free ${FREE} GB"

if [[ "$FREE" -lt "$MIN_FREE_GB" ]]; then
  echo "[$(date -Is)] STILL BELOW FLOOR — the cache is not what is filling the disk." >&2
  echo "[$(date -Is)] Check: du -shx /var/backups/yotruck /var/lib/postgresql /srv/yotruck" >&2
  exit 1
fi
