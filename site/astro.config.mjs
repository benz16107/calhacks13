// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { satteri } from '@astrojs/markdown-satteri';
import starlightLlmsTxt from 'starlight-llms-txt';
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi';
import { NAME, DESCRIPTION, REPO } from './src/product.ts';
import { productName } from './src/product-name.ts';

// The canonical address, used for canonical links, OpenGraph images, the sitemap and llms.txt.
// The site also works at its Vercel address; only these absolute links point here.
const site = process.env.SITE_URL ?? 'https://gurtos.com';

export default defineConfig({
  site,
  trailingSlash: 'always',
  markdown: {
    // Straight quotes and plain hyphens, exactly as written.
    processor: satteri({ features: { smartPunctuation: false }, hastPlugins: [productName] }),
  },
  integrations: [
    starlight({
      title: `${NAME} docs`,
      description: DESCRIPTION,
      logo: { src: './src/assets/logo.svg', replacesTitle: false, alt: '' },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'Source code on GitHub', href: REPO }],
      components: { Footer: './src/components/Footer.astro' },
      customCss: [
        '@fontsource/instrument-sans/400.css',
        '@fontsource/instrument-sans/500.css',
        '@fontsource/instrument-sans/600.css',
        '@fontsource/ibm-plex-mono/400.css',
        '@fontsource/ibm-plex-mono/500.css',
        './src/styles/theme.css',
      ],
      routeMiddleware: './src/routeData.ts',
      lastUpdated: false,
      pagination: true,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      expressiveCode: {
        themes: ['github-light', 'github-dark'],
        styleOverrides: { borderRadius: '6px', codeFontFamily: "'IBM Plex Mono', ui-monospace, monospace" },
        // Shell commands in a plain code frame (with its copy button), not a terminal-window mockup.
        defaultProps: { overridesByLang: { 'sh,bash,shell,zsh,console': { frame: 'code' } } },
      },
      head: [
        { tag: 'meta', attrs: { name: 'theme-color', content: '#27313F' } },
      ],
      plugins: [
        starlightOpenAPI([
          {
            base: 'reference/api',
            schema: './openapi/box-api.yaml',
            sidebar: { label: 'HTTP API operations', collapsed: true },
          },
        ]),
        starlightLlmsTxt({
          projectName: NAME,
          description: DESCRIPTION,
          details: [
            '- Planned features are labelled "Planned" and preview features "Preview" on their pages.',
            '- Example host names and addresses (box.local, 192.0.2.x) are placeholders.',
          ].join('\n'),
          exclude: ['404'],
        }),
      ],
      sidebar: [
        { label: 'Download', link: '/download/' },
        {
          label: 'Introduction',
          items: ['introduction/overview', 'introduction/editions', 'introduction/use-cases'],
        },
        {
          label: 'Get started',
          items: [
            'get-started/install-server',
            'get-started/install-on-ubuntu',
            'get-started/first-boot',
            'get-started/install-personal',
            'get-started/first-task',
          ],
        },
        {
          label: 'Concepts',
          items: [
            'concepts/architecture',
            'concepts/tasks',
            'concepts/agent-users',
            'concepts/workspaces-and-layers',
            'concepts/vault-and-broker',
            'concepts/network-policy',
            'concepts/approvals-and-budgets',
            'concepts/action-log',
            'concepts/cost',
            'concepts/resume-after-power-loss',
            'concepts/apps-and-slots',
            'concepts/triggers',
            'concepts/system-updates',
          ],
        },
        {
          label: 'How-to guides',
          items: [
            'guides/approve-from-your-phone',
            'guides/undo-a-task',
            'guides/keep-or-undo',
            'guides/schedule-a-routine',
            'guides/add-a-secret',
            'guides/update-and-roll-back',
            'guides/connect-jira',
            'guides/send-the-log-to-elastic',
            'guides/agent-payments',
            'guides/shopping-agent',
            'guides/asi-one',
            'guides/find',
            'guides/add-a-second-box',
          ],
        },
        {
          label: 'Reference',
          items: [
            'reference/http-api',
            ...openAPISidebarGroups,
            'reference/live-updates',
            'reference/broker',
            'reference/app-sdk',
            'reference/log-events',
            'reference/apps',
            'reference/files-and-paths',
            'reference/disk-layout',
            'reference/environment',
            'reference/vault-keys',
            'reference/test-suite',
          ],
        },
        {
          label: 'Security',
          items: ['security/model', 'security/threat-model', 'security/trust-boundaries', 'security/reporting'],
        },
        {
          label: 'Project',
          items: [
            'project/changelog',
            'project/roadmap',
            'project/contributing',
            'project/licence',
            { label: 'Source code', link: REPO, attrs: { rel: 'noopener' } },
          ],
        },
      ],
    }),
  ],
});
