# Narration plan

**Voice:** Ben's instant clone on ElevenLabs, "Ben Zhou" (voice id in `narration/say.py`). Access granted Oct 24;
the API key "gurtos-videos" can only do text to speech and read voices. It lives in `ELEVENLABS_API_KEY` in
the private env file named in the ops notes (mode 600), never in the repo.

**The exact text** of each video is the ```text block under "Narration" in its script (`main.md`,
`tracks/<name>.md`). The scripts are the one source; nothing is copied here.

## How to make a video's voice

```sh
ENV_FILE=...   # the private env file named in the ops notes
set -a; . "$ENV_FILE"; set +a
docs/video/narration/say.py docs/video/main.md --count          # characters and words, no call
docs/video/narration/say.py docs/video/main.md                  # every paragraph -> studio/assets/vo/main/NN.mp3
docs/video/narration/say.py docs/video/main.md --only 7         # redo one paragraph
docs/video/narration/say.py --selftest                          # checks the text parser
```

One clip per paragraph, each sent with the paragraphs around it (`previous_text`, `next_text`) so the takes join up.
In the edit each clip starts at its beat; the voice is the clock (`studio/` follows the shot list's beats).

**Settings:** model `eleven_multilingual_v2`, stability 0.5, similarity 0.8, style 0, speaker boost on. Normalize each
video's voice to -15 LUFS with `npx hyperframes normalize-audio --target=<id> --lufs=-15 --write`; music sits at about
0.14 under it.

## Pronunciation

| Written | Said | How |
|---|---|---|
| GurtOS | "Gurt O S" | Written as `Gurt O.S.` in narration. Plain "GurtOS" came out as "Girdos" in the first test (Whisper's reading); `Gurt O.S.` came back as "Gert OS". Ben approved "Gurt O.S." on Oct 24. |
| x402 | "x four oh two" | `say.py` swaps it |
| SpacetimeDB | "Spacetime D B" | `say.py` swaps it |
| ASI:One, CRS, TAP, Apify, Nessie, Agentverse, Kibana | check by ear | Listen to each video's first take; add a swap to `SAY` in `say.py` for any it gets wrong |

Numbers are written as words in the narration ("two hundred seventy-one milliseconds") so the clone never reads a
digit string its own way.

## Credits

Starter plan, 30,000 credits a month, about 23,300 left on Oct 24 (renews Nov 9); Ben added more credits on Oct 24. The key cannot read the balance;
check elevenlabs.io/app/subscription. Measured from the `character-cost` header on Oct 24:
`eleven_multilingual_v2` charged 42 credits for 105 characters (0.4 a character), `eleven_flash_v2_5` 21 (0.2).

| Video | Characters | Words |
|---|---|---|
| main | 2,467 | 451 |
| fetch | 2,372 | 448 |
| figma | 1,988 | 335 |
| hyphenate | 1,335 | 235 |
| coinbase-solana | 1,154 | 209 |
| atlassian-t2 | 1,133 | 208 |
| microsoft | 1,101 | 185 |
| armadin | 1,013 | 178 |
| visa | 1,008 | 187 |
| factory | 951 | 174 |
| atlassian-t1 | 942 | 181 |
| spacetime | 922 | 165 |
| elastic | 915 | 163 |
| anthropic | 909 | 171 |
| crs | 858 | 150 |
| apify | 819 | 151 |
| vultr | 818 | 149 |
| moss | 810 | 151 |
| mana | 789 | 142 |
| **All 19** | **about 22,300** | |

One full pass on multilingual v2 is about 9,000 credits, so the balance covers every video plus a second full pass
for retakes. Re-run `--count` after script edits; the table is from the draft scripts.

**Pace.** The clone speaks fast: about 195 words a minute in the samples. Ben approved that pace on Oct 24. The
scripts are sized for it plus a pause between paragraphs. If Ben wants it slower, ElevenLabs' `speed` setting (0.7 to 1.2) goes in `SETTINGS`;
a slower voice needs shorter scripts, not longer videos.

## Fallback

If the ElevenLabs key stops working: HyperFrames' local voice (`npx hyperframes tts --voice am_michael`, Kokoro, free,
runs on the Linux build machine). It is not Ben's voice, so a video using it says so in its description. Use it for timing drafts
anyway, so no credits go on scripts that are still changing.

## Samples made on Oct 24 (in `studio/assets/vo/`, not in git)

- `sample-eleven_multilingual_v2.mp3`: "GurtOS is an operating system..." as plain "GurtOS".
- `sample-gurt-os.mp3` / `.wav`: the same line written "Gurt O.S."; this is the take in the 10-second test render.
- `sample-eleven_flash_v2_5.mp3`: the cheaper model, for comparison.
