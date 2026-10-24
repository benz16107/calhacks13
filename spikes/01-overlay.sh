#!/usr/bin/env bash
# Spike 1: per-task file copies with overlayfs. Run as root in the test VM.
# Two tasks share one read-only workspace (lower). Each gets its own upper/work dir.
# We run both at once, list each one's changes, discard B, keep A.
set -euo pipefail
B=/var/lib/spike1
cleanup() { for m in $(findmnt -rn -o TARGET | grep "^$B/" | sort -r); do umount "$m"; done; rm -rf --one-file-system "$B"; }
cleanup
mkdir -p "$B/lower/src"
chmod 700 "$B"   # tasks never touch lower directly, only through their own merged view
echo hello      > "$B/lower/readme.txt"
echo 'v1'       > "$B/lower/src/app.js"
echo 'delete me'> "$B/lower/old.txt"
mkdir -p "$B/lower/cache"; echo junk > "$B/lower/cache/blob"

mnt() { mkdir -p "$B/tasks/$1"/{upper,work,merged}
  mount -t overlay "task-$1" -o "lowerdir=$B/lower,upperdir=$B/tasks/$1/upper,workdir=$B/tasks/$1/work" "$B/tasks/$1/merged"; }
mnt a; mnt b

echo "== two tasks write at the same time"
( cd "$B/tasks/a/merged"; for i in $(seq 200); do echo "a $i" >> src/app.js; done; rm old.txt; echo new > a-new.txt ) &
( cd "$B/tasks/b/merged"; for i in $(seq 200); do echo "b $i" >> src/app.js; done; mkdir docs; echo x > docs/b.md; rm -rf cache; mkdir cache; echo fresh > cache/only ) &
wait
echo "A sees app.js last line: $(tail -1 $B/tasks/a/merged/src/app.js)"
echo "B sees app.js last line: $(tail -1 $B/tasks/b/merged/src/app.js)"
echo "lower app.js untouched:  $(cat $B/lower/src/app.js)"

# List a task's changes by walking its upper dir only (cost = number of changes, not workspace size).
# Whiteout (char dev 0:0) = deleted. Dir with trusted.overlay.opaque=y = replaced whole.
changes() { local up="$B/tasks/$1/upper" lo="$B/lower"
  (cd "$up" && find . -mindepth 1 | sort) | while read -r p; do p=${p#./}
    if [ -c "$up/$p" ] && [ "$(stat -c %t:%T "$up/$p")" = 0:0 ]; then echo "D $p"
    elif [ -d "$up/$p" ]; then
      if [ "$(getfattr --only-values -n trusted.overlay.opaque "$up/$p" 2>/dev/null)" = y ]; then echo "R $p/ (replaced)"
      elif [ ! -e "$lo/$p" ]; then echo "A $p/"; fi
    elif [ -e "$lo/$p" ]; then echo "M $p"
    else echo "A $p"; fi
  done; }
echo "== changes A"; changes a
echo "== changes B"; changes b
echo "== content diff of A (diff -ruN lower merged)"
diff -ruN "$B/lower" "$B/tasks/a/merged" | head -12 || true

echo "== discard B: unmount, delete its upper/work"
umount "$B/tasks/b/merged"; rm -rf "$B/tasks/b"
echo "== keep A, option 1: stack A's upper as a new read-only layer (no copy, lower untouched)"
umount "$B/tasks/a/merged"
mkdir -p "$B/layers"; mv "$B/tasks/a/upper" "$B/layers/1-a"; rm -rf "$B/tasks/a"
mkdir -p "$B/tasks/c"/{upper,work,merged}
mount -t overlay task-c -o "lowerdir=$B/layers/1-a:$B/lower,upperdir=$B/tasks/c/upper,workdir=$B/tasks/c/work" "$B/tasks/c/merged"
echo "new task C sees: $(ls $B/tasks/c/merged | tr '\n' ' ')| app.js lines: $(wc -l < $B/tasks/c/merged/src/app.js) | old.txt: $([ -e $B/tasks/c/merged/old.txt ] && echo present || echo gone)"
echo "B's work is gone: docs/ in C? $([ -e $B/tasks/c/merged/docs ] && echo yes || echo no)"
umount "$B/tasks/c/merged"

echo "== keep A, option 2: flatten A into lower (apply deletes, then copy files)"
flatten() { local up=$1 lo=$2
  (cd "$up" && find . -mindepth 1 -depth) | while read -r p; do p=${p#./}
    if [ -c "$up/$p" ] && [ "$(stat -c %t:%T "$up/$p")" = 0:0 ]; then rm -rf "$lo/$p"
    elif [ -d "$up/$p" ] && [ "$(getfattr --only-values -n trusted.overlay.opaque "$up/$p" 2>/dev/null)" = y ]; then rm -rf "$lo/$p"; fi
  done
  rsync -a --no-devices --no-specials "$up/" "$lo/"; }   # whiteouts are char devices, so rsync skips them
flatten "$B/layers/1-a" "$B/lower"
echo "lower now: $(ls $B/lower | tr '\n' ' ')| app.js lines: $(wc -l < $B/lower/src/app.js)"
test ! -e "$B/lower/old.txt" && test -e "$B/lower/a-new.txt" && test "$(wc -l < $B/lower/src/app.js)" = 201 && echo "PASS flatten"

echo "== does it survive a hard kill? remount an existing upper after umount -l (no clean shutdown of the fs)"
mkdir -p "$B/tasks/d"/{upper,work,merged}; mount -t overlay task-d -o "lowerdir=$B/lower,upperdir=$B/tasks/d/upper,workdir=$B/tasks/d/work" "$B/tasks/d/merged"
echo midway > "$B/tasks/d/merged/progress.txt"; sync; umount -l "$B/tasks/d/merged"
mount -t overlay task-d -o "lowerdir=$B/lower,upperdir=$B/tasks/d/upper,workdir=$B/tasks/d/work" "$B/tasks/d/merged"
echo "after remount: $(cat $B/tasks/d/merged/progress.txt)"; umount "$B/tasks/d/merged"
echo "== unprivileged? overlay inside a user namespace as a normal user"
U=$(getent passwd 1000 | cut -d: -f1 || true); [ -n "$U" ] || U=nobody
T=$(mktemp -d /tmp/ovl.XXXX); mkdir -p $T/{l,u,w,m}; chown -R "$U" $T
sysctl kernel.apparmor_restrict_unprivileged_userns 2>/dev/null || true
if runuser -u "$U" -- unshare -rm sh -c "mount -t overlay x -o lowerdir=$T/l,upperdir=$T/u,workdir=$T/w $T/m && echo ok > $T/m/f && echo 'unprivileged overlay: WORKS'"; then :; else echo "unprivileged overlay: FAILS"; fi
rm -rf $T
echo DONE
