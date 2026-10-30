# try: the public live demo

A web page where anyone can try GurtOS without installing it. Every visitor gets a real, throwaway GurtOS box in the
browser: the real portal on a real box, with the same isolation `./demo` uses. They can start safe tasks, approve or
deny, undo, and pull the plug. They can also **attack it** with their own prompt-injection text or a prepared
booby-trapped page, and watch each defence stop it, in plain words, with the log lines.

**Scripted worker only. No model runs, and there are no real keys on the host.** The vault holds `demo-` placeholders
and the box's per-task tripwire decoys. Nothing a visitor does can reach a real box, the relay, or anything private.

**Status.** The demo ran at `try.gurtos.com` on a rented machine that was deleted after the Cal Hacks weekend, so
that address is offline. Running it again is one command on a fresh machine (see "Running it" below). It is not part
of an installed box.

## What a visitor sees

- A real GurtOS box, just theirs, served through the gateway. A top bar adds the controls they are allowed: a
  short task menu, "Attack it yourself", and "Pull the plug". An (i) button states, plainly, what is safe.
- **Start a task** from the menu (tidy a folder, summarize a page, a task that asks before it spends, a long job).
  The real portal shows the action log, the approvals inbox, and the diff. Undo is a visitor action.
- **Attack it yourself** (`/attack`): paste injection text, or pick a prepared page (a marketplace listing with a
  hidden block, a review with a hidden HTML comment, a review with invisible white-on-white text). GurtOS runs it
  in a real task and lists every defence that fired: the vault refused, the proxy blocked the host, the firewall
  dropped the around-the-proxy connection, the box's own controls were out of reach, the environment held only
  decoys, and the tripwire fired and undid the task. The attack cases are the project's own
  (`core/demo.ts` moment 2, `tracks/armadin`, `tracks/anthropic/attacks`).
- **Pull the plug** hard-kills the box and its tasks, then the box resumes from its action log (moment 4).

## How it is built

- `boxpool.ts` — one throwaway box per visitor: its own `BOX_HOME`, API, proxy and SpacetimeDB database, started
  exactly as `core/demo.ts` starts a demo box, with `BOX_NO_DROID=1` (scripted worker, no model spend). Also the
  fake "web" every task may reach (loopback), box teardown and the idle/age reaper.
- `menu.ts` — the safe task menu and the attack battery, as scripts for `core/workers/fake.ts`. The visitor never
  writes a script: the gateway picks a menu id or an attack, and the script is built here from constants. The only
  visitor text that reaches a box is the content of a web page a hijacked agent reads, never a shell command.
- `gateway.ts` — the one process a browser talks to. It maps a session cookie to a box, serves the real portal
  with a per-box paired token injected, and forwards a short whitelist of read/approve/undo routes to the box over
  loopback, always adding `X-Forwarded-For` so the box treats every visitor request as remote and demands that
  token. Task creation, the attack runs and the plug are the gateway's own endpoints over the box's control socket.
- `console.html` — the injected top bar and the attack overlay.
- `setup.sh` — provisions the host: Node, SpacetimeDB and Caddy (via `core/setup.sh`), the gateway service, Caddy
  for HTTPS, a firewall, and a 6-hour reset. It refuses to run if the host holds a non-demo key or is on a tailnet.
- `demo.ts` — a self-check and attack test, runnable on a test VM as root: `sudo node try/demo.ts`.

## Limits (all in `gateway.ts` and `boxpool.ts`)

- At most 5 boxes at once; past that, a "full, try again" page. Each browser session gets its own box; up to 10 new boxes an hour per IP (visitors on one network share an address).
- A box is destroyed after 20 minutes idle and after an hour at most. The host resets (wipes every box) every 6 hours.
- 100 requests a second and 20 attack runs an hour per IP. Request bodies are capped at 8 KB; pasted attack text at 4 KB.
- One attack at a time per box; a 30-second cooldown on pull-the-plug.
- Every box keeps core's own per-task caps: 2 GB of memory, two CPU cores, 512 processes, the seccomp filter, the
  per-uid network allowlist, and the tripwire.

## What stops the obvious abuse

| Abuse | What stops it |
|---|---|
| A shell through a task's script | The gateway writes every script; visitor text is only ever page content, shown as text. |
| An open proxy, or attacking other sites | A task reaches only the fake web (loopback). The host firewall drops traffic to the real boxes, the relay and every private range. |
| Reaching a real box, the relay, the tailnet | The host holds no keys and is not on the tailnet; the firewall drops those addresses. |
| One visitor reaching another's box | Separate cookie, port, token, Linux users and database. A box's token is rejected by any other box. |
| Exhausting memory or processes, a fork bomb | Core's per-task caps (2 GB, 512 procs), and the box count cap. |
| XSS from pasted text | The portal shows the log as text; the gateway sends a strict CSP; the fake web escapes the pasted text. |

## Honest gaps (shown on the attack page too)

- The defences are real OS controls, but the agent is **acted out** by a script, so this does not test whether
  Claude falls for the text. That is the point: the defences do not depend on the model refusing.
- **A disk fill** is stopped by GurtOS's disk watcher, not a hard quota. Every two seconds it measures each running
  task's own copy, and a task past its cap (200 MB here) is stopped and undone. A writer can pass the cap until the next
  check, and the attack page shows this defence too.
- The proxy checks which host a task may reach, not the body of an HTTPS request to a host it is allowed to reach.
  The tripwire still catches the decoy key in plain HTTP or any request the box can read.

## Running it

You need a fresh Ubuntu 24.04 machine used for nothing else, a domain name, and a checkout of this repository on the
machine. It must hold no real keys and must not be on a private network such as a tailnet: setup refuses if it finds
a non-demo value in `/etc/box/vault.env` or a running Tailscale. Make the machine's firewall (at your cloud
provider too) accept ports 80 and 443, and ssh on 22. Point the domain's `A` record at the machine first, because
Caddy asks for the certificate as soon as it starts. A box idles at about 100 to 200 MB of memory, and a task caps at 2 GB, so a machine with 4 GB of memory, 2 vCPUs and
20 GB of disk is a sensible start for the five-box limit.

```
git clone https://github.com/benz16107/gurtos.git && cd gurtos
sudo DOMAIN=try.example.com try/setup.sh
```

That is the whole install. It is safe to run again. In order, `try/setup.sh`:

1. Refuses to continue on a machine that holds real keys or is on a tailnet.
2. Installs Node, SpacetimeDB, Caddy and nftables through `core/setup.sh`, without the Droid worker, then the box's
   npm packages (`npm ci --omit=dev`).
3. Installs `try-gateway.service` (the one process a browser talks to) and `box-try-caddy.service` (HTTPS for
   `DOMAIN` to the gateway on `127.0.0.1:7788`, and it overwrites `X-Forwarded-For` so the per-IP limits cannot be
   spoofed).
4. Sets the firewall. Inbound is 80, 443 and ssh (`SSH_ALLOW=<cidr>` limits ssh). Outbound, the machine may not reach
   the private ranges, the cloud metadata address, or any host listed in `TRY_BLOCKED_IPS` (or one per line in
   `/etc/try/blocked-ips`). Its own DNS resolvers and DHCP server stay reachable.
5. Starts `try-reset.timer`, which restarts the gateway every 6 hours. A restart wipes every box.

Then open `https://DOMAIN/`. Logs are `journalctl -u try-gateway` and `journalctl -u box-try-caddy`. Each visitor's box
logs to `/var/lib/box-try/<id>/box.log` while it lives.

To run the self-check and attack test instead, on a test machine that holds no real keys and with the gateway not
running: `sudo node --experimental-strip-types try/demo.ts` (with `TRY_VAULT=<a demo-only file>` if the machine has a real vault). It starts two boxes, runs every defence, pulls a plug and
checks the reaper.

### Taking it down

The simplest way is to delete the machine. It holds nothing to keep. To keep the machine, run `sudo try/setup.sh remove`.
That stops the services, deletes their unit files, the firewall tables and `/var/lib/box-try`, and leaves Node,
SpacetimeDB, Caddy and the npm packages installed. It refuses to run on a machine that holds real keys, the same as setup.

### Notes

- The fake web that tasks may reach listens on `127.0.0.1:8080`. Do not run the relay (`relay/`) on the same machine,
  which uses that port too.
- `try/setup.sh` was reviewed and its firewall rules were loaded and exercised in an isolated network namespace, but
  the full script has not been run on a fresh public machine since the Cal Hacks weekend.
