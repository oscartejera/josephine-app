#!/usr/bin/env node
/**
 * Task Decomposer — Automated Feature Analysis
 *
 * Analyzes the codebase to suggest a decomposition plan for a new feature.
 * Uses the impact-map dependency graph to identify affected layers.
 *
 * Usage:
 *   node scripts/decompose.mjs --name "Stock Alerts"
 *   node scripts/decompose.mjs --name "Reservations" --files src/data/reservations.ts src/pages/Reservations.tsx
 *   node scripts/decompose.mjs --analyze src/hooks/useSalesData.ts   # analyze existing feature structure
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function getListArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return [];
  const values = [];
  for (let i = idx + 1; i < args.length && !args[i].startsWith('--'); i++) {
    values.push(args[i]);
  }
  return values;
}

const NAME = getArg('name');
const FILES = getListArg('files');
const ANALYZE = getArg('analyze');

// ─── Helpers ────────────────────────────────────────────────────────────────

function toPascalCase(str) {
  return str.replace(/(?:^|[-_\s])(\w)/g, (_, c) => c.toUpperCase());
}

function toKebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}

function categorize(filePath) {
  const p = filePath.replace(/\\/g, '/');
  if (p.includes('supabase/migrations')) return 'database';
  if (p.includes('src/data/')) return 'data';
  if (p.includes('src/hooks/')) return 'hook';
  if (p.includes('src/components/')) return 'component';
  if (p.includes('src/pages/')) return 'page';
  if (p.includes('src/contexts/')) return 'context';
  if (p.includes('src/i18n/')) return 'i18n';
  if (p.includes('App.tsx') || p.includes('AppSidebar.tsx')) return 'navigation';
  return 'other';
}

const LAYER_ORDER = ['database', 'data', 'hook', 'context', 'component', 'page', 'navigation', 'i18n', 'other'];
const LAYER_EMOJI = {
  database: '🗃️',
  data: '📡',
  hook: '🪝',
  context: '🌐',
  component: '🧩',
  page: '📄',
  navigation: '🧭',
  i18n: '🌍',
  other: '📦',
};

// ─── Analyze existing feature ───────────────────────────────────────────────

function analyzeExistingFeature(targetPath) {
  console.log(`\n🔍 Analyzing feature from: ${targetPath}\n`);

  // Walk imports recursively to find all related files
  const visited = new Set();
  const allFiles = [];

  function walkImports(filePath) {
    const norm = filePath.replace(/\\/g, '/');
    if (visited.has(norm)) return;
    visited.add(norm);

    const full = join(ROOT, filePath);
    if (!existsSync(full)) return;

    allFiles.push(norm);

    try {
      const content = readFileSync(full, 'utf8');
      const importRegex = /(?:import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"])/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const source = match[1];
        if (source.startsWith('@/') || source.startsWith('.')) {
          let resolved = source.startsWith('@/')
            ? join('src', source.slice(2))
            : join(dirname(filePath), source);
          resolved = resolved.replace(/\\/g, '/');

          for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
            if (existsSync(join(ROOT, resolved + ext))) {
              walkImports(resolved + ext);
              break;
            }
          }
        }
      }
    } catch { /* skip */ }
  }

  walkImports(targetPath);

  // Group by layer
  const byLayer = {};
  for (const f of allFiles) {
    const cat = categorize(f);
    if (!byLayer[cat]) byLayer[cat] = [];
    byLayer[cat].push(f);
  }

  console.log(`📊 Feature spans ${Object.keys(byLayer).length} layers, ${allFiles.length} files:\n`);

  for (const layer of LAYER_ORDER) {
    if (!byLayer[layer]) continue;
    console.log(`  ${LAYER_EMOJI[layer]} ${layer.toUpperCase()} (${byLayer[layer].length} files):`);
    for (const f of byLayer[layer]) {
      console.log(`     ${f}`);
    }
    console.log('');
  }

  return byLayer;
}

// ─── Generate decomposition plan ────────────────────────────────────────────

function generatePlan(featureName, targetFiles) {
  const pascal = toPascalCase(featureName);
  const kebab = toKebabCase(featureName);

  console.log(`\n📋 Decomposition Plan: ${featureName}\n`);
  console.log('═'.repeat(60));

  // Detect which layers are needed
  const requestedLayers = new Set();
  for (const f of targetFiles) {
    requestedLayers.add(categorize(f));
  }

  // If no files specified, assume full-stack feature
  if (targetFiles.length === 0) {
    ['database', 'data', 'hook', 'component', 'page', 'navigation', 'i18n'].forEach(l => requestedLayers.add(l));
  }

  const tracks = [];
  let trackLetter = 'A';

  // Track A: Database (no deps)
  if (requestedLayers.has('database')) {
    tracks.push({
      id: trackLetter++,
      name: 'Database',
      emoji: '🗃️',
      deps: [],
      tasks: [
        `Create migration: supabase/migrations/YYYYMMDD_add_${kebab.replace(/-/g, '_')}.sql`,
        `Add Zod schema to src/data/rpc-contracts.ts`,
        `Run: npm run db:types`,
      ],
      verify: 'npm run db:lint',
      parallel: true,
    });
  }

  // Track B: i18n (no deps — can run parallel with A)
  if (requestedLayers.has('i18n')) {
    tracks.push({
      id: trackLetter++,
      name: 'Internationalization',
      emoji: '🌍',
      deps: [],
      tasks: [
        `Add keys to src/i18n/locales/en.json`,
        `Add keys to src/i18n/locales/es.json`,
      ],
      verify: 'npx tsc --noEmit',
      parallel: true,
    });
  }

  // Track C: Data Layer (deps: A)
  if (requestedLayers.has('data') || requestedLayers.has('hook')) {
    const depIds = tracks.filter(t => t.name === 'Database').map(t => t.id);
    tracks.push({
      id: trackLetter++,
      name: 'Data Layer',
      emoji: '📡',
      deps: depIds,
      tasks: [
        `Create data module: src/data/${kebab}.ts`,
        `Create hook: src/hooks/use${pascal}Data.ts`,
        `Add contract test in src/data/__tests__/`,
      ],
      verify: 'npx tsc --noEmit',
      parallel: false,
    });
  }

  // Track D: UI (deps: C)
  if (requestedLayers.has('component') || requestedLayers.has('page')) {
    const depIds = tracks.filter(t => t.name === 'Data Layer').map(t => t.id);
    tracks.push({
      id: trackLetter++,
      name: 'UI',
      emoji: '🧩',
      deps: depIds,
      tasks: [
        `Create page: src/pages/${pascal}.tsx (or use: npm run scaffold -- --name ${pascal} --type page)`,
        `Create components in src/components/${kebab}/`,
      ],
      verify: 'npx tsc --noEmit',
      parallel: false,
    });
  }

  // Track E: Navigation (deps: D)
  if (requestedLayers.has('navigation') || requestedLayers.has('page')) {
    const depIds = tracks.filter(t => t.name === 'UI').map(t => t.id);
    tracks.push({
      id: trackLetter++,
      name: 'Navigation & Wiring',
      emoji: '🧭',
      deps: depIds,
      tasks: [
        `Add lazy import to src/App.tsx`,
        `Add <Route> to src/App.tsx`,
        `Add sidebar item to src/components/layout/AppSidebar.tsx`,
      ],
      verify: 'npm run preflight:quick',
      parallel: false,
    });
  }

  // Track F: Quality (deps: all)
  tracks.push({
    id: trackLetter++,
    name: 'Quality & Deploy',
    emoji: '✅',
    deps: tracks.map(t => t.id),
    tasks: [
      'npm run preflight',
      'npm run health',
      'Manual smoke test in browser',
    ],
    verify: 'npm run preflight',
    parallel: false,
  });

  // Print the plan
  for (const track of tracks) {
    const depsStr = track.deps.length > 0 ? ` (depends on: ${track.deps.join(', ')})` : ' (no dependencies)';
    const parallelStr = track.parallel ? ' ⚡ PARALLELIZABLE' : '';
    console.log(`\n${track.emoji} Track ${track.id}: ${track.name}${depsStr}${parallelStr}`);
    console.log('─'.repeat(50));
    track.tasks.forEach((t, i) => {
      console.log(`  ${track.id}${i + 1}. ${t}`);
    });
    console.log(`  ✓  Verify: ${track.verify}`);
  }

  // Print dependency graph
  console.log('\n\n📊 Execution Graph:\n');

  const parallelTracks = tracks.filter(t => t.parallel && t.deps.length === 0);
  const sequentialTracks = tracks.filter(t => !t.parallel || t.deps.length > 0);

  if (parallelTracks.length > 1) {
    console.log('  ┌── ' + parallelTracks.map(t => `Track ${t.id} (${t.name})`).join(' ──┐\n  │── '));
    console.log('  └──┬──────────────────────────────────────┘');
    console.log('     │');
    for (const t of sequentialTracks) {
      if (t === sequentialTracks[sequentialTracks.length - 1]) {
        console.log(`     └── Track ${t.id} (${t.name})`);
      } else {
        console.log(`     ├── Track ${t.id} (${t.name})`);
      }
    }
  } else {
    tracks.forEach((t, i) => {
      const connector = i === tracks.length - 1 ? '└' : '├';
      console.log(`  ${connector}── Track ${t.id} (${t.name})`);
    });
  }

  // Print scaffold shortcut if applicable
  console.log('\n\n💡 Quick Start:');
  console.log(`  npm run scaffold -- --name ${pascal} --type page --section insights`);
  console.log('');

  return tracks;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  if (ANALYZE) {
    analyzeExistingFeature(ANALYZE);
    return;
  }

  if (!NAME) {
    console.log(`
📋 Task Decomposer — Break features into independent tracks

Usage:
  node scripts/decompose.mjs --name "Feature Name"
  node scripts/decompose.mjs --name "Feature" --files src/data/x.ts src/pages/X.tsx
  node scripts/decompose.mjs --analyze src/hooks/useSalesData.ts

Options:
  --name      Feature name (required for plan generation)
  --files     Specific files that will be created/modified
  --analyze   Analyze an existing file's dependency tree
`);
    return;
  }

  generatePlan(NAME, FILES);
}

main();
