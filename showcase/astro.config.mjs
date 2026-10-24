// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';

export default defineConfig({
  site: 'https://calhacks.gurtos.com',
  trailingSlash: 'always',
  // Straight quotes and plain hyphens, exactly as written.
  markdown: {
    processor: satteri({ features: { smartPunctuation: false } }),
    shikiConfig: { theme: 'github-light' },
  },
  integrations: [mdx()],
  redirects: { '/tracks/nessie': '/tracks/hyphenate/', '/tracks/godaddy': '/' },
});
