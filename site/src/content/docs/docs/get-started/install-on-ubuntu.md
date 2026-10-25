---
title: Install on Ubuntu
description: Install the GurtOS service on an existing Ubuntu 24.04 machine or virtual machine with one script, add your model key, and check that it runs.
---

You can run GurtOS on a plain Ubuntu 24.04 system instead of the GurtOS image. You keep Ubuntu's login, package
manager and updates. GurtOS adds its service, its task users and its firewall rule. Tasks, the vault, approvals and
the action log work the same as on the OS image.

This is the quickest way to run real agent tasks today.

:::danger[Use a dedicated machine]
The box service runs as root. It creates Linux users, mounts filesystems, loads an nftables rule and runs every
installed app with access to the vault. Install it on a machine or virtual machine set aside for GurtOS, not on the
computer you use every day.
:::

## Requirements

- Ubuntu 24.04, on x86_64 or arm64.
- Root access (`sudo`).
- At least 4 GB of memory and 10 GB of free disk. Each task may use up to 2 GB of memory.
  The box has run one task at a time in 1 GB, and adds 1.5 GB of disk ([measured](https://github.com/benz16107/calhacks13/blob/main/tracks/anthropic/README.md)).
- Internet access during the install, to download Node.js, Droid and SpacetimeDB.
- No other software using user ids 30000 to 39999, TCP port 7700, port 3000, or ports 8800 to 8899.
- One model key: an Anthropic API key from [console.anthropic.com](https://console.anthropic.com), or a Factory API
  key from [app.factory.ai](https://app.factory.ai). Tasks never see it. Every app is optional and stays off until
  you add its keys.

## Install

1. Get the GurtOS source on the machine:

   ```sh
   git clone https://github.com/benz16107/calhacks13.git gurtos && cd gurtos
   ```
2. From the top folder of the source, run the install script as root:

   ```sh
   sudo core/install.sh
   ```

   It runs `core/setup.sh`, which installs `nftables` and `ripgrep`, Node.js 24 if no Node.js 22 or newer is
   present, the Droid CLI (checked against its published SHA-256), and SpacetimeDB as `spacetimedb.service`.
   Then it copies the source to `/opt/box`, installs its packages, creates an empty vault at
   `/etc/box/vault.env` with mode `0600`, and installs and starts `box.service`.
   It prints `active` when the service is up. Running it again is safe.

3. Add your model key to the vault, in the portal's **Settings**, **Accounts & Keys** (see [Open the portal](#open-the-portal))
   or through the API. The command below sets a Factory key;
   for an Anthropic key, use the name `ANTHROPIC_API_KEY` instead. A request from the machine itself is allowed to set
   keys, the key takes effect at once, and the box never returns it:

   ```sh
   read -rs -p 'FACTORY_API_KEY: ' v && echo
   printf '{"value":"%s"}' "$v" | curl -s -X PUT http://127.0.0.1:7700/api/vault/FACTORY_API_KEY \
     -H 'content-type: application/json' -d @- && unset v
   ```

   You can also edit `/etc/box/vault.env` (`KEY=value`, one per line) as root and restart `box.service`. The box
   refuses to start if that file is readable by anyone but root. See [Add a secret to the vault](/docs/guides/add-a-secret/).

## Check it runs

```sh
systemctl is-active box.service spacetimedb.service
curl -s 127.0.0.1:7700/api/health
```

```json
{"ok":true,"startedAt":"2026-10-24T07:00:00.000Z","resumed":[],"tasks":0,"tools":["example.spend","..."],"spacetime":{"port":3000,"database":"box"}}
```

`tools` lists every tool the installed apps provide. Check the service log for the line that lists loaded apps:

```sh
journalctl -u box.service -n 20 --no-pager
```

```text
box up: 0 tasks in the log, tracks: apify, credit-desk, elastic, example, fetch, find, jira, mana, shopper, wallet
```

An app that fails to load is skipped and logged there. The box keeps running without it.

If the log says `WARNING: the firewall rule did not load, so tasks are not network-limited`, nftables is missing
or blocked. Fix that before you run tasks: without the rule, tasks can reach any host.

## Open the portal

The box serves the portal on the same address as the API. On the machine itself, open
`http://127.0.0.1:7700/` in a browser.

The API listens on `127.0.0.1` only. To use the portal from another computer, forward the port over SSH:

```sh
ssh -L 7700:127.0.0.1:7700 -L 3000:127.0.0.1:3000 you@192.0.2.10
```

Then open `http://127.0.0.1:7700/` on your own computer. Forwarding port 3000 as well gives the portal live
updates through SpacetimeDB; without it the portal falls back to the action log stream.

A forwarded connection arrives at the box from `127.0.0.1`, so the box treats it like its own screen, with the
owner's rights. That is fine for you over your own SSH login. Do not forward the port for anyone else.

:::caution
You can make the API listen on another address with `BOX_LISTEN` in the service's environment. Every request from
outside the box then needs a paired device's token, and only the box itself or a phone paired as the owner can
change settings, the vault or the owner's folders. Even so, open it only on a network you control, such as a VPN.
See [Approve from your phone](/docs/guides/approve-from-your-phone/) and the [threat model](/docs/security/threat-model/).
:::

## Update or remove

To update, get a newer copy of the source and run `sudo core/install.sh` again. It replaces `/opt/box` and
restarts the service. Tasks that were running resume from the action log.

To remove GurtOS, stop and disable the services, then delete what the install created:

```sh
sudo systemctl disable --now box.service spacetimedb.service
sudo rm /etc/systemd/system/box.service /etc/systemd/system/spacetimedb.service
sudo systemctl daemon-reload
sudo nft delete table inet box
sudo rm -rf /opt/box /var/lib/box /etc/box   # deletes the action log, workspaces and vault
sudo rm -rf /var/lib/spacetimedb              # SpacetimeDB's data
```

The install also left Node.js, `/usr/local/bin/droid` and the SpacetimeDB CLI in place. Remove them if nothing
else uses them.

Task users (`box-<id>`) are removed when each task ends. Check for leftovers with `getent passwd | grep '^box-'`.

## Next

[Your first task](/docs/get-started/first-task/).

## Related

- [Install Server](/docs/get-started/install-server/)
- [Files and paths](/docs/reference/files-and-paths/)
- [Environment variables](/docs/reference/environment/)
- [Security model](/docs/security/model/)
