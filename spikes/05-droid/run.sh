#!/usr/bin/env bash
# Spike 5: Droid as its own unprivileged task user, in its own overlay copy, with no internet and no real key.
# Run as root in the test VM. Needs node, the droid CLI on PATH (core/setup.sh or `npm i -g droid@0.248.0`).
# The real key: FACTORY_API_KEY=fk-... in /etc/box/vault.env (root, 0600). Without it this runs to Factory's 401.
set -uo pipefail
S=$(cd "$(dirname "$0")" && pwd); B=/var/lib/spike5; U=task-d; UID_D=30004
KEY=$(sed -n 's/^FACTORY_API_KEY=//p' /etc/box/vault.env 2>/dev/null | head -1)
[ -n "$KEY" ] && echo "key: found in /etc/box/vault.env" || echo "key: NONE in /etc/box/vault.env, expect a 401 from Factory at the end"
systemctl stop spike5-broker 2>/dev/null; nft delete table inet spike5 2>/dev/null
for m in $(findmnt -rn -o TARGET | grep "^$B/" | sort -r); do umount "$m"; done; rm -rf --one-file-system $B
command -v rg >/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ripgrep >/dev/null
getent group box-ws >/dev/null || groupadd -g 2000 box-ws; id box-ws >/dev/null 2>&1 || useradd -M -d /nonexistent -s /usr/sbin/nologin -u 2000 -g 2000 box-ws
userdel $U 2>/dev/null; groupdel $U 2>/dev/null; groupadd -g $UID_D $U; useradd -M -d $B/tasks/d/home -s /usr/sbin/nologin -u $UID_D -g $UID_D $U

# The SDK lives where every task user can read it.
[ -d /opt/spike5/node_modules/@factory/droid-sdk ] || { mkdir -p /opt/spike5 && cd /opt/spike5 && npm init -y >/dev/null && npm i --silent --no-audit --no-fund @factory/droid-sdk@0.10.0; }
install -m 644 "$S/task.mjs" /opt/spike5/task.mjs

# Workspace and the task's copy, as in spike 2.
mkdir -p $B/base/lower $B/base/idlower/d $B/tasks/d/{upper,work,merged,home}; chmod 711 $B $B/tasks; chmod 700 $B/base
printf '# demo project\n' > $B/base/lower/README.md; chown -R box-ws:box-ws $B/base/lower
mount --bind -o X-mount.idmap="u:2000:$UID_D:1 g:2000:$UID_D:1" $B/base/lower $B/base/idlower/d
chown root:$U $B/tasks/d; chmod 750 $B/tasks/d; chown $U:$U $B/tasks/d/upper $B/tasks/d/home
mount -t overlay task-d -o lowerdir=$B/base/idlower/d,upperdir=$B/tasks/d/upper,workdir=$B/tasks/d/work $B/tasks/d/merged

# The broker holds the key. Tasks may reach only the broker's port.
systemd-run -q --unit=spike5-broker -E FACTORY_REAL_KEY="$KEY" node "$S/broker.mjs"; sleep 1
nft -f - <<'NFT'
table inet spike5 {
  chain out {
    type filter hook output priority filter; policy accept;
    meta skuid 30000-39999 ip daddr 127.0.0.1 tcp dport 7799 accept
    meta skuid 30000-39999 counter log prefix "spike5-block " reject
  }
}
NFT

echo "== droid runs as $U in its copy"
systemd-run -q --wait --pipe -p User=$U -p NoNewPrivileges=yes -p ProtectProc=invisible -p PrivateTmp=yes -p ProtectHome=yes \
  -p ProtectSystem=strict -p ReadWritePaths="$B/tasks/d/merged $B/tasks/d/home" -p PrivateDevices=yes -p CapabilityBoundingSet= \
  -E HOME=$B/tasks/d/home -E PATH=/usr/local/bin:/usr/bin:/bin -E NODE_PATH=/opt/spike5/node_modules \
  -E FACTORY_API_KEY=fk-task-placeholder -E FACTORY_API_BASE_URL=http://127.0.0.1:7799 -E FACTORY_RIPGREP_PATH=/usr/bin/rg \
  -E DROID_MODEL="${DROID_MODEL:-claude-opus-5-5}" ${LIST_MODELS:+-E LIST_MODELS=1} \
  --working-directory=$B/tasks/d/merged timeout 300 node /opt/spike5/task.mjs
echo "rc=$?"
echo "== the task's changes (its upper dir)"; (cd $B/tasks/d/upper && find . -type f | sort)
[ -f $B/tasks/d/merged/hello.txt ] && echo "hello.txt: $(cat $B/tasks/d/merged/hello.txt)"
echo "lower README untouched: $(cat $B/base/lower/README.md)"
echo "== broker log"; journalctl -u spike5-broker --no-pager -o cat | grep '^{' | tail -12
echo "== blocked packets (droid trying other hosts directly)"; journalctl -k --no-pager -o cat --since "-6min" | grep spike5-block | awk '{print $5, $6, $(NF-2)}' | sort | uniq -c | head
systemctl stop spike5-broker; nft delete table inet spike5
