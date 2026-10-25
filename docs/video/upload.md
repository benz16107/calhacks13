# Upload package

Ready to paste into YouTube (or Vimeo). Upload as **Unlisted**, then put the main video's link in Devpost's video
field and each id in `showcase/src/data/videos.ts` (`../videos.md`, "After uploading"). The files are in
`docs/video/out/` on the machine that rendered them (git-ignored; `out/INDEX.md` lists them).

For each video, upload `<name>.mp4` and add `<name>.srt` as English subtitles. The captions are also burned in, so
the .srt is for search and for viewers who want them larger. `<name>-no-music.mp4` is the same cut without the music
bed, in case a platform or judge prefers it.

## Main video: Devpost

**File:** `out/main.mp4` (2:58.7). **Thumbnail:** `out/main-thumb.jpg`. **Captions:** `out/main.srt`.

**Title:** GurtOS: operating systems built for AI agents

**Description:**

```text
GurtOS: operating systems built for AI agents. Each task runs as its own Linux user, in its own copy-on-write copy of your files, with no keys. Undo any task, approve spending from your phone. Built solo by Ben Zhou for Cal Hacks 13.

Try it live in your browser: https://try.gurtos.com (your own throwaway GurtOS computer; paste an attack and watch it stopped).

Every screen is the real product: a test computer running GurtOS from main on Oct 24 and 25, 2026, the live gurtos.com site, and the signed v0.1.0-preview Server disc booting and installing in a VM (sped up). The agents in moments 1 to 4 are scripted so they do the same steps every take; real Droid runs with Claude are in the merge gate. All payments are test money.

Narration: Ben's own voice, cloned with ElevenLabs. Music: generated with MusicGen.

Sources for the numbers on screen: GitHub API (Oct 23, 2026), Censys (Jan 2026), Koi Security (341 of 2,857 ClawHub skills), CVE-2026-25253, the attack scoreboard in the repo (tracks/armadin/SCOREBOARD.md), and measurements from Oct 24 (a 1 GB Vultr machine; Personal against stock Ubuntu 24.04).

Download the signed discs: https://gurtos.com/download/
Docs, from the architecture to the security model and the APIs: https://gurtos.com/docs/
Code (Apache-2.0): https://github.com/benz16107/calhacks13
Every Cal Hacks track, with its evidence: https://calhacks.gurtos.com
Home: https://gurtos.com

0:00 GurtOS, and the problem
0:16 Why an operating system
0:33 GurtOS: each task its own user and copy of your files
0:48 Three editions: Server, Personal, Business
0:59 Moment 1: undo one task
1:09 Moment 2: the booby-trapped page
1:20 Moment 3: a pause for your OK
1:33 Moment 4: pull the plug
1:47 Security, with the score published
2:03 Light, and live from any device
2:22 Try it: signed discs at gurtos.com/download, and every part documented
2:39 A suite, open source
```

## Armadin: Best Security Hack

**File:** `out/armadin.mp4` (1:18.6). **Thumbnail:** `out/armadin-thumb.jpg`.

**Title:** GurtOS for Armadin: Best Security Hack

**Description:**

```text
Agents get attacked through the pages they read and the packages they install. GurtOS stops those attacks at the operating system, whatever the model does: each task is its own Linux user with no keys, its own copy of the files and its own network rule. We publish the score, gaps included: 16 OS-level attacks, 15 caught, 1 not covered, on two machines.

Every screen is the real product, recorded on a test computer running GurtOS from main on Oct 24 and 25, 2026. The attacking agents are scripted so they do the same steps every take. The poisoned package is a harmless imitation installed with a real npm install. The payment case is a made-up company with a test bank (Capital One's Nessie) and test money. The phone screenshots are from Apple's iOS simulator.

Narration: Ben's own voice, cloned with ElevenLabs. Music: generated with MusicGen.

Sources: CISA alert, Sept 23, 2025 (cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem); the attack scoreboard (tracks/armadin/SCOREBOARD.md).

The Armadin page, with every attack and its evidence: https://calhacks.gurtos.com/tracks/armadin/
Code (Apache-2.0): https://github.com/benz16107/calhacks13

0:00 The problem
0:15 A real npm worm, and our harmless copy
0:26 The booby-trapped page, and tripwire keys
0:45 A hijacked payment
0:55 The sandbox, and what is not built
1:06 The published score
```

## When a standout feature lands

The chapters above are for the cuts without slots. A slot moves later chapters; rebuild prints the new start of each
beat (`grep data-start build/<id>/index.html`), so update the chapter lines and re-upload as a new version.
