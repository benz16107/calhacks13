#!/usr/bin/env python3
"""Upload a finished video to Ben's YouTube as Unlisted, through Composio, and check it plays logged out.

    yt.py <id> "<title>"           e.g. yt.py main "GurtOS: operating systems built for AI agents"

Uploads out/<id>.mp4 with the description from upload.md (the ```text block under the heading that names <id>'s
file) or, for a track with no section there, one made from its script. Then adds out/<id>.srt as English
captions and sets the thumbnail (out/<id>-thumb.jpg must be reachable at THUMB_BASE/<id>-thumb.jpg). Appends the
URL to out/INDEX.md and out/youtube.json. Never public: Ben decides that.
"""
import json, re, subprocess, sys, time, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
ACCOUNT = "youtube_video-rannel"  # Composio routes to a default account unless told (memory: composio-instagram-account-routing)
THUMB_BASE = "https://raw.githubusercontent.com/benz16107/calhacks13/videos/docs/video/thumbs"
LINKS = """Download the signed discs: https://gurtos.com/download/
Docs: https://gurtos.com/docs/
Code (Apache-2.0): https://github.com/benz16107/calhacks13
Every Cal Hacks track, with its evidence: https://calhacks.gurtos.com"""


def composio(slug, data, file=None):
    cmd = ["composio", "execute", slug, "--account", ACCOUNT, "-d", json.dumps(data)] + (["--file", str(file)] if file else [])
    r = subprocess.run(cmd, capture_output=True, text=True)
    try:
        d = json.loads(r.stdout)
    except json.JSONDecodeError:
        sys.exit(f"{slug}: no JSON\n{r.stdout[-800:]}\n{r.stderr[-800:]}")
    return d


def description(vid):
    up = (HERE / "upload.md").read_text()
    m = re.search(rf"\*\*File:\*\* `out/{re.escape(vid)}\.mp4`.*?```text\n(.*?)```", up, re.S)
    if m:
        return m.group(1).strip()
    # A track: its published pitch (docs/story.md) and its showcase page.
    film = (HERE / "films" / f"{vid}.mjs").read_text()
    sponsor = re.search(r"sponsor: '([^']+)'", film).group(1)
    track = re.search(r"track: '([^']+)'", film).group(1)
    story = (HERE.parent / "story.md").read_text()
    sec = re.search(rf"^## {re.escape(sponsor.split()[0])}\b.*?\*\*Pitch:\*\*\s*(.*?)\n", story, re.S | re.M)
    page = {"coinbase-solana": "coinbase", "atlassian-t1": "atlassian", "atlassian-t2": "atlassian"}.get(vid, vid)
    return "\n\n".join(x for x in [
        f"GurtOS for {sponsor}: {track}. Operating systems built for AI agents.",
        sec.group(1).strip() if sec else "",
        "Every screen is the real GurtOS product, recorded from main on Oct 24 and 25, 2026, or a real screenshot. "
        "Scripted agents are labelled; every payment is test money. Narration: Ben Zhou's own voice, cloned with "
        "ElevenLabs. Music: generated with MusicGen.",
        f"This track's page, with its evidence: https://calhacks.gurtos.com/tracks/{page}/",
        LINKS] if x)


def main():
    vid, title = sys.argv[1], sys.argv[2]
    mp4, srt, thumb = OUT / f"{vid}.mp4", OUT / f"{vid}.srt", OUT / f"{vid}-thumb.jpg"
    desc = description(vid)
    assert "—" not in desc + title and "–" not in desc + title, "a dash in the title or description"
    me = composio("YOUTUBE_GET_CHANNEL_STATISTICS", {"mine": True, "part": "snippet"})
    items = ((me.get("data") or {}).get("items") or ((me.get("data") or {}).get("response_data") or {}).get("items") or [])
    if not me.get("successful") or not items:
        sys.exit(f"channel check failed: {json.dumps(me)[:600]}")
    channel = items[0]["snippet"]["title"]
    print(f"channel: {channel} ({items[0]['id']})")
    up = composio("YOUTUBE_MULTIPART_UPLOAD_VIDEO", {"title": title, "description": desc, "categoryId": "28",
                  "privacyStatus": "unlisted", "tags": ["GurtOS", "Cal Hacks 13", "AI agents", "operating system"]}, mp4)
    d = up.get("data") or {}
    video_id = d.get("id") or (d.get("video") or {}).get("id") or (d.get("response_data") or {}).get("id")
    if not up.get("successful") or not video_id:
        sys.exit(f"upload failed: {json.dumps(up)[:800]}")
    url = f"https://youtu.be/{video_id}"
    print("uploaded", url)
    if srt.exists() and "--no-captions" not in sys.argv:  # captions are burned in; the separate track costs 400 quota units
        c = composio("YOUTUBE_UPLOAD_CAPTION_TRACK", {"videoId": video_id, "language": "en", "name": "English"}, srt)
        print("captions:", "ok" if c.get("successful") else json.dumps(c)[:300])
    if thumb.exists():
        t = composio("YOUTUBE_UPDATE_THUMBNAIL", {"videoId": video_id, "thumbnailUrl": f"{THUMB_BASE}/{vid}-thumb.jpg"})
        print("thumbnail:", "ok" if t.get("successful") else json.dumps(t)[:300])
    # Logged out: oEmbed answers for a public or unlisted video, and yt-dlp lists formats once processing is done.
    for _ in range(40):
        ok = subprocess.run(["yt-dlp", "--simulate", "--no-warnings", "-q", url], capture_output=True).returncode == 0
        if ok:
            break
        time.sleep(15)
    with urllib.request.urlopen(f"https://www.youtube.com/oembed?url={url}&format=json") as r:
        seen = json.load(r)["title"]
    print(f"plays logged out: {ok}; oEmbed title: {seen}")
    log = OUT / "youtube.json"
    entries = json.loads(log.read_text()) if log.exists() else {}
    entries[vid] = {"url": url, "title": title, "channel": channel, "privacy": "unlisted", "playsLoggedOut": ok,
                    "uploaded": time.strftime("%Y-%m-%d %H:%M %Z")}
    log.write_text(json.dumps(entries, indent=2))
    with open(OUT / "INDEX.md", "a") as f:
        f.write(f"| {title} | YouTube (unlisted) | {url} | uploaded {entries[vid]['uploaded']} |\n")


if __name__ == "__main__":
    main()
