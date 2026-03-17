/**
 * Batch-5 i18n audit: scan all .tsx/.ts files for remaining hardcoded strings
 * Outputs a detailed report with file-level counts and categorization
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const EXCLUDE_DIRS = new Set(['node_modules','.git','dist','build','public','scripts','.gemini','__tests__']);
const SKIP_FILES = /demoData|onboardingTemplate|year-data|pricing-omnes|\.test\.|\.spec\./i;

const results = [];
let totalJSX = 0, totalToast = 0, totalLabel = 0, totalAttr = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(fp); continue; }
    if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue;
    if (SKIP_FILES.test(entry.name)) continue;

    const content = fs.readFileSync(fp, 'utf8');
    const lines = content.split(/\r?\n/);
    const hits = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments, imports
      if (/^\s*(\/\/|\/\*|\*|import\s)/.test(line)) continue;
      
      // Remove already-translated t() calls from consideration
      const cleaned = line.replace(/\bt\(['"][^'"]*['"](,\s*\{[^}]*\})?\)/g, '');
      
      // 1. JSX text: >SomeText< (at least 2 word chars after the >)
      const jsxMatches = cleaned.match(/>[A-ZÁÉÍÓÚÑa-záéíóúñ][^<>{}]{2,}</g);
      if (jsxMatches) {
        for (const m of jsxMatches) {
          const text = m.slice(1).trim();
          // Skip single-char, className-like values, interpolation-only fragments
          if (text.length < 2) continue;
          if (/^(className|variant|style|type|id|key|ref|onClick|onChange|href|src|alt|name|value)$/.test(text)) continue;
          if (/^\{/.test(text)) continue; // starts with { = expression
          if (/^[a-z0-9_]+$/.test(text)) continue; // css class or technical token
          // Must have at least one letter
          if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(text)) continue;
          hits.push({ line: i + 1, type: 'jsx', text: text.slice(0, 80) });
          totalJSX++;
        }
      }
      
      // 2. Toast/description/title strings with Spanish accented chars
      const toastMatch = cleaned.match(/(?:description|message|title)\s*[:=]\s*['"]([^'"]*[áéíóúñÁÉÍÓÚÑ][^'"]*)['"]/g);
      if (toastMatch) {
        for (const m of toastMatch) {
          hits.push({ line: i + 1, type: 'toast', text: m.slice(0, 80) });
          totalToast++;
        }
      }
      
      // 3. label/placeholder with hardcoded strings (not using t())
      const labelMatch = cleaned.match(/(?:label|placeholder)\s*=\s*"([^"]{2,})"/g);
      if (labelMatch) {
        for (const m of labelMatch) {
          const val = m.match(/"([^"]+)"/)?.[1] || '';
          if (/^[a-z0-9_-]+$/.test(val)) continue; // technical id
          if (/\{/.test(val)) continue; // expression
          hits.push({ line: i + 1, type: 'label', text: m.slice(0, 80) });
          totalLabel++;
        }
      }
      
      // 4. title= or aria-label= or placeholder= with unquoted t() or with hardcoded string
      const attrMatch = cleaned.match(/(?:title|aria-label)\s*=\s*"([A-ZÁÉÍÓÚÑ][^"]{2,})"/g);
      if (attrMatch) {
        for (const m of attrMatch) {
          hits.push({ line: i + 1, type: 'attr', text: m.slice(0, 80) });
          totalAttr++;
        }
      }
    }
    
    if (hits.length > 0) {
      const rel = path.relative(SRC, fp).replace(/\\/g, '/');
      results.push({ file: rel, count: hits.length, hits });
    }
  }
}

walk(SRC);

// Sort by count descending
results.sort((a, b) => b.count - a.count);

const totalFiles = results.length;
const totalStrings = totalJSX + totalToast + totalLabel + totalAttr;

console.log('=== BATCH-5 i18n AUDIT ===');
console.log(`Total: ${totalStrings} strings across ${totalFiles} files`);
console.log(`  JSX text: ${totalJSX}`);
console.log(`  Toast/desc: ${totalToast}`);
console.log(`  Label/placeholder: ${totalLabel}`);
console.log(`  Title/aria: ${totalAttr}`);
console.log('');

console.log('Top 40 files:');
results.slice(0, 40).forEach(r => {
  console.log(`  ${String(r.count).padStart(4)}  ${r.file}`);
});

console.log('');
console.log('--- DETAILED HITS PER FILE ---');
results.forEach(r => {
  console.log(`\n[${r.file}] (${r.count} strings)`);
  r.hits.slice(0, 5).forEach(h => {
    console.log(`  L${h.line} [${h.type}] ${h.text}`);
  });
  if (r.hits.length > 5) console.log(`  ... and ${r.hits.length - 5} more`);
});
