# The file path for agents: measured

GurtOS Personal gives each task its own copy of the owner's real folder, and nothing reaches the real folder until
the owner chooses Keep. These are the numbers for that path, before and after the changes on Sat Oct 24, and the
options for making it faster still.

**How it was measured.** `core/bench-fs.ts`, run as root on the x86_64 test VM (6 vCPU, 15 GB RAM, ext4 on a virtual
disk, Ubuntu 24.04, kernel 6.8), against a throwaway `BOX_HOME`. The owner folder had 50,246 files and 2.3 GB: a git
repository with its history (Express), 50,000 small Markdown files in 250 folders, and two 1 GB files. The script
calls the box's own `sandbox.ts` functions, so it measures the code that runs, not a copy of it. Run it again with
`BOX_HOME=/var/lib/box-bench node core/bench-fs.ts` on a test machine (never your own: it creates users and mounts).

## Before and after (ext4)

| What | Before | After |
|---|---|---|
| One task's workspace ready (copy, ownership, record of the folder, mount) | 17.7 s | 8.1 s |
| First read, first write of a small file inside it | under 1 ms | under 1 ms |
| `git status` in the task / in the real folder (Express repository) | 19 ms / 8 ms | same |
| 10 tasks at once, all workspaces ready | 166 s | 77 s |
| Longest the box could not answer while those 10 started | 166 s | 2.2 s |
| Keep: 1,000 small files and one 1 GB file changed | 14.6 s | 3.1 s |
| Undo that Keep (Time Machine) | 6.5 s | 0.3 s |
| Undo the task (unmount, remove its copy) | 2.1 s | 2.3 s |
| Disk per task | 2.3 GB | 2.3 GB |
| Disk for 10 tasks | 22 GB | 22 GB |
| Peak memory of the box process | 1,166 MB | 228 MB |

`git status` and the first read and write were never slow: once a task's workspace exists, an agent works at the
disk's own speed. All the cost was in making the workspace and in Keep. `npm install` was not measured: it depends on
the network far more than on the file path.

## What changed

- **No hash of every file at the start.** The box used to read and hash every file in the task's copy (all 2.3 GB,
  whole files in memory) so Keep could tell whether the owner had changed a file meanwhile. It now records each real
  file's size and modification time, which needs no read. Records made before the change still hold hashes and are
  still checked that way.
- **Keep and its undo name the old file instead of copying it.** The before-image Time Machine keeps is now a second
  name (a hard link) for the owner's old file: the real path is replaced by a rename, so the old content stays with
  that name. Across filesystems it falls back to a copy. Keep no longer hashes what it wrote either.
- **The copy no longer stops the box.** It runs as `cp -a --reflink=auto` without blocking the box's event loop, so
  the screen, phones and other tasks keep working while a task starts, and several tasks copy at once.
- **A resumed task keeps its copy.** After a restart the box used to delete the task's copy and copy the folder
  again, which was slow and swapped the agent's snapshot for the owner's current files mid-task. A marker written
  when the copy finishes now tells it to keep the copy.

## The next step: a decision for Ben

The rest of the start-up time and all of the disk use come from copying the folder for each task. Two ways remove
most of it, both measured on the same VM.

| Option | Workspace ready | Disk per task | Change |
|---|---|---|---|
| Today (ext4, a full copy) | 8.1 s | 2.3 GB | none |
| XFS (or btrfs) with reflink, same code | about 5.4 s (copy 3.6 s, ownership 0.6 s, record 1.2 s) | about 0 (blocks are shared until written) | the installer formats the disk as XFS or btrfs |
| An idmapped mount of the real folder as the overlay's lower layer (ext4 as it is) | 7 ms to mount, plus the 1.2 s record | 0 | `sandbox.prepare` mounts instead of copying |

**XFS or btrfs with reflink.** `prepare` already asks `cp` for reflinks, so the same code shares data blocks there:
the copy of 2.3 GB took 3.6 s (creating 50,000 file entries) and added almost nothing to the disk. Keep would
also share blocks (`copyFileSync` asks for a clone). It needs the installer to create the root filesystem as XFS or
btrfs on both x86_64 and arm64, which changes partitioning, the boot setup and the recovery steps on both
architectures. A btrfs subvolume snapshot per task would make the start constant-time and Keep a swap, but that is a
larger rewrite of Keep and Undo. **Not before the freeze**: an installer change is not safe to QA on both
architectures in the hours left. Document it as next.

**An idmapped lower (recommended next, no installer change).** The box mounts the owner's folder a second time with
the owner's user id mapped to the task's (`mount --bind -o X-mount.idmap=b:<owner>:<task>:1`), and uses that as the
overlay's lower layer. Tested on this kernel: the mount and overlay took 7 ms, the task's user could write, its write
went to the task's own layer, and the real file did not change. No copy, no disk, no installer change, both
architectures (it is a kernel feature from 5.19 on ext4, XFS and btrfs). What it gives up, and why it is not in
today: the agent sees the live folder rather than a snapshot, so the owner editing a file mid-task shows up in the
agent's view (Keep still catches it as a conflict); files in the folder owned by someone other than the owner appear
unreadable to the task; and the multi-folder layout needs one such mount per folder. It needs its own QA pass on
Personal (Keep, undoing a Keep, conflicts, multiple folders, power cut). About half a day with QA. **Recommendation:
not before the freeze; first after Sunday.**

### Fast folders: tried on Sat Oct 24, not shipped

Ben approved the idmapped lower as an optional fast mode. It is built on the branch `fast-folders` (off by default,
falling back to a copy with a logged reason for several folders, files owned by someone else, or a kernel that
can't map) but is **not merged**: inside a running box, the first write to an existing file fails with `EINVAL`
when overlayfs copies it up from the mapped lower layer. Mounting took 53 to 67 ms, and creating new files and
reading existing ones worked. The same `prepare` and `spawnWorker` code, the real fake worker and the box's worker
environment all succeed from a standalone script on the same VM, so the difference is in the box process and is
not found yet. Until it is, the claim stays at today's merged numbers above, not 7 ms.

