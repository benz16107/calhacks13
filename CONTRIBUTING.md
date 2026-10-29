# Contributing to GurtOS

Thanks for looking. GurtOS is a preview maintained by one person, so expect rough edges and slow replies. Issues
and pull requests are welcome. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first, and see the
[roadmap](ROADMAP.md) for what is planned and what is not.

**Security problems:** report them privately, as [SECURITY.md](SECURITY.md) describes, not in a public issue.

## Set up

You need git and Node 22.18 or newer (CI uses Node 24). On Linux, macOS or Windows with WSL:

```sh
git clone https://github.com/benz16107/calhacks13.git gurtos
cd gurtos
npm ci                    # the box, the relay and the apps
npm ci --prefix portal    # the portal's own packages; its tests import them
npm test                  # unit tests
npm run check             # type check
node release/check.ts     # no keys, machine names, addresses or private emails in committed files
```

`release/check.ts` also runs [gitleaks](https://github.com/gitleaks/gitleaks) on the files if it is installed, and
says so if it is not. CI runs all of these, builds the portal and the docs site, and runs gitleaks over the whole
history.

Node runs the TypeScript directly (type stripping), so the box has no build step. Two parts do:

- **The portal** (`portal/`, Preact, built with esbuild). The box serves the built copy in `portal/dist`, which is
  committed, so a box needs no build. After changing `portal/src`, run `cd portal && npm run build` and commit
  `portal/dist` with your change. CI fails if `portal/dist` does not match the sources.
- **The docs site** (`site/`, Astro and Starlight): `cd site && npm ci && npm run build && npm run check`.

## Run the box on a test VM

The box creates Linux users, firewall rules and systemd services, so **never run it as root on your own
machine**. Use an Ubuntu 24.04 VM, x86_64 or arm64, with the internet and passwordless sudo. The box downloads
Node.js, SpacetimeDB and Factory's Droid CLI into it on the first run. Our own test VM has 6 cores, 8 GB of memory
and a 60 GB disk; smaller ones may work but have not been timed.

Any VM you can reach with a command works. Two examples:

```sh
# Lima (Linux or macOS): its default user has passwordless sudo
limactl start --name=gurtos --cpus=4 --memory=8 --disk=40 template:ubuntu-24.04
BOX_SHELL='limactl shell --workdir / gurtos --' ./demo

# Any VM over ssh, as a user with passwordless sudo
BOX_SHELL='ssh my-vm' ./demo
```

`./demo` copies this checkout (tracked and new files, not ignored ones) to `/opt/box-dev/<folder>` on the VM, prepares
the VM, and runs the merge gate there. You can also run it inside the VM, in a clone: `./demo --here`.

The merge gate runs the four moments (undo one task, the booby-trapped page, a pause for your OK, pull the plug),
then every app's `tracks/*/demo.ts`. It uses a scripted worker, so it spends nothing and needs no keys. Exit 0 means
it passed. A full run takes a while; while you work, run one part:

```sh
BOX_SHELL='ssh my-vm' DEMO_ONLY=example ./demo     # one app's step (the folder name under tracks/)
./demo --live-droid                                # also the real Droid steps: needs a model key and spends credit
```

To name your VMs once, put lines like `myvm=ssh my-vm` in `~/.config/gurtos/machines` (not in the repository).
Then `./demo myvm` uses that line, and a line named `default` makes plain `./demo` use it.

To keep a box running on the VM, `sudo core/install.sh` there installs this checkout as the box service in
`/opt/box`, with its API on `127.0.0.1:7700`. Put keys only in the VM's `/etc/box/vault.env` (root, mode 0600,
`NAME=value` lines), never in the repository. To work on the portal against a live box, see
[portal/README.md](portal/README.md).

## Open a pull request

1. Fork the repository and make a branch from `main`.
2. Make the change, with a test for new logic. Keep a change to `core/` or `core/contract.ts` separate from app work.
3. Run `npm test`, `npm run check` and `node release/check.ts`. For anything the box does at runtime, run `./demo`
   on your VM and say in the pull request that it passed. CI cannot run it.
4. Sign off every commit (below) and open the pull request against `main`. The template lists what to check.

The maintainer runs the merge gate on their own VM before merging a change to the box.

## Sign your work (DCO)

GurtOS uses the [Developer Certificate of Origin](https://developercertificate.org/). It is a short statement that
you wrote the change or have the right to submit it under the project's licence ([Apache-2.0](LICENSE)). You agree
to it by signing off each commit:

```sh
git commit -s -m "Say what changed"      # adds: Signed-off-by: Your Name <you@example.com>
```

The name and address come from `git config user.name` and `user.email`. If you do not want your email address in a
public repository, use the private address GitHub gives you (`<id>+<name>@users.noreply.github.com`, in your email
settings). To sign off commits you already made: `git rebase --signoff origin/main`, then push.

## Where things go

Read [core/README.md](core/README.md) first: it explains tasks, the action log, the network, the vault, approvals,
and the slots an app plugs into. `tracks/example/` shows every slot in working code.

- **A new app** is a folder `tracks/<name>/` with `track.ts` (default-exports a `Track`), a `demo.ts` step, and a
  README that says what it does and which keys it needs. The core finds it at boot and never imports an app. An app
  must work, or stay off, when its keys are missing.
- **The core** (`core/`) and the contract (`core/contract.ts`) change carefully, with a test.
- **The screen** is `portal/`. **The desktop layer** of GurtOS Personal is `personal/` (Python and GTK).
  **The images** are `image/`; `image/build` builds them on any Ubuntu 24.04 machine with root (see
  [image/README.md](image/README.md)).
- **Docs** for people are `site/` (gurtos.com). Keep each folder's README accurate. [docs/README.md](docs/README.md)
  says which notes in `docs/` are current.

## Style

- Anything a person reads says **GurtOS** (and GurtOS Server, GurtOS Personal, GurtOS Business). Internal names stay
  `box` (`core/box.ts`, `BOX_*`, `box.service`, `/etc/box`).
- Write for people: plain words, short sentences, no em dashes.
- Comments say why, not what.
- Label test or simulated payments as test, in the UI and the README.
- No machine names, IP addresses, personal email addresses, keys or tokens in committed files.
