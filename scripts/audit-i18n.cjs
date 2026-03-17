#!/usr/bin/env node
/**
 * audit-i18n.js — Detect hardcoded UI strings in .tsx files
 *
 * Usage:  node scripts/audit-i18n.js
 *    or:  npm run i18n:audit
 *
 * Scans src/components and src/pages for JSX text that should use t().
 * Outputs a summary grouped by file with line numbers.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIRS = [
  path.join(__dirname, '..', 'src', 'pages'),
  path.join(__dirname, '..', 'src', 'components'),
];

// Patterns that indicate hardcoded user-facing text inside JSX
const PATTERNS = [
  // >Spanish text< (2+ words starting with uppercase)
  />[A-ZÁÉÍÓÚÑ¿¡][a-záéíóúñüà-ÿ]+\s+[a-záéíóúñüà-ÿ]+/,
  // >English text< (2+ words starting with uppercase)
  />[A-Z][a-z]+\s+[a-z]+\s+[a-z]+/,
];

const IGNORE = [
  /console\./,
  /\/\//,
  /\/\*/,
  /\{t\(/,
  /\{.*t\(/,
  /className=/,
  /import /,
  /from '/,
  /\.test\./,
  /\.spec\./,
];

function walkDir(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(full));
    } else if (entry.name.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

function scanFile(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip lines that already use t()
    if (line.includes('t(') || line.includes('{t(')) continue;
    // Skip imports, comments
    if (IGNORE.some(p => p.test(line))) continue;
    // Check for hardcoded text
    if (PATTERNS.some(p => p.test(line))) {
      const trimmed = line.trim().substring(0, 100);
      hits.push({ line: i + 1, text: trimmed });
    }
  }
  return hits;
}

// ── main ─────────────────────────────────────────────────────────────────

console.log('\n🔍  i18n audit — scanning for hardcoded strings...\n');

let totalHits = 0;
const results = [];

for (const dir of SRC_DIRS) {
  for (const file of walkDir(dir)) {
    const hits = scanFile(file);
    if (hits.length > 0) {
      const rel = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
      results.push({ file: rel, hits });
      totalHits += hits.length;
    }
  }
}

// Sort by number of hits descending
results.sort((a, b) => b.hits.length - a.hits.length);

for (const { file, hits } of results) {
  console.log(`  📄 ${file} (${hits.length} strings)`);
  for (const h of hits.slice(0, 5)) {
    console.log(`     L${h.line}: ${h.text}`);
  }
  if (hits.length > 5) {
    console.log(`     ... and ${hits.length - 5} more`);
  }
}

console.log(`\n${totalHits === 0 ? '✅ No hardcoded strings found!' : `⚠️  ${totalHits} hardcoded strings in ${results.length} files`}\n`);
