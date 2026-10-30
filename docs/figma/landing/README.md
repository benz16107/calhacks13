# GurtOS landing page (for Figma Sites)

A one-page site for GurtOS, built from the design system and the real GurtOS screens, in a desktop (1440) and a phone
(390) layout. The Figma page is "GurtOS landing (Sites)" in the [design file](https://www.figma.com/design/oppzH621OOOMA31rgLbxbM):
`Landing / Desktop 1440` (`142:87`) and `Landing / Mobile 390` (`144:864`).

| PNG | What it shows |
|---|---|
| `landing-desktop-1440.png` | The night-hills hero with the real desktop and the Fogline Supply notification, the four moments each beside its real screen, the three editions, the phone app, and the footer |
| `landing-mobile-390.png` | The same page stacked for a phone |

What's on it:

- **Hero.** "An operating system for AI agents that work for you, safely", the README's own facts, Download the preview
  and Read the docs, and the preview's honest status (not security audited yet; use a spare machine or a VM).
- **The four moments**, each with the GurtOS screen that shows it: the Undo dialog, the task with its blocked
  attempts, Rosa's $40,000 request, and the desktop after a power cut.
- **Three editions.** Three instances of one component, `EditionCard`, each set to a different mode of the
  "GurtOS Edition" variables (Server, Personal, Business), so the page and the phone app can't disagree.
- **The phone app**: the machine switcher, the notification named by its machine, and the approval it opens.
- **Footer** links: the docs (gurtos.com), the showcase, GitHub, the release notes and the Figma Community file.

Everything is auto layout and GurtOS variables, so it carries into Sites with its colours bound.

## Putting it on Figma Sites (only Ben can do this)

The Figma MCP can't create a Sites file, so this takes a few clicks:

1. In Figma, in the School team, click **New**, then **Site**.
2. In the design file, open the page "GurtOS landing (Sites)", select `Landing / Desktop 1440` and copy it
   (Cmd+C). In the Site, paste it as the page. Sites keeps the auto layout.
3. In the Site, add a **Mobile** breakpoint, then paste `Landing / Mobile 390` into it.
4. Link the buttons and footer links: Download to
   `https://github.com/benz16107/gurtos/releases/tag/v0.1.0-preview`, Docs to `https://gurtos.com`, Showcase
   to `https://calhacks.gurtos.com`, GitHub to `https://github.com/benz16107/gurtos`, and the Figma link to the
   Community file once it is published.
5. Click **Publish**. On an Education plan Figma allows one published site, on a `figma.site` address (no custom
   domain). Put the address in `docs/figma.md`.
