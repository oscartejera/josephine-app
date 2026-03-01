import { readFileSync } from 'fs';
const env = readFileSync('.env.local', 'utf8');
const at = env.match(/SUPABASE_ACCESS_TOKEN=(.+)/)[1].trim();
const P = 'qixipveebfhurbarksib';
const ORG = '7bca34d5-4448-40b8-bb7f-55f1417aeccd';

async function q(k, s) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${P}/database/query`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${at}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: s })
    });
    const d = await r.json();
    console.log(`=== ${k} ===`);
    console.log(JSON.stringify(d, null, 2));
}

// Get locations for this org
await q('locations', `SELECT id, name FROM locations WHERE org_id='${ORG}' ORDER BY name`);

// Check what Square location_ids exist in staging
await q('sq_locations', `SELECT DISTINCT square_location_id FROM staging_square_orders WHERE org_id='${ORG}'`);

// Check what's in the cdm_orders location_id
await q('cdm_locations', `SELECT location_id, count(*) FROM cdm_orders WHERE org_id='${ORG}' AND provider='square' GROUP BY 1`);
