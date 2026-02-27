import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'digests'> | CollectionEntry<'learnings'>;
export type LogEntry = CollectionEntry<'logs'>;

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

export function getReadingTime(body: string): number {
  const text = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/[#*_[\]()!]/g, '')
    .trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

export function getRelatedPosts(currentPost: Post, allPosts: Post[], limit = 3): Post[] {
  const currentTags = new Set(currentPost.data.tags);
  return allPosts
    .filter((p) => p.slug !== currentPost.slug)
    .map((p) => ({
      post: p,
      score: p.data.tags.filter((t) => currentTags.has(t)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.post.data.date.getTime() - a.post.data.date.getTime())
    .slice(0, limit)
    .map(({ post }) => post);
}

export async function getAllLogs(): Promise<LogEntry[]> {
  const logs = await getCollection('logs');
  return logs.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

// Returns a map of "YYYY-MM-DD" -> LogEntry[]
export async function getLogsByDateMap(): Promise<Map<string, LogEntry[]>> {
  const logs = await getAllLogs();
  const dateMap = new Map<string, LogEntry[]>();
  for (const log of logs) {
    const key = log.data.date.toISOString().slice(0, 10);
    const existing = dateMap.get(key) ?? [];
    dateMap.set(key, [...existing, log]);
  }
  return dateMap;
}

export interface ActivityEntry {
  title: string;
  url: string;
  collection: 'logs' | 'digests' | 'learnings';
}

// Returns a map of "YYYY-MM-DD" -> ActivityEntry[] across all collections
export async function getAllByDateMap(): Promise<Map<string, ActivityEntry[]>> {
  const base = import.meta.env.BASE_URL;
  const [logs, digests, learnings] = await Promise.all([
    getCollection('logs'),
    getCollection('digests'),
    getCollection('learnings'),
  ]);

  const map = new Map<string, ActivityEntry[]>();

  const addToMap = (
    entries: CollectionEntry<'logs' | 'digests' | 'learnings'>[],
    prefix: string,
    collection: 'logs' | 'digests' | 'learnings',
  ) => {
    for (const e of entries) {
      if ((e.data as { draft?: boolean }).draft) continue;
      const key = e.data.date.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ title: e.data.title, url: `${base}${prefix}/${e.slug}/`, collection });
    }
  };

  addToMap(logs, 'logs', 'logs');
  addToMap(digests, 'digests', 'digests');
  addToMap(learnings, 'learnings', 'learnings');

  return map;
}
