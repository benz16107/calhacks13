#!/usr/bin/env bash
# Prepare a test box (Ubuntu 24.04, ARM64 or x86) for the box service. Safe to run again. Needs root.
set -euo pipefail
NODE_MAJOR=24

# nftables limits task networks; ripgrep is for Droid (it would try to download one otherwise).
missing=$(for p in nftables ripgrep; do dpkg -s $p >/dev/null 2>&1 || echo $p; done)
[ -z "$missing" ] || { apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq $missing >/dev/null 2>&1; }

have_node() { command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ]; }

if ! have_node; then
  arch=$(uname -m); case $arch in aarch64) arch=arm64;; x86_64) arch=x64;; esac
  base=https://nodejs.org/dist/latest-v$NODE_MAJOR.x
  file=$(curl -fsSL "$base/SHASUMS256.txt" | grep -o "node-v[0-9.]*-linux-$arch.tar.xz" | head -1)
  tmp=$(mktemp -d)
  curl -fsSL "$base/$file" -o "$tmp/$file"
  (cd "$tmp" && curl -fsSL "$base/SHASUMS256.txt" | grep " $file\$" | sha256sum -c -)
  tar -xJf "$tmp/$file" -C /usr/local --strip-components=1 --exclude CHANGELOG.md --exclude README.md --exclude LICENSE
  rm -rf "$tmp"
fi
node -v

# The Droid CLI, for every task user. Not Factory's install script: it kills every running droid.
DROID_VERSION=0.248.0
if ! /usr/local/bin/droid --version 2>/dev/null | grep -q "$DROID_VERSION"; then
  arch=$(uname -m); case $arch in aarch64) arch=arm64;; x86_64) arch=x64; grep -qi avx2 /proc/cpuinfo || arch=x64-baseline;; esac
  url=https://downloads.factory.ai/factory-cli/releases/$DROID_VERSION/linux/$arch/droid
  tmp=$(mktemp)
  curl -fsSL "$url" -o "$tmp"
  [ "$(sha256sum "$tmp" | cut -d' ' -f1)" = "$(curl -fsSL "$url.sha256")" ] || { echo "droid checksum mismatch" >&2; exit 1; }
  install -m 0755 "$tmp" /usr/local/bin/droid
  rm -f "$tmp"
fi
droid --version

# SpacetimeDB: live task status and approvals for the portal and phone. The box publishes its module at boot.
if ! command -v spacetime >/dev/null; then
  curl -sSf https://install.spacetimedb.com | HOME=/root sh -s -- --yes >/dev/null
  ln -sf /root/.local/bin/spacetime /usr/local/bin/spacetime
fi
unit=/etc/systemd/system/spacetimedb.service
want=$(cat <<'UNIT'
[Unit]
Description=SpacetimeDB for the box
After=network.target
StartLimitIntervalSec=0

[Service]
Environment=HOME=/root
# Loopback only: SpacetimeDB has no login, so anyone who could reach it could read every task and forge an
# approval. Phones follow the box's authed API and SSE stream instead. To expose it on purpose (a tailnet
# address), put STDB_LISTEN=<address> in /etc/box/stdb.env.
Environment=STDB_LISTEN=127.0.0.1
EnvironmentFile=-/etc/box/stdb.env
ExecStart=/usr/local/bin/spacetime start --non-interactive --data-dir /var/lib/spacetimedb --listen-addr ${STDB_LISTEN}:3000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
)
if [ "$(cat $unit 2>/dev/null)" != "$want" ]; then
  printf '%s\n' "$want" > $unit
  systemctl daemon-reload
  systemctl enable spacetimedb.service >/dev/null 2>&1
  systemctl restart spacetimedb.service
fi
spacetime --version | head -1
