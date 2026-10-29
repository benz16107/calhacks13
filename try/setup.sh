#!/usr/bin/env bash
# Set up the public live demo (a try.<your domain> host) on a fresh Ubuntu 24.04 machine with root and NO real keys.
# Safe to run again. It installs Node, SpacetimeDB and Caddy (via core/setup.sh), the box's npm packages, then the
# gateway service, Caddy for HTTPS, a firewall, and a 6-hour reset. It never installs Droid or writes any real secret.
#
#   sudo DOMAIN=try.example.com try/setup.sh          set it up (DNS for the name must already point here)
#   sudo try/setup.sh remove                           take it down again, on a host you want to keep
#
# DOMAIN    the public name Caddy gets a certificate for (required)
# SSH_ALLOW a CIDR allowed to reach port 22 (default 0.0.0.0/0, so you are not locked out; tighten later)
# TRY_BLOCKED_IPS  hosts the machine must never reach, besides the private ranges (or one per line in /etc/try/blocked-ips)
# TRY_PORT  the gateway's loopback port (default 7788)
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
SSH_ALLOW=${SSH_ALLOW:-0.0.0.0/0}
TRY_PORT=${TRY_PORT:-7788}

[ "$(id -u)" = 0 ] || { echo "run as root on a machine used only for this" >&2; exit 1; }

echo "== refusing to run if this host holds real keys or is on the real network =="
if [ -f /etc/box/vault.env ] && grep -Eqv '^\s*(#|$|[A-Z0-9_]+=demo-)' /etc/box/vault.env; then
  echo "FAIL: /etc/box/vault.env has non-demo values. This host must hold no real keys." >&2; exit 1
fi
if command -v tailscale >/dev/null && tailscale status >/dev/null 2>&1; then
  echo "FAIL: tailscale is up on this host. The demo host must not be on the private tailnet." >&2; exit 1
fi

if [ "${1:-}" = remove ]; then
  echo "== removing the live demo (Node, SpacetimeDB, Caddy and the npm packages stay) =="
  systemctl disable --now try-reset.timer try-gateway.service box-try-caddy.service >/dev/null 2>&1 || true
  rm -f /etc/systemd/system/try-gateway.service /etc/systemd/system/box-try-caddy.service /etc/systemd/system/try-reset.service /etc/systemd/system/try-reset.timer
  systemctl daemon-reload
  nft delete table inet try_guard 2>/dev/null || true
  nft delete table inet try_in 2>/dev/null || true
  sed -i '/nftables-try/d' /etc/nftables.conf 2>/dev/null || true
  rm -f /etc/nftables-try.conf /etc/nftables-try-in.conf
  rm -rf /etc/box-try /var/lib/box-try
  echo "removed. Rules added to ufw for ports 80 and 443 are left in place."
  exit 0
fi

DOMAIN=${DOMAIN:?set DOMAIN to the public name of this host, for example: sudo DOMAIN=try.example.com try/setup.sh}
[[ $DOMAIN =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] || { echo "DOMAIN must be a lowercase domain name like try.example.com, got \"$DOMAIN\"" >&2; exit 2; }

echo "== base: node, spacetimedb, caddy, nftables (no droid) =="
BOX_NO_DROID=1 "$ROOT/core/setup.sh" >/dev/null
echo "node $(node -v), caddy $(/usr/local/bin/caddy version | head -1)"

echo "== the box's npm packages (production only) =="
lock=$(sha256sum package-lock.json | cut -c1-16)
[ -f "node_modules/.lock-$lock" ] || { npm ci --omit=dev --no-audit --no-fund --loglevel=error && touch "node_modules/.lock-$lock"; }

echo "== the gateway service =="
install -d -m 0700 /var/lib/box-try
cat > /etc/systemd/system/try-gateway.service <<UNIT
[Unit]
Description=GurtOS public live demo gateway
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
# Inbound: some providers ship UFW enabled (default-deny, only 22 open), so open 80/443 there, or the ACME
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
#
# The specific hosts to block (the real boxes and the relay) are NOT in this public repo. Pass them at setup time
# in TRY_BLOCKED_IPS (space- or comma-separated IPv4/CIDR) or in the git-ignored file /etc/try/blocked-ips (one per
# line). Without them the private ranges below still apply; add the public ones for full defence in depth.
blocked=${TRY_BLOCKED_IPS:-}
[ -z "$blocked" ] && [ -f /etc/try/blocked-ips ] && blocked=$(grep -vE '^[[:space:]]*(#|$)' /etc/try/blocked-ips | tr '\n' ' ')
blocked_set=$(printf '%s' "$blocked" | tr ', ' '\n\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+(/[0-9]+)?$' | paste -sd, -)
hosts_rule=""
[ -n "$blocked_set" ] && hosts_rule="ip daddr { $blocked_set } drop"
# The host's own DNS resolvers and DHCP server may sit inside the private ranges below (some providers put them
# there), so they are let through first, on their own ports only.
dns_set=$(awk '$1 == "nameserver" && $2 ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ {print $2}' /run/systemd/resolve/resolv.conf /etc/resolv.conf 2>/dev/null | sort -u | paste -sd, -)
infra_rule="udp dport 67 accept"
[ -n "$dns_set" ] && infra_rule="ip daddr { $dns_set } meta l4proto { tcp, udp } th dport 53 accept
    $infra_rule"
cat > /etc/nftables-try.conf <<NFT
table inet try_guard {
  chain output {
    type filter hook output priority -10; policy accept;
    oif "lo" accept
    # never reach the specific hosts in TRY_BLOCKED_IPS / /etc/try/blocked-ips, or any private range
    ${hosts_rule}
    ${infra_rule}
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
