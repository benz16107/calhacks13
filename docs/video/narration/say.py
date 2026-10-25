#!/usr/bin/env python3
"""Make a video's narration in Ben's cloned voice, one clip per paragraph.

    say.py <script.md> [--model eleven_multilingual_v2] [--only 3] [--count] [--force] [--slots]

Reads the ```text block under "## Narration" in a script (main.md or tracks/<name>.md) and writes
docs/video/studio/assets/vo/<name>/<nn>.mp3, one per paragraph, so one line can be redone alone.
Each request passes the paragraphs around it as previous_text/next_text, so the takes join up.
--count prints characters only and calls nothing. Needs ELEVENLABS_API_KEY (the private env file named in the ops notes).
The voice files stay out of git (studio/.gitignore): this repo is public.
"""
import base64, json, os, re, subprocess, sys, urllib.request
from pathlib import Path

VOICE = "CSWOX3djBEY4mlYbaQ2U"  # "Ben Zhou", instant clone
SETTINGS = {"stability": 0.5, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True}
# Spellings the clone says right. Scripts keep the readable form; only the spoken text changes.
SAY = [(r"\bGurtOS\b\.?", "Gurt O.S."), (r"\bx402\b", "x four oh two"), (r"\bSpacetimeDB\b", "Spacetime D B")]


def paragraphs(md: str) -> list[str]:
    m = re.search(r"^## Narration.*?```text\n(.*?)```", md, re.S | re.M)
    if not m:
        sys.exit("no ```text block under a '## Narration' heading")
    text = m.group(1)
    for pat, rep in SAY:
        text = re.sub(pat, rep, text)
    return [p.strip().replace("\n", " ") for p in text.split("\n\n") if p.strip()]


def speak(text: str, prev: str, nxt: str, model: str, out: Path) -> int:
    """Writes out (mp3), out.json (character timings, for captions) and out.wav (normalized to -16 LUFS)."""
    body = json.dumps({"text": text, "model_id": model, "voice_settings": SETTINGS,
                       "previous_text": prev, "next_text": nxt}).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128", body,
        {"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "content-type": "application/json"})
    with urllib.request.urlopen(req) as r:
        d = json.load(r)
        cost = int(r.headers.get("character-cost", 0))
    out.write_bytes(base64.b64decode(d["audio_base64"]))
    out.with_suffix(".json").write_text(json.dumps({"text": text, "alignment": d["alignment"]}))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ar", "48000", "-ac", "2", str(out.with_suffix(".wav"))], check=True)
    return cost


def slot_texts(md: str) -> dict:
    """The '#### <slot id>' text blocks under '### Slot narration': lines said only once their feature is merged."""
    sec = md.split("### Slot narration", 1)
    found = re.findall(r"^#### ([a-z-]+)\s*```text\n(.*?)```", sec[1], re.S | re.M) if len(sec) > 1 else []
    out = {}
    for k, v in found:
        for pat, rep in SAY:
            v = re.sub(pat, rep, v)
        out[k] = v.strip().replace("\n", " ")
    return out


def selftest() -> None:
    md = "## Narration (exact)\n\n```text\nGurtOS pays with x402.\n\nSecond\nline.\n```\n"
    assert paragraphs(md) == ["Gurt O.S. pays with x four oh two.", "Second line."], paragraphs(md)
    assert slot_texts(md + "### Slot narration\n\n#### try-live\n\n```text\nTry GurtOS.\n```\n") == {"try-live": "Try Gurt O.S."}


def main() -> None:
    args = sys.argv[1:]
    if args == ["--selftest"]:
        return selftest()
    if not args:
        sys.exit(__doc__)
    script = Path(args[0])
    model = args[args.index("--model") + 1] if "--model" in args else "eleven_multilingual_v2"
    only = int(args[args.index("--only") + 1]) if "--only" in args else None
    if "--slots" in args:
        # Only the slots marked ready in slots.json: a feature is said once it is merged and recorded.
        ready = json.loads((Path(__file__).resolve().parent.parent / "slots.json").read_text())
        todo = {k: v for k, v in slot_texts(script.read_text()).items() if k in ready}
        out_dir = Path(__file__).resolve().parent.parent / "studio/assets/vo" / script.stem
        out_dir.mkdir(parents=True, exist_ok=True)
        spent = sum(speak(v, "", "", model, out_dir / f"slot-{k}.mp3") for k, v in todo.items()
                    if "--force" in args or not (out_dir / f"slot-{k}.json").exists())
        print(f"{script.stem}: slots {sorted(todo) or 'none ready'}; credits charged: {spent}")
        return
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
        # Takes cost credits: keep one already made unless asked again (--force or --only).
        if (out_dir / f"{i:02d}.json").exists() and "--force" not in args and not only:
            continue
        prev, nxt = (paras[i - 2] if i > 1 else ""), (paras[i] if i < len(paras) else "")
        spent += speak(p, prev, nxt, model, out_dir / f"{i:02d}.mp3")
        print(f"  {i:02d}.mp3  {p[:60]}")
    print(f"credits charged: {spent}")


if __name__ == "__main__":
    main()
