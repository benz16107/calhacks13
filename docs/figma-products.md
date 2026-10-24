# Figma products in GurtOS

GurtOS is one ecosystem, not one screen: three editions (Server, Personal, Business), the box's own screen, the portal,
the companion phone app, the docs site and the showcase. Every piece comes from one Figma design system, and the code
that builds each piece stays tied to its Figma frame. This is the plan for each Figma product: how we use it, why it
helps, and what it needs. Claude Code drives Figma through Figma's MCP server; the stage log (`stagelog.md`) records
each step with its minutes.

Researched Sat Oct 24 from Figma's product pages, help center, developer docs, Config 2026 recap and the tools the
Figma MCP connector exposes. The team is on Figma's student (Education) plan, which decides some of what follows.

## The plan

| Product or feature | How GurtOS uses it | Why it helps the ecosystem | Status |
|---|---|---|---|
| **Figma Design** | The design system (tokens, type, 60 icons, 14 app icons, 30 components) and every screen: setup, desktop, eight apps, Settings, Personal on GNOME 46, Business, the phone app | One source for every surface | Done, about 200 frames |
| **Variables and modes** | Colour tokens in Light and Dark modes, sizes, easing. An "Edition" collection with Server, Personal and Business modes drives the edition prototype | The same frame renders each edition and each theme, so they can't drift apart | Done: colours and sizes, and the Edition collection with three modes |
| **Advanced prototyping** (variables, conditionals) | The edition prototype: one Machines switcher sets the Edition variable, and conditionals pick what each home shows | Shows the three editions as one product | Done: three flows on the phone app page |
| **Dev Mode** | Each component's description holds its kit code and links to the source line | Developers see the real code next to the design | Done for 95 components |
| **Code Connect** | 95 parserless templates map every Figma component to the Preact kit (`docs/figma/code-connect/`) | Dev Mode would show code filled in from the selected instance | Templates done. Publishing needs an Organization or Enterprise plan; the MCP refuses on our plan |
| **Figma MCP server** | How the agent works: `use_figma` to build, `get_screenshot` to check, `get_design_context` and `get_variable_defs` to build code, `send_code_to_figma` for Make | The whole workflow is repeatable by any team with an agent | Used for every step |
| **REST API** | Not for variables: Figma's variables endpoints are Enterprise-only, so the token export runs through the MCP (`docs/figma/tokens/`) | | Considered, not usable on our plan |
| **Webhooks** | A `FILE_UPDATE` webhook on the design file would tell the build the design changed, so an agent re-exports tokens, runs the drift check and regenerates the comparisons | Design changes reach code without anyone remembering | Steps below; needs Ben's token |
| **Figma Make** | The GurtOS phone app as a clickable prototype ([Make file](https://www.figma.com/make/gSXGjlKZRZbtMSKjxTvjgK)), and the earlier v2 portal prototype | People can try the phone app before it exists | Done; publishing is Ben's click |
| **FigJam** | The ideation board, and a map of the whole ecosystem: editions, surfaces, the design system, the code and the checks between them | One picture of how everything fits | Done: the board and the ecosystem map |
| **Figma Slides** | The 16-slide pitch deck | The pitch uses the same frames and tokens | Done: slides 6, 14 and 15 updated to the stage log |
| **Figma Sites** | A GurtOS landing page | The public face uses the same system | Designed (desktop and mobile); publishing is Ben's click. Education plans can publish one site, without a custom domain |
| **Figma Community** | Publish the GurtOS design system with a playbook page: the agent-driven workflow and the prompts | Others can adopt the system and the workflow | Done: Cover and Playbook pages; publishing is Ben's click |
| **Shaders** | "GurtOS night hills", an animated fill: the wallpaper's four hills drifting, twinkling stars and the crescent moon, with controls for each colour, the moon's position, stars, drift and hill height ([try it](https://www.figma.com/file/new?try-tool-resource-content-id=bb18c7df-c555-4919-9e47-a98162b7a654&try-tool-resource-type=gen_fill&type=design&mode=design)) | The wallpaper becomes a living background for the landing hero, the boot screen or the deck | Built and deployed (version 6c4dbd4); not yet seen rendering, because the MCP can't draw a custom shader |
| **Generative plugins** | "GurtOS colour check" ([try it](https://www.figma.com/file/new?try-tool-resource-content-id=28a2f7db-edb2-45d5-9d15-f898c55a1ca1&try-tool-resource-type=gen_tool&type=design&mode=design)): finds solid fills and strokes not bound to a GurtOS colour variable, lists each with its nearest token, selects the layer on click, and binds the exact Light-mode matches | Keeps every new frame on the system, for us and for anyone who duplicates the Community file | Built (version 9a89a50). Its logic, run on the file: the Business and landing pages are fully bound; the phone app page has 38 unbound colours, mostly iOS camera chrome drawn on purpose |
| **Figma Motion** | The OS's motion values (100, 200, 300 ms; enter, exit and standard easing) as a spec page; the token check already flags that the kit's curves differ | Motion stays consistent across surfaces | Done: a Motion sheet on the system page |
| **Weave** | Wallpapers and imagery | | Not used: every Weave run needs Ben's OK on its cost first |
| **Figma Buzz** | Launch and social assets from the same templates | Consistent assets | Not possible from the MCP (it can't make Buzz files); steps below if Ben wants it |
| **Figma Draw** | The wallpapers and icons are vector work in Design | | Not needed separately |
| **Figma AI** (Make Image, design agent) | Not used: the agent works through the MCP so every step is logged | | |
| **Plugins and widgets** | Fonts and icons came from their sources directly | | Not needed |

## What only Ben can click

**Publish the Make prototype.** Open the [Make file](https://www.figma.com/make/gSXGjlKZRZbtMSKjxTvjgK), wait for
the preview, click **Publish** at the top right, then **Publish** again. Then **Share**, set access to **Anyone with
the link, can view**, and **Copy link**.

**Share the design file.** In the design file, click **Share**, set **Anyone with the link** to **can view**, and
copy the link. Do the same for the FigJam board and the Slides deck.

**Publish to Community.** Open the design file, click **Share**, choose **Publish to Community**, then **Publish**.
Fill in the title ("GurtOS design system"), the description from the Playbook page, a thumbnail (the Cover page) and
tags (design system, operating system, AI agents). A Community profile is needed the first time.

**The webhook.** Make a personal access token in Figma: **Settings**, **Security**, **Personal access tokens**,
**Generate new token**, with the `webhooks:write` scope. Then one request makes the webhook (Figma sends a `PING`
first, and every later change posts `FILE_UPDATE` to the endpoint with the passcode). The `context` fields follow the
May 2025 changelog; check them against Figma's webhooks reference before running:

```sh
curl -X POST https://api.figma.com/v2/webhooks -H "X-Figma-Token: $FIGMA_TOKEN" -H 'Content-Type: application/json' \
  -d '{"event_type":"FILE_UPDATE","context":"file","context_id":"oppzH621OOOMA31rgLbxbM","endpoint":"<receiver URL>","passcode":"<secret>"}'
```

The receiver can be a T3 webhook task that runs the Figma thread's refresh: re-export the variables, run
`node docs/figma/tokens/sync.ts --check` and `node docs/figma/compare/compare.ts`, and open a pull request if anything
changed.

## Sources

- [Figma newsroom](https://www.figma.com/newsroom/) (product list) and the [Config 2026 recap](https://www.figma.com/blog/config-2026-recap/)
- [Code Connect plans](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect) and the MCP's own answer on our plan
- [Variables REST endpoints](https://developers.figma.com/docs/rest-api/variables-endpoints/) (Enterprise only)
- [Personal access tokens](https://developers.figma.com/docs/rest-api/personal-access-tokens/) and the [REST changelog](https://developers.figma.com/docs/rest-api/changelog) (file-level webhooks, May 2025)
- [Explore Figma Sites](https://help.figma.com/hc/en-us/articles/31230436657815-Explore-Figma-Sites) and Figma's forum answers on Education plans
- [Publish files to the Figma Community](https://help.figma.com/hc/en-us/articles/360040035974-Publish-files-to-the-Figma-Community)
