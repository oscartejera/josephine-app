#!/usr/bin/env node
/**
 * Codebase Snapshot — Compressed Map for Agent Context Injection
 *
 * Generates a ~200-line compressed map of the entire codebase:
 * pages, hooks, components, RPCs, and their connections.
 * This lets the agent "know" the entire codebase in 3 seconds.
 *
 * Usage:
 *   node scripts/snapshot.mjs              # generate docs/codebase-snapshot.md
 *   node scripts/snapshot.mjs --stdout     # print to stdout
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, relative, basename } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const STDOUT = process.argv.includes('--stdout');

function walkFiles(dir, pattern, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory() && !['node_modules', '.git', 'dist', '__tests__'].includes(entry)) {
        walkFiles(full, pattern, files);
      } else if (pattern.test(entry) && !entry.endsWith('.d.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
        files.push(full);
      }
    } catch {}
  }
  return files;
}

function extractImports(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const imports = [];
    const importRegex = /import\s+.*?\s+from\s+['"](@\/[^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  } catch { return []; }
}

function extractHooksUsed(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const hooks = [];
    const hookRegex = /\buse[A-Z]\w+/g;
    let match;
    while ((match = hookRegex.exec(content)) !== null) {
      if (!['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useContext', 'useReducer', 'useLayoutEffect'].includes(match[0])) {
        hooks.push(match[0]);
      }
    }
    return [...new Set(hooks)];
  } catch { return []; }
}

function extractRPCs(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const rpcs = [];
    const rpcRegex = /\.rpc\(\s*['"]([a-z_]+)['"]/g;
    let match;
    while ((match = rpcRegex.exec(content)) !== null) {
      rpcs.push(match[1]);
    }
    return [...new Set(rpcs)];
  } catch { return []; }
}

function extractExportName(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const defaultMatch = content.match(/export\s+default\s+function\s+(\w+)/);
    if (defaultMatch) return defaultMatch[1];
    const namedMatch = content.match(/export\s+(?:function|const)\s+(\w+)/);
    if (namedMatch) return namedMatch[1];
    return basename(filePath, '.tsx').replace('.ts', '');
  } catch {
    return basename(filePath).replace(/\.(tsx?|jsx?)$/, '');
  }
}

function main() {
  const lines = [];
  lines.push('# Josephine Codebase Snapshot');
  lines.push(`> Auto-generated ${new Date().toISOString().split('T')[0]} | agent context injection`);
  lines.push('');

  // Pages
  const pageFiles = walkFiles(join(SRC, 'pages'), /\.tsx$/);
  lines.push(`## Pages (${pageFiles.length})`);
  lines.push('');
  for (const f of pageFiles.sort()) {
    const name = extractExportName(f);
    const hooks = extractHooksUsed(f);
    const rpcs = extractRPCs(f);
    const rel = relative(SRC, f).replace(/\\/g, '/');
    let line = `- \`${rel}\` → **${name}**`;
    if (hooks.length) line += ` | hooks: ${hooks.slice(0, 5).join(', ')}`;
    if (rpcs.length) line += ` | rpcs: ${rpcs.join(', ')}`;
    lines.push(line);
  }
  lines.push('');

  // Hooks
  const hookFiles = walkFiles(join(SRC, 'hooks'), /\.ts$/);
  lines.push(`## Hooks (${hookFiles.length})`);
  lines.push('');
  for (const f of hookFiles.sort()) {
    const name = extractExportName(f);
    const rpcs = extractRPCs(f);
    const imports = extractImports(f).filter(i => i.includes('/data/'));
    const rel = relative(SRC, f).replace(/\\/g, '/');
    let line = `- \`${rel}\` → **${name}**`;
    if (rpcs.length) line += ` | rpcs: ${rpcs.join(', ')}`;
    if (imports.length) line += ` | data: ${imports.map(i => i.split('/').pop()).join(', ')}`;
    lines.push(line);
  }
  lines.push('');

  // Data modules
  const dataFiles = walkFiles(join(SRC, 'data'), /\.ts$/).filter(f => !f.includes('__tests__'));
  lines.push(`## Data Modules (${dataFiles.length})`);
  lines.push('');
  for (const f of dataFiles.sort()) {
    const name = basename(f, '.ts');
    const rpcs = extractRPCs(f);
    let line = `- \`data/${name}\``;
    if (rpcs.length) line += ` → rpcs: ${rpcs.join(', ')}`;
    lines.push(line);
  }
  lines.push('');

  // Contexts
  const ctxFiles = walkFiles(join(SRC, 'contexts'), /\.tsx$/);
  lines.push(`## Contexts (${ctxFiles.length})`);
  lines.push('');
  for (const f of ctxFiles.sort()) {
    lines.push(`- \`contexts/${basename(f)}\``);
  }
  lines.push('');

  // RPCs summary
  const allRPCs = new Set();
  [...pageFiles, ...hookFiles, ...dataFiles].forEach(f => {
    extractRPCs(f).forEach(r => allRPCs.add(r));
  });
  lines.push(`## RPCs Referenced (${allRPCs.size})`);
  lines.push('');
  [...allRPCs].sort().forEach(r => lines.push(`- \`${r}\``));
  lines.push('');

  // Migrations count
  const migDir = join(ROOT, 'supabase', 'migrations');
  if (existsSync(migDir)) {
    const migs = readdirSync(migDir).filter(f => f.endsWith('.sql'));
    lines.push(`## Migrations: ${migs.length}`);
    lines.push('');
  }

  const output = lines.join('\n');

  if (STDOUT) {
    console.log(output);
  } else {
    const docsDir = join(ROOT, 'docs');
    if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });
    const outPath = join(docsDir, 'codebase-snapshot.md');
    writeFileSync(outPath, output, 'utf8');
    console.log(`✅ Snapshot written to docs/codebase-snapshot.md (${lines.length} lines)`);
  }
}

main();
