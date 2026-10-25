#!/usr/bin/env bash
# Set up the public live-demo host (try.gurtos.com) on a fresh Ubuntu 24.04 VM with root and NO real keys.
# Safe to run again. It installs Node, SpacetimeDB and Caddy (via core/setup.sh), then the gateway service,
# Caddy for HTTPS, a light firewall, and a 6-hour reset. It never installs Droid or writes any real secret.
#
#   sudo DOMAIN=try.gurtos.com SSH_ALLOW=<cidr> try/setup.sh
#
# DOMAIN   the public name Caddy gets a certificate for (default try.gurtos.com)
# SSH_ALLOW a CIDR allowed to reach port 22 (default 0.0.0.0/0, so you are not locked out; tighten later)
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
DOMAIN=${DOMAIN:-try.gurtos.com}
SSH_ALLOW=${SSH_ALLOW:-0.0.0.0/0}
TRY_PORT=${TRY_PORT:-7788}

[ "$(id -u)" = 0 ] || { echo "run as root on a test VM" >&2; exit 1; }

echo "== refusing to run if this host holds real keys or is on the real network =="
if [ -f /etc/box/vault.env ] && grep -Eqv '^\s*(#|$|[A-Z0-9_]+=demo-)' /etc/box/vault.env; then
  echo "FAIL: /etc/box/vault.env has non-demo values. This host must hold no real keys." >&2; exit 1
fi
if command -v tailscale >/dev/null && tailscale status >/dev/null 2>&1; then
  echo "FAIL: tailscale is up on this host. The demo host must not be on the private tailnet." >&2; exit 1
fi

echo "== base: node, spacetimedb, caddy, nftables (no droid) =="
BOX_NO_DROID=1 "$ROOT/core/setup.sh" >/dev/null
echo "node $(node -v), caddy $(/usr/local/bin/caddy version | head -1)"

echo "== the gateway service =="
install -d -m 0700 /var/lib/box-try
cat > /etc/systemd/system/try-gateway.service <<UNIT
[Unit]
Description=GurtOS public live demo gateway (try.gurtos.com)
After=network-online.target spacetimedb.service
Wants=network-online.target spacetimedb.service

[Service]
Environment=TRY_PORT=${TRY_PORT}
Environment=BOX_NO_DROID=1
WorkingDirectory=${ROOT}
ExecStart=/usr/local/bin/node --experimental-strip-types --disable-warning=ExperimentalWarning ${ROOT}/try/gateway.ts
Restart=always
RestartSec=2
KillMode=mixed
TimeoutStopSec=25

[Install]
WantedBy=multi-user.target
UNIT

echo "== Caddy: HTTPS for ${DOMAIN} -> 127.0.0.1:${TRY_PORT} =="
install -d -m 0755 /etc/box-try
cat > /etc/box-try/Caddyfile <<CADDY
{
  admin off
}
${DOMAIN} {
  encode zstd gzip
  reverse_proxy 127.0.0.1:${TRY_PORT} {
    # Overwrite any client-supplied X-Forwarded-For with the real peer, so per-IP limits can't be spoofed.
    header_up X-Forwarded-For {remote_host}
  }
}
CADDY
id caddy >/dev/null 2>&1 || useradd --system --home /var/lib/caddy --create-home --shell /usr/sbin/nologin caddy
install -d -m 0750 -o caddy -g caddy /var/lib/caddy
cat > /etc/systemd/system/box-try-caddy.service <<UNIT
[Unit]
Description=Caddy for the GurtOS live demo
After=network-online.target
Wants=network-online.target

[Service]
User=caddy
Group=caddy
Environment=HOME=/var/lib/caddy
Environment=XDG_DATA_HOME=/var/lib/caddy
AmbientCapabilities=CAP_NET_BIND_SERVICE
ExecStart=/usr/local/bin/caddy run --config /etc/box-try/Caddyfile
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

echo "== firewall =="
# Inbound: loopback, established, 80/443 from anywhere, 22 from SSH_ALLOW. Everything else dropped.
# Egress guard: a task is already confined to the fake web by the box proxy; this is defence in depth so that
# even a hypothetical escape to the host cannot reach the real boxes, the relay or any private network.
#
# Inbound: Ubuntu on Vultr ships UFW enabled (default-deny, only 22 open), so open 80/443 there, or the ACME
# challenge and the site are unreachable. If UFW is not present, fall back to our own input table.
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
  [ "$SSH_ALLOW" = "0.0.0.0/0" ] || { ufw allow from "$SSH_ALLOW" to any port 22 proto tcp >/dev/null && ufw --force delete allow 22/tcp >/dev/null 2>&1 || true; }
  ufw reload >/dev/null
  echo "ufw: 80/443 open$( [ "$SSH_ALLOW" = "0.0.0.0/0" ] || echo ", 22 limited to $SSH_ALLOW")"
else
  cat > /etc/nftables-try-in.conf <<NFT
table inet try_in {
  chain input {
    type filter hook input priority 0; policy drop;
    ct state established,related accept
    iif "lo" accept
    ip protocol icmp accept
    ip6 nexthdr ipv6-icmp accept
    tcp dport { 80, 443 } accept
    ip saddr ${SSH_ALLOW} tcp dport 22 accept
  }
}
NFT
  nft -f /etc/nftables-try-in.conf
  grep -q nftables-try-in.conf /etc/nftables.conf 2>/dev/null || echo 'include "/etc/nftables-try-in.conf"' >> /etc/nftables.conf
fi
# The egress guard is always ours (UFW's per-IP egress is awkward): a task is already confined to the fake web
# by the box proxy; this makes sure even a host-level escape cannot reach the real boxes or any private network.
cat > /etc/nftables-try.conf <<NFT
table inet try_guard {
  chain output {
    type filter hook output priority -10; policy accept;
    oif "lo" accept
    # never reach the real boxes, the relay, or any private range
    ip daddr { 104.207.151.249, 45.32.140.213, 140.82.51.9, 149.28.206.167, 104.238.181.14 } drop
    ip daddr { 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 100.64.0.0/10, 169.254.0.0/16 } drop
    ip6 daddr { fc00::/7, fe80::/10 } drop
  }
}
NFT
# Load our tables without clobbering the box's own nft tables.
nft -f /etc/nftables-try.conf
# Make it stick across reboot alongside whatever else is loaded.
grep -q nftables-try.conf /etc/nftables.conf 2>/dev/null || echo 'include "/etc/nftables-try.conf"' >> /etc/nftables.conf
systemctl enable nftables >/dev/null 2>&1 || true

echo "== 6-hour reset (restart wipes every box) =="
cat > /etc/systemd/system/try-reset.service <<'UNIT'
[Unit]
Description=Reset the GurtOS live demo (wipe all demo boxes)
[Service]
Type=oneshot
ExecStart=/bin/systemctl restart try-gateway.service
UNIT
cat > /etc/systemd/system/try-reset.timer <<'UNIT'
[Unit]
Description=Reset the GurtOS live demo every 6 hours
[Timer]
OnBootSec=6h
OnUnitActiveSec=6h
[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now box-try-caddy.service try-gateway.service try-reset.timer >/dev/null
sleep 2
systemctl is-active try-gateway.service box-try-caddy.service
echo "== done. http://127.0.0.1:${TRY_PORT}/ is the gateway; https://${DOMAIN}/ once DNS points here. =="
