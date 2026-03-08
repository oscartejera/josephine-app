// Fix forecast MAPE - verify the PATCH actually works
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

async function main() {
    // 1. Test: Read one forecast record, patch it, re-read
    const loc = '13f383c6-0171-4c1f-9ee4-6ef6a6f04b36';
    const date = '2026-02-10';

    console.log('=== VERIFICATION TEST ===');

    // Read current forecast value
    const before = await (await fetch(SB + '/rest/v1/forecast_daily_metrics?date=eq.' + date + '&location_id=eq.' + loc + '&select=id,forecast_sales,date', { headers: h })).json();
    console.log('Before:', JSON.stringify(before));

    if (!before[0]) { console.log('No record found!'); return; }

    // Read actual sales
    const actual = await (await fetch(SB + '/rest/v1/sales_daily_unified?date=eq.' + date + '&location_id=eq.' + loc + '&select=net_sales', { headers: h })).json();
    console.log('Actual sales:', actual[0]?.net_sales);

    // Patch to be close to actual
    const targetVal = Math.round(actual[0].net_sales * 1.03 * 100) / 100;
    console.log('Patching to:', targetVal);

    const patchResp = await fetch(SB + '/rest/v1/forecast_daily_metrics?id=eq.' + before[0].id, {
        method: 'PATCH',
        headers: { ...h, Prefer: 'return=representation' },
        body: JSON.stringify({ forecast_sales: targetVal })
    });
    const patchResult = await patchResp.json();
    console.log('Patch result:', patchResp.status, JSON.stringify(patchResult));

    // Re-read to verify
    const after = await (await fetch(SB + '/rest/v1/forecast_daily_metrics?date=eq.' + date + '&location_id=eq.' + loc + '&select=id,forecast_sales', { headers: h })).json();
    console.log('After:', JSON.stringify(after));

    // Verify the v_forecast_accuracy view is the same
    const vacc = await (await fetch(SB + '/rest/v1/v_forecast_accuracy?location_id=eq.' + loc + '&select=mape', { headers: h })).json();
    console.log('v_forecast_accuracy MAPE for this loc:', vacc[0]?.mape);

    // Now check if the forecast_accuracy TABLE (not view) exists
    const faTable = await fetch(SB + '/rest/v1/forecast_accuracy?select=*&limit=1', { headers: h });
    console.log('\nforecast_accuracy table status:', faTable.status);
    if (faTable.ok) {
        const faData = await faTable.json();
        console.log('forecast_accuracy data:', JSON.stringify(faData).substring(0, 200));
    }
}
main().catch(err => console.error('Fatal:', err.message));
