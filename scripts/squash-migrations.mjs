#!/usr/bin/env node

/**
 * squash-migrations.mjs — v2 (line-by-line state machine)
 *
 * Reads all SQL migration files and produces a single baseline.
 * Uses a line-by-line parser to correctly handle $$ quoting.
 *
 * Strategy:
 *   - Functions: keep ONLY the LAST definition of each
 *   - Views: keep ONLY the LAST definition of each
 *   - Tables: keep FIRST CREATE TABLE + deduplicated ALTER TABLEs
 *   - Everything else: deduplicate by content hash
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const ROOT = process.cwd();
const MIG_DIR = join(ROOT, 'supabase', 'migrations');

const files = readdirSync(MIG_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

console.log(`📂 Found ${files.length} migration files`);

// ─── Storage ────────────────────────────────────────────────────────────────

const functions = new Map();   // name -> full SQL text
const views = new Map();        // name -> full SQL text
const matViews = new Map();     // materialized views
const tables = new Map();       // name -> CREATE TABLE SQL
const alterBlocks = [];         // ALTER TABLE statements
const indexes = new Map();      // dedup by content
const triggers = new Map();     // name -> SQL
const policies = new Map();     // name -> SQL
const grants = new Map();       // dedup by content
const extensions = new Map();   // dedup
const types = new Map();        // name -> SQL
const inserts = [];             // data seeds
const cronJobs = [];            // cron.schedule calls
const miscBlocks = [];          // everything else
const dropStatements = [];      // DROP IF EXISTS (for cleanup)
const enableRls = [];           // ALTER TABLE ... ENABLE ROW LEVEL SECURITY
const seenHashes = new Set();   // global dedup

function hash(s) { return createHash('md5').update(s.trim()).digest('hex'); }

// ─── Parser ─────────────────────────────────────────────────────────────────

for (const file of files) {
    const content = readFileSync(join(MIG_DIR, file), 'utf8');
    const lines = content.split('\n');

    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();

        // Skip empty lines and comments
        if (!line || line.startsWith('--')) { i++; continue; }

        // ── CREATE OR REPLACE FUNCTION ──
        if (/^CREATE\s+OR\s+REPLACE\s+FUNCTION/i.test(line)) {
            const funcBlock = [];
            const nameMatch = line.match(/FUNCTION\s+([\w.]+)\s*\(/i);
            const name = nameMatch ? nameMatch[1].toLowerCase().replace('public.', '') : 'unknown';

            // Collect lines until we find the closing $$ and LANGUAGE
            let dollarCount = 0;
            let foundLanguage = false;

            while (i < lines.length) {
                funcBlock.push(lines[i]);
                const currentLine = lines[i];

                // Count $$ occurrences (opening and closing)
                const dollars = (currentLine.match(/\$\$/g) || []).length;
                dollarCount += dollars;

                // Function is complete when we have even $$ count AND find LANGUAGE
                if (dollarCount >= 2 && dollarCount % 2 === 0 && /LANGUAGE\s+\w+/i.test(currentLine)) {
                    foundLanguage = true;
                    // Might need to capture trailing attributes like STABLE, SECURITY DEFINER
                    // Check next few lines for trailing attributes
                    while (i + 1 < lines.length) {
                        const nextLine = lines[i + 1].trim();
                        if (/^(STABLE|VOLATILE|IMMUTABLE|SECURITY\s+DEFINER|SECURITY\s+INVOKER|SET\s+\w+|PARALLEL|COST|ROWS)/i.test(nextLine)) {
                            i++;
                            funcBlock.push(lines[i]);
                        } else {
                            break;
                        }
                    }
                    break;
                }

                // Also handle case where LANGUAGE is on a previous line and $$ closes after
                if (dollarCount >= 2 && dollarCount % 2 === 0 && funcBlock.some(l => /LANGUAGE\s+\w+/i.test(l))) {
                    break;
                }

                i++;
            }

            functions.set(name, funcBlock.join('\n').replace(/\r/g, ''));
            i++;
            continue;
        }

        // ── CREATE MATERIALIZED VIEW ──
        if (/^CREATE\s+MATERIALIZED\s+VIEW/i.test(line)) {
            const viewBlock = [];
            const nameMatch = line.match(/VIEW\s+([\w.]+)/i);
            const name = nameMatch ? nameMatch[1].toLowerCase().replace('public.', '') : 'unknown';

            while (i < lines.length) {
                viewBlock.push(lines[i]);
                if (lines[i].trimEnd().endsWith(';')) break;
                i++;
            }
            matViews.set(name, viewBlock.join('\n').replace(/\r/g, ''));
            i++;
            continue;
        }

        // ── CREATE OR REPLACE VIEW ──
        if (/^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW/i.test(line)) {
            const viewBlock = [];
            const nameMatch = line.match(/VIEW\s+([\w.]+)/i);
            const name = nameMatch ? nameMatch[1].toLowerCase().replace('public.', '') : 'unknown';

            while (i < lines.length) {
                viewBlock.push(lines[i]);
                if (lines[i].trimEnd().endsWith(';')) break;
                i++;
            }
            views.set(name, viewBlock.join('\n').replace(/\r/g, ''));
            i++;
            continue;
        }

        // ── CREATE TABLE ──
        if (/^CREATE\s+TABLE/i.test(line)) {
            const tableBlock = [];
            const nameMatch = line.match(/TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w.]+)/i);
            const name = nameMatch ? nameMatch[1].toLowerCase().replace('public.', '') : 'unknown';

            let parenDepth = 0;
            while (i < lines.length) {
                tableBlock.push(lines[i]);
                parenDepth += (lines[i].match(/\(/g) || []).length;
                parenDepth -= (lines[i].match(/\)/g) || []).length;
                if (parenDepth <= 0 && lines[i].trimEnd().endsWith(';')) break;
                i++;
            }
            if (!tables.has(name)) {
                tables.set(name, tableBlock.join('\n').replace(/\r/g, ''));
            }
            i++;
            continue;
        }

        // ── CREATE INDEX ──
        if (/^CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(line)) {
            const block = [];
            while (i < lines.length) {
                block.push(lines[i]);
                if (lines[i].trimEnd().endsWith(';')) break;
                i++;
            }
            const sql = block.join('\n').replace(/\r/g, '');
            indexes.set(hash(sql), sql);
            i++;
            continue;
        }

        // ── CREATE POLICY ──
        if (/^CREATE\s+POLICY/i.test(line)) {
            const block = [];
            const nameMatch = line.match(/POLICY\s+"?([\w\s]+)"?\s+ON/i);
            const name = nameMatch ? nameMatch[1].trim().toLowerCase() : hash(line);

            while (i < lines.length) {
                block.push(lines[i]);
                if (lines[i].trimEnd().endsWith(';')) break;
                i++;
            }
            policies.set(name, block.join('\n').replace(/\r/g, ''));
            i++;
            continue;
        }

        // ── CREATE TRIGGER ──
        if (/^CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER/i.test(line)) {
            const block = [];
            const nameMatch = line.match(/TRIGGER\s+([\w]+)/i);
            const name = nameMatch ? nameMatch[1].toLowerCase() : hash(line);

            while (i < lines.length) {
                block.push(lines[i]);
                if (lines[i].trimEnd().endsWith(';')) break;
                i++;
            }
            triggers.set(name, block.join('\n').replace(/\r/g, ''));
            i++;
            continue;
        }

        // ── CREATE EXTENSION ──
        if (/^CREATE\s+EXTENSION/i.test(line)) {
            const block = [];
            while (i < lines.length) {
                block.push(lines[i]);
                if (lines[i].trimEnd().endsWith(';')) break;
                i++;
            }
            const sql = block.join('\n').replace(/\r/g, '');
            extensions.set(hash(sql), sql);
            i++;
            continue;
        }

        // ── ALTER TABLE ... ENABLE ROW LEVEL SECURITY ──
        if (/^ALTER\s+TABLE.*ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(line)) {
            const sql = lines[i].replace(/\r/g, '');
            enableRls.push(sql);
            i++;
            continue;
        }

        // ── ALTER TABLE (other) ──
        if (/^ALTER\s+TABLE/i.test(line)) {
            const block = [];
            while (i < lines.length) {
                block.push(lines[i]);
                if (lines[i].trimEnd().endsWith(';')) break;
                i++;
            }
            const sql = block.join('\n').replace(/\r/g, '');
            const h = hash(sql);
            if (!seenHashes.has(h)) {
                seenHashes.add(h);
                alterBlocks.push(sql);
            }
            i++;
            continue;
        }

        // ── GRANT ──
        if (/^GRANT\s+/i.test(line)) {
            const block = [];
            while (i < lines.length) {
                block.push(lines[i]);
                if (lines[i].trimEnd().endsWith(';')) break;
                i++;
            }
            const sql = block.join('\n').replace(/\r/g, '');
            grants.set(hash(sql), sql);
            i++;
            continue;
        }

        // ── DROP statements ──
        if (/^DROP\s+/i.test(line)) {
            const block = [];
            while (i < lines.length) {
                block.push(lines[i]);
                if (lines[i].trimEnd().endsWith(';')) break;
                i++;
            }
            const sql = block.join('\n').replace(/\r/g, '');
            dropStatements.push(sql);
            i++;
            continue;
        }

        // ── INSERT INTO ──
        if (/^INSERT\s+INTO/i.test(line)) {
            const block = [];
            while (i < lines.length) {
                block.push(lines[i]);
                if (lines[i].trimEnd().endsWith(';')) break;
                i++;
            }
            const sql = block.join('\n').replace(/\r/g, '');
            const h = hash(sql);
            if (!seenHashes.has(h)) {
                seenHashes.add(h);
                inserts.push(sql);
            }
            i++;
            continue;
        }

        // ── NOTIFY ──
        if (/^NOTIFY\s+pgrst/i.test(line)) {
            i++;
            continue;  // We add one at the end
        }

        // ── DO $$ blocks (inline PL/pgSQL) ──
        if (/^DO\s+\$\$/i.test(line)) {
            const block = [];
            let dollarCount = 0;
            while (i < lines.length) {
                block.push(lines[i]);
                dollarCount += (lines[i].match(/\$\$/g) || []).length;
                if (dollarCount >= 2 && dollarCount % 2 === 0) break;
                i++;
            }
            const sql = block.join('\n').replace(/\r/g, '');
            const h = hash(sql);
            if (!seenHashes.has(h)) {
                seenHashes.add(h);
                miscBlocks.push(sql);
            }
            i++;
            continue;
        }

        // ── SELECT cron.schedule ──
        if (/^SELECT\s+cron\./i.test(line)) {
            const block = [];
            while (i < lines.length) {
                block.push(lines[i]);
                if (lines[i].trimEnd().endsWith(';')) break;
                i++;
            }
            cronJobs.push(block.join('\n').replace(/\r/g, ''));
            i++;
            continue;
        }

        // ── CREATE SCHEMA ──
        if (/^CREATE\s+SCHEMA/i.test(line)) {
            const sql = lines[i].replace(/\r/g, '');
            miscBlocks.push(sql);
            i++;
            continue;
        }

        // ── Catch-all: collect the statement ──
        {
            const block = [];
            while (i < lines.length) {
                block.push(lines[i]);
                if (lines[i].trimEnd().endsWith(';')) break;
                i++;
            }
            const sql = block.join('\n').replace(/\r/g, '');
            if (sql.trim().length > 3) {
                const h = hash(sql);
                if (!seenHashes.has(h)) {
                    seenHashes.add(h);
                    miscBlocks.push(sql);
                }
            }
            i++;
        }
    }
}

// ─── Assemble baseline ─────────────────────────────────────────────────────

const out = [];

out.push(`-- =============================================================================`);
out.push(`-- JOSEPHINE — CONSOLIDATED BASELINE SCHEMA`);
out.push(`-- Generated: ${new Date().toISOString().split('T')[0]}  |  Squashed from ${files.length} migrations`);
out.push(`-- =============================================================================`);
out.push(`-- Each function/view appears exactly ONCE (the latest version).`);
out.push(`-- Tables appear once (first CREATE) + all ALTER TABLE statements.`);
out.push(`-- This file IS the schema. When in doubt, this is the source of truth.`);
out.push(``);

// Section helper
const section = (title, count) => {
    out.push(``);
    out.push(`-- ═══════════════════════════════════════════════════════════════════════════`);
    out.push(`-- ${title}${count !== undefined ? ` (${count})` : ''}`);
    out.push(`-- ═══════════════════════════════════════════════════════════════════════════`);
    out.push(``);
};

// Extensions
if (extensions.size > 0) {
    section('EXTENSIONS', extensions.size);
    for (const sql of extensions.values()) out.push(sql + '\n');
}

// Misc (schemas, DO blocks)
if (miscBlocks.length > 0) {
    section('SCHEMA SETUP & MISC', miscBlocks.length);
    for (const sql of miscBlocks) out.push(sql + '\n');
}

// Tables
if (tables.size > 0) {
    section('TABLES', tables.size);
    for (const [name, sql] of [...tables.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        out.push(`-- table: ${name}`);
        out.push(sql + '\n');
    }
}

// ALTER TABLE
if (alterBlocks.length > 0) {
    section('TABLE ALTERATIONS', alterBlocks.length);
    for (const sql of alterBlocks) out.push(sql + '\n');
}

// Enable RLS
if (enableRls.length > 0) {
    section('ROW LEVEL SECURITY — ENABLE', enableRls.length);
    const unique = [...new Set(enableRls)];
    for (const sql of unique) out.push(sql);
    out.push('');
}

// Indexes
if (indexes.size > 0) {
    section('INDEXES', indexes.size);
    for (const sql of indexes.values()) out.push(sql + '\n');
}

// Views
if (views.size > 0) {
    section('VIEWS', views.size);
    for (const [name, sql] of [...views.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        out.push(`-- view: ${name}`);
        out.push(sql + '\n');
    }
}

// Materialized Views
if (matViews.size > 0) {
    section('MATERIALIZED VIEWS', matViews.size);
    for (const [name, sql] of [...matViews.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        out.push(`-- materialized view: ${name}`);
        out.push(sql + '\n');
    }
}

// Functions
if (functions.size > 0) {
    section('FUNCTIONS', functions.size);
    for (const [name, sql] of [...functions.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        out.push(`-- function: ${name}`);
        out.push(sql + '\n');
    }
}

// Triggers
if (triggers.size > 0) {
    section('TRIGGERS', triggers.size);
    for (const [name, sql] of triggers) {
        out.push(`-- trigger: ${name}`);
        out.push(sql + '\n');
    }
}

// Policies
if (policies.size > 0) {
    section('ROW LEVEL SECURITY — POLICIES', policies.size);
    for (const [name, sql] of [...policies.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        out.push(`-- policy: ${name}`);
        out.push(sql + '\n');
    }
}

// Grants
if (grants.size > 0) {
    section('GRANTS', grants.size);
    for (const sql of grants.values()) out.push(sql);
    out.push('');
}

// Inserts (seeds/config)
if (inserts.length > 0) {
    section('SEED DATA & CONFIGURATION', inserts.length);
    for (const sql of inserts) out.push(sql + '\n');
}

// Cron
if (cronJobs.length > 0) {
    section('CRON JOBS', cronJobs.length);
    for (const sql of cronJobs) out.push(sql + '\n');
}

// Schema reload
out.push(`\n-- ═══════════════════════════════════════════════════════════════════════════`);
out.push(`-- SCHEMA RELOAD`);
out.push(`-- ═══════════════════════════════════════════════════════════════════════════\n`);
out.push(`NOTIFY pgrst, 'reload schema';`);

const output = out.join('\n');
const outPath = join(ROOT, 'supabase', 'schema-baseline.sql');
writeFileSync(outPath, output);

// Stats
console.log(`\n📊 Schema Summary:`);
console.log(`   Extensions:  ${extensions.size}`);
console.log(`   Tables:      ${tables.size}`);
console.log(`   ALTER TABLEs: ${alterBlocks.length}`);
console.log(`   Indexes:     ${indexes.size}`);
console.log(`   Views:       ${views.size}`);
console.log(`   Mat. Views:  ${matViews.size}`);
console.log(`   Functions:   ${functions.size}`);
console.log(`   Triggers:    ${triggers.size}`);
console.log(`   Policies:    ${policies.size}`);
console.log(`   Grants:      ${grants.size}`);
console.log(`   Inserts:     ${inserts.length}`);
console.log(`   Cron jobs:   ${cronJobs.length}`);
console.log(`   Misc blocks: ${miscBlocks.length}`);
console.log(`\n✅ Generated: ${outPath}`);
console.log(`   Size: ${(output.length / 1024).toFixed(1)} KB (down from ${files.length} files)`);
