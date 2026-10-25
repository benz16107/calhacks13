# Builds docs/story.md from the track pages and pitches.py. Usage: python3 showcase/scripts/story/bible.py <repo root>
import re, sys, json, html, subprocess
root = sys.argv[1]
import os
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, 'pitches.py')).read().split("if __name__")[0])
DECIDED = {'hyphenate', 'visa', 'fetch', 'coinbase', 'solana', 'apify', 'anthropic', 'microsoft', 'elastic', 'crs', 'moss', 'armadin'}
EXTRA_TODO = {'anthropic': ['How to enter: pending; Ben will ask a director (the prize is not on Devpost yet)']}
PROBLEM = {
 'hyphenate': "Companies want AI employees, but today's computers and clouds weren't built for them. An agent runs as you, with your keys, on one shared filesystem, with no separation of duties, no record you can trust and no undo, so nobody lets one do real finance work.",
 'visa': "Shopping agents need your card or your password, stores can't tell a good agent from a bot, you can't see or stop what they do, and cloud agents run on computers you don't control.",
 'fetch': "A chat agent can only act if it runs somewhere: a cloud you can't see into, or your own computer with full access. Agents that talk to strangers' agents can be fed hidden instructions.",
 'coinbase': "Giving an agent money means handing it your card or a private key, on a heavy system or a cloud with no layer built for this: no separation, no safe key handling, no record and no undo.",
 'solana': "Giving an agent money means handing it a private key on a system with no layer built for it.",
 'anthropic': "Solo developers already leave agents (Claude Code, OpenClaw) running at home as themselves, with every key and file. An ordinary OS can't separate them, record them or undo them, and the alternative is renting a cloud you can't see into.",
 'factory': "Draft: coding agents need keys to work, and tools keep leaking them (the OpenCode Console breach, OpenClaw's plaintext key file, CVE-2026-25253). Today the agent runs as you, on your files, with your keys in its environment.",
 'armadin': "Agents get attacked through the pages they read and the packages they install, and on an ordinary OS a fooled agent can read every key and send it anywhere.",
 'microsoft': "Companies want agents doing finance work, but an ordinary OS gives an agent its owner's keys, no separation of duties, no record and no undo, so pilots never reach production.",
 'atlassian': "Draft: when an agent acts for you overnight, nobody can see the next morning exactly what it did and why, or roll back only the wrong part.",
 'crs': "Credit bureaus and lenders are what attackers go after, and on an ordinary OS an agent doing identity and fraud checks holds the keys, can approve its own work and can pull any report.",
 'spacetime': "Live agent state usually needs a database, a websocket server, a cache and auth glue, which is heavy and fragile, and an ordinary OS has nothing for it.",
 'elastic': "After a week of agents working, an ordinary OS cannot tell you what they did: its logs are scattered and anyone with root can edit them.",
 'moss': "A personal agent is only useful if it remembers you, and today that means uploading your life to someone's cloud, and any web page an agent reads can plant false memories.",
 'apify': "Web agents today drive your logged-in browser with your accounts, read booby-trapped pages, and you can't see what they spend.",
 'vultr': "An agent computer should be reachable around the clock without exposing everything on it, and an ordinary cloud VM runs every agent as one user that holds every key.",
 'figma': "Draft: an OS for agents has to feel like an OS people trust, not another dashboard, and the design has to reach the code without drift.",
 'mana': "AI workspaces are great for thinking, but there is no safe place for an AI to act on your real computer.",
}
def strip(t): return html.unescape(re.sub(r'<[^>]+>', '', t or '')).strip()
FM = json.loads(subprocess.run(['node', os.path.join(HERE, 'frontmatter.mjs'), root], check=True, capture_output=True, text=True).stdout)
E = {k: (v['editions'], v['pitch']) for k, v in FM.items()}  # the pages own their pitch and editions
def front(slug):
    return FM[slug], open(f'{root}/showcase/src/content/tracks/{slug}.mdx').read()
OS = json.loads(subprocess.run(['node', os.path.join(HERE, 'osvstrack.mjs'), root], check=True, capture_output=True, text=True).stdout)
def why_table(body, slug=None, sponsor=''):
    if slug in OS:
        rows = OS[slug]
        head = ['Feature', 'Serves', 'From GurtOS (the OS)', f'From {sponsor}', 'Status']
        return head, [[strip(r.get('what')), strip(r.get('why')), strip(r.get('os')), strip(r.get('track')), strip(r.get('status'))] for r in rows]
    m = re.search(r'## Why (?:an operating system|GurtOS, and what each part is for)\n(.*?)\n## ', body, re.S)
    if not m: return None
    rows = [l for l in m.group(1).splitlines() if l.startswith('|') and not l.startswith('|---')]
    head = [c.strip() for c in rows[0].strip('|').split('|')]
    return head, [[strip(c) for c in r.strip('|').split('|')] for r in rows[1:]]
out = ["# The story bible", "",
 "How every track is told, in one place. The showcase (`showcase/`) and the Devpost text (`docs/devpost.md`) follow",
 "this file; when a principle changes, it changes for every track. Generated from the track pages and their pitches",
 "(see the end), then reviewed by hand. Tracks marked **to review with Ben** follow the principles but their story",
 "has not been signed off yet.", "",
 "**The headline everywhere (Ben, Oct 24):** \"Operating systems built for AI agents\" (plural, for the three editions), with the line",
 " under it \"Agents get real access to files, the web and money, and never hold your keys.\" It replaces \"An operating system where",
 " AI agents work safely\" on gurtos.com, the showcase and the Devpost tagline.", "",
 "## Principles for every track", "",
 "1. **Problem first, then why an OS.** Traditional systems and clouds weren't built for agents: they are heavy, with",
 "   no separation, no safe key handling, no record and no undo.",
 "2. **GurtOS is the environment.** Each agent works in its own separate space (its own Linux user and its own copy",
 "   of the files, like a worktree per task). Every feature runs on top of the OS. Emphasise the OS.",
 "3. **Security is the headline.**",
 "4. **It runs on a computer you own, even an old one, because it's light.** GurtOS Server: 4 GB of memory and 17 GB",
 "   of disk on any x86_64 or arm64 machine, no GPU. GurtOS Personal: 4 GB and 29 GB, x86_64. Instead of a cloud you",
 "   can't see into.",
 "5. **The portal and phone app give live visibility and control** on any of your machines.",
 "6. **Open source (Apache-2.0):** anyone can run it, customise it and reuse it.",
 "7. **Name the edition that shows each track best.** GurtOS Business is on main (people and roles, routed approvals, audit, kill switch);",
 "   sign-in with a work account (Entra ID) is Entra-ready and tested with a standards test provider; shadow mode is built. Say which part each Business-led page shows.",
 "8. **Every feature says why it is there and which criterion it serves.**",
 "9. **Label what comes from the OS and what from the track.**",
 "10. **Lightweight, and it solves security problems existing systems can't.** The box service is one Node process",
 "    on Ubuntu 24.04; no GPU, no cloud account. GurtOS Server is 40 named Ubuntu packages (440 with dependencies), no",
 "    desktop, snapd, cloud-init, sudo or apt, on a 1.37 GB disc; say \"no desktop\", not \"no browser\" (its screen is one",
 "    full-screen WebKit view). Measured: the box installed from source ran one task at a time in 1 GB of RAM in a QEMU VM",
 "    (not the Server image, on a fast host, so never \"any old laptop\"). Personal idles at about 903 MB, about 150 MB",
 "    less than stock Ubuntu 24.04 Desktop.",
 "11. **A better filesystem for agents.** Each task gets an instant copy-on-write copy of its files (an overlayfs",
 "    layer). Agents work in parallel without colliding, nothing is duplicated (a layer holds only what a task",
 "    changed), and undo is cheap and exact (take one layer out). That makes agent work faster: no copying a",
 "    folder before a task, no locks between tasks, no merge step, and a bad task costs one click.",
 "12. **Existing OSes are outdated for agents**, consumer and enterprise: built for one human at a keyboard;",
 "    permissions per user, not per task; secrets in environment variables and files any process can read; the",
 "    network all-or-nothing; no approval, budget or spending limit; no trustworthy record and no rollback of what",
 "    an agent did. For enterprises: no separation of duties, no routed approvals, no fleet-wide audit.",
 "13. **GurtOS is a suite, not one system:** the OS in three editions, the portal and phone companion app",
 "    (app.gurtos.com), remote access (`<name>.box.gurtos.com` with push to the phone), the app platform that",
 "    integrations plug into, the public docs (gurtos.com), and the open-source code.", "",
 "14. **Finance tracks (CRS, Hyphenate, Microsoft, Visa, Coinbase): the unexpected part is the OS.** We built",
 "    an entire operating system, a whole ecosystem, for agents to do this work safely, where on an ordinary OS the agent",
 "    holds the keys, can approve its own work and can pull any report. Each of these pages cites real attacks on financial",
 "    companies, only with a source (name, date, link, what was taken, as the source states it), then says what GurtOS's",
 "    controls do about that kind of attack and what they do not. Never invent or round up an incident.", "",
 "Where they show up on the site: the evidence page (/evidence/) carries 12, 11, 10 and 13, and the product itself is on gurtos.com; principles 2 to 6 and 10 to 13 are the",
 "\"Runs on top of GurtOS\" box on every track page; 7 is the \"Best shown in\" band; 1, 8 and 9 are the page summary",
 "and its \"Why\" table.", "",
 "## Videos and the freeze", "",
 "Ben does not film. The videos are produced by the team after the build is done: screen recordings of the real app,",
 "animation, and possibly narration in Ben's own cloned voice. Until then every page shows a silent screen recording.",
 "The build freezes Sat Oct 24, 9 PM PT; after that, fixes only.", "",
 "## Status", "",
 "| Track | Edition | Story |", "|---|---|---|"]
tracks = sorted(E, key=lambda k: front(k)[0]['order'])
for k in tracks:
    out.append(f"| {front(k)[0]['sponsor']} | {E[k][0]} | {'decided' if k in DECIDED else 'to review with Ben'} |")
out.append("")
for k in tracks:
    fm, s = front(k); body = s.split('---', 2)[2]
    out += [f"## {fm['sponsor']}: {fm['prize']}", "",
            f"**Status:** {'decided' if k in DECIDED else 'to review with Ben'}. **Page:** https://calhacks.gurtos.com/tracks/{k}/", "",
            f"**Best shown in:** {E[k][0]}", "", f"**Pitch:** {strip(E[k][1])}", "",
            f"**The problem:** {PROBLEM[k]}", ""]
    t = why_table(body, k, fm['sponsor'])
    if t:
        head, rows = t
        out += ["**Features** (from the page's table):", "", "| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
        out += ["| " + " | ".join(c.replace('|', '/') for c in r) + " |" for r in rows]
        out.append("")
    else:
        out += ["**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):", ""]
        out += [f"- *{strip(c['ask'])}* ({c.get('status','met')}): {strip(c['how'])}" for c in fm.get('criteria', [])]
        out.append("")
    out += [f"**Demo moment and proof:** {strip(fm['proof'])}", ""]
    todo = [f"{strip(c['ask'])} ({c.get('status','met')})" for c in fm.get('criteria', []) if c.get('status', 'met') != 'met']
    todo += [f"{r['part']} (not built)" for r in fm.get('status', []) if r['state'] == 'not-built']
    if t: todo += [r[0] for r in t[1] if 'Being built' in r[-1]]
    todo += EXTRA_TODO.get(k, [])
    if k not in DECIDED: todo.insert(0, "Review the story with Ben: problem, features with their why, OS vs track")
    out += ["**Still to do:**", ""] + [f"- {x}" for x in todo or ["Nothing open."]] + [""]
FEATURES = [
 # name, owner thread, status on main, where it is shown (Devpost, home, tracks), shown yet
 ("Try GurtOS live (a throwaway computer in the browser)", "mcp:6032eb14-4718-4a33-9d29-2a6983bbbce4", "live at https://try.gurtos.com; code on main (try/, e503c78)", "Devpost Try it out first (done); every track header and the home (done); evidence page", "Devpost, home, every track page"),
 ("Attack it yourself (paste an injection or pick an attack, watch each defence stop it)", "same thread (try/)", "live inside https://try.gurtos.com (24-check test passes on the host); scripted agent, disk-fill not covered", "Devpost (done); Armadin, Anthropic (writers asked)", "Devpost, home"),
 ("The flight recorder (replay a task step by step, with files and approvals, then Keep or Undo)", "portal", "merged 220ac4d (QA has not run it by hand); files at each step recorded since core 095514a (older tasks show the final changes)", "Devpost (done); Anthropic, Factory; Hyphenate, Microsoft, CRS, Atlassian (writers asked)", "Devpost, Hyphenate, Microsoft, CRS, Atlassian; Anthropic and Factory asked"),
 ("Agent permissions (the OS enforces each app's manifest; allow, deny, revoke)", "core", "merged 4b473ea (gate 39/0); Settings screens still landing", "Devpost; Hyphenate, Microsoft, CRS, Atlassian; Visa, Apify", "all shown: Devpost, Hyphenate, Microsoft, CRS, Atlassian, Visa, Apify"),
 ("Signed receipts with a QR code and a public verify page (log and Solana anchored)", "receipts thread", "merged 7ca2941, live on all three boxes; Solana anchor works for tasks the daily audit covers (checked on the cloud box, audit at seq 685); public verify page placement pending with docs", "Devpost (done); Elastic, Coinbase, Solana, Microsoft, Hyphenate, CRS (pages show it; Solana capture still to add)", "Devpost only"),
]
out += ["## Standout features (Ben, Oct 24): where each is shown", "",
 "Show each one everywhere it belongs, as it lands on main and is verified. Claim only what works: a feature stays \"building\"",
 "here, and off every page, until its code is merged and its check passes. Batch the deploys (Vercel's daily cap).", "",
 "| Feature | Owner | On main | Where it belongs | Shown yet |", "|---|---|---|---|---|"]
out += [f"| {n} | {o} | {st} | {w} | {sh} |" for n, o, st, w, sh in FEATURES]
out.append("")
out += ["## Not entered", "",
 "**MLH GoDaddy Registry domain.** Ben decided on Oct 24 not to enter it. Its showcase page and Devpost section are removed and",
 "`/tracks/godaddy/` redirects to the tracks list. gurtos.com and the per-box `<name>.box.gurtos.com` addresses stay as they are; there is no gurtos.co.", "",
 "**Capital One (Nessie).** Ben decided on Oct 24 not to enter it. Its showcase page and Devpost section are removed and",
 "`/tracks/nessie/` redirects to the Hyphenate page. Nessie stays in the product as the credit desk's test bank, so the",
 "credit desk, Hyphenate and Microsoft pages still name it. No new Nessie features.", "",
 "## How this file is made", "",
 "The pitches live in `showcase/scripts/story/pitches.py`, which writes them into each page's frontmatter and each",
 "Devpost section (`python3 showcase/scripts/story/pitches.py .`). This file is rebuilt from the pages",
 "(`python3 showcase/scripts/story/bible.py .`), so it never disagrees with the site. Edit a page or a pitch,",
 "rebuild both, and re-read the track here."]
open(f'{root}/docs/story.md', 'w').write("\n".join(out) + "\n")
print('ok', len(tracks), 'tracks')
