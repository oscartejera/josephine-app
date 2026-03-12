/**
 * Seed: extend demo data to current date
 * Uses base tables: daily_sales + labour_daily_unified
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qixipveebfhurbarksib.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    const today = new Date().toISOString().split('T')[0];
    const jitter = () => 0.85 + Math.random() * 0.3;

    // 1. Extend daily_sales (base table for sales_daily_unified view)
    const { data: latestSales } = await supabase
        .from('daily_sales')
        .select('*')
        .order('day', { ascending: false })
        .limit(100);

    if (!latestSales?.length) { console.log('No sales data found.'); return; }

    const salesByLoc = {};
    for (const row of latestSales) {
        if (!salesByLoc[row.location_id]) salesByLoc[row.location_id] = row;
    }

    let salesInserted = 0;
    for (const [locId, t] of Object.entries(salesByLoc)) {
        let d = new Date(t.day);
        d.setDate(d.getDate() + 1);
        const end = new Date(today);

        while (d <= end) {
            const dateStr = d.toISOString().split('T')[0];
            const row = {
                org_id: t.org_id,
                location_id: t.location_id,
                day: dateStr,
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
            };
            const { error } = await supabase.from('daily_sales').insert(row);
            if (!error) salesInserted++;
            else if (!error.message?.includes('duplicate')) console.error(`  Sales ${dateStr} ${locId.slice(0, 8)}: ${error.message}`);
            d.setDate(d.getDate() + 1);
        }
    }
    console.log(`✅ Sales: inserted ${salesInserted} rows`);

    // 2. Extend labour_daily_unified
    const { data: latestLabour } = await supabase
        .from('labour_daily_unified')
        .select('*')
        .order('day', { ascending: false })
        .limit(100);

    if (latestLabour?.length) {
        const labByLoc = {};
        for (const row of latestLabour) {
            if (!labByLoc[row.location_id]) labByLoc[row.location_id] = row;
        }

        let labInserted = 0;
        for (const [locId, t] of Object.entries(labByLoc)) {
            let d = new Date(t.day);
            d.setDate(d.getDate() + 1);
            const end = new Date(today);
            while (d <= end) {
                const dateStr = d.toISOString().split('T')[0];
                const { error } = await supabase.from('labour_daily_unified').insert({
                    org_id: t.org_id,
                    location_id: t.location_id,
                    day: dateStr,
                    actual_cost: Math.round(Number(t.actual_cost || 800) * jitter() * 100) / 100,
                    actual_hours: Math.round(Number(t.actual_hours || 40) * jitter() * 100) / 100,
                    scheduled_hours: Math.round(Number(t.scheduled_hours || 40) * jitter() * 100) / 100,
                    scheduled_cost: Math.round(Number(t.scheduled_cost || 800) * jitter() * 100) / 100,
                    scheduled_headcount: t.scheduled_headcount || 5,
                });
                if (!error) labInserted++;
                else if (!error.message?.includes('duplicate') && !error.message?.includes('view')) console.error(`  Labour ${dateStr}: ${error.message}`);
                d.setDate(d.getDate() + 1);
            }
        }
        console.log(`✅ Labour: inserted ${labInserted} rows`);
    }

    // Verify
    const { data: check } = await supabase
        .from('sales_daily_unified')
        .select('date, net_sales, orders_count')
        .gte('date', '2026-03-11')
        .order('date', { ascending: false })
        .limit(10);
    console.log('Verification — recent sales data:');
    check?.forEach(r => console.log(`  ${r.date}: €${r.net_sales} (${r.orders_count} orders)`));
}

main().catch(console.error);
