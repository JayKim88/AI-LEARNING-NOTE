import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

const ROOT_DIR = join(import.meta.dirname, '..', '..');
const CONTENT_DIR = join(import.meta.dirname, '..', 'src', 'content');
const CATEGORIES = ['digests', 'learnings'] as const;

interface MigrationResult {
  source: string;
  target: string;
  slug: string;
  title: string;
  date: string;
  category: string;
  tags: string[];
  lang: string;
  status: 'success' | 'skipped' | 'error';
  message?: string;
}

function parseFilename(filename: string): { date: string; slug: string; lang: string } | null {
  // Pattern: YYYY-MM-DD-slug.md or YYYY-MM-DD-slug-en.md
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  if (!match) return null;

  const date = match[1];
  let slug = match[2];
  let lang = 'ko';

  if (slug.endsWith('-en')) {
    slug = slug; // keep full slug for uniqueness
    lang = 'en';
  }

  return { date, slug, lang };
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

function extractSource(content: string): string | null {
  // Format 1: > **Source**: URL
  const plain = content.match(/>\s*\*\*Source\*\*:?\s*(https?:\/\/\S+)/);
  if (plain) return plain[1].trim();

  // Format 2: > **Source:** [text](URL)
  const linked = content.match(/>\s*\*\*Source:?\*\*:?\s*\[.+?\]\((https?:\/\/\S+?)\)/);
  if (linked) return linked[1].trim();

  return null;
}

function extractTags(content: string): string[] {
  // Format 1: > **Tags**: #tag1 #tag2 #tag3
  const blockquoteTags = content.match(/>\s*\*\*Tags\*\*:?\s*(.+)/);
  if (blockquoteTags) {
    return blockquoteTags[1]
      .split(/\s+/)
      .filter((t) => t.startsWith('#'))
      .map((t) => t.replace(/^#/, '').replace(/,$/,''));
  }

  // Format 2: **Tags:** #tag1 #tag2 (not in blockquote)
  const boldTags = content.match(/\*\*Tags:?\*\*:?\s*(.+)/);
  if (boldTags) {
    return boldTags[1]
      .split(/\s+/)
      .filter((t) => t.startsWith('#'))
      .map((t) => t.replace(/^#/, '').replace(/,$/,''));
  }

  return [];
}

function extractDescription(content: string): string | null {
  // Look for Summary section
  const summaryMatch = content.match(/##\s*(?:요약|Summary)\s*(?:\(.*?\))?\s*\n+(.+)/);
  if (summaryMatch) {
    const desc = summaryMatch[1].trim();
    // Truncate to ~150 chars at word boundary
    if (desc.length > 150) {
      return desc.substring(0, 150).replace(/\s+\S*$/, '') + '...';
    }
    return desc;
  }

  // Fallback: first paragraph after title/metadata block
  const lines = content.split('\n');
  let pastHeader = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith('>') || trimmed.startsWith('**') || trimmed === '---' || trimmed === '') {
      if (trimmed.startsWith('##')) pastHeader = true;
      continue;
    }
    if (pastHeader && trimmed.length > 20) {
      if (trimmed.length > 150) {
        return trimmed.substring(0, 150).replace(/\s+\S*$/, '') + '...';
      }
      return trimmed;
    }
  }

  return null;
}

function stripMetadataBlock(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inMetaBlock = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inMetaBlock) {
      // Skip title (first # heading)
      if (trimmed.startsWith('# ') && i < 5) continue;
      // Skip blockquote metadata (> **Source**, > **Date**, > **Tags**)
      if (trimmed.startsWith('>') && /\*\*(Source|Date|Tags|목적|Purpose|Category)\*?\*?/i.test(trimmed)) continue;
      // Skip bold metadata lines
      if (/^\*\*(Date|Category|Tags|Purpose):?\*\*/.test(trimmed)) continue;
      // Skip empty lines in meta block
      if (trimmed === '') continue;
      // Skip --- separators at the top
      if (trimmed === '---' && i < 10) continue;

      // First non-metadata line ends the meta block
      inMetaBlock = false;
    }

    result.push(line);
  }

  return result.join('\n').replace(/^\n+/, '');
}

function buildFrontmatter(data: {
  title: string;
  date: string;
  description: string | null;
  category: string;
  tags: string[];
  source: string | null;
  lang: string;
}): string {
  const lines = ['---'];
  lines.push(`title: "${data.title.replace(/"/g, '\\"')}"`);
  lines.push(`date: ${data.date}`);
  if (data.description) {
    lines.push(`description: "${data.description.replace(/"/g, '\\"')}"`);
  }
  lines.push(`category: ${data.category}`);
  if (data.tags.length > 0) {
    lines.push(`tags: [${data.tags.map((t) => `"${t}"`).join(', ')}]`);
  }
  if (data.source) {
    lines.push(`source: "${data.source}"`);
  }
  lines.push(`lang: ${data.lang}`);
  lines.push(`draft: false`);
  lines.push('---');
  return lines.join('\n');
}

function migrateFile(category: string, filename: string): MigrationResult {
  const sourcePath = join(ROOT_DIR, category, filename);
  const parsed = parseFilename(filename);

  if (!parsed) {
    return {
      source: sourcePath,
      target: '',
      slug: '',
      title: '',
      date: '',
      category,
      tags: [],
      lang: 'ko',
      status: 'error',
      message: `Could not parse filename: ${filename}`,
    };
  }

  const content = readFileSync(sourcePath, 'utf-8');
  const title = extractTitle(content);
  const source = extractSource(content);
  const tags = extractTags(content);
  const description = extractDescription(content);
  const strippedContent = stripMetadataBlock(content);

  const frontmatter = buildFrontmatter({
    title,
    date: parsed.date,
    description,
    category,
    tags,
    source,
    lang: parsed.lang,
  });

  const targetDir = join(CONTENT_DIR, category);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = join(targetDir, filename);
  const output = `${frontmatter}\n\n${strippedContent}`;
  writeFileSync(targetPath, output, 'utf-8');

  return {
    source: sourcePath,
    target: targetPath,
    slug: parsed.slug,
    title,
    date: parsed.date,
    category,
    tags,
    lang: parsed.lang,
    status: 'success',
  };
}

// Main
console.log('Starting content migration...\n');

const results: MigrationResult[] = [];

for (const category of CATEGORIES) {
  const sourceDir = join(ROOT_DIR, category);
  if (!existsSync(sourceDir)) {
    console.warn(`Warning: Source directory not found: ${sourceDir}`);
    continue;
  }

  const files = readdirSync(sourceDir).filter((f) => f.endsWith('.md'));
  console.log(`Found ${files.length} files in ${category}/`);

  for (const file of files) {
    const result = migrateFile(category, file);
    results.push(result);

    const icon = result.status === 'success' ? '+' : result.status === 'skipped' ? '-' : 'x';
    console.log(`  [${icon}] ${file} -> ${result.slug || 'FAILED'}`);
    if (result.message) console.log(`      ${result.message}`);
  }
}

// Summary
console.log('\n--- Migration Summary ---');
const success = results.filter((r) => r.status === 'success');
const errors = results.filter((r) => r.status === 'error');
console.log(`Total: ${results.length} | Success: ${success.length} | Errors: ${errors.length}`);

if (errors.length > 0) {
  console.log('\nErrors:');
  for (const err of errors) {
    console.log(`  - ${err.source}: ${err.message}`);
  }
}

// Write migration report
const reportPath = join(CONTENT_DIR, '..', '..', 'migration-report.json');
writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
console.log(`\nReport saved to: ${reportPath}`);
