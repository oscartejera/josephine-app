#!/usr/bin/env node
/**
 * db-push — Execute pending migrations against Supabase via Management API.
 *
 * Reads the remote migration history, compares with local files,
 * and executes only the ones not yet applied (in order).
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<token> node scripts/db-push.mjs
 *   SUPABASE_ACCESS_TOKEN=<token> node scripts/db-push.mjs --dry-run
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = 'qixipveebfhurbarksib';
const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const DRY_RUN = process.argv.includes('--dry-run');

if (!TOKEN) {
  console.error('❌ Set SUPABASE_ACCESS_TOKEN env var');
  process.exit(1);
}

// ── 1. Get remote migration versions ────────────────────────────────────
async function getRemoteVersions() {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version`,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ Failed to fetch remote versions: ${res.status} ${err}`);
    process.exit(1);
  }

  const rows = await res.json();
  return new Set(rows.map((r) => r.version));
}

// ── 2. Get local migration files ────────────────────────────────────────
function getLocalMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => {
      const match = f.match(/^(\d{14})/);
      return match ? { version: match[1], file: f } : null;
    })
    .filter(Boolean);
}

// ── 3. Execute a single migration ───────────────────────────────────────
async function executeMigration(file) {
  const filePath = join(MIGRATIONS_DIR, file);
  const sql = readFileSync(filePath, 'utf8');

  // Skip empty placeholder files (31 bytes = "-- squashed into baseline.sql")
  if (sql.length < 40 && sql.includes('squashed')) {
    return { status: 'skipped', reason: 'placeholder' };
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return { status: 'error', error: `${res.status}: ${err}` };
  }

  return { status: 'ok' };
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Fetching remote migration state...');
  const remoteVersions = await getRemoteVersions();
  const localMigrations = getLocalMigrations();

  const pending = localMigrations.filter((m) => !remoteVersions.has(m.version));

  console.log(`\n📊 Remote: ${remoteVersions.size} | Local: ${localMigrations.length} | Pending: ${pending.length}\n`);

  if (pending.length === 0) {
    console.log('✅ All migrations are up to date');
    return;
  }

  for (const m of pending) {
    if (DRY_RUN) {
      console.log(`  🔹 [DRY RUN] Would execute: ${m.file}`);
      continue;
    }

    process.stdout.write(`  ▸ ${m.file} ... `);
    const result = await executeMigration(m.file);

    if (result.status === 'ok') {
      console.log('✅');
    } else if (result.status === 'skipped') {
      console.log(`⏭️  (${result.reason})`);
    } else {
      console.log(`❌ ${result.error}`);
      console.error(`\n💥 Stopping — fix the error above and retry`);
      process.exit(1);
    }
  }

  console.log(`\n✅ All ${pending.length} pending migration(s) applied`);
}

main().catch((err) => {
  console.error('💥 Unexpected error:', err);
  process.exit(1);
});
