#!/usr/bin/env node
/**
 * Session Briefing — Warm Start for Agent Sessions
 *
 * Generates a condensed snapshot of the current project state so the agent
 * starts every session with full context instead of exploring from scratch.
 *
 * Usage:
 *   node scripts/session-brief.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

function runSafe(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 30000 }).trim();
  } catch { return ''; }
}

function countFiles(dir, pattern) {
  let count = 0;
  function walk(d) {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry)) {
          walk(full);
        } else if (pattern.test(entry)) {
          count++;
        }
      } catch {}
    }
  }
  walk(dir);
  return count;
}

function main() {
  const now = new Date().toISOString().split('T')[0];

  console.log(`\n📊 Josephine Session Briefing — ${now}`);
  console.log('═'.repeat(55));

  // Health quick
  const tscResult = runSafe('npx tsc --noEmit 2>&1');
  const tsErrors = tscResult ? (tscResult.match(/error TS/g) || []).length : 0;
  console.log(`\n🏥 Health: ${tsErrors === 0 ? '✅ 0 TS errors' : `❌ ${tsErrors} TS errors`}`);

  // File counts
  const pages = countFiles(join(SRC, 'pages'), /\.tsx$/);
  const hooks = countFiles(join(SRC, 'hooks'), /\.ts$/);
  const components = countFiles(join(SRC, 'components'), /\.tsx$/);
  const totalTS = countFiles(SRC, /\.(ts|tsx)$/);
  console.log(`📁 Codebase: ${totalTS} files | ${pages} pages | ${hooks} hooks | ${components} components`);

  // Migrations
  const migDir = join(ROOT, 'supabase', 'migrations');
  const migrations = existsSync(migDir) ? readdirSync(migDir).filter(f => f.endsWith('.sql')).length : 0;
  console.log(`🗃️  Migrations: ${migrations}`);

  // Last 5 commits
  const commits = runSafe('git log --oneline -5 --no-decorate');
  if (commits) {
    console.log('\n📋 Last 5 commits:');
    commits.split('\n').forEach(c => console.log(`   ${c}`));
  }

  // Pending changes
  const status = runSafe('git status --short');
  if (status) {
    const changed = status.split('\n').filter(Boolean).length;
    console.log(`\n⚠️  Uncommitted changes: ${changed} files`);
  } else {
    console.log('\n✅ Working tree clean');
  }

  // Task.md if exists
  const taskFiles = [
    join(ROOT, 'task.md'),
    join(ROOT, '.agent', 'task.md'),
  ];
  for (const tf of taskFiles) {
    if (existsSync(tf)) {
      const content = readFileSync(tf, 'utf8');
      const pending = (content.match(/- \[ \]/g) || []).length;
      const inProgress = (content.match(/- \[\/\]/g) || []).length;
      if (pending > 0 || inProgress > 0) {
        console.log(`\n📌 Pending tasks: ${inProgress} in progress, ${pending} todo`);
      }
      break;
    }
  }

  // Branches
  const branch = runSafe('git branch --show-current');
  console.log(`\n🌿 Branch: ${branch || 'unknown'}`);

  console.log('\n' + '═'.repeat(55));
  console.log('💡 Commands: preflight | impact-map:summary | health | scaffold');
  console.log('');
}

main();
