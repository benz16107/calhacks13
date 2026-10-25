## What this changes and why

<!-- One or two sentences. Link the issue if there is one. -->

## Checklist

- [ ] Every commit is signed off (`git commit -s`; see CONTRIBUTING.md)
- [ ] `npm test` and `npm run check` pass
- [ ] `node release/check.ts` prints "clean" (no keys, machine names, addresses or private emails in committed files)
- [ ] The folder's README says what changed, or no README needed changing
- [ ] If it touches `core/`, the contract, `demo` or `deploy`: it is a change of its own, with a test
- [ ] I ran `./demo` on a test VM for anything the box does (CI does not run it)
