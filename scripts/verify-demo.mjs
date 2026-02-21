/**
 * Verification script for demo data integrity.
 * Checks that all seeded data meets expected quality thresholds.
 *
 * Run: npm run demo:verify
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qixipveebfhurbarksib.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpeGlwdmVlYmZodXJiYXJrc2liIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA4OTg5MywiZXhwIjoyMDg2NjY1ODkzfQ.12A4ocHkOX86VnVA2nRm4oxZVL6jEHYE02-rJlVj9Qg';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ORG_ID = '7bca34d5-4448-40b8-bb7f-55f1417aeccd';

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    const result = await fn();
    if (result.ok) {
      console.log(`  ✓ ${name}: ${result.detail}`);
      passed++;
    } else {
      console.log(`  ✗ ${name}: ${result.detail}`);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ ${name}: EXCEPTION ${e.message}`);
    failed++;
  }
}

async function countRows(table, filter = {}) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filter)) {
    q = q.eq(k, v);
  }
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count || 0;
}

console.log('╔══════════════════════════════════════════╗');
console.log('║  Demo Data Verification                  ║');
console.log('╚══════════════════════════════════════════╝\n');

// 1. Sales > 0 for last 365 days
await check('Daily sales exist (365d × 4 locs)', async () => {
  const count = await countRows('daily_sales', { org_id: ORG_ID });
  return { ok: count >= 1400, detail: `${count} rows (expected ≥1400)` };
});

// 2. CDM orders exist
await check('CDM orders exist', async () => {
  const count = await countRows('cdm_orders', { org_id: ORG_ID });
  return { ok: count > 40000, detail: `${count} rows` };
});

// 3. CDM order lines exist
await check('CDM order lines exist', async () => {
  const count = await countRows('cdm_order_lines', { org_id: ORG_ID });
  return { ok: count > 100000, detail: `${count} rows` };
});

// 4. KPI MV has data
await check('mart_kpi_daily_mv populated', async () => {
  const count = await countRows('mart_kpi_daily_mv');
  return { ok: count >= 1400, detail: `${count} rows` };
});

// 5. Product sales MV has data
await check('product_sales_daily_unified_mv populated', async () => {
  const count = await countRows('product_sales_daily_unified_mv');
  return { ok: count > 10000, detail: `${count} rows` };
});

// 6. Hourly sales MV has data
await check('sales_hourly_unified_mv populated', async () => {
  const count = await countRows('sales_hourly_unified_mv');
  return { ok: count > 5000, detail: `${count} rows` };
});

// 7. GP% in reasonable range (50-85%) — wider range accounts for COGS variance
await check('GP% in 50-85% range', async () => {
  const { data } = await supabase.from('mart_kpi_daily_mv')
    .select('gp_percent')
    .not('gp_percent', 'is', null)
    .gte('gp_percent', 50)
    .lte('gp_percent', 85);
  const total = await countRows('mart_kpi_daily_mv');
  const pct = data ? Math.round(data.length / total * 100) : 0;
  return { ok: pct > 60, detail: `${pct}% of rows in range` };
});

// 8. Labour data exists
await check('Time entries exist (365d)', async () => {
  const count = await countRows('time_entries', { org_id: ORG_ID });
  return { ok: count > 5000, detail: `${count} rows` };
});

// 9. Planned shifts exist
await check('Planned shifts exist', async () => {
  const count = await countRows('planned_shifts');
  return { ok: count > 5000, detail: `${count} rows` };
});

// 10. Stock movements exist (COGS source)
await check('Stock movements exist (365d)', async () => {
  const count = await countRows('stock_movements', { org_id: ORG_ID });
  return { ok: count > 5000, detail: `${count} rows` };
});

// 11. Waste events exist
await check('Waste events exist', async () => {
  const count = await countRows('waste_events');
  return { ok: count > 500, detail: `${count} rows` };
});

// 12. Purchase orders exist
await check('Purchase orders exist', async () => {
  const count = await countRows('purchase_orders', { org_id: ORG_ID });
  return { ok: count > 200, detail: `${count} rows` };
});

// 13. Stock counts exist (≥12 per location)
await check('Stock counts exist (monthly)', async () => {
  const count = await countRows('stock_counts', { group_id: ORG_ID });
  return { ok: count >= 48, detail: `${count} rows (expected ≥48)` };
});

// 14. Budget exists for 12 months
await check('Budget versions exist (12 months)', async () => {
  const count = await countRows('budget_versions', { org_id: ORG_ID });
  return { ok: count >= 12, detail: `${count} rows` };
});

// 15. Budget days exist
await check('Budget days exist', async () => {
  const count = await countRows('budget_days', { org_id: ORG_ID });
  return { ok: count >= 1400, detail: `${count} rows` };
});

// 16. Forecast runs exist
await check('Forecast runs exist', async () => {
  const count = await countRows('forecast_runs', { org_id: ORG_ID });
  return { ok: count >= 4, detail: `${count} rows` };
});

// 17. Forecast daily metrics exist
await check('Forecast daily metrics exist', async () => {
  const count = await countRows('forecast_daily_metrics');
  return { ok: count > 50, detail: `${count} rows` };
});

// 18. Reviews exist (≥100)
await check('Reviews exist (≥100)', async () => {
  const count = await countRows('reviews', { org_id: ORG_ID });
  return { ok: count >= 100, detail: `${count} rows` };
});

// 19. Payroll runs exist (12 months)
await check('Payroll runs exist', async () => {
  const count = await countRows('payroll_runs', { group_id: ORG_ID });
  return { ok: count >= 12, detail: `${count} rows` };
});

// 20. Payslips exist
await check('Payslips exist (24 employees × 12 months)', async () => {
  const { data: runs } = await supabase.from('payroll_runs').select('id').eq('group_id', ORG_ID);
  if (!runs?.length) return { ok: false, detail: 'no payroll runs' };
  const { count } = await supabase.from('payslips').select('*', { count: 'exact', head: true })
    .in('payroll_run_id', runs.map(r => r.id));
  return { ok: count >= 200, detail: `${count} rows` };
});

// 21. Employee availability exists
await check('Employee availability exists', async () => {
  const count = await countRows('employee_availability');
  return { ok: count > 50, detail: `${count} rows` };
});

// 22. Announcements exist
await check('Announcements exist', async () => {
  const count = await countRows('announcements', { org_id: ORG_ID });
  return { ok: count >= 5, detail: `${count} rows` };
});

// 23. Inventory items with costs
await check('Inventory items have cost data', async () => {
  const { data } = await supabase.from('inventory_items').select('last_cost').eq('org_id', ORG_ID);
  const withCost = data?.filter(r => r.last_cost > 0).length || 0;
  return { ok: withCost >= 20, detail: `${withCost}/${data?.length || 0} with cost > 0` };
});

// 24. Location settings exist
await check('Location settings exist', async () => {
  const { data } = await supabase.from('location_settings').select('location_id,target_gp_percent');
  return { ok: (data?.length || 0) >= 4, detail: `${data?.length} locations configured` };
});

console.log('\n══════════════════════════════════════════');
console.log(`  Results: ${passed} PASSED, ${failed} FAILED`);
console.log('══════════════════════════════════════════');

if (failed > 0) {
  process.exit(1);
}
