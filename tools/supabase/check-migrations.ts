/**
 * check-migrations.ts
 *
 * Fails (exit 1) if remote_versions.txt exists and there are remote versions
 * not present as local migration files. Use as a local pre-push sanity check.
 *
 * Usage:
 *   npx tsx tools/supabase/check-migrations.ts
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const REMOTE_FILE = join(ROOT, "remote_versions.txt");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

const VERSION_RE = /^\d{14}$/;

function parseRemoteVersions(filePath: string): string[] {
  const raw = readFileSync(filePath, "utf-8");
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !/^[-=]+$/.test(l) && !/^version$/i.test(l))
    .map((l) => {
      const m = l.match(/(\d{14})/);
      return m ? m[1] : l;
    })
    .filter((v) => VERSION_RE.test(v));
}

function getLocalVersions(dir: string): Set<string> {
  if (!existsSync(dir)) return new Set();
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.match(/^(\d{14})/))
      .filter(Boolean)
      .map((m) => m![1])
  );
}

function main() {
  if (!existsSync(REMOTE_FILE)) {
    console.log(
      "INFO: remote_versions.txt not found — skipping migration check."
    );
    console.log(
      "To enable this check, paste your remote versions into remote_versions.txt."
    );
    process.exit(0);
  }

  const remoteVersions = new Set(parseRemoteVersions(REMOTE_FILE));
  const localVersions = getLocalVersions(MIGRATIONS_DIR);

  const missing = [...remoteVersions].filter((v) => !localVersions.has(v)).sort();

  console.log(`Remote: ${remoteVersions.size} | Local: ${localVersions.size} | Missing: ${missing.length}`);

  if (missing.length === 0) {
    console.log("OK: All remote migration versions are present locally.");
    process.exit(0);
  }

  console.error("");
  console.error("FAIL: The following remote versions are missing locally:");
  for (const v of missing) {
    console.error(`  - ${v}`);
  }
  console.error("");
  console.error("Run 'npm run repair:migrations' to create placeholder files.");
  process.exit(1);
}

main();
