# GurtOS documentation

The public docs at https://gurtos.com, built with Astro Starlight. Pages are Markdown in `src/content/docs/`.

```sh
npm ci
npm run dev       # live preview
npm run build     # static site in dist/, with the search index, sitemap, llms.txt and OpenGraph images
npm run check     # after a build: every internal link resolves, and nothing private is in dist/
```

- The product name is `NAME` in `src/product.ts`. Prose is written as "GurtOS"; a Markdown plugin
  (`src/product-name.ts`) and the route middleware (`src/routeData.ts`) put `NAME` into every page, title and
  OpenGraph image. The OpenAPI spec and the screenshots hold the name as literal text.
- The HTTP API pages are generated from `openapi/box-api.yaml`.
- Screenshots in `src/assets/screens/` are the portal's Figma design (`docs/figma/os/`), edited to show the
  product name and example values in place of personal ones.
- Theme: `src/styles/theme.css`, from the design tokens in `docs/figma.md`. Diagrams are SVG in
  `src/assets/diagrams/` and take their colours from the theme.

## Deploy

The site is static. `vercel.json` adds trailing slashes and long-lived caching for built assets. The www.gurtos.com to gurtos.com redirect is set on the project's domain (`vercel api /v9/projects/gurtos-docs/domains/www.gurtos.com -X PATCH -F redirect=gurtos.com -F redirectStatusCode=308`). Deploy the
built `dist/` with that file from a folder outside the git checkout, so Vercel does not connect the repository:

```sh
npm run build && npm run check
rm -rf /tmp/gurtos-docs && cp -r dist /tmp/gurtos-docs && cp vercel.json /tmp/gurtos-docs/
cd /tmp/gurtos-docs && vercel link --yes --project gurtos-docs && vercel deploy --prod --yes
```

To roll back, promote the previous deployment: `vercel rollback` in that folder, or in the Vercel dashboard.
