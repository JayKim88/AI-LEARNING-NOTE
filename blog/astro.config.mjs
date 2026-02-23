import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const GITHUB_USERNAME =
  process.env.GITHUB_REPOSITORY_OWNER ||
  process.env.GITHUB_USERNAME ||
  'jaykim';
const REPO_NAME = 'ai-learning';

export default defineConfig({
  site: `https://${GITHUB_USERNAME}.github.io`,
  base: `/${REPO_NAME}/`,
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
