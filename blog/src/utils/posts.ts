import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'digests'> | CollectionEntry<'learnings'>;

export async function getAllPosts(): Promise<Post[]> {
  const [digests, learnings] = await Promise.all([
    getCollection('digests'),
    getCollection('learnings'),
  ]);
  return [...digests, ...learnings]
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getPostsByCategory(
  category: 'digests' | 'learnings',
): Promise<Post[]> {
  const posts = await getCollection(category);
  return posts
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function getAllTags(posts: Post[]): Map<string, number> {
  const tagMap = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    }
  }
  return new Map([...tagMap.entries()].sort((a, b) => b[1] - a[1]));
}

export function getPostsByTag(posts: Post[], tag: string): Post[] {
  return posts.filter((post) => post.data.tags.includes(tag));
}

export function getAdjacentPosts(
  posts: Post[],
  currentSlug: string,
): { prev: Post | null; next: Post | null } {
  const index = posts.findIndex((p) => p.slug === currentSlug);
  return {
    prev: index < posts.length - 1 ? posts[index + 1] : null,
    next: index > 0 ? posts[index - 1] : null,
  };
}
