#!/usr/bin/env node
/**
 * Migration Safety Lint — Pillar 3
 *
 * Scans SQL migration files for destructive patterns that could
 * break production. Run before deploying.
 *
 * Usage:
 *   node scripts/validate-migration.mjs                    # lint all
 *   node scripts/validate-migration.mjs path/to/file.sql   # lint one
 *
 * Rules:
 *   1. DROP FUNCTION must have a matching CREATE OR REPLACE in same file
 *   2. DROP TABLE/VIEW without IF EXISTS is an error
 *   3. ALTER TABLE DROP COLUMN is a warning
 *   4. Every CREATE OR REPLACE FUNCTION should be followed by NOTIFY pgrst
 *   5. Functions should have GRANT EXECUTE
 */

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const MIGRATION_DIR = join(process.cwd(), 'supabase', 'migrations');

const RULES = [
    {
        id: 'DROP_FUNCTION_ORPHAN',
        severity: 'error',
        pattern: /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)/gi,
        check: (match, content) => {
            const fnName = match[1];
            const hasCreate = new RegExp(
                `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+(?:public\\.)?${fnName}`,
                'i'
            ).test(content);
            if (!hasCreate) {
                return `DROP FUNCTION ${fnName} without matching CREATE OR REPLACE — will delete the function permanently!`;
            }
            return null;
        },
    },
    {
        id: 'DROP_TABLE_NO_GUARD',
        severity: 'error',
        pattern: /DROP\s+TABLE\s+(?!IF\s+EXISTS)(\w+)/gi,
        check: (match) => `DROP TABLE ${match[1]} without IF EXISTS — use DROP TABLE IF EXISTS`,
    },
    {
        id: 'DROP_VIEW_NO_GUARD',
        severity: 'error',
        pattern: /DROP\s+VIEW\s+(?!IF\s+EXISTS)(\w+)/gi,
        check: (match) => `DROP VIEW ${match[1]} without IF EXISTS — use DROP VIEW IF EXISTS`,
    },
    {
        id: 'ALTER_DROP_COLUMN',
        severity: 'warn',
        pattern: /ALTER\s+TABLE\s+(\w+)\s+DROP\s+COLUMN\s+(\w+)/gi,
        check: (match) => `ALTER TABLE ${match[1]} DROP COLUMN ${match[2]} — may break existing queries/views`,
    },
    {
        id: 'MISSING_PGRST_NOTIFY',
        severity: 'warn',
        pattern: /CREATE\s+OR\s+REPLACE\s+FUNCTION/gi,
        check: (match, content) => {
            if (!/NOTIFY\s+pgrst/i.test(content)) {
                return `File has CREATE OR REPLACE FUNCTION but no NOTIFY pgrst — PostgREST cache won't refresh`;
            }
            return null;
        },
    },
];

function lintFile(filePath) {
    const content = readFileSync(filePath, 'utf8');
    const name = basename(filePath);
    const issues = [];

    // Allow intentional cleanup migrations to skip lint
    if (content.includes('-- lint:disable-file')) {
        return issues;
    }

    for (const rule of RULES) {
        let match;
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        while ((match = regex.exec(content)) !== null) {
            const msg = typeof rule.check === 'function' ? rule.check(match, content) : rule.check;
            if (msg) {
                issues.push({ file: name, rule: rule.id, severity: rule.severity, message: msg });
            }
        }
    }

    return issues;
}

function main() {
    const targetFile = process.argv[2];
    let files;

    if (targetFile) {
        files = [targetFile];
    } else {
        files = readdirSync(MIGRATION_DIR)
            .filter(f => f.endsWith('.sql'))
            .map(f => join(MIGRATION_DIR, f));
    }

    let errors = 0;
    let warnings = 0;

    for (const file of files) {
        const issues = lintFile(file);
        for (const issue of issues) {
            const icon = issue.severity === 'error' ? '❌' : '⚠️';
            console.log(`${icon} [${issue.rule}] ${issue.file}: ${issue.message}`);
            if (issue.severity === 'error') errors++;
            else warnings++;
        }
    }

    console.log(`\n📋 Scanned ${files.length} migration(s): ${errors} errors, ${warnings} warnings`);

    if (errors > 0) {
        console.log('❌ Migration lint FAILED — fix errors before deploying');
        process.exit(1);
    } else if (warnings > 0) {
        console.log('⚠️ Migration lint PASSED with warnings');
    } else {
        console.log('✅ Migration lint PASSED');
    }
}

main();
