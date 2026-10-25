#!/usr/bin/env python3
"""Make a video's narration in Ben's cloned voice, one clip per paragraph.

    say.py <script.md> [--model eleven_multilingual_v2] [--only 3] [--count]

Reads the ```text block under "## Narration" in a script (main.md or tracks/<name>.md) and writes
docs/video/studio/assets/vo/<name>/<nn>.mp3, one per paragraph, so one line can be redone alone.
Each request passes the paragraphs around it as previous_text/next_text, so the takes join up.
--count prints characters only and calls nothing. Needs ELEVENLABS_API_KEY (the private env file named in the ops notes).
The voice files stay out of git (studio/.gitignore): this repo is public.
"""
import json, os, re, sys, urllib.request
from pathlib import Path

VOICE = "CSWOX3djBEY4mlYbaQ2U"  # "Ben Zhou", instant clone
SETTINGS = {"stability": 0.5, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True}
# Spellings the clone says right. Scripts keep the readable form; only the spoken text changes.
SAY = [(r"\bGurtOS\b", "Gurt O.S."), (r"\bx402\b", "x four oh two"), (r"\bSpacetimeDB\b", "Spacetime D B")]


def paragraphs(md: str) -> list[str]:
    m = re.search(r"^## Narration.*?```text\n(.*?)```", md, re.S | re.M)
    if not m:
        sys.exit("no ```text block under a '## Narration' heading")
    text = m.group(1)
    for pat, rep in SAY:
        text = re.sub(pat, rep, text)
    return [p.strip().replace("\n", " ") for p in text.split("\n\n") if p.strip()]


def speak(text: str, prev: str, nxt: str, model: str, out: Path) -> int:
    body = json.dumps({"text": text, "model_id": model, "voice_settings": SETTINGS,
                       "previous_text": prev, "next_text": nxt}).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128", body,
        {"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "content-type": "application/json"})
    with urllib.request.urlopen(req) as r:
        out.write_bytes(r.read())
        return int(r.headers.get("character-cost", 0))


def selftest() -> None:
    md = "## Narration (exact)\n\n```text\nGurtOS pays with x402.\n\nSecond\nline.\n```\n"
    assert paragraphs(md) == ["Gurt O.S. pays with x four oh two.", "Second line."], paragraphs(md)


def main() -> None:
    args = sys.argv[1:]
    if args == ["--selftest"]:
        return selftest()
    if not args:
        sys.exit(__doc__)
    script = Path(args[0])
    model = args[args.index("--model") + 1] if "--model" in args else "eleven_multilingual_v2"
    only = int(args[args.index("--only") + 1]) if "--only" in args else None
    paras = paragraphs(script.read_text())
    chars = sum(len(p) for p in paras)
    print(f"{script.stem}: {len(paras)} paragraphs, {chars} characters, {sum(len(p.split()) for p in paras)} words")
    if "--count" in args:
        return
    out_dir = Path(__file__).resolve().parent.parent / "studio/assets/vo" / script.stem
    out_dir.mkdir(parents=True, exist_ok=True)
    spent = 0
    for i, p in enumerate(paras, 1):
        if only and i != only:
            continue
        prev, nxt = (paras[i - 2] if i > 1 else ""), (paras[i] if i < len(paras) else "")
        spent += speak(p, prev, nxt, model, out_dir / f"{i:02d}.mp3")
        print(f"  {i:02d}.mp3  {p[:60]}")
    print(f"credits charged: {spent}")


if __name__ == "__main__":
    main()
