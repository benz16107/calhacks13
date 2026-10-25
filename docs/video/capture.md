# Capture plan

Every screen recording the videos need, shared by ID so one take serves several videos. Section A is the shared
library (record it first), B is animation made in `studio/` (no capture), C collects each track's own shots (defined
in each `tracks/<name>.md`, under "Captures this video needs").

## Rules for every take

- **What runs on screen.** The four moments and the portal come from a throwaway **clip box**
  (`showcase/scripts/clips/clip-box.sh`): a fresh box on the test VM with a neutral identity ("home box",
  `gurtos.local`), scripted workers and test money. Never the installed box, never a real BOX_HOME.
- **OS footage** comes from the **final release discs**, built from commit `13629bc`. Do not record OS footage from any
  earlier disc (not `v0.1.0-preview`). Note the disc file name in the take's log line.
- **Never on screen** (`../videos.md`): home paths, machine names, Tailscale addresses, the vault file, `.env`, an
  inbox, the Vultr or Stripe account name, a real person's email. Business people are the seed's made-up names.
- **Size and rate.** Desktop 1920 x 1080 at 60 fps. Phone 1179 x 2556 (iPhone simulator) or 390 x 844 CSS at 3x for
  the web phone. Delivery is 30 fps; 60 fps capture keeps speed-ups smooth.
- **Light and dark.** Server's box screen and the Personal desktop are night (the Hills). Record the portal in dark
  mode so cuts between devices match.
- **Log every take** in `docs/video/takes.md` (create on first take): ID, file, machine, disc or commit, date, and
  anything to fix in the edit. Raw files go to `docs/video/studio/assets/capture/` (git-ignored, see below), never
  committed: they are large and may hold something private until reviewed.

## How each kind is recorded

The web shots run through `capture/x11rec.sh <out.mp4> node capture/shots.mjs <ID>` (A01 to A08, A30 to A34); the
Business shots need `capture/seed-business.ts` first. Both were written Oct 24 and are **not yet rehearsed**: Ben
asked to hold all captures until his script edits are in. The recorder itself was tested (60 fps, full screen).

| Kind | Tool | Machine | Notes |
|---|---|---|---|
| Web: box screen, portal, sponsor sites | Headed Chromium in Xvfb (1920 x 1080), driven by `showcase/scripts/clips/record.mjs`; `ffmpeg -f x11grab -framerate 60 -video_size 1920x1080 -i :99 -c:v libx264 -crf 14 -preset veryfast` records the display | the Linux build machine (one Chromium at a time; check free memory first) | Playwright's own `recordVideo` is 25 fps, so it is only for rehearsals. record.mjs already has the big cursor, glides and the per-moment steps; set its `DESK` to 1920 x 1080 for these takes. Chrome DevTools `screencast_start` is the fallback |
| OS in a VM: install, boot, power cut, Personal desktop | QEMU on the laptop (arm64 discs run natively with HVF). Install and boot: a QMP `screendump` every 0.5 s, assembled into a timelapse. The Personal desktop: GNOME's own screencast inside the guest (`gdbus call --session --dest org.gnome.Shell.Screencast ... Screencast 'take.webm' "{'framerate': <60>}"`) | the laptop, ssh to the laptop | Never touch the laptop's Lima VM `box` (Sunday's demo box) or `~/box-os`. One test VM at a time; delete it after. If the laptop is asleep, say so and use the x86_64 discs on the Linux build machine within the one-test-VM rule |
| iPhone, Apple Watch, Mac app | Simulator on the build Mac: `xcrun simctl io booted recordVideo --codec h264 take.mov`; the Mac app with `screencapture -v` | the build Mac, every build through `heavy` | The phone thread owns the builds and knows the pairing flow; ask it for a paired simulator. Face ID: Features > Face ID > Matching Face |
| Android | The signed APK in the arm64 emulator | the laptop | Only for the 2-second shot in the main video |
| Sponsor products (Jira, ASI:One, Agentverse, Elastic, Figma, Mana, Apify Console) | Same Xvfb recorder, with the signed-in browser profile the track thread used | the Linux build machine (the Atlassian thread's signed-in profile) | Crop or blur account menus in the edit with `npx hyperframes media-treatment`, never CSS |

## Recorded so far (Oct 25, from main 282d66d)

Live 60 fps takes in `studio/assets/capture/` (git-ignored): A01, A02 (box screen and phone side by side through
`capture/split.html`), A03, A04, A05 (with a request left waiting across the power cut), A06, A08, and Armadin's
AR01 (the poisoned package), AR03 (the booby-trapped page with all four refusals) and AR04 (the lookalike-bank
payment, answered through the API because of the portal bug in `REVIEW.md`). The rest of section A and the track
shots wait for Ben's feedback on the first two videos.

## A. Shared library (record first)

| ID | Shot | Used in | Machine and state | Exact steps |
|---|---|---|---|---|
| A01 | Box screen at rest, lived in: Needs you empty, two tasks running, today's spend | main 4, 5; Vultr; Spacetime | Clip box, `clip-box.sh` seed | Open `/screen`, 1920 x 1080, hold 15 s; slow push is done in the edit |
| A02 | **Moment 3**: box screen and iPhone in sync; the request lands on both; Approve on the phone; task finishes | main 6; Spacetime; Anthropic; Fetch | Clip box + iPhone simulator paired from Settings (log names the phone) | Start both recorders; fire the GPU-hour task (`../videos.md`, Helpers); wait for the banner on both; tap Approve on the phone after 3 s; hold 4 s after done. Align the two files on the banner's first frame |
| A03 | **Moment 2**: road-bike task, Blocked banner, open task, red rows for attacker.example and 1.1.1.1, Undo | main 7; Armadin; Anthropic; Factory; Apify | Clip box | Fire the road-bike task; record from submit to Undo done; then open Activity and hold on the blocked rows 5 s |
| A04 | **Moment 1**: Time Machine, two layers on the `notes` workspace, select one, "What comes back" and "What stays", Undo | main 8; Atlassian T2; Mana | Clip box | Fire the two notes tasks; open Time Machine; select "Rename the photo folders"; Undo; confirm |
| A05 | **Moment 4**: a long task running, the VM force-stopped, boot, "Welcome back" with the task resuming | main 9; Fetch; Vultr | Clip box for the screen side; `clip-box.sh kill` then `boot` | Fire the long job; wait for progress 2; `clip-box.sh kill`; hold black 1 s in the edit; `clip-box.sh boot`; record until it resumes. For the OS-level version see O02 |
| A06 | Task detail: "What it can reach", runs as `box-<id>`, cost against budget, the placeholder key line | main 10; Factory; Anthropic; Armadin | Clip box | Open any finished task; scroll to What it can reach |
| A07 | app.gurtos.com on a laptop-size window, the Computers switcher, Needs you | main 12; Anthropic | Hosted app against the clip box (DEV_ORIGINS) | Pair, open Computers, then Needs you |
| A08 | Activity: the action log scrolling, filters by task and app | Elastic; Hyphenate; Atlassian | Clip box after A02 to A05 | Open Activity, scroll slowly, filter by one task |
| A20 | GurtOS **Personal** desktop on the Hills; the native GurtOS app (Agents, Activity, Time Machine, Apps); a GNOME notification Approve; Files > Ask an Agent; Keep and Undo | main 5; Visa; Moss; Anthropic; Factory; Apify | Personal VM on the laptop from the final arm64 Personal disc, installed fresh, Shopper and Apify on | GNOME screencast; open GurtOS from the dock; New task on a copy of Documents; approve from the notification; Keep |
| A30 | GurtOS **Business**: person picker in the top bar, Waiting for me on the controller's phone, a routed approval with rule and reason | main 5; Hyphenate; CRS; Microsoft; Atlassian; Spacetime | Clip box with Business on and the Fogline people and policy from `core/business-demo.ts` (Sam, Rosa, the seats; a capture-prep seed calls the same API) | Pick Rosa; open Waiting for me; open the $12,000 request; show rule and "who could approve" |
| A31 | Business Settings > People: seats and the controller with roles and limits | Hyphenate; Microsoft; CRS | Same | Settings > People, hold |
| A32 | Business refusals: answering your own request (403), over the limit | Hyphenate; Microsoft | Same | As Sam, answer Sam's own request; as Rosa, a $60,000 request over her $50,000 limit |
| A33 | Business Audit with Export CSV | Hyphenate; Microsoft; Elastic | Same | Audit as the auditor; Export CSV; open the CSV in the box's viewer |
| A34 | Kill switch: one switch, every agent frozen; the drill result (271 ms) | Microsoft; Armadin | Same, with 10 tasks running | Owner flips Pause all; then `POST /api/drill` and show its log entry |
| D01 | iPhone app: pairing by QR, Needs you, Approve with Face ID | main 12; Visa; Anthropic; Factory | the build Mac simulator, paired to the clip box | Pair; fire a spend task; Approve with Face ID (Matching Face) |
| D02 | Apple Watch: approve $8 on the wrist; $40 refused | main 12; Anthropic | the build Mac Watch simulator paired with D01's iPhone | Fire an $8 and a $40 request; approve each on the watch |
| D03 | Mac menu bar app: needs-you count, Approve with Touch ID, Send to GurtOS | main 12; Anthropic | the build Mac | Fire a request; open the menu; approve |
| D04 | Android app (APK) Needs you | main 12 | the laptop emulator | Install `gurtos-android-0.1.0.apk`, pair, show Needs you |
| O01 | **Server disc install**: boot, installer, first boot, box screen | main 11; Vultr; Armadin | the laptop QEMU, final arm64 Server disc, 4 GB RAM, 20 GB disk | QMP screendump every 0.5 s from power on to the box screen; also note the wall-clock install time |
| O02 | Server power cut at the OS level: running task, `quit` the VM, boot, resume | main 9 (alt); Vultr | Same VM after O01 | Fire the long job from the box screen; QMP `quit`; start; record to resume |
| O03 | Personal disc install and first boot to GurtOS Setup | main 5 (alt); Moss; Figma | the laptop QEMU, final arm64 Personal disc | As O01 |

## B. Animation (built in `studio/`, no capture)

| ID | What | Used in |
|---|---|---|
| G01 | OpenClaw numbers with sources; "runs as you" wiring | main 1, 2 |
| G02 | The outdated-OS list, crossed out line by line | main 3; Anthropic; Microsoft |
| G03 | The overlay filesystem: task layers on one folder, undo takes one out | main 4; Factory; Atlassian T2 |
| G04 | Three editions, each pane a real capture (A01, A20, A30) with its chip | main 5 |
| G05 | Attack scoreboard: 16 rows, 14 stopped, 2 not covered | main 10; Armadin |
| G07 | The suite map | main 13 |
| G08 | End card: logo, gurtos.com, repo, Apache-2.0 | every video |
| G10, G11 | Hyphenate: Equifax card; the score card | Hyphenate; CRS; Microsoft |
| G12, G13 | Visa: the problem lines; Equifax card numbers | Visa |
| G2x | Track-specific cards, numbered in each track script | per track |

## C. Track shots

Each track script lists its own `T-<track>-NN` shots with machine, state and steps. Combined list, in recording order:

| Track | Shots | Where it records |
|---|---|---|
| Hyphenate | T-HY-01 to 05 | Clip box, Business and credit desk, live CRS and Nessie keys in its vault |
| Visa | T-VI-01 to 04 | Personal VM on the laptop; the GurtOS Test Store; Stripe test dashboard |
| CRS | T-CRS-01 to 03 | Clip box, Business on, Fogline seed, CRS keys in vault, after the `demo-crs.ts` steps (pull reasons and limit, the guest refusal and case page, the arguer) |
| Microsoft | T-MS-01 to 04 | Clip box (Business, a shadow seat, Quick run); T-MS-02 is `core/sso-demo.ts` output on any Node 22.18+ machine; `fairness.test.ts` from a repo checkout |
| Coinbase and Solana | T-CB-01 to 06 | Clip box (Server, funded devnet wallet); T-CB-03 the build Mac iPhone simulator; T-CB-04 a terminal against the cloud box; T-CB-05 a throwaway Linux user or VM; T-CB-06 Solana Explorer in Xvfb Chromium |
| Mana | T-MA-01 to 04 | Public Mana pages signed out (Xvfb Chromium); T-MA-03 clip box with Business and the Mana track on; T-MA-04 also the the build Mac iPhone simulator |
| Atlassian T1 and T2 (one shoot) | T-AT-01 to 07 (T2), T-AT-08 to 13 (T1) | The always-on cloud box and the Jira demo site in the signed-in Atlassian profile on the Linux build machine. Fresh scripted tasks: BOX-17, 18 and 29 are already rolled back |
| Fetch.ai | T-FE-01 to 11 (**Ben records the ASI:One shots himself**, decided Oct 24; the rest as below) | Server clip box with the Fetch agents and test agents on, phone paired, real Droid with Claude; ASI:One in a signed-in browser (a second ASI:One account for the guest shot); A05 for the power cut |
| Elastic | T-EL-01 to 05 | Kibana on the Elastic Serverless project (it ends about Oct 30); a fresh terminal titled `box`; the clip box with the iPhone simulator for the alert approval |
| Armadin | T-AR-01 to 05 | Clip box and its test VM; T-AR-03 the build Mac iPhone simulator; T-AR-04 the Business clip box with the Fogline seed and the Nessie test bank |
| Anthropic | T-AN-02 to 04 (and T-FA-01, shared) | Clip box with a Factory key; T-AN-04 a real Claude Code session on the Linux build machine driving the clip box through the GurtOS MCP server with a paired device token |
| Factory | T-FA-01 to 04 | Clip box with a Factory key and real Droid (spends model credit); phone clips on the the build Mac iPhone simulator |
| Apify | T-AP-01 to 04 | Clip box with the Apify token; T-AP-03 also the Personal VM; T-AP-04 needs the box reachable from Apify |
| Figma | T-FI-01 to 11 | Xvfb Chromium signed out for public files; T-FI-04, 05 and 11 need signed-in Figma; T-FI-07 a Claude Code session with the Figma connector; T-FI-06 and 08 terminal runs on a checkout of main |
| SpacetimeDB | T-ST-01 to 05 | Clip box with the spacetime track and Business on; T-ST-04 also `DEMO_LIVE=spacetime` against Maincloud |
| Moss | T-MO-01 to 03 | Personal VM on the laptop (final Personal disc), the voice model downloaded for T-MO-03 |
| Vultr | T-VU-01 to 04 | Vultr from the Linux build machine with `tracks/vultr/up.ts` (T-VU-01, 02; blur the account and bucket names in the edit); T-VU-03 a local terminal; T-VU-04 browser and terminal against the live cloud box |

**Model credit.** T-FA-01, T-AN-02 to 04, T-FE (the Droid fix) and T-CB-01 (a real agent buying) run real Droid with
Claude. Factory credit was short on Oct 24; record those first, once, and reuse the takes.

## Storage

Raw takes: `docs/video/studio/assets/capture/` and rendered files `docs/video/studio/renders/`, both git-ignored.
Only `takes.md`, the scripts and the compositions are committed.
