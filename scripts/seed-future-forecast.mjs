/**
 * Seed forecast_daily_metrics for the next 30 days from today.
 * Uses the service_role key to bypass RLS.
 * Run with: node scripts/seed-future-forecast.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qzrbvjklgorfoqersdpx.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cmJ2amtsZ29yZm9xZXJzZHB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI5NDYwMywiZXhwIjoyMDg1ODcwNjAzfQ.UgpxcrpVnrxaOlQHCcs4-5c4LABnHvFAysCbTrFLy3c';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const DOW_MULTIPLIERS = {
  0: 1.10, // Sunday
  1: 0.80, // Monday
  2: 0.92, // Tuesday
  3: 0.95, // Wednesday
  4: 1.00, // Thursday
  5: 1.35, // Friday
  6: 1.45, // Saturday
};

async function main() {
  console.log('Fetching locations...');
  const { data: locations, error: locErr } = await supabase
    .from('locations')
    .select('id, name');

  if (locErr) { console.error('Error fetching locations:', locErr); process.exit(1); }
  console.log(`Found ${locations.length} locations`);

  // Get average forecast metrics per location from the last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const todayStr = today.toISOString().split('T')[0];
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  console.log(`Fetching historical forecast data from ${thirtyDaysAgoStr} to ${todayStr}...`);
  const { data: historical, error: histErr } = await supabase
    .from('forecast_daily_metrics')
    .select('location_id, forecast_sales, forecast_orders, planned_labor_cost, planned_labor_hours')
    .gte('date', thirtyDaysAgoStr)
    .lt('date', todayStr);

  if (histErr) { console.error('Error fetching historical:', histErr); process.exit(1); }
  console.log(`Found ${historical.length} historical forecast rows`);

  // Calculate averages per location
  const avgByLocation = {};
  for (const row of historical) {
    if (!avgByLocation[row.location_id]) {
      avgByLocation[row.location_id] = { count: 0, sales: 0, orders: 0, cost: 0, hours: 0 };
    }
    const a = avgByLocation[row.location_id];
    a.count++;
    a.sales += row.forecast_sales || 0;
    a.orders += row.forecast_orders || 0;
    a.cost += row.planned_labor_cost || 0;
    a.hours += row.planned_labor_hours || 0;
  }

  for (const [locId, a] of Object.entries(avgByLocation)) {
    a.sales /= a.count;
    a.orders /= a.count;
    a.cost /= a.count;
    a.hours /= a.count;
  }

  // Generate forecast for next 30 days
  const rows = [];
  for (let i = 0; i <= 30; i++) {
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + i);
    const dateStr = futureDate.toISOString().split('T')[0];
    const dow = futureDate.getDay();
    const mult = DOW_MULTIPLIERS[dow];

    for (const location of locations) {
      const avg = avgByLocation[location.id];
      if (!avg) continue; // Skip locations with no historical data

      const variance = 0.95 + Math.random() * 0.10;
      rows.push({
        date: dateStr,
        location_id: location.id,
        forecast_sales: Math.round(avg.sales * mult * variance * 100) / 100,
        forecast_orders: Math.round(avg.orders * mult * variance),
        planned_labor_cost: Math.round(avg.cost * mult * variance * 100) / 100,
        planned_labor_hours: Math.round(avg.hours * mult * variance * 10) / 10,
        model_version: 'LR+SI v3 forecast',
      });
    }
  }

  console.log(`Inserting ${rows.length} forecast rows for future dates...`);

  // Insert in batches of 100
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error: insertErr } = await supabase
      .from('forecast_daily_metrics')
      .upsert(batch, { onConflict: 'date,location_id', ignoreDuplicates: true });

    if (insertErr) {
      console.error(`Error inserting batch ${i / 100 + 1}:`, insertErr);
    }
  }

  // Also seed budgets_daily for future dates
  const budgetRows = [];
  const { data: histBudgets } = await supabase
    .from('budgets_daily')
    .select('location_id, budget_sales, budget_labour, budget_cogs')
    .gte('date', thirtyDaysAgoStr)
    .lt('date', todayStr);

  const budgetAvgByLocation = {};
  for (const row of (histBudgets || [])) {
    if (!budgetAvgByLocation[row.location_id]) {
      budgetAvgByLocation[row.location_id] = { count: 0, sales: 0, labour: 0, cogs: 0 };
    }
    const a = budgetAvgByLocation[row.location_id];
    a.count++;
    a.sales += row.budget_sales || 0;
    a.labour += row.budget_labour || 0;
    a.cogs += row.budget_cogs || 0;
  }

  for (const [locId, a] of Object.entries(budgetAvgByLocation)) {
    a.sales /= a.count;
    a.labour /= a.count;
    a.cogs /= a.count;
  }

  for (let i = 0; i <= 30; i++) {
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + i);
    const dateStr = futureDate.toISOString().split('T')[0];
    const dow = futureDate.getDay();
    const mult = DOW_MULTIPLIERS[dow];

    for (const location of locations) {
      const avg = budgetAvgByLocation[location.id];
      if (!avg) continue;

      budgetRows.push({
        date: dateStr,
        location_id: location.id,
        budget_sales: Math.round(avg.sales * mult * 100) / 100,
        budget_labour: Math.round(avg.labour * mult * 100) / 100,
        budget_cogs: Math.round(avg.cogs * mult * 100) / 100,
      });
    }
  }

  if (budgetRows.length > 0) {
    console.log(`Inserting ${budgetRows.length} budget rows for future dates...`);
    for (let i = 0; i < budgetRows.length; i += 100) {
      const batch = budgetRows.slice(i, i + 100);
      const { error: insertErr } = await supabase
        .from('budgets_daily')
        .upsert(batch, { onConflict: 'date,location_id', ignoreDuplicates: true });

      if (insertErr) {
        console.error(`Error inserting budget batch:`, insertErr);
      }
    }
  }

  // Verify
  const { data: verify } = await supabase
    .from('forecast_daily_metrics')
    .select('date, location_id')
    .gte('date', todayStr)
    .order('date')
    .limit(5);

  console.log('\nVerification - first 5 future forecast rows:', verify);
  console.log('\nDone! Future forecast data seeded successfully.');
}

main().catch(console.error);
