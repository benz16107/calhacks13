#!/usr/bin/env bash
# Install this checkout as the box service on a test VM: /opt/box, started at boot, tasks resume after a
# power cut. Safe to run again. Needs root.   sudo core/install.sh
set -euo pipefail
cd "$(dirname "$0")/.."
core/setup.sh >/dev/null

mkdir -p /opt/box /etc/box
rsync -a --delete --exclude node_modules --exclude .git ./ /opt/box/
(cd /opt/box && npm ci --omit=dev --no-audit --no-fund --no-update-notifier --loglevel=error)
[ -f /etc/box/vault.env ] || install -m 600 /dev/null /etc/box/vault.env

cat > /etc/systemd/system/box.service <<'UNIT'
[Unit]
Description=The box: agent tasks, each as its own user in its own copy
After=network-online.target spacetimedb.service
Wants=network-online.target spacetimedb.service
StartLimitIntervalSec=0

[Service]
Environment=BOX_HOME=/var/lib/box
ExecStart=/usr/local/bin/node --experimental-strip-types --disable-warning=ExperimentalWarning /opt/box/core/box.ts
Restart=always
RestartSec=1

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable box.service >/dev/null 2>&1
systemctl restart box.service
sleep 2
systemctl is-active box.service
