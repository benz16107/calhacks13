---
title: Run your own relay, push gateway and web app
description: Self-host the GurtOS relay, push gateway and web app on your own domain, point boxes at them with BOX_RELAY and BOX_APP, and see what stays tied to gurtos.com.
sidebar:
  label: Self-host the relay and web app
  badge:
    text: Preview
    variant: note
---

A GurtOS box works on its own at its home address. The relay adds three things for boxes behind a home router:
a public address for each box (`https://rosa.box.example.com`), a gateway that forwards push notifications to
phones, and a place for a phone and a computer to meet while they pair. By default a box uses ours, at
`box.gurtos.com`, and the web app lives at `app.gurtos.com`. This page says how to run all three yourself and point
your boxes at them.

See [Reach your box from anywhere](/docs/guides/reach-your-box-from-anywhere/) for what remote access does, and read [`relay/README.md`](https://github.com/benz16107/calhacks13/blob/main/relay/README.md) for how the relay works and what it can and cannot see. This
page is the how-to.

## What you can and cannot self-host

| Piece | Self-hostable today | Notes |
|---|---|---|
| Relay: names, tunnels, certificates | Yes | `relay/deploy` installs it on one Ubuntu 24.04 machine |
| Web push to phones | Yes | The relay makes its own VAPID key on first start |
| The web app (`portal/dist`) | Yes, with a rebuild | The relay address is written into the source in two places (below) |
| The iPhone, Mac and Android apps | No, not without rebuilding them | They are built for `app.gurtos.com`, `box.gurtos.com` and our bundle ids and signing keys |
| Apple push (APNs) for the native apps | Only with your own Apple developer account | The relay needs your `apns.p8` key, and the apps would need your bundle ids |

If you only use the web app (add it to the home screen on a phone), everything on this page is enough. The native
apps stay tied to `gurtos.com` until you rebuild them from [`native/`](https://github.com/benz16107/calhacks13/tree/main/native) with your own domain, bundle ids
and Apple and Google credentials. That is on the [roadmap](https://github.com/benz16107/calhacks13/blob/main/ROADMAP.md) under self-hosting.

## What you need

- One small Linux machine with a public IPv4 address that you can ssh into as root. Ubuntu 24.04, 1 vCPU and 1 GB
  of memory is enough (ours is a 1 vCPU, 1 GB cloud machine).
- A domain you control, and a name under it for the relay. These examples use `box.example.com`, so a box named
  `rosa` is reached at `rosa.box.example.com`.
- Inbound ports 80, 443 and 7000 open to the machine. Port 7000 is where boxes connect their tunnels.
- Somewhere to host static files for the web app, such as Vercel, Cloudflare Pages or the same Caddy.

## 1. DNS

Point the relay name and every name under it at the machine:

```
A   box.example.com      <relay's IPv4 address>
A   *.box.example.com    <relay's IPv4 address>
```

Both records are needed. The first serves the relay's own API, and the wildcard routes each box's name to its
tunnel. A 10-minute TTL is a good start.

## 2. Install the relay

From a checkout of this repository, with an ssh config entry named `relaybox` for the machine:

```sh
RELAY_DOMAIN=box.example.com relay/deploy relaybox
```

The script is safe to run again. It installs frp 0.71.1 and Caddy 2.11.7 (checking their SHA-256 sums) and Node.js,
creates a CA for the tunnel and a key for push, and starts the relay as systemd services. Keys, names and
certificates that already exist are kept. State lives in `/var/lib/gurtos-relay/` on the relay, root only.

Check it:

```sh
curl https://box.example.com/v1/status      # {"ok":true,"domain":"box.example.com","boxes":0}
curl https://box.example.com/v1/push/key    # the push public key
```

The first request to `box.example.com` makes Caddy ask Let's Encrypt for its certificate, so give it a few seconds.
Let's Encrypt allows 50 new certificates a week for one registered domain. Every box gets its own certificate, so
that is the cap on new boxes per week.

## 3. Point boxes at the relay

A box reads two environment variables, `BOX_RELAY` (the relay) and `BOX_APP` (the web app, which the box allows to
call its API). On an installed GurtOS image, add them to the box service and restart it:

```sh
sudo systemctl edit box.service
```

```ini
[Service]
Environment=BOX_RELAY=https://box.example.com
Environment=BOX_APP=https://app.example.com
```

```sh
sudo systemctl restart box.service
```

A box built from this repository on your own machine can do the same with a drop-in file, or by exporting the two
variables before it starts. Then open Settings on the box and choose "Reach this box from anywhere". The box asks
the relay for a name, the relay answers with a secret, and the box opens its tunnel and gets its certificate.
After a minute `https://<name>.box.example.com` answers from outside your network. A paired device's token is
still required, exactly as on the home network.

A box that already enrolled with another relay has a name and secret for that one. Turn remote access off and on
again to enroll with the new relay.

## 4. Build and host the web app

The web app is `portal/dist`, plain static files. Two places in the source name our relay and need to change
before you build:

- `portal/src/shell.tsx` and `portal/src/apps/quickstart.tsx` each have `const RV = 'https://box.gurtos.com/v1/rv'`
  (or `RELAY`). Change the host to your relay.
- `relay/app/vercel.json` carries a Content-Security-Policy that allows `https://box.gurtos.com` and
  `https://*.box.gurtos.com`. Change those to your relay's domain, or the browser blocks the app from reaching
  your boxes.

Then build and publish:

```sh
npm ci
npm run build --workspace portal          # writes portal/dist
```

Host the contents of `portal/dist` at `https://app.example.com` with the headers from `relay/app/vercel.json`.
`relay/deploy-app` does this for us on Vercel (project `gurtos-app`); copy it and change the project name, or
upload `portal/dist` and the same headers to your host. Every route must fall back to `index.html` (the rewrite in
`vercel.json`), because the app uses paths such as `/pair`.

## 5. Push notifications

On the web, a phone subscribes to push once, from the web app, using the relay's public key
(`GET /v1/push/key`). The relay holds the private half in `/var/lib/gurtos-relay/vapid.pem`, made on first start.

- Back up `vapid.pem`. If you lose it, every phone has to subscribe again, because a subscription belongs to one
  key.
- A box sends an encrypted message to `POST /v1/push`; the relay signs it for Google's, Apple's, Mozilla's or
  Microsoft's push service and forwards it without reading it.
- iPhone web push needs the web app added to the Home Screen and served over HTTPS, as the app is.

The native apps use Apple's push service instead. To run that yourself you need an Apple developer account, an APNs
key (`apns.p8`) and a file `apns.json` with `{"keyId": "...", "teamId": "..."}`, both in
`/var/lib/gurtos-relay/`, owned by the relay's user with mode 0600. The relay accepts only the two bundle ids
written in `relay/server.ts`, so you would also change those and rebuild the apps. Without the files, an APNs
address returns `503 APNs is not set up on this relay` and web push is unaffected.

## 6. Check the whole path

1. Open `https://app.example.com` on a phone and add it to the Home Screen.
2. Turn on "Reach this box from anywhere" on a box and wait for its address.
3. Pair the phone with the box from the box's own screen.
4. Start a task that asks for approval. The request should arrive as a push, and approving it on the phone should
   let the task carry on.

If step 2 fails, `journalctl -u box.service -n 50` on the box shows the relay's answer, and `journalctl -u gurtos-relay` on
the relay shows what it refused. The relay runs four services: `gurtos-relay`, `gurtos-frps`, `gurtos-relay-caddy` and
`gurtos-relay-frpc`. Port 7000 blocked on the box's network is the usual cause: the tunnel needs
outbound TCP 7000.

## Running and operating it

- **Update:** run `relay/deploy` again from a newer checkout. Names and keys are kept.
- **Back up** `/var/lib/gurtos-relay/` (names, push key, tunnel CA). The names file holds only hashes of the boxes'
  secrets.
- **Limits:** one relay in one region, rate limits kept in memory, names released after 30 days unused. The full list
  is in `relay/README.md`.
- **Privacy:** you are the relay's operator, so you can see the same metadata we describe in `relay/README.md`:
  names, connection times, caller addresses and byte counts, but not the contents of anything.
- **Undo:** boxes go back to our relay by deleting the two `Environment=` lines and restarting `box.service`.
  Boxes keep working on their home network the whole time.

## Known gaps

- The web app's relay address is edited in source, not set by configuration.
- The native apps and APNs cannot be redirected without rebuilding them.
- There is no multi-relay or failover. If your relay is down, boxes are reachable on their home network only.
- We have run this setup ourselves with one domain. A second operator's setup has not been tested end to end.
