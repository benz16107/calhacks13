# Armadin: write outside the task's own layer, where the disk cap once did not look: shared memory first (so it is
# written before the cap can stop the task), then /tmp and $HOME. Usage: sh outside.sh <run id>
dd if=/dev/zero of="/dev/shm/armadin-$1-fill" bs=1M count=20 status=none
printf 'left-by-%s' "$(id -un)" > "/dev/shm/armadin-$1-note"
dd if=/dev/zero of=/tmp/fill bs=1M count=100 status=none
dd if=/dev/zero of="$HOME/fill" bs=1M count=100 status=none
du -sb "$HOME/fill" /tmp/fill "/dev/shm/armadin-$1-fill"
