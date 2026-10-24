---
title: Approve from your phone
description: Pair a phone with the box, give it a route to the box, and answer an agent's request for your OK from the phone.
sidebar:
  badge:
    text: Preview
    variant: note
---

When a task asks for your OK, the request waits until someone answers. In this guide you give a phone a route to the
box, pair it, and approve a request from it. Each phone gets its own device token, so the action log records which
phone said yes, and you can remove one phone without touching the others.

:::note[Preview]
Pairing works from the portal in a browser. Two pieces are not finished: the box's own screen cannot show the QR code
yet, because it does not know the address your phone uses, and there is no setting in the portal for opening the box
to your network.
:::

## Before you start

- A running box. See [Install on Ubuntu](/get-started/install-on-ubuntu/) or [Install Server](/get-started/install-server/).
- A shell on the box, to change its listen address.
- A laptop and a phone with browsers.
- A network route from both to the box that you control.

## Steps

1. **Give the phone a route to the box.** The box's API listens on `127.0.0.1` only. Pick one way in:

   - A private network or VPN that the phone, your laptop and the box are all on, such as WireGuard or Tailscale.
     Then set the box to listen on its address there (step 2).
   - A reverse proxy you run on the box that serves HTTPS and forwards to `127.0.0.1:7700`.

   :::caution
   The box's HTTP API has no login of its own. Anyone who can reach port 7700 can start, approve and undo tasks.
   Only open it to a network you trust. See the [threat model](/security/threat-model/).
   :::

2. **Set the listen address** if you chose a private network. Add `BOX_LISTEN` to the box's service and restart it:

   ```sh
   sudo systemctl edit box.service
   ```

   ```ini
   [Service]
   Environment=BOX_LISTEN=192.0.2.10
   ```

   ```sh
   sudo systemctl restart box.service
   ```

   Use the box's own address on that network. `0.0.0.0` listens on every interface, including networks you may not
   trust.

3. **Show a pairing code.** On your laptop, open the portal at the box's address, for example
   `http://192.0.2.10:7700/`, and open **Settings**. It shows a QR code and the code in text. The code works once,
   for 5 minutes.

   The QR code appears only when the portal is open at an address the phone can use. On the box's own screen, or in a
   browser at `127.0.0.1`, Settings shows the code without a QR code.

   ![The Pair a phone window: a QR code, the code to compare, and the list of paired phones with a Remove button.](../../../assets/screens/box-pair.png)

   *Pairing in Settings, from the portal's design. The code and phone are examples.*

4. **Pair the phone.** Scan the QR code with the phone's camera. It opens the portal on the phone at
   `http://192.0.2.10:7700/#pair/<code>`. Check that the phone shows the same code as the laptop, give the phone a
   name under **Name this phone**, and tap **Pair this phone**. The phone keeps its device token in the browser's storage.

5. **Approve a request.** When a task asks for an OK, the phone shows it with **Approve** and **Deny**. The first
   answer wins, from any device. The phone sends its device token with the answer, so the log records the phone's name.

   ![A phone lock screen with an approval card that has Approve and Deny buttons, and two more requests stacked below.](../../../assets/screens/phone-approval.png)

   *An approval on a phone, from the portal's design. Amounts are examples.*

### Pair without the portal

You can do steps 3 and 4 with the API, for example from a script:

```sh
curl -s -X POST http://127.0.0.1:7700/api/pair/start
```

```json
{"code":"3f9a1c2e","url":"/pair#3f9a1c2e","expiresAt":"2026-10-24T07:05:00.000Z","box":{"id":"box-a1b2c3d4e5","name":"box-a1b2c3d4e5"}}
```

Open `http://192.0.2.10:7700/#pair/3f9a1c2e` on the phone. A program can redeem the code itself with
`POST /api/pair {"code": "3f9a1c2e", "name": "Kitchen tablet"}`, which returns the device token once.

## Check it worked

List paired devices on the box:

```sh
curl -s http://127.0.0.1:7700/api/devices
```

You see one entry per phone, with its `id`, `name` and `pairedAt`. Tokens are never listed. After you approve
something from the phone, the task's log has an `approval.answered` event whose `by` is the phone's name.

## Remove a phone

In **Settings**, choose **Remove** next to the phone. Or use the API:

```sh
curl -s -X DELETE http://127.0.0.1:7700/api/devices/<device-id>
```

That phone's token stops working at once. Its next answer gets `401`, and the portal on the phone forgets the token.
Pair it again to get a new one.

## Limits

- The API listens on `127.0.0.1` unless you set `BOX_LISTEN`. A release build of the OS image has no shell to set it.
- A device token is checked only when a request sends one. Answers without a token are still accepted, so your
  network route is the access control.
- SpacetimeDB listens on port 3000 on every interface. Anyone who reaches it can call its `answer` reducer without a
  device token. Block port 3000 at your firewall if the box is on a network you do not control.
- Phones do not get push notifications. A request shows when the portal is open on the phone.

## Related

- [Approvals and budgets](/concepts/approvals-and-budgets/)
- [HTTP API](/reference/http-api/)
- [Live updates](/reference/live-updates/)
- [Trust boundaries](/security/trust-boundaries/)
