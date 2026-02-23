import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getAllPosts } from '@utils/posts';

export async function GET(context: APIContext) {
  const posts = await getAllPosts();

  return rss({
    title: 'AI Learning Blog',
    description: 'AI 학습과 실험 기록',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description || '',
      pubDate: post.data.date,
      link: `/${post.collection}/${post.slug}/`,
      categories: post.data.tags,
    })),
  });
}
