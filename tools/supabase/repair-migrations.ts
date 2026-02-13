/**
 * repair-migrations.ts
 *
 * Detects remote migration versions missing from the local supabase/migrations
 * directory and creates no-op placeholder files so Supabase Preview CI passes.
 *
 * Usage:
 *   npx tsx tools/supabase/repair-migrations.ts
 *
 * Requires: remote_versions.txt at the repo root (one version per line).
 * Generate it by running in the Supabase SQL Editor:
 *
 *   select version from supabase_migrations.schema_migrations order by version;
 *
 * Then paste the output into remote_versions.txt.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ── Paths ───────────────────────────────────────────────────────────────
const ROOT = resolve(import.meta.dirname, "../..");
const REMOTE_FILE = join(ROOT, "remote_versions.txt");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

// ── Helpers ─────────────────────────────────────────────────────────────
const VERSION_RE = /^\d{14}$/;

function parseRemoteVersions(filePath: string): string[] {
  const raw = readFileSync(filePath, "utf-8");
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    // skip header-like lines (e.g. "version", "--------")
    .filter((l) => !/^[-=]+$/.test(l) && !/^version$/i.test(l))
    // extract the first 14-digit number on the line (handles padded output)
    .map((l) => {
      const m = l.match(/(\d{14})/);
      return m ? m[1] : l;
    });
}

function getLocalVersions(dir: string): Set<string> {
  if (!existsSync(dir)) return new Set();
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  const versions = new Set<string>();
  for (const f of files) {
    const m = f.match(/^(\d{14})/);
    if (m) versions.add(m[1]);
  }
  return versions;
}

// ── Main ────────────────────────────────────────────────────────────────
function main() {
  // 1. Check remote_versions.txt exists
  if (!existsSync(REMOTE_FILE)) {
    console.error("ERROR: remote_versions.txt not found at:", REMOTE_FILE);
    console.error("");
    console.error("Generate it by running this SQL in the Supabase SQL Editor:");
    console.error("");
    console.error(
      "  select version from supabase_migrations.schema_migrations order by version;"
    );
    console.error("");
    console.error(
      "Then paste the output into remote_versions.txt at the repo root."
    );
    process.exit(1);
  }

  // 2. Parse remote versions
  const remoteRaw = parseRemoteVersions(REMOTE_FILE);
  const valid: string[] = [];
  const skipped: string[] = [];

  for (const v of remoteRaw) {
    if (VERSION_RE.test(v)) {
      valid.push(v);
    } else {
      skipped.push(v);
    }
  }

  if (skipped.length > 0) {
    console.warn(
      `WARN: Skipping ${skipped.length} non-14-digit version(s):`,
      skipped
    );
  }

  const remoteVersions = new Set(valid);

  // 3. Get local versions
  const localVersions = getLocalVersions(MIGRATIONS_DIR);

  // 4. Calculate missing
  const missing = [...remoteVersions].filter((v) => !localVersions.has(v)).sort();

  // 5. Summary
  console.log("=== Migration Repair Report ===");
  console.log(`Remote versions:  ${remoteVersions.size}`);
  console.log(`Local versions:   ${localVersions.size}`);
  console.log(`Missing locally:  ${missing.length}`);
  console.log("");

  if (missing.length === 0) {
    console.log("All remote versions are present locally. Nothing to do.");
    return;
  }

  // 6. Create placeholders
  const PLACEHOLDER = [
    "-- legacy placeholder",
    "-- This migration exists in remote history but the original file is not present in this repo.",
    "select 1;",
    "",
  ].join("\n");

  const created: string[] = [];
  for (const version of missing) {
    const filename = `${version}_legacy_placeholder.sql`;
    const filepath = join(MIGRATIONS_DIR, filename);

    if (existsSync(filepath)) {
      console.log(`SKIP (already exists): ${filename}`);
      continue;
    }

    writeFileSync(filepath, PLACEHOLDER, "utf-8");
    created.push(filename);
    console.log(`CREATED: ${filename}`);
  }

  console.log("");
  console.log(`Placeholders created: ${created.length}`);
  console.log(`Placeholders skipped: ${missing.length - created.length}`);
  console.log("");
  console.log("Done. Run 'npm run check:migrations' to verify.");
}

main();
