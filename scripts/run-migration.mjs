/**
 * Execute SQL migration directly against Supabase using service_role key.
 * Splits the SQL into individual statements and runs them via RPC or REST.
 * Run with: node scripts/run-migration.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://qzrbvjklgorfoqersdpx.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cmJ2amtsZ29yZm9xZXJzZHB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI5NDYwMywiZXhwIjoyMDg1ODcwNjAzfQ.UgpxcrpVnrxaOlQHCcs4-5c4LABnHvFAysCbTrFLy3c';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('=== Running data cleanup and today partial data ===\n');

  // Step 1: Cleanup future actual data
  console.log('1. Cleaning up future actual data...');
  const today = new Date().toISOString().split('T')[0];

  const { error: e1 } = await supabase.from('pos_daily_finance').delete().gt('date', today);
  console.log('   pos_daily_finance cleanup:', e1 ? e1.message : 'OK');

  const { error: e2 } = await supabase.from('pos_daily_metrics').delete().gt('date', today);
  console.log('   pos_daily_metrics cleanup:', e2 ? e2.message : 'OK');

  const { error: e3 } = await supabase.from('labour_daily').delete().gt('date', today);
  console.log('   labour_daily cleanup:', e3 ? e3.message : 'OK');

  // Step 2: Generate today's partial actual data
  console.log('\n2. Generating today\'s partial actual data...');

  // Get today's forecast for all locations
  const { data: forecasts, error: fErr } = await supabase
    .from('forecast_daily_metrics')
    .select('location_id, forecast_sales, forecast_orders, planned_labor_cost, planned_labor_hours')
    .eq('date', today);

  if (fErr) { console.error('Error fetching forecasts:', fErr); process.exit(1); }
  console.log(`   Found ${forecasts.length} forecast rows for today`);

  // Calculate progress through business day (10am-11pm Madrid = 9am-10pm UTC)
  const now = new Date();
  const hourUTC = now.getUTCHours();
  const progress = Math.max(0.02, Math.min(1, (hourUTC - 9) / 13));
  console.log(`   Business day progress: ${(progress * 100).toFixed(0)}%`);

  // Generate partial actual data for pos_daily_finance
  const financeRows = forecasts.map(f => {
    const variance = 0.92 + Math.random() * 0.16;
    const netSales = Math.round(f.forecast_sales * progress * variance * 100) / 100;
    return {
      date: today,
      location_id: f.location_id,
      net_sales: netSales,
      gross_sales: Math.round(netSales * 1.05 * 100) / 100,
      orders_count: Math.round(f.forecast_orders * progress * variance),
      payments_cash: Math.round(netSales * 0.25 * 100) / 100,
      payments_card: Math.round(netSales * 0.70 * 100) / 100,
      payments_other: Math.round(netSales * 0.05 * 100) / 100,
      refunds_amount: Math.round(netSales * 0.005 * 100) / 100,
      refunds_count: 1,
      discounts_amount: Math.round(netSales * 0.03 * 100) / 100,
      comps_amount: Math.round(netSales * 0.01 * 100) / 100,
      voids_amount: Math.round(netSales * 0.008 * 100) / 100,
    };
  });

  if (financeRows.length > 0) {
    const { error: insErr } = await supabase
      .from('pos_daily_finance')
      .upsert(financeRows, { onConflict: 'date,location_id' });
    console.log('   pos_daily_finance insert:', insErr ? insErr.message : `OK (${financeRows.length} rows)`);
  }

  // Generate partial actual data for pos_daily_metrics
  const metricsRows = forecasts.map(f => {
    const variance = 0.92 + Math.random() * 0.16;
    return {
      date: today,
      location_id: f.location_id,
      net_sales: Math.round(f.forecast_sales * progress * variance * 100) / 100,
      orders: Math.round(f.forecast_orders * progress * variance),
      labor_hours: Math.round(f.planned_labor_hours * progress * (0.92 + Math.random() * 0.12) * 10) / 10,
      labor_cost: Math.round(f.planned_labor_cost * progress * (0.92 + Math.random() * 0.12) * 100) / 100,
    };
  });

  if (metricsRows.length > 0) {
    const { error: insErr } = await supabase
      .from('pos_daily_metrics')
      .upsert(metricsRows, { onConflict: 'date,location_id' });
    console.log('   pos_daily_metrics insert:', insErr ? insErr.message : `OK (${metricsRows.length} rows)`);
  }

  // Verify
  const { data: verify } = await supabase
    .from('pos_daily_finance')
    .select('date, location_id, net_sales')
    .eq('date', today);

  console.log('\n3. Verification - today\'s actual data:');
  for (const row of (verify || [])) {
    console.log(`   ${row.location_id}: €${row.net_sales}`);
  }

  console.log('\nDone! Data is clean and today has partial actual data.');
}

main().catch(console.error);
