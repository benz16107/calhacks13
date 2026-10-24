# The relay: a secure address for every box

The relay gives a GurtOS box an address like `https://rosa.box.gurtos.com` with no port forwarding at home, and
forwards push notifications to the GurtOS app on a phone. It runs on its own small machine with a public address,
not on a box. A box opts in from Settings ("Reach this box from anywhere"); nothing changes until the owner does.

```
phone ──TLS for rosa.box.gurtos.com──▶ relay :443 ──same bytes, by SNI──▶ tunnel ──▶ box: Caddy (TLS ends here) ──▶ box API
                                                   ▲
box ── outbound tunnel (frpc, TLS, pinned CA) ─────┘   :7000
```

## What runs where

On the relay (`relay/deploy`, Ubuntu 24.04):

| Piece | Does |
|---|---|
| `frps` (frp 0.71.1) | Holds ports 443, 80 and 7000. On 443 it reads only the name in the TLS hello (SNI) and passes the connection to that box's tunnel as bytes. On 80 it routes plain HTTP by `Host`, for each box's HTTP-01 certificate challenge and its redirect to HTTPS. On 7000 boxes connect their tunnels. |
| `server.ts` | Names, the frps plugin and the push gateway (below), on loopback only. Runs as its own user. |
| Caddy and a local frpc | Serve the relay's own API at `https://box.gurtos.com`, published through frps the same way a box publishes itself. |

On a box (`core/remote.ts`, started by the box when the owner turns it on):

| Piece | Does |
|---|---|
| `box-tunnel` (frpc) | One outbound TLS connection to the relay, verified against the relay's tunnel CA. Logs in with the box's name and secret. |
| `box-tls` (Caddy) | Listens on 127.0.0.1 only. Gets the box's own Let's Encrypt certificate (the challenge comes back through the tunnel), ends TLS, and proxies to the box's API. Every request through it carries `X-Forwarded-For`, so the box treats it as remote: a paired device's token is required, exactly as on the home network. |

Both helpers run as hardened transient systemd units (no capabilities, read-only system, writable only in
`BOX_HOME/remote/`, 256 MB). The box starts them at each boot while remote access is on.

## Why frp

The job is: many boxes behind home routers, each reachable by name on one public 443, with TLS ending on the box.
That needs an outbound tunnel per box and routing by SNI without decrypting.

- **frp** does both in one mature program (90k+ GitHub stars, releases since 2016): an `https` route is SNI
  passthrough on `vhostHTTPSPort`, an `http` route is Host routing on `vhostHTTPPort`, and its server plugin API
  asks us before every login, route and heartbeat. That plugin is how each box gets its own secret and may only
  route its own name. One process on the relay, one on the box.
- **rathole** is smaller and fast, but it has no SNI or Host routing and declares services in the server's config
  file. We would need HAProxy or Caddy layer4 in front for SNI, and to rewrite two config files on every
  enrollment. More moving parts for the same result.
- **Caddy layer4 or HAProxy** alone route by SNI but are not tunnels: they need the box reachable, which is the
  problem we are solving.
- **Hosted tunnels** (Cloudflare Tunnel, ngrok) end TLS on their own servers, so they could read the traffic.

Caddy on the box is the certificate client because it gets and renews Let's Encrypt certificates by itself and
answers both HTTP-01 and TLS-ALPN-01 through the tunnel.

## The API

`https://box.gurtos.com`:

| Request | Does |
|---|---|
| `GET /v1/names/<name>` | `{name, available, reason?}`. 60 a minute per address. |
| `POST /v1/names {name}` | Enroll. Returns `{name, host, secret, tunnel: {host, port, serverName, ca}}`. 5 an hour per address, 200 an hour in all. The relay keeps only a SHA-256 hash of the secret. |
| `DELETE /v1/names/<name>` | Release, with `Authorization: Bearer <name>.<secret>`. The tunnel is cut at its next heartbeat. |
| `GET /v1/tunnel` | The tunnel's address and the CA the box pins for it. Fetched over HTTPS (Let's Encrypt), so a box on a hostile network can't be pointed at a fake relay. |
| `GET /v1/push/key` | The app's VAPID public key, for `pushManager.subscribe()`. |
| `POST /v1/push` | Forward one push: `{endpoint, payload, ttl?, urgency?, topic?}` with the box's `Bearer <name>.<secret>`. 600 an hour per box. |
| `GET /v1/status` | `{ok, domain, boxes}` (a count, never the names). |

**Names:** lowercase letters, digits and hyphens, 3 to 30 characters, no leading, trailing or double hyphen
(which also blocks `xn--` look-alikes), and a reserved list (`www`, `app`, `api`, `relay`, `admin`, `calhacks`,
`login`, `pay`, and others in `server.ts`). A name nobody has connected with for 30 days is free again, so a box
that was wiped without turning remote access off doesn't hold its name forever.

## The frps plugin

frps asks `server.ts` before each `Login`, `NewProxy` and `Ping` (heartbeat, every 30 s). It allows:

- a login only with a known name and that name's secret (constant-time compare), at most 30 a minute per box;
- an `https` or `http` route only for exactly `<name>.box.gurtos.com`: no other domains, no raw TCP or UDP ports,
  no subdomains of other names. The relay, not the box, sets a 4 MB/s bandwidth limit per route;
- a heartbeat only while the name is still enrolled, so releasing a name cuts its tunnel within 30 s.

## The push gateway

A web push subscription belongs to one site and one VAPID key. The GurtOS app (app.gurtos.com) subscribes once,
with the key whose private half is on the relay, and hands that subscription to every box it pairs with. To send:

1. The box builds the message (`core/push.ts`) and signs it with an HMAC key the app made for that box alone
   (`mac`), so a second box that shares the subscription can't pose as the first.
2. It encrypts the message for the phone with RFC 8291 (aes128gcm), using the subscription's own keys.
3. It posts the ciphertext to `/v1/push` with its secret. The gateway checks the endpoint is a real push service
   (Google, Apple, Mozilla, Microsoft), signs a VAPID JWT for it, and forwards the bytes unchanged.

### The native apps (APNs)

The GurtOS iPhone and Mac apps (`native/`) can't use web push, so they subscribe with an address on the relay,
`https://box.gurtos.com/v1/apns/<app>/<production|sandbox>/<device token>`, and the same keys and per-box `mac` key
as the web app. A box needs no change: it encrypts for that subscription and posts it to `/v1/push` as always. The
gateway accepts only the two GurtOS apps (`com.benzhou.gurtos`, `com.benzhou.gurtos.mac`) and a hex token, and sends
Apple `{"aps": {"alert": {"title": "GurtOS", "body": "A request needs you"}, "mutable-content": 1}, "e": "<ciphertext>"}`.
The app's notification service extension decrypts `e`, checks the `mac`, and only then shows the machine's name and
the question. A token Apple no longer knows comes back as `gone: true`.

The APNs key is Ben's (developer.apple.com, Keys, Apple Push Notifications service). On the relay it is
`apns.p8` and `apns.json` (`{"keyId": "...", "teamId": "..."}`) in the state folder, owned by the relay's user, 0600,
never in git. Without them an APNs address gets `503 APNs is not set up on this relay`; web push is unchanged.

## What the relay can and can't see

It **can** see: which names exist; when each box's tunnel connects and from which address; for each connection
to a box, the caller's IP address, the time, the name asked for (SNI) and how many bytes went each way; the
plain-HTTP requests on port 80 (certificate challenges and redirects, nothing else is served there); and for each
push, the push service endpoint (for a native app: the app and its APNs device token), the time and the size.

It **can't** see: anything inside a box's HTTPS connections (pages, API calls, pairing codes, device tokens,
approvals, files), because TLS ends on the box with a key that never leaves it; or what a push says, because the
box encrypts it for the phone before it reaches the gateway.

What someone who controlled the relay **could** do, and what limits it:

- **Get a certificate for a box's name.** The relay answers for every name under `box.gurtos.com`, so it could
  route a name to itself and pass Let's Encrypt's challenge. Every certificate issued is published in public
  Certificate Transparency logs (crt.sh), where a second certificate for a box's name would show. Even then it
  would still need a device's token to do anything with the box: pairing codes come only from the box's own
  screen.
- **Drop or delay** connections and pushes. A box on the home network is still reachable at its local address.
- **Send pushes that look like a box's.** It holds the VAPID key, but it does not have the subscription's
  encryption keys or a box's `mac` key, so the app drops anything it makes.
- **Read a box's relay secret** only as a hash. A stolen secret lets someone take over that name's routing (see
  the first point); turning remote access off and on again issues a new one.

## Run and test

```
relay/deploy <ssh-host>           # install or update on the relay machine, over ssh as root
npm test                          # includes relay/server.test.ts and core/push.test.ts
./demo                            # relay/demo.ts: the protocol and push payloads, offline
DEMO_LIVE=remote ./demo           # plus the real relay: a real name, certificate and push, then released
```

`relay/testphone.ts` is a stand-in phone for the live test: a real subscription at Mozilla's push service, made
by speaking its WebSocket protocol, which decrypts what arrives.

## Limits

- One relay, in one region (San Jose). If it is down, boxes are reachable only on their home network.
- Every box's certificate comes from Let's Encrypt under `gurtos.com`, which allows 50 new certificates a week for
  the whole domain. Renewals don't count. Turning remote access off keeps the box's certificate, so turning the
  same name back on reuses it.
- The tunnel uses TCP port 7000 outbound. A network that allows only 80 and 443 out blocks it.
- Names are first come, first served. There is no account behind a name, only the box's secret.
- The rate limits are kept in memory and reset when the relay restarts.
