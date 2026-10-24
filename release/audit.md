# Public-readiness audit

Before `benz16107/calhacks13` goes public with its full history. Run by the release thread on Oct 24, 2026,
between 02:20 and 02:55 PT, against every ref in Ben's clone (which every working copy shares) and on GitHub.
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
   Ben's key file, the vaults of all four test VMs, the Fetch.ai agent seeds, the boxes' identity keys, both
   image update-signing keys, the Jira sync config, the CDP key file, the x402 wallet keys and Ben's account notes: 46 distinct values, each searched
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
real one. Box pairing codes live in memory for 5 minutes. The live Fetch.ai code on the always-on box is not in
history, any committed file, or any screenshot, and no ASI:One account has paired with it.

**To repeat right before the flip** (it takes about a minute):

```sh
gitleaks git --log-opts=--all --redact .
python3 -I release/scan-history.py . <the key file> <each vault.env copied from the test VMs> ...
node release/check.ts
```

## Private details in history, and what they expose

Per Ben's decision, history is not rewritten. Each kind of private detail was checked for what it gives
someone who reads it. The host-by-host results (open ports, login settings) are kept out of this file and are
closed before the repository goes public.

| Detail | In history | What it gives a reader |
|---|---|---|
| Ben's email | Author and committer of 127 commits (the other 93 are `t3code@users.noreply.github.com`), one spike script | An inbox. Git metadata shows it in any public repo |
| Machine names (the laptop, the Linux box, the Mac server, the test VMs) | The old CLAUDE.md, READMEs, scripts | Names on Ben's private network and in his SSH config. Reaching them takes his SSH keys or his tailnet login |
| A tailnet host name | Notes and two portal pairing screenshots | Nothing from GurtOS. Its only public service is an unrelated app behind a sign-in |
| Three test VMs' public addresses, one Vultr instance id | Jira track, Forge manifest, showcase, Personal README | Each VM was checked from the internet. The always-on test box exposes only the Jira routes, which refuse every call without the shared secret, and a read-only status route. Instance ids are useless without the Vultr API key, which was never committed |
| The Jira site name | Jira README, showcase, `docs/videos.md` | The site. Anonymous visitors see no projects and no issues |
| The Figma file key | `docs/figma.md` | Access follows the file's own sharing setting; Figma's API refuses it without a login |
| Mana share links, the Agentverse agent address, devnet wallet addresses | Showcase and track READMEs | Public by design |
| Internal operating notes | The old CLAUDE.md, `spikes/`, `docs/` | Process notes, no credentials |

## Where the code assumes Ben's setup

| Assumption | Where | Owner | Status |
|---|---|---|---|
| The screen greets "Ben" | `portal/src/home.tsx` (`const OWNER = 'Ben'`) and 12 screenshots | portal | Done (0f5fd1c): the owner's first name from `GET /api/owner` when core returns one, else no name |
| Test and deploy machines are Ben's | `demo`, `deploy` | core | Sent: machines come from an untracked file; with none, `--here` or `BOX_SHELL` |
| Builds go to Ben's Vultr box by default | `image/build` | image | Sent: build on this machine by default |
| The clock is Pacific time | `image/build` (pending commit) | image | Sent: default UTC |
| A Factory key is required | `core/box.ts`, `core/net.ts` | core | Sent: accept `ANTHROPIC_API_KEY` too (Droid tested with only an Anthropic key) |
| Every app starts on, even without keys; /find starts a Droid task at every boot | `core/box.ts` app loading | core, find | Sent: apps with missing keys start off |
| The Personal test VM is the default | `personal/vm.sh` | personal | Sent |
| The Forge app calls Ben's Vultr box | `tracks/jira/forge/manifest.yml`, `forge/src/resolvers/index.js` | jira | Sent: the box URL is a deploy-time setting, documented for people deploying their own Forge app |
| Image descriptions use Ollama on Ben's Mac | `tracks/find/find.ts`, `record.ts` | find | Sent: say "a machine running Ollama", configurable |
| Comments and READMEs name Ben's machines or key file | Apify, Elastic, Shopper, Wallet, find, Jira READMEs; `tracks/elastic/agent.ts`, `tracks/shopper/store.ts` | each track | Sent |
| Demo data names Ben as approver | `tracks/jira/demo.ts` ("Ben Zhou") | jira | Sent: a neutral name |
| BOX_PEERS, BOX_URL, BOX_OWNER | core | core | Fine: empty or unset by default, set per machine |
| Docs screenshots show a test machine's name as a box name | `site/src/assets/screens/box-*.png` | docs | Sent |
| Portal pairing screenshots show the tailnet name | `portal/screenshots/box-pair.png`, `laptop-pair.png` | portal | Done (717bc3f): retaken with a private-range address; `dev-box.sh` takes the VM and address as settings |
| The ISOs carry the whole checkout in /opt/box | `core/install.sh` | core | Sent (optional): copy only what the box runs |

## Licensing found on the way

- The images bundle Factory's **Droid CLI** binary (319 MB). Factory's EULA licenses it for internal use and
  its package says UNLICENSED, so the public ISOs must not include it. Sent to image and core: download it from
  Factory on first start, with the same pinned version and checksum. This blocks the release ISOs.
- SpacetimeDB is BSL 1.1 (redistribution allowed; one instance per box fits its use grant). Node.js is MIT. The
  npm dependencies are MIT, ISC, Apache-2.0 and BSD. The fonts are OFL. All are listed in `NOTICE`.
- The root `package.json` had no licence; it now says Apache-2.0.

## Before the flip

1. Merge the top-level public files (README, CONTRIBUTING, LICENSE, NOTICE, the public CLAUDE.md). The internal
   operations that were in CLAUDE.md now live outside git, so the threads that need them keep them.
2. Close what the host-by-host check found open on the test VMs.
3. Re-run the three scans above on the latest refs.
4. Right after the flip: turn on GitHub's private vulnerability reporting and secret scanning with push
   protection (Settings, Code security).
