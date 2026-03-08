// Create import_history table (no FK to views)
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const AT = env.match(/SUPABASE_ACCESS_TOKEN=(.+)/)[1].trim();
const ref = 'qixipveebfhurbarksib';

const sql = `
CREATE TABLE IF NOT EXISTS import_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid,
  location_id uuid,
  filename text NOT NULL,
  rows_imported int NOT NULL DEFAULT 0,
  rows_total int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_history_org ON import_history(org_id);
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_history_select" ON import_history FOR SELECT USING (true);
CREATE POLICY "import_history_insert" ON import_history FOR INSERT WITH CHECK (true);
`;

(async () => {
    const r = await fetch('https://api.supabase.com/v1/projects/' + ref + '/database/query', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + AT, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
    });
    console.log('Status:', r.status, r.statusText);
    console.log('Result:', (await r.text()).slice(0, 300));
})();
