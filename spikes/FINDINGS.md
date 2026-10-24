# Spike findings

Throwaway tests of the risky parts, so the core thread builds on facts. Each section says what ran, whether
it worked, the gotchas, and one line for the core thread. The scripts in this folder are throwaway code.

**Test machine:** the laptop VM (Lima `box` on benmac, `vz`, Ubuntu 24.04.5, kernel 6.8.0-142, aarch64,
systemd 255, util-linux 2.39.3, ext4 root). Lima cannot snapshot `vz` VMs (`limactl snapshot` says
"unimplemented"), so the clean state is saved inside the VM in `/root/clean-state/` (nft ruleset, passwd,
group, dpkg list, sysctl, unit list). The VM came with rootless containerd and Lima's own `ip nat` table
(`LIMADNS`); leave both alone.

Run a script: `tar c spikes/NN-*.sh | ssh benmac 'limactl shell box -- bash -c "mkdir -p ~/spikes && tar x -C ~/spikes --strip-components=1 && sudo bash ~/spikes/NN-*.sh"'`

| # | Test | Result |
|---|---|---|
| 1 | Per-task file copies (overlayfs) | Works, as root |
| 2 | Tasks as separate users | Works |
| 3 | Per-task network limits | pending |
| 4 | SpacetimeDB on ARM | pending |
| 5 | Droid as its own user | pending |
| 6 | Vision model for /find | pending |

## 1. Per-task file copies

**Ran:** `sudo bash 01-overlay.sh`. One shared folder (`lower`) and, per task, its own `upper`, `work` and
`merged` dirs: `mount -t overlay task-a -o lowerdir=L,upperdir=U,workdir=W M`. Tasks A and B appended 200 lines
each to the same file at the same time, deleted or replaced files, and made new ones.

**Worked:**
- Each task saw only its own changes. `lower` stayed untouched.
- **Listing a task's changes** is a walk of its `upper` dir only, so it costs the number of changes, not the
  size of the workspace. Rules: a char device 0:0 is a deleted file; a dir with xattr
  `trusted.overlay.opaque=y` replaced the whole dir; a file that also exists in `lower` was modified;
  anything else was added. Output for task A: `A a-new.txt`, `D old.txt`, `M src/app.js`.
  A content diff is `diff -ruN lower merged`, or `diff -u lower/f upper/f` per changed file.
- **Undo one task:** unmount its `merged`, delete its `upper` and `work`. The other task is unaffected.
- **Keep one task, way 1:** move its `upper` into `layers/` and mount later tasks with
  `lowerdir=layers/1-a:lower`. No copying, and `lower` is never changed while mounted. Deletes carry
  through.
- **Keep one task, way 2:** flatten into `lower`: delete what the whiteouts and opaque dirs name, then
  `rsync -a --no-devices --no-specials upper/ lower/` (whiteouts are char devices, so rsync skips them).
- An `upper` survives a lazy unmount and remounts with its contents. A real power-cut test is still to do;
  see "Not tested" below.

**Gotchas:**
- **Needs root.** Ubuntu 24.04 sets `kernel.apparmor_restrict_unprivileged_userns=1`, so
  `unshare -rm` cannot even write `uid_map` and an unprivileged overlay fails. The box service is root, so
  this is fine. Do not plan on rootless.
- **Changing `lower` under a running task shows up live in that task** (kernel 6.8, ext4). A task that had
  already read `x` saw the new `x` and new files appear. Kernel docs call this undefined. The real risk is a
  lost update: if A and B both edit `x`, keeping A then B silently overwrites A's edit with B's. Keeping a
  task needs a conflict check, for example the hash of each modified file in `lower` recorded at mount and
  compared at keep time.
- `upper` and `work` must be on the same filesystem. `work` must be empty and not shared.
- `diff -ruN` against `merged` walks the whole tree. Use the upper-dir walk for the change list.

**For the core thread:** use one overlay per task (root mounts it), list changes from `upper`, undo by
deleting `upper`, and keep by stacking `upper` as a layer, flattening only when no task is mounted and after
a conflict check.

## 2. Tasks as separate users

**Ran:** `sudo bash 02-users.sh`. Users `task-a` (uid 30001) and `task-b` (30002) with no home, shell
`nologin`, no sudo. Shared files are owned by a neutral user `box-ws` (uid and gid 2000). Each task gets an
**idmapped bind** of `lower` so the files look like its own, and the overlay sits on that bind:

```
mount --bind -o X-mount.idmap="u:2000:30001:1 g:2000:30001:1" base/lower base/idlower/a
mount -t overlay task-a -o lowerdir=base/idlower/a,upperdir=tasks/a/upper,workdir=tasks/a/work tasks/a/merged
```

Layout: `base/` (root, 0700) holds `lower` and the idmapped binds. `tasks/` is 0711. Each task's dir is 0750
`root:task-x`, and its `upper` is owned by the task. The vault is a root-only 0700 folder. Task A ran two ways:
as a plain user (`setpriv --reuid --regid --init-groups --no-new-privs`), then as a hardened systemd unit.

**Worked:** all 21 checks passed.
- In its own copy, task A can edit existing files and create new ones. On disk the copy-up is owned by
  `task-a`. Flattening back uses `rsync --chown=box-ws:box-ws`.
- Task A cannot read B's copy, B's `upper` or the tasks list. It cannot read or write `lower` directly,
  read the vault, run `sudo`, or read B's `/proc/<pid>/environ`.
- As a plain user it can still see B's processes in `ps`, write a shared `/tmp`, and write any folder it
  owns. These systemd options close those gaps, and with them all checks pass:
  `User=task-a NoNewPrivileges=yes ProtectProc=invisible PrivateTmp=yes ProtectHome=yes ProtectSystem=strict ReadWritePaths=<merged> PrivateDevices=yes CapabilityBoundingSet= RestrictSUIDSGID=yes`
  (`systemd-run --wait --pipe -p ...`).
- Ubuntu home dirs are 0750, so tasks cannot read the Lima user's home even without `ProtectHome`.

**Gotchas:**
- **An idmap must map the gid too, and the gid must really be 2000.** `useradd -U` picked a different gid
  for `box-ws`, so files showed group 65534. Then nothing could write through the copy, not even root
  (Permission denied). Create the group first with `groupadd -g 2000`.
- **Never `rm -rf` a task dir while its mounts are live.** A stale idmapped bind of `lower` sat inside a
  folder being deleted, and `rm -rf` walked into it and tried to delete the shared files. Only an
  unmappable-gid error ("Value too large for defined data type") stopped it. Unmount everything under the
  path first (`findmnt -rn -o TARGET | grep ^path/ | sort -r | xargs -n1 umount`) and use
  `rm -rf --one-file-system`.
- `PrivateTmp=yes` gives the unit its own writable `/tmp` and `/var/tmp`, so writes there succeed but stay
  private.
- Create task users with a fixed uid range (30000 and up here). Test 3 matches on it.

**For the core thread:** run every task as a systemd unit with `User=task-<id>` plus the hardening line
above, in its own overlay on an idmapped bind of `lower`. Never put secrets where any task user can read
them.

## Not tested yet

- A real power cut (`limactl stop --force` on the VM) followed by remounting each task's overlay. The VM is
  shared with other threads, so this waits until it is free.
