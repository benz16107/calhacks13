# One source for every track's "Best shown in" line and pitch. Writes them into each track page's frontmatter and
# docs/devpost.md. Usage: python3 showcase/scripts/story/pitches.py <repo root>
import re, json
BIZ = "GurtOS Business is not built yet. Today's demo runs on GurtOS Server, with the credit desk's human controller seat approving from a phone."
E = {
 'anthropic': ("GurtOS Personal and GurtOS Server",
   "Turn an old laptop or any spare computer into your own AI computer, built for agents. You own it and hold the keys, instead of renting someone else's cloud. Next is a GurtOS MCP server (planned), so Claude Desktop and Claude Code can drive your box."),
 'factory': ("GurtOS Server and GurtOS Personal",
   "Droid does the work and GurtOS makes it safe. Droid never holds a key: the vault keeps it and the box's proxy swaps it in outside the task. Each task is its own Linux user with its own firewall rule and its own copy of the files, on a locked-down Linux base where task users have no sudo, and every change is reviewable in the log and undoable. Keys kept where agents can reach them keep leaking: <a href=\"https://www.bleepingcomputer.com/news/security/opencode-hack-exposes-api-keys-amid-ai-distillation-attacks/\">OpenCode Console exposed users' provider API keys</a> on Oct 17, 2026, <a href=\"https://github.com/openclaw/openclaw/issues/43794\">OpenClaw stores tokens and API keys in plaintext</a> in <code>~/.openclaw/openclaw.json</code>, and <a href=\"https://nvd.nist.gov/vuln/detail/CVE-2026-25253\">CVE-2026-25253</a> let one crafted link make OpenClaw send its token to an attacker."),
 'hyphenate': ("GurtOS Business (preview)",
   "A finance team needs roles, segregation of duties and an audit trail on every agent decision, which is what Business adds: who may approve what, up to how much. " + BIZ),
 'crs': ("GurtOS Business (preview)",
   "Agents today run as you, with your keys and no separation of duties, so no company lets one near the books. Identity and fraud checks are team work: an analyst agent runs them, a controller signs off, and every decision keeps its CRS request ids for the audit. " + BIZ),
 'nessie': ("GurtOS Business (preview), then GurtOS Personal",
   "Agents today run as you, with your keys and no separation of duties, so no company lets one near the books. A collections clerk agent reconciles the ledger against the bank for a finance team, and only a controller releases a hold. On Personal the same pattern becomes a bill-paying agent for your own accounts that asks before it pays (not built). " + BIZ),
 'microsoft': ("GurtOS Business (preview)",
   "Agents today run as you, with your keys and no separation of duties, so no company lets one near the books. In a company, production for an agent means roles, approvals routed to the right person, budgets and an audit trail. GurtOS already separates users, keys, approvals and the log; Business adds the people. " + BIZ),
 'atlassian': ("GurtOS Business (preview)",
   "Teams already review work in Jira. With Business, every agent task is an issue a teammate can approve or roll back, and Jira's own permissions decide who may. Business is not built yet: today the Forge app drives a GurtOS Server box, and it already checks that the Jira user may edit the issue."),
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
   "Live shared state is what each edition's screen reads: the box screen on Server, the desktop on Personal. It matters most in Business (preview, not built), where several people see the same approvals at once and the first answer wins."),
 'elastic': ("GurtOS Business (preview) and GurtOS Server",
   "\"What did every agent do this week?\" is an audit question. A Server owner asks it the morning after; a Business team would ask it across everyone's tasks. Business is not built yet, so today the agent answers for GurtOS Server boxes."),
 'moss': ("GurtOS Personal",
   "Your photos, files and task history are personal. /find keeps its index on your own machine, and only text, never a photo, goes to Moss's cloud copy."),
 'apify': ("GurtOS Personal and GurtOS Server",
   "Agents doing your web errands, a price check or a place nearby, never hold the Apify token. It stays in the vault on your own machine, a laptop on Personal or an always-on box on Server."),
 'mana': ("GurtOS Personal",
   "Mana is a personal workspace for planning and small apps; GurtOS Personal is the computer where your agents do the work. Here a Mana chat rewrote the credit desk's rules, and a Mana app shows a box's live status."),
 'armadin': ("All three editions",
   "The protections live in the core every edition shares: separate users, the vault and broker, per-task network rules, approvals and the log. A booby-trapped page fails the same way on Server, Personal and Business."),
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
