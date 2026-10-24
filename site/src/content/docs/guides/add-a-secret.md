---
title: Add a secret to the vault
description: Put an API key in the box's vault so tools can use it on a task's behalf, while the task itself never sees the key.
---

The vault is where the box keeps keys and tokens. Agents never read it. A tool that runs inside the box service reads
the keys it declared, makes the call, and hands the task only the result. In this guide you add a key to the vault,
on the box's screen, through the box's API, or by editing the file. All three take effect at once except the file.

## Before you start

- The key's name, as the app that uses it expects. See [Vault keys](/reference/vault-keys/).
- For the screen: the box's own screen, or a phone paired as the owner.
- For the API or the file: a shell on the box (on Ubuntu, a terminal on GurtOS Personal, or SSH on a debug build of
  GurtOS Server), or a phone paired as the owner for the API. See
  [pair a phone as the owner](/guides/approve-from-your-phone/#pair-a-phone-as-the-owner).

## On the box's screen

1. Open **Settings**, then **Accounts & Keys**. During first-run setup, the **AI models** and **Keys for apps** steps
   show the same fields.
2. Paste the key and choose **Save to vault**.

The screen shows only whether a key is set. It never shows a key again; to change one, paste a new key over it. On
GurtOS Personal, the GurtOS app on your desktop has the same Settings. A phone paired as the owner can do it too.

## With the API

Only the owner may set keys: a request from the box's own machine, or from a phone paired as the owner. Names are
capital letters, digits and underscores.

1. **Set the key.** This reads the value without echoing it or leaving it in your shell history:

   ```sh
   read -rs -p 'Value: ' v && curl -s -X PUT http://127.0.0.1:7700/api/vault/FACTORY_API_KEY \
     -H 'content-type: application/json' -d "{\"value\": \"$v\"}"; unset v
   ```

   ```json
   {"name":"FACTORY_API_KEY","setAt":"2026-10-24T07:12:00.000Z"}
   ```

   The box writes the key to `/etc/box/vault.env`, keeps the file root-only, and uses the key at once. The action log
   records that `FACTORY_API_KEY` was set, never the value.

2. **Check the names.** No route ever returns a value:

   ```sh
   curl -s http://127.0.0.1:7700/api/vault
   ```

   ```json
   [{"name":"FACTORY_API_KEY","setAt":"2026-10-24T07:12:00.000Z"}]
   ```

   `setAt` is `null` for a key that was put in the file by hand.

## With the file

The vault is a plain `KEY=value` file. Everything after `=` is the value, with no quotes.

1. **Add one line per key:**

   ```sh
   read -rs -p 'Value: ' v && echo "FACTORY_API_KEY=$v" | sudo tee -a /etc/box/vault.env >/dev/null; unset v
   ```

   On a debug build of GurtOS Server you are already root, and the image has no `sudo` and no text editor. Run the
   same line without `sudo`.

2. **Keep it readable by root only.** The box refuses to start if anyone else can read the file.

   ```sh
   sudo chown root:root /etc/box/vault.env
   sudo chmod 600 /etc/box/vault.env
   ```

3. **Restart the box service.** The box reads the file at start.

   ```sh
   sudo systemctl restart box.service
   ```

   Running tasks resume where they were. See [Resume after power loss](/concepts/resume-after-power-loss/).

## Check it worked

```sh
systemctl is-active box.service
curl -s http://127.0.0.1:7700/api/health
```

The service is `active` and health answers `{"ok":true,...}`. If the file's mode is wrong, the service fails and the
journal says the vault "must be readable by root only (chmod 600)":

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
| The box's network proxy | The model key, `FACTORY_API_KEY` or `ANTHROPIC_API_KEY`, which it swaps in on calls to Factory or Anthropic, so a Droid task holds only a placeholder. |
| You, through the API | Names and when each was set. Never a value. |

## Limits

- The vault is a plain file on the data disk, protected by file permissions. It is not encrypted at rest.
- Edits to the file by hand need a restart of the box service. Keys set through the API do not.
- A tool's result goes into the action log. A tool that returned a key would leak it there, so tools must never return
  one.

## Related

- [The vault and the broker](/concepts/vault-and-broker/)
- [Vault keys](/reference/vault-keys/)
- [Files and paths](/reference/files-and-paths/)
- [Security model](/security/model/)
