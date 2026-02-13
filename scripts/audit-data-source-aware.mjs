#!/usr/bin/env node
/**
 * audit-data-source-aware.mjs
 *
 * Scans src/ for TS/TSX files that query "sensitive" analytics tables via
 * supabase.from('table') and verifies data-source-unified awareness.
 *
 * Classification rules:
 *   A) .from('..._unified')       → OK  (unified view handles data source)
 *   B) .from('sensitive_table')   → requires .eq('data_source_unified', ...)
 *                                    filter in the same file; otherwise offender
 *   C) .rpc('..._unified')        → OK  (resolves data source server-side);
 *                                    reported for context but does NOT excuse
 *                                    unfiltered .from() calls on sensitive tables
 *
 * Previous heuristic checked for `dsUnified` anywhere in the file, which could
 * give false OKs when the variable only appeared in a queryKey (for cache
 * invalidation) but the actual query lacked a data_source_unified filter.
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

/**
 * Classify .from() calls into unified views vs non-unified sensitive tables.
 *
 * - A table ending in `_unified` is treated as a unified view (auto-OK).
 * - A table in SENSITIVE_TABLES that does NOT end in `_unified` needs a filter.
 */
function classifyFromCalls(content) {
  const regex = /\.from\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const nonUnified = new Set();
  const unified = new Set();
  let match;
  while ((match = regex.exec(content)) !== null) {
    const table = match[1];
    if (table.endsWith('_unified')) {
      unified.add(table);
    } else if (SENSITIVE_TABLES.has(table)) {
      nonUnified.add(table);
    }
  }
  return { nonUnified: [...nonUnified], unified: [...unified] };
}

/**
 * Returns true if the file contains an actual Supabase filter on the
 * data_source_unified column (.eq or .filter).
 *
 * This is stricter than the old check which accepted `dsUnified` anywhere
 * (e.g. inside a queryKey array).
 */
function hasDataSourceFilter(content) {
  return (
    /\.eq\(\s*['"`]data_source_unified['"`]/.test(content) ||
    /\.filter\(\s*['"`]data_source_unified['"`]/.test(content)
  );
}

/** Returns true if the file calls a *_unified RPC (for reporting). */
function hasUnifiedRpc(content) {
  return /\.rpc\(\s*['"`][^'"`]*_unified['"`]/.test(content);
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
  const { nonUnified, unified } = classifyFromCalls(content);

  // Skip files with no sensitive .from() calls at all
  if (nonUnified.length === 0 && unified.length === 0) continue;

  const rel = relative(process.cwd(), filePath);
  const rpcUnified = hasUnifiedRpc(content);

  if (nonUnified.length === 0) {
    // Only unified .from() calls — auto-OK
    const reasons = [];
    if (unified.length > 0) reasons.push('from_unified');
    if (rpcUnified) reasons.push('rpc_unified');
    okFiles.push({ path: rel, tables: unified, reasons });
  } else if (hasDataSourceFilter(content)) {
    // Has non-unified sensitive tables BUT also has an actual eq/filter — OK
    const reasons = ['eq_filter'];
    if (unified.length > 0) reasons.push('from_unified');
    if (rpcUnified) reasons.push('rpc_unified');
    okFiles.push({ path: rel, tables: [...nonUnified, ...unified], reasons });
  } else {
    // Non-unified sensitive tables WITHOUT a data_source_unified filter
    offenders.push({ path: rel, tables: nonUnified });
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
    console.log(`   ${f.path}  [${f.tables.join(', ')}]  (${f.reasons.join(', ')})`);
  }
}

if (offenders.length > 0) {
  console.log('\n⚠️  Offenders (need .eq("data_source_unified", ...) or migrate to *_unified view):');
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
