# GurtOS QA report

Run by the QA thread. A judge's and a first-time user's walk through GurtOS, from a fresh install on Vultr to every
app, with what broke. Times are PT (Pacific), Friday night Oct 23 into Saturday Oct 24. Screenshots are in
`shots/`.

**Severity.** P0 breaks the demo or is a security problem. P1 a judge would notice. P2 polish.

**Conditions during the run, not product bugs.** Factory (every Droid task) was at 82% of its 5-hour limit until
11:45 PM PT, so before then the walk used the scripted worker and real Droid only where a flow needs it. Moss's cloud
quota was used up; /find searched locally and the find thread is fixing the sync.

## Machines

The QA run used three Vultr instances labelled `calhacks13-qa` (the debug ISO, then main's core on top, with test keys
in its vault and its box ports open only to linuxbox), `calhacks13-qa-release` (the 00:44 PT release ISO) and a first
release install that was deleted at 22:54 PT. Their IDs and addresses are kept out of this repo, in
`~/.config/calhacks13/qa-instances.md` on linuxbox. **Delete them and their custom ISOs after Sunday Oct 25.**

## Summary

Status at 01:02 PT Saturday. **8 P0 found, all 8 fixed and verified.** 20 P1 and 18 P2 found in the product, plus 7 in
the docs site and 9 in the showcase. The four moments, Shopper, the wallet, the credit desk and a phone paired over the
network all work on main as of 717bc3f.

| Finding | Status | Where |
|---|---|---|
| P0-1 no token needed from another machine | Fixed, verified 23:30 | core c6f747e |
| P0-2 anonymous SpacetimeDB answers, port 3000 open | Fixed, verified 23:48 and on the 00:44 release ISO | core 6879fb9, image 881318a |
| P0-3 a folder task reads the vault | Fixed, verified 23:31 | core c6f747e |
| P0-4 double tap approves an unseen request | Fixed, verified 00:09 (two taps 0.4 s apart approve one) | portal 3b802b9 |
| P0-5 paired phone loses live updates and apps | Fixed, verified 23:42 | portal 3ae539b |
| P0-6 Caddy-relayed track routes get 401 | Fixed, verified 23:47 | core 6879fb9 |
| P0-7 one task reads another task's folder copy | Fixed, verified 00:12 (copy is 0600 and owned by its task) | core bb0ccde |
| P0-8 scanning the pairing QR doesn't pair | Fixed, verified 00:53: `/pair#<code>` and `/#pair/<code>` fill the code on a fresh iPhone-UA phone, and one tap pairs (shot 78) | portal d64cb80 |
| P1-1 undo leaves files on disk | Fixed, verified | core c6f747e |
| P1-2 direct connections not logged | Fixed, verified 00:12 (1.1.1.1 and 169.254.169.254 logged) | core bb0ccde |
| P1-4 stale release ISO, no firewall | Fixed, verified 00:02: GurtOS, Pacific time, 3000 and 7700 closed to the internet | image 881318a |
| P1-5 greeting "Ben", UTC clock | Clock fixed on the release ISO; greeting fixed in portal (not on that ISO) | image, portal |
| P1-6 no way to start a task | Fixed, verified: "Ask the box" on a phone started a real Droid task (2 cents) | portal 3b802b9 |
| P1-8 phone doesn't notice an outage | Fixed, verified: red bar, Approve and Deny disabled | portal 3b802b9 |
| P1-9 notices hide a waiting request | Fixed, verified: the phone home lists every waiting request first | portal 3b802b9 |
| P1-10 credit desk and /find have no page | Credit desk fixed, verified: quick run on a phone, fraud hold approved as "controller (Judge's iPhone)". /find still has none | credit desk 7cdd64e |
| P1-11 supplies form pays the budget | Fixed, verified: pauses at "$0.03 on a $0.02 budget", then pays | shopper b842425 |
| P2-1 the losing phone gets no word | Fixed, verified 00:29: "Already approved on Judge's iPhone" (shot 76) | portal |
| Unpaired phone sees everything | Fixed, verified: "Pair this phone first", no tasks shown | portal |
| P1-3 /find starts a Droid task at boot | Fixed, verified 00:33: no describe task on restart | find 7663eb4, 4351905 |
| P1-10 (credit desk half) | Also verified on a phone paired over the network at 00:10 (shots 67 to 69) | credit desk 7cdd64e |
| P1-10 (find half) no /find page | Fixed, verified: "whiteboard photo" on a phone finds photos/IMG_2041.jpg (shot 77) | find 76ff3f8 |
| P1-14 budget and hosts not validated | Fixed, verified: -5, "abc", 0.5, 1e15, "*", "*.*", CIDRs and the box's own port refused with clear messages | core 5942002 |
| P2-15 no size limits, raw JSON errors | Fixed, verified: 200-character titles, 100,000-character prompts, "the request body isn't valid JSON" | core 5942002 |
| P2-16 a restart announced as a power cut | Fixed, verified: /api/health says cleanStart true after a clean restart; the portal says "Back after a restart" | core 5942002, portal 717bc3f |
| P2-9 undo doesn't say it refunds | Fixed, verified: "Undo and refund (test)" | portal 717bc3f, shopper |
| P2-14 "Box" names | Store, Mana app and Jira panel renamed ("GurtOS agent task", Forge v3); Elastic agent is "GurtOS log" (id gurtos-log), checked through the Kibana API at 00:48 | tracks |
| P2-13 Elastic index mixes test boxes | Fixed, verified 00:48: 505 documents from installed boxes plus one demo run kept for screenshots (a18523); no dev boxes; the agent filters to installed boxes by default | elastic ca03219, portal 717bc3f |
| P2-11 wallet page shows only the balance | Fixed, verified 01:00: "TEST MONEY" once, balance, then a Payments table with time, amount, payee, task and transaction | wallet fb51e47 |
| Wallet approvals don't name the payee | Fixed, verified: "Spend $0.03 to 39w7... on wallet.pay (.../report in devnet USDC (test money))? Budget $0.02" | wallet fb51e47 |
| Showcase S-2, S-3, S-5, S-6, S-7 | Fixed, rechecked 01:00 on all 22 pages; only /tracks/elastic/ still says "Box log" (now "GurtOS log") | showcase ab8e509 |
| Showcase S-1 GitHub links 404 | **Ben's call**: the repo is still private at 01:00 PT | Ben |
| Stage log Devpost paragraphs | **Open**: say handoff 4 and code generation 127 min; the table sums to 19 and 137 | figma |
| Jira through Caddy after the token gate | Fixed. The Jira thread checked Approve and Roll back from the real panel on BOX-14 through Caddy. QA confirmed from outside at 00:45: /t/jira/task 401 without the secret, /t/mana/status 200, everything else 404 | core 6879fb9, jira c82fcdb |
| D-1 to D-4, D-6, D-7 docs | Fixed, live. D-6 spot-checked 00:52: the Elastic, Jira and Shopper guides say GurtOS log (gurtos-log), GurtOS agent task and GurtOS Test Store, with no "Box" names left | docs 199dce5, 9cc7d92 |
| P1-7 live banner names the wrong hosts | Fixed, verified 00:54 on a phone off the box: the first banner text is "Find me a road bike (live banner 2) tried to reach attacker.example. It may only reach shop.localhost:8123." (shot 79) | portal d64cb80 |
| P2-18 phone tasks logged as "api" | Fixed, verified: "Ask the box" on a phone logs the device name as source | portal d64cb80 |
| Open P1s | P1-12 ASI:One not paired; P1-13 real agent probes the proxy in moment 2; D-5; showcase S-1 to S-6 | |

**Not re-tested yet:** P2-6, P2-7, P2-8, P2-10 (portal says fixed), and the installed boxes. **At 00:40:** Vultr runs current main (the public Mana app answers 200; Jira's route
refuses calls without its secret), linuxbox runs main as of bb0ccde (has the P0-7 fix), and **the laptop, Sunday's
demo box, still runs code from before c6f747e** (no tokens, the old UI). Core was asked to deploy it.

## Findings

### P0

**P0-1. Without a token, anyone who can reach the API can approve, start, undo and pair.** Owner: core.
- Steps: on a box reachable from another machine (BOX_LISTEN=0.0.0.0, a port forward or a funnel), from that
  machine with no Authorization header: `GET /api/log`, `POST /api/tasks`, `POST /api/approvals/<id>
  {"approved":true,"by":"Ben's iPhone"}`, `POST /api/tasks/<id>/undo`, `POST /api/pair/start` then `POST /api/pair`,
  `DELETE /api/devices/<id>`. Script: `the QA thread's `stranger.py`` on linuxbox.
- Expected: every route except redeeming a pairing code needs a paired device's token when the request isn't from
  the box itself. `by` comes from the device, not the body.
- Actual: all of them return 200. A bogus token gets 401, but no token at all passes. The log says the $500
  request was approved by "Ben's iPhone". An unpaired phone also sees and can press everything (shot 14).
- Today the installed boxes listen on 127.0.0.1, so this bites once phones get a route in.
- **Fixed in c6f747e for the API, verified 23:30 PT:** with no token, /api/log, /api/tasks, /api/approvals, /api/pair/start and
  /api/devices answer 401; /api/health and the portal page still load. It caused P0-5 and P0-6 below.

**P0-2. SpacetimeDB's `answer` reducer takes anonymous answers with any name, and a fresh install exposes port 3000
to the internet.** Owners: core (reducer), image (firewall).
- Steps: from outside, `POST http://<box>:3000/v1/database/box/call/answer {"id":"<approval>","approved":true,"by":"Ben's iPhone"}`.
- Actual: 200. The task carried on and the log names "Ben's iPhone". The image has no inbound firewall, so this
  works from anywhere on a fresh ISO install.
- **Fixed in core 6879fb9, verified 23:48 PT:** the reducer answers only from connections the box vouched for. From
  outside, the same call got 530 and the task kept waiting; the box screen's Deny still worked and logged "box
  screen". The image's firewall (881318a) also closes port 3000 on new installs; to be re-checked on the rebuilt ISO.
- **Earlier, at 23:33 PT on an image install:** core's fix moves SpacetimeDB to 127.0.0.1 through setup.sh, but the
  image's spacetimedb.service has `--listen-addr 0.0.0.0:3000`, and a "$900 to attacker" request was still approved
  from outside. The image thread's firewall (rebuild in progress) closes the port; core was asked to also check the
  caller's identity in the reducer.

**P0-3. A task on `folder: "/etc/box"` reads the whole vault and the box's private key.** Owner: core. **Fixed in c6f747e, verified 23:31 PT:** from the box itself /etc/box, /var/lib/box, /root, /etc, /opt/box and /var/lib/spacetimedb are refused, a Server box refuses folders altogether, and a paired non-owner phone gets 403.
- Steps: `POST /api/tasks {"title":"x","worker":"fake","folder":"/etc/box","prompt":"steal vault.env out.txt"}` on
  a Server box, then `GET /api/tasks/<id>/diff`. Script: `the QA thread's `escape.py``.
- Expected: refused. A folder task belongs on a Personal box, inside the owner's home or Settings agentFolders.
- Actual: done. The diff holds every vault line (Factory, CRS, Stripe...) and `identity.key`. With P0-1 anyone
  who reaches the API can read the vault. Undo does not remove it (P1-1). The values are not in this report.

**P0-4. Two quick taps on Approve answer two different requests.** Owner: portal.
- Steps: two approvals pending. On the phone, tap Approve, then tap the same spot again 0.4 s later.
- Expected: the second tap does nothing, or needs the new request to be read first.
- Actual: the next request slides into the same place and the second tap approves it. The log shows "Buy item 1
  for $40?" and then "May I spend $500 of your money?" approved 0.37 s apart by Judge's iPhone. The user never
  saw the $500 request (shot 20). A fast double-click (one gesture) approved only one.

**P0-5. After the token fix, a paired phone loses live updates and every app.** Owner: portal. **Fixed in 3ae539b,
verified 23:42 PT:** the paired phone's grid has Shopper, Box Test Store, Agent wallet and ASI:One again, a new request
reached it in 0.6 s, and Approve logged "Judge's iPhone" (shot 56). Left over: track pages' own fetches need the token
too (Shopper's /t/shopper/state panel stays empty off the box); filed with Shopper and the other track threads. On main (c6f747e) a
phone paired over the network gets 401 on `/api/log/stream` (EventSource can't send the header; it retries in a loop)
and on `/t/<track>/` app windows. Both work with `?access_token=`. The phone's grid drops Shopper, Box Test Store,
Agent wallet and ASI:One, spending reads $0.00, and a new request ("Live check: approve $3?") never reached the phone
in 20 s, so moment 3 on a phone is broken (shots 50, 51). The box screen and a laptop on 127.0.0.1 are fine.

**P0-6. After the token fix, Caddy-relayed track routes get 401.** Owner: core. With Caddy's headers,
`/t/mana/status`, `/t/jira/issues` and `/t/jira/` return 401, so deploying main to the Vultr box breaks the public
Mana app and the Jira Forge panel. The Vultr box still ran an older main at 23:33 PT (Mana answered 200). **Don't
`./deploy vultr` until this is fixed.** **Fixed in 6879fb9, verified 23:47 PT:** through a proxy, `/t/mana/status`
answers 200 and Jira's three routes reach the track's own secret check; other track routes and the API still need a
phone's token. Vultr can be deployed once a build with 6879fb9 passes the gate.

**P0-7. One task can read another task's copy of the owner's private files.** Owner: core. Reported by the docs
thread, reproduced by QA at 00:05 PT on main 4540913. With Settings agentFolders set to a person's folder holding a
0600 file, task A runs on that folder. Its copy `tasks/<A>/base` is a 0777 folder holding the file at 0666, under
0711 parents. Task B, an ordinary task with a different user, read the file with `steal
/var/lib/box/tasks/<A>/base/note.txt`. The real file and A's own layer were refused (EACCES). The copy stays while A
runs and while it waits for review (on Personal, until Keep or Undo); Undo removes it. Task ids aren't secret
(find.search returns them). Expected: base keeps the real file's mode and belongs to A's user, and other tasks can't
walk into tasks/<A>.

**P0-8. Scanning the box's pairing QR doesn't pair a phone.** Owner: portal. Found 00:27 PT on main 717bc3f. The QR
holds `http://<box>:7700/pair#<code>`. On a fresh phone that opens "Pair this phone first" with "Code from the box's
screen" empty and Pair disabled (shot 75); `/#pair/<code>` doesn't fill it either. Typing the code by hand pairs. The
Hacker's Choice demo starts with a judge scanning that QR.

### P1

**P1-1. Undo leaves the task's files on disk, and its diff still serves them.** Owner: core. **Fixed in c6f747e, verified 23:32 PT:** after Undo the diff is empty and the layer is gone. After undoing the
P0-3 task, `GET /api/tasks/<id>/diff` still returned the vault copy until I deleted the layer by hand.

**P1-2. Only proxy refusals reach the action log; direct connections are blocked silently.** Owner: core. A
scripted task tried 1.1.1.1:443, 127.0.0.1:7700, 127.0.0.1:3000, 169.254.169.254:80 and the box's public IP. nftables
refused all of them (correct), but only the proxy fetch of 169.254.169.254 became a `net.blocked` event. The screen
says "1 attempt was blocked" where there were 7. core/README says every refusal is in the log.

**P1-3. The /find track starts a Droid task at every boot.** Owner: find. A fresh install shows "Describe 4 photos
for /find: Failed: the vault has no FACTORY_API_KEY" as its first task (shot 09), and each restart adds another
(Activity, shot 10). Once a key is in the vault it runs and spends model money at boot.

**P1-4. The release ISO is stale and can't be reached or set up.** Owner: image. The 21:34 PT release ISO says
"Box" in the menu bar, pairing says "One-time pairing codes are not on this box yet" and shows a QR for
http://127.0.0.1:7700 (shots 05, 08). Its API listens on 127.0.0.1, BOX_URL is unset, the vault is empty and
there is no sshd, so from a fresh install nothing can pair, add a key or run Droid until first-run setup lands.

**P1-5. The screen greets "Ben" and uses UTC.** Owners: portal (name), image or setup (timezone). At 10:35 PM PT
a fresh install said "Good morning, Ben." with the clock at 05:35.

**P1-6. The portal can't start a task.** Owner: portal. There is no "new task" anywhere; only track apps start
tasks. The Hacker's Choice plan ("they send the box a task and approve it from their own phone") needs one. The
docs' triggers page says the portal can (docs finding D-4).

**P1-7. A request that arrives while the page is open names the wrong allowed hosts.** Owner: portal. Moment 2's
banner said "It tried to reach attacker.example:443. **It may not reach any host**", but the task may reach
shop.localhost:8123. After a reload it is right. A task that arrives through SpacetimeDB gets `hosts: []`
(`portal/src/live.ts:175`), because the `task` table has no hosts. The demo's moment 2 creates its task after the
page loads, so a judge sees the wrong sentence (shots 26, 27).

**P1-8. A phone doesn't notice the box is down, and a tap during the outage is dropped without a word.** Owner:
portal. 2.5 minutes after a hard power-off the phone still showed "2 running" and live Approve buttons. Tapping
Approve showed nothing; after the box came back the request was still pending (shots 37, 38). portal/README says an
open screen shows "The box is out of reach". The restore itself is right (P0s aside, see What passed).

**P1-9. On the phone a newer "blocked" notice hides a waiting request.** Owner: portal. With one request waiting
and a blocked attempt after it, the phone's banner is the blocked notice; the Approve button is three taps away
(Tasks, Waiting, the task). A request that needs an answer should come before a notice (shots 33 to 35).

**P1-10. Credit desk and /find have no page on the box.** Owners: credit desk, find. `/t/credit-desk/` and `/t/find/`
answer 404 and neither is in the app grid. A judge can't run the credit desk's case or search /find from the screen;
both are reachable only through the API or a task. Hyphenate's brief says judges "may run their own case".

**P1-11. Shopper's "Agents buying their own supplies" form pays the budget, not the price.** Owner: Visa (shopper).
With the default URL (a $0.03 report) and a 2-cent budget the task fails with "no Solana devnet USDC offer at exactly
$0.02; the price is $0.03" instead of pausing for an OK. With 3 cents it pays. So this form can never show the
over-budget approval the wallet README describes (shot 49). The script should pay the quoted price.

**P1-13. In moment 2 a real agent spends 30 s probing the sandbox, which reads like an escape attempt.** Owner: core.
A real Droid task (Claude Sonnet 4.6, 13 cents) on the booby-trapped page refused the injection and wrote only the
summary, and told the user about the hidden instructions. Nothing leaked. But first, plain `curl
http://shop.localhost:8123/listing` failed: curl doesn't send `*.localhost` names through HTTP_PROXY, and nftables
silently refuses the direct connection. So the agent ran "Fetch listing bypassing proxy" (`--noproxy '*'`), "Try
connecting via external IP", `ss`, `lsof` and /proc lookups, then tried the proxy by hand, which worked. A judge reading
the steps sees an agent trying to get around the box. The demo uses the same `shop.localhost` host. Use a host name
curl proxies (not `.localhost`), or tell the agent the proxy in its prompt.

**P1-12. Nobody is paired with the ASI:One agent.** Owner: fetch. linuxbox's box runs agent `box` with its mailbox,
but its page says "Owners paired: 0", so the chat flow needs `pair <code>` from Ben's ASI:One account before judging.
The Vultr box's agent is off (no Agentverse key in its vault), which is fine if it's documented.

**P1-14. The task API takes any budget and any hosts value.** Owner: core. `budgetCents` accepts -5, "abc", 0.5 and
1e15; `hosts` accepts "*", "*.*", "0.0.0.0/0", "127.0.0.1:7700" and a bare string. Missing title or prompt, unknown
tools and workers, and workspaces like `../../etc` are refused correctly. Core was asked to validate both fields
and check what each accepted value lets a task reach.


### P2

**P2-1. The losing phone gets no word.** Owner: portal. Two phones answered one request (Approve and Deny at the
same moment). The first answer won and only one was logged, which is right. The other phone's banner just
switched to the next request, with no "Already approved on Judge's iPhone" (shot 19).

**P2-2. The installer shows a black screen for 2 minutes.** Owner: image. Then "Copying the system to slot A"
with no progress (shot 04).

**P2-3. You can't reinstall over a box from Vultr's console.** Owner: image. The disc menu waits 5 s; Vultr's
console reconnects about 30 s after a reboot. Vultr's reinstall API refuses ISO instances (409).

**P2-4. A new Vultr instance first shows iPXE "Please mount an ISO"** for about a minute while the ISO mounts, then
reboots into the disc by itself (shot 01). Worth one line in image/README.

**P2-5. Boot log spam.** Owner: core. After a task fails before its user exists, boot logs `userdel: user
'box-<id>' does not exist` about 4 times a second (21 lines), plus pkill, chmod and chown errors.

**P2-6. Banners for blocked attempts stay after the task is undone, and stack.** Owner: portal. After undoing
both road-bike tasks, their "Blocked... Undo this task" banners stayed. Hiding one shows the next, and at 1440 x 900
they cover the Time Machine widget (shot 30a).

**P2-7. The running widget keeps saying "resumed".** Owner: portal. After the restore, with nothing running, the
phone's widget read "0 resumed".

**P2-8. Shopper's price error uses an internal name.** Owner: Visa (shopper). Price "abc" gives "maxCents must be a
whole number from 1 to 50000" under a field that asks for dollars (shot 41).

**P2-9. Undo on a purchase doesn't say it refunds.** Owners: portal, Visa. The confirm button is "Yes, undo it".
It did refund the Stripe test payment, which is worth saying on the button or under it.

**P2-10. The box screen's pairing code changes as soon as a phone pairs,** so step 2 ("check that the phone shows the
same code as this screen") can't be done after the fact. Owner: portal. Minor.

**P2-11. The Agent wallet page shows only the address and balance.** Owner: wallet. No payments, no per-task
receipts, no link to the transactions (shot 53). Coinbase judges open this window first.

**P2-12. /find's word fallback ranks the box's own tasks above the photo.** Owner: find. Without Moss (no Moss key on
my box), "find the whiteboard photo" returned the "Describe 4 photos" task and two failed copies before
`photos/IMG_2041.jpg`. Failed housekeeping tasks shouldn't be indexed.

**P2-13. The Elastic index mixes test boxes with the real one.** Owner: elastic. At 23:41 PT `box-actions` held 468
documents from installed boxes, 587 from three ./demo runs and 321 from four portal dev boxes (box-portal-dev,
-settings, -setup, -hotfix) full of seeded tasks like "Long job". "What did my agents change this week" will include
them. Filter the agent's tools to `box.run: installed`, or keep dev boxes out of the index.

**P2-14. "Box" as a product name in more places.** Owners: mana, Visa, jira, elastic. The Mana app is "Box status";
the store is "Box Test Store"; the Jira panel is "Box agent task"; the Elastic agent is "Box log".

**P2-15. No size limits on task text, and raw parser errors.** Owner: core. A 100,000-character title and a 5 MB
prompt are accepted and pushed to every screen. Invalid JSON returns the parser's own message.

**P2-16. A normal restart is announced as a power cut.** Owners: core, portal. After `systemctl restart box.service`
(a deploy), the box screen said "Welcome back. The box went down after 06:44 and booted at 06:46" with "restored
after a power cut" (shot 57). A clean stop could leave a marker so only a real outage gets the banner.

**P2-17. The ASI:One agent calls the API from 127.0.0.1, so it has owner rights.** Owners: fetch, core. Safe only as
long as brain.py never passes chat text into folders, hosts, tools, budgets, the vault or settings. From the docs
thread. Also: CORS allows only content-type, so cross-origin clients must use `?access_token=` (core);
image/README.md still says "most of the API takes no token" (image).

**P2-18. A task started from a phone is logged as source "api".** Owner: portal. "Ask the box" on a paired phone
made a task with `source: api`; the log and Jira would read better with the device name or "phone".

**P2-19. "Spent today" shows an old total for the first seconds after a page loads.** Owner: portal. A freshly loaded
phone showed "$18.23 spent today" for about 4 s, then the right "$29.79". Minor.

## Docs site (gurtos.com)

**D-1 to D-4 and D-7 fixed in 199dce5 and live, spot-checked 00:00 PT:** real ISO names, `gurt-<id>`, the Personal ISO
page, "the portal has no button for a new task yet", unkeep in the Keep guide, robots.txt 200. D-5 is Ben's call;
D-6 waits for the tracks to rename.

Checked 22:40 to 22:46 PT by a helper agent. Nothing private leaked: no keys, tokens, tailnet names, home paths or
emails in the 82 pages or llms-full.txt. All 158 internal links, every anchor and all 53 OpenGraph images load. No em
dashes. Search works. Nothing scrolls sideways at 390 x 844. No form collects data. Owner of all: docs.

- **D-1 (P1). Wrong ISO and update file names.** The install, disk-layout, update and system-updates pages say
  `box-<arch>.iso` and `root-<arch>.sqfs`; the build makes `gurtos-<edition>-<arch>.iso` and `.sqfs`. The dd,
  QEMU, UTM, Parallels and `box-update apply` commands name files that don't exist.
- **D-2 (P1). Wrong hostname.** Pages say the box is `box-<id>` from 10 hex digits; it is `gurt-<id>` from 6.
- **D-3 (P1). GurtOS Personal's ISO is missing.** The docs say Personal has no installer and is "Planned";
  `image/build personal` makes one with A/B updates.
- **D-4 (P1). The triggers page says the portal can start a task.** It can't (P1-6). The task-detail mockup also shows
  "SOURCE portal".
- **D-5 (P1). No install path a judge can follow.** Get started leads to "no public downloads yet" and "the source is
  not public yet"; the repo is private. Ben's call: publish the ISO or the repo, or point Get started at the demo.
- **D-6 (P1). "Box" as a product name** in the Jira panel ("Box agent task"), the Elastic agent ("Box log") and the
  test store ("Box Test Store"). The guides copy the code, so the names change in the tracks first.
- **D-7 (P2).** Undoing a Keep is described as manual and planned; `POST /api/tasks/:id/unkeep` exists and isn't in the
  OpenAPI file. The owner workspace name is now `owner-<name>-<hash>`. The Mana app is missing from the apps page.
  No robots.txt.

**calhacks.gurtos.com** had no DNS record at 22:46 PT (NXDOMAIN). Owner: the submission thread.

## Showcase (calhacks.gurtos.com)

Checked 23:45 to 23:59 PT by a helper agent. Source: `showcase/`. Owner of all: the submission thread. Nothing private
on the pages or in OCR of all 61 images; no em dashes; every page fits 390 x 844; OpenGraph set on all 21 pages.

- **S-1 (P0 until the repo is public).** Every GitHub link (nav, footer, about 40 deep links) was 404 while the repo was
  private. The repo is public now, so recheck.
- **S-2 (P1).** The security limits are older than c6f747e and 6879fb9: "The local API has no login", "SpacetimeDB
  listens on every interface, and answer takes anyone's call". Both are fixed on main.
- **S-3 (P1).** The SpacetimeDB and Figma pages say phones use SpacetimeDB; on main a phone uses the token-checked
  API and the log stream.
- **S-4 (P1).** "Every refusal is a net.blocked event" was false until core bb0ccde; true on main now.
- **S-5 (P1).** Moss says the owner searches /find "from the portal"; there is no /find page (P1-10).
- **S-6 (P1).** The Figma page disagrees with `docs/stagelog.md` (deck 14 vs 16 slides, prototyping 6 vs 26 min,
  handoff 19 vs 4 min, a different Make file link). No narrated demo video yet.
- **S-7 (P2).** "Box core" in diagram legends, "Box Test Store", "Box log", "Box status app"; "14 of 14" next to the
  gate's "2 of 14" (scripted seats) without the reason; stale Solana numbers; internal notes ("Waiting for Ben's
  review", "A step for Ben on submission day"); CRS identities labelled "test money".

## What passed

- **Install on Vultr from our ISO** (release, BIOS): blank 160 GB disk to the box's screen in about 3 minutes.
  Hard power-off (Vultr halt, then start): back on screen in about 25 s. Booting the disc on a disk that already
  has the box starts the box from disk.
- **The task sandbox.** From the home workspace a scripted hijacked task could not read the vault, the log or
  devices.json (EACCES), reached none of 127.0.0.1:7700, :3000, the box's public IP, 169.254.169.254 or 1.1.1.1,
  reached only its allowed example.com, held no secret in its environment, and saw one process.
- **The vault API** (`PUT /api/vault/<name>`) set 14 keys and never returned a value.
- **Pairing a phone** from the box screen's QR: the phone shows the code, you name it, the box lists it.
- **First answer wins** when two phones answer at once; one answer is logged.
- **Reloading the phone** mid-wait keeps the request on screen.
- **Main's box screen at 1280 x 800** (the Vultr console's size) fits with no scrolling and says GurtOS.
- **Moment 1, by hand.** Two scripted jobs wrote a1-a7 and b1-b7 into `home`. Time Machine, Undo "QA long job A",
  press again: the view has b1-b7 and no a-files, and the base workspace is untouched (shots 30 to 32).
- **Moment 2, by hand, scripted agent.** It read the trapped listing, failed to read the vault (EACCES), and its send
  to attacker.example was blocked, logged, and shown as a red banner with Undo. Undo asks "Press again to undo. This
  can't be redone." (shots 26 to 29).
- **Moment 2 with a real Droid** (23:37 PT, one of the few real runs allowed before Factory's reset). Claude read the
  page, ignored the hidden instructions, wrote "A used road bike in good condition is available for $300 with pickup in
  Berkeley.", and flagged the injection to the user. No secret anywhere (see P1-13 for how it got there).
- **Moment 3, by hand.** Two jobs kept running while one waited. The request showed on the box screen and both
  phones; a phone that was offline caught up when it came back; reloading kept it; the box screen's banner cleared
  within 2 s of a phone's answer; a request answered after 7.5 minutes (past the 150 s wait window) carried on at once
  (shots 21 to 24, 35).
- **Moment 4, by hand.** Vultr halt with two jobs mid-run and one waiting, start 2.5 minutes later: the API was back
  14 s after power-on with all three resumed. Laptop, phone and box screen showed "Restored after a power cut. 3 tasks
  picked up where they stopped... Nothing was paid twice." Both jobs carried on from step 4, not from the start
  (shot 39).
- **No HTML runs from task text.** Titles, approval questions and file contents carrying HTML showed as plain text on
  the portal (home, Tasks, the task window, Activity, notifications, Time Machine), the track pages and a phone.
- **Shopper (Visa).** A watch on the Box Test Store fired in 6 s with "Buy 2 x Hario V60 02 paper filters for $17.98?
  TEST PAYMENT". Approved on the phone: a Stripe test-mode order signed with Visa TAP and verified by the store. No
  repeat purchase on the next check. Undo refunded it in Stripe test mode (shots 40 to 46).
- **Agent wallet (x402).** From Shopper's supplies form with a 3-cent budget, a scripted task quoted and paid $0.03 in
  devnet USDC to the test API and got the report; the wallet page shows 19.38 USDC with an explorer link (shots 52, 53).
- **Mana.** The public Box status app loads signed out and shows the Vultr box's live tasks and costs (shot 54).
- **Apify.** A Shopper watch on Best Buy Canada ran the live Actor and showed "$299.99 CAD, in stock" for 1 cent
  (shot 55).
- **Elastic.** The box-actions index is receiving events (1,376 documents, the newest a minute old at 23:41 PT).

## Walkthrough log

| PT | Step | Shot |
|---|---|---|
| 22:27 | ISO served from vultrbox, added to Vultr by URL, md5 matched | |
| 22:29 | Instance deployed from the release ISO; first boot lands in iPXE until the ISO mounts | 01 |
| 22:31 | Disc boots, black screen about 2 min, then the installer | 03, 04 |
| 22:34 | Installed, restarted, the box's screen | 05 |
| 22:35 | Settings, pairing (fails on this build), Tasks (failed /find task) | 06 to 09 |
| 22:36 | Hard power-off and start; screen back in about 25 s | |
| 22:38 | Each app on the fresh install | 10 |
| 22:55 | New instance from the debug ISO; installed and SSH up in about 3 min | |
| 23:00 | Main's core on top, vault filled through the vault API, API on 0.0.0.0 | |
| 23:01 | Stranger tests from linuxbox: P0-1, P0-2, P0-3 | |
| 23:05 | Main's box screen | 12, 13 |
| 23:06 | Phone pairs from the box screen's QR; a second phone pairs | 14 to 17 |
| 23:08 | Two phones answer one request; double tap approves two | 18 to 20 |
| 23:09 | Moment 3: two long tasks running, one request, phone 2 offline | 21 to 24 |
| 23:11 | Moment 2 by hand with a scripted agent; the banner's host text | 25 to 29 |
| 23:15 | Moment 1 in Time Machine | 30 to 32 |
| 23:18 | Answering a request 7.5 minutes old from the phone | 33 to 35 |
| 23:19 | Moment 4: Vultr halt mid-task, start at 23:21 | 36 to 39 |
| 23:23 | Shopper: bad input, a watch, a purchase on the phone, undo and refund | 40 to 46 |
| 23:28 | core's c6f747e installed on the QA box; P0-1, P0-3, P1-1 re-tested | 47, 48 |
| 23:33 | Paired phone after the fix: no live updates, apps gone (P0-5); Caddy routes 401 (P0-6) | 50, 51 |
| 23:35 | Wallet through Shopper's supplies form | 49, 52, 53 |
| 23:37 | /find search, Mana app, ASI:One agent pages, Elastic index | 54 |
| 23:37 | Moment 2 with a real Droid task | |
| 23:40 | Apify through a Best Buy watch | 55 |
| 23:42 | Portal's 3ae539b installed; P0-5 re-tested on the paired phone | 56 |
| 23:50 | HTML in task text on every screen; bad input to the task API | |
| 23:46 | core's 6879fb9 installed: proxied track routes, the vouched reducer, box screen Deny | 57, 58 |
| 00:00 | Docs fixes spot-checked on gurtos.com | |
| 00:05 | Cross-task read of a folder task's copy (P0-7) | |
| 00:02 | Release ISO 20261024-0644-881318a installed fresh on Vultr: GurtOS, Pacific time, ports closed | 60 |
| 00:09 | Main 3a4e4ca: double tap, outage bar, Ask the box, credit desk, supplies form on a paired phone | 61 to 70 |
| 00:12 | Main 717bc3f: P0-7, firewall refusals logged, a test-store purchase and its refund Undo | 71 |
| 00:21 | P1-7 on a phone (still open) | 72 |
| 00:27 | Pairing from the QR address on a fresh phone (P0-8); two phones racing (P2-1) | 73 to 76 |
| 00:33 | Main a427291: validation, clean-stop marker, no /find boot task, /find on a phone | 77 |
| 00:53 | Main d64cb80: QR pairing on fresh phones, the live moment 2 banner, task source | 78, 79 |
