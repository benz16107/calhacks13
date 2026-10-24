#!/usr/bin/env bash
# Spike 2: each task runs as its own Linux user with no sudo, inside its own overlay copy.
# Run as root in the test VM. Lower files are owned by a neutral user box-ws (2000);
# an idmapped bind of lower makes them appear owned by the task user inside its copy.
set -uo pipefail
B=/var/lib/spike2; V=/var/lib/spike2-vault
systemctl stop spike-task-b 2>/dev/null
# Unmount everything under $B before deleting: rm -rf through a live bind of lower deletes the shared files.
for m in $(findmnt -rn -o TARGET | grep "^$B/" | sort -r); do umount "$m"; done
rm -rf --one-file-system $B $V
userdel box-ws 2>/dev/null; groupdel box-ws 2>/dev/null
groupadd -g 2000 box-ws; useradd -M -d /nonexistent -s /usr/sbin/nologin -u 2000 -g 2000 box-ws   # uid AND gid must be what the idmap names
for t in a b; do n=$((30000 + $(printf %d "'$t") - 96))   # task-a 30001, task-b 30002
  userdel task-$t 2>/dev/null; groupdel task-$t 2>/dev/null; groupadd -g $n task-$t; useradd -M -d /nonexistent -s /usr/sbin/nologin -u $n -g $n task-$t; done
mkdir -p $B/base/lower/src $B/base/idlower $B/tasks $V; chmod 711 $B $B/tasks; chmod 700 $B/base $V
echo v1 > $B/base/lower/src/app.js; echo hi > $B/base/lower/readme.txt; chown -R box-ws:box-ws $B/base/lower
echo 'sk-live-THIS-IS-THE-VAULT-KEY' > $V/key.txt; chmod 600 $V/key.txt

for t in a b; do u=task-$t; uid=$(id -u $u)
  mkdir -p $B/tasks/$t/{upper,work,merged} $B/base/idlower/$t
  # idmapped bind: files owned by box-ws on disk show up as owned by this task user
  mount --bind -o X-mount.idmap="u:2000:$uid:1 g:2000:$uid:1" $B/base/lower $B/base/idlower/$t
  chown $u:$u $B/tasks/$t/upper; chown root:$u $B/tasks/$t; chmod 750 $B/tasks/$t
  mount -t overlay task-$t -o lowerdir=$B/base/idlower/$t,upperdir=$B/tasks/$t/upper,workdir=$B/tasks/$t/work $B/tasks/$t/merged \
    || echo "OVERLAY OVER IDMAPPED LOWER FAILED for $t"
done
echo "owner of app.js on disk: $(stat -c %U $B/base/lower/src/app.js) | in task-a copy: $(stat -c %U $B/tasks/a/merged/src/app.js) | in task-b copy: $(stat -c %U $B/tasks/b/merged/src/app.js)"

# Task B: a long-running process holding a secret in its environment
systemd-run -q --unit=spike-task-b -p User=task-b -E TASK_SECRET=b-only-token --working-directory=$B/tasks/b/merged \
  sh -c 'echo "b was here" > b.txt; sleep 300'
sleep 1; BPID=$(systemctl show -p MainPID --value spike-task-b)

check() { local want=$1 desc=$2; shift 2; if out=$("$@" 2>&1); then got=allowed; else got=denied; fi
  [ "$got" = "$want" ] && r=PASS || r=FAIL; printf '%-5s %-8s %s\n' "$r" "$got" "$desc"; }
as_a() { setpriv --reuid=task-a --regid=task-a --init-groups --no-new-privs --reset-env -- "$@"; }
A=$B/tasks/a/merged
echo "== plain user task-a (setpriv, no-new-privs)"
check allowed "edit an existing file in its own copy"  as_a sh -c "echo v2 > $A/src/app.js"
check allowed "create a file in its own copy"          as_a sh -c "echo new > $A/new.txt"
check denied  "read task-b's copy"                      as_a cat $B/tasks/b/merged/b.txt
check denied  "read task-b's upper dir"                 as_a ls $B/tasks/b/upper
check denied  "list the tasks folder"                        as_a ls $B/tasks
check denied  "read the shared lower dir directly"      as_a cat $B/base/lower/readme.txt
check denied  "write the shared lower dir directly"     as_a sh -c "echo x > $B/base/lower/pwn"
check denied  "read the vault"                          as_a cat $V/key.txt
check denied  "sudo"                                    as_a sudo -n true
check denied  "read task-b's environment"               as_a cat /proc/$BPID/environ
check allowed "see task-b's process in ps (default /proc)" as_a sh -c "ps -eo user,cmd | grep -q '^task-b'"
check allowed "write shared /tmp (default)"             as_a sh -c "echo leak > /tmp/from-a"
check denied  "read the lima user's home (Ubuntu homes are 750)" as_a ls /home/$(getent passwd 501 | cut -d: -f1).linux
echo "lower still v1: $(cat $B/base/lower/src/app.js) | a's copy: $(cat $A/src/app.js) | upper owner: $(stat -c %U $B/tasks/a/upper/src/app.js)"

echo "== same user, hardened with systemd unit options"
H="-p User=task-a -p NoNewPrivileges=yes -p ProtectProc=invisible -p PrivateTmp=yes -p ProtectHome=yes -p ProtectSystem=strict -p ReadWritePaths=$A -p PrivateDevices=yes -p CapabilityBoundingSet= -p RestrictSUIDSGID=yes"
hrun() { systemd-run -q --wait --pipe $H --working-directory=$A "$@"; }
check denied  "see task-b's process in ps (ProtectProc=invisible)" hrun sh -c "ps -eo user,cmd | grep -q '^task-b'"
check denied  "see /tmp/from-a written earlier (PrivateTmp)"        hrun cat /tmp/from-a
check denied  "read the lima user's home (ProtectHome)"             hrun ls /home/$(getent passwd 501 | cut -d: -f1).linux
mkdir -p /var/lib/spike2-own; chown task-a /var/lib/spike2-own
check allowed "write a folder task-a owns outside its copy (plain user)" as_a sh -c "echo x > /var/lib/spike2-own/x"
check denied  "write that same folder (ProtectSystem=strict)"           hrun sh -c "echo x > /var/lib/spike2-own/y"
check allowed "write in its own copy"                               hrun sh -c "echo v3 > $A/src/app.js"
check denied  "sudo"                                                hrun sudo -n true
check denied  "read the vault"                                      hrun cat $V/key.txt
rm -f /tmp/from-a
systemctl stop spike-task-b
echo "== flatten task-a back into lower with box-ws ownership"
umount $A; rsync -a --no-devices --no-specials --chown=box-ws:box-ws $B/tasks/a/upper/ $B/base/lower/
echo "lower app.js: $(cat $B/base/lower/src/app.js) owner $(stat -c %U $B/base/lower/src/app.js); new.txt owner $(stat -c %U $B/base/lower/new.txt)"
