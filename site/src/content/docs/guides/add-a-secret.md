---
title: Add a secret to the vault
description: Put an API key in the box's vault so tools can use it on a task's behalf, while the task itself never sees the key.
---

The vault is where the box keeps keys and tokens. Agents never read it. A tool that runs inside the box service reads the keys it declared, makes the call, and hands the task only the result. In this guide you add a key to the vault and restart the box so it loads.

## Before you start

- A root shell on the box. This works on a box installed on Ubuntu, and on a debug build of the ISO, which has SSH. A release build of the ISO has no shell.
- The key's name, as the app that uses it expects. See [Vault keys](/reference/vault-keys/).

:::caution[Planned]
A screen in the portal for adding keys is planned. Until then, a release build of the ISO starts with an empty vault and no way to fill it.
:::

## Steps

1. **Add one line per key.** The vault is a plain `KEY=value` file. Names are capital letters, digits and
   underscores. Everything after `=` is the value, with no quotes. This reads the value without echoing it or
   leaving it in your shell history:

   ```sh
   read -rs -p 'Value: ' v && echo "FACTORY_API_KEY=$v" | sudo tee -a /etc/box/vault.env >/dev/null; unset v
   ```

   On a debug build of the OS image you are already root, and the image has no `sudo` and no text editor. Run the
   same line without `sudo`.

2. **Check the names.** List them without showing the values:

   ```sh
   sudo cut -d= -f1 /etc/box/vault.env
   ```

3. **Keep it readable by root only.** The box refuses to start if anyone else can read the file.

   ```sh
   sudo chown root:root /etc/box/vault.env
   sudo chmod 600 /etc/box/vault.env
   ```

4. **Restart the box service.** The vault is read once, at start.

   ```sh
   sudo systemctl restart box.service
   ```

   Running tasks resume where they were. See [Resume after power loss](/concepts/resume-after-power-loss/).

## Check it worked

```sh
systemctl is-active box.service
curl -s http://127.0.0.1:7700/api/health
```

The service is `active` and health answers `{"ok":true,...}`. If the file's mode is wrong, the service fails and the journal says the vault "must be readable by root only (chmod 600)":

```sh
journalctl -u box.service -n 20
```

A tool whose key is missing fails its call with "the vault has no `<NAME>`", which shows in the task's log.

## Who can read which key

| Part of the box | What it may read |
|---|---|
| A task (the agent) | Nothing. It runs as its own user and the file is root only. |
| A tool | Only the keys in its own `secrets` list. |
| A model job | Only the keys in its own `secrets` list. |
| An app's routes and triggers | Only the keys in the app's `secrets` list. |
| The box's network proxy | `FACTORY_API_KEY`, which it swaps in on calls to Factory, so a Droid task holds only a placeholder. |

## Limits

- The vault is a plain file on the data disk, protected by file permissions. It is not encrypted at rest.
- Changes need a restart of the box service.
- A tool's result goes into the action log. A tool that returned a key would leak it there, so tools must never return one.

## Related

- [The vault and the broker](/concepts/vault-and-broker/)
- [Vault keys](/reference/vault-keys/)
- [Files and paths](/reference/files-and-paths/)
- [Security model](/security/model/)
