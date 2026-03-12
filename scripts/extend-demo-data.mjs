/**
 * Extend demo data to current date — fills gaps in daily_sales + pos_daily_products
 * 
 * Usage: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/extend-demo-data.mjs
 * 
 * This script:
 * 1. Gets the latest row per location from daily_sales and clones it with jitter for missing days
 * 2. Gets the latest products per location from pos_daily_products and clones them for missing days
 * 3. Does NOT touch views — only writes to base tables
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qixipveebfhurbarksib.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const jitter = () => 0.85 + Math.random() * 0.3; // 85-115%
const today = new Date().toISOString().split('T')[0];

function datesFrom(lastDate, endDate) {
    const dates = [];
    let d = new Date(lastDate);
    d.setDate(d.getDate() + 1);
    const end = new Date(endDate);
    while (d <= end) {
        dates.push(d.toISOString().split('T')[0]);
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        d = next;
    }
    return dates;
}

async function extendDailySales() {
    console.log('--- Extending daily_sales ---');
    const { data: latest } = await supabase
        .from('daily_sales')
        .select('*')
        .order('day', { ascending: false })
        .limit(100);

    if (!latest?.length) { console.log('  No daily_sales data found.'); return; }

    const byLoc = {};
    for (const row of latest) {
        if (!byLoc[row.location_id]) byLoc[row.location_id] = row;
    }

    let inserted = 0;
    for (const [locId, t] of Object.entries(byLoc)) {
        for (const dateStr of datesFrom(t.day, today)) {
            const { error } = await supabase.from('daily_sales').insert({
                org_id: t.org_id, location_id: t.location_id, day: dateStr,
                net_sales: Math.round(Number(t.net_sales || 2500) * jitter() * 100) / 100,
                gross_sales: Math.round(Number(t.gross_sales || 3000) * jitter() * 100) / 100,
                orders_count: Math.max(1, Math.round(Number(t.orders_count || 35) * jitter())),
                payments_cash: Math.round(Number(t.payments_cash || 500) * jitter() * 100) / 100,
                payments_card: Math.round(Number(t.payments_card || 2000) * jitter() * 100) / 100,
                payments_total: Math.round(Number(t.payments_total || 2500) * jitter() * 100) / 100,
                tax: Math.round(Number(t.tax || 300) * jitter() * 100) / 100,
                discounts: Math.round(Number(t.discounts || 50) * jitter() * 100) / 100,
                tips: Math.round(Number(t.tips || 100) * jitter() * 100) / 100,
                refunds: 0, comps: 0, voids: 0,
            });
            if (!error) inserted++;
            else if (!error.message?.includes('duplicate')) console.error(`  [daily_sales] ${dateStr} ${locId.slice(0, 8)}: ${error.message}`);
        }
    }
    console.log(`  ✅ Inserted ${inserted} sales rows`);
}

async function extendProductSales() {
    console.log('--- Extending pos_daily_products ---');

    // Get distinct location_ids
    const { data: locRows } = await supabase
        .from('pos_daily_products')
        .select('location_id')
        .limit(1000);

    const locIds = [...new Set((locRows || []).map(r => r.location_id))];
    console.log(`  Found ${locIds.length} locations with product data`);

    let inserted = 0;
    for (const locId of locIds) {
        // Get the latest day's products for this location
        const { data: maxDateRow } = await supabase
            .from('pos_daily_products')
            .select('date')
            .eq('location_id', locId)
            .order('date', { ascending: false })
            .limit(1);

        if (!maxDateRow?.length) continue;
        const maxDate = maxDateRow[0].date;

        // Get all products for that day
        const { data: products } = await supabase
            .from('pos_daily_products')
            .select('*')
            .eq('location_id', locId)
            .eq('date', maxDate);

        if (!products?.length) continue;

        // Clone each product for each missing day
        for (const dateStr of datesFrom(maxDate, today)) {
            for (const p of products) {
                const { error } = await supabase.from('pos_daily_products').insert({
                    group_id: p.group_id,
                    location_id: p.location_id,
                    date: dateStr,
                    data_source: p.data_source || 'demo',
                    product_id: p.product_id,
                    product_name: p.product_name,
                    product_category: p.product_category,
                    units_sold: Math.max(1, Math.round(Number(p.units_sold || 5) * jitter())),
                    gross_sales: Math.round(Number(p.gross_sales || 50) * jitter() * 100) / 100,
                    net_sales: Math.round(Number(p.net_sales || 45) * jitter() * 100) / 100,
                    cogs: Math.round(Number(p.cogs || 15) * jitter() * 100) / 100,
                });
                if (!error) inserted++;
                else if (!error.message?.includes('duplicate')) {
                    console.error(`  [products] ${dateStr} ${p.product_name}: ${error.message}`);
                    break; // Don't flood on repeated errors 
                }
            }
        }
    }
    console.log(`  ✅ Inserted ${inserted} product rows`);
}

async function verify() {
    console.log('\n--- Verification ---');
    const { data: sales } = await supabase
        .from('sales_daily_unified')
        .select('date, net_sales, orders_count')
        .gte('date', '2026-03-11')
        .order('date', { ascending: false })
        .limit(8);
    console.log('Recent daily sales:');
    sales?.forEach(r => console.log(`  ${r.date}: €${r.net_sales} (${r.orders_count} orders)`));

    const { data: products } = await supabase
        .from('product_sales_daily_unified')
        .select('day, product_name, units_sold, net_sales')
        .gte('day', '2026-03-11')
        .order('day', { ascending: false })
        .limit(10);
    console.log('Recent product sales:');
    products?.forEach(r => console.log(`  ${r.day}: ${r.product_name} × ${r.units_sold} = €${r.net_sales}`));
}

async function main() {
    await extendDailySales();
    await extendProductSales();
    await verify();
    console.log('\nDone! Refresh the dashboard.');
}

main().catch(console.error);
