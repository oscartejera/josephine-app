# Agent Reference: Architecture & Conventions

> Extracted from CLAUDE.md — this file is loaded on-demand, not every prompt.
> For core rules, see CLAUDE.md directly.

## Source of Truth Order

When sources disagree, trust them in this order:

1. current code paths in use
2. current database migrations
3. generated Supabase types (`src/integrations/supabase/types.ts`)
4. tests and contract checks (`src/data/__tests__/rpc-contracts.test.ts`)
5. generated catalogs (`docs/rpc-catalog.md`)
6. narrative docs
7. older notes or legacy writeups

## Orchestration Roles

For non-trivial tasks, reason in these specialist passes:

- **Scout**: Find relevant files, routes, hooks, contexts, stores, shared utilities, tests, docs
- **Data auditor**: Inspect Supabase tables, views, RPCs, migrations, types, edge functions, contracts
- **UI/Flow auditor**: Inspect pages, component trees, state transitions, guarded routes, demo vs real
- **Test validator**: Decide minimum credible validation (lint, build, typecheck, contract test, demo verify, Playwright)
- **Elegance reviewer**: Simplify, remove churn, fit existing patterns, avoid ugly patches

## Validation Matrix

| Change type | Validate with |
|---|---|
| UI copy / presentational | manual browser + `npm run build` |
| Component logic / hooks | `lint` + `tsc` + targeted tests + manual browser |
| Data / analytics / RPC | `tsc` + `vitest run rpc-contracts.test.ts` |
| Migrations | `db:lint` + schema review + types regen |
| Demo data | `demo:verify` + manual browser |
| Routes / auth / guards | `build` + `tsc` + manual route verification |
| E2E critical flows | `npm run test:e2e` (Playwright) |

**Note**: Passing lint/typecheck/build does NOT prove the UX is correct.

## SQL Safety Rules

- `CREATE TABLE IF NOT EXISTS` (never bare CREATE TABLE)
- `CREATE OR REPLACE FUNCTION/VIEW`
- `DROP` only with `IF EXISTS`
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- `NOTIFY pgrst, 'reload schema';` when touching functions/views
- If replacing a function with signature conflicts: `DROP FUNCTION IF EXISTS` first

## Environment Safety

**Safe actions**: reading code/docs, lint, build, typecheck, non-destructive tests.

**Higher-risk** (extra caution): migrations, seed scripts, repair scripts, service-role writes, realtime simulators, ETL/sync, remote DB writes, edge function deploys.

If target environment is unclear → state uncertainty, prefer review-first.

## Secrets Rules

- **Demo org:** `7bca34d5-4448-40b8-bb7f-55f1417aeccd`
- **Demo login:** See `.env.local` (`DEMO_EMAIL` / `DEMO_PASSWORD`)
- All secrets in `.env.local` (gitignored) — never hardcode
- Never commit secrets, never place in hooks, never echo tokens in scripts
- Secrets belong in: local env vars, secret managers, or platform settings

## Project Structure

```text
src/
  components/        # Feature-organized React components
    ui/              # shadcn/ui primitives
    layout/          # Layout surfaces
    [feature]/       # Domain components
  contexts/          # AuthContext, AppContext, DemoModeContext
  data/              # Data layer, contracts, typed RPC access, tests
  hooks/             # Domain hooks
  pages/             # Route-level pages
  stores/            # Zustand stores
  lib/               # Utilities
  integrations/      # Supabase client + generated DB types
  i18n/              # Locale files and config
  types/             # Shared TS types

supabase/
  functions/         # Edge Functions
  migrations/        # Database migrations

docs/                # Contracts, KPI docs, RPC catalog, demo docs
mcp/josephine-mcp/   # Internal MCP server for operational tools
```
