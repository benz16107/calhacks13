// Per-page route data: the product name in titles and the sidebar, and an OpenGraph image for every page.
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { getCollection } from 'astro:content';
import { NAME, named } from './product.ts';

type Entry = { label: string; entries?: Entry[] };
const rename = (entries: Entry[]) => {
  for (const e of entries) {
    e.label = named(e.label);
    if (e.entries) rename(e.entries);
  }
};

export const onRequest = defineRouteMiddleware(async (context) => {
  const route = context.locals.starlightRoute;
  const { entry } = route;
  entry.data.title = named(entry.data.title);
  if (entry.data.description) entry.data.description = named(entry.data.description);
  if (entry.data.hero) {
    if (entry.data.hero.title) entry.data.hero.title = named(entry.data.hero.title);
    if (entry.data.hero.tagline) entry.data.hero.tagline = named(entry.data.hero.tagline);
    for (const a of entry.data.hero.actions) a.text = named(a.text);
  }
  rename(route.sidebar as Entry[]);
  for (const link of [route.pagination.prev, route.pagination.next]) if (link) link.label = named(link.label);
  for (const tag of route.head) {
    if (tag.tag === 'title' && tag.content) tag.content = named(tag.content);
    if (tag.tag === 'meta' && typeof tag.attrs?.content === 'string' && /title|description/.test(String(tag.attrs.property ?? tag.attrs.name))) {
      tag.attrs.content = named(tag.attrs.content);
    }
  }

  // One image per docs page, drawn at build time by src/pages/og/[...route].ts. Generated API pages use the home page's.
  const ids = new Set((await getCollection('docs')).map((e) => e.id));
  const id = entry.id || 'index';
  if (context.url.pathname.startsWith('/docs/reference/api/')) {
    // Pages generated from the OpenAPI spec have no description of their own.
    const description = `${entry.data.title}: reference for the ${NAME} HTTP API, with its parameters, request body, responses and examples.`;
    for (const tag of route.head) {
      const key = tag.attrs?.name ?? tag.attrs?.property;
      if (tag.tag === 'meta' && (key === 'description' || key === 'og:description')) tag.attrs!.content = description;
    }
  }
  const image = new URL(`/og/${ids.has(id) ? id : 'index'}.png`, context.site ?? context.url.origin).href;
  route.head.push(
    { tag: 'meta', attrs: { property: 'og:image', content: image } },
    { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
    { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
    { tag: 'meta', attrs: { property: 'og:image:alt', content: entry.data.title } },
    { tag: 'meta', attrs: { name: 'twitter:image', content: image } },
  );
});
