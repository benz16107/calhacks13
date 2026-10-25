# Set up a GurtOS computer with an agent

Hand a new GurtOS computer (Server or Personal) to an AI agent on another computer, and let it do the setup. The
owner does a few things at the new computer; the agent does the rest over the network and stops only where the
owner is needed.

## What the owner does first

1. Start the new computer from the GurtOS disc and finish installing it.
2. On its first setup screen, connect it to the network (Wi-Fi or a cable).
3. Choose **Set up from another computer**. The screen shows an 8-character code and one or more addresses like
   `http://192.168.1.20:7701`. The code works once, for 30 minutes. Only someone at this screen can see it.
4. Tell your agent:

       Set up the new GurtOS computer at http://192.168.1.20:7701 with code a1b2c3d4, by following AGENT-SETUP.md.

The agent's computer must be on the same network, or reach the address another way (a VPN, or the computer's
`<name>.box.gurtos.com` address once remote access is on).

## What the agent does

Use either way in. Both run the same steps through the computer's setup API, which is the same code the setup
screen uses, and every step goes in the computer's action log.

**With Claude Code (MCP):**

    claude mcp add gurtos-setup --env BOX_URL=http://192.168.1.20:7701 --env BOX_SETUP_CODE=a1b2c3d4 -- node <repo>/core/claude-mcp.ts

Then use the `setup_*` tools: `setup_status`, `setup_set_key`, `setup_owner`, `setup_folders`, `setup_settings`,
`setup_app`, `setup_remote`, `setup_pair_phone`, `setup_doctor`, `setup_finish`.

**With the command line** (Node 22 or newer, from a checkout of this repo):

    node core/gurtos.ts connect http://192.168.1.20:7701 a1b2c3d4
    node core/gurtos.ts status

Every command prints JSON: `{"ok": true, "result": ...}`, or `{"ok": false, "error": "..."}` with exit code 1.

The steps, in order:

1. **Model key.** `gurtos key set ANTHROPIC_API_KEY` with the key on stdin (or `FACTORY_API_KEY`). The computer
   tries it before saving it; a key Anthropic refuses is not saved. A key is never printed, shown again or logged.
   **Stop for the owner** if they would rather not give you the key: they can paste it on the computer's screen
   (Settings, Keys), and you carry on.
2. **Owner** (Personal): `gurtos owner <their account name>`.
3. **Folders** (Personal): `gurtos folders /home/<owner>/Documents ...`. Agents may be handed only these.
4. **Apps:** `gurtos apps` lists them; `gurtos app on <id>` for each the owner wants. A new computer starts with only
   the model app on. Apps that need their own keys need `gurtos key set <NAME>` first.
5. **Spending:** `gurtos budget 5 1` asks before any single spend over $5 and gives a task $1 (the defaults).
6. **Remote access** (optional): `gurtos remote on [name]` gives the computer `https://<name>.box.gurtos.com`.
7. **The owner's phone:** `gurtos pair` prints a link and a code. **Stop for the owner:** give them the link to open
   on their phone. It pairs as the owner's phone.
8. **Check:** `gurtos doctor` lists anything missing. Repeat the steps it names.
9. **Finish:** `gurtos finish` when `gurtos doctor` is clean. This ends your access.

## When setup is done

`gurtos doctor` reported nothing missing, the owner's phone is paired, and `gurtos finish` returned. After finish,
your setup token stops working and the computer stops listening for setup on the network.

## What keeps this safe

- The code is the only way in, and only the computer's own screen shows it. Wrong codes are limited to 10 a minute.
- The token it gives you lasts until setup finishes, two hours at most. The owner can press **Stop** on the screen
  at any time, which ends it at once.
- Requests through the setup address always count as coming from the network, so they need the token.
- Every step is in the action log, with your agent's name. Keys appear there by name only.
- There is no setup account on the computer and no shell: on GurtOS Server there is none at all. On GurtOS Personal
  the owner can turn on ordinary ssh in Settings, Sharing, if they want it.
