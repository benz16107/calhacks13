# Public-readiness audit

Before `benz16107/calhacks13` goes public with its full history. Run by the release thread on Oct 24, 2026,
between 02:20 and 02:55 PT, against every ref on linuxbox's clone (which every T3 worktree shares) and on GitHub.
Threads keep committing, so the counts grow; re-run the scans right before the flip (below).

**Result: no real secret has ever been committed.** Nothing needs rotating and history does not need
rewriting. History does contain private details (machine names, three public IP addresses, Ben's email, the
Jira site name, a Vultr instance id). Per Ben's decision they stay; each was checked for what it exposes, and
the findings below say what to close before the flip.

## What was scanned

| | Count |
|---|---|
| Refs | 125: 24 local branches, 3 remote-tracking, 98 T3 checkpoint refs (`refs/t3/...`, local only, never pushed) |
| On GitHub | `main` and `credit-desk-data`. No tags. `git ls-remote origin 'refs/pull/*'` is empty and there are no pull requests |
| Commits | 239 reachable from all refs (231 without merges), by two authors |
| Blobs | 1,505 (every version of every file in every ref) |
| Screenshots | all 268 committed PNG and JPEG files, read with OCR |

Two scans over all of it:

1. **gitleaks 8.30.1** over `--all` (every ref, every commit, `git log -p`): 14 findings, all false positives:
   12 are idempotency keys in the docs' log-event examples (`site/src/content/docs/reference/log-events.md`,
   lines 91 and 108, six commits), 2 are the Figma file key in `docs/figma.md` (an id, not a credential: Figma's
   API answers 401 without a login).
2. **Every real secret value, searched for directly** (`release/scan-history.py`). The values came from
   linuxbox's `~/.config/calhacks13/env`, the vaults of all four test VMs (linuxbox VM, laptop VM, vultrbox,
   personalbox), the Fetch.ai agent seeds, the boxes' identity keys, both image update-signing keys, the Jira
   sync config, the CDP key file, the x402 wallet keys and Ben's account notes: 46 distinct values, each searched
   for in every blob and every commit message. Matches, none of them secret:

| Matched | Where | Why it is not a secret |
|---|---|---|
| `ATLASSIAN_SITE` | Jira README, showcase pages, `docs/videos.md` | The Jira site's name. Anonymous visitors see no projects and no issues there (`/rest/api/3/project` returns `[]`) |
| `ATLASSIAN_EMAIL` | `spikes/06-vision.sh` (history) | Ben's email, which is also the author email on 127 commits (below) |
| `SHOPPER_CARD` | Shopper track and its docs | `pm_card_visa`, Stripe's public test card token |
| Wallet and payee addresses | Wallet README, showcase, `docs/devpost.md` | Public Solana devnet addresses; the private keys never matched |
| A path from the account notes | Personal and Elastic READMEs | The text `~/.config/calhacks13/env`, a file path |

Also checked by hand: no `.env`, `vault.env`, `seed`, `*.key` or `devices.json` file was ever committed; the only
pairing codes in history are hand-made examples (`3f9a1c2e`, `7f3a9c21`, and `123456` for Fetch.ai), never a
real one. Box pairing codes live in memory for 5 minutes. The live Fetch.ai code on the linuxbox box is not in
history, any committed file, or any screenshot, and no ASI:One account has paired with it.

**To repeat right before the flip** (it takes about a minute):

```sh
gitleaks git --log-opts=--all --redact .
python3 -I release/scan-history.py . ~/.config/calhacks13/env <each vault.env copied from the test VMs> ...
node release/check.ts
```

## Private details in history, and what they expose

| Detail | In history | What it points to, checked Oct 24 | To do before the flip |
|---|---|---|---|
| Ben's email | Author and committer of 127 commits (the other 93 are `t3code@users.noreply.github.com`); `spikes/06-vision.sh` | An inbox. Git metadata shows it in any public repo | Nothing (needs a rewrite to change). Ben may want GitHub's "keep my email private" for future commits |
| Machine names: linuxbox, macserver, benmac, vultrbox, personalbox | CLAUDE.md, READMEs, scripts | Names on Ben's tailnet and in his SSH config. Reachable only with his SSH keys or tailnet login | None for security. Main is being cleaned so it reads well (below) |
| Tailnet name `linuxbox.tailb51682.ts.net` | 13 lines, plus two portal pairing screenshots | Tailnet-only ports, plus one Tailscale Funnel on the public internet that serves Ben's job tracker (sign-in required) and nothing from GurtOS | None for GurtOS |
| vultrbox, `45.32.140.213` and its `sslip.io` name | Jira track, Forge manifest, showcase | Public. SSH (keys only, no passwords), and Caddy on 80/443 exposing only `/t/jira/*` and `/t/mana/status`. Without the shared secret every Jira route returns 401 (checked `GET /task`, `POST /answer`, `POST /undo`). `/t/mana/status` is read-only by design (task titles, states, cost). Everything else is 404. Ports 3000, 7700 and 8888 are closed | Remove the leftover ufw rule `8080/tcp ALLOW` ("qa iso, temporary"; nothing listens on it) |
| personalbox, `140.82.51.9`, Vultr instance `55e7912b-...` | `personal/README.md` | Public. SSH allows **passwords** (root is key-only; the `mayachen` account has sudo and a 17-character password). SpacetimeDB port 3000 is open to the internet, and its `answer` reducer takes anonymous answers (QA P0-2) | Set `PasswordAuthentication no` and close 3000, or delete the VM, before the flip |
| Vultr instance ids | `personal/README.md` | Useless without the Vultr API key, which was never committed | None |
| Jira site name | Jira README, showcase, `docs/videos.md` | The site. Anonymous access shows nothing; the Forge app's secret was never committed | None |
| Figma file key | `docs/figma.md` | The design file. Access follows the file's own sharing setting | Ben: check the file's sharing is what you want |
| Mana share links, the Agentverse agent address | Showcase, Mana and Fetch.ai READMEs | Public by design | None |
| Internal operating notes | Old CLAUDE.md, `spikes/`, `docs/` | Process notes, no credentials | None |

**Not in history yet, but exposed now:** the QA thread's VM `calhacks13-qa` (`149.28.206.167`) listens on 7700
(the box API) and 3000 (SpacetimeDB) on the public internet, and its vault holds the real sponsor keys. Its API
still lists tasks without a token (QA P0-1 is half fixed there: `/api/log` now refuses). With QA P0-3 unfixed, a
stranger could read that vault. Its address is in the QA report, which is not committed yet. **Firewall 7700 and
3000 to linuxbox only, now, and keep its address out of the committed report.**

## Where the code assumes Ben's setup

| Assumption | Where | Owner | Status |
|---|---|---|---|
| The screen greets "Ben" | `portal/src/home.tsx` (`const OWNER = 'Ben'`) and 12 screenshots | portal | Sent: use the owner's name from `GET /api/owner`, else no name |
| Test and deploy machines are Ben's | `demo`, `deploy` (linuxbox, benmac, vultrbox) | core | Sent: machines come from an untracked file; with none, `--here` or `BOX_SHELL` |
| Builds go to `ssh vultrbox` by default | `image/build` | image | Sent: build on this machine by default |
| The clock is Pacific time | `image/build` (pending commit) | image | Sent: default UTC |
| A Factory key is required | `core/box.ts`, `core/net.ts` | core | Sent: accept `ANTHROPIC_API_KEY` too (Droid tested with only an Anthropic key) |
| Every app starts on, even without keys; /find starts a Droid task at every boot | `core/box.ts` app loading | core, find | Sent: apps with missing keys start off |
| The Personal test VM is the default | `personal/vm.sh` (`personalbox`) | personal | Sent |
| The Forge app calls Ben's Vultr box | `tracks/jira/forge/manifest.yml`, `forge/src/resolvers/index.js` | jira | To send: the box URL is a deploy-time setting, documented for people deploying their own Forge app |
| Image descriptions use Ollama on Ben's Mac | `tracks/find/find.ts`, `record.ts` | find | To send: say "a machine running Ollama", configurable |
| Comments and READMEs name linuxbox or Ben's env file | Apify, Elastic, Shopper, Wallet, find, Jira READMEs; `tracks/elastic/agent.ts`, `tracks/shopper/store.ts` | each track | To send |
| Demo data names Ben as approver | `tracks/jira/demo.ts` ("Ben Zhou") | jira | To send: a neutral name |
| BOX_PEERS, BOX_URL, BOX_OWNER | core | core | Fine: empty or unset by default, set per machine |
| Docs screenshots show `vultrbox` as a box name | `site/src/assets/screens/box-*.png` | docs | To send |
| Portal pairing screenshots show the tailnet name | `portal/screenshots/box-pair.png`, `laptop-pair.png` | portal | To send (the showcase already avoids them) |
| The ISOs carry the whole checkout in /opt/box | `core/install.sh` | core | Sent (optional): copy only what the box runs |

## Licensing found on the way

- The images bundle Factory's **Droid CLI** binary (319 MB). Factory's EULA licenses it for internal use and
  its package says UNLICENSED, so the public ISOs must not include it. Sent to image and core: download it from
  Factory on first start, with the same pinned version and checksum. This blocks the release ISOs.
- SpacetimeDB is BSL 1.1 (redistribution allowed; one instance per box fits its use grant). Node.js is MIT. The
  npm dependencies are MIT, ISC, Apache-2.0 and BSD. The fonts are OFL. All are listed in `NOTICE`.
- The root `package.json` had no licence; it now says Apache-2.0.

## Before the flip

1. Merge the top-level public files (README, CONTRIBUTING, LICENSE, NOTICE, the public CLAUDE.md). Ben's internal
   operations now live outside git (`~/.t3/worktrees/calhacks13/CLAUDE.md` and a git-ignored `CLAUDE.local.md` in
   the main checkout, on linuxbox and macserver), so threads keep them.
2. Close the QA VM's 7700 and 3000, personalbox's password logins and port 3000, and vultrbox's 8080 rule.
3. Re-run the three scans above on the latest refs.
4. Right after the flip: turn on GitHub's private vulnerability reporting and secret scanning with push
   protection (Settings, Code security).
