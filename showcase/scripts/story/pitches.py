# One source for every track's "Best shown in" line and pitch. Writes them into each track page's frontmatter and
# docs/devpost.md. Usage: python3 showcase/scripts/story/pitches.py <repo root>
import re, json
BIZ = "GurtOS Business is on main: people and roles, approvals routed by rules written in plain words, refusals for answering your own request or above your limit, a Waiting for me inbox, an audit with CSV export and a kill switch. Sign-in with a work account (Microsoft Entra ID, roles from groups) is Entra-ready and tested with a standards test provider; shadow mode is not built. The scored credit desk runs were on GurtOS Server; the Business screens are from a box seeded as the made-up Fogline Supply."
E = {
 'anthropic': ("GurtOS Personal and GurtOS Server",
   "GurtOS turns a computer you own, even an old one, into one built for agents: each Claude task runs as its own Linux user in its own copy-on-write copy of your files, with no keys, and you approve, undo or pause it from the portal or your phone. It is light and open source. Next, a GurtOS MCP server (being built) lets Claude Desktop and Claude Code drive your box."),
 'factory': ("GurtOS Server and GurtOS Personal",
   "Droid does the work and GurtOS makes it safe. Droid never holds a key: the vault keeps it and the box's proxy swaps it in outside the task. Each task is its own Linux user with its own firewall rule and its own copy of the files, on a locked-down Linux base where task users have no sudo, and every change is reviewable in the log and undoable. Keys kept where agents can reach them keep leaking: <a href=\"https://www.bleepingcomputer.com/news/security/opencode-hack-exposes-api-keys-amid-ai-distillation-attacks/\">OpenCode Console exposed users' provider API keys</a> on Oct 17, 2026, <a href=\"https://github.com/openclaw/openclaw/issues/43794\">OpenClaw stores tokens and API keys in plaintext</a> in <code>~/.openclaw/openclaw.json</code>, and <a href=\"https://nvd.nist.gov/vuln/detail/CVE-2026-25253\">CVE-2026-25253</a> let one crafted link make OpenClaw send its token to an attacker."),
 'hyphenate': ("GurtOS Business",
   "A finance team needs roles, segregation of duties and an audit trail on every agent decision, which is what Business adds: who may approve what, up to how much. " + BIZ),
 'crs': ("GurtOS Business",
   "The unexpected part is the OS: we built a whole operating system for agents to do credit and fraud checks safely, where on an ordinary one the agent holds the keys, approves its own work and can pull any report. Each seat is its own user without the CRS login, a person approves what the rules send them, and every pull keeps its request id. " + BIZ + " Next (being built): know-your-agent, permissible purpose with a pull limit, CRS's MCP server behind the broker, nightly re-checks, a fraud case file on the phone and a fraudster who argues, measured."),
 'microsoft': ("GurtOS Business",
   "Companies want agents on finance work, but an ordinary OS gives an agent its owner's keys, no separation of duties, no record and no undo, so pilots stay pilots. GurtOS Business gives each seat its own user, routes approvals to the right person, keeps a full audit and a kill switch, on a box the company owns. A measured incident drill is done: 10 agents stopped within 271 ms, a bad batch undone in 48 ms. Next (being built): shadow mode, measured impact, a Responsible AI mapping and sourced facts. " + BIZ),
 'atlassian': ("GurtOS Business",
   "Teams already work in Jira and Confluence. GurtOS makes every agent task an issue a teammate can approve or roll back, answers from the log through a Rovo agent, starts agents from an issue, sends risky actions to Jira Service Management approvers and writes the record to Confluence. Business is on main, but the Jira app has not been tried against a Business box: everything here ran against a GurtOS Server box."),
 'visa': ("GurtOS Personal, plus GurtOS Server for routines that keep running when you close your laptop",
   "GurtOS Personal runs your shopping agents on a computer you own, even an old one: the agent never sees your card, every purchase waits for your tap, every order is signed so the store can verify it, and undo refunds it. A Server box keeps a watch running while the laptop is closed."),
 'coinbase': ('GurtOS Server, and GurtOS Business',
   "GurtOS is the environment that makes an agent wallet safe: the key never reaches the agent, each task has a budget on top of the x402 client's own payment policy, anything over it waits for your tap on the phone, and every payment is on the record. It all runs on top of the OS, on an always-on box you own, and because GurtOS is open source (Apache-2.0), anyone can run it, customise it and reuse the wallet in their own agents."),
 'solana': ('GurtOS Server, and GurtOS Business',
   "An always-on box you own holds the Solana wallet in its root-only vault, so agents can pay for APIs at any hour without ever seeing the key. Every payment is a devnet transaction anyone can check, recorded in the box's log with the task that made it. GurtOS is open source (Apache-2.0), so the same wallet works in anyone's agents."),
 'fetch': ("GurtOS Server (always reachable), and GurtOS Personal too",
   "GurtOS gives ASI:One a safe body on a computer you own, even an old one: each request runs as its own sandboxed task with no keys, asks before it spends, and can be undone, and the portal and phone show it live. A Server box answers at 3 AM through its Agentverse mailbox with no open port."),
 'vultr': ("GurtOS Server",
   "GurtOS Server runs wherever a VM does. On Vultr it is the public, always-on box: Jira and Mana reach it, and the rest of its API stays closed."),
 'spacetime': ("All three editions, strongest in GurtOS Business",
   "Live shared state is what each edition's screen reads: the box screen on Server, the desktop on Personal. It matters most in Business, where several people see the same approvals at once and the first answer wins."),
 'elastic': ("GurtOS Business and GurtOS Server",
   "After a week of agents working, an ordinary OS cannot tell you what they did, and anyone with root can edit its logs. GurtOS keeps one action log of every action and Elastic keeps a copy the box cannot rewrite; its agent answers and investigates, and acting still needs your OK. Business is on main, but the agent has only been run against GurtOS Server boxes and demo runs. Next (being built): a tamper-evident log with a verify tool, detection rules with phone alerts, pause, undo and stop through approvals, a fleet view, semantic search, and asking from the portal and phone."),
 'moss': ("GurtOS Personal",
   "A personal agent is only useful if it remembers you, and today that means uploading your life to someone's cloud. On GurtOS the index lives in your own computer's memory, agents search it with no network and no keys, and undoing a task takes its files out. Only text goes to Moss's cloud copy, including what a vision model wrote about your photos. Talking to your computer is built in GurtOS Personal. Next (being built): memory that cannot be poisoned, one preference honoured across apps, photos described by a local model only, and a forget button."),
 'apify': ("GurtOS Personal and GurtOS Server",
   "GurtOS lets your agents use Apify's web robots from their own isolated space, with no keys: the broker holds the token, a scraped page is treated as untrusted data, and every run's cost is capped by the task budget and shown in the portal. On a Server box, schedules and webhooks start those tasks while you're away. It is light and open source."),
 'mana': ("GurtOS Personal and GurtOS Business",
   "AI workspaces are great for thinking, but there is no safe place for an AI to act on your real computer. Mana plans it, GurtOS does it safely in an isolated space, and you approve from your phone. Four public Mana chats shaped the credit desk rules, Business approval rules, Visa mandates and the Fetch agent team, each with what it changed in code."),
 'armadin': ("All three editions",
   "Agents get attacked through the pages they read and the packages they install, and on an ordinary OS a fooled agent can read every key and send it anywhere. GurtOS stops it at the OS, whatever the model does, in every edition, and publishes the test for each control. Next (being built): a poisoned npm package, tripwire keys, a deeper per-task sandbox, a scoreboard of about 15 OS-level attacks with its misses, a hijacked payment and an OWASP mapping."),
 'godaddy': ("All three editions",
   "One name for every edition, GurtOS Server, GurtOS Personal and GurtOS Business, all at gurtos.com."),
 'figma': ("All three editions",
   "One design system for every edition: the box screen and phone for Server, the GNOME layer for Personal, and room in the same tokens for Business."),
}
q = lambda t: "'" + t.replace("'", "''") + "'"
md = lambda t: re.sub(r'<a href="([^"]+)">(.*?)</a>', r'[\2](\1)', t).replace('<code>', '`').replace('</code>', '`')
if __name__ == '__main__':
    import sys
    root = sys.argv[1]
    for slug, (ed, pitch) in E.items():
        p = f'{root}/showcase/src/content/tracks/{slug}.mdx'; s = open(p).read()
        s = re.sub(r"^editions: .*\n", "", s, flags=re.M); s = re.sub(r"^pitch: .*\n", "", s, flags=re.M)
        s = re.sub(r"^(prize: .*\n)", lambda m: m.group(1) + f"editions: {q(ed)}\npitch: {q(pitch)}\n", s, count=1, flags=re.M)
        assert 'editions:' in s, slug
        open(p, 'w').write(s)
    p = f'{root}/docs/devpost.md'; d = open(p).read()
    d = re.sub(r"\n\*\*Best shown in:\*\*.*\n", "\n", d)
    for slug, (ed, pitch) in E.items():
        link = f"(https://calhacks.gurtos.com/tracks/{slug}/)"
        i = d.index(link); h = d.rindex('\n### ', 0, i) + 1; e = d.index('\n', h)
        d = d[:e+1] + f"\n**Best shown in:** {ed}. {md(pitch)}\n" + d[e+1:]
    open(p, 'w').write(d)
    print('ok', len(E))
