#!/usr/bin/env node
/**
 * Health Check — Codebase Quality Audit
 *
 * Runs a comprehensive health check on the Josephine codebase and reports:
 * - TypeScript errors
 * - Lint warnings
 * - Test status
 * - Dead code indicators
 * - Large file warnings
 * - TODO/FIXME counts
 * - Migration health
 * - RPC contract status
 *
 * Usage:
 *   node scripts/health-check.mjs           # full report
 *   node scripts/health-check.mjs --json    # JSON output
 */

import { execSync } from 'child_process';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const JSON_MODE = process.argv.includes('--json');

const results = {};

// ─── Helpers ────────────────────────────────────────────────────────────────

function runSafe(cmd, timeout = 60000) {
  try {
    return { ok: true, output: execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout }) };
  } catch (err) {
    return { ok: false, output: (err.stdout || '') + (err.stderr || '') };
  }
}

function walkFiles(dir, pattern, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (['node_modules', '.git', 'dist', '.next'].includes(entry)) continue;
        walkFiles(full, pattern, files);
      } else if (pattern.test(entry)) {
        files.push({ path: full, size: stat.size });
      }
    } catch { /* skip inaccessible */ }
  }
  return files;
}

function countPattern(dir, pattern, filePattern = /\.(ts|tsx)$/) {
  const files = walkFiles(dir, filePattern);
  let count = 0;
  const matches = [];
  for (const f of files) {
    try {
      const content = readFileSync(f.path, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (pattern.test(line)) {
          count++;
          if (matches.length < 10) {
            matches.push(`${relative(ROOT, f.path)}:${i + 1}`);
          }
        }
      });
    } catch { /* skip */ }
  }
  return { count, samples: matches };
}

// ─── Checks ─────────────────────────────────────────────────────────────────

function checkTypeScript() {
  const result = runSafe('npx tsc --noEmit 2>&1', 90000);
  const errorCount = result.ok ? 0 : (result.output.match(/error TS/g) || []).length;
  return {
    status: result.ok ? 'pass' : 'fail',
    errors: errorCount,
    message: result.ok ? '0 errors' : `${errorCount} errors`,
  };
}

function checkLint() {
  const result = runSafe('npx eslint . --quiet --format json 2>&1', 60000);
  if (result.ok) {
    return { status: 'pass', warnings: 0, message: '0 warnings' };
  }
  try {
    const parsed = JSON.parse(result.output);
    const totalWarnings = parsed.reduce((sum, f) => sum + f.warningCount, 0);
    const totalErrors = parsed.reduce((sum, f) => sum + f.errorCount, 0);
    return {
      status: totalErrors > 0 ? 'fail' : 'warn',
      warnings: totalWarnings,
      errors: totalErrors,
      message: `${totalErrors} errors, ${totalWarnings} warnings`,
    };
  } catch {
    return { status: 'warn', message: 'lint output could not be parsed' };
  }
}

function checkTests() {
  const result = runSafe('npx vitest run --reporter=json 2>&1', 90000);
  if (result.ok) {
    try {
      // vitest outputs JSON to stdout
      const jsonMatch = result.output.match(/\{[\s\S]*"testResults"/);
      if (jsonMatch) {
        return { status: 'pass', message: 'all tests passing' };
      }
    } catch { /* fall through */ }
    return { status: 'pass', message: 'tests passing' };
  }
  return { status: 'warn', message: 'some tests failing or no tests found' };
}

function checkMigrations() {
  const migDir = join(ROOT, 'supabase', 'migrations');
  if (!existsSync(migDir)) return { status: 'skip', message: 'no migrations directory' };

  const sqlFiles = readdirSync(migDir).filter(f => f.endsWith('.sql'));
  const result = runSafe('node scripts/validate-migration.mjs 2>&1', 30000);
  const hasErrors = result.output.includes('FAILED');

  return {
    status: hasErrors ? 'fail' : 'pass',
    count: sqlFiles.length,
    message: `${sqlFiles.length} migrations, ${hasErrors ? 'lint FAILED' : 'lint clean'}`,
  };
}

function checkLargeFiles() {
  const tsFiles = walkFiles(SRC, /\.(ts|tsx)$/);
  const large = tsFiles
    .filter(f => {
      try {
        const lines = readFileSync(f.path, 'utf8').split('\n').length;
        return lines > 400;
      } catch { return false; }
    })
    .map(f => ({
      file: relative(ROOT, f.path),
      lines: readFileSync(f.path, 'utf8').split('\n').length,
      sizeKB: Math.round(f.size / 1024),
    }))
    .sort((a, b) => b.lines - a.lines);

  return {
    status: large.length > 5 ? 'warn' : 'pass',
    count: large.length,
    files: large.slice(0, 10),
    message: `${large.length} files over 400 lines`,
  };
}

function checkTodos() {
  const todos = countPattern(SRC, /\/\/\s*(TODO|FIXME|HACK|XXX)\b/i);
  return {
    status: todos.count > 30 ? 'warn' : 'pass',
    count: todos.count,
    samples: todos.samples,
    message: `${todos.count} TODO/FIXME/HACK comments`,
  };
}

function checkAnyTypes() {
  const anys = countPattern(SRC, /:\s*any\b/);
  return {
    status: anys.count > 20 ? 'warn' : 'pass',
    count: anys.count,
    samples: anys.samples,
    message: `${anys.count} uses of \`: any\``,
  };
}

function checkCodebaseStats() {
  const tsFiles = walkFiles(SRC, /\.(ts|tsx)$/);
  const pages = tsFiles.filter(f => f.path.includes(`${join('src', 'pages')}`));
  const hooks = tsFiles.filter(f => f.path.includes(`${join('src', 'hooks')}`));
  const components = tsFiles.filter(f => f.path.includes(`${join('src', 'components')}`));
  const tests = tsFiles.filter(f => f.path.includes('.test.'));
  const totalLines = tsFiles.reduce((sum, f) => {
    try { return sum + readFileSync(f.path, 'utf8').split('\n').length; } catch { return sum; }
  }, 0);

  return {
    status: 'info',
    files: tsFiles.length,
    pages: pages.length,
    hooks: hooks.length,
    components: components.length,
    tests: tests.length,
    totalLines,
    message: `${tsFiles.length} files, ${Math.round(totalLines / 1000)}K lines`,
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log('\n🏥 Josephine Health Check');
  console.log('═'.repeat(50));

  const checks = [
    { name: 'Codebase Stats', fn: checkCodebaseStats },
    { name: 'TypeScript', fn: checkTypeScript },
    { name: 'ESLint', fn: checkLint },
    { name: 'Tests', fn: checkTests },
    { name: 'Migrations', fn: checkMigrations },
    { name: 'Large Files (>400 lines)', fn: checkLargeFiles },
    { name: 'TODO/FIXME Count', fn: checkTodos },
    { name: 'Any Types', fn: checkAnyTypes },
  ];

  for (const check of checks) {
    process.stdout.write(`  Checking ${check.name}... `);
    const result = check.fn();
    results[check.name] = result;

    const icon = {
      pass: '✅',
      fail: '❌',
      warn: '⚠️',
      skip: '⏭️',
      info: '📊',
    }[result.status] || '❓';

    console.log(`${icon} ${result.message}`);

    // Show details for notable findings
    if (result.files && result.files.length > 0 && !JSON_MODE) {
      result.files.slice(0, 5).forEach(f => {
        console.log(`     📄 ${f.file} (${f.lines} lines)`);
      });
    }
    if (result.samples && result.samples.length > 0 && !JSON_MODE) {
      result.samples.slice(0, 5).forEach(s => {
        console.log(`     📌 ${s}`);
      });
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  const fails = Object.values(results).filter(r => r.status === 'fail').length;
  const warns = Object.values(results).filter(r => r.status === 'warn').length;
  const passes = Object.values(results).filter(r => r.status === 'pass').length;

  if (fails > 0) {
    console.log(`🔴 Health: ${fails} FAIL, ${warns} WARN, ${passes} PASS`);
  } else if (warns > 0) {
    console.log(`🟡 Health: ${warns} WARN, ${passes} PASS`);
  } else {
    console.log(`🟢 Health: All ${passes} checks PASS`);
  }
  console.log('');

  if (JSON_MODE) {
    console.log(JSON.stringify(results, null, 2));
  }
}

main();
