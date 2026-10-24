import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One page per sponsor track. The template renders the frontmatter in a fixed order (criteria, video,
// screenshots, live links); the MDX body holds evidence, how it works, how to try it, and limits.
const tracks = defineCollection({
  loader: glob({ base: './src/content/tracks', pattern: '*.mdx' }),
  schema: ({ image }) =>
    z.object({
      order: z.number(),
      sponsor: z.string(),
      prize: z.string(),
      title: z.string(),
      summary: z.string(),
      proof: z.string(),
      // Where the quoted criteria come from.
      criteriaSource: z.string(),
      criteria: z.array(
        z.object({
          ask: z.string(),
          how: z.string(),
          status: z.enum(['met', 'partly', 'open']).default('met'),
        }),
      ),
      // An evidence clip from src/data/clips.json shows until a narrated YouTube video is set in src/data/videos.ts.
      clip: z.string().optional(),
      // Which narrated video in src/data/videos.ts this page shows; defaults to the page's own slug.
      video: z.string().optional(),
      shots: z
        .array(z.object({ src: image(), alt: z.string(), caption: z.string().optional(), tall: z.boolean().optional() }))
        .default([]),
      links: z.array(z.object({ label: z.string(), href: z.string(), note: z.string().optional() })).default([]),
      flow: z
        .array(
          z.object({
            zone: z.enum(['you', 'outside', 'core', 'task']),
            label: z.string(),
            detail: z.string().optional(),
          }),
        )
        .default([]),
      status: z
        .array(z.object({ part: z.string(), state: z.enum(['live', 'test', 'test-data', 'simulated', 'not-built']), note: z.string() }))
        .default([]),
    }),
});

export const collections = { tracks };
