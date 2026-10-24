#!/usr/bin/env bash
# A throwaway box for the benchmark on the test VM, beside the installed one: its own BOX_HOME (/var/lib/box-bench),
# API port 7798 (7797 was taken by another thread's dev box), SpacetimeDB database box-bench. Its vault holds only the Factory key, so the box loads no other app.
#   bench/box.sh start            ship this checkout and bench/data to the VM and start the box fresh
#   bench/box.sh run [run.ts args]  run the benchmark on the VM against that box, then copy results/ back here
#   bench/box.sh stop             kill the box and its tasks, unmount, delete its users, data, database and code copy
# VM command: BENCH_VM='limactl shell --workdir / box --' (any command that takes the command to run after it).
set -euo pipefail
cd "$(dirname "$0")/../../.."
export PATH=/home/linuxbrew/.linuxbrew/bin:$PATH
read -r -a vm_cmd <<< "${BENCH_VM:-limactl shell --workdir / box --}"
vm() { "${vm_cmd[@]}" "$@"; }
dest=/opt/box-dev/credit-desk-bench home=/var/lib/box-bench port=7798 db=box-bench pidfile=/run/box-bench.pid

# The plug: the box's process group, every task user's processes, the task mounts. The pid-file test is an `if`, so
# a missing file does not make the script exit under set -e.
kill="if [ -f $pidfile ]; then kill -9 -\$(cat $pidfile) 2>/dev/null || true; rm -f $pidfile; fi
  for u in \$(awk -F: '\$3>=30000 && \$3<40000 {print \$1}' /etc/passwd); do [ -d $home/tasks/\${u#box-} ] && pkill -KILL -u \$u || true; done
  sleep 0.5; grep -o \" $home/[^ ]*\" /proc/mounts | sort -r | xargs -r -n1 umount -l; true"
wipe="$kill
  for u in \$(awk -F: '\$3>=30000 && \$3<40000 {print \$1}' /etc/passwd); do [ -d $home/tasks/\${u#box-} ] && userdel \$u || true; done 2>/dev/null
  rm -rf $home $dest
  flock /run/lock/box-spacetime-cli.lock spacetime delete --server local -y $db >/dev/null 2>&1 || true"

case ${1:-} in
  stop) vm sudo bash -c "$wipe"; echo "bench box stopped and cleaned"; exit ;;
  run)
    shift
    bench=$dest/tracks/credit-desk/bench
    status=0
    extra=$([ $# -gt 0 ] && printf '%q ' "$@" || true)
    vm sudo bash -c "cd $bench && BENCH_API=http://127.0.0.1:$port BENCH_DATA=$home/bench-data BENCH_OUT=$home/bench-results BOX_HOME=$home BOX_VAULT=$home/vault.env node --experimental-strip-types --disable-warning=ExperimentalWarning run.ts $extra" || status=$?
    mkdir -p tracks/credit-desk/bench/results
    vm sudo tar -czf - -C $home/bench-results . 2>/dev/null | tar -xzf - -C tracks/credit-desk/bench/results || true
    exit $status ;;
  start) ;;
  *) sed -n 2,7p "$0"; exit 1 ;;
esac

vm sudo bash -c "$wipe"
# Task users can read $dest, so the answers must not be in it: the code goes there (without bench/results or the README),
# the questions, answers and results stay in the box's root-only home.
git ls-files -co --exclude-standard | grep -v '^tracks/credit-desk/bench/\(results/\|README.md\)' | while IFS= read -r f; do [[ -e $f ]] && printf '%s\n' "$f"; done |
  tar -czf - -T - | vm sudo bash -c "mkdir -p $dest && find $dest -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} + && tar -xzf - -C $dest && chmod -R a+rX $dest"
tar -czf - -C tracks/credit-desk/bench data | vm sudo bash -c "mkdir -p $home && rm -rf $home/bench-data && mkdir $home/bench-data && tar -xzf - -C $home/bench-data --strip-components=1 && mkdir -p $home/bench-results && chmod -R go-rwx $home/bench-data $home/bench-results"
vm sudo bash -s <<VMEOF
set -e
cd $dest
lock=\$(sha256sum package-lock.json | cut -c1-16)
[ -f node_modules/.lock-\$lock ] || { npm ci --omit=dev --no-audit --no-fund --loglevel=error && touch node_modules/.lock-\$lock; }
mkdir -p $home && grep '^FACTORY_API_KEY=' /etc/box/vault.env > $home/vault.env && chmod 600 $home/vault.env
BOX_ID=bench BOX_NAME='benchmark box' BOX_HOME=$home BOX_PORT=$port BOX_VAULT=$home/vault.env BOX_STDB_DB=$db BOX_PROXY_PORT=auto \
  setsid nohup node --experimental-strip-types --disable-warning=ExperimentalWarning core/box.ts >> $home/box.log 2>&1 < /dev/null &
echo \$! > $pidfile
for i in \$(seq 60); do curl -fs 127.0.0.1:$port/health >/dev/null && break; sleep 0.5; done
curl -fs 127.0.0.1:$port/health | head -c 300; echo
VMEOF
