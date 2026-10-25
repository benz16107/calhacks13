# try: the public live demo (try.gurtos.com)

Most sponsors judge from Devpost, so this puts GurtOS in a judge's hands. Every visitor gets a real, throwaway
GurtOS box in the browser: the real portal on a real box, the same isolation `./demo` uses. They can start safe
tasks, approve or deny, undo, and pull the plug. They can also **attack it** with their own prompt-injection text
or a prepared booby-trapped page, and watch each defence stop it, in plain words, with the log lines.

**Scripted worker only. No model runs, and there are no real keys on the host.** The vault holds `demo-` placeholders
and the box's per-task tripwire decoys. Nothing a visitor does can reach a real box, the relay, or anything private.

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

- At most 5 boxes at once; past that, a "full, try again" page. One live box per IP; 3 new boxes an hour per IP.
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
- **A disk fill** has no per-task quota in GurtOS yet. A visitor can't reach it here (fixed scripts, tiny files,
  scheduled wipe), but a real box could still be filled.
- The proxy checks which host a task may reach, not the body of an HTTPS request to a host it is allowed to reach.
  The tripwire still catches the decoy key in plain HTTP or any request the box can read.

## Running it

```
sudo DOMAIN=try.gurtos.com try/setup.sh    # on a fresh Ubuntu 24.04 host with no real keys
sudo node --experimental-strip-types try/demo.ts   # the self-check and attack test, on a test VM
```

Delete the host after judging. It holds nothing to keep.
