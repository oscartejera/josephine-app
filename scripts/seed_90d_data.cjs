/**
 * seed_90d_data.cjs — 90-day data seeder (rate-limit safe)
 * 
 * Consolidates ALL inserts per batch into single SQL statements.
 * Adds 3-second delays between batches to respect API limits.
 * Starts from day START_DAY (set below) so it can resume.
 */

const TOKEN = 'sbp_af50423d177b8b18c51d70ae4ed72e4a2d269020';
const PROJECT = 'qzrbvjklgorfoqersdpx';
const API = `https://api.supabase.com/v1/projects/${PROJECT}/database/query`;

const ORG_ID = '747d5c56-6a90-4913-9a7a-a497a3aa02e1';
const LOCATIONS = [
    '57f62bae-4d5b-44b0-8055-fdde12ee5a96',
    '9c501324-66e4-40e8-bfcb-7cc855f3754e',
    '9469ef7a-c1b1-4314-8349-d0ea253ba483',
    'fe0717f7-6fa7-4e5e-8467-6c9585b03022',
];

// Resume from day 26 (0-indexed), first 25 already seeded
const START_DAY = 25;

let PRODUCTS = [];
let ITEMS = [];
const REASONS = ['caducado', 'dañado', 'sobreproduccion', 'derrame', 'error_preparacion', 'devolucion_cliente'];

function rand(a, b) { return Math.random() * (b - a) + a; }
function ri(a, b) { return Math.floor(rand(a, b + 1)); }
function r2(n) { return Math.round(n * 100) / 100; }
function uid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); }
function ds(d) { return d.toISOString().split('T')[0]; }
function addD(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sql(q) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(API, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q }),
        });
        const text = await res.text();
        if (res.status === 429 || text.includes('Too Many Requests')) {
            console.log(`   ⏳ Rate limited, waiting ${5 + attempt * 5}s...`);
            await sleep((5 + attempt * 5) * 1000);
            continue;
        }
        if (!res.ok) {
            const msg = text.substring(0, 200);
            if (msg.includes('"message"')) throw new Error(JSON.parse(text).message.substring(0, 200));
            throw new Error(msg);
        }
        return JSON.parse(text);
    }
    throw new Error('Rate limit exceeded after 3 retries');
}

function profile(dow) {
    return [
        { sb: 1100, sr: 400, ob: 55, or: 25, lh: 18, lr: 6 },
        { sb: 1200, sr: 300, ob: 60, or: 20, lh: 20, lr: 5 },
        { sb: 1350, sr: 350, ob: 68, or: 22, lh: 22, lr: 5 },
        { sb: 1450, sr: 350, ob: 72, or: 22, lh: 24, lr: 5 },
        { sb: 1650, sr: 400, ob: 82, or: 25, lh: 28, lr: 6 },
        { sb: 2400, sr: 600, ob: 120, or: 35, lh: 36, lr: 8 },
        { sb: 2800, sr: 700, ob: 140, or: 40, lh: 40, lr: 10 },
    ][dow];
}

const LM = {
    '57f62bae-4d5b-44b0-8055-fdde12ee5a96': 1.15,
    '9c501324-66e4-40e8-bfcb-7cc855f3754e': 1.00,
    '9469ef7a-c1b1-4314-8349-d0ea253ba483': 0.90,
    'fe0717f7-6fa7-4e5e-8467-6c9585b03022': 0.85,
};

function gen(date, loc, idx) {
    const d = new Date(date);
    const p = profile(d.getDay());
    const lm = LM[loc] || 1;
    const tm = 1 + (idx / 90) * 0.08;
    const nm = 1 + (Math.random() - 0.5) * 0.24;
    const ns = r2((p.sb + rand(0, p.sr)) * lm * tm * nm);
    const oc = Math.max(1, ri(Math.floor(p.ob * lm * tm * nm), Math.ceil((p.ob + p.or) * lm * tm * nm)));
    return {
        dt: ds(d), loc, ns,
        gs: r2(ns * rand(1.03, 1.06)), oc,
        pc: r2(ns * rand(0.20, 0.30)), pk: r2(ns * rand(0.62, 0.72)),
        po: r2(ns * rand(0.02, 0.08)),
        ra: r2(ns * rand(0.002, 0.008)), rc: ri(0, 3),
        da: r2(ns * rand(0.015, 0.035)), ca: r2(ns * rand(0.005, 0.015)), va: r2(ns * rand(0.004, 0.012)),
        lh: r2((p.lh + rand(0, p.lr)) * lm * tm * nm), lc: r2((p.lh + rand(0, p.lr)) * lm * tm * nm * rand(13.5, 16.5)),
        cg: r2(ns * rand(0.26, 0.30)),
        fs: r2(ns * rand(0.88, 1.12)), fo: Math.max(1, Math.round(oc * rand(0.90, 1.10))),
        plh: r2((p.lh + rand(0, p.lr)) * lm * rand(0.90, 1.10)),
        plc: r2((p.lh + rand(0, p.lr)) * lm * rand(0.90, 1.10) * rand(13.5, 16.5)),
        bs: r2(p.sb * lm * tm * 1.05), bl: r2(p.sb * lm * tm * 0.20), bc: r2(p.sb * lm * tm * 0.28),
    };
}

async function main() {
    console.log(`🚀 Seeding from day ${START_DAY + 1}...\n`);

    PRODUCTS = await sql("SELECT id FROM products ORDER BY random() LIMIT 25");
    ITEMS = await sql("SELECT id FROM inventory_items ORDER BY random() LIMIT 15");
    console.log(`📦 ${PRODUCTS.length} products, ${ITEMS.length} items\n`);

    const today = new Date('2026-02-21');
    const start = addD(today, -89);
    const BATCH = 5;

    for (let b = START_DAY; b < 90; b += BATCH) {
        const end = Math.min(b + BATCH, 90);
        const rows = [];
        for (let i = b; i < end; i++) {
            for (const loc of LOCATIONS) rows.push(gen(addD(start, i), loc, i));
        }

        process.stdout.write(`  📊 Days ${b + 1}-${end}...`);
        try {
            // 1. pos_daily_finance (UPSERT)
            const pdfV = rows.map(r =>
                `('${uid()}','${r.dt}','${r.loc}',${r.ns},${r.gs},${r.oc},${r.pc},${r.pk},${r.po},${r.ra},${r.rc},${r.da},${r.ca},${r.va},NOW(),'demo')`
            ).join(',');
            await sql(`INSERT INTO pos_daily_finance (id,date,location_id,net_sales,gross_sales,orders_count,payments_cash,payments_card,payments_other,refunds_amount,refunds_count,discounts_amount,comps_amount,voids_amount,created_at,data_source) VALUES ${pdfV} ON CONFLICT (date,location_id,data_source) DO UPDATE SET net_sales=EXCLUDED.net_sales,gross_sales=EXCLUDED.gross_sales,orders_count=EXCLUDED.orders_count,payments_cash=EXCLUDED.payments_cash,payments_card=EXCLUDED.payments_card,payments_other=EXCLUDED.payments_other`);

            // 2. labour_daily (UPSERT)
            const ldV = rows.map(r => `('${uid()}','${r.dt}','${r.loc}',${r.lc},${r.lh},NOW())`).join(',');
            await sql(`INSERT INTO labour_daily (id,date,location_id,labour_cost,labour_hours,created_at) VALUES ${ldV} ON CONFLICT (date,location_id) DO UPDATE SET labour_cost=EXCLUDED.labour_cost,labour_hours=EXCLUDED.labour_hours`);

            // 3. cogs_daily
            const cgV = rows.map(r => `('${uid()}','${r.dt}','${r.loc}',${r.cg},NOW())`).join(',');
            await sql(`INSERT INTO cogs_daily (id,date,location_id,cogs_amount,created_at) VALUES ${cgV} ON CONFLICT DO NOTHING`);

            // 4. forecast_daily_metrics
            const fcV = rows.map(r => `('${uid()}','${r.dt}','${r.loc}',${r.fs},${r.fo},${r.plh},${r.plc},NOW(),'AVG_28D_v1',NOW(),0,0,75,'demo')`).join(',');
            await sql(`INSERT INTO forecast_daily_metrics (id,date,location_id,forecast_sales,forecast_orders,planned_labor_hours,planned_labor_cost,created_at,model_version,generated_at,mse,mape,confidence,data_source) VALUES ${fcV} ON CONFLICT DO NOTHING`);

            // 5. budgets_daily
            const bdV = rows.map(r => `('${uid()}','${r.dt}','${r.loc}',${r.bs},${r.bl},${r.bc},NOW())`).join(',');
            await sql(`INSERT INTO budgets_daily (id,date,location_id,budget_sales,budget_labour,budget_cogs,created_at) VALUES ${bdV} ON CONFLICT DO NOTHING`);

            // 6. product_sales_daily — ALL rows in one SQL
            const psVals = [];
            for (const r of rows) {
                const cnt = ri(8, Math.min(15, PRODUCTS.length));
                const prods = [...PRODUCTS].sort(() => Math.random() - 0.5).slice(0, cnt);
                let rem = r.ns;
                for (let i = 0; i < prods.length; i++) {
                    const share = i === prods.length - 1 ? Math.max(0, rem) : r2(rem * rand(0.04, 0.14));
                    rem = r2(rem - share);
                    const units = Math.max(1, Math.round(share / rand(8, 28)));
                    psVals.push(`('${uid()}','${r.dt}','${r.loc}','${prods[i].id}',${units},${r2(share)},${r2(share * rand(0.22, 0.32))},NOW(),'demo')`);
                }
            }
            if (psVals.length) {
                await sql(`INSERT INTO product_sales_daily (id,date,location_id,product_id,units_sold,net_sales,cogs,created_at,data_source) VALUES ${psVals.join(',')} ON CONFLICT DO NOTHING`);
            }

            // 7. waste_events — ALL rows in one SQL
            const weVals = [];
            for (const r of rows) {
                const cnt = ri(1, 3);
                const its = [...ITEMS].sort(() => Math.random() - 0.5).slice(0, cnt);
                for (const it of its) {
                    const qty = r2(rand(0.2, 3.0));
                    weVals.push(`('${uid()}','${r.loc}','${it.id}',${qty},'${REASONS[ri(0, 5)]}',${r2(qty * rand(2, 15))},'${r.dt}T${String(ri(8, 22)).padStart(2, '0')}:${String(ri(0, 59)).padStart(2, '0')}:00+00')`);
                }
            }
            if (weVals.length) {
                await sql(`INSERT INTO waste_events (id,location_id,inventory_item_id,quantity,reason,waste_value,created_at) VALUES ${weVals.join(',')} ON CONFLICT DO NOTHING`);
            }

            console.log(' ✅');
        } catch (err) {
            console.log(` ❌ ${err.message.substring(0, 120)}`);
        }

        // Rate limit: 3s between batches
        await sleep(3000);
    }

    // Future forecast
    console.log('\n🔮 Future forecast (+14 days)...');
    for (let i = 1; i <= 14; i++) {
        const rows = LOCATIONS.map(loc => gen(addD(today, i), loc, 90 + i));
        const fcV = rows.map(r => `('${uid()}','${r.dt}','${r.loc}',${r.fs},${r.fo},${r.plh},${r.plc},NOW(),'AVG_28D_v1',NOW(),0,0,75,'demo')`).join(',');
        await sql(`INSERT INTO forecast_daily_metrics (id,date,location_id,forecast_sales,forecast_orders,planned_labor_hours,planned_labor_cost,created_at,model_version,generated_at,mse,mape,confidence,data_source) VALUES ${fcV} ON CONFLICT DO NOTHING`);
        await sleep(1000);
    }
    console.log('   ✅');

    // Verify
    console.log('\n📈 Verify...');
    const locs = LOCATIONS.map(l => `'${l}'`).join(',');
    const c = await sql(`SELECT (SELECT COUNT(*)::int FROM pos_daily_finance WHERE location_id IN (${locs})) AS sales, (SELECT COUNT(*)::int FROM forecast_daily_metrics WHERE location_id IN (${locs})) AS forecast, (SELECT COUNT(*)::int FROM labour_daily WHERE location_id IN (${locs})) AS labour, (SELECT COUNT(*)::int FROM cogs_daily WHERE location_id IN (${locs})) AS cogs, (SELECT COUNT(*)::int FROM budgets_daily WHERE location_id IN (${locs})) AS budgets, (SELECT COUNT(*)::int FROM product_sales_daily WHERE location_id IN (${locs})) AS products, (SELECT COUNT(*)::int FROM waste_events WHERE location_id IN (${locs})) AS waste`);
    console.log('   Counts:', JSON.stringify(c[0]));

    const sample = await sql("SELECT date, net_sales, orders_count, avg_check FROM sales_daily_unified ORDER BY date DESC LIMIT 3");
    console.log('   Sample:', JSON.stringify(sample));

    await sql("NOTIFY pgrst, 'reload schema'");
    console.log('\n✅ Done!');
}

main().catch(err => { console.error('💥', err.message); process.exit(1); });
