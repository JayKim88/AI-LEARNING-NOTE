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

const logSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const digests = defineCollection({ type: 'content', schema: postSchema });
const learnings = defineCollection({ type: 'content', schema: postSchema });
const logs = defineCollection({ type: 'content', schema: logSchema });

export const collections = { digests, learnings, logs };
export type PostFrontmatter = z.infer<typeof postSchema>;
export type LogFrontmatter = z.infer<typeof logSchema>;
