#!/bin/bash
# One-time install of the FunIntended provisioning agent. Run ON THE VPS as root, from this folder.
# Safe to re-run: it never overwrites /etc/funintended.env or an existing /etc/funintended-provision.env.
set -euo pipefail
cd "$(dirname "$0")"
DIR=/var/lib/funintended/provision
ENVF=/etc/funintended-provision.env
CADDY_DIR=/etc/openpanel/caddy/domains

# The FunIntended service user must be able to write requests and read status.
SVC_USER=$(systemctl show -p User --value funintended 2>/dev/null || true); SVC_USER=${SVC_USER:-root}
SVC_GROUP=$(id -gn "$SVC_USER")
install -d -m 755 /opt/funintended-provision
install -m 755 fi-provision.mjs /opt/funintended-provision/fi-provision.mjs
install -d -m 755 /var/lib/funintended "$DIR"
install -d -m 2770 -o root -g "$SVC_GROUP" "$DIR/requests"
install -d -m 755 "$DIR/status"

[ -d "$CADDY_DIR" ] || { echo "Caddy domains folder $CADDY_DIR not found. Set FI_CADDY_DIR in $ENVF."; }
if [ ! -f "$ENVF" ]; then
  cat > "$ENVF" <<CONF
# FunIntended provisioning agent settings (see fi-provision.mjs). Not the app's env file.
FI_PROVISION_DIR=$DIR
FI_HOSTING_DOMAIN=us4atx.com
FI_SITE_PREFIX=us4-site-fun-
FI_VPS_IP=162.35.50.245
FI_CADDY_DIR=$CADDY_DIR
FI_UPSTREAM=127.0.0.1:8800
FI_STATUS_OWNER=$(id -u "$SVC_USER"):$(id -g "$SVC_USER")
# Leave empty to auto-detect the Caddy container; or give full commands, e.g.
# FI_CADDY_VALIDATE_CMD=podman exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
# FI_CADDY_RELOAD_CMD=podman exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
FI_CADDYFILE_IN_CONTAINER=/etc/caddy/Caddyfile
CONF
  chmod 600 "$ENVF"; echo "Wrote $ENVF"
fi

install -m 644 funintended-provision.service funintended-provision.path funintended-provision.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now funintended-provision.path funintended-provision.timer
systemctl start funintended-provision.service
echo "Installed. Requests: $DIR/requests  Status: $DIR/status  Logs: journalctl -u funintended-provision"
