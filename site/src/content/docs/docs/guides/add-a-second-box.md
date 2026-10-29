---
title: Add a second box
description: Run GurtOS on a second machine, give each box a name, list them as peers, and switch between them from the portal in one browser.
sidebar:
  badge:
    text: Preview
    variant: note
---

You can run GurtOS on more than one machine, for example one at home and one in the cloud. Each box is independent: its own tasks, vault, action log and portal. In this guide you name each box, tell one box about the other, and switch between them from the portal.

:::note[Preview]
Listing and switching boxes is built. Switching opens the other box's own portal; one portal does not show or answer another box's tasks yet.
:::

## Before you start

- Two machines running GurtOS. See [Install on Ubuntu](/docs/get-started/install-on-ubuntu/) or [Install GurtOS Server](/docs/get-started/install-server/).
- A root shell on each: `sudo` on Ubuntu or GurtOS Personal, or SSH on a GurtOS Server **debug build**. A release build of GurtOS Server has no shell, so you cannot set these variables on it.
- A network route from your browser to both boxes: the same local network, a private network such as Tailscale or WireGuard, or a relay you run yourself (see [Self-host](/docs/guides/self-host/)). A hosted relay is not running during the preview, and the web app at app.gurtos.com reaches a box only at an https address that a relay gives it, so use each box's own address here. A GurtOS ISO install opens its API to private networks and sets its own `BOX_URL`. On the Ubuntu install, see step 2 of [Approve from your phone](/docs/guides/approve-from-your-phone/) for `BOX_LISTEN`.
- Your browser paired with each box. Off the box itself, every request needs a paired device's token, and each box pairs its own devices.

## Steps

1. **Name each box and give its address.** On each machine, set an id, a display name and the address its portal
   answers on. Without `BOX_ID`, the id is the machine's host name, and the name is the id. A GurtOS ISO install names itself `gurt-<id>`, from the first 6 hex digits of the SHA-256 of its public key, for example `gurt-bf07fe`, so two boxes never share an id.

   ```sh
   sudo systemctl edit box.service
   ```

   ```ini
   [Service]
   Environment=BOX_ID=home
   Environment=BOX_NAME=Home box
   Environment=BOX_URL=http://192.0.2.10:7700
   ```

   Use a different id, name and address on the second machine, for example `cloud`, `Cloud box` and
   `http://192.0.2.20:7700`.

   On a GurtOS ISO install, leave `BOX_URL` out. The box works out its own address at every start, and that value
   wins over one in a drop-in. A drop-in in `/etc/systemd/system` also belongs to the system slot, so the next
   [system update](/docs/guides/update-and-roll-back/) removes it. The name chosen in GurtOS Setup wins over `BOX_NAME`.

2. **List the other box as a peer.** On the first box, add `BOX_PEERS`, a JSON array with one entry per other box.
   `url` is where its portal answers. `stdb` is the name of its SpacetimeDB database, which is `box` unless you
   changed it.

   ```ini
   [Service]
   Environment=BOX_ID=home
   Environment=BOX_NAME=Home box
   Environment=BOX_URL=http://192.0.2.10:7700
   Environment='BOX_PEERS=[{"id":"cloud","name":"Cloud box","url":"http://192.0.2.20:7700","stdb":"box"}]'
   ```

   Do the same on the second box, pointing back at the first, if you want both to list each other.

3. **Restart the service** on each machine.

   ```sh
   sudo systemctl restart box.service
   ```

   If `BOX_PEERS` is not valid JSON, the box still starts, lists only itself, and logs `BOX_PEERS is not valid JSON`.

4. **Switch boxes.** Open the first box's portal. The computer name in the top bar (**Switch computer**) opens a
   **Boxes** menu that lists both boxes, with "(this computer)" beside the one you are on. Choose the other box, and
   the browser opens that box's own portal. Pair your browser with that box the first time, the same way as a phone.
   A peer without a `url` is greyed out.

## Check it worked

```sh
curl -s http://127.0.0.1:7700/api/boxes
```

```json
[
  { "id": "home", "name": "Home box", "url": "http://192.0.2.10:7700", "stdb": "box", "self": true },
  { "id": "cloud", "name": "Cloud box", "url": "http://192.0.2.20:7700", "stdb": "box" }
]
```

The first entry is the box you asked. The rest come from `BOX_PEERS`.

## Limits

- Switching opens the other box's portal at its own address. One portal does not show another box's tasks, and
  approving a request on one box from another box's portal is not built. Open the box that asked.
- The box passes `BOX_PEERS` through as written. It does not check that a peer is reachable.
- Each box keeps its own vault, tasks and log. Nothing is shared or synced between boxes.

## Related

- [Architecture](/docs/concepts/architecture/)
- [Environment variables](/docs/reference/environment/)
- [HTTP API](/docs/reference/http-api/)
- [Approve from your phone](/docs/guides/approve-from-your-phone/)
