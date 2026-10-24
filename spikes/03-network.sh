#!/usr/bin/env bash
# Spike 3: per-task network limits. Run as root in the test VM after 02-users.sh (needs task-a, task-b).
# Tasks may only reach the local proxy on 127.0.0.1:8888; the proxy allows named domains per task.
set -uo pipefail
D=$(cd "$(dirname "$0")" && pwd)
systemctl stop spike-proxy spike-local 2>/dev/null; nft delete table inet spike3 2>/dev/null
id box-proxy >/dev/null 2>&1 || useradd -r -M -d /nonexistent -s /usr/sbin/nologin box-proxy
install -m 644 "$D/03-proxy.mjs" /usr/local/lib/spike-proxy.mjs
systemd-run -q --unit=spike-proxy -p User=box-proxy node /usr/local/lib/spike-proxy.mjs
systemd-run -q --unit=spike-local python3 -m http.server 9999 --bind 127.0.0.1 --directory /var/empty   # stands in for SpacetimeDB or the vault on localhost
sleep 1

check() { local want=$1 desc=$2; shift 2; if out=$("$@" 2>&1); then got=allowed; else got=denied; fi
  [ "$got" = "$want" ] && r=PASS || r=FAIL; printf '%-5s %-8s %-62s %s\n' "$r" "$got" "$desc" "$(echo "$out" | tail -1 | cut -c1-70)"; }
H="-p NoNewPrivileges=yes -p ProtectProc=invisible -p PrivateTmp=yes -p ProtectHome=yes -p ProtectSystem=strict"
task() { local u=$1; shift; systemd-run -q --wait --pipe --slice=box.slice -p User=$u $H "$@"; }
P="-x http://127.0.0.1:8888"

suite() {
  check denied  "task-a direct https://registry.npmjs.org (no proxy)"     task task-a curl -sS -m 5 -o /dev/null https://registry.npmjs.org
  check denied  "task-a direct to an IP, https://1.1.1.1"             task task-a curl -sS -m 5 -o /dev/null -k https://1.1.1.1
  check denied  "task-a DNS lookup (closes DNS exfiltration)"         task task-a getent ahosts example.com
  check denied  "task-a another localhost service, 127.0.0.1:9999"    task task-a curl -sS -m 5 -o /dev/null http://127.0.0.1:9999/
  check allowed "task-a via proxy to its allowed registry.npmjs.org"      task task-a curl -sS -m 10 -o /dev/null $P https://registry.npmjs.org/left-pad
  check denied  "task-a via proxy to example.com (not on its list)"   task task-a curl -sS -m 10 -o /dev/null $P https://example.com
  check allowed "task-b via proxy to its allowed example.com"         task task-b curl -sS -m 10 -o /dev/null $P https://example.com
  check allowed "root outside box.slice, direct (box itself unaffected)" curl -sS -m 10 -o /dev/null https://registry.npmjs.org/left-pad
}

echo "== variant A: nftables matches the task's uid range (meta skuid)"
nft -f - <<'NFT'
table inet spike3 {
  chain out {
    type filter hook output priority filter; policy accept;
    meta skuid 30000-39999 ip daddr 127.0.0.1 tcp dport 8888 accept
    meta skuid 30000-39999 counter log prefix "spike3-uid-block " reject
  }
}
NFT
suite
nft delete table inet spike3

echo "== variant B: nftables matches the task's cgroup (socket cgroupv2)"
systemctl stop box.slice 2>/dev/null
if nft add table inet spike3 2>/dev/null && nft add chain inet spike3 out '{ type filter hook output priority filter; policy accept; }' \
   && nft add rule inet spike3 out socket cgroupv2 level 1 '"box.slice"' counter reject 2>/tmp/nfterr; then echo "rule added before box.slice existed"
else echo "GOTCHA: rule for a cgroup that does not exist yet is refused: $(cat /tmp/nfterr | head -1)"; fi
nft delete table inet spike3 2>/dev/null
systemctl start box.slice; echo "box.slice active after explicit start: $(systemctl is-active box.slice)"
nft -f - <<'NFT'
table inet spike3 {
  chain out {
    type filter hook output priority filter; policy accept;
    socket cgroupv2 level 1 "box.slice" ip daddr 127.0.0.1 tcp dport 8888 accept
    socket cgroupv2 level 1 "box.slice" counter log prefix "spike3-cg-block " reject
  }
}
NFT
suite
check denied  "user nobody in box.slice, direct (cgroup alone blocks)" task nobody curl -sS -m 5 -o /dev/null https://registry.npmjs.org
echo "-- does the cgroup rule survive box.slice being stopped and started again?"
systemctl stop box.slice; systemctl start box.slice
check denied  "task-a direct after slice restart"                     task task-a curl -sS -m 5 -o /dev/null https://registry.npmjs.org
nft list chain inet spike3 out | grep cgroupv2 | head -1
nft delete table inet spike3

echo "== variant C: systemd only, IPAddressDeny=any IPAddressAllow=127.0.0.1 (no nftables, no port control)"
tc() { systemd-run -q --wait --pipe -p User=task-a -p IPAddressDeny=any -p IPAddressAllow=127.0.0.1 $H "$@"; }
check denied  "task-a direct https://registry.npmjs.org"                  tc curl -sS -m 5 -o /dev/null https://registry.npmjs.org
check allowed "task-a via proxy to registry.npmjs.org"                    tc curl -sS -m 10 -o /dev/null $P https://registry.npmjs.org/left-pad
check allowed "task-a another localhost service (port not limited)"   tc curl -sS -m 5 -o /dev/null http://127.0.0.1:9999/

echo "== proxy log (who asked for what)"; journalctl -u spike-proxy --no-pager -o cat | grep '^{' | tail -8
echo "== kernel log of blocked packets"; journalctl -k --no-pager -o cat | grep spike3 | tail -3
systemctl stop spike-proxy spike-local box.slice
