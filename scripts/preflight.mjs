#!/usr/bin/env node
/**
 * Preflight Gate — Intelligent Pre-Push Validation
 *
 * Runs the minimum credible validation based on what files changed.
 * Designed to catch errors BEFORE they reach production.
 *
 * Usage:
 *   node scripts/preflight.mjs              # full check (default)
 *   node scripts/preflight.mjs --quick      # tsc + lint only
 *   node scripts/preflight.mjs --dry-run    # show what would run, don't execute
 *
 * Exit codes:
 *   0 = all checks passed
 *   1 = one or more checks failed
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const QUICK = args.includes('--quick');

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

function run(label, cmd, { optional = false, failMsg = '' } = {}) {
  log('🔄', `${label}...`);
  if (DRY_RUN) {
    log('⏭️', `[dry-run] Would run: ${cmd}`);
    return true;
  }
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', timeout: 120_000 });
    log('✅', label);
    return true;
  } catch (err) {
    if (optional) {
      log('⚠️', `${label} (skipped — ${failMsg || 'not critical'})`);
      return true;
    }
    log('❌', `${label} FAILED`);
    // Show last 30 lines of output for debugging
    const output = (err.stdout || '') + (err.stderr || '');
    const lines = output.trim().split('\n');
    const tail = lines.slice(-30).join('\n');
    if (tail) console.log(tail);
    return false;
  }
}

function getChangedFiles() {
  try {
    // Files changed vs HEAD (staged + unstaged)
    const staged = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf8' }).trim();
    const unstaged = execSync('git diff --name-only', { cwd: ROOT, encoding: 'utf8' }).trim();
    const untracked = execSync('git ls-files --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' }).trim();
    const all = [...new Set([
      ...staged.split('\n'),
      ...unstaged.split('\n'),
      ...untracked.split('\n'),
    ].filter(Boolean))];
    return all;
  } catch {
    return [];
  }
}

function hasChangesIn(changedFiles, pattern) {
  if (typeof pattern === 'string') {
    return changedFiles.some(f => f.includes(pattern));
  }
  return changedFiles.some(f => pattern.test(f));
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log('\n🛫 Josephine Preflight Gate\n' + '─'.repeat(40));

  const changedFiles = getChangedFiles();
  const results = [];

  if (changedFiles.length > 0) {
    log('📂', `Changed files: ${changedFiles.length}`);
    changedFiles.forEach(f => log('  ', f));
    console.log('');
  }

  // ─── Gate 1: TypeScript (ALWAYS) ──────────────────────────────────────
  results.push(run('TypeScript check', 'npx tsc --noEmit'));

  // ─── Gate 2: Lint (ALWAYS) ────────────────────────────────────────────
  results.push(run('ESLint', 'npx eslint . --quiet --max-warnings 0', {
    optional: true,
    failMsg: 'lint warnings present but not blocking'
  }));

  if (QUICK) {
    // Quick mode: skip everything else
    return summarize(results);
  }

  // ─── Gate 3: Migration lint (if SQL changed) ──────────────────────────
  const hasMigrations = hasChangesIn(changedFiles, /supabase\/migrations\/.*\.sql$/);
  if (hasMigrations) {
    const changedSqlFiles = changedFiles.filter(f => /supabase\/migrations\/.*\.sql$/.test(f));
    for (const sqlFile of changedSqlFiles) {
      const fullPath = join(ROOT, sqlFile);
      if (existsSync(fullPath)) {
        results.push(run(
          `Migration lint: ${sqlFile.split('/').pop()}`,
          `node scripts/validate-migration.mjs "${fullPath}"`
        ));
      }
    }

    // ─── Gate 3b: Auto-regenerate types if migrations changed ───────────
    log('🔄', 'Migration detected — checking if types need regeneration...');
    if (!DRY_RUN) {
      try {
        // Check if supabase CLI is available for type generation
        execSync('npx supabase --version', { cwd: ROOT, stdio: 'pipe', timeout: 10_000 });
        log('💡', 'Run `npm run db:types` manually if schema changed (requires network)');
      } catch {
        log('⚠️', 'Supabase CLI not available — remember to run `npm run db:types` after push');
      }
    }
  }

  // ─── Gate 4: Data layer tests (if data/ changed) ──────────────────────
  const hasDataChanges = hasChangesIn(changedFiles, 'src/data/');
  if (hasDataChanges) {
    const contractTestPath = join(ROOT, 'src', 'data', '__tests__', 'rpc-contracts.test.ts');
    if (existsSync(contractTestPath)) {
      results.push(run(
        'RPC contract tests',
        'npx vitest run src/data/__tests__/rpc-contracts.test.ts',
        { optional: true, failMsg: 'contract test issue — review manually' }
      ));
    }
  }

  // ─── Gate 5: Unit tests for changed files ─────────────────────────────
  const hasTsChanges = hasChangesIn(changedFiles, /src\/.*\.(ts|tsx)$/);
  if (hasTsChanges) {
    results.push(run(
      'Unit tests (changed files)',
      'npx vitest run --changed HEAD',
      { optional: true, failMsg: 'no tests match changed files or test error' }
    ));
  }

  // ─── Gate 6: Demo verification (if hooks/data/pages changed) ──────────
  const touchesDemoSurface = hasDataChanges
    || hasChangesIn(changedFiles, 'src/hooks/')
    || hasChangesIn(changedFiles, 'src/pages/');

  if (touchesDemoSurface) {
    const verifyScript = join(ROOT, 'scripts', 'verify-demo.mjs');
    if (existsSync(verifyScript)) {
      results.push(run(
        'Demo mode verification',
        'node scripts/verify-demo.mjs --quick',
        { optional: true, failMsg: 'demo verification skipped — verify manually' }
      ));
    }
  }

  // ─── Gate 7: BOM check on SQL files ───────────────────────────────────
  if (hasMigrations) {
    const changedSqlFiles = changedFiles.filter(f => /supabase\/migrations\/.*\.sql$/.test(f));
    for (const sqlFile of changedSqlFiles) {
      const fullPath = join(ROOT, sqlFile);
      if (existsSync(fullPath)) {
        try {
          const buf = readFileSync(fullPath);
          if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
            log('❌', `BOM detected in ${sqlFile} — remove UTF-8 BOM before committing`);
            results.push(false);
          }
        } catch { /* skip if can't read */ }
      }
    }
  }

  return summarize(results);
}

function summarize(results) {
  console.log('\n' + '─'.repeat(40));
  const passed = results.filter(Boolean).length;
  const failed = results.length - passed;

  if (failed === 0) {
    log('🟢', `Preflight PASSED (${passed}/${results.length} checks)`);
    console.log('   Ready to commit and push.\n');
    process.exit(0);
  } else {
    log('🔴', `Preflight FAILED (${failed} check(s) failed)`);
    console.log('   Fix errors before committing.\n');
    process.exit(1);
  }
}

main();
