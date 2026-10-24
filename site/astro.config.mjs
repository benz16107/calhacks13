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
        '@fontsource/atkinson-hyperlegible-next/latin-400.css',
        '@fontsource/atkinson-hyperlegible-next/latin-600.css',
        '@fontsource/atkinson-hyperlegible-next/latin-700.css',
        '@fontsource/atkinson-hyperlegible-mono/latin-400.css',
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
            base: 'docs/reference/api',
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
        { label: 'GurtOS home', link: '/' },
        { label: 'Download', link: '/download/' },
        {
          label: 'Introduction',
          items: ['docs/introduction/overview', 'docs/introduction/editions', 'docs/introduction/use-cases'],
        },
        {
          label: 'Get started',
          items: [
            'docs/get-started/install-server',
            'docs/get-started/install-on-ubuntu',
            'docs/get-started/first-boot',
            'docs/get-started/install-personal',
            'docs/get-started/first-task',
          ],
        },
        {
          label: 'Concepts',
          items: [
            'docs/concepts/architecture',
            'docs/concepts/tasks',
            'docs/concepts/agent-users',
            'docs/concepts/workspaces-and-layers',
            'docs/concepts/vault-and-broker',
            'docs/concepts/network-policy',
            'docs/concepts/approvals-and-budgets',
            'docs/concepts/action-log',
            'docs/concepts/cost',
            'docs/concepts/resume-after-power-loss',
            'docs/concepts/apps-and-slots',
            'docs/concepts/triggers',
            'docs/concepts/system-updates',
          ],
        },
        {
          label: 'How-to guides',
          items: [
            'docs/guides/approve-from-your-phone',
            'docs/guides/undo-a-task',
            'docs/guides/keep-or-undo',
            'docs/guides/schedule-a-routine',
            'docs/guides/add-a-secret',
            'docs/guides/update-and-roll-back',
            'docs/guides/connect-jira',
            'docs/guides/send-the-log-to-elastic',
            'docs/guides/agent-payments',
            'docs/guides/shopping-agent',
            'docs/guides/asi-one',
            'docs/guides/find',
            'docs/guides/reach-your-box-from-anywhere',
            'docs/guides/turn-on-business',
            'docs/guides/add-a-second-box',
          ],
        },
        {
          label: 'Reference',
          items: [
            'docs/reference/http-api',
            ...openAPISidebarGroups,
            'docs/reference/live-updates',
            'docs/reference/broker',
            'docs/reference/app-sdk',
            'docs/reference/log-events',
            'docs/reference/apps',
            'docs/reference/files-and-paths',
            'docs/reference/disk-layout',
            'docs/reference/environment',
            'docs/reference/vault-keys',
            'docs/reference/test-suite',
          ],
        },
        {
          label: 'Security',
          items: ['docs/security/model', 'docs/security/threat-model', 'docs/security/trust-boundaries', 'docs/security/reporting'],
        },
        {
          label: 'Project',
          items: [
            'docs/project/changelog',
            'docs/project/roadmap',
            'docs/project/contributing',
            'docs/project/licence',
            { label: 'Terms of use', link: '/terms/' },
            { label: 'Privacy policy', link: '/privacy/' },
            { label: 'Source code', link: REPO, attrs: { rel: 'noopener' } },
          ],
        },
      ],
    }),
  ],
});
