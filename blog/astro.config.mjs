import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const GITHUB_USERNAME =
  process.env.GITHUB_REPOSITORY_OWNER ||
  process.env.GITHUB_USERNAME ||
  'jaykim';
const REPO_NAME = 'AI-LEARNING-NOTE';

export default defineConfig({
  site: `https://${GITHUB_USERNAME}.github.io`,
  base: `/${REPO_NAME}/`,
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
});
