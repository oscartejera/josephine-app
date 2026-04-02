const fs = require('fs');
const path = require('path');

// Tables/views that exist in our generated types and don't need 'as any'
const KNOWN_TABLES = [
  'sales_daily_unified',
  'menu_engineering_actions', 
  'inventory_counts',
  'mart_sales_category_daily',
  'product_sales_daily_unified',
  'budget_daily_unified',
  'labour_daily_unified',
  'forecast_daily_unified',
  'org_settings',
  'tip_distribution_rules',
  'tip_entries',
  'monthly_cost_entries',
];

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

let totalFixed = 0;
let totalReplacements = 0;

for (const file of walk(path.join(process.cwd(), 'src'))) {
  let content = fs.readFileSync(file, 'utf8');
  const orig = content;

  // Fix 1: Remove 'table_name' as any → 'table_name' for known tables
  for (const table of KNOWN_TABLES) {
    content = content.replace(new RegExp(`'${table}' as any`, 'g'), `'${table}'`);
  }

  // Fix 2: Remove (supabase as any)\n  .from( → supabase\n  .from(
  // for tables that exist in types
  content = content.replace(/\(supabase as any\)\s*\n(\s*)\.from\(/g, (match, indent) => {
    return `supabase\n${indent}.from(`;
  });
  
  // Fix 3: Remove (supabase as any)\n   .from(' for known tables on same line
  content = content.replace(/\(supabase as any\)\.from\(/g, 'supabase.from(');

  // Fix 4: (supabase.rpc as any)('name' → supabase.rpc('name' for known RPCs
  content = content.replace(/\(supabase\.rpc as any\)\(/g, 'supabase.rpc(');

  if (content !== orig) {
    const count = (orig.match(/as any/g) || []).length - (content.match(/as any/g) || []).length;
    totalReplacements += count;
    totalFixed++;
    fs.writeFileSync(file, content);
    console.log(`FIXED: ${path.relative(process.cwd(), file)} (-${count} as any)`);
  }
}

console.log(`\nTotal files fixed: ${totalFixed}`);
console.log(`Total 'as any' removed: ${totalReplacements}`);
