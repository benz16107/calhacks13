# Run your own relay, push gateway and web app

A GurtOS box works on its own at its home address, with no relay. A relay adds three things for boxes behind a home
router: a public address for each box (`https://rosa.box.example.com`), a gateway that forwards push notifications to
phones, and a place for a phone and a computer to meet while they pair.

A box looks for the relay at `box.gurtos.com` and the web app at `app.gurtos.com`. As of October 29, 2026 the hosted
relay is not running, so remote access and push work only through a relay you run. This page says how to run one and
point your boxes at it. `app.gurtos.com` is still up, but it can only reach boxes through the relay it was built for,
so a self-hosted setup needs its own copy of the web app too (step 4).

Read [`relay/README.md`](../relay/README.md) first for how the relay works and what it can and cannot see. This page is
the how-to. It was run end to end on an Ubuntu 24.04 virtual machine with a private certificate authority and a test
domain: a relay, a box, a phone pairing over the relay and a push reaching the phone. Node.js and Caddy were already
on that machine, so their download steps in `relay/deploy` were not exercised, although the pinned checksums were
checked.

## What you can and cannot self-host

| Piece | Self-hostable today | Notes |
|---|---|---|
| Relay: names, tunnels, certificates | Yes | `relay/deploy` installs it on one Ubuntu 24.04 machine |
| Web push to phones | Yes | The relay makes its own VAPID key on first start, and the web app fetches it from your relay |
| The web app (`portal/dist`) | Yes, with a rebuild | Our domains are written into the portal source in a few places (step 4) |
| The iPhone, Mac and Android apps | No, not without rebuilding them | They are built for `app.gurtos.com`, `box.gurtos.com` and our bundle ids and signing keys |
| Apple push (APNs) for the native apps | Only with your own Apple developer account | The relay needs your `apns.p8` key, and the apps would need your bundle ids |

If you only use the web app (add it to the home screen on a phone), everything on this page is enough. The native
apps stay tied to `gurtos.com` until you rebuild them from [`native/`](../native/) with your own domain, bundle ids
and Apple and Google credentials. The [roadmap](../ROADMAP.md) lists this under self-hosting.

## What you need

- One small Linux machine with a public IPv4 address that you can ssh into as root. Ubuntu 24.04, 1 vCPU and 1 GB of
  memory is enough. The relay listens on IPv4 only.
- A domain you control, and a name under it for the relay. These examples use `box.example.com`, so a box named
  `rosa` is reached at `rosa.box.example.com`.
- Inbound ports 80, 443 and 7000 open to the machine, in your cloud provider's firewall as well as on the machine.
  Port 7000 is where boxes connect their tunnels.
- `rsync` and `ssh` on the computer you deploy from. The relay machine needs `curl`, `openssl`, `tar` and `xz`, which
  Ubuntu 24.04 ships.
- Somewhere else to host static files for the web app, such as Vercel, Cloudflare Pages or any web server. Not the
  relay machine: its port 443 belongs to the relay, which hands every connection to a box by name.

## 1. DNS

Point the relay name and every name under it at the machine:

```
A   box.example.com      <relay's IPv4 address>
A   *.box.example.com    <relay's IPv4 address>
```

Both records are needed. The first serves the relay's own API, and the wildcard routes each box's name to its
tunnel. Use DNS only records. A proxy such as Cloudflare's orange cloud breaks the relay, which routes raw TLS by
name and takes raw TCP on port 7000. A 10-minute TTL is a good start.

## 2. Install the relay

From a checkout of this repository, with an ssh config entry named `relaybox` for the machine (root login):

```sh
RELAY_DOMAIN=box.example.com relay/deploy relaybox
```

The script is safe to run again. It installs frp 0.71.1 and Caddy 2.11.7 (checking their SHA-256 sums) and Node.js,
creates a CA for the tunnel and a key for push, and starts the relay as four systemd services. Keys, names and
certificates that already exist are kept. State lives in `/var/lib/gurtos-relay/` on the relay, readable only by the
relay's user. It opens ports 80, 443 and 7000 in `ufw` when `ufw` is installed.

Check it:

```sh
curl https://box.example.com/v1/status      # {"ok":true,"domain":"box.example.com","boxes":0}
curl https://box.example.com/v1/push/key    # the push public key
```

Caddy asks Let's Encrypt for the relay's certificate when it starts, which takes a few seconds. If `curl` fails with
"tlsv1 alert internal error", the certificate is not there yet. `journalctl -u gurtos-relay-caddy` on the relay says
why: a DNS record that has not spread, or a closed port 80 or 443, is the usual cause. Let's Encrypt allows 50 new
certificates a week for one registered domain, and every box gets its own, so that is the cap on new boxes per week.

### Changing the domain

Run `relay/deploy` again with the new `RELAY_DOMAIN`. It makes a new tunnel certificate for the new name. Boxes that
enrolled with the old domain must turn remote access off and on again.

### Trying it without a public certificate

`RELAY_ACME_CA=<ACME directory url>` makes the relay's own certificate come from another ACME server, such as Let's
Encrypt staging (`https://acme-staging-v02.api.letsencrypt.org/directory`) or a private CA in a test. A staging or
private certificate is not trusted by default. A box that uses such a relay needs `BOX_ACME_CA=<the same url>` for
its own certificate and `NODE_EXTRA_CA_CERTS=<root certificate file>` so it trusts the relay's API. Remove the
variable and deploy again to switch to a real certificate.

## 3. Point boxes at the relay

A box reads two environment variables, `BOX_RELAY` (the relay) and `BOX_APP` (the web app, which the box allows to
call its API and which its pairing links open). A box also needs `frpc` and `caddy` in `/usr/local/bin`, which
`core/setup.sh` and the GurtOS images install. Use the same frp version on the box and the relay (0.71.1). On an
installed GurtOS image, add the variables to the box service and restart it:

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
curl -s http://127.0.0.1:7700/api/remote     # "relay":"box.example.com"
```

A box built from this repository on your own machine can do the same with a drop-in file, or by exporting the two
variables before it starts. Then open Settings on the box and choose "Reach this box from anywhere", or ask for a
name from the box itself:

```sh
curl -s -X POST http://127.0.0.1:7700/api/remote -H 'content-type: application/json' -d '{"name":"rosa"}'
```

The box asks the relay for the name, the relay answers with a secret, and the box opens its tunnel and gets its
certificate. After a few seconds `https://rosa.box.example.com` answers from outside your network, and
`GET /api/remote` says `"state":"connected"`. A paired device's token is still required, exactly as on the home
network. A name is 3 to 30 lowercase letters, digits and hyphens, and a short list of names is reserved.

A box that already enrolled with another relay has a name and secret for that one. Turn remote access off and on
again to enroll with the new relay. A name that no tunnel has used for 30 days is free for anyone to take. If
someone takes the name of a box that was offline that long, the box can no longer log in, and the owner turns remote
access off and on to choose a name again.

## 4. Build and host the web app

The web app is `portal/dist`, plain static files. Our domains are written into the portal source. List them, then
change them to yours:

```sh
grep -rn "gurtos\.com" portal/src | grep -v "[0-9]: *\(//\|/\*\)"
```

Two lines in `portal/src/relay.ts` decide whether the app works, and every other mention in the portal follows them:

- `export const RELAY = 'https://box.gurtos.com'`: change it to your relay.
- `export const APP = 'https://app.gurtos.com'`: change it to your app's address. The app turns on its hosted mode (a
  list of machines, none of them this page's own address) only on that host, and accepts scanned pairing links only
  from it. Without the change your app behaves like a box's own screen and finds no machine.

Keep `SELF_HOST_DOCS`, which links to this page. Then build and publish:

```sh
npm ci
cd portal && npm ci && npm run build      # writes portal/dist
cd ..
RELAY_DOMAIN=box.example.com relay/deploy-app --out /tmp/gurtos-app
```

`relay/deploy-app --out` copies `portal/dist` and the headers file to the folder with your relay's domain in the
Content-Security-Policy, which is what lets the browser reach your relay and `https://*.box.example.com`. Host that
folder at `https://app.example.com` with the headers from its `vercel.json`. Every route must fall back to
`index.html` (the rewrite in the same file), because the app uses paths such as `/pair`.

On Vercel, `RELAY_DOMAIN=box.example.com VERCEL_PROJECT=my-app relay/deploy-app` does the same and deploys to your
project. It needs the Vercel CLI, logged in.

## 5. Push notifications

On the web, a phone subscribes to push once, from the web app, using the relay's public key
(`GET /v1/push/key`). The relay holds the private half in `/var/lib/gurtos-relay/vapid.pem`, made on first start.
The key is not in the web app's source.

- Back up `vapid.pem`. If you lose it, every phone has to subscribe again, because a subscription belongs to one
  key.
- A box sends an encrypted message to `POST /v1/push`; the relay signs it for Google's, Apple's, Mozilla's or
  Microsoft's push service and forwards it without reading it. The signature names a contact address for the push
  services, `https://<your relay domain>` unless you set `RELAY_CONTACT` (an `https:` or `mailto:` address) in the
  `gurtos-relay` service.
- A box sends an approval to the phones paired as its owner, and only while remote access is on.
- iPhone web push needs the web app added to the Home Screen and served over HTTPS, as the app is.

The native apps use Apple's push service instead. To run that yourself you need an Apple developer account, an APNs
key (`apns.p8`) and a file `apns.json` with `{"keyId": "...", "teamId": "..."}`, both in
`/var/lib/gurtos-relay/`, owned by the relay's user with mode 0600. The relay accepts only the GurtOS bundle ids
unless you set `RELAY_APNS_TOPICS` (comma separated bundle ids) in the `gurtos-relay` service, and you would also
rebuild the apps with your own ids and domain. Without the files, an APNs address returns
`503 APNs is not set up on this relay` and web push is unaffected.

## 6. Check the whole path

1. Open `https://app.example.com` on a phone and add it to the Home Screen.
2. Turn on "Reach this box from anywhere" on a box and wait for its address.
3. Pair the phone with the box from the box's own screen, as the owner.
4. Turn on notifications in the app and send the test push.
5. Start a task that asks for approval. The request should arrive as a push, and approving it on the phone should
   let the task carry on.

If step 2 fails, `journalctl -u box.service -n 50` on the box shows the relay's answer, and `journalctl -u gurtos-relay` on
the relay shows what it refused. The relay runs four services: `gurtos-relay`, `gurtos-frps`, `gurtos-relay-caddy` and
`gurtos-relay-frpc`. Port 7000 blocked on the box's network is the usual cause: the tunnel needs
outbound TCP 7000.

## Running and operating it

- **Update:** run `relay/deploy` again from a newer checkout. Names and keys are kept.
- **Back up** `/var/lib/gurtos-relay/` (names, push key, tunnel CA). The names file holds only hashes of the boxes'
  secrets.
- **Restart:** names, keys and certificates survive a restart. The rate limits and the short-lived pairing slots
  start empty. Restarting `gurtos-relay` drops a tunnel whose heartbeat falls in the gap, and the box reconnects by
  itself within a minute.
- **Logs:** the relay logs the name behind each refused login or route, and nothing else about boxes. `gurtos-frps`
  logs at `warn`, so caller addresses stay out of the journal. Raise `log.level` in `/etc/gurtos-relay/frps.toml` to
  `info` while debugging a first setup and restart `gurtos-frps`.
- **Limits:** one relay in one region, rate limits kept in memory, names released after 30 days unused. The full list
  is in `relay/README.md`.
- **Privacy:** you are the relay's operator, so you can see the same metadata we describe in `relay/README.md`:
  names, connection times, caller addresses and byte counts, but not the contents of anything.
- **Undo:** boxes stop using your relay by deleting the two `Environment=` lines and restarting `box.service`. Boxes
  keep working on their home network the whole time. To remove the relay machine's setup, stop and disable the four
  services and delete `/opt/gurtos-relay`, `/etc/gurtos-relay`, `/var/lib/gurtos-relay` and
  `/var/lib/gurtos-relay-caddy`.

## Known gaps

- The web app's relay address and its hosted-mode host are edited in source, not set by configuration.
- The native apps and APNs cannot be redirected without rebuilding them.
- There is no multi-relay or failover. If your relay is down, boxes are reachable on their home network only.
- This setup was run on one test domain with a private certificate authority. A run against Let's Encrypt on a public
  domain, and against a second operator's domain, has not been done.
