#!/usr/bin/env bash
# Prepare a test box (Ubuntu 24.04, ARM64 or x86) for the box service. Safe to run again. Needs root.
#   core/setup.sh          everything      BOX_NO_DROID=1 core/setup.sh   everything but Droid
#   core/setup.sh droid    only the Droid CLI (an image's first boot)
set -euo pipefail
NODE_MAJOR=24

# The Droid CLI, for every task user. Not Factory's install script: it kills every running droid.
# Its license does not allow shipping it inside our images, so an image sets BOX_NO_DROID=1 here and runs
# `core/setup.sh droid` at first boot instead.
install_droid() {
  DROID_VERSION=0.248.0
  if ! /usr/local/bin/droid --version 2>/dev/null | grep -q "$DROID_VERSION"; then
    arch=$(uname -m); case $arch in aarch64) arch=arm64;; x86_64) arch=x64; grep -qi avx2 /proc/cpuinfo || arch=x64-baseline;; esac
    # Pinned here, not fetched beside the file: a checksum from the same server proves nothing if that server is wrong.
    # Checked against Factory's published droid.sha256 for 0.248.0 on Oct 29 2026. A new DROID_VERSION needs all three.
    case $arch in
      x64) sum=721cbf9bb2b136a8ef6926038da61aa4bd8cca2dfc0cf2f99c4b6ad251fa5416 ;;
      x64-baseline) sum=e5bf27c3e10d17b07c07c7719aaeaf57b650bc15f0014a34e09cc9487fa48866 ;;
      arm64) sum=b6503be37b6247b86096e899f9e685f41926070d844f2fd2ba6068e85187a579 ;;
      *) echo "Droid is not built for this processor ($(uname -m))" >&2; exit 1 ;;
    esac
    url=https://downloads.factory.ai/factory-cli/releases/$DROID_VERSION/linux/$arch/droid
    tmp=$(mktemp)
    trap 'rm -f "$tmp"' EXIT # a failed or cut-off download leaves nothing behind
    # About 300 MB. A line slower than 20 KB/s for a minute is cut and tried again (the image's box-droid has the same).
    curl -fsSL --connect-timeout 20 --speed-limit 20000 --speed-time 60 --retry 3 --retry-delay 5 "$url" -o "$tmp" ||
      { echo "Droid's download from Factory did not finish" >&2; exit 1; }
    [ "$(sha256sum "$tmp" | cut -d' ' -f1)" = "$sum" ] || { echo "droid checksum mismatch: the download is not Droid $DROID_VERSION" >&2; exit 1; }
    install -m 0755 "$tmp" /usr/local/bin/droid.new && mv /usr/local/bin/droid.new /usr/local/bin/droid # never a half-written droid
    rm -f "$tmp"
    trap - EXIT
  fi
  droid --version
}
if [ "${1:-}" = droid ]; then install_droid; exit 0; fi

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

[ "${BOX_NO_DROID:-}" = 1 ] || install_droid

# Remote access (opt in, core/remote.ts): frpc for the tunnel to the GurtOS relay, Caddy for the box's own
# certificate. Pinned release binaries, checked against their sha256.
FRP=0.71.1 CADDY=2.11.7
case $(uname -m) in
  aarch64) a=arm64 frp_sha=8edf590b0c396fa42f9c147121a76af83cfc2002b08f5aef0ea1008c43482019 caddy_sha=d8fc6d179a5d283028a472a5618564f6ad8a86fed513e64f032b3b0b7cc45e42;;
  *) a=amd64 frp_sha=1d9875210972a5d1a62b2dc4c48df45ab0af05d3ca1b5e494a014428259df803 caddy_sha=727b91701a392de6ebc5027509f548bf39979e5216340d0faed8fa5e69c84f8b;;
esac
if ! /usr/local/bin/frpc --version 2>/dev/null | grep -qx "$FRP"; then
  tmp=$(mktemp -d)
  curl -fsSL "https://github.com/fatedier/frp/releases/download/v$FRP/frp_${FRP}_linux_$a.tar.gz" -o "$tmp/frp.tgz"
  echo "$frp_sha  $tmp/frp.tgz" | sha256sum -c --quiet -
  tar -xzf "$tmp/frp.tgz" -C "$tmp" && install -m 0755 "$tmp/frp_${FRP}_linux_$a/frpc" /usr/local/bin/frpc
  rm -rf "$tmp"
fi
if ! /usr/local/bin/caddy version 2>/dev/null | grep -q "^v$CADDY "; then
  tmp=$(mktemp -d)
  curl -fsSL "https://github.com/caddyserver/caddy/releases/download/v$CADDY/caddy_${CADDY}_linux_$a.tar.gz" -o "$tmp/caddy.tgz"
  echo "$caddy_sha  $tmp/caddy.tgz" | sha256sum -c --quiet -
  tar -xzf "$tmp/caddy.tgz" -C "$tmp" caddy && install -m 0755 "$tmp/caddy" /usr/local/bin/caddy
  rm -rf "$tmp"
fi


# SpacetimeDB: live task status and approvals for the portal and phone. The box publishes its module at boot.
# Pinned release files, checked against the sha256 GitHub publishes for each, laid out the way its own installer does
# (spacetime is the version manager; bin/<version> holds the CLI and the server). No script from the internet runs.
STDB=2.13.0
case $(uname -m) in
  aarch64) t=aarch64-unknown-linux-gnu stdb_sha=47e4ad61f3d5830cf75a0b5b2432f5d9c115ab4e37505f757d7555f3ad1fe8f0 upd_sha=5056baeaa55963585a092afe7590b8b394db369821e5a675660640cdad91fcbb;;
  *) t=x86_64-unknown-linux-gnu stdb_sha=034fe43ebb42e8d291c6ba18b6b3a6ac9a3bb4aa548d37743340362cb021165e upd_sha=dc30ca52824cfe0ece2427da8a4ccafc0ad605140f635e2fcde97bf2f5bb2232;;
esac
if ! command -v spacetime >/dev/null; then
  tmp=$(mktemp -d) local=${STDB_ROOT:-/root/.local} # STDB_ROOT: only to try this block somewhere else
  rel=https://github.com/clockworklabs/SpacetimeDB/releases/download/v$STDB
  curl -fsSL "$rel/spacetime-$t.tar.gz" -o "$tmp/stdb.tgz"
  curl -fsSL "$rel/spacetimedb-update-$t" -o "$tmp/spacetime"
  printf '%s  %s\n' "$stdb_sha" "$tmp/stdb.tgz" "$upd_sha" "$tmp/spacetime" | sha256sum -c --quiet -
  mkdir -p "$local/share/spacetime/bin/$STDB" "$local/share/spacetime/data" "$local/bin"
  tar -xzf "$tmp/stdb.tgz" -C "$local/share/spacetime/bin/$STDB"
  ln -sfn "$STDB" "$local/share/spacetime/bin/current"
  install -m 0744 "$tmp/spacetime" "$local/bin/spacetime"
  rm -rf "$tmp"
  [ -n "${STDB_ROOT:-}" ] || ln -sf /root/.local/bin/spacetime /usr/local/bin/spacetime
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
