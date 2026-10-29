## What this changes and why

<!-- One or two sentences. Link the issue if there is one. -->

## How you checked it

<!-- The commands you ran and what they printed: npm test, ./demo on a VM, a screenshot for a screen change. -->

## Checklist

- [ ] Every commit is signed off (`git commit -s`; see CONTRIBUTING.md)
- [ ] `npm test` and `npm run check` pass
- [ ] `node release/check.ts` prints "clean" (no keys, machine names, addresses or private emails in committed files)
- [ ] For anything the box does at runtime: `./demo` passes on a test VM (CI does not run it)
- [ ] If it changes `portal/src`: `portal/dist` is rebuilt and committed (`cd portal && npm run build`)
- [ ] If it touches `core/` or `core/contract.ts`: it is a change of its own, with a test
- [ ] The folder's README says what changed, or no README needed changing
