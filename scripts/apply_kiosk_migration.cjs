// Apply the kiosk pin_code migration to production Supabase
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const AT = env.match(/SUPABASE_ACCESS_TOKEN=(.+)/)[1].trim();
const ref = 'qixipveebfhurbarksib';

const sql = fs.readFileSync('supabase/migrations/20260308130000_kiosk_pin_code.sql', 'utf8');

(async () => {
    // Apply migration SQL
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AT}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
    });
    const body = await r.text();
    console.log('Migration status:', r.status, r.statusText);
    console.log('Result:', body.slice(0, 500));

    // Register migration
    const regSql = `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260308130000', 'kiosk_pin_code') ON CONFLICT DO NOTHING;`;
    const r2 = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AT}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: regSql }),
    });
    console.log('Registration:', r2.status, r2.statusText);

    // Also create the storage bucket for clock photos
    const bucketSql = `INSERT INTO storage.buckets (id, name, public) VALUES ('clock-photos', 'clock-photos', false) ON CONFLICT (id) DO NOTHING;`;
    const r3 = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AT}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: bucketSql }),
    });
    console.log('Storage bucket:', r3.status, r3.statusText);

    // Verify: check how many employees got PINs
    const checkSql = `SELECT full_name, pin_code, location_id FROM employees WHERE pin_code IS NOT NULL ORDER BY pin_code LIMIT 15;`;
    const r4 = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AT}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: checkSql }),
    });
    const employees = await r4.json();
    console.log('Employees with PINs:', JSON.stringify(employees, null, 2));
})();
