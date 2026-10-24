// One 1200 x 630 OpenGraph image per docs page, drawn at build time. src/routeData.ts links each page to its image.
import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';
import { NAME, named } from '../../product.ts';

const entries = await getCollection('docs');
const pages = Object.fromEntries(entries.map((e) => [e.id, e.data]));
// The landing page at / has no docs entry.
pages.index = { title: NAME, description: `${NAME} is an operating system where AI agents do real work, with Server and Personal downloads.` } as (typeof pages)[string];

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'route',
  pages,
  getImageOptions: (_path, page: (typeof pages)[string]) => ({
    title: named(page.title),
    description: named(page.description ?? `${NAME} documentation`),
    logo: { path: './src/assets/logo-og.png', size: [80] },
    bgGradient: [[0x27, 0x31, 0x3f]],
    padding: 72,
    fonts: ['./src/fonts/InstrumentSans.ttf'],
    font: {
      title: { families: ['Instrument Sans'], weight: 'SemiBold', size: 68, lineHeight: 1.1, color: [0xf2, 0xef, 0xe8] },
      description: { families: ['Instrument Sans'], weight: 'Normal', size: 32, lineHeight: 1.4, color: [0xb9, 0xc0, 0xc8] },
    },
  }),
});
