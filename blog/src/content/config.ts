import { defineCollection, z } from 'astro:content';

const postSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  description: z.string().optional(),
  category: z.enum(['digests', 'learnings']),
  tags: z.array(z.string()).default([]),
  source: z.string().url().optional(),
  lang: z.enum(['ko', 'en']).default('ko'),
  draft: z.boolean().default(false),
});

const digests = defineCollection({ type: 'content', schema: postSchema });
const learnings = defineCollection({ type: 'content', schema: postSchema });

export const collections = { digests, learnings };
export type PostFrontmatter = z.infer<typeof postSchema>;
