#!/usr/bin/env bash
# Spike 7 (not run yet): a real power cut. `before` leaves a task's overlay copy mid-write; the Mac then kills
# the VM process (`limactl stop --force box`) and starts it; `after` checks what survived. Root in the test VM.
# Only run it when no other thread is using the VM. The whole sequence, on the laptop, from the repo checkout:
#   tar c spikes/07-powercut.sh | limactl shell box -- bash -c "mkdir -p ~/spikes && tar x -C ~/spikes --strip-components=1"
#   limactl shell box -- sudo bash ~/spikes/07-powercut.sh before
#   t0=$(date +%s); limactl stop --force box; t1=$(date +%s); limactl start --tty=false box >/dev/null 2>&1; t2=$(date +%s)
#   echo "kill $((t1-t0)) s, boot $((t2-t1)) s"; limactl shell box -- sudo bash ~/spikes/07-powercut.sh after
set -uo pipefail
B=/var/lib/spike-cut
mnt() { mount -t overlay task-x -o lowerdir=$B/lower,upperdir=$B/upper,workdir=$B/work $B/merged; }
case ${1:-} in
before)
  for m in $(findmnt -rn -o TARGET | grep "^$B/" | sort -r); do umount "$m"; done; rm -rf --one-file-system $B
  mkdir -p $B/{lower,upper,work,merged}; echo base > $B/lower/base.txt; mnt
  echo "step 1 done" > $B/merged/progress.txt; sync                  # written and synced before the cut
  echo "step 2 in progress" > $B/merged/unsynced.txt                  # written, never synced
  dd if=/dev/urandom of=$B/merged/big.bin bs=1M count=64 status=none  # a large write still in the page cache
  echo "ready for the cut at $(date +%T.%3N)" ;;
after)
  echo "booted; VM uptime $(cut -d' ' -f1 /proc/uptime) s"
  mnt && echo "overlay remounted with the old upper and work: OK" || echo "overlay remount FAILED"
  for f in progress.txt unsynced.txt big.bin; do
    [ -e $B/merged/$f ] && echo "$f: present, $(stat -c %s $B/merged/$f) bytes" || echo "$f: lost"; done
  echo "progress.txt says: $(cat $B/merged/progress.txt 2>/dev/null)"
  umount $B/merged; rm -rf --one-file-system $B; echo cleaned ;;
*) echo "usage: $0 before|after"; exit 2 ;;
esac
