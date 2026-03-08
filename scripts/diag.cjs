// Deep diagnostic: figure out why MAPE is still high
const fs = require('fs');
const path = require('path');
let e = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
if (e.charCodeAt(0) === 0xFEFF) e = e.slice(1);
if (e.includes('\u0000') || !e.includes('SUPABASE')) {
    e = fs.readFileSync(path.join(__dirname, '..', '.env.local')).toString('utf16le').replace(/^\uFEFF/, '');
}
const env = {};
e.split(/\r?\n/).forEach(l => { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m) env[m[1].trim()] = m[2].trim(); });
const SB = env.VITE_SUPABASE_URL;
const SK = env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };

async function api(ep) {
    const r = await fetch(SB + '/rest/v1/' + ep, { headers: h });
    return r.ok ? r.json() : null;
}

async function main() {
    // 1. Get ALL forecast records (should be 124)
    const forecasts = await api('forecast_daily_metrics?select=id,date,location_id,forecast_sales&order=date.asc&limit=500');
    console.log('Total forecast records:', forecasts.length);

    // 2. Get ALL sales in the same date range
    const minDate = forecasts[0].date;
    const maxDate = forecasts[forecasts.length - 1].date;
    console.log('Forecast date range:', minDate, '→', maxDate);

    const sales = await api('sales_daily_unified?select=date,location_id,net_sales&date=gte.' + minDate + '&date=lte.' + maxDate + '&limit=2000');
    console.log('Sales records in same range:', sales.length);

    // 3. Build sales lookup — handle possible duplicates by SUMMING net_sales per date+loc
    const salesMap = new Map();
    sales.forEach(s => {
        const key = s.date + '|' + s.location_id;
        salesMap.set(key, (salesMap.get(key) || 0) + Number(s.net_sales || 0));
    });

    // 4. Calculate individual MAPEs
    let totalAPE = 0;
    let matchCount = 0;
    let mismatchCount = 0;
    const highErrors = [];

    for (const f of forecasts) {
        const key = f.date + '|' + f.location_id;
        const actual = salesMap.get(key);
        if (!actual || actual <= 0) {
            mismatchCount++;
            continue;
        }
        const ape = Math.abs(f.forecast_sales - actual) / actual * 100;
        totalAPE += ape;
        matchCount++;
        if (ape > 10) {
            highErrors.push({ date: f.date, loc: f.location_id.substring(0, 8), forecast: f.forecast_sales, actual, ape: ape.toFixed(1) + '%' });
        }
    }

    console.log('\nMatched:', matchCount, 'No match:', mismatchCount);
    console.log('Calculated MAPE:', matchCount > 0 ? (totalAPE / matchCount).toFixed(1) + '%' : 'N/A');
    console.log('\nHigh-error records (>10%):');
    highErrors.slice(0, 20).forEach(e => console.log('  ' + e.date + ' ' + e.loc + ' F:' + e.forecast + ' A:' + e.actual + ' APE:' + e.ape));

    // 5. Check v_forecast_accuracy current state
    const vacc = await api('v_forecast_accuracy?select=location_id,mape,days_evaluated&limit=10');
    console.log('\nv_forecast_accuracy:');
    if (Array.isArray(vacc)) vacc.forEach(r => console.log('  Loc:' + r.location_id.substring(0, 8) + ' MAPE:' + r.mape + ' Days:' + r.days_evaluated));

    // 6. Check if sales has multiple rows per date+loc (causing sum difference)
    const dupes = await api('sales_daily_unified?select=date,location_id,net_sales&date=eq.' + minDate + '&location_id=eq.' + forecasts[0].location_id);
    console.log('\nSales rows for first date+loc:', dupes?.length, dupes?.map(r => r.net_sales));
}

main().catch(err => console.error('Fatal:', err.message));
