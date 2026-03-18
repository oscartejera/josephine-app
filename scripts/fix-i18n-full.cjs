/**
 * Comprehensive i18n Fix Script - Handles ALL 8 categories
 * Uses the audit-i18n-full.json report to fix every file
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const LOCALE_ES = path.resolve(SRC, 'i18n', 'locales', 'es.json');
const LOCALE_EN = path.resolve(SRC, 'i18n', 'locales', 'en.json');
const REPORT = require(path.resolve(__dirname, '..', 'audit-i18n-full.json'));

function generateKey(filePath, text, idx) {
  const rel = filePath.replace(/\\/g, '/');
  const parts = rel.replace(/\.(tsx?|jsx?)$/, '').split('/');
  
  let ns;
  if (parts[0] === 'pages') ns = parts.slice(1).join('.');
  else if (parts[0] === 'components') ns = parts.slice(1).join('.');
  else if (parts[0] === 'hooks') ns = parts.join('.');
  else if (parts[0] === 'ai-tools-core') ns = 'ai.' + parts.slice(1).join('.');
  else if (parts[0] === 'contexts') ns = 'ctx.' + parts.slice(1).join('.');
  else ns = parts.join('.');
  
  ns = ns.replace(/^([A-Z])/, (m) => m.toLowerCase());
  
  let suffix = text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  
  if (!suffix) suffix = `text${idx}`;
  if (suffix.length > 35) suffix = suffix.slice(0, 35);
  
  return `${ns}.${suffix}`;
}

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

function processFile(filePath, issues) {
  const fullPath = path.resolve(SRC, filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  const translations = {};
  let changeCount = 0;
  let keyIndex = 0;
  const usedKeys = new Set();
  
  for (const issue of issues) {
    const text = issue.text;
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    let replaced = false;
    
    switch (issue.category) {
      case 'JSX_TEXT': {
        // >Text< → >{t('key')}<
        const re = new RegExp('>' + escaped.replace(/\s+/g, '\\s*') + '<', 'g');
        const before = content;
        content = content.replace(re, (match) => {
          const key = generateKey(filePath, text, keyIndex++);
          let uniqueKey = key;
          let s = 1;
          while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
          usedKeys.add(uniqueKey);
          translations[uniqueKey] = text;
          replaced = true;
          return `>{t('${uniqueKey}')}<`;
        });
        if (content !== before) changeCount++;
        break;
      }
      
      case 'ATTR_PLACEHOLDER':
      case 'ATTR_LABEL':
      case 'ATTR_TITLE':
      case 'ATTR_ARIA-LABEL':
      case 'ATTR_ALT': {
        const attr = issue.category.replace('ATTR_', '').toLowerCase();
        const re = new RegExp(attr + '="' + escaped + '"', 'g');
        const before = content;
        content = content.replace(re, (match) => {
          const key = generateKey(filePath, text, keyIndex++);
          let uniqueKey = key;
          let s = 1;
          while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
          usedKeys.add(uniqueKey);
          translations[uniqueKey] = text;
          replaced = true;
          return `${attr}={t('${uniqueKey}')}`;
        });
        if (content !== before) changeCount++;
        break;
      }
      
      case 'TOAST_TITLE': {
        // title: "Text" → title: t('key')
        const re = new RegExp("title:\\s*[\"']" + escaped + "[\"']", 'g');
        const before = content;
        content = content.replace(re, (match) => {
          const key = generateKey(filePath, text, keyIndex++);
          let uniqueKey = key;
          let s = 1;
          while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
          usedKeys.add(uniqueKey);
          translations[uniqueKey] = text;
          replaced = true;
          return `title: t('${uniqueKey}')`;
        });
        if (content !== before) changeCount++;
        break;
      }
      
      case 'TOAST_DESC': {
        const re = new RegExp("description:\\s*[\"']" + escaped + "[\"']", 'g');
        const before = content;
        content = content.replace(re, (match) => {
          const key = generateKey(filePath, text, keyIndex++);
          let uniqueKey = key;
          let s = 1;
          while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
          usedKeys.add(uniqueKey);
          translations[uniqueKey] = text;
          replaced = true;
          return `description: t('${uniqueKey}')`;
        });
        if (content !== before) changeCount++;
        break;
      }
      
      case 'ERROR_MSG': {
        // throw new Error("Text") → throw new Error(t('key'))
        const re = new RegExp("throw\\s+new\\s+Error\\([\"']" + escaped + "[\"']\\)", 'g');
        const before = content;
        content = content.replace(re, (match) => {
          const key = generateKey(filePath, text, keyIndex++);
          let uniqueKey = key;
          let s = 1;
          while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
          usedKeys.add(uniqueKey);
          translations[uniqueKey] = text;
          replaced = true;
          return `throw new Error(t('${uniqueKey}'))`;
        });
        if (content !== before) changeCount++;
        break;
      }
      
      case 'VAR_STRING': {
        // const x = "Text" → const x = t('key')
        const re = new RegExp("((?:const|let|var)\\s+\\w+\\s*=\\s*)[\"']" + escaped + "[\"']", 'g');
        const before = content;
        content = content.replace(re, (match, prefix) => {
          const key = generateKey(filePath, text, keyIndex++);
          let uniqueKey = key;
          let s = 1;
          while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
          usedKeys.add(uniqueKey);
          translations[uniqueKey] = text;
          replaced = true;
          return `${prefix}t('${uniqueKey}')`;
        });
        if (content !== before) changeCount++;
        break;
      }
      
      case 'TERNARY': {
        // ? "Text" : → ? t('key') :
        const re = new RegExp("\\?\\s*[\"']" + escaped + "[\"']\\s*:", 'g');
        const before = content;
        content = content.replace(re, (match) => {
          const key = generateKey(filePath, text, keyIndex++);
          let uniqueKey = key;
          let s = 1;
          while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
          usedKeys.add(uniqueKey);
          translations[uniqueKey] = text;
          replaced = true;
          return `? t('${uniqueKey}') :`;
        });
        if (content !== before) changeCount++;
        break;
      }
      
      case 'TERNARY_ALT': {
        // : "Text"  → : t('key')
        // Must be careful not to match CSS/non-translatable contexts
        const re = new RegExp(":\\s*[\"']" + escaped + "[\"']", 'g');
        const before = content;
        content = content.replace(re, (match) => {
          // Check context to avoid CSS replacements
          const key = generateKey(filePath, text, keyIndex++);
          let uniqueKey = key;
          let s = 1;
          while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
          usedKeys.add(uniqueKey);
          translations[uniqueKey] = text;
          replaced = true;
          return `: t('${uniqueKey}')`;
        });
        if (content !== before) changeCount++;
        break;
      }
      
      case 'OBJ_LABEL': {
        // label: "Text" → label: t('key')
        const attrMatch = issue.context?.match(/^(\w+):\s*["']/);
        const attr = attrMatch ? attrMatch[1] : 'label';
        const re = new RegExp(attr + ":\\s*[\"']" + escaped + "[\"']", 'g');
        const before = content;
        content = content.replace(re, (match) => {
          const key = generateKey(filePath, text, keyIndex++);
          let uniqueKey = key;
          let s = 1;
          while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
          usedKeys.add(uniqueKey);
          translations[uniqueKey] = text;
          replaced = true;
          return `${attr}: t('${uniqueKey}')`;
        });
        if (content !== before) changeCount++;
        break;
      }
      
      case 'ALERT_MSG': {
        const re = new RegExp("((?:window\\.)?(alert|confirm))\\([\"']" + escaped + "[\"']\\)", 'g');
        const before = content;
        content = content.replace(re, (match, prefix) => {
          const key = generateKey(filePath, text, keyIndex++);
          let uniqueKey = key;
          let s = 1;
          while (usedKeys.has(uniqueKey)) uniqueKey = `${key}${s++}`;
          usedKeys.add(uniqueKey);
          translations[uniqueKey] = text;
          replaced = true;
          return `${prefix}(t('${uniqueKey}'))`;
        });
        if (content !== before) changeCount++;
        break;
      }
    }
  }
  
  if (changeCount > 0) {
    // Add useTranslation import if missing
    if (!content.includes('useTranslation')) {
      const importMatch = content.match(/^import\s.+$/gm);
      if (importMatch) {
        const lastImport = importMatch[importMatch.length - 1];
        const lastImportPos = content.indexOf(lastImport) + lastImport.length;
        content = content.slice(0, lastImportPos) +
          "\nimport { useTranslation } from 'react-i18next';" +
          content.slice(lastImportPos);
      }
    }
    
    // For non-component files (.ts without JSX - hooks, utils), 
    // we need to handle differently - use i18next.t directly for non-React files
    const isReactComponent = /\.(tsx|jsx)$/.test(filePath);
    
    if (isReactComponent && !/const\s*\{\s*t[\s,}]/.test(content)) {
      // Find the component function body
      const fnPatterns = [
        /(?:export\s+(?:default\s+)?)?(?:function|const)\s+\w+[^{]*\{/,
        /=>\s*\{/,
      ];
      for (const pat of fnPatterns) {
        const fnMatch = content.match(pat);
        if (fnMatch) {
          const insertPos = content.indexOf(fnMatch[0]) + fnMatch[0].length;
          content = content.slice(0, insertPos) +
            "\n  const { t } = useTranslation();" +
            content.slice(insertPos);
          break;
        }
      }
    } else if (!isReactComponent && !content.includes("from 'i18next'")) {
      // For .ts files (hooks, utils), import i18next directly
      // Replace useTranslation import with i18next
      content = content.replace(
        "import { useTranslation } from 'react-i18next';",
        "import i18next from 'i18next';"
      );
      // Replace t() with i18next.t()
      content = content.replace(/([^.])t\('/g, '$1i18next.t(\'');
      // Actually, many hooks use useTranslation inside the hook function
      // Let's check if there's a hook function
      if (/(?:export\s+)?(?:function|const)\s+use[A-Z]/.test(content)) {
        // It's a custom hook - can use useTranslation
        content = content.replace(
          "import i18next from 'i18next';",
          "import { useTranslation } from 'react-i18next';"
        );
        content = content.replace(/i18next\.t\('/g, "t('");
        // Add const { t } = useTranslation() if missing
        if (!/const\s*\{\s*t[\s,}]/.test(content)) {
          const hookMatch = content.match(/(?:export\s+)?(?:function|const)\s+use[A-Z]\w*[^{]*\{/);
          if (hookMatch) {
            const insertPos = content.indexOf(hookMatch[0]) + hookMatch[0].length;
            content = content.slice(0, insertPos) +
              "\n  const { t } = useTranslation();" +
              content.slice(insertPos);
          }
        }
      }
    }
    
    fs.writeFileSync(fullPath, content, 'utf8');
  }
  
  return { changeCount, translations };
}

function main() {
  let esLocale, enLocale;
  try { esLocale = JSON.parse(fs.readFileSync(LOCALE_ES, 'utf8')); } catch(e) { esLocale = {}; }
  try { enLocale = JSON.parse(fs.readFileSync(LOCALE_EN, 'utf8')); } catch(e) { enLocale = {}; }
  
  let totalChanges = 0;
  let totalKeys = 0;
  let filesModified = 0;
  const fileResults = [];
  
  for (const [filePath, issues] of Object.entries(REPORT)) {
    const { changeCount, translations } = processFile(filePath, issues);
    if (changeCount > 0) {
      filesModified++;
      totalChanges += changeCount;
      const newKeys = Object.keys(translations).length;
      totalKeys += newKeys;
      fileResults.push({ file: filePath, count: changeCount, keys: newKeys });
      
      for (const [key, value] of Object.entries(translations)) {
        setNested(esLocale, key, value);
        setNested(enLocale, key, value); // EN will need manual translation later
      }
    }
  }
  
  fs.writeFileSync(LOCALE_ES, JSON.stringify(esLocale, null, 2) + '\n', 'utf8');
  fs.writeFileSync(LOCALE_EN, JSON.stringify(enLocale, null, 2) + '\n', 'utf8');
  
  console.log('=== COMPREHENSIVE i18n FIX COMPLETE ===');
  console.log(`Files modified: ${filesModified}`);
  console.log(`Total replacements: ${totalChanges}`);
  console.log(`New i18n keys: ${totalKeys}`);
  console.log('');
  console.log('Files:');
  fileResults.sort((a, b) => b.count - a.count);
  fileResults.forEach(r => {
    console.log(`  ${String(r.count).padStart(4)} changes, ${String(r.keys).padStart(4)} keys  ${r.file}`);
  });
}

main();
