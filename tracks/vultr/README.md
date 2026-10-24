# Vultr

What GurtOS Server does with a Vultr account. It serves MLH's "Best use of Vultr": use Vultr cloud well, and use it in
the project. Each part below says why it is there.

| Part | Where | Why it is here |
|---|---|---|
| Install the real disc on Vultr | `up.ts` | GurtOS is an OS, so the test of "runs on Vultr" is booting the disc, not installing packages on Ubuntu. Serves *use Vultr cloud*. |
| Encrypted backups to Object Storage | `backup.ts`, `s3.ts`, `restore.ts`, daily trigger | An always-on box on a rented machine needs its state somewhere else, and the host must not be able to read it. Serves *use Vultr in the project*. |
| Cloud firewall set from the box | `firewall.ts`, `PUT /t/vultr/firewall` | The box has its own firewall; Vultr's drops packets before they reach the machine. The box sets it so the two cannot drift. Serves *use Vultr cloud*. |
| Serverless Inference for cheap tasks | not built | See "Not built". |

## Boot the disc on Vultr: `up.ts`

```sh
VULTR_API_KEY=… tracks/vultr/up.ts --iso-url https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/gurtos-server-x86_64.iso
VULTR_API_KEY=… tracks/vultr/up.ts --iso-id <id> [--plan vc2-1c-1gb] [--install-seconds 480] [--region sjc] [--firewall <group id>]
VULTR_API_KEY=… tracks/vultr/up.ts --destroy <instance id> [--delete-iso <iso id>]
```

It adds the ISO from a URL (or reuses one), creates an instance that boots it, waits for the installer, detaches the
disc, and prints the instance, its address and the console address. The disc has no sshd and the box's API refuses
the public internet (`image/README.md`, "Start it"), so first-run setup happens on that console, which shows the
box's screen. Vultr allows two custom ISOs per account, so a third `--iso-url` fails until one is deleted, and it
only fetches an ISO from an `https` URL.

**Measured on 2026-10-24** with the release ISO (`gurtos-server-x86_64-20261024-0644-881318a.iso`, 1.5 GB) on the
cheapest plan with the 25 GB the installer needs, `vc2-1c-1gb` (1 vCPU, 1 GB RAM, about $0.007 an hour):

| Step | Time from creating the instance |
|---|---|
| Instance running with an address | 12 s |
| Installer copying the system (screenshot 1: 50%) | about 3 min |
| Installer finished, restarted, GurtOS home screen up | about 5 min |
| Disc detached, box back from its own disk, same name | about 1 min more |

The first attempt detached the disc after 300 s and cut the installer off: the console then stayed on "Booting from
Hard Disk..." for good. 1 vCPU unpacks the system slowly, so `--install-seconds` defaults to 480 here. Screenshots:
`screenshots/1-installer-copying-50-percent.png`, `2-box-screen-after-disc-detached.png`.

## Backups

Every day (and on `POST /t/vultr/backup`, owner only) the box:

1. writes `BOX_HOME/vultr/manifest.json` (the task users and their numeric ids),
2. pipes `tar` of `BOX_HOME` through `age -r <owner's public key>` to a file,
3. uploads it to `s3://gurtos-backups/backups/<box id>/<time>.tar.age` on Vultr Object Storage (SigV4 in `s3.ts`, no
   package) and deletes all but the newest 14.

**Who holds the key.** The vault holds the owner's *public* key (`BACKUP_AGE_RECIPIENT`). The owner makes the pair with
`age-keygen -o gurtos-backup.key` on their own computer and keeps the file. The box and Vultr never see the private
half, so neither can read a backup, and losing the file loses the backups. `age` is a published format: any `age`
install can decrypt an archive, with no GurtOS code.

**What is in it.** The log, the workspaces, each task's overlay folder, paired devices, settings and app state. Left out:
the relay identity (`remote.json`, `remote/`), the box's CA key and the live socket, because a restored box makes
its own. The vault (`/etc/box/vault.env`) is not backed up: the owner puts the keys back.

**Restore** on a fresh box (a GurtOS disc, or `core/install.sh`), as root:

```sh
export VULTR_OBJ_ACCESS=… VULTR_OBJ_SECRET=…
tracks/vultr/restore.ts --identity ~/gurtos-backup.key --box-id <old box id>
```

It downloads the newest backup, stops the box, moves the old state into `BOX_HOME/.before-restore-<time>` (kept, and left out of
backups), decrypts in a pipe into `BOX_HOME`, gives each task user its old id, and starts the box. The box then does what it
does after a power cut: replays the log and resumes every task that was running or waiting.

**Measured** on the linuxbox test VM against the real Object Storage (`restore-proof.sh`): a 379 KB backup uploaded in
1.2 s; a fresh `BOX_HOME` restored and its box was up 3 s after the download started; the task that was waiting for an
OK came back waiting, got its OK on the restored box and finished, and its user had its old id. Restore onto a fresh
*Vultr* instance has not been run (see "Status").

**On a Vultr instance** (2026-10-24, `vc2-1c-1gb` installed from the Server debug disc, because the release disc has no
shell to run a restore from): `restore.ts` took 2.8 s to download, decrypt and start the box on the restored folder.
It listed the finished task as done and the waiting one as waiting, and after an OK on that box the waiting task
finished and wrote its file. The installed image has `/var/lib/box` as a mount point, so the old state is moved into
`BOX_HOME/.before-restore-<time>` instead of renaming the folder (a rename failed with EBUSY on the first try). The image
needs the `age` program: the disc does not ship it yet, and has no apt, so this test used the official static `age`
1.2.1 binary.

**Vault keys:** `VULTR_OBJ_ACCESS`, `VULTR_OBJ_SECRET`, `BACKUP_AGE_RECIPIENT`; optional `VULTR_OBJ_HOST` (default
`sjc1.vultrobjects.com`) and `VULTR_OBJ_BUCKET` (default `gurtos-backups`, made private on the first backup).

**Limits.** A backup is crash-consistent, as if the power was cut at that moment: the log is append-only and fsynced
per line, so a restore replays to the last whole line, and a file that was half-written lands as the task's own
power-cut copy would. Object Storage keys cannot be scoped to one bucket, so the key in the vault can also write the
release mirror (`gurtos`); the release files are signed, so a swap shows, but use a separate Object Storage
subscription for a box that is not yours.

## Cloud firewall

`PUT /t/vultr/firewall {"ssh": ["203.0.113.7"], "public": [443]}` (owner only) makes a Vultr firewall group
`gurtos-<box id>` hold exactly those rules and puts this instance in it. The instance is found from Vultr's metadata
address. Vultr groups are allow lists, so everything else inbound is dropped, as the box's own `nftables.conf` does.

- It never opens 7700 (the box API) or 3000 (SpacetimeDB), to the whole internet or to anyone: the box's own rule
  lets 7700 in from private networks only, and a request to open it is refused before any call to Vultr.
- It refuses a config with no ssh source, or one wider than a /8, so a typo cannot lock everyone out.
- It adds new rules before deleting old ones, so a changed ssh address never leaves a moment with none in the API.
  Vultr applies a change on its own schedule: on 2026-10-24 a removed rule was enforced within 15 s, and an added one
  took up to about 3 minutes to start letting traffic in. Change the ssh source only while you still have a session
  open or the Vultr console available.
- Tested on a live instance: with the group attached and ssh allowed only from a wrong address, ssh from outside
  timed out although the box's own firewall accepts port 22; putting the right address back let it in again.
- Tailscale and the relay tunnel are outbound connections, so their replies come back without an inbound rule.

Vault key: `VULTR_API_KEY` (the broker keeps it; no task sees it).

## Status

Proven on live Vultr (2026-10-24): booting and installing the release disc (above), the S3 client against Object
Storage, encrypted backup and restore onto a fresh Vultr instance with a waiting task resuming, and a firewall group
created, attached to an instance, changed and enforced. The test instances, ISO, group and objects were deleted
afterwards; the three runs cost under $0.20.

Not proven: the first-boot wizard was shown (screenshot 3) but not clicked through; the box's own `PUT /t/vultr/firewall`
route and the daily backup trigger ran only against local stand-ins and the real Object Storage from a test VM, not on
a Vultr instance running this track.

## Not built

**Vultr Serverless Inference** (an open model for cheap tasks, priced in the budget). `GET /v2/inference` on this
account lists no subscription, and creating one is a paid subscription, which needs the account owner's decision.
Nothing in this track calls it.

## Run the checks

```sh
node --experimental-strip-types --test tracks/vultr/*.test.ts   # SigV4 against AWS's published example; backup round trip; firewall rules
./demo                                                          # includes this track's step (demo.ts), with a local stand-in for Object Storage
```
