/**
 * Fix restaurant data: repopulate all 7 daily tables with realistic
 * casual dining Madrid values via curl + Supabase REST API.
 *
 * Run: node scripts/fix-restaurant-data.mjs
 */

import { execSync } from 'child_process';
import fs from 'fs';

const SB_URL = 'https://qzrbvjklgorfoqersdpx.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cmJ2amtsZ29yZm9xZXJzZHB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI5NDYwMywiZXhwIjoyMDg1ODcwNjAzfQ.UgpxcrpVnrxaOlQHCcs4-5c4LABnHvFAysCbTrFLy3c';

const LOCATIONS = [
  { id: '65686b5a-87f1-49b8-a443-aca9936f7a2e', name: 'La Taberna Centro', baseSales: 5500, avgCheck: 26 },
  { id: 'bdd43146-fabb-4f3b-af00-c22eea83ccac', name: 'Chamberí', baseSales: 5000, avgCheck: 24 },
  { id: '2f1bc293-20e3-46a0-aff7-ecd9948c4249', name: 'Malasaña', baseSales: 4500, avgCheck: 22 },
];

const BLENDED_RATE = 14.5;
const LOC_IDS = LOCATIONS.map(l => l.id).join(',');

function sb(method, table, query, body) {
  const url = `${SB_URL}/rest/v1/${table}${query ? '?' + query : ''}`;
  const cmd = [
    'curl', '-s', '-w', '\\n%{http_code}',
    '-X', method,
    url,
    '-H', `apikey: ${SB_KEY}`,
    '-H', `Authorization: Bearer ${SB_KEY}`,
    '-H', 'Content-Type: application/json',
    '-H', 'Prefer: resolution=merge-duplicates,return=minimal',
  ];
  if (body) {
    cmd.push('-d', '@-');
    return execSync(cmd.map(c => `'${c}'`).join(' '), {
      input: JSON.stringify(body),
      encoding: 'utf-8',
      timeout: 60000,
    }).trim();
  }
  return execSync(cmd.map(c => `'${c}'`).join(' '), { encoding: 'utf-8', timeout: 60000 }).trim();
}

function sbGet(table, query) {
  const url = `${SB_URL}/rest/v1/${table}?${query}`;
  const result = execSync(
    `curl -s '${url}' -H 'apikey: ${SB_KEY}' -H 'Authorization: Bearer ${SB_KEY}'`,
    { encoding: 'utf-8', timeout: 30000 }
  ).trim();
  return JSON.parse(result);
}

function sbDelete(table, query) {
  const url = `${SB_URL}/rest/v1/${table}?${query}`;
  return execSync(
    `curl -s -o /dev/null -w '%{http_code}' -X DELETE '${url}' -H 'apikey: ${SB_KEY}' -H 'Authorization: Bearer ${SB_KEY}'`,
    { encoding: 'utf-8', timeout: 30000 }
  ).trim();
}

function sbUpsert(table, rows) {
  const url = `${SB_URL}/rest/v1/${table}`;
  const tmpFile = `/tmp/sb_${table}_${Date.now()}.json`;
  fs.writeFileSync(tmpFile, JSON.stringify(rows));
  const result = execSync(
    `curl -s -o /dev/null -w '%{http_code}' -X POST '${url}' ` +
    `-H 'apikey: ${SB_KEY}' -H 'Authorization: Bearer ${SB_KEY}' ` +
    `-H 'Content-Type: application/json' -H 'Prefer: resolution=merge-duplicates,return=minimal' ` +
    `-d @${tmpFile}`,
    { encoding: 'utf-8', timeout: 120000 }
  ).trim();
  fs.unlinkSync(tmpFile);
  return result;
}

function dateStr(d) { return d.toISOString().split('T')[0]; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function getDOWMult(dow) {
  const bases = [1.12, 0.80, 0.90, 0.94, 1.02, 1.38, 1.50];
  return bases[dow] + Math.random() * 0.10;
}

function getSeasonalMult(month) {
  if ([6, 7, 8].includes(month)) return 1.15 + Math.random() * 0.10;
  if ([3, 4, 5].includes(month)) return 1.05 + Math.random() * 0.05;
  if (month === 12) return 1.10 + Math.random() * 0.10;
  if ([1, 2].includes(month)) return 0.88 + Math.random() * 0.08;
  return 1.00;
}

// ─── Main ───────────────────────────────────────────────────────────
console.log('🧹 Step 1: Deleting existing daily data for 3 locations...');
const tables = [
  'pos_daily_metrics', 'forecast_daily_metrics', 'pos_daily_finance',
  'labour_daily', 'cogs_daily', 'budgets_daily', 'cash_counts_daily',
];
for (const table of tables) {
  const code = sbDelete(table, `location_id=in.(${LOC_IDS})`);
  console.log(`  ${table}: ${code === '200' || code === '204' ? '✅' : '⚠️'} HTTP ${code}`);
}

// Date range: 2025-01-01 to today + 30 days
const startDate = new Date('2025-01-01');
const today = new Date(); today.setHours(0, 0, 0, 0);
const endDate = addDays(today, 30);

console.log(`\n📅 Date range: ${dateStr(startDate)} → ${dateStr(endDate)}`);
console.log('📊 Generating data...\n');

let grandTotal = 0;

for (const loc of LOCATIONS) {
  console.log(`📍 ${loc.name} (base: €${loc.baseSales}/day, avg check: €${loc.avgCheck})...`);

  const posFinance = [];
  const posMetrics = [];
  const forecast = [];
  const labour = [];
  const cogs = [];
  const budgets = [];
  const cash = [];

  let d = new Date(startDate);
  while (d <= endDate) {
    const ds = dateStr(d);
    const dow = d.getDay();
    const month = d.getMonth() + 1;
    const doy = Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1;
    const isFuture = d > today;

    let seasonalMult = getSeasonalMult(month);
    if (d.getFullYear() === 2026) seasonalMult *= 1.12;

    const netSales = Math.round(loc.baseSales * getDOWMult(dow) * seasonalMult * (0.92 + Math.random() * 0.16) * 100) / 100;
    const grossSales = Math.round(netSales * 1.05 * 100) / 100;
    const orders = Math.max(1, Math.round(netSales / (loc.avgCheck + (Math.random() - 0.5) * 4)));

    const colPct = 0.28 + (Math.random() - 0.5) * 0.05;
    const laborCost = Math.round(netSales * colPct * 100) / 100;
    const laborHours = Math.round(laborCost / BLENDED_RATE * 10) / 10;

    const fSales = Math.round(netSales * (0.93 + Math.random() * 0.14) * 100) / 100;
    const fOrders = Math.max(1, Math.round(orders * (0.93 + Math.random() * 0.14)));
    const pHours = Math.round(fSales * 0.28 / BLENDED_RATE * 10) / 10;
    const pCost = Math.round(pHours * BLENDED_RATE * 100) / 100;

    // Forecast & budget for ALL dates
    forecast.push({
      date: ds, location_id: loc.id,
      forecast_sales: fSales, forecast_orders: fOrders,
      planned_labor_hours: pHours, planned_labor_cost: pCost,
      model_version: 'Prophet v5',
    });
    budgets.push({
      date: ds, location_id: loc.id,
      budget_sales: Math.round(netSales * (1.02 + 0.03 * Math.sin(doy)) * 100) / 100,
      budget_labour: Math.round(laborCost * (0.96 + 0.02 * Math.cos(doy)) * 100) / 100,
      budget_cogs: Math.round(netSales * 0.27 * 100) / 100,
    });

    // Actuals only for past/today
    if (!isFuture) {
      posFinance.push({
        date: ds, location_id: loc.id,
        net_sales: netSales, gross_sales: grossSales, orders_count: orders,
        payments_cash: Math.round(netSales * 0.25 * 100) / 100,
        payments_card: Math.round(netSales * 0.70 * 100) / 100,
        payments_other: Math.round(netSales * 0.05 * 100) / 100,
        refunds_amount: Math.round(netSales * 0.005 * 100) / 100,
        refunds_count: Math.max(1, Math.floor(orders * 0.02)),
        discounts_amount: Math.round(netSales * 0.03 * 100) / 100,
        comps_amount: Math.round(netSales * 0.01 * 100) / 100,
        voids_amount: Math.round(netSales * 0.008 * 100) / 100,
      });
      posMetrics.push({ date: ds, location_id: loc.id, net_sales: netSales, orders, labor_hours: laborHours, labor_cost: laborCost });
      labour.push({ date: ds, location_id: loc.id, labour_cost: laborCost, labour_hours: laborHours });
      cogs.push({ date: ds, location_id: loc.id, cogs_amount: Math.round(netSales * 0.28 * 100) / 100 });
      cash.push({ date: ds, location_id: loc.id, cash_counted: Math.round(netSales * 0.25 * (0.995 + Math.random() * 0.01) * 100) / 100 });
    }

    grandTotal++;
    d = addDays(d, 1);
  }

  // Insert in batches of 400
  const insertBatch = async (table, data, label) => {
    let ok = 0;
    for (let i = 0; i < data.length; i += 400) {
      const batch = data.slice(i, i + 400);
      const code = sbUpsert(table, batch);
      if (code === '200' || code === '201') ok += batch.length;
      else console.log(`    ⚠️ ${label} batch ${Math.floor(i/400)+1}: HTTP ${code}`);
    }
    console.log(`  ✅ ${label}: ${ok}/${data.length} rows`);
  };

  await insertBatch('pos_daily_finance', posFinance, 'pos_daily_finance');
  await insertBatch('pos_daily_metrics', posMetrics, 'pos_daily_metrics');
  await insertBatch('forecast_daily_metrics', forecast, 'forecast_daily_metrics');
  await insertBatch('labour_daily', labour, 'labour_daily');
  await insertBatch('cogs_daily', cogs, 'cogs_daily');
  await insertBatch('budgets_daily', budgets, 'budgets_daily');
  await insertBatch('cash_counts_daily', cash, 'cash_counts_daily');
  console.log('');
}

// Verify
console.log('🔍 Verifying Feb 2026 data...');
const febData = sbGet('pos_daily_finance', 'date=gte.2026-02-01&date=lte.2026-02-28&select=date,location_id,net_sales&order=date&limit=9');
console.log('\nSample Feb 2026 (should be €3,500-€8,500/location/day):');
for (const row of febData) {
  const name = LOCATIONS.find(l => l.id === row.location_id)?.name || '?';
  console.log(`  ${row.date} | ${name.padEnd(18)} | €${row.net_sales.toLocaleString()}`);
}

const allFeb = sbGet('pos_daily_finance', 'date=gte.2026-02-01&date=lte.2026-02-28&select=net_sales');
const total = allFeb.reduce((s, r) => s + (r.net_sales || 0), 0);
console.log(`\n📊 Feb 2026 total (3 locations): €${Math.round(total).toLocaleString()}`);
console.log(`   Per location/month: ~€${Math.round(total / 3).toLocaleString()}`);
console.log(`   Per location/day: ~€${Math.round(total / 3 / 28).toLocaleString()}`);
console.log(`\n✅ Done! ${grandTotal} day-location records across 7 tables.`);
