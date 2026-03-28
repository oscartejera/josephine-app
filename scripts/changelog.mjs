#!/usr/bin/env node
/**
 * Auto-Changelog Generator — Josephine
 *
 * Generates a CHANGELOG from git commits using conventional commit format.
 * Groups by date and commit type (feat, fix, refactor, etc.)
 *
 * Usage:
 *   node scripts/changelog.mjs                  # last 7 days
 *   node scripts/changelog.mjs --days 30        # last 30 days
 *   node scripts/changelog.mjs --since 2026-03-01  # since specific date
 *   node scripts/changelog.mjs --append         # append to docs/CHANGELOG.md
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

const DAYS = parseInt(getArg('days') || '7', 10);
const SINCE = getArg('since') || null;
const APPEND = args.includes('--append');

// ─── Fetch commits ──────────────────────────────────────────────────────────

function getCommits() {
  const sinceArg = SINCE ? `--since="${SINCE}"` : `--since="${DAYS} days ago"`;
  try {
    const output = execSync(
      `git log ${sinceArg} --pretty=format:"%H|%ai|%s" --no-merges`,
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }
    );
    return output.trim().split('\n').filter(Boolean).map(line => {
      const [hash, dateRaw, ...msgParts] = line.split('|');
      const message = msgParts.join('|');
      const date = dateRaw.split(' ')[0]; // YYYY-MM-DD
      return { hash: hash.slice(0, 8), date, message };
    });
  } catch {
    return [];
  }
}

// ─── Parse conventional commit ──────────────────────────────────────────────

function parseCommit(message) {
  // Match: type(scope): description
  const match = message.match(/^(\w+)(?:\(([^)]+)\))?\s*:\s*(.+)$/);
  if (match) {
    return { type: match[1], scope: match[2] || '', description: match[3] };
  }
  return { type: 'other', scope: '', description: message };
}

const TYPE_LABELS = {
  feat: '✨ Features',
  fix: '🐛 Bug Fixes',
  refactor: '♻️ Refactoring',
  style: '💅 Styling',
  db: '🗃️ Database',
  docs: '📝 Documentation',
  chore: '🔧 Chores',
  perf: '⚡ Performance',
  test: '🧪 Tests',
  other: '📦 Other',
};

function getTypeLabel(type) {
  return TYPE_LABELS[type] || TYPE_LABELS.other;
}

// ─── Generate markdown ──────────────────────────────────────────────────────

function generateChangelog(commits) {
  if (commits.length === 0) {
    return '> No commits found in the specified period.\n';
  }

  // Group by date
  const byDate = {};
  for (const commit of commits) {
    if (!byDate[commit.date]) byDate[commit.date] = [];
    byDate[commit.date].push(commit);
  }

  let md = '';
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  for (const date of dates) {
    md += `## [${date}]\n\n`;

    // Group by type within each date
    const byType = {};
    for (const commit of byDate[date]) {
      const parsed = parseCommit(commit.message);
      const label = getTypeLabel(parsed.type);
      if (!byType[label]) byType[label] = [];
      byType[label].push({ ...commit, ...parsed });
    }

    for (const [typeLabel, items] of Object.entries(byType)) {
      md += `### ${typeLabel}\n`;
      for (const item of items) {
        const scope = item.scope ? `**${item.scope}**: ` : '';
        md += `- ${scope}${item.description} (\`${item.hash}\`)\n`;
      }
      md += '\n';
    }
  }

  return md;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const periodLabel = SINCE ? `since ${SINCE}` : `last ${DAYS} days`;
  console.log(`📋 Generating changelog (${periodLabel})...`);

  const commits = getCommits();
  console.log(`   Found ${commits.length} commits`);

  const header = `# Josephine Changelog\n\n> Auto-generated on ${new Date().toISOString().split('T')[0]}\n> Period: ${periodLabel}\n\n`;
  const body = generateChangelog(commits);

  if (APPEND) {
    const docsDir = join(ROOT, 'docs');
    if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });

    const changelogPath = join(docsDir, 'CHANGELOG.md');
    let existing = '';
    if (existsSync(changelogPath)) {
      existing = readFileSync(changelogPath, 'utf8');
      // Remove old header if present
      existing = existing.replace(/^# Josephine Changelog[\s\S]*?(?=## \[)/m, '');
    }
    writeFileSync(changelogPath, header + body + existing, 'utf8');
    console.log(`\n✅ Changelog appended to docs/CHANGELOG.md`);
  } else {
    console.log('\n' + header + body);
  }
}

main();
