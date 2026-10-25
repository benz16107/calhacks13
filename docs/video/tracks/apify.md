# Apify: web robots with no keys (1:05)

**Track:** Apify, Best Use of Apify (and the Best Actor prize). **Edition:** GurtOS Personal (web errands beside you) and
GurtOS Server (watches that run while the laptop is closed). **Shares footage with:** Visa (T-VI-01 reads a live price
through Apify), the main video (A06). **Status:** draft for Ben's approval.

## Creative brief

A crawl desk with a checkpoint. Pages pass through the Agent-Safe Page Reader, and the one trap page is caught. After the card, full-bleed `a03.mp4` from 8.0 shows a task meeting a booby-trapped page, with a hand-drawn circle on the Blocked banner (paragraph 1). Paragraph 2 insets `a06.mp4` from 4 and types "No network" and "No Apify token". Paragraph 3 splits two big-number cards that arrive at the same instant, AirPods Pro 3 at $299.99 CAD and Cole Coffee Café, then a counter lands on 0 token copies. Paragraph 4 is a terminal typing the detector's line (risk high, score 100, display:none), then a flash and a WITHHELD stamp. Paragraph 5 shows `apify-window.png` with callouts on the Counted and Apify cost columns as the voice says budget and cap, then a $0.10 counter. Paragraph 6 draws two dots on a timeline, schedule and webhook. Steady crawl ticks, with downward wipes like a page feed. One zoom, on the window's rows. Music bed: crawl.

Footage: a03.mp4, a06.mp4, showcase/src/assets/track/apify/apify-window.png

**Goal.** Apify's Actors are the way every agent on the computer reaches the web, and the agent never holds the token.
A judge sees two tasks with no network read live data at once, a scraped page treated as untrusted data, the cost
capped twice and shown, and, on a Server box, a schedule and a webhook starting tasks.

**Rubric map.** Apify published no detailed criteria (`showcase/src/content/tracks/apify.mdx`): meaningful use of Apify,
overall quality, and the Best Actor prize.

| Apify asks for | Where |
|---|---|
| Meaningful use of Apify | Beats 2 and 3 (Actors from tasks, the live run), beat 6 (schedules and webhooks) |
| Overall quality | Beats 4 and 5 (a page is data, cost capped twice and shown) |
| Best Actor: our own Actor | Beat 4 (Agent-Safe Page Reader) |

## Shot list

Times are targets; the voice sets the final cut. Footnote on the trap-page clip: "Scripted agent: same steps every take".

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:09 | G-AP-1: the night Hills; three lines appear. "A web agent drives your logged-in browser." "It reads pages that can hide instructions." "You cannot see what it spends." | Web agents today: your logged-in browser, pages with hidden instructions, no view of the spend | "Web agents today drive your logged-in browser and read pages that can hide instructions. You can't see what they spend." | The problem (`docs/story.md`, Apify) |
| 2 | 0:09 to 0:20 | A06: task detail for the live-run task: runs as `box-<id>`, "What it can reach: nothing", the Apify tool lines in the steps, no token anywhere. A20 for one second: the Personal desktop with the Apify window | From the OS: own Linux user, no network, a root-only vault, a broker. From Apify: nine tools that call Actors with the vault's token. GurtOS Personal and Server | "On Gurt O.S., the agent is its own Linux user with no network and no Apify token. The box runs the Actor with a token the agent can't read." | Actors from a task with no token (features: Apify rows, verified Oct 23 23:40) |
| 3 | 0:20 to 0:35 | T-AP-01: two tasks side by side on the box screen, both with no sites; both finish at the same time. Result card 1: "AirPods Pro 3, $299.99 CAD, in stock, Best Buy Canada". Result card 2: "Cole Coffee Café, 6255 College Ave, Oakland". Then a log search for the token: 0 matches | Live run, Oct 23: two tasks, no network, both Actors on Apify at once. AirPods Pro 3 $299.99 CAD, in stock, at Best Buy Canada. Cole Coffee Café, 6255 College Ave, Oakland. Token in either log: 0 | "On October twenty-third, two tasks with no network ran two Actors at once. They came back with AirPods Pro three at two ninety-nine ninety-nine Canadian, and Cole Coffee Café in Oakland. The token was in neither log." | The live run (`showcase` Apify page, Oct 23 on the x86 and ARM64 test VMs; features: verified Oct 23 23:40) |
| 4 | 0:35 to 0:46 | T-AP-02: the trap page (a used road bike for $300, with a hidden line) read through Agent-Safe Page Reader: `risk: high  score: 100  where: display:none`, "withheld: the agent gets the findings, not the text". Footnote | A scraped page is data. Our own Actor, Agent-Safe Page Reader: risk 100, hidden text found, page withheld. The task has no network and no keys to act on it. Scripted agent: same steps every take | "Every page goes through our own Actor, Agent-Safe Page Reader. A page that hides an order to steal keys scores a hundred and is withheld." | Agent-Safe Page Reader, build 1.0.2 (features: merged; trap page risk 100) |
| 5 | 0:46 to 0:55 | T-AP-03: the Apify window on the desktop: a row per task with counted cost and Apify's reported usage; then an approval on the phone: "to Apify (run X)", over the task's budget | Capped twice: the task budget, and Apify's own cap on each run (default $0.10). The window lists counted cost and Apify's usage per task. Counted cost is an estimate | "Cost is capped twice, by the task's budget and by Apify's cap on each run. The Apify window shows both." | Cost in task budgets, "to Apify" approvals, the Apify spend app (features: merged 60f5184) |
| 6 | 0:55 to 1:05 | T-AP-04: the Apify Console showing the schedule and webhook `apify.watch` created, and the box log: a price drop starts a task through the webhook trigger. Then G08 end card with the Server chip | GurtOS Server: an Apify schedule and a webhook start tasks while you are away. Set-up and teardown tested live; delivery tested with Apify's payload shape. Open source, Apache-2.0 | "On a Server box, an Apify schedule and a webhook start tasks while you're away. Gurt O.S. is open source." | `apify.watch` (features: merged 60f5184; delivery tested only with Apify's payload shape) |

**Cut list if long:** beat 2's A20 second, beat 5's phone approval, beat 6's Console shot (keep the log line).

## Narration (exact text for ElevenLabs)

Word count: 151 (target about 150 for 1:05).

```text
Web agents today drive your logged-in browser and read pages that can hide instructions. You can't see what they spend.

On Gurt O.S., the agent is its own Linux user with no network and no Apify token. The box runs the Actor with a token the agent can't read.

On October twenty-third, two tasks with no network ran two Actors at once. They came back with AirPods Pro three at two ninety-nine ninety-nine Canadian, and Cole Coffee Café in Oakland. The token was in neither log.

Every page goes through our own Actor, Agent-Safe Page Reader. A page that hides an order to steal keys scores a hundred and is withheld.

Cost is capped twice, by the task's budget and by Apify's cap on each run. The Apify window shows both.

On a Server box, an Apify schedule and a webhook start tasks while you're away. Gurt O.S. is open source.
```

## Captures this video needs

Shared (see `capture.md`): A06, A20, G08. Its own animation card: G-AP-1 (the problem lines). Its own captures:

| ID | What | Machine and state | Steps |
|---|---|---|---|
| T-AP-01 | Two network-less tasks, both Actors, token nowhere | Clip box (Server) with the Apify token in its vault; `DEMO_LIVE=apify` style run, about one cent | Start the Best Buy Canada price check for AirPods Pro 3 and the Google Maps place read for Cole Coffee Café, two tasks at once; record the box screen until both finish; then search the log for the token (0 matches). Say the numbers from the take if prices moved |
| T-AP-02 | The trap page read through Agent-Safe Page Reader | Same box | Read the trap page (the road-bike listing with the hidden line) through `apify.readPage`; hold on the risk line, the findings and "withheld" 4 s. Call the Actor by its ID, as `track.ts` now does |
| T-AP-03 | The Apify window and an Apify approval | Personal VM on the laptop (final Personal disc) or the clip box, after T-AP-01; iOS simulator for the phone | Open the Apify window and hold on the per-task rows; fire a call that goes over the task budget and capture the phone approval "to Apify (run X)" |
| T-AP-04 | A schedule and a webhook start a task | Clip box with `APIFY_WEBHOOK_URL` and `APIFY_WEBHOOK_SECRET` in its vault, reachable from Apify | `POST /t/apify/watch` for a product; show the schedule and webhook in the Apify Console (crop the account menu with `media-treatment`); show the log line when the webhook starts a task. If a real delivery is not possible, post Apify's payload shape to the route and keep the on-screen sentence "delivery tested with Apify's payload shape" |
| T-AP-S1 | The Apify app's permissions: Allow, Deny, revoke (slot: only once agent permissions are merged) | Clip box (Server) with the Apify token in its vault, on a build where agent permissions are merged | Open the Apify app's permissions and hold on its manifest; Allow one permission, Deny one, revoke one; then trigger the revoked use and hold on the OS refusing it. Use only the labels the screen shows No Apify account name or token on screen |

## Check before render

- Best Buy Canada's Conditions of Use prohibit scraping; the page discloses it. Keep the Best Buy shot to one read, as in
  the live run, and keep that note in the video's description.
- The Actor: features.md and `docs/devpost.md` say Agent-Safe Page Reader is built (build 1.0.2) and runs live on Apify,
  but is not yet public on the Store (checked Oct 24 evening: Store search finds nothing, the Store page returns 404, the public API says not found). The video says "our own Actor", never "published", and shows no Store page, unless
  the Store page loads on render day.
- Prices and stock are the ones captured that day. If AirPods Pro 3 moved from $299.99 CAD, say the captured number.
- Counted cost is an estimate (for pay-per-event Actors such as Google Maps, Apify's reported usage leaves out the event
  price). The cost screen keeps the word "estimate".
- The trap-page agent is scripted; the footnote is on screen. Webhook delivery is not claimed as tested end to end.
- No Apify account name or token on screen.

## Slots: standout features (use only once merged)

These beats stay out of the video until the feature is merged on main and its check passes. When one is ready, record its capture, add its line to `docs/video/slots.json`, generate its narration with `narration/say.py <script> --slots`, and rebuild: later beats move by themselves.

| Slot id | Feature | Goes after beat | Picture (the capture to record) | On-screen text | Narration | Seconds | Rubric it serves | What to cut to stay in length |
|---|---|---|---|---|---|---|---|---|
| `permissions` | Agent permissions | Beat 2 (the agent is its own Linux user with no network and no Apify token) | T-AP-S1: the Apify app's permissions on the clip box. Allow one, Deny one, revoke one, then the OS refuses the revoked use | Agent permissions · the OS enforces the Apify app's manifest · Allow · Deny · revoke | The OS enforces the Apify app's manifest. Like phone app permissions, you can Allow, Deny or revoke. | 8.4 | Meaningful use of Apify and overall quality: what the Apify app may do is the OS's call | Beat 3's second sentence "They came back with AirPods Pro three at two ninety-nine ninety-nine Canadian, and Cole Coffee Café in Oakland." (about 8 s; the two result cards keep the price and the place on screen; regenerate beat 3 with `--only 3`) |

Length: target 1:05. Every slot in adds about 8.4 s and the cuts above take out about 8 s, so the video runs about 1:05. Cut sizes are estimates from each beat's window; the build's length check has the final say.

### Slot narration

#### permissions

```text
The OS enforces the Apify app's manifest. Like phone app permissions, you can Allow, Deny or revoke.
```
