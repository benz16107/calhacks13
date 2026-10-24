#!/usr/bin/env bash
# Proof that a backup restores onto a fresh BOX_HOME and the tasks carry on. Run as root on a TEST VM from a
# checkout (never on a machine whose box matters: it starts two throwaway boxes and removes task users):
#   VULTR_OBJ_ACCESS=… VULTR_OBJ_SECRET=… tracks/vultr/restore-proof.sh
# Box A runs a finished task and one waiting for an OK, backs up to the real Object Storage, and is killed hard with
# its task users deleted. With STOP_AFTER_BACKUP=<file> it stops there and leaves the owner's identity in <file>, so the
# restore can be run on a different machine (tracks/vultr/restore.ts). Box B starts empty, restores, and must show the same tasks, give the same user the same id,
# and finish the waiting task once it is approved.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${VULTR_OBJ_ACCESS:?}" "${VULTR_OBJ_SECRET:?}"
N="node --experimental-strip-types --disable-warning=ExperimentalWarning"
W=$(mktemp -d /var/lib/box-restore-proof.XXXXXX); chmod 711 "$W" # task users must be able to walk down to their folders
A=$W/a; B=$W/b; mkdir -p "$A" "$B"
t0=$(date +%s); say() { printf '[%3ss] %s\n' $(( $(date +%s) - t0 )) "$*"; }
age-keygen -o "$W/owner.key" 2>"$W/pub"; recipient=$(grep -o 'age1[a-z0-9]*' "$W/pub")
printf 'VULTR_OBJ_ACCESS=%s\nVULTR_OBJ_SECRET=%s\nBACKUP_AGE_RECIPIENT=%s\n' "$VULTR_OBJ_ACCESS" "$VULTR_OBJ_SECRET" "$recipient" > "$W/vault.env"; chmod 600 "$W/vault.env"
start() { # home, db, id
  BOX_HOME=$1 BOX_PORT=auto BOX_VAULT=$W/vault.env BOX_STDB_DB=$2 BOX_PROXY_PORT=auto BOX_OWNER=owner BOX_NO_DROID=1 BOX_DEMO=1 BOX_ID=$3 setsid $N core/box.ts >"$1/box.log" 2>&1 &
  echo $! > "$1/pid"
  for _ in $(seq 150); do curl -sf "http://127.0.0.1:$(cat "$1/api.port" 2>/dev/null)/api/health" >/dev/null 2>&1 && return; sleep 0.2; done
  echo "box did not start: see $1/box.log" >&2; exit 1
}
api() { local home=$1 m=$2 p=$3; shift 3; curl -sf -X "$m" "http://127.0.0.1:$(cat "$home/api.port")$p" -H 'content-type: application/json' ${1:+-d "$1"}; }
js() { node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log($1)"; }

start "$A" proofa proof-a; say "box A is up"
t1=$(api "$A" POST /api/tasks '{"title":"proof finished","workspace":"home","worker":"fake","prompt":"write plan.txt PROOF-FILE"}' | js d.id)
t2=$(api "$A" POST /api/tasks '{"title":"proof waiting","workspace":"home","worker":"fake","prompt":"ask May the proof spend 0 dollars?\nwrite ok.txt yes"}' | js d.id)
for _ in $(seq 100); do api "$A" GET /api/tasks | js "d.filter(t=>t.id=='$t1'&&t.state=='done').length+d.filter(t=>t.id=='$t2'&&t.state=='waiting').length" | grep -q 2 && break; sleep 0.3; done
uid_a=$(id -u "box-$t2"); say "A has task $t1 done and $t2 waiting for an OK; its user box-$t2 is uid $uid_a"
api "$A" POST /t/vultr/backup | js "'backup: '+d.key+' '+d.bytes+' bytes in '+d.seconds+' s'" | while read -r l; do say "$l"; done

if [ -n "${STOP_AFTER_BACKUP:-}" ]; then
  cp "$W/owner.key" "$STOP_AFTER_BACKUP"; say "stopping after the backup; identity in $STOP_AFTER_BACKUP"
  kill -9 -- "-$(cat "$A/pid")" 2>/dev/null || true; sleep 1
  findmnt -rn -o TARGET | grep "^$A/" | sort -r | xargs -r -n1 umount -l; rm -rf "$W"; exit 0
fi
kill -9 -- "-$(cat "$A/pid")" 2>/dev/null || true; sleep 1
findmnt -rn -o TARGET | grep "^$A/" | sort -r | xargs -r -n1 umount -l
userdel "box-$t1" 2>/dev/null || true; userdel "box-$t2"; groupdel "box-$t2" 2>/dev/null || true
say "box A killed hard and its task users deleted (this is now a fresh machine)"

BOX_HOME=$B $N tracks/vultr/restore.ts --identity "$W/owner.key" --box-id proof-a --no-service | while read -r l; do say "$l"; done
uid_b=$(id -u "box-$t2"); [ "$uid_a" = "$uid_b" ] && say "user box-$t2 has its old id ($uid_b) again" || { echo "uid changed: $uid_a -> $uid_b" >&2; exit 1; }
start "$B" proofb proof-a; say "box B is up on the restored folder"
api "$B" GET /api/tasks | js "d.map(t=>t.id.slice(0,8)+' '+t.title+' '+t.state).join('\n')" | while read -r l; do say "task: $l"; done
approval=$(api "$B" GET '/api/approvals?state=pending' | js "d.find(a=>a.task=='$t2').id")
api "$B" POST "/api/approvals/$approval" '{"approved":true,"by":"proof"}' >/dev/null
for _ in $(seq 100); do [ "$(api "$B" GET /api/tasks | js "d.find(t=>t.id=='$t2').state")" = done ] && break; sleep 0.3; done
[ "$(api "$B" GET /api/tasks | js "d.find(t=>t.id=='$t2').state")" = done ] && say "the waiting task was approved on box B and finished: tasks resumed after the restore"
kill -9 -- "-$(cat "$B/pid")" 2>/dev/null || true
findmnt -rn -o TARGET | grep "^$B/" | sort -r | xargs -r -n1 umount -l
rm -rf "$W" "$W".* 2>/dev/null || true
