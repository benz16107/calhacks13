# Spike findings

Throwaway tests of the risky parts, so the core thread builds on facts. Each section says what ran, whether
it worked, the gotchas, and one line for the core thread. The scripts in this folder are throwaway code.

**Test machine:** the laptop VM (Lima `box` on the laptop, `vz`, Ubuntu 24.04.5, kernel 6.8.0-142, aarch64,
systemd 255, util-linux 2.39.3, ext4 root). Lima cannot snapshot `vz` VMs (`limactl snapshot` says
"unimplemented"), so the clean state is saved inside the VM in `/root/clean-state/` (nft ruleset, passwd,
group, dpkg list, sysctl, unit list). The VM came with rootless containerd and Lima's own `ip nat` table
(`LIMADNS`); leave both alone.

On the laptop, from the repo checkout, copy the folder in, then run one:
`tar c spikes | limactl shell box -- tar x -C ~`, then `limactl shell box -- sudo bash ~/spikes/01-overlay.sh`. Scripts 01, 02, 03, 05 and 07 run as
root, while 04 and 06 run as the normal user. 03 needs the users from 02.

**Left installed in the laptop VM by the spikes:** Node 24.22.1 (NodeSource apt, `/usr/bin/node`, so
`core/setup.sh` skips its own Node), `attr`, `jq`, `bc`, `ripgrep`, the Droid CLI 0.248.0 through
`npm i -g droid` (`/usr/local/bin/droid`, the version `core/setup.sh` pins, so it skips its own download),
and the SpacetimeDB 2.13.0 CLI in the Lima user's `~/.local/bin`, with a test database `spike4` in its
default data dir. All spike users, mounts, nft tables, units and servers were removed.

| # | Test | Result |
|---|---|---|
| 1 | Per-task file copies (overlayfs) | Works, as root |
| 2 | Tasks as separate users | Works |
| 3 | Per-task network limits | Works, matched by uid. Cgroup matching fails open |
| 4 | SpacetimeDB on ARM | Works (2.13.0, aarch64) |
| 5 | Droid as its own user | Works up to auth. Blocked on `FACTORY_API_KEY` |
| 6 | Vision model for /find | Works, Mac Ollama `gemma4`, 1.4 to 4 s a photo |

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

## 3. Per-task network limits

**Ran:** `sudo bash 03-network.sh` (after `02-users.sh`). `03-proxy.mjs` is a 40-line Node HTTP proxy on
`127.0.0.1:8888`, run as its own user `box-proxy`. It allows named hosts per task. It tells which task is
calling from the uid that owns the client socket (a lookup in `/proc/net/tcp`), so tasks carry no token.
Tasks ran as systemd units in `box.slice` with the spike 2 hardening. Three ways to limit them were tried.

**Way A, nftables on the task's uid. Works, all 8 checks pass:**

```
table inet box {
  chain out {
    type filter hook output priority filter; policy accept;
    meta skuid 30000-39999 ip daddr 127.0.0.1 tcp dport 8888 accept
    meta skuid 30000-39999 counter log prefix "box-block " reject
  }
}
```

- Blocked: a direct `curl https://registry.npmjs.org` ("Could not resolve host"), a direct connection to
  `1.1.1.1:443`, any DNS lookup, and another localhost service on `127.0.0.1:9999` (a stand-in for
  SpacetimeDB or the vault).
- Through the proxy: task-a reached its allowed `registry.npmjs.org` (HTTP 200). It was refused
  `example.com` (`CONNECT tunnel failed, response 403`), which task-b, whose list has it, reached.
- Root and the box service are unaffected.
- The proxy logs one JSON line per request: `{"uid":30001,"verb":"CONNECT","host":"example.com","ok":false}`.
  The kernel logs each blocked packet with the `box-block` prefix (`journalctl -k`).

**Way B, nftables on the task's cgroup (`socket cgroupv2 level 1 "box.slice"`). Works until the slice is
recreated, then fails open:**
- nft refuses the rule if the cgroup does not exist yet: `Error: cgroupv2 path fails: No such file or
  directory`. You must `systemctl start box.slice` first, and the slice then stays active.
- nft stores the cgroup's inode number (`level 1 9099`), not its path. After `systemctl stop box.slice` and
  a fresh start, the rule no longer matched, **and task-a reached the internet directly.** This happens on
  every reboot and every slice restart, unless something reloads the rules each time.

**Way C, systemd alone (`IPAddressDeny=any IPAddressAllow=127.0.0.1`).** It blocks the internet and lets the
proxy work. It cannot limit ports, so the task still reached the other localhost service.

**Gotchas:**
- **Block DNS for tasks.** Otherwise a task can leak data through lookups to systemd-resolved
  (`127.0.0.53:53`). Way A blocks it, since only the proxy port is allowed. The proxy resolves names itself.
- **nftables does not see Unix sockets.** A task could still talk to the system D-Bus (`busctl --system
  list` worked). `RestrictAddressFamilies=AF_INET AF_INET6` on the unit blocks that, and the proxy still
  works (HTTP 200).
- For HTTPS the proxy sees only the host name (CONNECT), not the path. Calls that need a secret should go
  to the vault as plain HTTP on a local port, and the vault adds the key and makes the TLS call. That port
  needs its own `accept` line, and the vault can check the caller's uid the same way.
- Use an `inet` table so IPv6 is covered too. Leave Lima's own `ip nat` table alone.
- `curl -f` hides who refused: a 403 from the proxy comes back as curl exit 56 (`CONNECT tunnel failed`),
  while an upstream 403 is exit 22. GitHub's API returned 403 to this VM even without the proxy.

**For the core thread:** load the way A rules at boot from `/etc/nftables.conf` with a fixed task uid range,
add `RestrictAddressFamilies=AF_INET AF_INET6` to every task unit, and give each task a host allowlist in the
proxy keyed by uid. Do not match on cgroups.

## 4. SpacetimeDB on ARM

**Ran:** `bash 04-spacetime/run.sh` as the normal VM user, after
`curl -sSf https://install.spacetimedb.com | sh -s -- --yes`. It installed SpacetimeDB **2.13.0** (aarch64)
to `~/.local/bin/spacetime`. The script starts `spacetime start --non-interactive`, creates a project with
`spacetime init --non-interactive --local -t nodejs-ts`, swaps in a `task` table (`id`, `name`, `status`)
with reducers `addTask` and `setStatus` (`04-spacetime/module.ts`), publishes it, generates bindings, and runs
a Node client that subscribes (`04-spacetime/watch.ts`). Node is 24.22.1 from NodeSource.

**Worked:**
- Publishing took 0.7 s. `spacetime generate` worked.
- The watcher saw each change live, about 20 to 30 ms after the CLI call started, which includes the CLI's
  own startup:
  ```
  18:23:33.103 call add_task            ->  01:23:33.132 [insert] #1 fix the failing test queued
  18:23:33.134 call set_status running  ->  01:23:33.153 [update] #1 queued -> running
                                            01:23:33.169 [update] #1 running -> waiting for your OK
  ```
  (The CLI prints local time and the client prints UTC.)
- A second client calling `conn.reducers.setStatus({ id, status })` and waiting for its own `onUpdate`:
  **median 1.1 ms, max 4.7 ms** over 20 runs.
- After `kill -9` of the server and a restart, the row was still there (`spacetime sql`).

**Gotchas:**
- **`spacetime start` listens on `0.0.0.0:3000` by default**, so every task could reach it. Any client can
  call any reducer unless the reducer checks `ctx.sender`, so a task could approve its own request. The
  spike 3 rules block tasks from it. Reducers that approve things should still check the caller's identity.
- `spacetime init` names the database `spike4-<random>` in `spacetime.local.json`. `spacetime call` and
  `spacetime sql` use that name, even with an explicit name and `--no-config` ("failed to find database
  spike4-60cjs"). Write the name you want into `spacetime.local.json`.
- `spacetime.json` from the template says `"server": "maincloud"` even with `--local`. Pass
  `--server local` on publish.
- In 2.x the client uses `.withDatabaseName()` (not `.withModuleName()`). Reducers take one object
  (`setStatus({ id, status })`). The CLI calls them in snake_case (`set_status 1 '"running"'`).
- `spacetime dev` is interactive. For scripts use `init`, `publish -y`, `generate -y`.
- Run the server as a systemd unit with a fixed `--data-dir`, not `nohup`.

**For the core thread:** SpacetimeDB 2.13 runs self-hosted on the ARM laptop VM with no workarounds. Use it for
live task status and approvals, keep the action log on disk as planned, and block tasks from port 3000.

## 5. Droid as its own user

**Status: everything works up to the API key, which the VM does not have.** No real Droid task has run yet.

**To finish it,** add the key to core's vault in the laptop VM, then rerun. On the laptop, from the repo checkout:

```
limactl shell box -- sudo bash -c 'mkdir -p /etc/box; umask 077; read -rsp "Factory key: " k; echo; echo FACTORY_API_KEY=$k >> /etc/box/vault.env'
tar c spikes/05-droid | limactl shell box -- bash -c "mkdir -p ~/spikes && tar x -C ~/spikes --strip-components=1 && sudo LIST_MODELS=1 bash ~/spikes/05-droid/run.sh"
```

It prompts for the key, so the key stays out of shell history. Get one at
https://app.factory.ai/settings/api-keys. Success looks like `"success":true`, `hello.txt` and `README.md` in the task's upper dir, and broker log
lines with status 200.

**Ran:** `sudo bash 05-droid/run.sh`. The Droid CLI 0.248.0 (linux-arm64, a Bun binary) is at
`/usr/local/bin/droid`, the same path and version `core/setup.sh` installs. `@factory/droid-sdk` 0.10.0 is
in `/opt/spike5`. The task user `task-d` (uid 30004) gets an overlay copy as in spike 2, the spike 2 systemd
hardening and its own `HOME`. It runs `05-droid/task.mjs`, which calls
`run(prompt, { cwd, modelId: 'claude-opus-5-5', autonomyLevel: 'low' })`.

**The key never reaches the task.** `droid` reads `FACTORY_API_BASE_URL` and sends all of its Factory traffic
there over plain HTTP, model calls included, each with `Authorization: Bearer <FACTORY_API_KEY>`. So the task
gets `FACTORY_API_KEY=fk-task-placeholder` and `FACTORY_API_BASE_URL=http://127.0.0.1:7799`.
`05-droid/broker.mjs` (30 lines) runs outside the task. It checks the caller's uid from `/proc/net/tcp`,
replaces the header with the real key, and forwards to `https://api.factory.ai`. The nftables rule lets task
uids reach only port 7799. What `droid` sent, in order:

```
GET  /api/cli/whoami                  GET  /api/feature-flags          GET /api/organization/managed-settings
POST /api/connectors/tools/list       GET  /api/billing/limits         POST /api/llm/a/v1/messages   (Anthropic format)
```

The broker reached the real Factory API from inside the limited task: `/api/feature-flags` returned 200 and the
rest returned 401 "Missing authorization token". The kernel logged no blocked packets, so `droid` tried no
other host directly, at least before it stopped at auth.

**Gotchas:**
- With no key, the SDK throws at once ("No Factory API key found") and the CLI exits 1 ("Authentication
  failed"). Neither hangs on a browser login. A placeholder key gets through to the network.
- The SDK needs `FACTORY_API_KEY` set in the task's environment even when the base URL points at the broker.
  Use a placeholder.
- The broker must be TCP on localhost, because `FACTORY_API_BASE_URL` is a URL. A Unix socket like core's
  per-task broker socket will not do for `droid`'s own calls. Identify the task by the socket's uid, as here.
- `droid` writes `~/.factory`, so the task's `HOME` must be writable (`ReadWritePaths`).
- Set `FACTORY_RIPGREP_PATH=/usr/bin/rg` (apt `ripgrep`). Otherwise `droid` may try to download ripgrep, which
  the network rules block.
- The binary also reads `HTTPS_PROXY`, `NO_PROXY` and `FACTORY_EXTRA_CA_CERTS`, so it can go through the
  spike 3 proxy if a task needs other hosts.
- `listModels()` (run with `LIST_MODELS=1`) prints the model ids the account allows. `claude-opus-5-5` comes
  from Factory's docs and has not been checked against the account.
- Not checked until a key exists: whether `droid` also calls `telemetry.factory.ai` directly during a real
  run. If it does, the network rules block it. Check that it carries on anyway.

**For the core thread:** start Droid with a placeholder key and `FACTORY_API_BASE_URL` pointing at a localhost
broker that swaps in the vault's key and checks the caller's uid. Then the agent can be fully hijacked and
still has no key to steal.

## 6. Vision model for /find

**Ran:** `bash 06-vision.sh [photo]` as the normal VM user. It sends the photo as base64 to Ollama's
`/api/generate` on the Mac at `http://host.lima.internal:11434`, with `think:false`, and prints the timings
Ollama reports.

**Found:** the Mac already has a vision model, so nothing was pulled. `gemma4:latest` is 8.0B at Q4_K_M,
with capabilities completion, vision, audio, tools and thinking. Ollama 0.40.9 runs from Ollama.app.

**Worked with no change to Ben's Ollama setup.** Ollama listens only on the Mac's `127.0.0.1:11434`, and Lima
(`vz`, default network) forwards the VM's `host.lima.internal` (192.168.5.2) to the Mac's localhost. So
`OLLAMA_HOST=0.0.0.0` is not needed and nothing has to be reverted.

| Photo | Model state | Wall time | Breakdown |
|---|---|---|---|
| Labrador, 640 px, 83 KB | cold | 6.5 s | 4.9 s model load, 209 prompt tokens in 0.5 s, 70 output tokens at 66 tok/s |
| Same photo again | warm, cached | 1.4 s | prompt cached (0.04 s), 84 tokens at 64 tok/s |
| Golden Gate, 3 MB | warm, new photo | 4.0 s | 1093 prompt tokens in 2.5 s, 71 tokens at 63 tok/s |
| Labrador, thinking on | warm | 8.9 s | 537 output tokens: thinking costs about 6x |

Descriptions were accurate: "A light-colored Labrador Retriever is standing outdoors on green grass..." with
keywords such as `Labrador Retriever, dog portrait, yellow labrador`. The bridge photo got "Golden Gate
Bridge, San Francisco, suspension bridge". It ran 100% on the Mac's GPU.

**Gotchas:**
- **Send `"think": false`.** gemma4 thinks by default, which took 8.9 s instead of 1.4 s.
- Photo size drives the time. Resize photos to about 1024 px before sending: the 3 MB one spent 2.5 s on
  the prompt alone. A 3 MB photo is 4 MB of base64, too big to pass as a shell argument.
- The first call after Ollama unloads the model pays about 5 s to load it. Send `keep_alive` (the script
  uses `10m`) while indexing.
- The Mac must be awake. On Sunday the laptop is the demo box, so that is fine. Overnight indexing is not.

**For the core thread:** call `http://host.lima.internal:11434/api/generate` with `model: "gemma4"`,
`think: false` and photos resized to about 1024 px. Expect about 1.5 s a photo while warm. The photo stays on
the laptop.

## Checked against core (main at 0c8e9a3)

The spike thread does not change `core/`. These are for the core thread.

0. **The task holds the real Factory key.** `core/box.ts:111` puts the vault's `FACTORY_API_KEY` in the
   worker's environment, and Droid can run shell commands, so the booby-trapped page can tell it to print
   `$FACTORY_API_KEY`. That breaks moment 2's "agents never see secrets". Spike 5 removes it: give the task
   `FACTORY_API_KEY=fk-task-placeholder` and `FACTORY_API_BASE_URL=http://127.0.0.1:<port>`, and have the
   core answer that port by swapping in the vault's key (`05-droid/broker.mjs`, 30 lines).
1. **A later task can rewrite a finished task's layer.** `seal()` runs `chmod -R a+rwX` on `tasks/<id>/upper`
   and leaves `tasks/<id>` at 0711. Shown in the VM: task-b ran `echo tampered >> tasks/A/upper/a.txt` and
   it worked. That change reaches every later copy and every view, and undoing B does not remove it.
   **Fix:** `chmod 700 tasks/<id>` in `seal()`. Then the direct write is denied, and task-b can still edit
   `a.txt` through its own overlay copy, because overlayfs reads lower layers with root's rights.
2. **Workers start with plain `spawn` (uid and gid only).** Tasks then see each other's processes and command
   lines in `ps`, share `/tmp`, can write any folder they own, and can reach the system D-Bus. Spike 2 fixes
   the first three with systemd unit options (`systemd-run --uid` or `-p User=` with `ProtectProc=invisible
   PrivateTmp=yes ProtectSystem=strict ReadWritePaths=...`). Core's broker is a Unix socket, so
   `RestrictAddressFamilies` must include `AF_UNIX`, which leaves D-Bus open. Hiding `/run/dbus` with
   `InaccessiblePaths=` may close it. That idea is untested.
3. **No firewall rule yet.** Spike 3's `meta skuid 30000-39999` rules fit core's uid range as they are. Allow
   only the ports tasks need, for example the Droid broker, and block SpacetimeDB's `0.0.0.0:3000`.
4. **Droid needs a TCP broker** for its own model calls (spike 5), next to the per-task Unix socket for tools.
5. If `seal()` or cleanup ever deletes task folders, unmount first and use `rm -rf --one-file-system`
   (spike 2).

## Not tested yet

- **A real power cut.** `07-powercut.sh` is ready: it leaves a task's overlay copy mid-write, has the Mac kill
  the VM process (`limactl stop --force box`), boots it, and checks that the overlay remounts and which files
  survived. It also times the boot. The header of the script has the exact commands. It did not run: at
  18:33 another thread had just started a root SpacetimeDB on the laptop VM (`--data-dir /var/lib/spacetimedb`),
  and a power cut would have killed its work. Run it when the VM is free.
  What is known already: an `upper` survives a lazy unmount and remounts with its contents (spike 1), and
  SpacetimeDB keeps its rows after `kill -9` of the server (spike 4). Expect files written in the last
  ~30 s without `fsync` to be lost (ext4 default writeback), so the action log should `fsync` each entry.
