# Review: the main video and Armadin (Oct 25, 2026)

## What is on screen, and where it came from

- **Live 60 fps recordings** of a throwaway box running main (`showcase/scripts/clips/clip-box.sh`, scripted
  workers, test money): the box screen, moment 3 (box screen and phone recorded side by side in sync,
  `capture/split.html`), moments 2, 1 and 4, a task page, the booby-trapped page with all four refusals, the poisoned
  npm package undone by the tripwire, and the lookalike-bank payment. Driver: `capture/shots.mjs`; recorder:
  `capture/x11rec.sh`.
- **Real screenshots, used as stills with camera moves:** the three editions (gurtos.com's own captures), a real
  Droid-with-Claude task, the native apps (Apple's simulators; the footnote says so), the Vultr install (cropped to the
  machine's screen; the first-boot screen was not used because it shows a pairing code).
- **Animation** only where there is no screen: the sourced numbers, the outdated-OS list, the overlay layers, the
  attack scoreboard, the sandbox values, the suite map, the title and end cards.
- **The phone in moment 3** is the portal's phone layout (app.gurtos.com) in a browser, not the native iPhone app.

## Measured, and only looked at

- Measured (`qc.py`, every file): format, length (main 2:57.03 under Devpost's 3:00), loudness (-16.0 to -16.4 LUFS,
  true peak -1.5 dBTP or lower), black frames (one, the planned power cut), silent stretches, OCR of one frame a second
  for dashes, private names, emails, IPs, keys and pairing codes, and the `.srt`.
- OCR flags on the main video, each checked by hand: `orders@freshmarket.example` on the Personal desktop screenshot
  (a reserved example domain), 1.1.1.1 misread twice, a stray dash read from the wallpaper. None is private.
- `hyperframes check` passes on both projects. Two warnings kept on purpose: moment 3 mounts one recording twice (two
  crops), and every caption sits on one track.
- Looked at, not measured: every beat on contact sheets before the render, and the rendered sheets after. **The sound
  was measured, never heard**: someone should listen once, especially to the music bed's level under the voice.

## Creative calls

- The voice is the clock: each beat is one narration paragraph, and visuals wait for spoken words.
- One look: the night Hills, Atkinson Hyperlegible, the OS's own colours (blue to act, amber for "needs you", red for
  blocked). Captions 52 px on a night pill, the spoken word brightens. Footnotes bottom-left inside the frame.
- Music: MusicGen beds (CC-BY-NC weights; non-commercial demo use), about 17 dB under the voice, a little higher
  between lines.

## Weakest shots

- Main, beat 12 (devices): five small, still screenshots. A live simulator recording of an approval on the iPhone and
  Watch would be stronger.
- Main, beat 5 (editions): stills of Personal and Business rather than recordings.
- Main, beat 13 (suite map): a ring of labels; it reads, but it is the least "real product" frame.

## Standout features

None of the five was on main at render time, so none is shown or said. Slots are wired: `slots.json` (empty now),
the "Slots" sections in `main.md`, `tracks/armadin.md` and 11 track scripts, and `say.py --slots`. Tested with
stand-ins: main 2:56.5 with both its slots in, Armadin 1:22.5.

## Found while capturing

- `portal/src/live.ts` line 585 sends `/approvals/${a.id}` without `encodeURIComponent`. An approval whose id holds
  a `?` (every `askq` request, such as the credit desk's AP clerk) cannot be answered from the box screen or the portal
  banner: "no approval ... Your answer did not go through." The service worker encodes it correctly. The Armadin take
  answers that request through the API instead.
