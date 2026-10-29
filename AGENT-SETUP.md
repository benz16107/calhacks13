# Set up a GurtOS computer with an agent

Hand a new GurtOS computer (Server or Personal) to an AI agent on another computer, and let it do the setup. The
owner does a few things at the new computer; the agent does the rest over the network and stops only where the
owner is needed.

## What the owner does first

1. Start the new computer from the GurtOS disc and finish installing it.
2. On its first setup screen, connect it to the network. GurtOS Server needs a network cable; GurtOS Personal can
   also use Wi-Fi.
3. Choose **Set up from another computer**. The screen shows an 8-character code and one or more addresses like
   `http://192.168.1.20:7701`. The code works once, for 30 minutes. Only someone at this screen can see it.
4. Tell your agent:

       Set up the new GurtOS computer at http://192.168.1.20:7701 with code a1b2c3d4, by following AGENT-SETUP.md.

The agent's computer must reach that address: be on the same home or office network, or on the same private
network such as Tailscale. The setup address is plain HTTP, so the code, the setup token and any key you send
cross the network unencrypted. Use a network you trust, or a private network that encrypts, such as Tailscale.

Do not set up a cloud VM over its public address: the setup port answers only private networks, so the box's
firewall refuses it, and the code, the token and the key would cross the internet unencrypted. Run setup in the provider's web console, which shows the box's screen, or join the VM to a private
network such as Tailscale first. Remote access (`<name>.box.gurtos.com`) does not help here: it can only be turned on during or after setup,
and it needs a relay (step 6).

## What the agent does

Use either way in. Both run the same steps through the computer's setup API, which is the same code the setup
screen uses, and every step goes in the computer's action log.

**With Claude Code (MCP)**, from a checkout of this repository:

    claude mcp add gurtos-setup --env BOX_URL=http://192.168.1.20:7701 --env BOX_SETUP_CODE=a1b2c3d4 -- node <repo>/core/claude-mcp.ts

Then use the `setup_*` tools: `setup_status`, `setup_doctor`, `setup_set_key`, `setup_keys`, `setup_owner`,
`setup_folders`, `setup_settings`, `setup_apps`, `setup_app`, `setup_remote`, `setup_pair_phone`, `setup_finish`.

**With the command line** (Node 22.18 or newer, from a checkout of this repository). Below, `gurtos` means
`node core/gurtos.ts`:

    node core/gurtos.ts connect http://192.168.1.20:7701 a1b2c3d4
    node core/gurtos.ts status

Every command prints JSON: `{"ok": true, "result": ...}`, or `{"ok": false, "error": "..."}` with exit code 1. The
setup token is kept in `~/.config/gurtos/setup.json` (mode 0600) until setup finishes.

**With plain HTTP** (any language): trade the code for a token, then call the setup API with it:

    curl -s -X POST http://192.168.1.20:7701/api/pair -H 'content-type: application/json' -d '{"code":"a1b2c3d4","name":"My agent","kind":"setup"}'
    curl -s http://192.168.1.20:7701/api/setup -H "authorization: Bearer <token>"

`kind: "setup"` is required. A code typed with capitals or a dash (`A1B2-C3D4`) works too. The routes are in
`core/README.md` (Setup from another computer).

The steps, in order:

1. **Model key.** `gurtos key set ANTHROPIC_API_KEY` with the key on stdin (or `FACTORY_API_KEY`). The computer
   tries it before saving it; a key Anthropic refuses is not saved. A key is never printed, shown again or logged.
   **Stop for the owner** if they would rather not give you the key: they can paste it on the computer's own screen
   in Settings, and you carry on.
2. **Owner** (Personal): `gurtos owner <their account name>`.
3. **Folders** (Personal): `gurtos folders /home/<owner>/Documents ...`. Agents may be handed only these.
4. **Apps** (optional): a new computer has only the model app on, and that is enough to run tasks. `gurtos apps`
   lists the others. Turn one on with `gurtos app on <id>` only if the owner asked for it. An app that needs keys of
   its own needs `gurtos key set <NAME>` first. Apps marked as test only use test money.
5. **Spending:** `gurtos budget 5 1` asks before any single spend over $5 and gives a task $1 (the defaults).
6. **Remote access** (optional, usually skip): `gurtos remote on [name]` asks a relay for an `https://<name>...`
   address. The hosted relay at `box.gurtos.com` is offline, so this fails with a message saying the relay cannot be
   reached, unless the owner runs their own relay ([docs/self-host.md](docs/self-host.md)) and the computer points
   at it. Setup does not need it.
7. **The owner's phone:** `gurtos pair` prints a code and two links. `boxUrl` is the computer's own pairing page;
   `url` goes through app.gurtos.com and needs a relay. **Stop for the owner:** give them the `boxUrl` link to open on
   their phone, which must be on the same network as the computer. It pairs as the owner's phone.
8. **Check:** `gurtos doctor` lists anything missing. Repeat the steps it names.
9. **Finish:** `gurtos finish` when `gurtos doctor` is clean. This ends your access.

## When setup is done

`gurtos doctor` reported nothing missing, the owner's phone is paired, and `gurtos finish` returned. After finish,
your setup token stops working and the computer stops listening for setup on the network.

## What keeps this safe

- The code is the only way in, and only the computer's own screen shows it. Wrong codes are limited to 5 a minute
  from one address and 60 a minute in all.
- The token it gives you lasts until setup finishes, two hours at most. The owner can press **Stop** on the screen
  at any time, which ends it at once.
- Requests through the setup address always count as coming from the network, so they need the token.
- Every step is in the action log, with your agent's name. Keys appear there by name only.
- There is no setup account on the computer and no shell: on GurtOS Server there is none at all. On GurtOS Personal
  the owner can turn on ordinary ssh in Settings, Sharing, if they want it.
- What it does not protect: traffic on the network itself. The setup address is plain HTTP, so anyone who can watch
  your network while setup runs can read what the agent sends, keys included.
