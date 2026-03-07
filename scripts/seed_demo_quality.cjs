/**
 * seed_demo_quality.cjs — Demo Data Quality Fix
 * 
 * Fixes all demo data quality issues in one script:
 * 1. Tightens forecast accuracy (MAPE from ~45% → ~6%)
 * 2. Seeds planned_shifts for current + next 2 weeks
 * 
 * Usage: node scripts/seed_demo_quality.cjs
 * Requires: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

const fs = require('fs');
const path = require('path');

// Load .env.local (handle UTF-16 or UTF-8)
const envPath = path.join(__dirname, '..', '.env.local');
let envContent = fs.readFileSync(envPath, 'utf-8');
// If the file is UTF-16 it might have garbage chars — try UTF-16LE
if (envContent.includes('\u0000') || !envContent.includes('SUPABASE')) {
    const buf = fs.readFileSync(envPath);
    envContent = buf.toString('utf16le');
}
// Strip BOM
envContent = envContent.replace(/^\uFEFF/, '');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

function uid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function r2(n) { return Math.round(n * 100) / 100; }

async function supabaseRpc(endpoint, { method = 'GET', body, headers: extraHeaders = {} } = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=minimal' : 'return=representation',
        ...extraHeaders,
    };

    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${method} ${endpoint}: ${res.status} — ${text.substring(0, 200)}`);
    }

    if (method === 'GET') return res.json();
    return null;
}

async function supabaseRpcRaw(endpoint, { method = 'GET', body, headers: extraHeaders = {} } = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
        ...extraHeaders,
    };

    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${method} ${endpoint}: ${res.status} — ${text.substring(0, 200)}`);
    }
    return null;
}

function formatDate(d) {
    return d.toISOString().split('T')[0];
}

function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

function getMonday(d) {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    return monday;
}

// ─────────────────── 1. FIX FORECAST ACCURACY ───────────────────

async function fixForecastAccuracy() {
    console.log('\n📊 Step 1: Fixing forecast accuracy (MAPE ~45% → ~6%)...');

    // Get all actual sales data (no data_source filter on forecast since column doesn't exist there)
    const sales = await supabaseRpc('pos_daily_finance?select=date,location_id,net_sales&data_source=eq.demo&order=date.asc');
    console.log(`   Found ${sales.length} actual sales records`);

    if (sales.length === 0) {
        console.log('   ⚠️  No sales data found, skipping forecast fix');
        return;
    }

    // For each actual sales record, update the forecast to be within ±2-8%
    let updated = 0;
    let errors = 0;
    const batchSize = 50;

    for (let i = 0; i < sales.length; i += batchSize) {
        const batch = sales.slice(i, i + batchSize);

        for (const sale of batch) {
            const actual = Number(sale.net_sales);
            if (actual <= 0) continue;

            // Generate forecast within ±2-8% of actual (realistic accuracy)
            const errorPct = (Math.random() * 0.06 + 0.02) * (Math.random() > 0.5 ? 1 : -1);
            const forecast = r2(actual * (1 + errorPct));

            // Update via PATCH — NO data_source filter (column doesn't exist in forecast_daily_metrics)
            const endpoint = `forecast_daily_metrics?date=eq.${sale.date}&location_id=eq.${sale.location_id}`;
            try {
                const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
                const res = await fetch(url, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SERVICE_KEY,
                        'Authorization': `Bearer ${SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=headers-only',
                    },
                    body: JSON.stringify({ forecast_sales: forecast }),
                });
                if (res.ok) {
                    updated++;
                } else {
                    errors++;
                    if (errors <= 3) {
                        const text = await res.text();
                        console.log(`   ⚠️  PATCH failed (${res.status}): ${text.substring(0, 100)}`);
                    }
                }
            } catch (err) {
                errors++;
            }
        }

        process.stdout.write(`   Updated ${updated}/${Math.min(i + batchSize, sales.length)} forecasts (${errors} errors)\r`);
    }

    console.log(`\n   ✅ Updated ${updated} forecast records (${errors} errors)`);
}

// ─────────────────── 2. SEED PLANNED SHIFTS ───────────────────

async function seedPlannedShifts() {
    console.log('\n📅 Step 2: Seeding planned_shifts for scheduling...');

    // Get locations
    const locations = await supabaseRpc('locations?select=id,name&order=name');
    console.log(`   Found ${locations.length} locations`);

    if (locations.length === 0) {
        console.log('   ⚠️  No locations found, skipping shift seeding');
        return;
    }

    // Get employees by location
    const employees = await supabaseRpc('employees?select=id,full_name,location_id,role_name,hourly_cost,active&active=eq.true');
    console.log(`   Found ${employees.length} active employees`);

    // Shift templates (realistic restaurant patterns)
    const SHIFT_TEMPLATES = [
        { start: '07:00', end: '15:00', hours: 8, role: 'Kitchen' },    // Morning kitchen
        { start: '08:00', end: '16:00', hours: 8, role: 'Server' },     // Morning FOH
        { start: '10:00', end: '15:00', hours: 5, role: 'Barista' },    // Lunch cover
        { start: '12:00', end: '16:00', hours: 4, role: 'Runner' },     // Lunch rush
        { start: '16:00', end: '23:00', hours: 7, role: 'Kitchen' },    // Evening kitchen
        { start: '17:00', end: '23:30', hours: 6.5, role: 'Server' },   // Evening FOH
        { start: '18:00', end: '23:00', hours: 5, role: 'Bartender' },  // Evening bar
        { start: '09:00', end: '17:00', hours: 8, role: 'Manager' },    // Manager day
    ];

    // Day-of-week staffing multiplier (more staff on weekends)
    const DOW_MULTIPLIER = {
        0: 0.7,  // Sunday
        1: 0.6,  // Monday
        2: 0.7,  // Tuesday
        3: 0.8,  // Wednesday
        4: 0.9,  // Thursday
        5: 1.0,  // Friday
        6: 1.0,  // Saturday
    };

    const today = new Date();
    const mondayThisWeek = getMonday(today);
    const shifts = [];

    // Generate shifts for 3 weeks (this week + 2 future weeks)
    for (const loc of locations) {
        const locEmployees = employees.filter(e => e.location_id === loc.id);
        if (locEmployees.length === 0) continue;

        for (let week = 0; week < 3; week++) {
            const weekStart = addDays(mondayThisWeek, week * 7);

            for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
                const shiftDate = addDays(weekStart, dayOfWeek);
                const dateStr = formatDate(shiftDate);
                const dow = shiftDate.getDay();
                const multiplier = DOW_MULTIPLIER[dow] || 0.8;

                // How many shifts per day (scaled by DOW and employee count)
                const maxShifts = Math.min(
                    Math.max(3, Math.floor(locEmployees.length * multiplier * 0.7)),
                    SHIFT_TEMPLATES.length
                );

                // Randomly pick shifts and assign to employees
                const shuffledTemplates = [...SHIFT_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, maxShifts);
                const shuffledEmployees = [...locEmployees].sort(() => Math.random() - 0.5);

                for (let s = 0; s < shuffledTemplates.length; s++) {
                    const template = shuffledTemplates[s];
                    const employee = shuffledEmployees[s % shuffledEmployees.length];
                    const hourlyCost = employee.hourly_cost || 14.50;

                    shifts.push({
                        id: uid(),
                        location_id: loc.id,
                        employee_id: employee.id,
                        shift_date: dateStr,
                        start_time: template.start + ':00',
                        end_time: template.end + ':00',
                        planned_hours: template.hours,
                        planned_cost: r2(template.hours * hourlyCost),
                        role: template.role,
                        status: week === 0 ? 'published' : 'draft',
                    });
                }
            }
        }
    }

    console.log(`   Generated ${shifts.length} shifts across ${locations.length} locations`);

    // Delete existing demo shifts, then insert new ones
    // First clear old shifts for the date range
    const startDate = formatDate(mondayThisWeek);
    const endDate = formatDate(addDays(mondayThisWeek, 21));

    try {
        await supabaseRpc(
            `planned_shifts?shift_date=gte.${startDate}&shift_date=lte.${endDate}`,
            { method: 'DELETE' }
        );
        console.log('   Cleared existing shifts for date range');
    } catch (err) {
        console.log('   Note: Could not clear existing shifts:', err.message.substring(0, 100));
    }

    // Insert in batches of 100
    for (let i = 0; i < shifts.length; i += 100) {
        const batch = shifts.slice(i, i + 100);
        try {
            await supabaseRpc('planned_shifts', {
                method: 'POST',
                body: batch,
                headers: { 'Prefer': 'return=minimal' },
            });
        } catch (err) {
            console.log(`   ❌ Batch ${Math.floor(i / 100) + 1} failed: ${err.message.substring(0, 120)}`);
        }
        process.stdout.write(`   Inserted ${Math.min(i + 100, shifts.length)}/${shifts.length} shifts\r`);
    }

    console.log(`\n   ✅ Seeded ${shifts.length} planned shifts`);
}

// ─────────────────── MAIN ───────────────────

async function main() {
    console.log('🚀 Josephine Demo Data Quality Fix');
    console.log(`   Supabase: ${SUPABASE_URL}`);
    console.log(`   Date: ${new Date().toISOString().split('T')[0]}`);

    await fixForecastAccuracy();
    await seedPlannedShifts();

    console.log('\n✅ All done! Refresh the app to see improvements.');
}

main().catch(err => {
    console.error('\n💥 Fatal error:', err.message);
    process.exit(1);
});
