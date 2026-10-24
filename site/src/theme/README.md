# GurtOS web design system

One theme for gurtos.com, gurtos.com/docs and calhacks.gurtos.com. Import these files; do not copy them.

| File | What it is |
|---|---|
| `tokens.css` | Colours, type scale, spacing and the self-hosted Atkinson Hyperlegible fonts (`fonts/`). Light and dark are `data-theme` on `<html>`. Also defines the `--color-*` and `--space-*` names the Cal Hacks site already uses. |
| `base.css` | Page styles for sites that are not Starlight: body, links, headings, code, tables, `.btn`, `.wrap`, `.ruled`. |
| `ThemeScript.astro` | Goes in `<head>`. Sets the theme before paint from `localStorage['gurtos-theme']`, the shared `.gurtos.com` cookie or the system setting. |
| `ThemeToggle.astro` | The light/dark button. Saves the choice. |
| `SiteHeader.astro` | Props `current`, `origin`, `calhacks`, `nav`. |
| `SiteFooter.astro` | Prop `origin`. |

On the Cal Hacks site pass `origin="https://gurtos.com"` to both, so the links point at gurtos.com.
