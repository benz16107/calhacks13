#!/usr/bin/env bash
# Install this checkout as the box service on a test VM: /opt/box, started at boot, tasks resume after a
# power cut. Safe to run again. Needs root.   sudo core/install.sh
set -euo pipefail
cd "$(dirname "$0")/.."
# One install at a time per machine: two deploys at once collide in npm ci on /opt/box/node_modules. The lock is in a
# folder only root can open (a task could hold one in /run/lock).
install -d -m 700 /run/box; exec 8>/run/box/install.lock
flock -n 8 || { echo "install: waiting for another install on this machine to finish"; flock 8; }
core/setup.sh >/dev/null

mkdir -p /opt/box /etc/box
# Only what the box runs: the core, the apps, the built portal, the Personal desktop layer, and the package files.
# (Docs, screenshots, the image builder and the sites stay in the repo.)
rsync -a --delete --exclude node_modules --exclude screenshots \
  --include '/core/***' --include '/tracks/***' --include '/personal/***' \
  --include '/portal/' --include '/portal/dist/***' --include '/portal/package.json' \
  --include '/package.json' --include '/package-lock.json' --include '/VERSION' --include '/LICENSE' --include '/NOTICE' \
  --exclude '*' ./ /opt/box/
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
# In an image build's chroot there is no running systemd: enable the unit for first boot and stop there.
if [ ! -d /run/systemd/system ]; then systemctl enable box.service >/dev/null 2>&1 || ln -sf /etc/systemd/system/box.service /etc/systemd/system/multi-user.target.wants/box.service; exit 0; fi
systemctl daemon-reload
systemctl enable box.service >/dev/null 2>&1
systemctl restart box.service
sleep 2
systemctl is-active box.service
