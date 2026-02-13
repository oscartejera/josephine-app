#!/usr/bin/env node
/**
 * audit-data-source-aware.mjs
 *
 * Scans src/ for TS/TSX files that query "sensitive" analytics tables via
 * supabase.from('table') WITHOUT evidence of data-source-unified awareness.
 *
 * A file is considered "OK" if it contains at least one of:
 *   - `data_source_unified` (filter on unified column)
 *   - `dsUnified` (variable from DataSourceContext)
 *   - a `.from('..._unified')` or `.rpc('..._unified'` call
 *
 * Usage:
 *   node scripts/audit-data-source-aware.mjs               # warn mode (exit 0)
 *   node scripts/audit-data-source-aware.mjs --fail-on-offenders  # strict (exit 1 if offenders)
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Tables / views that contain both demo and POS rows and MUST be queried
 *  through a unified view or with a data_source_unified filter. */
const SENSITIVE_TABLES = new Set([
  'tickets',
  'ticket_lines',
  'cogs_daily',
  'labour_daily',
  'product_sales_daily',
  'pos_daily_finance',
  'facts_sales_15m',
  'facts_item_mix_daily',
  'facts_labor_daily',
  'facts_inventory_daily',
  'budgets_daily',
  'cash_counts_daily',
  'sales_daily_unified',  // legacy name — still sensitive
]);

/** Paths to exclude from scanning (admin / seed / cleanup utilities). */
const EXCLUDED_PATHS = [
  'components/settings/DemoDataManager',  // delete-only admin utility
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function isExcluded(filePath) {
  return EXCLUDED_PATHS.some((ex) => filePath.includes(ex));
}

/** Returns true if the file shows data-source-unified awareness. */
function isDataSourceAware(content) {
  return (
    content.includes('data_source_unified') ||
    content.includes('dsUnified') ||
    /_unified['"`]/.test(content)  // .from('v_xxx_unified') or .rpc('xxx_unified')
  );
}

/** Returns list of sensitive table names found in supabase .from() calls. */
function findSensitiveQueries(content) {
  // Match .from('table') or .from("table") or .from(`table`)
  const regex = /\.from\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const found = new Set();
  let match;
  while ((match = regex.exec(content)) !== null) {
    const table = match[1];
    if (SENSITIVE_TABLES.has(table)) {
      found.add(table);
    }
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const failOnOffenders = process.argv.includes('--fail-on-offenders');
const srcDir = join(process.cwd(), 'src');

const files = await walk(srcDir);

const okFiles = [];
const offenders = [];

for (const filePath of files) {
  if (isExcluded(filePath)) continue;

  const content = await readFile(filePath, 'utf8');
  const tables = findSensitiveQueries(content);
  if (tables.length === 0) continue;

  const rel = relative(process.cwd(), filePath);

  if (isDataSourceAware(content)) {
    okFiles.push({ path: rel, tables });
  } else {
    offenders.push({ path: rel, tables });
  }
}

// Output
console.log('\n📊 Data Source Audit Report');
console.log('─'.repeat(50));
console.log(`  ✅ OK (data-source-aware):   ${okFiles.length}`);
console.log(`  ⚠️  Offenders:               ${offenders.length}`);
console.log('─'.repeat(50));

if (okFiles.length > 0) {
  console.log('\n✅ OK files:');
  for (const f of okFiles) {
    console.log(`   ${f.path}  [${f.tables.join(', ')}]`);
  }
}

if (offenders.length > 0) {
  console.log('\n⚠️  Offenders (missing data_source_unified / dsUnified / *_unified):');
  for (const f of offenders) {
    console.log(`   ${f.path}  [${f.tables.join(', ')}]`);
  }
}

console.log('');

if (offenders.length > 0 && failOnOffenders) {
  console.log('❌ Failing because --fail-on-offenders is set.\n');
  process.exit(1);
} else if (offenders.length > 0) {
  console.log('ℹ️  Run with --fail-on-offenders to fail CI on these.\n');
}
