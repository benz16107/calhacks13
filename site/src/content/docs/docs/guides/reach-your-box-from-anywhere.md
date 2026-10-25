---
title: Reach your box from anywhere
description: Give your box its own https address through the GurtOS relay, then use the GurtOS app on your phone or computer, with push notifications for approvals.
sidebar:
  badge:
    text: Preview
    variant: note
---

By default a box is reachable only on your home network. Remote access gives it an address such as
`https://rosa.box.gurtos.com`, with no port forwarding on your router, and lets the GurtOS app on your phone reach it
from anywhere. It is off until the owner turns it on.

:::note[Preview]
Remote access, the GurtOS app and push notifications are new. The relay is one machine in one region. If it is down,
your box still works on your home network.
:::

## How it works

- The box opens **one outbound tunnel** to the GurtOS relay. Nothing is forwarded to your box from the internet.
- The box gets **its own Let's Encrypt certificate** for `<name>.box.gurtos.com`. TLS ends on the box, so the relay
  passes encrypted bytes it cannot read. See [what the relay can and cannot see](/docs/security/model/#12-remote-access-through-the-relay).
- A request through that address looks like any other off-box request: it needs a **paired device's token**. The
  address makes your box reachable. It does not let anyone in.

## Before you start

- A running box, and you are its owner: use the box's own screen, or a phone paired as the owner.
- Outbound TCP port 7000 open from the box, as well as 80 and 443. A network that allows only 80 and 443 out blocks
  the tunnel.

## Turn it on

1. On the box's own screen, open **Settings**, then **Remote access**. (It is also an optional step in first-run
   setup. On GurtOS Personal, open GurtOS Settings.)
2. Choose a name. Names are lowercase letters, digits and hyphens, 3 to 30 characters, with no hyphen at the start,
   the end or doubled. Some names are reserved. The screen tells you if a name is taken. Names go to whoever asks
   first.
3. Choose **Turn on**. The state goes from starting to **Connected** in 5 to 60 seconds, while the box gets its
   certificate.

The box's address is now `https://<name>.box.gurtos.com`, for example `https://rosa.box.gurtos.com`. Pairing QR codes
now open `https://app.gurtos.com/pair?box=rosa.box.gurtos.com#<code>`.

To turn it off, choose **Turn off** in the same place. The box releases its name and closes the tunnel. Turning it
off and on again also issues a new relay secret.

## The GurtOS app

`app.gurtos.com` is one installable web app for every machine you pair: GurtOS Server, GurtOS Personal and, when it
exists, GurtOS Business. It has a machine switcher. On a phone it shows the phone layout. In a computer's browser it
shows the full desktop. Each box still serves its own copy at its own address, and the box's local portal
(`http://<box address>:7700`) keeps working on your home network.

Every phone still needs a pairing code from the box's screen. See [Approve from your phone](/docs/guides/approve-from-your-phone/).

### iPhone

A Home Screen app has its own storage, separate from Safari, so a pairing done in Safari does not carry over.

1. Open the pairing link in **Safari**.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Open **GurtOS** from the Home Screen. Type the box's address (`rosa.box.gurtos.com`) and the pairing code.
4. Open **Settings**, **Devices**, then **Turn on notifications**.

### Android

1. Open the pairing link in **Chrome** and pair.
2. Choose **Install** when Chrome offers it, or **Install app** in its menu.
3. Open **Settings**, **Devices**, then **Turn on notifications**.

### A computer

Open the pairing link in any browser. The app shows the full desktop.

## Notifications

When a task asks for your OK, the box pushes it to the phones that should answer. On GurtOS Server and GurtOS
Personal, those are phones paired as the owner. On GurtOS Business, planned, they are the people the approval's
policy routes to.

- **Android** shows **Approve** and **Deny** on the notification.
- **iPhone** shows the request. Tap it to open the request in the app.
- **Shopper purchases** offer **Deny** only. Approving a purchase needs Face ID in the app.
- **Quiet hours** (Settings) hold pushes back. The request still waits in the inbox.

Pushes need remote access on, because they go through the relay's push gateway. The box encrypts each push for your
phone before it leaves, so the gateway forwards bytes it cannot read.

## Check it worked

- **Settings**, **Remote access** shows **Connected** and your address.
- `https://<name>.box.gurtos.com/api/health` answers `{"ok":true,...}` from any network.
- On a phone, **Settings**, **Devices**, **Turn on notifications**, then **Send a test**. A test notification arrives.

## Limits

- One relay, in San Jose. Names are first come, first served, with no account behind them: the box's secret is all
  that holds a name. A name nobody has connected with for 30 days is free again.
- New certificates come from Let's Encrypt, which allows 50 a week for all of `gurtos.com`. Turning remote access off
  keeps the box's certificate, so turning the same name back on reuses it.
- Each box's tunnel is limited to 4 MB/s, and a box may send 600 pushes an hour.
- Boxes behind a network that blocks outbound port 7000 cannot connect.

## Related

- [Run your own relay, push gateway and web app](/docs/guides/self-host/)
- [Approve from your phone](/docs/guides/approve-from-your-phone/)
- [Security model](/docs/security/model/)
- [Threat model](/docs/security/threat-model/)
- [HTTP API](/docs/reference/http-api/)
