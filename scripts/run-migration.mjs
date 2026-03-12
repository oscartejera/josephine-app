/**
 * Execute a SQL migration file against Supabase using the Management API.
 * Usage: SUPABASE_ACCESS_TOKEN=<token> node scripts/run-migration.mjs <sql-file>
 */
import { readFileSync } from 'fs';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = 'qixipveebfhurbarksib';

if (!TOKEN) { console.error('Set SUPABASE_ACCESS_TOKEN'); process.exit(1); }

const sqlFile = process.argv[2];
if (!sqlFile) { console.error('Usage: node scripts/run-migration.mjs <file.sql>'); process.exit(1); }

const sql = readFileSync(sqlFile, 'utf8');
console.log(`Executing ${sqlFile} (${sql.length} chars)...`);

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

if (res.ok) {
  const data = await res.json();
  console.log('✅ Migration executed successfully');
  if (data && typeof data === 'object') console.log(JSON.stringify(data, null, 2));
} else {
  const err = await res.text();
  console.error(`❌ Error ${res.status}: ${err}`);
}
