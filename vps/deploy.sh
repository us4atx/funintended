#!/bin/bash
# Runs ON THE VPS (as root), called by .github/workflows/deploy-vps.yml.
# Usage: deploy.sh <unpacked bundle dir> <commit sha>
#  1. Backs up the live data (Supabase table fi_documents if the server uses Supabase,
#     plus the local JSON data file if one exists) to /var/backups/funintended/.
#     The deploy stops if the backup fails.
#  2. Builds the new release next to the live one, runs make-sites.sh.
#  3. Swaps it in, restarts the service, checks the API answers.
#  4. If the check fails, puts the previous release back and restarts again.
set -euo pipefail
SRC=$1; SHA=${2:-unknown}
APP=/opt/funintended
ENV_FILE=/etc/funintended.env
BACKUPS=/var/backups/funintended
KEEP=60
STAMP=$(date -u +%Y%m%d-%H%M%S)
log(){ echo "[deploy $(date -u +%H:%M:%S)] $*"; }

# ---------- 1. backup ----------
mkdir -p "$BACKUPS"; chmod 700 "$BACKUPS"
set -a; [ -f "$ENV_FILE" ] && . "$ENV_FILE"; set +a
backed_up=0
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  out="$BACKUPS/supabase-fi_documents-$STAMP-${SHA:0:7}.json"
  log "Backing up Supabase table fi_documents"
  curl -fsS --max-time 120 "${SUPABASE_URL%/}/rest/v1/fi_documents?select=*" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -o "$out.tmp"
  python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert isinstance(d,list); print(len(d),"rows")' "$out.tmp"
  mv "$out.tmp" "$out"; gzip -9 "$out"; backed_up=1
fi
if [ -n "${FI_DEV_STORE:-}" ] && [ -f "$FI_DEV_STORE" ]; then
  out="$BACKUPS/datafile-$STAMP-${SHA:0:7}.json"
  log "Backing up data file $FI_DEV_STORE"
  python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$FI_DEV_STORE"
  cp -p "$FI_DEV_STORE" "$out"; gzip -9 "$out"; backed_up=1
fi
[ "$backed_up" = 1 ] || { log "No database found to back up (no Supabase settings, no data file). Stopping."; exit 1; }
chmod 600 "$BACKUPS"/*.gz
ls -1t "$BACKUPS"/*.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
log "Backups kept: $(ls -1 "$BACKUPS"/*.gz | wc -l) in $BACKUPS"

# ---------- 2. build new release ----------
NEW=$APP.new
rm -rf "$NEW"; mkdir -p "$NEW"
cp -r "$SRC/api" "$SRC/app" "$NEW/"
cp "$SRC/vps/server.mjs" "$SRC/vps/make-sites.sh" "$SRC/vps/package.json" "$NEW/"
echo "$SHA" > "$NEW/REVISION"
(cd "$NEW" && sh make-sites.sh)
[ -d "$NEW/sites" ] || { log "make-sites.sh produced no sites/"; exit 1; }

# ---------- 3. swap + restart ----------
rm -rf "$APP.prev"
[ -d "$APP" ] && mv "$APP" "$APP.prev"
mv "$NEW" "$APP"
log "Restarting funintended (revision ${SHA:0:7})"
systemctl restart funintended

check(){ for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: us4-app-funbackend.us4atx.com' http://127.0.0.1:${PORT:-8800}/ || true)
  [ "$code" = 200 ] && systemctl is-active --quiet funintended && return 0; sleep 2; done; return 1; }

if check; then log "Deploy OK: ${SHA:0:7}"; rm -rf "$SRC"; exit 0; fi

# ---------- 4. roll back ----------
log "Health check failed. Rolling back."
journalctl -u funintended -n 30 --no-pager || true
if [ -d "$APP.prev" ]; then rm -rf "$APP.failed"; mv "$APP" "$APP.failed"; mv "$APP.prev" "$APP"; systemctl restart funintended; check && log "Rolled back to previous release."; fi
exit 1
