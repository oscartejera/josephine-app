/**
 * Full i18n Audit Script
 * Detects ALL categories of untranslated strings:
 *  1. JSX text: >Text<
 *  2. String attributes: placeholder="...", label="...", title="...", aria-label="..."
 *  3. Toast messages: toast({ title: "...", description: "..." })
 *  4. Template literals with Spanish text
 *  5. Hardcoded strings in variables: const msg = "Spanish text..."
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'public', 'scripts', '.gemini', '__tests__', 'locales', 'i18n']);
const SKIP_FILES = /demoData|onboardingTemplate|\.test\.|\.spec\.|\.d\.ts|\.config\./i;

// Words/phrases that are always technical and should not be translated
const TECHNICAL_WORDS = new Set([
  'MAPE', 'RMSE', 'R2', 'FIFO', 'LIFO', 'PDF', 'CSV', 'JSON', 'SQL', 'API', 'URL', 'ID',
  'EUR', 'USD', 'KPI', 'ROI', 'KDS', 'POS', 'SKU', 'UPC', 'EAN', 'HACCP', 'FEFO',
  'OAuth', 'SSO', 'CORS', 'JWT', 'REST', 'GraphQL', 'HTML', 'CSS', 'DOM',
  'Prophet', 'ML', 'AI', 'NaN', 'N/A', 'vs', 'OK', 'AM', 'PM',
  'MoM', 'YoY', 'WoW', 'DoD', 'QoQ', 'Loading', 'Error',
  'null', 'undefined', 'true', 'false', 'NaN',
]);

function isSpanishText(text) {
  const t = text.trim();
  if (t.length < 3) return false;
  if (TECHNICAL_WORDS.has(t)) return false;
  // Must contain at least one 2+ letter word
  if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑàèìòùäëïöü]{2,}/.test(t)) return false;
  // Skip URLs
  if (/^https?:\/\//.test(t)) return false;
  // Skip code patterns
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(t)) return false;
  // Skip CSS class-like strings
  if (/^[a-z][a-z0-9-]+$/.test(t)) return false;
  // Skip dot-notation (likely i18n keys already)
  if (/^[a-z]+\.[a-zA-Z]+/.test(t)) return false;
  // Skip CONSTANT_CASE
  if (/^[A-Z][A-Z0-9_]+$/.test(t)) return false;
  // Skip single lowercase word under 6 chars (likely variable/technical)
  if (/^[a-z]+$/.test(t) && t.length < 6) return false;
  // Skip format strings like "YYYY-MM-DD"
  if (/^[YMDHhms/:-]+$/.test(t)) return false;
  // Skip strings that are just numbers with units
  if (/^[\d.,]+\s*(%|€|\$|kg|g|ml|l|L|un|uds?)$/i.test(t)) return false;
  return true;
}

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Skip comment/import lines
    if (/^\s*(\/\/|\/\*|\*|import\s)/.test(line)) continue;
    // Skip lines that have t() or t(" — already translated
    if (/\bt\(['"]/.test(line)) continue;
    // Skip console.log lines
    if (/console\.(log|warn|error|info)/.test(line)) continue;

    // Category 1: JSX text >Text<
    const jsxTextRe = />([^<>{}]{3,})</g;
    let m;
    while ((m = jsxTextRe.exec(line)) !== null) {
      const text = m[1].trim();
      if (isSpanishText(text)) {
        issues.push({ line: lineNum, category: 'JSX_TEXT', text, context: line.trim().slice(0, 120) });
      }
    }
    
    // Category 2: String attributes
    const attrRe = /(placeholder|label|title|aria-label|alt)="([^"]{3,})"/g;
    while ((m = attrRe.exec(line)) !== null) {
      const text = m[2].trim();
      if (isSpanishText(text)) {
        issues.push({ line: lineNum, category: 'ATTR_' + m[1].toUpperCase(), text, context: line.trim().slice(0, 120) });
      }
    }
    
    // Category 3: Toast calls with hardcoded strings
    // toast({ title: "...", description: "..." })
    const toastTitleRe = /title:\s*["']([^"']{3,})["']/g;
    while ((m = toastTitleRe.exec(line)) !== null) {
      const text = m[1].trim();
      if (isSpanishText(text) && !line.includes('t(')) {
        issues.push({ line: lineNum, category: 'TOAST_TITLE', text, context: line.trim().slice(0, 120) });
      }
    }
    const toastDescRe = /description:\s*["']([^"']{3,})["']/g;
    while ((m = toastDescRe.exec(line)) !== null) {
      const text = m[1].trim();
      if (isSpanishText(text) && !line.includes('t(')) {
        issues.push({ line: lineNum, category: 'TOAST_DESC', text, context: line.trim().slice(0, 120) });
      }
    }
    
    // Category 4: Alert/confirm/window messages
    const alertRe = /(window\.)?(alert|confirm)\(["']([^"']{3,})["']\)/g;
    while ((m = alertRe.exec(line)) !== null) {
      const text = m[3].trim();
      if (isSpanishText(text)) {
        issues.push({ line: lineNum, category: 'ALERT_MSG', text, context: line.trim().slice(0, 120) });
      }
    }
    
    // Category 5: Error messages - throw new Error("...")
    const errorRe = /throw\s+new\s+Error\(["']([^"']{5,})["']\)/g;
    while ((m = errorRe.exec(line)) !== null) {
      const text = m[1].trim();
      if (isSpanishText(text)) {
        issues.push({ line: lineNum, category: 'ERROR_MSG', text, context: line.trim().slice(0, 120) });
      }
    }
    
    // Category 6: Hardcoded string variables containing Spanish
    // const label = "Texto español" or let message = 'Texto español'
    const varStringRe = /(?:const|let|var)\s+\w+\s*=\s*["']([A-ZÁÉÍÓÚÑ¡¿][^"']{4,})["']/g;
    while ((m = varStringRe.exec(line)) !== null) {
      const text = m[1].trim();
      if (isSpanishText(text) && !line.includes('t(')) {
        issues.push({ line: lineNum, category: 'VAR_STRING', text, context: line.trim().slice(0, 120) });
      }
    }
    
    // Category 7: Return/value strings - "Texto" in ternaries/returns
    // ? "Texto" : "Otro"
    const ternaryRe = /\?\s*["']([A-ZÁÉÍÓÚÑ¡¿][^"']{2,})["']\s*:/g;
    while ((m = ternaryRe.exec(line)) !== null) {
      const text = m[1].trim();
      if (isSpanishText(text) && !line.includes('t(')) {
        issues.push({ line: lineNum, category: 'TERNARY', text, context: line.trim().slice(0, 120) });
      }
    }
    const ternary2Re = /:\s*["']([A-ZÁÉÍÓÚÑ¡¿][^"']{2,})["']/g;
    while ((m = ternary2Re.exec(line)) !== null) {
      const text = m[1].trim();
      // Skip CSS values, hex colors, etc
      if (isSpanishText(text) && !line.includes('t(') && !line.includes('className') && !line.includes('color')) {
        issues.push({ line: lineNum, category: 'TERNARY_ALT', text, context: line.trim().slice(0, 120) });
      }
    }
    
    // Category 8: Object property strings (for dropdowns, options arrays)
    // { label: "Texto", value: ... }
    const objLabelRe = /(?:label|name|text|message|header|description|tooltip):\s*["']([A-ZÁÉÍÓÚÑ¡¿][^"']{2,})["']/g;
    while ((m = objLabelRe.exec(line)) !== null) {
      const text = m[1].trim();
      if (isSpanishText(text) && !line.includes('t(')) {
        issues.push({ line: lineNum, category: 'OBJ_LABEL', text, context: line.trim().slice(0, 120) });
      }
    }
  }

  return issues;
}

function main() {
  const allIssues = {};
  let totalIssues = 0;
  let totalFiles = 0;
  
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(fp); continue; }
      if (!/\.(tsx|jsx|ts)$/.test(entry.name)) continue;
      if (SKIP_FILES.test(entry.name)) continue;
      
      const issues = auditFile(fp);
      if (issues.length > 0) {
        const rel = path.relative(SRC, fp).replace(/\\/g, '/');
        allIssues[rel] = issues;
        totalIssues += issues.length;
        totalFiles++;
      }
    }
  }
  
  walk(SRC);
  
  // Print summary by category
  const categoryCounts = {};
  for (const [file, issues] of Object.entries(allIssues)) {
    for (const issue of issues) {
      categoryCounts[issue.category] = (categoryCounts[issue.category] || 0) + 1;
    }
  }
  
  console.log('=== FULL i18n AUDIT REPORT ===');
  console.log(`Total untranslated strings: ${totalIssues}`);
  console.log(`Files with issues: ${totalFiles}`);
  console.log('');
  console.log('By category:');
  Object.entries(categoryCounts).sort((a,b) => b[1]-a[1]).forEach(([cat, count]) => {
    console.log(`  ${String(count).padStart(5)}  ${cat}`);
  });
  console.log('');
  
  // Print by file (top files first)
  const fileEntries = Object.entries(allIssues).sort((a,b) => b[1].length - a[1].length);
  console.log('By file (top 60):');
  fileEntries.slice(0, 60).forEach(([file, issues]) => {
    console.log(`\n--- ${file} (${issues.length} issues) ---`);
    issues.slice(0, 30).forEach(issue => {
      console.log(`  L${String(issue.line).padStart(4)} [${issue.category}] "${issue.text.slice(0,80)}"`);
    });
    if (issues.length > 30) console.log(`  ... and ${issues.length - 30} more`);
  });
  
  // Write JSON report for processing
  fs.writeFileSync(
    path.resolve(__dirname, '..', 'audit-i18n-full.json'),
    JSON.stringify(allIssues, null, 2),
    'utf8'
  );
  console.log('\nFull report saved to audit-i18n-full.json');
}

main();
