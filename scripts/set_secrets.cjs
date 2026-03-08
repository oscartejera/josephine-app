// Save Lightspeed + Resend secrets to Supabase
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const AT = env.match(/SUPABASE_ACCESS_TOKEN=(.+)/)[1].trim();
const ref = 'qixipveebfhurbarksib';

const secrets = [
    { name: 'LIGHTSPEED_CLIENT_ID', value: 'W1pDXCtEiMhpVcBZKbbd7wFEm4rs1tmz' },
    { name: 'LIGHTSPEED_CLIENT_SECRET', value: 'e810XTVOfvsjFI5CZvvy7jXrhdxvWQUC' },
    { name: 'RESEND_API_KEY', value: 're_Yg5RoXg1_BjZRPUqTwR3o92RDGWf7WWvo' },
];

(async () => {
    for (const s of secrets) {
        const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AT}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([{ name: s.name, value: s.value }]),
        });
        console.log(`${s.name}: ${r.status} ${r.statusText}`);
    }
    console.log('Done!');
})();
