#!/usr/bin/env node
/**
 * Impact Map Generator — Dependency Graph for Josephine
 *
 * Analyzes TypeScript/TSX imports to build a dependency map showing:
 * - What each file imports (dependencies)
 * - What imports each file (dependents / "usedBy")
 * - Which pages consume each hook/data file
 * - Which RPCs are referenced
 *
 * Usage:
 *   node scripts/impact-map.mjs                    # generate full map
 *   node scripts/impact-map.mjs --query src/data/sales.ts  # show impact for one file
 *   node scripts/impact-map.mjs --summary          # show condensed summary
 *
 * Output: docs/impact-map.json (full map)
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, relative, dirname, basename, extname } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const args = process.argv.slice(2);
const QUERY = args.includes('--query') ? args[args.indexOf('--query') + 1] : null;
const SUMMARY = args.includes('--summary');

// ─── Collect all TS/TSX files ───────────────────────────────────────────────

function walkDir(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
      walkDir(full, files);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

// ─── Parse imports from a file ──────────────────────────────────────────────

function parseImports(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const imports = [];

  // Match: import ... from '...'  and  import '...'
  const importRegex = /(?:import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"])/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const source = match[1] || match[2];
    if (source) imports.push(source);
  }

  // Match dynamic imports: import('...')
  const dynamicRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

// ─── Resolve import path to actual file ─────────────────────────────────────

function resolveImport(importPath, fromFile) {
  // Handle @ alias
  if (importPath.startsWith('@/')) {
    importPath = join(SRC, importPath.slice(2));
  } else if (importPath.startsWith('.')) {
    importPath = join(dirname(fromFile), importPath);
  } else {
    // External package — skip
    return null;
  }

  // Try exact match, then with extensions, then /index
  const extensions = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
  for (const ext of extensions) {
    const candidate = importPath + ext;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

// ─── Extract RPC references ────────────────────────────────────────────────

function extractRPCs(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const rpcs = [];

  // Match: .rpc('rpc_name' or supabase.rpc('name'  or rpcName: 'name'
  const rpcRegex = /\.rpc\(\s*['"]([a-z_]+)['"]/g;
  let match;
  while ((match = rpcRegex.exec(content)) !== null) {
    rpcs.push(match[1]);
  }

  return [...new Set(rpcs)];
}

// ─── Build the graph ────────────────────────────────────────────────────────

function buildGraph() {
  const allFiles = walkDir(SRC);
  const graph = {}; // filePath -> { imports: [], importedBy: [], rpcs: [] }

  // Initialize
  for (const file of allFiles) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    graph[rel] = { imports: [], importedBy: [], rpcs: [] };
  }

  // Build edges
  for (const file of allFiles) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    const rawImports = parseImports(file);
    const rpcs = extractRPCs(file);

    graph[rel].rpcs = rpcs;

    for (const imp of rawImports) {
      const resolved = resolveImport(imp, file);
      if (resolved) {
        const resolvedRel = relative(ROOT, resolved).replace(/\\/g, '/');
        if (graph[resolvedRel]) {
          graph[rel].imports.push(resolvedRel);
          graph[resolvedRel].importedBy.push(rel);
        }
      }
    }
  }

  return graph;
}

// ─── Categorize files ───────────────────────────────────────────────────────

function categorize(filePath) {
  if (filePath.includes('src/pages/')) return 'page';
  if (filePath.includes('src/hooks/')) return 'hook';
  if (filePath.includes('src/data/')) return 'data';
  if (filePath.includes('src/components/')) return 'component';
  if (filePath.includes('src/contexts/')) return 'context';
  if (filePath.includes('src/stores/')) return 'store';
  if (filePath.includes('src/lib/')) return 'utility';
  if (filePath.includes('src/integrations/')) return 'integration';
  return 'other';
}

// ─── Find all pages that transitively depend on a file ──────────────────────

function findConsumingPages(filePath, graph, visited = new Set()) {
  if (visited.has(filePath)) return [];
  visited.add(filePath);

  const pages = [];
  const node = graph[filePath];
  if (!node) return pages;

  for (const consumer of node.importedBy) {
    if (categorize(consumer) === 'page') {
      pages.push(consumer);
    } else {
      pages.push(...findConsumingPages(consumer, graph, visited));
    }
  }

  return [...new Set(pages)];
}

// ─── Query mode: show impact for a single file ─────────────────────────────

function queryFile(targetPath, graph) {
  // Normalize path
  const normalized = targetPath.replace(/\\/g, '/');
  const match = Object.keys(graph).find(k =>
    k === normalized || k.endsWith(normalized) || k.includes(normalized)
  );

  if (!match) {
    console.log(`❌ File not found in graph: ${targetPath}`);
    console.log('   Try a relative path like: src/data/sales.ts');
    process.exit(1);
  }

  const node = graph[match];
  const pages = findConsumingPages(match, graph);

  console.log(`\n📊 Impact Analysis: ${match}`);
  console.log('─'.repeat(60));
  console.log(`   Category: ${categorize(match)}`);

  if (node.imports.length > 0) {
    console.log(`\n   📥 Imports (${node.imports.length}):`);
    node.imports.forEach(i => console.log(`      ${i}`));
  }

  if (node.importedBy.length > 0) {
    console.log(`\n   📤 Used by (${node.importedBy.length}):`);
    node.importedBy.forEach(i => {
      const cat = categorize(i);
      console.log(`      [${cat}] ${i}`);
    });
  }

  if (pages.length > 0) {
    console.log(`\n   📄 Consuming pages (${pages.length}):`);
    pages.forEach(p => console.log(`      ${p}`));
  }

  if (node.rpcs.length > 0) {
    console.log(`\n   🔌 RPCs referenced:`);
    node.rpcs.forEach(r => console.log(`      ${r}`));
  }

  console.log('');
}

// ─── Summary mode ───────────────────────────────────────────────────────────

function showSummary(graph) {
  const stats = { page: 0, hook: 0, data: 0, component: 0, context: 0, store: 0, utility: 0, integration: 0, other: 0 };
  const allRPCs = new Set();
  let highImpact = []; // files used by many others

  for (const [file, node] of Object.entries(graph)) {
    const cat = categorize(file);
    stats[cat] = (stats[cat] || 0) + 1;
    node.rpcs.forEach(r => allRPCs.add(r));

    if (node.importedBy.length >= 5) {
      highImpact.push({ file, consumers: node.importedBy.length, category: cat });
    }
  }

  highImpact.sort((a, b) => b.consumers - a.consumers);

  console.log('\n📊 Josephine Codebase Summary');
  console.log('─'.repeat(50));
  console.log(`   Pages:       ${stats.page}`);
  console.log(`   Hooks:       ${stats.hook}`);
  console.log(`   Data:        ${stats.data}`);
  console.log(`   Components:  ${stats.component}`);
  console.log(`   Contexts:    ${stats.context}`);
  console.log(`   Stores:      ${stats.store}`);
  console.log(`   Utilities:   ${stats.utility}`);
  console.log(`   Other:       ${stats.other + stats.integration}`);
  console.log(`   Total:       ${Object.keys(graph).length}`);
  console.log(`   RPCs used:   ${allRPCs.size}`);

  if (highImpact.length > 0) {
    console.log(`\n⚠️  High-Impact Files (≥5 consumers):`);
    highImpact.slice(0, 20).forEach(h => {
      console.log(`   [${h.category}] ${h.file} → ${h.consumers} consumers`);
    });
  }

  if (allRPCs.size > 0) {
    console.log(`\n🔌 RPCs Referenced:`);
    [...allRPCs].sort().forEach(r => console.log(`   ${r}`));
  }

  console.log('');
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log('🔍 Building dependency graph...');
  const graph = buildGraph();
  console.log(`   Analyzed ${Object.keys(graph).length} files`);

  if (QUERY) {
    queryFile(QUERY, graph);
    return;
  }

  if (SUMMARY) {
    showSummary(graph);
    return;
  }

  // Generate full map
  const output = {};
  for (const [file, node] of Object.entries(graph)) {
    const pages = findConsumingPages(file, graph);
    output[file] = {
      category: categorize(file),
      imports: node.imports,
      usedBy: node.importedBy,
      pages: pages,
      rpcs: node.rpcs,
    };
  }

  const docsDir = join(ROOT, 'docs');
  if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });

  const outPath = join(docsDir, 'impact-map.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n✅ Impact map written to ${relative(ROOT, outPath)}`);
  console.log(`   ${Object.keys(output).length} files mapped`);

  // Also show summary
  showSummary(graph);
}

main();
