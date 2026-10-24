# Playbook: designing an ecosystem with an agent driving Figma

How GurtOS was designed: one person, Claude Code as the agent, and Figma's MCP server as the bridge. The same steps
work for any product with more than one surface. This is also the text of the "Playbook" page in the GurtOS
Community file.

## What you need

- A Figma file you can edit, and Figma's MCP server connected to your agent (Claude Code here).
- A repo the agent can write to. Designs leave Figma as PNGs plus a README per set, with node IDs, so code threads
  build from them.
- A stage log (`docs/stagelog.md`): one line per step with the Figma tool, the real minutes and an honest rating.

## The loop, step by step

| Step | What the agent does | MCP tools | What comes out |
|---|---|---|---|
| 1. Research and ideate | Reads the brief, looks at references, and maps the product on a FigJam board | `generate_diagram`, `use_figma` in FigJam | A board with the moments the product must show, and directions to choose from |
| 2. Foundations | Makes the variables (colour in Light and Dark modes, sizes, easing), text styles, icons from SVG, and components with properties | `use_figma`, `upload_assets` | A system where every colour is bound to a variable |
| 3. Checkpoint | Builds three or four key screens only, screenshots each, exports them, and stops for the owner's yes | `use_figma`, `get_screenshot` | A short decision for the owner instead of 50 screens to undo |
| 4. The full set | Builds every screen from components, checks every screenshot, fixes overflow and wording, exports in batches so code can start | `use_figma`, `get_screenshot` | PNGs and a README per set with node IDs and the API fields each screen reads |
| 5. Prototype | Wires clicks, sets variables and modes, and uses conditionals for state | `use_figma` (`setReactionsAsync`) | A clickable flow in Figma, and a Make prototype for anything that needs real state |
| 6. Handoff | Writes each component's kit code and source link into Dev Mode, and Code Connect templates | `use_figma`, Code Connect tools | Dev Mode shows the code that builds each component |
| 7. Code generation | Reads frames and variables, then writes the kit and the screens | `get_design_context`, `get_variable_defs` | The real app, built from the same tokens |
| 8. Keep it in step | Re-exports the variables and runs the drift check; regenerates app-vs-Figma comparisons | `use_figma`, scripts in `docs/figma/` | A failing check when code and design disagree |

## Prompts we used

The owner wrote the briefs. These are short excerpts, as given to the agent:

- **Redesign:** "the UI is kinda bad and low quality… looks like a SaaS product rather than an OS. … Research briefly
  … Checkpoint. First do the research, the system foundations, and four screens."
- **A new edition:** "GurtOS Personal must not look like Ubuntu with an app on top." Then "Ben needs to see GurtOS
  Business before it's built. … Design these in the approved system and export to docs/figma/business/."
- **A new surface:** "one GurtOS companion phone app for all three editions, switchable between paired machines like
  switching accounts."
- **The ecosystem:** "we're designing not just an OS but an entire ecosystem … so it needs a strong design system
  where everything fits together, looks consistent, and the code isn't lost between design and build."

## Rules the agent follows

- Bind every colour to a variable. A raw hex in a frame is a bug the token check can't see.
- Build screens from components; change the component, not the copy.
- Screenshot every frame before export and fix what's wrong: clipped text, overlap, stale names, clocks that don't
  match the story.
- Use real data from the product (the credit desk's case, the core's sentences), and label test money as test.
- Checkpoint before a big set; merge in batches; log every step with its real minutes.
- Write for people: plain words, short sentences, no em dashes.

## Adopting it

1. Duplicate the GurtOS Community file. Change the "GurtOS Color" variables to your palette; every screen follows in
   Light and Dark.
2. Connect your agent to Figma's MCP server and point it at your file.
3. Copy `docs/figma/tokens/` (the variable export and drift check) and `docs/figma/compare/` (side-by-side
   comparisons) from the GurtOS repo, and change the paths to your kit.
4. Keep a stage log from the first step.
