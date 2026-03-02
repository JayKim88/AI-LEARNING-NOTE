import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';

const PLUGINS_DIR = join(import.meta.dirname, '..', '..', '..', 'claude-ai-engineering', 'plugins');
const OUTPUT_DIR = join(import.meta.dirname, '..', 'src', 'content', 'plugins');

const PLUGIN_CATEGORIES: Record<string, string> = {
  'planning-interview': 'Interview & Planning',
  'spec-interview': 'Interview & Planning',
  'spec-validator': 'Interview & Planning',
  'future-architect': 'Interview & Planning',
  'launch-kit': 'Interview & Planning',
  'career-compass': 'Career & Market',
  'jd-analyzer': 'Career & Market',
  'market-pulse': 'Career & Market',
  'market-research-by-desire': 'Career & Market',
  'rich-guide': 'Career & Market',
  'portfolio-copilot': 'Portfolio & Finance',
  'portfolio-analyzer-fused': 'Portfolio & Finance',
  'factor-lab': 'Portfolio & Finance',
  'ai-digest': 'Content & Learning',
  'ai-news-digest': 'Content & Learning',
  'blog-generator': 'Content & Learning',
  'learning-summary': 'Content & Learning',
  'prism-debate': 'Analysis & Meta',
  'competitive-agents': 'Analysis & Meta',
  'project-insight': 'Analysis & Meta',
  'business-avengers': 'Analysis & Meta',
  'wrap-up': 'Analysis & Meta',
};

const KEYWORD_TAGS: { pattern: RegExp; tag: string }[] = [
  { pattern: /agent/i, tag: 'multi-agent' },
  { pattern: /career/i, tag: 'career' },
  { pattern: /market/i, tag: 'market' },
  { pattern: /portfolio/i, tag: 'portfolio' },
  { pattern: /interview/i, tag: 'interview' },
  { pattern: /debate|prism/i, tag: 'analysis' },
  { pattern: /blog|content/i, tag: 'content' },
  { pattern: /digest|news/i, tag: 'digest' },
  { pattern: /spec|validator/i, tag: 'spec' },
  { pattern: /learning|summary/i, tag: 'learning' },
  { pattern: /mermaid|flowchart|graph/i, tag: 'mermaid' },
  { pattern: /python|script/i, tag: 'python' },
  { pattern: /ai|llm|claude/i, tag: 'ai' },
];

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

function extractDescription(content: string): string | null {
  const lines = content.split('\n');
  let pastTitle = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) { pastTitle = true; continue; }
    if (!pastTitle || trimmed === '' || trimmed === '---') continue;

    const boldMatch = trimmed.match(/^\*\*(.+?)\*\*\.?$/);
    if (boldMatch) {
      const text = boldMatch[1].trim();
      return text.length > 160 ? text.slice(0, 160).replace(/\s\S*$/, '') + '...' : text;
    }

    if (
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('-') &&
      !trimmed.startsWith('*') &&
      !trimmed.startsWith('`') &&
      !trimmed.startsWith('>') &&
      !trimmed.startsWith('|') &&
      trimmed.length > 10
    ) {
      return trimmed.length > 160 ? trimmed.slice(0, 160).replace(/\s\S*$/, '') + '...' : trimmed;
    }
  }
  return null;
}

function extractAgentCount(content: string): number | null {
  const patterns = [
    /(\d+)-agent/i,
    /(\d+)\s+agents/i,
    /(\d+)\s+ai\s+agents/i,
    /(\d+)\s+specialized\s+agents/i,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n >= 2 && n <= 20) return n; // sanity check
    }
  }
  return null;
}

function extractTags(pluginName: string, content: string): string[] {
  const tags = new Set<string>();
  pluginName.split('-').filter((s) => s.length > 2).forEach((s) => tags.add(s));
  for (const { pattern, tag } of KEYWORD_TAGS) {
    if (pattern.test(content)) tags.add(tag);
  }
  return [...tags].slice(0, 6);
}

function stripTitle(content: string): string {
  return content.replace(/^#\s+.+\n?/, '').replace(/^\n+/, '');
}

function buildFrontmatter(data: {
  title: string;
  description: string | null;
  tags: string[];
  lastUpdated: string;
  agentCount: number | null;
  category: string;
}): string {
  const lines = ['---'];
  lines.push(`title: "${data.title.replace(/"/g, '\\"')}"`);
  if (data.description) {
    lines.push(`description: "${data.description.replace(/"/g, '\\"')}"`);
  }
  lines.push(`category: "${data.category}"`);
  if (data.agentCount !== null) {
    lines.push(`agentCount: ${data.agentCount}`);
  }
  if (data.tags.length > 0) {
    lines.push(`tags: [${data.tags.map((t) => `"${t}"`).join(', ')}]`);
  }
  lines.push(`lastUpdated: ${data.lastUpdated}`);
  lines.push('---');
  return lines.join('\n');
}

// Main
if (!existsSync(PLUGINS_DIR)) {
  console.error(`Plugins directory not found: ${PLUGINS_DIR}`);
  process.exit(1);
}

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const pluginDirs = readdirSync(PLUGINS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

console.log(`Syncing ${pluginDirs.length} plugins from ${PLUGINS_DIR}\n`);

let success = 0;
let skipped = 0;

for (const pluginName of pluginDirs) {
  const readmePath = join(PLUGINS_DIR, pluginName, 'README.md');

  if (!existsSync(readmePath)) {
    console.log(`  [-] ${pluginName} — no README.md, skipping`);
    skipped++;
    continue;
  }

  const content = readFileSync(readmePath, 'utf-8');
  const mtime = statSync(readmePath).mtime;
  const lastUpdated = mtime.toISOString().slice(0, 10);

  const title = extractTitle(content);
  const description = extractDescription(content);
  const agentCount = extractAgentCount(content);
  const tags = extractTags(pluginName, content);
  const category = PLUGIN_CATEGORIES[pluginName] ?? 'Other';
  const body = stripTitle(content);

  const frontmatter = buildFrontmatter({ title, description, tags, lastUpdated, agentCount, category });
  const output = `${frontmatter}\n\n${body}`;

  const outputPath = join(OUTPUT_DIR, `${pluginName}.md`);
  writeFileSync(outputPath, output, 'utf-8');

  const agentLabel = agentCount ? ` [${agentCount} agents]` : '';
  console.log(`  [+] ${pluginName} → "${title}"${agentLabel} (${category})`);
  success++;
}

console.log(`\nDone: ${success} synced, ${skipped} skipped`);
console.log(`Output: ${OUTPUT_DIR}`);
