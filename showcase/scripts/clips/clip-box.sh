#!/usr/bin/env bash
# A throwaway box for recording the showcase clips, on the x86 test VM (Lima), beside the installed box and the
# portal's dev box: its own BOX_HOME, API port 7795 and SpacetimeDB database. Modeled on portal/dev-box.sh.
# Its identity is neutral (gurtos.local, "home box") so nothing private shows on screen.
#   showcase/scripts/clips/clip-box.sh          ship this checkout, start the box fresh and seed a lived-in desktop
#   showcase/scripts/clips/clip-box.sh kill     pull the plug: the box and its tasks at once
#   showcase/scripts/clips/clip-box.sh boot     boot it again on the same data
#   showcase/scripts/clips/clip-box.sh stop     stop it and delete its data
set -euo pipefail
cd "$(dirname "$0")/../../.."
vm() { /home/linuxbrew/.linuxbrew/bin/limactl shell --workdir / box -- "$@"; }
dest=/opt/box-dev/showcase-clips
home=/var/lib/box-showcase
port=7795
pid=/run/box-showcase.pid

# No pid file must not become kill -9 -0, which kills our own process group.
kill="[ -s $pid ] && kill -9 -\$(cat $pid) 2>/dev/null; rm -f $pid
  for u in \$(awk -F: '\$3>=30000 && \$3<40000 {print \$1}' /etc/passwd); do [ -d $home/tasks/\${u#box-} ] && pkill -KILL -u \$u || true; done
  sleep 0.5; grep -o \" $home/[^ ]*\" /proc/mounts | sort -r | xargs -r -n1 umount -l; true"
wipe="$kill
  for u in \$(awk -F: '\$3>=30000 && \$3<40000 {print \$1}' /etc/passwd); do [ -d $home/tasks/\${u#box-} ] && userdel \$u || true; done 2>/dev/null
  rm -rf $home
  flock /run/lock/box-spacetime-cli.lock spacetime delete --server local -y box-showcase >/dev/null 2>&1 || true"
start="cd $dest
  BOX_ID=home-box BOX_NAME='home box' BOX_URL=http://gurtos.local:$port BOX_PEERS='[{\"id\":\"cloud-box\",\"name\":\"cloud box\",\"stdb\":\"box\"}]' \
  BOX_HOME=$home BOX_PORT=$port BOX_VAULT=$home/vault.env BOX_STDB_DB=box-showcase BOX_PROXY_PORT=auto \
  BOX_PORTAL=$dest/portal/dist setsid nohup node --experimental-strip-types --disable-warning=ExperimentalWarning core/box.ts \
  >> $home/box.log 2>&1 < /dev/null &
  echo \$! > $pid
  for i in \$(seq 60); do curl -fs 127.0.0.1:$port/health >/dev/null && break; sleep 0.3; done"

case ${1:-} in
  stop) vm sudo bash -c "$wipe"; exit ;;
  kill) vm sudo bash -c "$kill; echo 'plug pulled'"; exit ;;
  boot) vm sudo bash -c "$start; echo 'booted'"; exit ;;
esac

git ls-files -co --exclude-standard | grep -v '^showcase/' | while IFS= read -r f; do [[ -e $f ]] && printf '%s\n' "$f"; done |
  tar -czf - -T - | vm sudo bash -c "mkdir -p $dest && find $dest -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} + && tar -xzf - -C $dest"
vm sudo bash -s <<EOF
set -e
$wipe
cd $dest
lock=\$(sha256sum package-lock.json | cut -c1-16)
[ -f node_modules/.lock-\$lock ] || { npm ci --omit=dev --no-audit --no-fund --loglevel=error && touch node_modules/.lock-\$lock; }
mkdir -p $home/workspaces/home $home/workspaces/notes
printf 'Groceries: 42.10\nPower: 61.00\n' > $home/workspaces/home/budget.csv
printf '# Notes\n\nNothing yet.\n' > $home/workspaces/notes/notes.md
chmod -R a+rwX $home/workspaces
# Test keys only; nothing that ships this box's log off the machine (Elastic, Jira, Moss, Agentverse), and no
# Factory key, so no real Droid task (/find's photo backup) runs: every clip uses the scripted worker.
grep -Ev '^(ELASTIC|KIBANA|ATLASSIAN|FORGE|JIRA|MOSS|AGENTVERSE|ASI_ONE|FACTORY)_' /etc/box/vault.env > $home/vault.env
echo DEMO_SECRET=showcase-test >> $home/vault.env && chmod 600 $home/vault.env
$start
task() { curl -fs 127.0.0.1:$port/api/tasks -H 'content-type: application/json' -d "\$1" | sed 's/.*"id":"\([^"]*\)".*/\1/'; }
f='"worker":"fake","source":"portal"'
task '{"title":"Write the weekly notes",'"\$f"',"workspace":"notes","prompt":"write notes.md # Notes\nappend notes.md Groceries came in under budget.\nappend notes.md The deploy went out on Tuesday."}' >/dev/null
task '{"title":"Tidy the budget sheet",'"\$f"',"prompt":"append budget.csv Internet: 55.00\nwrite summary.txt Three bills, 158.10 in total."}' >/dev/null
sleep 2
u=\$(task '{"title":"Rename the photo folders",'"\$f"',"prompt":"write photos.txt renamed 212 folders"}')
sleep 1.5; curl -fs -X POST 127.0.0.1:$port/api/tasks/\$u/undo >/dev/null
task '{"title":"Check the test server",'"\$f"',"prompt":"sleep 1\nfail The test server did not answer after 3 tries"}' >/dev/null
task '{"title":"Fix the failing test",'"\$f"',"prompt":"append progress.txt read the test\nsleep 2\nappend progress.txt found the bug\nsleep 3600\nwrite fixed.txt yes"}' >/dev/null
task '{"title":"Back up the photo library",'"\$f"',"prompt":"append progress.txt 1\nsleep 3\nappend progress.txt 2\nsleep 3600\nappend progress.txt 3"}' >/dev/null
echo "clip box up: http://127.0.0.1:$port (log: $home/box.log)"
EOF
