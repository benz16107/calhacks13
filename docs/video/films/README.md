# Writing a video spec

One file per video: `films/<id>.mjs`, where `<id>` is the script's name (`tracks/<id>.md`). `node build.mjs <id>`
turns it, the voice (`studio/assets/vo/<id>/NN.wav` and `.json`, made by `narration/say.py`) and the media into a
HyperFrames project in `build/<id>/`. Read `main.mjs` and `armadin.mjs` first: they are the approved style.

## Shape

```js
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
export default {
  title: 'GurtOS for Hyphenate: the credit desk',      // the YouTube title
  edition: 'business',                                 // colours the lower-third rule: server | personal | business
  maxDur: 90,                                          // the build fails over this (Fetch.ai 300, Figma 180)
  music: 'bed-calm-long.wav',                          // bed-hopeful-long | bed-calm-long | bed-tense-long
  card: { sponsor: 'Hyphenate', track: 'Autonomous Systems for Finance', editions: ['business'] },
  beats: [ /* one per narration paragraph, in order */ ],
};
```

- **The card** is the 2.6 s title card every track video opens with; its frame is the thumbnail. `track` is the
  sponsor's own track name. `editions` lights the chips under "Best shown in".
- **A beat** takes the next narration paragraph. Its length is the voice plus `pre` (0.3 s), `post` (0.45 s) and
  `hold` (extra seconds of picture after the voice; use it on a moment that needs to land).
- `{ v: {...} }` is one picture for the whole beat. `{ parts: [{ v }, { cue: 'word', v }, ...] }` cuts to the next
  picture when the voice says `word` (the first spoken word starting with it; `after: 'earlier'` searches after
  another word; `off: 0.3` shifts it). The first part starts with the beat.
- **Slots** (standout features, only once merged; `slots.json` lists the ready ones):
  `{ insert: 'flight-recorder', v: {...} }` is an extra beat voiced by `slot-flight-recorder` (from the script's
  "Slot narration"). It is left out when the slot is not ready. Ready now: `flight-recorder`, `permissions`.
- **Media**: `cap:<file>` (a recording in `studio/assets/capture/`, git-ignored), `repo:<path>` (any image in the
  repo), `brand:<file>`.

## Visual types

| type | What | Main options |
|---|---|---|
| `clip` | A recording in a window frame | `src`, `from` (seconds into the file), `rate`, `crop {x,y,w,h}`, `moves`, `lt`, `note`, `drift: false` |
| `split` | Two crops of one recording side by side | `src`, `from`, `crops [{x,y,w,h,cx,bw,radius}]` (see main's moment 3) |
| `stills` | Real screenshots, one or a row | `src` (one) or `items [{src, device: window|phone|watch|bare, label, cue, hf}]`, `h`, `moves` (one), `lt`, `note` |
| `lines` | Big text lines on the Hills, each on its word | `lines [{text, cue, dim, mono, blocked}]`, `kicker`, `strike`, `size`, `source`, `sourceAt` |
| `stats` | Numbers with labels and a source | `items [{n, label, cue}]`, `cols`, `size`, `source`, `sourceAt`, `srcTop` |
| `layers` | The copy-on-write diagram | see `main.mjs` |
| `board` | The attack scoreboard | see `main.mjs` |
| `suite` | The suite ring | see `main.mjs` |
| `title` | GurtOS title card | `title`, `subtitle`, `editions` |
| `end` | End card | `lines` (strings, or `{slot, text}`) |
| `black` | A cut to black | |

- **moves** (camera): `[{ at | cue, s: 1.5, px: 0.4, py: 0.3, d: 0.6 }]`: scale `s`, framing the point at
  `px, py` (fractions of the picture). The frame never shows an edge.
- **lt** (lower third, top-left of the frame): `{ kicker, title, edition?, t?, dur? }`. Kicker is small mono, title bold.
- **note** (footnote, bottom-left inside the frame): "Scripted agent: same steps every take", "Test money",
  "iOS simulator: ...". Required wherever the script says so.

## Rules (Ben's, and the checks)

- Real product only: a recording or a real screenshot. Never draw UI. Animation only for text cards and diagrams.
- Every number, name and claim on screen comes from the script, `docs/story.md`, `docs/features.md` or the showcase
  page, with its source line where the script has one. Test money says TEST; scripted agents carry the note.
- No em or en dashes anywhere; plain words; sentence case. Text at least 28 px.
- Never show a pairing code or QR, a key, an email, a machine name or an IP other than 127.0.0.1 / 1.1.1.1.
- After `node build.mjs <id>`: run `npx --yes hyperframes@0.8.193 check --json` in `build/<id>` and fix every error
  and every `line_unread` / `text_below_floor` / `content_overlap`; then `snapshot --at <times>` across every beat and
  look at the frames. Fix and repeat until clean. `node build.mjs <id> --render` and `python3 qc.py out/<id>.mp4 --max N`
  make and check the file.

## Track formats (Oct 25, after Ben's notes)

Ben: "Too many of the same animation, the zoom-in effect" and "different sponsor tracks should get very different
taste, style and format." Each track's brief is the `## Creative brief` section of `tracks/<id>.md`; `tracks/BRIEFS.md`
lists them. `films/hyphenate.mjs` is the worked example (a case file). The types live in `kit.mjs`:

| type | what it is | key fields |
|---|---|---|
| `shot` | one recording or screenshot | `src`, `from`, `rate`, `crop`, `frame: full / window / paper / tilt / bare`, `box`, `enter`, `marks`, `stamp(s)`, `pip`, `lt`, `note`, `rot` |
| `pair` | two sources side by side | `items: [shot fields + label, color]`; the second wipes in on its `cue` |
| `caseboard` | pin board | `items: [{ kind: card / photo / note, x, y (top centre, px), w, rot, cue }]`, `strings: [{ from, to, cue }]`, `stamps` |
| `dossier` | case file card | `tab`, `title`, `sub`, `fields: [{ k, v, cue, flag: bad / ok }]`, `photo` |
| `exhibit` | paper document | `label`, `lines: [{ text, cue, mark, dim }]`, `source` |
| `timeline` | dots on a dated axis | `from`, `to`, `dots: [0..1]`, `count`, `label`, `source` |
| `scoreboard` | tiles with rolling digits | `items: [{ n, of, label, cue, color }]`, `source` |
| `terminal` | typed commands and output | `title`, `lines: [{ text, cmd, kind: out / ok / bad / warn, cue }]`, `alarms: [{ cue }]` |
| `chat` | message bubbles | `messages: [{ from: 'me' / other, who, text, kind: quote / bad / ok, cue }]` |
| `ledger` | payment rows building | `rows: [{ when, what, amount, status, cue }]`, `total`, `source` |

- `enter`: cut, fade, whip-l, whip-r, wipe, wipe-down, iris, drop, slide-up, flip. Vary them; a hard cut is fine.
- `marks`: `{ cue, kind: circle / box / underline / arrow / spot, x, y, w, h (fractions of the crop), color, label, side, labelW }`.
  Measure positions on a full-size frame (`ffmpeg -ss T -i f.mp4 -frames:v 1 -vf crop=...`), never guess.
- `stamp`: `{ text, cue, color: blocked / done / amber, x, y (fractions of the shot), rot, size, box: 'frame' }`. Use one or
  two per video at most, on the words that earn them.
- No camera moves unless the brief names that one zoom: `moves` is opt-in on `shot` (`drift` is off).
- A `cue` matches the first spoken word in the paragraph that starts with it. Repeated words need `after`.
- Pinned photos on a board should be stills (a frame grabbed into `studio/assets/capture/<name>.png`): a late-starting
  video inside a board showed black frames. Check every video shot's first and last second in snapshots.
- Keep each text on screen long enough to read (the check's `line_unread` warnings), labels at 28 px or more.
- Lengths stay as before (`maxDur`); the narration files do not change. `style: { bg }` sets the default ground:
  plain, hills, board, grid, desk, night. `music` names a bed in `studio/assets/music/` (`bed-<name>-long.wav`).
