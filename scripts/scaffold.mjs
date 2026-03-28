#!/usr/bin/env node
/**
 * Feature Scaffold Generator — Josephine
 *
 * Generates boilerplate files for new features following established patterns.
 *
 * Usage:
 *   node scripts/scaffold.mjs --name StockAudit --type page --section insights
 *   node scripts/scaffold.mjs --name useStockAudit --type hook
 *   node scripts/scaffold.mjs --name StockTable --type component --folder inventory
 *   node scripts/scaffold.mjs --list                  # list available types
 *
 * Options:
 *   --name      Component/hook/page name (PascalCase or camelCase)
 *   --type      page | hook | component | data
 *   --section   Route section: insights | operations | workforce | settings (for pages)
 *   --folder    Component folder name (for components)
 *   --dry-run   Show what would be created without writing files
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

const NAME = getArg('name');
const TYPE = getArg('type');
const SECTION = getArg('section') || 'insights';
const FOLDER = getArg('folder');
const DRY_RUN = args.includes('--dry-run');
const LIST = args.includes('--list');

// ─── Helpers ────────────────────────────────────────────────────────────────

function toPascalCase(str) {
  return str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase());
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function writeFile(path, content) {
  const relPath = path.replace(ROOT + '\\', '').replace(ROOT + '/', '');
  if (existsSync(path)) {
    console.log(`  ⏭️  SKIP (exists): ${relPath}`);
    return;
  }
  if (DRY_RUN) {
    console.log(`  📝 Would create: ${relPath}`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
  console.log(`  ✅ Created: ${relPath}`);
}

// ─── Templates ──────────────────────────────────────────────────────────────

function generatePage(name, section) {
  const componentName = toPascalCase(name);
  const hookName = `use${componentName}Data`;
  const kebab = toKebabCase(name);

  // Determine route path
  const routeMap = {
    insights: `/insights/${kebab}`,
    operations: `/operations/${kebab}`,
    workforce: `/workforce/${kebab}`,
    settings: `/settings/${kebab}`,
  };
  const route = routeMap[section] || `/${kebab}`;

  const pageContent = `/**
 * ${componentName} Page
 * Route: ${route}
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useApp } from '@/contexts/AppContext';

export default function ${componentName}() {
  const { t } = useTranslation();
  const { loading: appLoading } = useApp();

  // TODO: Add data hook here
  // const { data, isLoading, isError } = ${hookName}();
  const isLoading = false;

  if (appLoading || isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-[1800px]">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-[1800px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">
          {t('${toCamelCase(name)}.title', '${componentName}')}
        </h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-normal text-gray-700">KPI 1</h3>
          <div className="text-3xl font-bold text-gray-900 mt-2">—</div>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-normal text-gray-700">KPI 2</h3>
          <div className="text-3xl font-bold text-gray-900 mt-2">—</div>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-normal text-gray-700">KPI 3</h3>
          <div className="text-3xl font-bold text-gray-900 mt-2">—</div>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="p-6">
        <p className="text-muted-foreground">
          TODO: Add ${componentName} content here
        </p>
      </Card>
    </div>
  );
}
`;

  const hookContent = `/**
 * ${hookName} — Data hook for ${componentName} page
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';

interface ${componentName}Data {
  // TODO: Define data shape
}

export function ${hookName}() {
  const { currentOrganization, selectedLocationId } = useApp();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: ['${kebab}', orgId, selectedLocationId],
    queryFn: async (): Promise<${componentName}Data> => {
      if (!orgId) throw new Error('No organization');

      // TODO: Implement data fetching
      // const { data, error } = await supabase.rpc('get_${kebab.replace(/-/g, '_')}', {
      //   p_org_id: orgId,
      //   p_location_id: selectedLocationId === 'all' ? null : selectedLocationId,
      // });
      // if (error) throw error;
      // return data;

      return {} as ${componentName}Data;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}
`;

  const testContent = `/**
 * ${componentName} — Tests
 */

import { describe, it, expect } from 'vitest';

describe('${componentName}', () => {
  it('should have a valid data shape', () => {
    // TODO: Add tests
    expect(true).toBe(true);
  });
});
`;

  return [
    { path: join(SRC, 'pages', componentName + '.tsx'), content: pageContent },
    { path: join(SRC, 'hooks', hookName + '.ts'), content: hookContent },
    { path: join(SRC, 'pages', '__tests__', componentName + '.test.ts'), content: testContent },
  ];
}

function generateHook(name) {
  const hookName = name.startsWith('use') ? name : `use${toPascalCase(name)}`;
  const pascalName = hookName.replace(/^use/, '');

  const content = `/**
 * ${hookName} — Custom hook
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';

interface ${pascalName}Data {
  // TODO: Define data shape
}

export function ${hookName}() {
  const { currentOrganization } = useApp();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: ['${toKebabCase(pascalName)}', orgId],
    queryFn: async (): Promise<${pascalName}Data> => {
      if (!orgId) throw new Error('No organization');

      // TODO: Implement data fetching
      return {} as ${pascalName}Data;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}
`;

  return [
    { path: join(SRC, 'hooks', hookName + '.ts'), content },
  ];
}

function generateComponent(name, folder) {
  const componentName = toPascalCase(name);
  const folderName = folder || toKebabCase(name);

  const content = `/**
 * ${componentName} Component
 */

import { Card } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

interface ${componentName}Props {
  // TODO: Define props
}

export function ${componentName}({}: ${componentName}Props) {
  const { t } = useTranslation();

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">
        {t('${toCamelCase(name)}.title', '${componentName}')}
      </h3>
      <div>
        {/* TODO: Implement ${componentName} */}
      </div>
    </Card>
  );
}
`;

  return [
    { path: join(SRC, 'components', folderName, componentName + '.tsx'), content },
  ];
}

function generateDataModule(name) {
  const moduleName = toKebabCase(name);
  const typeName = toPascalCase(name);

  const content = `/**
 * ${typeName} data module — Supabase queries and types
 */

import { supabase } from '@/integrations/supabase/client';

export interface ${typeName}Row {
  // TODO: Define row shape matching DB
}

export async function fetch${typeName}(orgId: string, locationId?: string | null) {
  const params: Record<string, unknown> = { p_org_id: orgId };
  if (locationId) params.p_location_id = locationId;

  // TODO: Implement RPC call
  // const { data, error } = await supabase.rpc('get_${moduleName.replace(/-/g, '_')}', params);
  // if (error) throw error;
  // return data as ${typeName}Row[];

  return [] as ${typeName}Row[];
}
`;

  const testContent = `/**
 * ${typeName} data module — Tests
 */

import { describe, it, expect } from 'vitest';

describe('${moduleName} data', () => {
  it('should export fetch function', async () => {
    // TODO: Add meaningful tests
    expect(true).toBe(true);
  });
});
`;

  return [
    { path: join(SRC, 'data', moduleName + '.ts'), content },
    { path: join(SRC, 'data', '__tests__', moduleName + '.test.ts'), content: testContent },
  ];
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  if (LIST) {
    console.log(`
🏗️  Josephine Scaffold — Available Types

  page        Full page with route, hook, and test skeleton
              Options: --section (insights|operations|workforce|settings)

  hook        Custom React Query hook
              Auto-prefixes with 'use' if missing

  component   UI component in components/ folder
              Options: --folder (target subfolder)

  data        Data module in src/data/ with test
              Creates typed fetch function

Usage examples:
  node scripts/scaffold.mjs --name StockAudit --type page --section operations
  node scripts/scaffold.mjs --name usePayrollSummary --type hook
  node scripts/scaffold.mjs --name CostBreakdownChart --type component --folder cost
  node scripts/scaffold.mjs --name reconciliation --type data
`);
    return;
  }

  if (!NAME || !TYPE) {
    console.log('❌ Missing required arguments: --name and --type');
    console.log('   Run with --list to see available types');
    process.exit(1);
  }

  console.log(`\n🏗️  Scaffolding ${TYPE}: ${NAME}`);
  console.log('─'.repeat(40));

  let files;
  switch (TYPE) {
    case 'page':
      files = generatePage(NAME, SECTION);
      break;
    case 'hook':
      files = generateHook(NAME);
      break;
    case 'component':
      files = generateComponent(NAME, FOLDER);
      break;
    case 'data':
      files = generateDataModule(NAME);
      break;
    default:
      console.log(`❌ Unknown type: ${TYPE}. Run with --list to see options.`);
      process.exit(1);
  }

  for (const { path, content } of files) {
    writeFile(path, content);
  }

  console.log('');

  if (TYPE === 'page') {
    console.log('📋 Next steps:');
    console.log(`   1. Add route to src/App.tsx:`);
    console.log(`      <Route path="/${SECTION}/${toKebabCase(NAME)}" element={...} />`);
    console.log(`   2. Add sidebar item if needed`);
    console.log(`   3. Implement the data hook`);
    console.log(`   4. Add i18n keys`);
  } else if (TYPE === 'hook') {
    console.log('📋 Next steps:');
    console.log(`   1. Define the data interface`);
    console.log(`   2. Implement the RPC/query call`);
    console.log(`   3. Import in the consuming page/component`);
  } else if (TYPE === 'data') {
    console.log('📋 Next steps:');
    console.log(`   1. Define the row interface matching DB schema`);
    console.log(`   2. Implement the RPC call`);
    console.log(`   3. Add Zod schema to src/data/rpc-contracts.ts`);
    console.log(`   4. Register in RPC_REGISTRY`);
  }

  console.log('');
}

main();
