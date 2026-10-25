# Upload package

Ready to paste into YouTube (or Vimeo). Upload as **Unlisted**, then put the main video's link in Devpost's video
field and each id in `showcase/src/data/videos.ts` (`../videos.md`, "After uploading"). The files are in
`docs/video/out/` on the machine that rendered them (git-ignored; `out/INDEX.md` lists them).

For each video, upload `<name>.mp4` and add `<name>.srt` as English subtitles. The captions are also burned in, so
the .srt is for search and for viewers who want them larger. `<name>-no-music.mp4` is the same cut without the music
bed, in case a platform or judge prefers it.

## Main video: Devpost

**File:** `out/main.mp4` (2:57). **Thumbnail:** `out/main-thumb.jpg`.

**Title:** GurtOS: operating systems built for AI agents (Cal Hacks 13)

**Description:**

```text
GurtOS: operating systems built for AI agents. Each task runs as its own Linux user, in its own copy-on-write copy of your files, with no keys. Undo any task, approve spending from your phone. Built solo by Ben Zhou for Cal Hacks 13.

Every screen is the real product, recorded on a test computer running GurtOS from main on Oct 24 and 25, 2026. The agents in moments 1 to 4 are scripted so they do the same steps every take; real Droid runs with Claude are in the merge gate. All payments are test money.

Narration: Ben's own voice, cloned with ElevenLabs. Music: generated with MusicGen.

Sources for the numbers on screen: GitHub API (Oct 23, 2026), Censys (Jan 2026), Koi Security (341 of 2,857 ClawHub skills), CVE-2026-25253, and the attack scoreboard in the repo (tracks/armadin/SCOREBOARD.md).

Every track, with its evidence: https://calhacks.gurtos.com
Docs and downloads: https://gurtos.com
Code (Apache-2.0): https://github.com/benz16107/calhacks13

0:00 The problem
0:18 Why an operating system
0:35 GurtOS: each task its own user and copy of your files
0:56 Three editions: Server, Personal, Business
1:14 Moment 3: a pause for your OK
1:28 Moment 2: the booby-trapped page
1:40 Moment 1: undo one task
1:50 Moment 4: pull the plug
2:03 Security, with the score published
2:18 Light enough for old hardware
2:30 Live from any device, a suite, open source
```

## Armadin: Best Security Hack

**File:** `out/armadin.mp4` (1:16). **Thumbnail:** `out/armadin-thumb.jpg`.

**Title:** GurtOS for Armadin: attacks GurtOS stops at the OS

**Description:**

```text
Agents get attacked through the pages they read and the packages they install. GurtOS stops those attacks at the operating system, whatever the model does: each task is its own Linux user with no keys, its own copy of the files and its own network rule. We publish the score, misses included: 16 OS-level attacks, 14 caught, 2 not covered, on two machines.

Every screen is the real product, recorded on a test computer running GurtOS from main on Oct 24 and 25, 2026. The attacking agents are scripted so they do the same steps every take. The poisoned package is a harmless imitation installed with a real npm install. The payment case is a made-up company with a test bank (Capital One's Nessie) and test money. The phone screenshots are from Apple's iOS simulator.

Narration: Ben's own voice, cloned with ElevenLabs. Music: generated with MusicGen.

Sources: CISA alert, Sept 23, 2025 (cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem); the attack scoreboard (tracks/armadin/SCOREBOARD.md).

The Armadin page, with every attack and its evidence: https://calhacks.gurtos.com/tracks/armadin/
Code (Apache-2.0): https://github.com/benz16107/calhacks13

0:00 The problem
0:13 A real npm worm, and our harmless copy
0:24 The booby-trapped page, and tripwire keys
0:43 A hijacked payment
0:53 The sandbox, and what is not built
1:03 The published score
```

## When a standout feature lands

The chapters above are for the cuts without slots. A slot moves later chapters; rebuild prints the new start of each
beat (`grep data-start build/<id>/index.html`), so update the chapter lines and re-upload as a new version.
