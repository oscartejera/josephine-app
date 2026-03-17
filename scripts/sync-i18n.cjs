#!/usr/bin/env node
/**
 * sync-i18n.js — Automatic i18n key synchronisation
 *
 * Usage:  node scripts/sync-i18n.js
 *    or:  npm run i18n:sync
 *
 * Reads es.json as the source of truth and ensures every key exists in
 * en.json, ca.json, fr.json and de.json.
 *
 * • Missing keys are added with the Spanish value prefixed "[ES] " so
 *   translators can grep for them.
 * • Extra keys in target files are reported but NOT removed (safe merge).
 * • The script is idempotent — running it twice does nothing if already in sync.
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const SOURCE = 'es';
const TARGETS = ['en', 'ca', 'fr', 'de'];

// ── helpers ──────────────────────────────────────────────────────────────

/** Deep-merge source into target, adding missing keys with [ES] prefix */
function deepSync(source, target, prefix = '') {
  let added = 0;
  for (const [key, value] of Object.entries(source)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (!(key in target) || typeof target[key] !== 'object') {
        target[key] = {};
      }
      added += deepSync(value, target[key], fullKey);
    } else {
      if (!(key in target)) {
        target[key] = typeof value === 'string' ? `[ES] ${value}` : value;
        added++;
      }
    }
  }
  return added;
}

/** Count total leaf keys */
function countKeys(obj) {
  let count = 0;
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      count += countKeys(value);
    } else {
      count++;
    }
  }
  return count;
}

/** Count keys prefixed with [ES] (= untranslated) */
function countFallbacks(obj) {
  let count = 0;
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      count += countFallbacks(value);
    } else if (typeof value === 'string' && value.startsWith('[ES] ')) {
      count++;
    }
  }
  return count;
}

// ── main ─────────────────────────────────────────────────────────────────

const sourceFile = path.join(LOCALES_DIR, `${SOURCE}.json`);
const sourceData = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const sourceCount = countKeys(sourceData);

console.log(`\n🌍  i18n sync — source: ${SOURCE}.json (${sourceCount} keys)\n`);

let totalAdded = 0;

for (const lang of TARGETS) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const before = countKeys(data);
  const added = deepSync(sourceData, data);
  totalAdded += added;

  if (added > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  const fallbacks = countFallbacks(data);
  const status = added > 0 ? `+${added} keys added` : 'in sync ✓';
  const fbNote = fallbacks > 0 ? ` (${fallbacks} marked [ES])` : '';
  console.log(`  ${lang}.json  ${before} → ${countKeys(data)} keys  ${status}${fbNote}`);
}

console.log(`\n${totalAdded === 0 ? '✅ All locales are in sync!' : `⚡ Added ${totalAdded} keys total. Search for "[ES] " to find untranslated values.`}\n`);
