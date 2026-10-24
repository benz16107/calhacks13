# Tokens: Figma variables and the kit's CSS, kept in step

The GurtOS colours, spacing, radii, sizes and motion live as variables in the Figma design file. The kit
(`portal/src/kit/kit.css`) has the same tokens as CSS variables. These files keep the two the same.

| File | What it is |
|---|---|
| `export-variables.js` | The plugin code that reads every local variable in the Figma file, in every mode, with aliases resolved |
| `figma-variables.json` | Its output: every collection, mode and value, in a stable order so a diff shows what changed |
| `sync.ts` | The drift check, the CSS generator and a self-test. Node 22, no packages |
| `tokens.css` | The kit's tokens generated from Figma, in the kit's names, with Light in `:root` and Dark under `[data-theme='dark']` and `prefers-color-scheme` |

Only the two GurtOS collections count: GurtOS Color (Light and Dark) and GurtOS Size. Color, Primitives and Size are
the retired direction A and are exported but not checked.

## Names

A Figma variable becomes a CSS variable with the same name: `window/bg` is `--color-window-bg`, `space/xs` is
`--space-xs` (in px), `motion/duration-fast` is `--duration-fast` (in ms). One name differs today: Figma's
`button/hover` is the kit's `--color-button-bg-hover`. `CODE_NAME` in `sync.ts` lists it.

## Refresh the export

When a variable changes in Figma:

1. Run `export-variables.js`. An agent runs it through the Figma MCP's `use_figma` on file `oppzH621OOOMA31rgLbxbM`;
   the tool returns the object. A person can paste it into a plugin console, wrapped in `(async () => { ... })()`,
   and copy the logged JSON.
2. Save the result as `figma-variables.json`, formatted with two-space indents.
3. Run `node docs/figma/tokens/sync.ts --check`, then `--css` if the portal imports `tokens.css`.

## Run the check

```
node docs/figma/tokens/sync.ts --self-test   # the parsing and comparison
node docs/figma/tokens/sync.ts --check       # exit 1 when the kit differs from Figma
node docs/figma/tokens/sync.ts --css         # write tokens.css from Figma
```

Colours match when each channel is within 1 of Figma's, because Figma rounds to whole numbers. Tokens the kit has and
Figma doesn't (shadows, `--size-topbar`, `--ease-out`) are listed as "code only" and don't fail the check.

## Why not Figma's REST API

Figma's variables endpoints (`GET /v1/files/:file_key/variables/local`) are only for full members of Enterprise
organizations ([Figma REST API, variables](https://developers.figma.com/docs/rest-api/variables-endpoints/)). Our file
is not on Enterprise, so the export runs as plugin code through the MCP instead. With an Enterprise plan, the same
JSON could come from that endpoint and this export could run without an agent.

## Make main fail on drift

The portal thread owns `portal/`. One line in `portal/demo.ts`, next to its other checks, makes the merge gate fail
when the kit drifts from Figma:

```ts
import { spawnSync } from 'node:child_process';
d.check(spawnSync(process.execPath, [new URL('../docs/figma/tokens/sync.ts', import.meta.url).pathname, '--check'], { stdio: 'inherit' }).status === 0, 'the kit tokens match the Figma variables');
```

`sync.ts` finds its files from its own folder, so it works from any working directory. Add the line once the drift
below is fixed, or main fails straight away.

## The drift on Sat Oct 24, 3:20 AM PT

`--check` finds 18 drifts across 82 Figma tokens:

- Values that differ: `--color-accent-on` Dark (Figma `#0f1b2a`, code `#0f1720`), `--color-destructive-on` Dark
  (Figma `#2a0b07`, code `#1c0d0b`), and `--color-scrim` (Figma Light `#0b0e1273`, Dark `#0000008c`; code
  `rgb(0 0 5 / 0.45)` in both).
- In Figma, not in the kit: `--color-app-elastic`, `--color-app-mana`, `--color-app-web`, `--color-card-hover`, the four
  `--color-desktop-hill-*`, `--size-row`, `--size-row-two-line`, and the three `--easing-*` curves. The kit has
  `--ease-out` and `--ease-in` with other curves instead.

Either side can change: fix the variable in Figma and re-export, or take the value from `tokens.css` into the kit.
