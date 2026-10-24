# Contributing to GurtOS

Thanks for looking. GurtOS is a preview built at Cal Hacks 13.0, so expect rough edges. Issues and pull requests
are welcome. By contributing you agree that your work is licensed under the [Apache License 2.0](LICENSE), like
the rest of the project.

**Security problems:** report them privately through
[GitHub security advisories](https://github.com/benz16107/calhacks13/security/advisories/new), not in a public
issue. Include what you ran and what you saw.

## Set up

You need Node 22.18 or newer. On any machine:

```sh
npm ci
npm test          # unit tests
npm run check     # type check
```

Node runs the TypeScript directly (type stripping), so there is no build step for the box. The portal has its
own (`cd portal && npm ci && npm run build`), and its built `portal/dist` is committed so a box needs no build.

## A test VM

The box creates Linux users, firewall rules and systemd services, so **never run it as root on your own
machine**. Use an Ubuntu 24.04 VM (x86_64 or arm64) where you have passwordless sudo: Lima, Multipass, UTM, or a
cloud VM all work.

```sh
BOX_SHELL='ssh my-vm' ./demo     # ship this checkout to the VM and run the merge gate there
./demo --here                    # or, inside the VM, run it in place
sudo core/install.sh             # inside the VM: install this checkout as the box service (/opt/box)
```

`./demo` is the merge gate: the four moments (undo one task, the booby-trapped page, a pause for your OK, pull
the plug), then every app's `tracks/*/demo.ts`. It uses a scripted worker, so it spends nothing.
`./demo --live-droid` also runs the steps with real Droid, which needs a model key in the VM's vault and spends
model credit. A change is ready when `./demo` exits 0.

Put keys only in the VM's `/etc/box/vault.env` (root, mode 0600, `NAME=value` lines), never in the repo.

## Where things go

Read `core/README.md` first: it explains tasks, the action log, the network, the vault, approvals, and the slots
an app plugs into. `tracks/example/` shows every slot in working code.

- **A new app** is a folder `tracks/<name>/` with `track.ts` (default-exports a `Track`), a `demo.ts` step, and a
  README that says what it does and which keys it needs. The core finds it at boot; the core never imports an
  app. An app must work, or stay off, when its keys are missing.
- **The core** (`core/`) and the contract (`core/contract.ts`) change carefully. Keep such a change separate from
  app work, and add a test.
- **The screen** is `portal/` (Preact, built with esbuild). **The desktop layer** is `personal/` (Python and GTK).
  **The images** are `image/`.
- **Docs** for people are `site/` (gurtos.com). Keep `README.md` files in each folder accurate.

## Style

- Anything a person reads says **GurtOS** (and GurtOS Server, GurtOS Personal). Internal names stay `box`
  (`core/box.ts`, `BOX_*`, `box.service`, `/etc/box`).
- Write for people: plain words, short sentences, no em dashes.
- Comments say why, not what.
- Label test or simulated payments as test, in the UI and the README.
- No machine names, IP addresses, personal email addresses, keys or tokens in committed files. `release/check`
  scans for them.

## Build the images

`image/build` builds on any Ubuntu 24.04 machine or VM with root. See `image/README.md` for the editions and
options, and `release/README.md` for how a release is built, signed and published.
