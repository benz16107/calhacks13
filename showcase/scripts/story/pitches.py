# One source for every track's "Best shown in" line and pitch. Writes them into each track page's frontmatter and
# docs/devpost.md. Usage: python3 showcase/scripts/story/pitches.py <repo root>
import re, json
BIZ = "GurtOS Business is on main: people and roles, approvals routed by rules written in plain words, refusals for answering your own request or above your limit, a Waiting for me inbox, an audit with CSV export and a kill switch. Sign-in with a work account (Microsoft Entra ID, roles from groups) is Entra-ready and tested with a standards test provider; shadow mode (a seat only suggests, and a person decides) is built. The scored credit desk runs were on GurtOS Server; the Business screens are from a box seeded as the made-up Fogline Supply."
E = {
 'anthropic': ("GurtOS Personal and GurtOS Server",
   "GurtOS turns a computer you own, even an old one, into one built for agents: each Claude task runs as its own Linux user in its own copy-on-write copy of your files, with no keys, and you approve, undo or pause it from the portal or your phone. It is light and open source. Models are chosen per task with their cost, a Haiku check looks at risky steps, and the attack test is published with its limits. A GurtOS MCP server lets Claude Desktop and Claude Code drive your box."),
 'factory': ("GurtOS Server and GurtOS Personal",
   "Droid does the work and GurtOS makes it safe. Droid never holds a key: the vault keeps it and the box's proxy swaps it in outside the task. Each task is its own Linux user with its own firewall rule and its own copy of the files, on a locked-down Linux base where task users have no sudo, and every change is reviewable in the log and undoable. Keys kept where agents can reach them keep leaking: <a href=\"https://www.bleepingcomputer.com/news/security/opencode-hack-exposes-api-keys-amid-ai-distillation-attacks/\">OpenCode Console exposed users' provider API keys</a> on Oct 17, 2026, <a href=\"https://github.com/openclaw/openclaw/issues/43794\">OpenClaw stores tokens and API keys in plaintext</a> in <code>~/.openclaw/openclaw.json</code>, and <a href=\"https://nvd.nist.gov/vuln/detail/CVE-2026-25253\">CVE-2026-25253</a> let one crafted link make OpenClaw send its token to an attacker."),
 'hyphenate': ("GurtOS Business",
   "A finance team needs roles, segregation of duties and an audit trail on every agent decision, which is what Business adds: who may approve what, up to how much. " + BIZ),
 'crs': ("GurtOS Business",
   "The unexpected part is the OS: we built a whole operating system for agents to do credit and fraud checks safely, where on an ordinary one the agent holds the keys, approves its own work and can pull any report. Each seat is its own user without the CRS login, every pull needs a stated reason, a person approves what the rules send them, and a fraudster who argues with the desk is refused in code. Not built: a payment gate for guests, the controller's clear-the-flag path and an ASI:One chat intent for credit."),
 'microsoft': ("GurtOS Business",
   "Companies want agents on finance work, but an ordinary OS gives an agent its owner's keys, no separation of duties, no record and no undo, so pilots stay pilots. GurtOS Business gives each seat its own user, routes approvals to the right person, keeps a full audit and a kill switch, on a box the company owns. A measured incident drill is done: 10 agents stopped within 271 ms, a bad batch undone in 48 ms. Built since: measured impact per run, a Responsible AI mapping and sourced customer facts.  " + BIZ),
 'atlassian': ("GurtOS Business",
   "Teams already work in Jira and Confluence. GurtOS makes every agent task an issue a teammate can approve or roll back, answers from the log through a Rovo agent, starts agents from an issue, sends risky actions to Jira Service Management approvers and writes the record to Confluence. Business is on main; everything here ran against a GurtOS Server box, except the Jira-user-to-Business-person mapping, which the merge gate checks against offline Jira stand-ins."),
 'visa': ("GurtOS Personal, plus GurtOS Server for routines that keep running when you close your laptop",
   "GurtOS Personal runs your shopping agents on a computer you own, even an old one: the agent never sees your card, every purchase waits for your tap, every order is signed so the store can verify it, and undo refunds it. A Server box keeps a watch running while the laptop is closed."),
 'coinbase': ('GurtOS Server, and GurtOS Business',
   "GurtOS is the environment that makes an agent wallet safe: the key never reaches the agent, each task has a budget on top of the x402 client's own payment policy, anything over it waits for your tap on the phone, and every payment is on the record. It all runs on top of the OS, on an always-on box you own, and because GurtOS is open source (Apache-2.0), anyone can run it, customise it and reuse the wallet in their own agents."),
 'solana': ('GurtOS Server, and GurtOS Business',
   "An always-on box you own holds the Solana wallet in its root-only vault, so agents can pay for APIs at any hour without ever seeing the key. Every payment is a devnet transaction anyone can check, recorded in the box's log with the task that made it. GurtOS is open source (Apache-2.0), so the same wallet works in anyone's agents."),
 'fetch': ("GurtOS Server (always reachable), and GurtOS Personal too",
   "GurtOS gives ASI:One a safe body on a computer you own, even an old one: each request runs as its own sandboxed task with no keys, asks before it spends, and can be undone, and the portal and phone show it live. A team of agents on Agentverse fronts the box, strangers' agents' replies are treated as data (a hidden instruction is blocked and logged), and payments run in test FET through the box's one budget path. A Server box answers at 3 AM through its Agentverse mailbox with no open port."),
 'vultr': ("GurtOS Server",
   "GurtOS Server runs wherever a VM does. On Vultr it is the public, always-on box: Jira and Mana reach it, and the rest of its API stays closed. The real release disc also installs and boots on a 1 vCPU, 1 GB Vultr instance, its state backs up encrypted to Vultr Object Storage, and Vultr's firewall is set from code."),
 'spacetime': ("All three editions, strongest in GurtOS Business",
   "The usual stack for live agent state, a database, a websocket server, a cache and auth glue, is heavy and fragile. GurtOS runs one self-hosted SpacetimeDB per box as its live nervous system, with the security enforced in the database: agents share a work queue, each person is sent only their own requests, and the first answer wins. It is light, open source and part of the GurtOS suite. The Maincloud multi-machine view is written but not running yet."),
 'elastic': ("GurtOS Business and GurtOS Server",
   "After a week of agents working, an ordinary OS cannot tell you what they did, and anyone with root can edit its logs. GurtOS keeps one action log of every action and chains each entry to the one before, and Elastic keeps a copy the box cannot rewrite, so a changed entry is caught. Elastic's agent answers and investigates, and its alert rules and the agent can only leave a request: the box turns it into one approval on your phone."),
 'moss': ("GurtOS Personal",
   "A personal agent is only useful if it remembers you, and today that means uploading your life to someone's cloud. On GurtOS the index lives in your own computer's memory, agents search it with no network and no keys, and undoing a task takes its files out. A fresh box calls no model: a photo is described by a model you point it at, such as one in Ollama on your own machine, and Claude describes photos only when the owner presses a button. Only text goes to Moss's cloud copy, including what a vision model wrote about your photos. Talking to your computer is built in GurtOS Personal. Next (being built): memory that cannot be poisoned, one preference honoured across apps and a forget button."),
 'apify': ("GurtOS Personal and GurtOS Server",
   "GurtOS lets your agents use Apify's web robots from their own isolated space, with no keys: the broker holds the token, a scraped page is treated as untrusted data, and every run's cost is capped by the task budget and shown in the portal. On a Server box, schedules and webhooks start those tasks while you're away. It is light and open source."),
 'mana': ("GurtOS Personal and GurtOS Business",
   "AI workspaces are great for thinking, but there is no safe place for an AI to act on your real computer. Mana plans it, GurtOS does it safely in an isolated space, and you approve from your phone. Four public Mana chats shaped the credit desk rules, Business approval rules, Visa mandates and the Fetch agent team, each with what it changed in code."),
 'armadin': ("All three editions",
   "Agents get attacked through the pages they read and the packages they install, and on an ordinary OS a fooled agent can read every key and send it anywhere. GurtOS stops it at the OS, whatever the model does, in every edition, and publishes the score: of 16 OS-level attacks, 14 caught and 2 published as not covered, on two machines. A poisoned package imitating the 2025 npm worm and a hijacked payment both fail. Tripwire keys and a seccomp-filtered, CPU-capped sandbox are built."),
 'figma': ("All three editions",
   "One design system for every edition: the box screen and phone for Server, the GNOME layer for Personal, and room in the same tokens for Business."),
}
q = lambda t: "'" + t.replace("'", "''") + "'"
md = lambda t: re.sub(r'<a href="([^"]+)">(.*?)</a>', r'[\2](\1)', t).replace('<code>', '`').replace('</code>', '`')

SHORT_START, SHORT_END = '<!-- DEVPOST SHORT START -->', '<!-- DEVPOST SHORT END -->'
SHORT_HEAD = '## About the project, short version (PASTE THIS ONE: Devpost caps the field at 50,000 characters)'
def write_short(d):
    """The Devpost "About the project" field holds 50,000 characters. Build a short version from the full one:
    the summary, then each sponsor section cut to its pitch, proof and link (the track pages hold the rest).
    Figma keeps its whole section (its stage log is a deliverable) and so does CRS (its team asked for a self-contained written write-up for their judges)."""
    d = d.replace('## About the project, full version (over the 50,000 character limit; the source the short version is made from)', '## About the project (paste from here to the end)')
    a = d.index('<!-- SUMMARY START -->') + len('<!-- SUMMARY START -->'); b = d.index('<!-- SUMMARY END -->')
    summary = d[a:b].strip()
    c = d.index('<!-- SPONSORS START -->') + len('<!-- SPONSORS START -->'); e = d.index('<!-- SPONSORS END -->')
    out = [summary, '', '## Sponsor tracks', '', 'Every track has its own page with the criteria, evidence, screenshots and limits: https://calhacks.gurtos.com', '']
    for sec in re.split(r'\n(?=### )', d[c:e].strip()):
        lines = [l for l in sec.split('\n') if l.strip()]
        head = lines[0]
        if head.startswith('### Figma') or head.startswith('### CRS'):  # their sponsors asked for a written write-up
            out += ['\n'.join(lines), '']; continue
        # in order: the pitch, proof and link, the "Fits ..." line, and every short labelled line (problem, awards, our Actor, feedback)
        keep = [l for l in lines[1:] if l.startswith('**Best shown in:**') or l.startswith('**Proof:**') or l.startswith('[Full write-up')
                or l.startswith('Fits ') or (l.startswith('**') and len(l) <= 600)]
        out += [head, ''] + [x + '\n' for x in keep]
    short = '\n'.join(out).strip()
    block = f"{SHORT_HEAD}\n\n{SHORT_START}\n\n{short}\n\n{SHORT_END}\n\n"
    if SHORT_START in d:
        x = d.index(SHORT_HEAD); y = d.index(SHORT_END) + len(SHORT_END) + 2
        d = d[:x] + block + d[y:]
    else:
        x = d.index('## About the project (paste from here to the end)')
        d = d[:x] + block + d[x:]
    d = d.replace('## About the project (paste from here to the end)', '## About the project, full version (over the 50,000 character limit; the source the short version is made from)')
    print('short version', len(short), 'characters')
    return d

if __name__ == '__main__':
    # Since the track-page redesign the pitch and "Best shown in" live in each page's frontmatter (the page writers own them).
    # This script now only copies them into docs/devpost.md; it never writes the pages.
    import sys, json, subprocess, os
    root = sys.argv[1]
    here = os.path.dirname(os.path.abspath(__file__))
    fm = json.loads(subprocess.run(['node', os.path.join(here, 'frontmatter.mjs'), root], check=True, capture_output=True, text=True).stdout)
    E = {k: (v['editions'], v['pitch']) for k, v in fm.items()}
    p = f'{root}/docs/devpost.md'; d = open(p).read()
    if SHORT_START in d:  # work on the full version only; the short one is rebuilt from it below
        d = d[:d.index(SHORT_HEAD)] + d[d.index(SHORT_END) + len(SHORT_END) + 2:]
    d = re.sub(r"\n\*\*Best shown in:\*\*.*\n", "\n", d)
    for slug, (ed, pitch) in E.items():
        link = f"(https://calhacks.gurtos.com/tracks/{slug}/)"
        if link not in d: continue
        i = d.index(link); h = d.rindex('\n### ', 0, i) + 1; e = d.index('\n', h)
        d = d[:e+1] + f"\n**Best shown in:** {ed}. {md(pitch)}\n" + d[e+1:]
    # The page's proof is the Devpost proof too (explorer links in the old text are kept, since Devpost readers click them).
    plain = lambda t: re.sub(r'</?(?:strong|em|b|i|span|br)[^>]*>', '', md(t))
    for slug, v in fm.items():
        link = f"(https://calhacks.gurtos.com/tracks/{slug}/)"
        if link not in d or not v.get('proof'): continue
        i = d.index(link); h = d.rindex('\n### ', 0, i)
        m = re.search(r'^\*\*Proof:\*\*(.*)$', d[h:i], re.M)
        if not m: continue
        old = m.group(1)
        keep = [u for u in re.findall(r'https://explorer\.solana\.com/[^\s)]*[^\s).,]', old) if u not in v['proof']]
        new = '**Proof:** ' + plain(v['proof']).strip() + ''.join(f' {u}' for u in keep)
        a = h + m.start(); d = d[:a] + new + d[a + len(m.group(0)):]
    d = re.sub(r'\n{3,}', '\n\n', d)
    d = write_short(d)
    open(p, 'w').write(d)
    print('ok', len(E))
