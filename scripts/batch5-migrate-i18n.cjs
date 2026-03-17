/**
 * Batch-5 i18n Migration - Line-by-line approach
 * Scans each line for hardcoded text patterns and replaces them
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const LOCALE_ES = path.resolve(SRC, 'i18n', 'locales', 'es.json');
const LOCALE_EN = path.resolve(SRC, 'i18n', 'locales', 'en.json');

const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'public', 'scripts', '.gemini', '__tests__', 'locales', 'i18n', 'integrations', 'lib', 'types']);
const SKIP_FILES = /demoData|onboardingTemplate|\.test\.|\.spec\.|\.d\.ts|supabase|\.config\.|index\.ts$/i;

// Strings to never translate (technical terms that appear as JSX text)
const NEVER_TRANSLATE = new Set([
  'MAPE', 'RMSE', 'R2', 'FIFO', 'LIFO', 'PDF', 'CSV', 'JSON', 'SQL', 'API', 'URL', 'ID',
  'EUR', 'USD', 'KPI', 'ROI', 'KDS', 'POS', 'SKU', 'UPC', 'EAN', 'HACCP', 'FEFO',
  'Prophet', 'ML', 'AI', 'NaN', 'Close', 'vs', 'N/A', 'AM', 'PM', 'OK', 'No',
  'Loading', 'Error', 'MoM', 'YoY', 'WoW', 'DoD', 'QoQ',
  'Confidence', 'Engine', 'Horizon', 'Locations', 'Employees', 'Breakdown', 
]);

// Generate key from file path and text
function generateKey(filePath, text, idx) {
  const rel = path.relative(SRC, filePath).replace(/\\/g, '/');
  const parts = rel.replace(/\.(tsx?|jsx?)$/, '').split('/');
  
  let ns;
  if (parts[0] === 'pages') ns = parts.slice(1).join('.');
  else if (parts[0] === 'components') ns = parts.slice(1).join('.');
  else if (parts[0] === 'hooks') ns = 'hooks.' + parts.slice(1).join('.');
  else ns = parts.join('.');
  
  // Convert PascalCase to camelCase
  ns = ns.replace(/^([A-Z])/, (m) => m.toLowerCase());
  
  let suffix = text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  
  if (!suffix) suffix = `text${idx}`;
  if (suffix.length > 40) suffix = suffix.slice(0, 40);
  
  return `${ns}.${suffix}`;
}

function shouldTranslate(text) {
  const t = text.trim();
  if (t.length < 2) return false;
  if (NEVER_TRANSLATE.has(t)) return false;
  // Must contain at least one word-like letter sequence (2+ letters)
  if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑàèìòùäëïöü]{2,}/.test(t)) return false;
  // Skip pure code/expressions
  if (/^\$\{/.test(t) || /^\{/.test(t)) return false;
  // Skip URLs
  if (/^https?:\/\//.test(t)) return false;
  // Skip code patterns (SQL, function calls, etc)
  if (/^(SELECT|INSERT|UPDATE|DELETE|FROM|CREATE|DROP|ALTER)\b/i.test(t)) return false;
  if (/\b(FROM|WHERE|GROUP BY|ORDER BY|JOIN)\b/.test(t)) return false;
  // Skip strings that look like CSS classes or code
  if (/^[a-z][a-z0-9-]+$/.test(t)) return false;
  // Skip single-word lowercase (likely a variable or technical)
  if (/^[a-z]+$/.test(t) && t.length < 6) return false;
  // Skip already-i18n-key patterns
  if (/^[a-z]+\.[a-zA-Z]+/.test(t)) return false;
  return true;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const translations = {};
  let changeCount = 0;
  let keyIndex = 0;
  const usedKeys = new Set();
  let modified = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Skip lines that are comments, imports, console logs, or already have t()
    if (/^\s*(\/\/|\/\*|\*|import |console\.)/.test(line)) continue;
    // Skip lines that only have t() calls (already translated)
    if (line.includes("t('") || line.includes('t("')) continue;
    
    let lineModified = false;
    
    // Pattern 1: >Text< (JSX text content)
    // Match text between > and < that starts with a letter
    line = line.replace(/>([A-ZÁÉÍÓÚÑ¡¿][^<>{}]*?)</g, (match, text) => {
      const trimmed = text.trim();
      if (!shouldTranslate(trimmed)) return match;
      // Skip if it's inside a code block or expression
      if (trimmed.includes('${') || trimmed.includes('{')) return match;
      
      const key = generateKey(filePath, trimmed, keyIndex++);
      let uniqueKey = key;
      let s = 1;
      while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
      usedKeys.add(uniqueKey);
      translations[uniqueKey] = trimmed;
      changeCount++;
      lineModified = true;
      return `>{t('${uniqueKey}')}<`;
    });
    
    // Pattern 1b: >lowercase text that is a sentence/phrase<
    line = line.replace(/>([a-záéíóúñ][^<>{}]{3,})</g, (match, text) => {
      const trimmed = text.trim();
      if (!shouldTranslate(trimmed)) return match;
      if (trimmed.includes('${') || trimmed.includes('{')) return match;
      // Only translate if it has spaces (it's a phrase) or contains specific markers
      if (!trimmed.includes(' ') && !/[áéíóúñ]/.test(trimmed)) return match;
      
      const key = generateKey(filePath, trimmed, keyIndex++);
      let uniqueKey = key;
      let s = 1;
      while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
      usedKeys.add(uniqueKey);
      translations[uniqueKey] = trimmed;
      changeCount++;
      lineModified = true;
      return `>{t('${uniqueKey}')}<`;
    });
    
    // Pattern 1c: > ✓ Text< or > ✅ Text< (emoji-prefixed JSX text)
    line = line.replace(/>(\s*[✓✅🔮⚠️📊🌱🧠❌•·]\s*[A-Za-záéíóúñÁÉÍÓÚÑ][^<>{}]*?)</g, (match, text) => {
      const trimmed = text.trim();
      if (!shouldTranslate(trimmed)) return match;
      // Extract the text without the emoji for translation
      const textPart = trimmed.replace(/^[✓✅🔮⚠️📊🌱🧠❌•·]\s*/, '').trim();
      if (textPart.length < 3) return match;
      
      const key = generateKey(filePath, textPart, keyIndex++);
      let uniqueKey = key;
      let s = 1;
      while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
      usedKeys.add(uniqueKey);
      // Keep the emoji prefix
      const emoji = trimmed.match(/^([✓✅🔮⚠️📊🌱🧠❌•·]\s*)/)?.[1] || '';
      translations[uniqueKey] = textPart;
      changeCount++;
      lineModified = true;
      return `>${emoji}{t('${uniqueKey}')}<`;
    });
    
    // Pattern 2: placeholder="Text" → placeholder={t('key')}
    line = line.replace(/placeholder="([^"]{3,})"/g, (match, text) => {
      const trimmed = text.trim();
      if (!shouldTranslate(trimmed)) return match;
      
      const key = generateKey(filePath, trimmed, keyIndex++);
      let uniqueKey = key;
      let s = 1;
      while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
      usedKeys.add(uniqueKey);
      translations[uniqueKey] = trimmed;
      changeCount++;
      lineModified = true;
      return `placeholder={t('${uniqueKey}')}`;
    });
    
    // Pattern 3: label="Text" → label={t('key')} (for form labels only)
    line = line.replace(/label="([A-ZÁÉÍÓÚÑ¡¿][^"]{2,})"/g, (match, text) => {
      const trimmed = text.trim();
      if (!shouldTranslate(trimmed)) return match;
      
      const key = generateKey(filePath, trimmed, keyIndex++);
      let uniqueKey = key;
      let s = 1;
      while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
      usedKeys.add(uniqueKey);
      translations[uniqueKey] = trimmed;
      changeCount++;
      lineModified = true;
      return `label={t('${uniqueKey}')}`;
    });
    
    // Pattern 4: title="Text" and aria-label="Text" (but not CSS class titles)
    line = line.replace(/(title|aria-label)="([A-ZÁÉÍÓÚÑ¡¿][^"]{2,})"/g, (match, attr, text) => {
      const trimmed = text.trim();
      if (!shouldTranslate(trimmed)) return match;
      
      const key = generateKey(filePath, trimmed, keyIndex++);
      let uniqueKey = key;
      let s = 1;
      while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
      usedKeys.add(uniqueKey);
      translations[uniqueKey] = trimmed;
      changeCount++;
      lineModified = true;
      return `${attr}={t('${uniqueKey}')}`;
    });
    
    if (lineModified) {
      lines[i] = line;
      modified = true;
    }
  }
  
  if (modified) {
    let newContent = lines.join('\r\n'); // Keep CRLF
    
    // Add useTranslation import if missing
    if (!newContent.includes('useTranslation')) {
      // Find last import line
      const importMatch = newContent.match(/^(import\s.+\n)/gm);
      if (importMatch) {
        const lastImport = importMatch[importMatch.length - 1];
        const lastImportPos = newContent.lastIndexOf(lastImport) + lastImport.length;
        newContent = newContent.slice(0, lastImportPos) +
          "import { useTranslation } from 'react-i18next';\r\n" +
          newContent.slice(lastImportPos);
      }
    }
    
    // Add const { t } = useTranslation() if missing
    if (!/const\s*{\s*t[\s,]/.test(newContent)) {
      // Find function body start
      const fnMatch = newContent.match(/(?:export\s+(?:default\s+)?)?(?:function\s+\w+|const\s+\w+\s*(?::\s*\w+)?\s*=\s*(?:\([^)]*\)|[^=]))\s*(?:=>)?\s*\{/);
      if (fnMatch) {
        const insertPos = newContent.indexOf(fnMatch[0]) + fnMatch[0].length;
        newContent = newContent.slice(0, insertPos) +
          "\r\n  const { t } = useTranslation();" +
          newContent.slice(insertPos);
      }
    }
    
    fs.writeFileSync(filePath, newContent, 'utf8');
  }
  
  return { changeCount, translations };
}

function main() {
  const allTranslations = {};
  let totalChanges = 0;
  let filesModified = 0;
  const fileResults = [];
  
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(fp); continue; }
      if (!/\.(tsx|jsx)$/.test(entry.name)) continue;
      if (SKIP_FILES.test(entry.name)) continue;
      
      const { changeCount, translations } = processFile(fp);
      if (changeCount > 0) {
        const rel = path.relative(SRC, fp).replace(/\\/g, '/');
        filesModified++;
        totalChanges += changeCount;
        Object.assign(allTranslations, translations);
        fileResults.push({ file: rel, count: changeCount });
      }
    }
  }
  
  walk(SRC);
  
  // Load existing locale files
  let esLocale = {};
  let enLocale = {};
  try { esLocale = JSON.parse(fs.readFileSync(LOCALE_ES, 'utf8')); } catch(e) { console.error('Error reading es.json:', e.message); }
  try { enLocale = JSON.parse(fs.readFileSync(LOCALE_EN, 'utf8')); } catch(e) { console.error('Error reading en.json:', e.message); }
  
  // Merge: set nested keys
  function setNested(obj, key, value) {
    const parts = key.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    const lastKey = parts[parts.length - 1];
    if (current[lastKey] === undefined) {
      current[lastKey] = value;
    }
  }
  
  let newKeys = 0;
  for (const [key, value] of Object.entries(allTranslations)) {
    setNested(esLocale, key, value);
    setNested(enLocale, key, value);
    newKeys++;
  }
  
  fs.writeFileSync(LOCALE_ES, JSON.stringify(esLocale, null, 2) + '\n', 'utf8');
  fs.writeFileSync(LOCALE_EN, JSON.stringify(enLocale, null, 2) + '\n', 'utf8');
  
  console.log('=== BATCH-5 i18n MIGRATION COMPLETE ===');
  console.log(`Files modified: ${filesModified}`);
  console.log(`Total replacements: ${totalChanges}`);
  console.log(`New i18n keys: ${newKeys}`);
  console.log('');
  console.log('Top files:');
  fileResults.sort((a, b) => b.count - a.count);
  fileResults.forEach(r => {
    console.log(`  ${String(r.count).padStart(4)}  ${r.file}`);
  });
}

main();
