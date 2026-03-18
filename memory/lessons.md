# Project Lessons

This file captures hard-won technical lessons from bugs, regressions, fragile fixes, and architectural surprises.

Use this file to avoid paying twice for the same mistake.

## How to use this file

Add a new entry when:
- a bug reveals a reusable pattern
- a regression exposes a fragile surface
- a fix required non-obvious validation
- code, schema, or tooling drift caused confusion
- a repo-specific gotcha should be remembered

Each entry should be:
- specific
- technical
- actionable
- tied to a prevention rule
- tied to a validation method

---

## Entry Template

### <Lesson Title>

**Date:** YYYY-MM-DD
**Area:** <UI / Data / Auth / Demo / DB / i18n / Edge Functions / Tooling / Testing>
**Root cause:** <short explanation>
**What failed:** <short explanation>
**Prevention:** <specific rule>
**Validation:** <specific checks>
**Notes:** <optional concise note>

---

## Seed Lessons

### Regex bulk edits corrupted TypeScript / JSX structure

**Date:** 2026-03-18
**Area:** i18n / Tooling
**Root cause:** Regex-based bulk edits were used on `.ts` / `.tsx` files during a large-scale i18n migration.
**What failed:** Regex could not safely distinguish JSX tags, TypeScript generics, imports, and user-facing string replacements, creating structural corruption that was not reliably caught by basic checks.
**Prevention:** Never use regex-based bulk edits on `.ts` or `.tsx` for structural or large-scale source changes. Use AST-based tools or targeted manual edits.
**Validation:** `npx tsc --noEmit`, `npm run build`, and browser verification on affected flows.
**Notes:** Passing typecheck alone is not enough when UI structure may have been altered.

### Missing provider normalization can make valid POS data invisible

**Date:** 2026-03-18
**Area:** Data / Integrations
**Root cause:** Frontend logic depends on normalized provider-specific `data_source` values.
**What failed:** If a new POS provider is added and `normaliseDataSource()` is not updated, valid POS-backed data may be treated as non-POS data and appear missing in the UI.
**Prevention:** Every new POS integration must update `normaliseDataSource()` in `src/data/client.ts` and validate downstream dashboard behavior.
**Validation:** Verify affected analytics, KPI cards, and data-backed screens with the new provider path.
**Notes:** This is a repo-specific gotcha and should always be checked during integration work.

### Demo mode and real mode can silently diverge

**Date:** 2026-03-18
**Area:** Demo / UI / Data
**Root cause:** Some features or fixes are implemented only against real Supabase-backed data paths without verifying demo-mode branches.
**What failed:** The product appeared correct in real mode but demo mode regressed, which is especially harmful because demo mode is a primary sales surface.
**Prevention:** Any change touching dashboards, flows, or data surfaces must consider both real mode and demo mode unless the task explicitly targets only one mode.
**Validation:** `npm run demo:verify` plus manual verification of the affected flow in demo mode.
**Notes:** Demo mode is not a fallback; it is a first-class product surface.

### Materialized views can be stale and should not be treated as guaranteed fresh

**Date:** 2026-03-18
**Area:** Data / Analytics
**Root cause:** Some analytics paths assume materialized views are fresh at read time.
**What failed:** KPIs or derived analytics can lag behind reality if the path relies only on stale matviews without fallback logic.
**Prevention:** Treat `*_mv` as potentially stale and prefer resilient access paths or fallback logic where freshness matters.
**Validation:** Review query path, RPC behavior, and fallback logic for affected metrics.
**Notes:** This matters most in KPI, reporting, and operational dashboard flows.

### Secrets must never be distributed through repo hooks or versioned scripts

**Date:** 2026-03-18
**Area:** Security / Tooling
**Root cause:** Hooks or helper scripts can become a channel for distributing live credentials if they create env files or inject tokens.
**What failed:** A session hook can accidentally expose Supabase or GitHub credentials and normalize insecure behavior.
**Prevention:** Never place live credentials in `.claude/hooks/*`, scripts, committed examples, or versioned `.env*` files. Use local environment variables or secure secret managers.
**Validation:** Review hooks and scripts for hardcoded credentials, token writes, CLI auth injection, and service-role usage.
**Notes:** If a real secret is detected in repo code, remove it and rotate it.

### Root and nested Playwright configs are not interchangeable

**Date:** 2026-03-18
**Area:** Testing / Tooling
**Root cause:** The repo contains two Playwright configurations with different test directory assumptions.
**What failed:** A contributor can run the wrong E2E suite or assume both configs cover the same behavior.
**Prevention:** Default to the root Playwright setup unless the task explicitly targets the alternate one. Document which suite is being used.
**Validation:** Confirm which config is active and run `npm run test:e2e` unless there is a deliberate reason to target the alternate config.
**Notes:** Avoid assuming E2E coverage from one config applies to the other.

### `src/data/*` is a contract surface, not just a helper layer

**Date:** 2026-03-18
**Area:** Data / Frontend contracts
**Root cause:** Changes in `src/data/*` can look local but actually affect many screens and typed assumptions.
**What failed:** Frontend pages, hooks, KPIs, and tests can break when data-layer contract shapes change without corresponding validation.
**Prevention:** Treat `src/data/*` as a contract boundary. Validate typed shapes, RPC compatibility, and downstream consumers before closing changes.
**Validation:** `npx tsc --noEmit`, `npx vitest run src/data/__tests__/rpc-contracts.test.ts`, and targeted UI verification.
**Notes:** Small data-layer edits can have broad product impact.

---

## New Entries

Add new lessons below this line using the template above.

### Seed data using absolute dates expires silently

**Date:** 2026-03-18
**Area:** Demo / DB
**Root cause:** The baseline migration seeded `daily_sales` with `CURRENT_DATE - 30 to +7` evaluated once at migration time. After ~37 days the data fell outside all valid query ranges.
**What failed:** All dashboard KPIs showed zero because `sales_daily_unified` and `rpc_kpi_range_summary` found no rows within the selected date range.
**Prevention:** All seed/demo data must use rolling `CURRENT_DATE` offsets or be regenerated on a schedule. Never seed demo tables with fixed absolute dates. Prefer cron-based reseed or wide windows (≥90 days).
**Validation:** `SELECT count(*) FROM daily_sales WHERE day >= CURRENT_DATE - 7;` must return >0 for each active location.
**Notes:** This affected `daily_sales`, `budget_days`, `forecast_daily_metrics`, and `planned_shifts` simultaneously.

### Seed function must write to the table the dashboard actually reads

**Date:** 2026-03-18
**Area:** Data / Edge Functions
**Root cause:** `seed_josephine_demo` wrote granular 15-min data to `facts_sales_15m`, but the dashboard pipeline reads from `daily_sales` via `sales_daily_unified` → `rpc_kpi_range_summary`.
**What failed:** Even after re-running the seed function, dashboard KPIs remained zero because the data landed in a table nothing reads from for KPI display.
**Prevention:** Before writing seed data, trace the full read path from the UI component back to the source table. Confirm the seed target is the same table the UI queries. Document the pipeline in `docs/data-pipeline.md`.
**Validation:** After seeding, query the exact RPC/view the dashboard uses (e.g. `SELECT * FROM sales_daily_unified WHERE day = CURRENT_DATE LIMIT 1`) and confirm rows exist.
**Notes:** `facts_sales_15m` is only used by granular intra-day analytics, not the main dashboard KPIs.

### Default date range should not require exact-day data match

**Date:** 2026-03-18
**Area:** UI / Data
**Root cause:** Default `dateRange` was `'today'`, which requires seed data for exactly today's date. If the seed window doesn't include today (or data hasn't been ingested yet), the dashboard shows nothing.
**What failed:** New users and demos saw all-zero KPIs on first load because demo data didn't always cover `CURRENT_DATE`.
**Prevention:** Default date range should be `'7d'` (or wider) so there's always some data visible even if today's data is missing. Reserve `'today'` for users who explicitly select it.
**Validation:** Load the dashboard with a fresh session and confirm KPIs are non-zero without changing the date picker.
**Notes:** This is especially important for demo/sales contexts where first impression matters.

### Supabase CLI reads SUPABASE_DB_PASSWORD from shell env, not .env.local

**Date:** 2026-03-18
**Area:** Tooling / DB
**Root cause:** `npx supabase db push` requires `SUPABASE_DB_PASSWORD` as a **shell environment variable**. Adding it to `.env.local` is not enough because `.env.local` is for Next.js/Vite, not for CLI tools.
**What failed:** `supabase db push` returned 401 even after the password was in `.env.local`. The CLI also needs a valid `SUPABASE_ACCESS_TOKEN` or must load the password into the shell via `$env:SUPABASE_DB_PASSWORD = ...` before running.
**Prevention:** When running `supabase db push`, always load the password into the shell first: `$env:SUPABASE_DB_PASSWORD = (Select-String -Path .env.local -Pattern '^SUPABASE_DB_PASSWORD=(.+)$' | ForEach-Object { $_.Matches.Groups[1].Value }); npx supabase db push`
**Validation:** `npx supabase db push` returns `Remote database is up to date` without 401 errors.
**Notes:** The `--db-url` flag is an alternative but requires the correct direct host format: `postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres`.
