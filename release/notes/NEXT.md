<!--
Draft notes for the release after v0.1.0-preview, from `git log v0.1.0-preview..main`. At release time: replace
<version> and the checksum placeholders, rename this file to <version>.md, and check each item still holds.

Before publishing (see release/README.md and release/licenses.md):
- Sign the images with the release update key (release/update.pub). v0.1.0-preview boxes take nothing else.
- Publish the update images (.sqfs, .sha256, .sig) for each edition and architecture, or the Personal upgrade path
  below does not exist. Check each unpacked system fits its slot (6 GB Server, 12 GB Personal).
- Try the Personal upgrade from a v0.1.0-preview install once, and fill in the result under "Upgrade".
-->

# GurtOS <version> (preview)

The second preview of GurtOS: operating systems built for AI agents. Each agent task runs as its own Linux user in its
own copy of your files, its network reaches only the hosts it lists, keys stay in a root-only vault, and spending or
risky steps wait for your OK. **This is still a preview.** It has not had an outside security audit. Install it on a
spare machine or a VM, with test keys. The installer takes the whole disk.

This release fixes several security bugs in v0.1.0-preview. If you run v0.1.0-preview, move to this release.

## Downloads

Every file is on this GitHub release and on the mirror at `https://sjc1.vultrobjects.com/gurtos/<version>/`, with
the same checksums and signature.

| File | For | Size | SHA-256 |
|---|---|---|---|
| `gurtos-server-x86_64.iso` | GurtOS Server on a PC, server or cloud VM (Intel or AMD) | <size> | `<sha256>` |
| `gurtos-server-arm64.iso` | GurtOS Server on an Apple silicon Mac (UTM, Parallels) or an arm64 server | <size> | `<sha256>` |
| `gurtos-personal-x86_64.iso` | GurtOS Personal on a PC or laptop (Intel or AMD) | <size> | `<sha256>` |
| `gurtos-personal-arm64.iso` | GurtOS Personal on an Apple silicon Mac (UTM, Parallels) | <size> | `<sha256>` |
| `gurtos-<edition>-<arch>.sqfs`, `.sha256`, `.sig` | System update images for `box-update` | <size> | in each `.sha256` |

`SHA256SUMS` lists the checksum of every ISO, `SHA256SUMS.sig` is its signature, and `allowed_signers` is the
public key that checks it. Software bills of materials are attached for the source and for each ISO.

## Verify

```sh
ssh-keygen -Y verify -f allowed_signers -I gurtos -n gurtos-release -s SHA256SUMS.sig < SHA256SUMS
sha256sum -c SHA256SUMS --ignore-missing        # macOS: shasum -a 256 -c SHA256SUMS --ignore-missing
```

The first command must print `Good "gurtos-release" signature for gurtos with ED25519 key
SHA256:FWKFb1eAvEBmMhVJwMwTnLnhrmZ5yQZ5947pDvFKcpY`, the same key as v0.1.0-preview and
`release/allowed_signers` in the repository.

## Upgrade from v0.1.0-preview

- **GurtOS Personal:** open a terminal and run
  `sudo box-update apply https://github.com/benz16107/calhacks13/releases/download/<version>/gurtos-personal-<arch>.sqfs`
  with `x86_64` or `arm64` for `<arch>` (`uname -m` says `aarch64` on arm64), or the same file on the mirror. The v0.1.0-preview updater checks the
  signature, the checksum and the edition, but not the architecture, so pick the right file. It writes the new
  system to the spare slot and restarts. If the new system is not healthy within 5 minutes, the computer goes back
  to v0.1.0-preview by itself. Your accounts, files, settings, tasks, action log and keys are kept. Software you
  installed with `apt` is not; Flatpak apps are. `sudo box-update rollback` goes back by hand.
- **GurtOS Server:** a release build has no shell, so it cannot run `box-update`. Moving to this release means
  installing it again from the new ISO, which erases the disk: tasks, the action log and the vault go with it. Add
  your model key and pair your phone again afterwards. An in-product updater is on the roadmap.
- **The box service installed from source** (`core/install.sh` on Ubuntu 24.04): check out the new tag and run
  `sudo core/install.sh` again. Tasks, the log and the vault in `/var/lib/box` and `/etc/box` are kept.

## What changed

### Security

- A task can no longer lower its own spend. A negative or non-number cost used to let every later spend pass the
  task's budget and the owner's approval threshold.
- Diff, Replay and Keep never follow links a task left in its copy. A link to the vault shows as "link to ..."
  instead of the vault's contents, and Keep refuses to write through a link in your folder.
- The box's own screen is only a page on `127.0.0.1`, `localhost` or `[::1]` with a matching origin, which closes
  DNS rebinding and other local pages. Request bodies are capped at 10 MB, or 1 MB without a token.
- The proxy never reaches link-local addresses such as a cloud provider's metadata service, and a host on a
  private network must be listed with its exact port.
- The model key goes only into the `authorization` and `x-api-key` headers. On your own Anthropic key, a call that
  asks Anthropic to fetch a page, an MCP server or a file by URL is refused.
- A key that a tool quotes in an error or its output is cut out of the log and the task's result.
- Wrong pairing codes are limited to 5 a minute from one address and 60 a minute in all.
- Each task has a disk limit, 5 GB unless you set another for its app. A task past it is stopped and undone, and
  your phone is told. It is a check every 2 seconds, not a hard quota.
- The Factory app's pull request tool no longer runs git as root inside a task's `.git`, where a planted hook could
  run with the vault in reach. A failed push no longer puts the GitHub token in the error.
- Root no longer writes Droid's settings file through a link a task left behind.

### New

- **Set up from another computer.** Choose it on the setup screen, and an AI agent on your network sets the
  computer up with a one-time code, through the `gurtos` command, an MCP server for Claude Code, or plain HTTP.
  Every step goes in the action log. The guide is `AGENT-SETUP.md`, also on the disc in `/usr/share/doc/gurtos/`.
- **Permissions for each app, like a phone's.** When you turn an app on, GurtOS shows what it may use (keys, money,
  hosts, folders, a shell). Turn any of them off in Settings, Permissions, and set a daily spending limit.
- **Replay.** Play back a finished task step by step, with its files at each step.
- **Remote access without our relay.** The hosted relay is offline, so pairing a phone now uses the computer's own
  page on your home network. Remote access says plainly when no relay answers, and the owner can choose their own
  relay (`PUT /api/remote/relay`, or `BOX_RELAY`). `docs/self-host.md` runs one with a single command.

### Setup and screens

- GurtOS Server's setup has 8 steps: welcome, network, name and time zone, owner and phone, model key, what agents
  may do, updates, and done. Apps and their keys are no longer part of setup.
- GurtOS Personal's Setup has 6 steps: welcome, AI models, folders, permissions, pair a phone, and done. It turns on
  Find and leaves every other app off.
- Accounts & Keys lists the model keys, the keys of apps that are on, and keys you saved, instead of every app's.
- A warning with a link to Settings when no model key is set. Errors read as sentences, such as "Your Anthropic key
  was not accepted. Change it in Settings, Keys."
- Only money from test apps is labelled test, and those apps say so in App Center. Real model spend on your key is
  not labelled test.
- Settings no longer shows automatic updates or an update channel, which nothing read.
- Phone layouts fixed between 360 and 390 pixels wide. Business screens no longer log an error on load.
- Personal: Keep from Files no longer freezes the window; a second click on Keep or Undo is ignored while the first
  runs; "Unlock to approve" holds for 2 minutes and only while the request waits; text follows GNOME's Large Text
  and times follow the 12 or 24-hour setting; the name you type for the computer is kept; Ubuntu's Software Updater
  is removed, because GurtOS updates as a whole.

### Installer and updates

- The installer never offers the disc or USB stick it started from, a disk in use, or a memory disk. With several
  disks it shows a numbered list. A disk with data on it, or any USB or removable disk, needs you to type `erase`.
  Ctrl+C before it writes changes nothing.
- `box-update` refuses to replace the last healthy system while a new one is on trial, refuses an image for another
  architecture, and refuses an older build unless you add `--allow-older`. A slot whose write did not finish is
  marked and never started. It writes only to the disk the running system is on.
- Droid's download never holds up the boot. It retries with backoff, the screen says how it is going, and a task
  started before it finishes waits in the queue and starts once Droid is there. Droid is pinned to 0.248.0 with
  checked SHA-256 sums.
- First boot survives a power cut.

### Reliability

- A folder can take 499 finished tasks. Before, after about 110 every new task failed and the box did not start.
- A full disk can no longer leave a torn line in the action log that stops the next start.
- Undo on a kept task first reverts the Keep (owner only), or refuses if you edited a kept file since. Keep is all
  or nothing.
- A schedule with a bad time no longer fires every millisecond, and a daily schedule cannot run twice.

## Known issues

- No outside security audit. Every task shares one Linux kernel. GurtOS checks which hosts a task reaches, not what
  it sends them. The disk is not encrypted.
- The hosted relay (`box.gurtos.com`) and the live demo (`try.gurtos.com`) are offline. Pair your phone on the same
  network as the computer. Remote access and push notifications to a phone need a relay you run yourself.
- A release build of GurtOS Server cannot be updated in place.
- With two GurtOS disks plugged into one computer, the boot loader and the file system table find partitions by
  label, so a start can use the other disk's system or data.
- The update health check asks only the box service's `/health`.
- Past 499 finished tasks, a folder refuses new tasks. On Personal, each task's copy stays on disk until it is
  undone, even after Keep. The action log is never trimmed.
- Secure Boot must be off: the boot loader is not signed. The installer takes the whole disk. GurtOS Server sets up
  wired networks only.

## Build it yourself

On any Ubuntu 24.04 machine or VM with root: `git clone https://github.com/benz16107/calhacks13.git gurtos && cd
gurtos && git checkout <version> && image/build`. Editions, architectures, times and options are in
[`image/README.md`](https://github.com/benz16107/calhacks13/blob/main/image/README.md).

GurtOS is licensed under the Apache License 2.0. The images contain third-party software under its own licences;
see NOTICE and [`release/licenses.md`](https://github.com/benz16107/calhacks13/blob/main/release/licenses.md).
