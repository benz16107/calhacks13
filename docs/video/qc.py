#!/usr/bin/env python3
"""Check a finished video before it goes out.

    qc.py docs/video/out/main.mp4 [--max 180]

Measures what can be measured and writes <name>.qc.txt and <name>-sheet.jpg next to the video:
  - format (1920x1080, 30 fps, H.264, AAC 48 kHz) and length (fails over --max seconds)
  - loudness (about -16 LUFS integrated, true peak at or under -1 dBTP) and silent stretches
  - black frames
  - text on screen, read by OCR once a second: no em or en dashes, no private names (the release
    check's list), no email addresses, no IP addresses except the public test ones the demos use,
    nothing that looks like a key or a pairing code
  - the .srt beside it: no dashes, times in order
OCR misses small or stylised text, so a clean result is evidence, not proof. Sound is measured, never heard.
"""
import json, os, re, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ALLOWED_IPS = {"127.0.0.1", "1.1.1.1", "8.8.8.8", "169.254.169.254", "0.0.0.0"}
PRIVATE = Path.home() / ".config/calhacks13/private-names"  # the release check's list, kept out of git


def run(*a):
    r = subprocess.run(a, capture_output=True, text=True)
    return r.stderr + r.stdout


def findings_in(text, names):
    out = []
    # A dash in a sentence sits between words; OCR also reads lone dashes from window controls and the wallpaper.
    out += [f"em or en dash: {m}" for m in re.findall(r"[A-Za-z0-9]+ ?[\u2014\u2013] ?[A-Za-z0-9]+", text)]
    low = text.lower()
    out += [f"private name ({n[:3]}...)" for n in names if n.lower() in low]
    out += [f"email {m}" for m in re.findall(r"[\w.+-]+@[\w-]+\.[\w.]+", text)]
    out += [f"IP {m}" for m in re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", text) if m not in ALLOWED_IPS]
    out += [f"key-like {m[:6]}..." for m in re.findall(r"\b(?:AKIA[0-9A-Z]{12,}|sk-[A-Za-z0-9_-]{16,}|xi-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,})", text)]
    out += [f"pairing-code-like {m}" for m in re.findall(r"\b[0-9A-Z]{4}-[0-9A-Z]{4}\b", text) if not re.fullmatch(r"\d{4}-\d{4}", m)]
    return out


def selftest():
    # Built here so the repo's privacy and secret scans do not read test values as real ones.
    mail, key = "a" + "@" + "b.example", "AKIA" + "ABCDEFGHIJKLMNOP"
    f = findings_in(f"Spend $8 \u2014 ok. mail {mail} 10.0.0.5 127.0.0.1 {key} 7Q4M-2KXD 2026-1024 tailbox", ["tailbox"])
    want = {"em or en dash: 8 \u2014 ok", "private name (tai...)", f"email {mail}", "IP 10.0.0.5", "key-like AKIAAB...", "pairing-code-like 7Q4M-2KXD"}
    assert set(f) == want, f
    assert findings_in("GurtOS on 1.1.1.1 and 127.0.0.1, Oct 24 2026 \u2014 ", []) == []
    print("selftest ok")


def main():
    if sys.argv[1:] == ["--selftest"]:
        return selftest()
    video = Path(sys.argv[1])
    limit = float(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else None
    names = [l.strip() for l in PRIVATE.read_text().splitlines() if l.strip() and not l.startswith("#")] if PRIVATE.exists() else []
    report, problems = [], []

    p = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels:format=duration",
                                   "-of", "json", str(video)], capture_output=True, text=True).stdout)
    dur = float(p["format"]["duration"])
    v = next(s for s in p["streams"] if s["codec_type"] == "video")
    a = next((s for s in p["streams"] if s["codec_type"] == "audio"), None)
    report.append(f"length {dur:.2f} s ({int(dur // 60)}:{dur % 60:05.2f}); video {v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']}; "
                  f"audio {a['codec_name'] + ' ' + a['sample_rate'] + ' Hz ' + str(a['channels']) + ' ch' if a else 'NONE'}")
    if (v["width"], v["height"], v["r_frame_rate"], v["codec_name"]) != (1920, 1080, "30/1", "h264"):
        problems.append("format is not 1920x1080 30 fps H.264")
    if not a:
        problems.append("no audio track")
    if limit and dur > limit:
        problems.append(f"length {dur:.1f} s is over {limit:.0f} s")

    e = run("ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-af", "ebur128=peak=true", "-f", "null", "-")
    lufs = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", e)[-1])
    tp = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", e)[-1])
    report.append(f"loudness {lufs:.1f} LUFS integrated, true peak {tp:.1f} dBTP")
    if not -18.5 <= lufs <= -13.5:
        problems.append(f"loudness {lufs:.1f} LUFS is outside -18.5 to -13.5")
    if tp > -1.0:
        problems.append(f"true peak {tp:.1f} dBTP is over -1")
    sil = re.findall(r"silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)", run("ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-af", "silencedetect=noise=-50dB:d=2.5", "-f", "null", "-"))
    report.append(f"silent stretches over 2.5 s: {len(sil)}" + (f" {[(round(float(x)), round(float(y))) for x, y in sil]}" if sil else ""))
    blk = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", run("ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-vf", "blackdetect=d=0.5:pix_th=0.06", "-an", "-f", "null", "-"))
    report.append(f"black stretches over 0.5 s: {len(blk)}" + (f" {[(float(x), float(y)) for x, y in blk]}" if blk else ""))
    if blk:
        problems.append("black frames (check each is meant: the power cut)")

    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-vf", "fps=1", f"{tmp}/f%04d.png"], check=True)
        frames = sorted(Path(tmp).glob("f*.png"))

        def ocr(f):
            return f, subprocess.run(["tesseract", str(f), "-", "--psm", "11"], capture_output=True, text=True).stdout

        hits = []
        with ThreadPoolExecutor(max_workers=6) as ex:
            for f, text in ex.map(ocr, frames):
                t = int(f.stem[1:]) - 1
                hits += [f"t={t}s {x}" for x in findings_in(text, names)]
        report.append(f"OCR: {len(frames)} frames read, {len(hits)} findings")
        report += [f"  {h}" for h in hits]
        problems += hits
        cols = 6
        step = max(1, len(frames) // 24)
        pick = frames[::step][:24]
        subprocess.run(["ffmpeg", "-v", "error", "-y", *sum([["-i", str(f)] for f in pick], []), "-filter_complex",
                        "".join(f"[{i}]scale=480:-1[s{i}];" for i in range(len(pick))) + "".join(f"[s{i}]" for i in range(len(pick))) +
                        f"xstack=inputs={len(pick)}:layout=" + "|".join(f"{(i % cols) * 480}_{(i // cols) * 270}" for i in range(len(pick))) + ":fill=black",
                        str(video.with_name(video.stem + "-sheet.jpg"))], check=True)

    srt = video.with_name(re.sub(r"-no-music$", "", video.stem) + ".srt")
    if srt.exists():
        s = srt.read_text()
        times = [tuple(x) for x in re.findall(r"(\d\d:\d\d:\d\d,\d\d\d) --> (\d\d:\d\d:\d\d,\d\d\d)", s)]
        order = all(a <= b for a, b in times) and all(times[i][1] <= times[i + 1][0] for i in range(len(times) - 1))
        report.append(f"srt: {len(times)} cues, in order: {order}, dashes: {bool(re.search('[\u2014\u2013]', s))}")
        if not order or re.search("[\u2014\u2013]", s):
            problems.append("srt problem")
    report.append("PASS" if not problems else f"{len(problems)} problems")
    out = video.with_name(video.stem + ".qc.txt")
    out.write_text("\n".join(report) + "\n")
    print("\n".join(report))


if __name__ == "__main__":
    main()
