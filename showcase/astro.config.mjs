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
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false },
  },
  integrations: [mdx()],
  redirects: { '/tracks/nessie': '/tracks/hyphenate/', '/tracks/godaddy': '/', '/terms': 'https://gurtos.com/terms/', '/privacy': 'https://gurtos.com/privacy/' },
});
