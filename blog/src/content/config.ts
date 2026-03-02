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

const pluginSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  category: z.string().default('Other'),
  agentCount: z.number().optional(),
  tags: z.array(z.string()).default([]),
  lastUpdated: z.coerce.date(),
});

const digests = defineCollection({ type: 'content', schema: postSchema });
const learnings = defineCollection({ type: 'content', schema: postSchema });
const logs = defineCollection({ type: 'content', schema: logSchema });
const plugins = defineCollection({ type: 'content', schema: pluginSchema });

export const collections = { digests, learnings, logs, plugins };
export type PostFrontmatter = z.infer<typeof postSchema>;
export type LogFrontmatter = z.infer<typeof logSchema>;
export type PluginFrontmatter = z.infer<typeof pluginSchema>;
