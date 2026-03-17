/**
 * batch-5 — comprehensive sweep of ALL remaining hardcoded Spanish strings.
 *
 * Strategy: Read each file, look for lines containing Spanish-accented characters,
 * analyze the context (JSX text, placeholder, template literal, toast, etc.),
 * generate a key from the file + content, add to es.json, and replace inline.
 *
 * Skips: i18n/, node_modules/, data files (seeds, demos), test files, comments, imports
 */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const ES_JSON = path.resolve(SRC, 'i18n', 'locales', 'es.json');

const SPANISH_RE = /[\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00dc\u00a1\u00bf]/;

// Directories to skip
const SKIP_DIRS = new Set(['i18n', 'node_modules', '__tests__', 'test']);

// Filenames to skip entirely (seed/demo data)
const SKIP_FILES = new Set([
  'supplierTemplates.ts',
  'categoryTemplates.ts',
  'demoDataGenerator.ts',
  'onboardingTemplates.ts',
  'year-data-generator.ts',
  'pricing-omnes-engine.ts',
  'pricing-omnes-engine.test.ts',
  'schedule-efficiency.test.ts',
  'e2e-flows.test.ts',
  'waste-audit.test.ts',
  'payroll.test.ts',
]);

// Load existing locale
const esData = JSON.parse(fs.readFileSync(ES_JSON, 'utf8'));

// Track new keys: { "section.key": "Spanish text" }
const newKeys = {};
let totalReplacements = 0;
let filesModified = 0;

// ---------- helpers ----------

function slugify(str) {
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);
}

/** Determine the i18n namespace from relative file path */
function getNamespace(relPath) {
  const parts = relPath.replace(/\\/g, '/').split('/');
  // pages/Settings/DataPrivacySection.tsx → settings
  // components/settings/LocationWizard.tsx → settings_locationWizard
  // components/dashboard/ExecutiveBriefing.tsx → dashboard
  // etc.

  if (parts.length >= 2 && parts[0] === 'pages') {
    const name = parts[parts.length - 1].replace(/\.(tsx?|ts)$/, '');
    if (parts.length === 3) {
      return parts[1].toLowerCase();
    }
    return slugify(name);
  }

  if (parts.length >= 3 && parts[0] === 'components') {
    return parts[1].toLowerCase();
  }

  if (parts[0] === 'hooks') return 'hooks';
  if (parts[0] === 'lib') return 'lib';

  return 'common';
}

/** Get a flat key path ensuring no collision */
function makeKey(namespace, text) {
  const slug = slugify(text);
  const base = `${namespace}.${slug}`;
  
  // Check if key already exists with same text
  const existing = getNestedValue(esData, base);
  if (existing === text) return base;
  
  // Check if base key exists with different text
  if (existing && existing !== text) {
    // Add counter
    for (let i = 2; i < 100; i++) {
      const candidate = `${base}_${i}`;
      const v = getNestedValue(esData, candidate);
      if (!v || v === text) return candidate;
    }
  }
  
  return base;
}

function getNestedValue(obj, keyPath) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function setNestedValue(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in cur) || typeof cur[parts[i]] !== 'object') {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

/** Find an existing key for a Spanish text */
function findExistingKey(text) {
  return searchForValue(esData, text, '');
}

function searchForValue(obj, target, prefix) {
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' && v === target) return fullKey;
    if (typeof v === 'object' && v !== null) {
      const found = searchForValue(v, target, fullKey);
      if (found) return found;
    }
  }
  return null;
}

// ---------- Pattern matchers ----------

/**
 * For each line, try to find a hardcoded Spanish string and its replacement.
 * Returns { original, replacement, key, text } or null.
 */
function processLine(line, lineIndex, allLines, namespace) {
  const trimmed = line.trim();
  
  // Skip comments and imports
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || 
      trimmed.startsWith('import ') || trimmed.startsWith('export type')) {
    return null;
  }

  if (!SPANISH_RE.test(line)) return null;

  // --- 1. Simple JSX text: >Spanish text<  ---
  const jsxText = line.match(/>([\s]*)([\w\s\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00dc\u00a1\u00bf\u00b7.,;:!?€%\-\/\(\)'\*\+\d#@]+[\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00dc\u00a1\u00bf][\w\s\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00dc\u00a1\u00bf\u00b7.,;:!?€%\-\/\(\)'\*\+\d#@]*)([\s]*)</);
  if (jsxText) {
    const text = jsxText[2].trim();
    if (text.length > 3 && text.length < 300 && SPANISH_RE.test(text)) {
      // Check it's not inside a t() or already translated
      if (line.includes(`t('`) || line.includes(`t("`)) {
        // Might be a fallback — check if the Spanish text is in the second arg
        const fallbackMatch = line.match(/t\(['"][^'"]+['"],\s*['"]([^'"]+)['"]\)/);
        if (fallbackMatch && SPANISH_RE.test(fallbackMatch[1])) {
          // Remove the fallback
          const old = fallbackMatch[0];
          const keyPart = old.match(/t\(['"]([^'"]+)['"]/)[1];
          const newCall = `t('${keyPart}')`;
          return {
            original: old,
            replacement: newCall,
            key: null, // already exists
            text: null
          };
        }
        return null;
      }
      
      // Skip if it contains JSX tags or complex interpolation
      if (text.includes('{') || text.includes('<') || text.includes('${')) return null;
      
      const existingKey = findExistingKey(text);
      const key = existingKey || makeKey(namespace, text);
      
      if (!existingKey) {
        newKeys[key] = text;
        setNestedValue(esData, key, text);
      }
      
      return {
        original: `>${jsxText[1]}${text}${jsxText[3]}<`,
        replacement: `>{t('${key}')}<`,
        key,
        text
      };
    }
  }

  // --- 2. Placeholder with Spanish ---
  const placeholderMatch = line.match(/placeholder=["']([^"']*[\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00dc\u00a1\u00bf][^"']*)["']/);
  if (placeholderMatch) {
    const text = placeholderMatch[1];
    const existingKey = findExistingKey(text);
    const key = existingKey || makeKey(namespace, text);
    if (!existingKey) { newKeys[key] = text; setNestedValue(esData, key, text); }
    return {
      original: placeholderMatch[0],
      replacement: `placeholder={t('${key}')}`,
      key, text
    };
  }

  // --- 3. Toast messages: title/description with Spanish string ---
  const toastStrMatch = line.match(/(title|description):\s*['"]([^'"]*[\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00dc\u00a1\u00bf][^'"]*)['"]/);
  if (toastStrMatch) {
    const text = toastStrMatch[2];
    const existingKey = findExistingKey(text);
    const key = existingKey || makeKey(namespace, text);
    if (!existingKey) { newKeys[key] = text; setNestedValue(esData, key, text); }
    return {
      original: toastStrMatch[0],
      replacement: `${toastStrMatch[1]}: t('${key}')`,
      key, text
    };
  }

  // --- 4. toast.success / toast.error with Spanish string ---
  const toastFnMatch = line.match(/toast\.(success|error|info|warning)\(['"]([^'"]*[\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00dc\u00a1\u00bf][^'"]*)['"]\)/);
  if (toastFnMatch) {
    const text = toastFnMatch[2];
    const existingKey = findExistingKey(text);
    const key = existingKey || makeKey(namespace, text);
    if (!existingKey) { newKeys[key] = text; setNestedValue(esData, key, text); }
    return {
      original: toastFnMatch[0],
      replacement: `toast.${toastFnMatch[1]}(t('${key}'))`,
      key, text
    };
  }

  // --- 5. Simple string assignment: 'Spanish text' or "Spanish text" ---
  const simpleStr = line.match(/(?:=|:|\()\s*['"]([^'"]*[\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00dc\u00a1\u00bf][^'"]{3,100})['"]/);
  if (simpleStr && !line.includes('console.') && !line.includes('t(\'') && !line.includes('t("')) {
    const text = simpleStr[1];
    // Skip if looks like it's already in a t() call or a data literal
    if (text.includes('${') || text.includes('{')) return null;
    
    const existingKey = findExistingKey(text);
    const key = existingKey || makeKey(namespace, text);
    if (!existingKey) { newKeys[key] = text; setNestedValue(esData, key, text); }
    
    // Determine correct quoting
    const quote = line.includes(`'${text}'`) ? "'" : '"';
    return {
      original: `${quote}${text}${quote}`,
      replacement: `t('${key}')`,
      key, text
    };
  }

  // --- 6. t('key', 'Fallback con acento') — remove the fallback ---
  const tFallback = line.match(/t\(['"]([^'"]+)['"],\s*['"]([^'"]*[\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00dc\u00a1\u00bf][^'"]*)['"]\)/);
  if (tFallback) {
    return {
      original: tFallback[0],
      replacement: `t('${tFallback[1]}')`,
      key: null,
      text: null
    };
  }

  return null;
}

// ---------- Ensure useTranslation hook is present ----------

function ensureUseTranslation(content, filePath) {
  // Only for .tsx files
  if (!filePath.endsWith('.tsx')) return content;
  
  // Skip if already has useTranslation
  if (content.includes('useTranslation')) return content;
  
  // Skip if file doesn't use t() (might not need it)
  if (!content.includes("t('") && !content.includes('t("')) return content;
  
  // Add import
  const importLine = "import { useTranslation } from 'react-i18next';\n";
  
  // Find last import line
  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ') || lines[i].startsWith('} from ')) {
      lastImportIdx = i;
    }
  }
  
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine.trimEnd());
    content = lines.join('\n');
  }
  
  // Add const { t } = useTranslation(); after the function declaration
  // Look for patterns like: function Component(, const Component = (, export default function
  const hookLine = '  const { t } = useTranslation();';
  
  if (!content.includes('const { t }') && !content.includes('const {t}')) {
    // Find the first function/component opening  
    const funcPatterns = [
      /(?:export\s+(?:default\s+)?)?function\s+\w+\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{/,
      /(?:const|let)\s+\w+\s*(?::\s*React\.FC\s*)?=\s*\([^)]*\)\s*(?::\s*\w+\s*)?\=>\s*\{/,
      /(?:const|let)\s+\w+\s*=\s*\(\)\s*=>\s*\{/,
    ];
    
    for (const pat of funcPatterns) {
      const match = content.match(pat);
      if (match) {
        const idx = content.indexOf(match[0]) + match[0].length;
        content = content.slice(0, idx) + '\n' + hookLine + content.slice(idx);
        break;
      }
    }
  }
  
  return content;
}

// ---------- Main loop ----------

function processFile(absPath) {
  const relPath = path.relative(SRC, absPath).replace(/\\/g, '/');
  const namespace = getNamespace(relPath);
  
  let content = fs.readFileSync(absPath, 'utf8');
  const lines = content.split('\n');
  let modified = false;
  let replacements = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const result = processLine(lines[i], i, lines, namespace);
    if (result) {
      const newLine = lines[i].replace(result.original, result.replacement);
      if (newLine !== lines[i]) {
        lines[i] = newLine;
        modified = true;
        replacements++;
      }
    }
  }
  
  if (modified) {
    content = lines.join('\n');
    content = ensureUseTranslation(content, absPath);
    fs.writeFileSync(absPath, content, 'utf8');
    totalReplacements += replacements;
    filesModified++;
    console.log(`  ✅ ${relPath}: ${replacements} replacements`);
  }
}

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        scanDir(fullPath);
      }
    } else if (/\.(tsx?)$/.test(entry.name) && !SKIP_FILES.has(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (SPANISH_RE.test(content)) {
        processFile(fullPath);
      }
    }
  }
}

console.log('🚀 batch-5: comprehensive sweep of remaining Spanish strings\n');
scanDir(SRC);

// Write updated es.json
fs.writeFileSync(ES_JSON, JSON.stringify(esData, null, 2) + '\n', 'utf8');

console.log(`\n📊 Results:`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Replacements:   ${totalReplacements}`);
console.log(`   New keys added: ${Object.keys(newKeys).length}`);

if (Object.keys(newKeys).length > 0) {
  console.log(`\n📝 New keys sample (first 20):`);
  for (const [k, v] of Object.entries(newKeys).slice(0, 20)) {
    console.log(`   ${k}: "${v.slice(0, 60)}${v.length > 60 ? '...' : ''}"`);
  }
}
