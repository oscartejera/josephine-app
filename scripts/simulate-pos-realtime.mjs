/**
 * POS Simulator - Generates realistic restaurant transaction data for today.
 * Simulates what a real POS (Square, Toast) would send throughout the day.
 * 
 * Generates:
 * - pos_daily_finance (daily aggregates: sales, payments, refunds)
 * - pos_daily_metrics (daily metrics: sales, orders, labor)
 * - product_sales_daily (per-product sales for today)
 * - waste_events (random waste events throughout the day)
 * 
 * Run: node scripts/simulate-pos-realtime.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qzrbvjklgorfoqersdpx.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cmJ2amtsZ29yZm9xZXJzZHB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI5NDYwMywiZXhwIjoyMDg1ODcwNjAzfQ.UgpxcrpVnrxaOlQHCcs4-5c4LABnHvFAysCbTrFLy3c';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Business day progress (10am-11pm Madrid = 9am-10pm UTC)
function getDayProgress() {
  const now = new Date();
  const hourUTC = now.getUTCHours() + now.getUTCMinutes() / 60;
  return Math.max(0.02, Math.min(1, (hourUTC - 9) / 13));
}

async function main() {
  const today = new Date().toISOString().split('T')[0];
  const progress = getDayProgress();
  console.log(`=== POS Simulator for ${today} (${(progress * 100).toFixed(0)}% of business day) ===\n`);

  // 1. Get locations and forecast for today
  const { data: locations } = await supabase.from('locations').select('id, name');
  const { data: forecasts } = await supabase
    .from('forecast_daily_metrics')
    .select('location_id, forecast_sales, forecast_orders, planned_labor_cost, planned_labor_hours')
    .eq('date', today);

  if (!locations?.length || !forecasts?.length) {
    console.log('No locations or forecasts found. Run seed-future-forecast.mjs first.');
    return;
  }

  // 2. Get products for product_sales_daily
  const { data: products } = await supabase.from('products').select('id, name, category, price');
  console.log(`Found ${locations.length} locations, ${forecasts.length} forecasts, ${products?.length || 0} products\n`);

  // 3. Generate pos_daily_finance for each location
  const financeRows = [];
  const metricsRows = [];
  const productRows = [];

  for (const loc of locations) {
    const forecast = forecasts.find(f => f.location_id === loc.id);
    if (!forecast) continue;

    const variance = 0.92 + Math.random() * 0.16;
    const netSales = Math.round(forecast.forecast_sales * progress * variance * 100) / 100;
    const orders = Math.round(forecast.forecast_orders * progress * variance);
    const laborHours = Math.round(forecast.planned_labor_hours * progress * (0.92 + Math.random() * 0.12) * 10) / 10;
    const laborCost = Math.round(forecast.planned_labor_cost * progress * (0.92 + Math.random() * 0.12) * 100) / 100;

    financeRows.push({
      date: today,
      location_id: loc.id,
      net_sales: netSales,
      gross_sales: Math.round(netSales * 1.05 * 100) / 100,
      orders_count: orders,
      payments_cash: Math.round(netSales * 0.25 * 100) / 100,
      payments_card: Math.round(netSales * 0.70 * 100) / 100,
      payments_other: Math.round(netSales * 0.05 * 100) / 100,
      refunds_amount: Math.round(netSales * 0.005 * 100) / 100,
      refunds_count: Math.max(1, Math.round(orders * 0.02)),
      discounts_amount: Math.round(netSales * 0.03 * 100) / 100,
      comps_amount: Math.round(netSales * 0.01 * 100) / 100,
      voids_amount: Math.round(netSales * 0.008 * 100) / 100,
    });

    metricsRows.push({
      date: today,
      location_id: loc.id,
      net_sales: netSales,
      orders: orders,
      labor_hours: laborHours,
      labor_cost: laborCost,
    });

    // 4. Generate product_sales_daily - distribute sales across products
    if (products?.length) {
      let remainingSales = netSales;
      let remainingOrders = orders;

      // Shuffle products and distribute sales
      const shuffled = [...products].sort(() => Math.random() - 0.5);
      const numProducts = Math.min(shuffled.length, 8 + Math.floor(Math.random() * 8));

      for (let i = 0; i < numProducts && remainingSales > 0; i++) {
        const product = shuffled[i];
        // Each product gets a random share (roughly Pareto distributed)
        const share = i < 3 ? 0.15 + Math.random() * 0.10 : 0.02 + Math.random() * 0.08;
        const prodSales = Math.round(netSales * share * 100) / 100;
        const prodUnits = Math.max(1, Math.round(prodSales / (product.price || 15)));
        const prodCogs = Math.round(prodSales * (0.25 + Math.random() * 0.10) * 100) / 100;

        remainingSales -= prodSales;

        productRows.push({
          date: today,
          location_id: loc.id,
          product_id: product.id,
          units_sold: prodUnits,
          net_sales: prodSales,
          cogs: prodCogs,
        });
      }
    }

    console.log(`  ${loc.name}: €${netSales.toFixed(0)} sales, ${orders} orders, ${laborHours}h labor`);
  }

  // 5. Upsert pos_daily_finance
  const { error: e1 } = await supabase.from('pos_daily_finance').upsert(financeRows, { onConflict: 'date,location_id' });
  console.log('\npos_daily_finance:', e1 ? e1.message : `OK (${financeRows.length} rows)`);

  // 6. Upsert pos_daily_metrics
  const { error: e2 } = await supabase.from('pos_daily_metrics').upsert(metricsRows, { onConflict: 'date,location_id' });
  console.log('pos_daily_metrics:', e2 ? e2.message : `OK (${metricsRows.length} rows)`);

  // 7. Upsert product_sales_daily (delete today's first, then insert)
  if (productRows.length > 0) {
    await supabase.from('product_sales_daily').delete().eq('date', today);
    const { error: e3 } = await supabase.from('product_sales_daily').insert(productRows);
    console.log('product_sales_daily:', e3 ? e3.message : `OK (${productRows.length} rows)`);
  }

  // 8. Generate a few waste events for today
  const { data: items } = await supabase.from('inventory_items').select('id').limit(10);
  if (items?.length) {
    const reasons = ['Broken', 'End of day', 'Expired', 'Theft', 'Other'];
    const wasteRows = [];
    for (const loc of locations) {
      const numWaste = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < numWaste; i++) {
        const item = items[Math.floor(Math.random() * items.length)];
        const hour = 10 + Math.floor(Math.random() * Math.min(12, progress * 13));
        const min = Math.floor(Math.random() * 60);
        wasteRows.push({
          location_id: loc.id,
          inventory_item_id: item.id,
          quantity: Math.round((0.5 + Math.random() * 3) * 10) / 10,
          waste_value: Math.round((2 + Math.random() * 20) * 100) / 100,
          reason: reasons[Math.floor(Math.random() * reasons.length)],
          created_at: `${today}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00+00:00`,
        });
      }
    }
    // Delete today's waste first, then insert fresh
    await supabase.from('waste_events').delete().gte('created_at', `${today}T00:00:00`).lte('created_at', `${today}T23:59:59`);
    const { error: e4 } = await supabase.from('waste_events').insert(wasteRows);
    console.log('waste_events:', e4 ? e4.message : `OK (${wasteRows.length} rows)`);
  }

  console.log('\nDone! POS data simulated for today.');
}

main().catch(console.error);
