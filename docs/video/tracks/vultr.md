# Vultr: the parts that must be public or big (1:00)

**Track:** MLH, Best use of Vultr. **Edition:** GurtOS Server. **Shares footage with:** main (O01, A05). **Status:** draft for Ben's approval.

## Creative brief

A build-and-boot timelapse on a cloud box. An elapsed clock and a progress bar run through the whole film, from install to boot to restore, so it reads as one clock. After the card, full-bleed `vultr-box.png` shows the real Server screen on the Vultr instance, with the ordinary server's problem as a typewriter header (paragraph 1). Paragraph 2 types the instance size, then plays `disc-install.mp4` at about 2x with the clock climbing toward five minutes and the real installer progress as the build bar, labelled "Disc in a VM. Sped up". A directional wipe and a flash land on `vultr-installer.png` and `disc-booted.png`. Paragraph 3 builds a backup bar, rolls 2.8 s, and holds the waiting task in `a05.mp4` from 21.2. Paragraph 4 types the Vultr jobs line by line in a terminal. Paragraph 5 whips to `mana-live.png`, stamps CLOSED on the rest of the API, and rolls 3 tests and under $0.20. One zoom, on the installer line in `disc-install.mp4`. Music bed: build.

Footage: vultr-box.png, disc-install.mp4, vultr-installer.png, showcase/src/assets/track/vultr/disc-booted.png, a05.mp4, showcase/src/assets/track/vultr/mana-live.png

**Goal.** Show that GurtOS Server is a real operating system that installs and runs on a small Vultr instance, and that Vultr runs the pieces that have to be public or big. A judge sees the real release disc install on 1 vCPU and 1 GB, an encrypted backup restored with a waiting task still waiting, and the cloud box answering its public routes while the rest of its API stays closed. All three live tests cost under $0.20.

**Rubric map.**

| MLH Vultr asks for | Where |
|---|---|
| Boot the real thing on Vultr | Beat 2 (disc installed in about 5 minutes) |
| Use Vultr services well | Beats 3 and 4 (Object Storage, firewall from code, build machine, mirror, relay) |
| A working product on Vultr | Beat 5 (gurt-cloud.box.gurtos.com) |
| Cost awareness | Beat 5 (under $0.20 for three live tests) |

## Shot list

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:08 | G-VU-1: the Hills; two lines, then a Linux user list on an ordinary cloud server, one user holding every key | An ordinary cloud server: every agent is one user holding every key | "An agent computer should be reachable around the clock without exposing everything. On an ordinary cloud server, every agent runs as one user holding every key." | The problem (`docs/story.md`, Vultr) |
| 2 | 0:08 to 0:22 | T-VU-01: the Vultr instance page (vc2-1c-1gb: 1 vCPU, 1 GB) with the GurtOS ISO attached; the installer timelapse; the disc detached; the instance reboots from its own disk to the first-boot wizard. O01's QEMU installer can fill any gap, labelled | Real GurtOS Server release disc · vc2-1c-1gb: 1 vCPU, 1 GB · installed in about 5 minutes · back up from its own disk, disc detached | "We installed the real Gurt O.S. Server disc on a Vultr instance with one v C P U and one gigabyte. About five minutes later it booted from its own disk, disc detached." | Boot the real disc on Vultr from a script, merged (ee11781); live: installed in about 5 minutes on vc2-1c-1gb, first-boot wizard shown |
| 3 | 0:22 to 0:34 | T-VU-02: a task waiting for an OK on the box screen; "back up" run; the encrypted object listed in Object Storage (ciphertext only); a fresh instance; restore; the timer reads 2.8 s; the task is still on "Waiting for me"; Approve; it finishes | Encrypted with age, the owner holds the key · Vultr holds only ciphertext · restored onto a fresh instance in 2.8 s · the waiting task still waiting | "State backs up encrypted to Object Storage, and the owner holds the key. Restored onto a fresh instance in two point eight seconds, a waiting task was still waiting." | Encrypted backup and restore, merged (ee11781); live: restore in 2.8 s, finished task stayed done, waiting task came back waiting and finished after an OK |
| 4 | 0:34 to 0:46 | G-VU-2: a map of the Vultr parts as five labelled rows with real names: relay (1 vCPU, 1 GB instance) for name.box.gurtos.com, release build machine (a fresh vc2-4c-8gb per release), Object Storage mirror with signed SHA256SUMS, firewall group set from code, the always-on cloud box. T-VU-03a: the firewall refusing a rule set that opens the API port | Relay for <name>.box.gurtos.com · release discs built on Vultr, mirrored with signed checksums · firewall set from code: refuses a rule set with no ssh source, wider than /8, or opening 7700 or 3000 | "Vultr also runs the relay for every box address, builds the release discs and mirrors them with signed checksums. The firewall is set from code." | Relay merged (6cdeb9a, "relay refuses other names and raw ports"); mirror checked by QA Oct 24 (signature and checksums); firewall proven on a live instance (the box's own `PUT /t/vultr/firewall` route is only tested against stubs, so the capture uses the script path) |
| 5 | 0:46 to 1:00 | T-VU-04: gurt-cloud.box.gurtos.com: the Jira issue that ran there, the Mana app and an x402 sale route answer (labelled TEST NETWORK), then a curl against a closed API route is refused; the cost card; end card G08 | gurt-cloud.box.gurtos.com · answers Jira, Mana, x402 buyers (test network) · everything else closed · 3 live tests, under $0.20 · GurtOS · open source, Apache-2.0 | "The cloud box answers Jira, Mana and X four oh two buyers on a test network, and the rest of its API stays closed. Three live tests cost under twenty cents. Gurt O.S. is open source." | The always-on public box, live (Jira issues BOX-1 to BOX-5 ran here); QA confirmed its public routes answer and the rest stay closed; cost: under $0.20 for three live tests (story proof) |

**What comes from the OS and what from Vultr.** From the OS: the installer, the A/B system slots, the age encryption, the per-task users, the routes that open without a paired phone. From Vultr: the instance, Object Storage, the firewall groups, the build machine and the relay host.

**Cut list if long:** beat 4's firewall refusal clip (keep the map); beat 3's Object Storage listing.

## Narration (exact text for ElevenLabs)

Word count: 149 (about 1:04).

```text
An agent computer should be reachable around the clock without exposing everything. On an ordinary cloud server, every agent runs as one user holding every key.

We installed the real Gurt O.S. Server disc on a Vultr instance with one v C P U and one gigabyte. About five minutes later it booted from its own disk, disc detached.

State backs up encrypted to Object Storage, and the owner holds the key. Restored onto a fresh instance in two point eight seconds, a waiting task was still waiting.

Vultr also runs the relay for every box address, builds the release discs and mirrors them with signed checksums. The firewall is set from code.

The cloud box answers Jira, Mana and X four oh two buyers on a test network, and the rest of its API stays closed. Three live tests cost under twenty cents. Gurt O.S. is open source.
```

## Captures this video needs

Shared (see `capture.md`): O01 (optional, fills a gap in beat 2), A05 (optional), G08. Animation cards: G-VU-1 (the one-user cloud server), G-VU-2 (the map of Vultr parts). Its own:

| ID | What | Machine and state | Steps |
|---|---|---|---|
| T-VU-01 | The disc install on a 1 vCPU, 1 GB instance | Vultr account with test credit; `tracks/vultr/up.ts` from the Linux build machine; the release Server disc by URL | Record the Vultr console and the install; note the wall-clock time; detach the disc; reboot; stop on the first-boot wizard. Hide the account menu, instance ids and the instance's address |
| T-VU-02 | Encrypted backup and restore | Two Vultr instances and an Object Storage bucket (names off screen), one box with a task waiting | Back up; list the object (ciphertext); create a fresh instance; restore; read the 2.8 s line; show Waiting for me; Approve. Blur bucket and key names |
| T-VU-03 | The firewall refusal | Local terminal against the firewall code path | Run the rule-set check with a set that opens 7700; show the refusal message |
| T-VU-04 | The public cloud box | A browser and a terminal; the live box | Show the Jira issue and the Mana app route answering, an x402 route answering on the test network, and a closed API route refused |

## Check before render

- "About 5 minutes", "2.8 s" and "under $0.20" are read from the Vultr thread's log at render time. Do not say a different figure.
- No instance id, address, bucket name, key or account name in any frame. gurt-cloud.box.gurtos.com and the `<name>.box.gurtos.com` pattern are public and fine.
- The x402 route is on a test network; keep "TEST NETWORK" on screen while it shows.
- `age` is in the image from the next build, not in the published ISOs. State the restore as run on the Vultr thread's box and do not imply the published disc ships it.
- Do not mention Vultr Serverless Inference or the GoDaddy prize. Both are not pursued.
