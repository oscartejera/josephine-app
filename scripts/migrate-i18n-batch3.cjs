/**
 * BATCH-3: Massive i18n migration for all remaining hardcoded Spanish strings.
 * 
 * Strategy:
 * 1. Reads audit-results.json for the full list
 * 2. Skips template/demo data files
 * 3. For each file, replaces hardcoded Spanish with t('key') calls
 * 4. Adds keys to es.json
 * 5. Ensures useTranslation hook is imported
 * 
 * Usage: node scripts/migrate-i18n-batch3.cjs [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const SRC = path.join(process.cwd(), 'src');
const ES_JSON = path.join(SRC, 'i18n', 'locales', 'es.json');

// Files to SKIP (template data, demo data, legal static)
const SKIP_FILES = new Set([
  'lib/onboardingTemplates.ts',
  'lib/supplierTemplates.ts',
  'lib/demoDataGenerator.ts',
  'lib/data-generator/year-data-generator.ts',
  'pages/PrivacyPolicy.tsx',
  'lib/pricing-omnes-engine.ts',
]);

// Load existing es.json
const esLocale = JSON.parse(fs.readFileSync(ES_JSON, 'utf8'));

// Generate i18n key from file path and Spanish text
function makeKey(filePath, text) {
  // Determine section from file path
  let section = 'common';
  const fp = filePath.toLowerCase();
  
  if (fp.includes('payroll')) section = 'payroll';
  else if (fp.includes('scheduling') || fp.includes('schedule')) section = 'scheduling';
  else if (fp.includes('workforce') || fp.includes('team') || fp.includes('staff')) section = 'team';
  else if (fp.includes('inventory') || fp.includes('recipe')) section = 'inventory';
  else if (fp.includes('settings') || fp.includes('billing') || fp.includes('loyalty') || fp.includes('booking') || fp.includes('users')) section = 'settings';
  else if (fp.includes('dashboard') || fp.includes('executive')) section = 'dashboard';
  else if (fp.includes('labour') || fp.includes('labor')) section = 'labour';
  else if (fp.includes('forecast')) section = 'forecast';
  else if (fp.includes('sales') || fp.includes('pricing')) section = 'pricing';
  else if (fp.includes('pos') || fp.includes('kiosk') || fp.includes('cash')) section = 'pos';
  else if (fp.includes('waste')) section = 'waste';
  else if (fp.includes('review')) section = 'reviews';
  else if (fp.includes('integration') || fp.includes('sync') || fp.includes('square') || fp.includes('lightspeed')) section = 'integrations';
  else if (fp.includes('onboarding')) section = 'onboarding';
  else if (fp.includes('auth') || fp.includes('login') || fp.includes('reset') || fp.includes('password')) section = 'auth';
  else if (fp.includes('ai') || fp.includes('josephine') || fp.includes('recommendation')) section = 'ai';
  else if (fp.includes('import') || fp.includes('export') || fp.includes('data')) section = 'data';
  else if (fp.includes('budget')) section = 'budgets';
  else if (fp.includes('notification')) section = 'notifications';
  else if (fp.includes('error') || fp.includes('offline')) section = 'errors';
  else if (fp.includes('menu-engineering')) section = 'menuEngineering';
  else if (fp.includes('admintools') || fp.includes('debug')) section = 'admin';
  
  // Generate key from text
  let key = text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
    .trim()
    .split(/\s+/)
    .slice(0, 5) // Max 5 words
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  
  if (!key) key = 'label';
  
  // Ensure uniqueness
  const fullKey = `${section}.${key}`;
  return fullKey;
}

// Ensure the section exists in es.json
function ensureSection(section) {
  if (!esLocale[section]) {
    esLocale[section] = {};
  }
}

// Add key to es.json, handling duplicates
function addKey(key, value) {
  const parts = key.split('.');
  const section = parts[0];
  const subKey = parts.slice(1).join('.');
  
  ensureSection(section);
  
  // If key already exists with same value, skip
  if (esLocale[section][subKey] === value) return key;
  
  // If key exists with different value, add suffix
  if (esLocale[section][subKey] !== undefined) {
    let suffix = 2;
    while (esLocale[section][subKey + suffix] !== undefined) suffix++;
    const newKey = `${section}.${subKey}${suffix}`;
    esLocale[section][subKey + suffix] = value;
    return newKey;
  }
  
  esLocale[section][subKey] = value;
  return key;
}

// Track which files need useTranslation import
const filesModified = new Set();
let totalReplaced = 0;
let totalKeysAdded = 0;

// Strings we've already keyed (to avoid duplicate keys)
const keyedStrings = new Map();

// Process a single file
function processFile(relPath, hits) {
  const absPath = path.join(SRC, relPath);
  if (!fs.existsSync(absPath)) {
    console.log(`  SKIP (not found): ${relPath}`);
    return;
  }
  
  let content = fs.readFileSync(absPath, 'utf8');
  let modified = false;
  let replacements = 0;
  
  // Sort hits by line number descending so we replace from bottom to top
  const sortedHits = [...hits].sort((a, b) => b.line - a.line);
  
  for (const hit of sortedHits) {
    const text = hit.text;
    
    // Skip very short or ambiguous strings
    if (text.length < 3) continue;
    
    // Generate or reuse key
    let key;
    if (keyedStrings.has(text)) {
      key = keyedStrings.get(text);
    } else {
      key = makeKey(relPath, text);
      key = addKey(key, text);
      keyedStrings.set(text, key);
      totalKeysAdded++;
    }
    
    // Try different replacement patterns
    let replaced = false;
    
    // Pattern 1: JSX text content >text<
    const jsxPattern = new RegExp(`>\\s*${escapeRegex(text)}\\s*<`, 'g');
    if (jsxPattern.test(content)) {
      content = content.replace(jsxPattern, (match) => {
        replaced = true;
        return `>{t('${key}')}<`;
      });
    }
    
    // Pattern 2: String in quotes (single or double)
    if (!replaced) {
      const sqPattern = `'${escapeRegex(text)}'`;
      const dqPattern = `"${escapeRegex(text)}"`;
      
      if (content.includes(sqPattern)) {
        content = content.replace(sqPattern, `t('${key}')`);
        replaced = true;
      } else if (content.includes(dqPattern)) {
        content = content.replace(dqPattern, `t('${key}')`);
        replaced = true;
      }
    }
    
    // Pattern 3: Template literal
    if (!replaced) {
      const tmplPattern = `\`${escapeRegex(text)}\``;
      if (content.includes(tmplPattern)) {
        content = content.replace(tmplPattern, `t('${key}')`);
        replaced = true;
      }
    }
    
    if (replaced) {
      replacements++;
      modified = true;
    }
  }
  
  if (modified && !DRY_RUN) {
    // Add useTranslation import if not present
    if (!content.includes('useTranslation')) {
      // Find first import line
      const importIdx = content.indexOf('import ');
      if (importIdx >= 0) {
        const insertPos = content.indexOf('\n', importIdx);
        content = content.slice(0, insertPos + 1) +
          "import { useTranslation } from 'react-i18next';\n" +
          content.slice(insertPos + 1);
      }
    }
    
    // Add const { t } = useTranslation() if not present
    if (!content.includes('const { t }') && !content.includes('const {t}')) {
      // For .ts files (hooks), can't add t() easily — skip hook inject
      if (relPath.endsWith('.tsx')) {
        // Find function component body
        const funcPatterns = [
          /(?:export\s+(?:default\s+)?function\s+\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{)/,
          /(?:(?:const|let)\s+\w+\s*[:=]\s*(?:\([^)]*\)\s*(?::\s*[^=]+)?\s*=>|function\s*\([^)]*\))\s*\{)/,
          /(?:export\s+default\s+function\s*\([^)]*\)\s*\{)/,
        ];
        
        let insertDone = false;
        for (const pat of funcPatterns) {
          const match = pat.exec(content);
          if (match) {
            const pos = match.index + match[0].length;
            // Check there isn't already a t declaration nearby
            const nextChunk = content.slice(pos, pos + 200);
            if (!nextChunk.includes('const { t }') && !nextChunk.includes('useTranslation')) {
              content = content.slice(0, pos) +
                "\n  const { t } = useTranslation();" +
                content.slice(pos);
              insertDone = true;
              break;
            } else {
              insertDone = true;
              break;
            }
          }
        }
      }
    }
    
    fs.writeFileSync(absPath, content, 'utf8');
    filesModified.add(relPath);
  }
  
  totalReplaced += replacements;
  if (replacements > 0) {
    console.log(`  ${relPath}: ${replacements}/${hits.length} replaced`);
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Main
console.log(`\n=== BATCH-3 i18n MIGRATION ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

const auditResults = require('./audit-results.json');

for (const [relPath, hits] of Object.entries(auditResults)) {
  if (SKIP_FILES.has(relPath)) {
    console.log(`  SKIP (template/demo): ${relPath}`);
    continue;
  }
  processFile(relPath, hits);
}

// Save updated es.json
if (!DRY_RUN) {
  fs.writeFileSync(ES_JSON, JSON.stringify(esLocale, null, 2) + '\n', 'utf8');
}

console.log(`\n=== RESULTS ===`);
console.log(`Files modified: ${filesModified.size}`);
console.log(`Strings replaced: ${totalReplaced}`);
console.log(`New keys added to es.json: ${totalKeysAdded}`);
console.log(`===============\n`);
