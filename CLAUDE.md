# CLAUDE.md

## Language

Always respond in **Spanish** to the user. Code, comments, and commit messages stay in English.

## ⚠️ Mandatory Deploy Review (ALWAYS)

After EVERY deploy/push to main, you MUST:
1. **Check Vercel deploy status** — wait for deploy to finish
2. **Open the production URL** (https://www.josephine-ai.com) with the browser tool
3. **Navigate to every page affected by the change** and take a screenshot
4. **Verify visually** that the UI renders correctly, data loads, and no errors appear
5. **Report the results** to the user with screenshots

This is NON-NEGOTIABLE. Never skip this step. The user must see proof that the deploy works correctly in the real UI.

## ⚠️ Mandatory Commit & Push (ALWAYS)

After finishing ANY task (bug fix, feature, refactor, etc.), you MUST:
1. **`git add` the changed files** and **`git commit`** with a clear conventional commit message
2. **`git push origin main`** — always push to main on GitHub, no exceptions
3. **If DB changes were made** (new tables, columns, RLS policies, functions, etc.), **run `supabase db push`** to apply them to production
4. Never consider a task "done" until the code is committed and pushed to `main` on GitHub.

## Project Overview

Josephine is an AI-powered operations platform for restaurants. It connects to existing POS systems (Square, Lightspeed, Toast) via OAuth + webhooks and provides intelligent insights, forecasting, recommendations, and automated operations management.

## Tech Stack

- **Frontend:** React 18 + TypeScript, Vite 5, React Router v6
- **Styling:** Tailwind CSS 3 with CSS variables for theming, shadcn/ui (Radix primitives)
- **State:** React Context (auth, app globals, demo mode), Zustand (notifications, availability), TanStack React Query (server state)
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Forms:** react-hook-form + Zod validation
- **i18n:** i18next (Spanish default, English, Catalan)
- **Charts:** Recharts
- **Mobile:** Capacitor (iOS/Android)
- **AI/ML:** Prophet (forecasting via Modal Labs), Claude API (narratives + recommendations)

## Commands

```bash
npm run dev          # Start dev server (port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint check
npm test             # Run tests once (vitest run)
npm run test:watch   # Run tests in watch mode
npm run preview      # Preview production build
```

## Project Structure

```
src/
  components/        # Feature-organized React components (~187 components)
    ui/              # shadcn/ui library components (48)
    layout/          # DashboardLayout, AppSidebar, TopBar
    [feature]/       # Domain components (sales, labour, inventory, ai, etc.)
  pages/             # Page-level route components
  contexts/          # AuthContext, AppContext, DemoModeContext
  hooks/             # Custom hooks (29) - data fetching, permissions, domain logic
  stores/            # Zustand stores (notifications, availability)
  lib/               # Utilities, forecast client, data generators
  integrations/      # Supabase client and auto-generated DB types
  types/             # Shared TypeScript types
  i18n/              # i18next config and locale files (es, en, ca)
  test/              # Test setup and test files
  ai-tools-core/     # Shared tool logic (portable Node ↔ Deno)
    lib/             # errors, pagination, response, writeGuard, circuitBreaker, runtime
    types.ts         # TenantContext, GuardContext, ToolClients, Execution
    registry.ts      # TOOL_METADATA with RBAC per tool
    index.ts         # Barrel export
supabase/
  functions/         # Edge Functions (22) - forecast, AI, POS sync, payroll, ai-tools
  migrations/        # Database schema migrations
scripts/             # Helper scripts (data seeding, simulation)
```

## Code Conventions

### TypeScript

- Path alias: `@/*` maps to `./src/*`
- Strict mode is disabled (`noImplicitAny: false`, `strictNullChecks: false`)
- Target: ES2020 for app code, ES2022 for build tooling

### Components

- **UI primitives** go in `src/components/ui/` (shadcn/ui pattern)
- **Feature components** go in `src/components/[feature-name]/`
- **Pages** go in `src/pages/`
- Components use Tailwind classes for styling (no CSS modules or styled-components)

### State Management Pattern

```
Supabase DB -> React Query hooks -> Custom data hooks -> Components
Context API for auth/app state, Zustand for UI state (notifications)
```

### Styling

- Tailwind CSS with CSS variable-based theming
- Dark mode support via class strategy
- Custom fonts: Inter (sans), Plus Jakarta Sans (display)
- Use `cn()` utility (clsx + tailwind-merge) for conditional classes

### Internationalization

- All user-facing strings should use i18next translation keys
- Locale files: `src/i18n/locales/{es,en,ca}.json`
- Spanish is the default language

### Linting

- ESLint with typescript-eslint, react-hooks, and react-refresh plugins
- Unused variables rule is disabled
- `react-refresh/only-export-components` set to warn

### Testing

- Vitest with jsdom environment
- Testing Library for component tests
- Setup file mocks `window.matchMedia`

#### Unit / Integration Tests (Vitest)
```bash
npx vitest run src/data/__tests__/schedule-efficiency.test.ts  # SPLH + budget validation
npx vitest run src/data/__tests__/waste-audit.test.ts          # Waste + stock audit flows
```

#### E2E Tests (Playwright)
```bash
# Auth bypass: tests/auth.setup.ts injects mock Supabase session into localStorage
# Set SUPABASE_TEST_EMAIL + SUPABASE_TEST_PASSWORD for real login, or use mock bypass
npx playwright test tests/global-sanity.spec.ts
```

The auth bypass works by injecting a `sb-{project_ref}-auth-token` key into localStorage before navigation. The Supabase client picks this up on reload, bypassing the login screen.

## Key Architecture Notes

- **Demo Mode:** Toggle between real Supabase data and simulated mock data via DemoModeContext
- **RBAC:** Role-based access (Owner, Manager, Supervisor, Employee) with location-scoped permissions
- **POS Integration:** Square POS via OAuth + incremental webhook sync
- **AI Integration:** Prophet forecasting and Claude API insights both run as Supabase Edge Functions
- **Feature Store:** Facts tables for time-series aggregation (15min, hourly, daily)

### ⚠️ MANDATORY: Data-Source Normalization

> **The `data_source` column in base tables uses provider-specific names (e.g., `'cover_manager'`, `'square'`, `'lightspeed'`). The frontend normalizes these to `'pos'` or `'demo'`.**

#### `normaliseDataSource()` in `src/data/client.ts`

```typescript
// 'cover_manager' | 'square' | 'lightspeed' | 'toast' | 'clover' | 'revel' | 'pos' → 'pos'
// everything else → 'demo'
```

**⚠️ CRITICAL BUG PATTERN**: If you add a new POS integration, you MUST add its data_source string to `normaliseDataSource()` or all product/sales data from that source will be invisible.

### Data Pipeline Architecture

The application has **unified views** that UNION demo and POS paths, plus **base tables** that contain the most up-to-date data:

| Data | Base table (freshest) | Unified view | Materialized view (may be stale) |
|------|----------------------|--------------|----------------------------------|
| Sales | `pos_daily_finance` | `sales_daily_unified` | `mv_sales_daily` |
| Products | `pos_daily_products` | `product_sales_daily_unified` | `product_sales_daily_unified_mv` |
| Labour | `planned_shifts` × `employees.hourly_cost` | `labour_daily_unified` | — |
| Forecast | `forecast_daily_metrics` | `forecast_daily_unified` | — |
| COGS (stock) | `stock_movements` | `cogs_daily` (view) | — |
| COGS (POS) | `pos_daily_products.cogs` | — | — |
| COGS (manual) | `monthly_cost_entries` | — | — |

### ⚠️ MANDATORY: Materialized View Staleness

> **Materialized views (`*_mv`) can become stale.** RPCs MUST include fallback logic to query base tables when matviews have no data for the requested date range.

**Current matviews:**
- `product_sales_daily_unified_mv` — may lag behind `pos_daily_products`
- `mart_sales_category_daily_mv` — may lag behind `pos_daily_products`  
- `mart_kpi_daily_mv` — may lag behind `sales_daily_unified`
- `mv_sales_daily`, `mv_sales_hourly` — refreshed by triggers

**Refresh strategy**: `REFRESH MATERIALIZED VIEW <name>` via `scripts/run-migration.mjs` or `refresh_all_mvs()` RPC. Always build RPCs with fallback to base tables.

### COGS Pipeline (3-Source Aggregation)

COGS (Cost of Goods Sold) aggregates from **three sources** using `GREATEST()` to pick the best available data:

| Source | Table | Coverage | Priority |
|--------|-------|----------|----------|
| POS receipt-level | `pos_daily_products.cogs` | Most up-to-date (per product per day) | 1st (preferred) |
| Stock movements | `cogs_daily` view (from `stock_movements`) | When inventory tracking is active | 2nd |
| Manual entries | `monthly_cost_entries` | Monthly manual cost entries | 3rd |

**Used in:**
- `rpc_kpi_range_summary` — aggregates all 3 sources for KPI cards
- `get_top_products_unified` — returns per-product COGS from `pos_daily_products`
- `useTopProducts` hook — prioritizes RPC COGS over stale `mart_sales_category_daily`

**⚠️ NEVER hardcode COGS percentages** (e.g., `sales * 0.28`). Always read from actual data sources.

### Data Source Testing Rules

1. **SQL/RPC changes**: Use `::uuid` casts in filters: `location_id::uuid = ANY(v_loc_filter)`
2. **New tables**: Verify column types match both demo and POS paths.
3. **Frontend**: Use `useDemoMode()` if behaviour diverges. Otherwise rely on unified views.
4. **Testing**: Verify Dashboard works as Demo Owner (`owner@demo.com`).
5. **Never break demo**: Demo mode is the primary sales tool.

## Workflow & Deployment

### CI/CD Pipeline

- **GitHub -> Vercel:** Auto-deploy on merge to `main`. No manual deploy needed.
- **Supabase:** Integrated with GitHub and Vercel via Supabase integration.
- Push to branch -> Create PR -> Merge to `main` -> Vercel deploys automatically.

### How Claude Should Operate — AUTO-DEPLOY RULES

> **MANDATORY**: Every code change MUST be committed and pushed to `main` immediately. Every database change MUST be applied to Supabase automatically. The user has explicitly authorized this workflow.

> **MANDATORY — VERIFY BEFORE COMMIT**: Before committing AND pushing ANY change, Claude MUST open the browser, navigate to `https://josephine-ai.com`, and visually verify that the change works correctly in the UI. If it doesn't work, iterate and fix until it does. Only commit and push when the UI is confirmed working.

#### Step 0 — ALWAYS: Browser verification before commit
1. **Make the change** (code, SQL, edge function)
2. **For DB changes**: Apply SQL to production Supabase first
3. **For Edge Functions**: Deploy to Supabase first
4. **For frontend changes**: Wait for Vercel preview or use `npm run dev` locally
5. **Open the browser** using the browser tool and navigate to `https://josephine-ai.com`
6. **Log in** by clicking the **"Probar Josephine"** button on the login page — this auto-fills demo credentials. **NEVER type credentials manually.**
7. **Take a screenshot** and verify the change works in the UI
8. **If it doesn't work** → go back to step 1, fix the issue, and re-verify
9. **If it works** → proceed to commit and push
10. **Keep iterating** until the UI confirms the change is correct — never commit broken code

> ⚠️ **LOGIN RULE**: When opening Josephine in the browser to verify, ALWAYS click the **"Probar Josephine"** button. This demo-login button exists on the landing/login page and auto-fills+submits the demo owner credentials. Do NOT manually type `owner@demo.com` / `Demo1234!`.

#### On every code change:
1. **Write code** directly on `main` (no feature branches, no PRs)
2. **Verify in browser** (Step 0 above)
3. **Commit immediately** with a descriptive message: `git add -A && git commit -m "..."`
4. **Push to main**: `git push origin main`
5. Vercel deploys automatically on push to `main`

#### On every database change:
1. **Create a migration file** in `supabase/migrations/` with timestamp naming: `YYYYMMDD_description.sql`
2. **Apply via Node.js runner** (handles dollar-quoting automatically):
   ```bash
   # Set SUPABASE_ACCESS_TOKEN in .env.local, then:
   node scripts/run-migration.mjs supabase/migrations/YYYYMMDD_description.sql
   ```
   Alternatively, use the Management API directly:
   ```javascript
   fetch(`https://api.supabase.com/v1/projects/qixipveebfhurbarksib/database/query`, {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
     body: JSON.stringify({ query: sql })
   })
   ```
3. **If replacing a function**: `DROP FUNCTION IF EXISTS name(params)` BEFORE `CREATE OR REPLACE`
4. **Verify in browser** (Step 0 above) — confirm the data appears correctly in the UI
5. **Commit and push** the migration file to main (same as code changes)
6. **Always run `npx supabase db push`** to sync migration state with remote
7. **Refresh materialized views** if the change affects aggregated data:
   ```sql
   REFRESH MATERIALIZED VIEW product_sales_daily_unified_mv;
   REFRESH MATERIALIZED VIEW mart_sales_category_daily_mv;
   ```

#### On Edge Function changes:
1. **Deploy the function**: `npx supabase functions deploy FUNCTION_NAME --project-ref qixipveebfhurbarksib`
2. **Verify in browser** (Step 0 above) — confirm the function works from the UI
3. **Commit and push** the code to main

#### ⚠️ End-of-Session Pipeline (MANDATORY)
> **After EVERY work session where code or DB was changed, run the `/commit-push` workflow.**
> This includes: TypeScript check → tests → `git add -A && git commit && git push origin main` → `npx supabase db push` (if SQL changed) → browser verification.
> **No exceptions. No "I'll do it next time."**

#### Summary — The golden rule:
- 🔍 **VERIFY FIRST** → open browser, click "Probar Josephine", check UI, take screenshot
- 🔁 **ITERATE** → if broken, fix and re-verify until it works
- ✅ **THEN COMMIT** → only after visual confirmation
- ✅ Code change → verify in browser → commit + push to main
- ✅ DB migration → apply SQL → `npx supabase db push` → verify in browser → commit + push
- ✅ Edge function → deploy → verify in browser → commit + push
- ❌ Never commit without browser verification
- ❌ Never use feature branches
- ❌ Never create PRs
- ❌ Never leave changes without pushing
- ❌ Never skip `npx supabase db push` when there are SQL changes

### Environment Setup (automated via session-start hook)

The `.claude/hooks/session-start.sh` hook runs automatically on every web session and handles:
1. `npm install` - installs dependencies
2. Creates `.env.local` with Supabase keys (anon + service_role)
3. Installs `gh` CLI if missing
4. Authenticates `gh` with the owner's GitHub token

No manual setup needed. Everything is automated.

### Supabase Access

> **⚠️ IMPORTANT:** ALWAYS use project `qixipveebfhurbarksib`. This is the ONLY project for both development AND production. Never use any other project ref.

- **Project ref:** `qixipveebfhurbarksib`
- **URL:** `https://qixipveebfhurbarksib.supabase.co`
- **Demo org ("Josephine"):** `7bca34d5-4448-40b8-bb7f-55f1417aeccd`
- **Demo locations:**
  - `13f383c6-0171-4c1f-9ee4-6ef6a6f04b36` — La Taberna Centro
  - `15548064-e49b-4f27-9ea5-c1caeb3093c7` — La Taberna Chamberi
  - `f9f0637c-69ae-468f-bce8-0d519aea702e` — La Taberna Malasana
  - `dcb020c2-1603-41e2-af7f-ccdba7990999` — La Taberna Salamanca
- **Demo login:** `owner@demo.com` / `Demo1234!` (user ID: `761c2d9c-9a02-4fc6-bf00-ba1b27dea3fc`)
- **JWT Key ID:** `95e87c5c-d734-4634-bcd8-45a5b8935685`
- **JWKS URL:** `https://qixipveebfhurbarksib.supabase.co/auth/v1/.well-known/jwks.json`

**All secrets live in `.env.local` (gitignored). Load them programmatically:**

```javascript
import { readFileSync } from 'fs';
const env = readFileSync('.env.local', 'utf8');
const SUPABASE_URL      = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const PUBLISHABLE_KEY   = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1].trim();
const SERVICE_ROLE_KEY  = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const ACCESS_TOKEN      = env.match(/SUPABASE_ACCESS_TOKEN=(.+)/)[1].trim();
const VERCEL_TOKEN      = env.match(/VERCEL_TOKEN=(.+)/)[1].trim();
```

#### Env vars in `.env.local`

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (baked into Vite builds) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Lovable publishable key (used by `createClient`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS — full admin access |
| `SUPABASE_ACCESS_TOKEN` | Supabase Management API (project settings, API keys, etc.) |
| `VERCEL_TOKEN` | Vercel API (deploys, env vars, domain management) |

#### Database Access (REST API via service_role)

```javascript
// Read from a table
const r = await fetch(`${SUPABASE_URL}/rest/v1/TABLE?select=*&limit=10`, {
  headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
});

// Call an RPC
const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/FUNCTION_NAME`, {
  method: 'POST',
  headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_param: 'value' })
});

// Execute raw SQL (via pg_net or service role)
const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'SELECT 1' })
});
```

#### Supabase Management API

```javascript
// List projects
await fetch('https://api.supabase.com/v1/projects', {
  headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
});

// Get API keys for project
await fetch(`https://api.supabase.com/v1/projects/qixipveebfhurbarksib/api-keys`, {
  headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
});
```

### Vercel Access

- **Project:** `josephine-app-main` (ID: `prj_TRsSpLrxQ78a2Tm0xX5ykXYjdCf4`)
- **Repo ID:** `1139737770`
- **Domains:** `www.josephine-ai.com`, `josephine-ai.com`, `josephine-app-main.vercel.app`

#### Vercel API Patterns

```javascript
const vHeaders = { 'Authorization': `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' };
const PROJECT_ID = 'prj_TRsSpLrxQ78a2Tm0xX5ykXYjdCf4';

// Trigger production deploy from git
await fetch('https://api.vercel.com/v13/deployments', {
  method: 'POST', headers: vHeaders,
  body: JSON.stringify({ name: 'josephine-app-main', project: PROJECT_ID, target: 'production',
    gitSource: { type: 'github', repoId: '1139737770', ref: 'main' } })
});

// Check deployment status
await fetch(`https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&limit=1`, { headers: vHeaders });

// Set env var
await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env`, {
  method: 'POST', headers: vHeaders,
  body: JSON.stringify({ key: 'VAR_NAME', value: 'value', type: 'plain', target: ['production','preview','development'] })
});

// Manage domains
await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/domains`, {
  method: 'POST', headers: vHeaders,
  body: JSON.stringify({ name: 'example.com' })
});
```

### Repository

- **Owner:** oscartejera
- **Repo:** oscartejera/josephine-app
- **Main branch:** `main`
- **Auto-deploy:** Every push to `main` triggers a Vercel production build

## Database Schema (96 tables)

### Core / Multi-tenant

| Table | Key columns |
|-------|-------------|
| `groups` | id, name |
| `locations` | id, group_id, name, city, timezone, currency, active |
| `profiles` | id, group_id, full_name |
| `location_settings` | location_id, target_gp_percent, target_col_percent, opening_time, closing_time, splh_goal |

### CDM (Canonical Data Model) — POS-normalized

| Table | Key columns |
|-------|-------------|
| `cdm_locations` | id, org_id, external_provider, external_id |
| `cdm_items` | id, org_id, name, sku, category_name, price |
| `cdm_location_items` | location_id, item_id, price, cost_price |
| `cdm_orders` | id, org_id, location_id, opened_at, closed_at, gross_total, net_total, status, external_provider |
| `cdm_order_lines` | id, order_id, item_id, quantity, unit_price, gross_line_total |
| `cdm_payments` | id, order_id, amount, method, status, paid_at |

### POS & Tickets

| Table | Key columns |
|-------|-------------|
| `tickets` | id, location_id, opened_at, closed_at, covers, gross_total, net_total, pos_table_id, server_id |
| `ticket_lines` | id, ticket_id, product_id, quantity, unit_price, destination, prep_status |
| `payments` | id, ticket_id, method, amount, tip_amount |
| `products` | id, location_id, name, category, price, kds_destination |
| `pos_tables` | id, floor_map_id, table_number, seats, status, current_ticket_id |
| `pos_cash_sessions` | id, location_id, opening_cash, closing_cash, cash_difference |

### Facts / Aggregations

| Table | Key columns | Notes |
|-------|-------------|-------|
| `pos_daily_finance` | date, location_id, net_sales, gross_sales, payments_cash/card | Sales source |
| `pos_daily_products` | date, location_id, product_id, product_name, units_sold, net_sales, **cogs**, data_source | **Primary product + COGS source** |
| `sales_daily_unified` | date, location_id, net_sales, orders_count (VIEW) | Reads from `pos_daily_finance` |
| `product_sales_daily_unified` | day, location_id, product_id, units_sold, net_sales, cogs (VIEW → matview) | Reads from `product_sales_daily_unified_mv` — **may be stale** |
| `cogs_daily` | date, location_id, cogs_amount (VIEW) | From `stock_movements` — may be stale |
| `monthly_cost_entries` | location_id, period_year, period_month, amount | Manual COGS entries |
| `facts_sales_15m` | location_id, ts_bucket, sales_gross, sales_net, tickets, covers | 15-min granularity |
| `facts_item_mix_daily` | location_id, day, item_id, qty, revenue_net, margin_est | Item-level daily |
| `facts_labor_daily` | location_id, day, scheduled_hours, actual_hours, labor_cost_est | Labour daily |

### AI / Forecasting

| Table | Key columns |
|-------|-------------|
| `ai_forecasts` | location_id, metric, granularity, forecast_json, model_version |
| `ai_recommendations` | id, type, location_id, rationale, confidence, status |
| `ai_actions` | id, recommendation_id, type, status, execute_mode |
| `ai_action_results` | id, action_id, measured_impact_json |
| `forecast_daily_metrics` | date, location_id, forecast_sales, forecast_orders, mape, confidence |
| `forecast_model_runs` | location_id, model_version, algorithm, mse, mape |
| `procurement_suggestions` | location_id, item_id, suggested_qty, urgency, status |

### Workforce

| Table | Key columns |
|-------|-------------|
| `employees` | id, location_id, full_name, role_name, hourly_cost, active, user_id |
| `planned_shifts` | employee_id, location_id, shift_date, start_time, end_time, role, status |
| `timesheets` | employee_id, location_id, clock_in, clock_out, minutes, labor_cost |
| `employee_clock_records` | employee_id, location_id, clock_in, clock_out, source |
| `labour_daily` | date, location_id, labour_cost, labour_hours |

### Payroll

| Table | Key columns |
|-------|-------------|
| `payroll_runs` | group_id, legal_entity_id, period_year, period_month, status |
| `payslips` | payroll_run_id, employee_id, gross_pay, net_pay, irpf_withheld |
| `payslip_lines` | payslip_id, concept_code, amount, type |
| `employment_contracts` | employee_id, contract_type, base_salary_monthly, hourly_rate, irpf_rate |
| `legal_entities` | group_id, razon_social, nif |
| `convenio_rules` | group_id, convenio_code, rule_json |

### Inventory & Procurement

| Table | Key columns |
|-------|-------------|
| `inventory_items` | group_id, name, unit, par_level, current_stock, last_cost |
| `stock_movements` | location_id, item_id, movement_type, quantity, cost |
| `stock_counts` | group_id, location_id, start_date, end_date, status |
| `suppliers` | group_id, name, email, integration_type |
| `purchase_orders` | supplier_id, location_id, status |
| `waste_events` | location_id, inventory_item_id, quantity, reason, waste_value |

### Integrations

| Table | Key columns |
|-------|-------------|
| `integrations` | org_id, location_id, provider, status |
| `integration_accounts` | integration_id, provider, access_token_encrypted, is_active |
| `integration_sync_runs` | integration_account_id, status, cursor, stats |
| `raw_events` | provider, event_type, external_id, payload, payload_hash |

### Auth & RBAC

| Table | Key columns |
|-------|-------------|
| `roles` | id, name, description, is_system |
| `permissions` | id, key, module |
| `role_permissions` | role_id, permission_id |
| `user_roles` | user_id, role_id, location_id |
| `user_locations` | user_id, location_id |

### Other

| Table | Key columns |
|-------|-------------|
| `announcements` | title, body, type, pinned, location_id |
| `budgets_daily` | date, location_id, budget_sales, budget_labour, budget_cogs |
| `cash_counts_daily` | date, location_id, cash_counted |
| `cogs_daily` | date, location_id, cogs_amount |
| `kpi_alert_thresholds` | location_id, kpi_name, min_threshold, max_threshold |
| `menu_engineering_actions` | location_id, product_id, action_type, classification |
| `reservations` | location_id, pos_table_id, guest_name, party_size, reservation_date |
| `reviews` | location_id, platform, rating, review_text, sentiment |
| `loyalty_members` | group_id, email, points_balance, tier |
| `report_subscriptions` | user_id, report_type, is_enabled |

### Key RPC Functions (82 public)

#### Dashboard & KPIs
- `rpc_kpi_range_summary(p_org_id, p_location_ids, p_from, p_to)` — **KPI cards**: sales, COGS (3-source), labour, GP%, COL%. Sources: `sales_daily_unified` + `planned_shifts` + `cogs_daily` + `pos_daily_products` + `monthly_cost_entries`
- `get_top_products_unified(p_org_id, p_location_ids, p_from, p_to, p_limit)` — **Top Products**: returns `{data_source, mode, reason, last_synced_at, total_sales, items[]}`. **Has matview fallback**: checks `product_sales_daily_unified_mv` first, falls back to `pos_daily_products` if stale
- `get_sales_timeseries_unified(p_org_id, p_location_ids, p_from, p_to)` — Sales chart data
- `get_instant_pnl_unified(p_org_id, p_location_ids, p_from, p_to)` — Instant P&L
- `menu_engineering_summary(p_date_from, p_date_to, p_location_id, p_data_source)` — Menu engineering matrix

#### Labour & Workforce
- `get_labour_kpis`, `get_labour_timeseries`, `get_labour_locations_table` — Labour analytics
- `get_labour_cost_by_date(_location_ids, _from, _to)` — Daily labour cost from `labour_daily_unified`
- `get_labor_plan_unified` — Labour plan P&L
- `get_staffing_heatmap`, `get_staffing_recommendation` — Staffing analytics
- `calculate_schedule_efficiency`, `calculate_tip_distribution` — Schedule/tips

#### Inventory & COGS
- `get_food_cost_variance` — Food cost variance (requires `purchase_order_status` enum to include 'received')
- `get_dead_stock`, `get_daily_prep_list` — Inventory management
- `get_recipe_food_cost`, `deduct_recipe_from_inventory` — Recipe-based COGS

#### RBAC
- `is_owner`, `is_org_admin`, `is_org_member`, `is_location_member`
- `get_user_permissions`, `get_user_roles_with_scope`, `get_user_accessible_locations`

#### Data & ETL
- `resolve_data_source()` — Returns `'demo'` or `'pos'` per org
- `refresh_all_mvs()`, `process_refresh_mvs_jobs()` — Materialized view refresh
- `bootstrap_demo`, `bootstrap_demo_operational` — Demo data seeding
- `merge_square_*` — Square POS data merge
- `rpc_data_health`, `audit_data_coherence` — Data quality checks

---

## AI Tools Core (`src/ai-tools-core/`)

Shared tool logic portable between Node (MCP server) and Deno (Edge Functions). The MCP server re-exports from core — no duplicated logic.

### Architecture

```
src/ai-tools-core/          ← Canonical source of truth
  lib/                       ← errors, pagination, response, writeGuard, circuitBreaker, runtime
  types.ts                   ← TenantContext, GuardContext, ToolClients, Execution
  registry.ts                ← TOOL_METADATA with RBAC per tool
  index.ts                   ← Barrel export

mcp/josephine-mcp/src/lib/  ← Thin re-exports from core (MCP adapter)
supabase/functions/ai-tools/ ← Edge Function dispatcher (imports core directly)
```

### Portability

- **Bare specifiers** for npm packages (`@supabase/supabase-js`, not URL imports)
- **`.ts` extensions** in internal imports (Deno requires them; Node uses `allowImportingTsExtensions`)
- **Web Crypto** for hashing (async `sha256Hex` via `crypto.subtle`)
- **`getEnv()`** wrapper reads `Deno.env.get()` or `process.env` transparently
- **`deno.json` import map** in Edge Function maps bare specifiers to `esm.sh` URLs

---

## AI Tools Dispatcher (Edge Function)

`POST /functions/v1/ai-tools` — Single endpoint exposing all 16 tools via Supabase Edge Functions with JWT auth, multi-tenant RBAC, and actor injection.

### Deployment

```bash
supabase functions deploy ai-tools
```

### How It Works

1. Client sends `POST` with `{ toolName, input }` + `Authorization: Bearer <jwt>`
2. Dispatcher resolves tenant from JWT: userId, orgId, role, locationIds
3. RBAC check via `has_permission()` RPC
4. Location validation against tenant's allowed locations
5. Read tools execute directly; write tools go through 9-gate writeGuard
6. Actor injected from JWT (never from client input)
7. Returns standard tool envelope

### Environment Variables

| Env Var | Default | Purpose |
|---------|---------|---------|
| `JOSEPHINE_AI_WRITE_ENABLED` | `false` | Hard gate for writes in Edge Function |
| `JOSEPHINE_MCP_WRITE_ENABLED` | `false` | Hard gate for writes in MCP server |

The writeGuard checks both env vars (either enables writes).

### Example Requests

#### Read: Sales Summary

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ai-tools" \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "toolName": "josephine_sales_summary", "input": { "fromISO": "2026-02-01", "toISO": "2026-02-14" } }'
```

#### Read: Low Stock

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ai-tools" \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "toolName": "josephine_inventory_low_stock", "input": { "locationId": "uuid", "thresholdMode": "par" } }'
```

#### Write: Adjust Stock (preview)

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ai-tools" \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "toolName": "josephine_inventory_adjust_onhand", "input": { "locationId": "uuid", "itemId": "uuid", "newOnHand": 50, "reason": "Physical count", "idempotencyKey": "adj-tomatoes-20260214" } }'
```

#### Write: Create PO (execute)

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ai-tools" \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "toolName": "josephine_purchases_create_po", "input": { "confirm": true, "idempotencyKey": "po-weekly-20260214", "reason": "Weekly restock", "locationId": "uuid", "supplierId": "uuid", "lines": [{ "itemId": "uuid", "qty": 20, "priceEstimate": 2.50 }] } }'
```

#### Write: Update Settings (execute)

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ai-tools" \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "toolName": "josephine_settings_update", "input": { "confirm": true, "idempotencyKey": "settings-gp-20260214", "reason": "Adjusting target GP", "locationId": "uuid", "patch": { "target_gp_percent": 72 } } }'
```

### Security Notes

- **Actor**: Derived from JWT + `get_user_primary_role()` RPC. Never from client.
- **Multi-tenant**: orgId from `profiles.group_id`, locationIds from `user_locations`.
- **RBAC**: `has_permission(userId, permissionKey, locationId)` RPC per tool.
- **Circuit breaker**: In-memory per Deno isolate. Resets on cold start.
- **Writes**: Same 9-gate writeGuard as MCP.

---

## MCP Server: josephine-mcp

A Model Context Protocol server providing safe, typed access to Josephine's Supabase backend for Claude Code and other AI agents.

### 1. Quickstart

```bash
cd mcp/josephine-mcp
npm install
cp .env.example .env.local   # Edit with real keys
npm run dev                   # Start via tsx (stdio)
npm run build                 # Compile to dist/
npm run typecheck             # tsc --noEmit
```

### 2. Environment Setup & Auto-Login

The MCP server authenticates against Supabase using env vars (no interactive login).

Create `mcp/josephine-mcp/.env.local` (already in .gitignore):

```env
SUPABASE_URL=https://qixipveebfhurbarksib.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from root .env.local>
JOSEPHINE_MCP_WRITE_ENABLED=false
```

- **SUPABASE_SERVICE_ROLE_KEY** (recommended) — bypasses RLS, full access.
- **SUPABASE_ANON_KEY** — alternative; RLS applies, writes may be denied.
- **JOSEPHINE_MCP_WRITE_ENABLED** — hard gate for all write operations (default `false`).

The server also reads from the root `.env.local` as fallback.

**Never commit `.env.local` or secrets to the repo.**

### 3. Testing with MCP Inspector

```bash
# Terminal 1: Start the server
cd mcp/josephine-mcp && npm run dev

# Terminal 2: Use MCP Inspector
npx @modelcontextprotocol/inspector stdio -- npx tsx mcp/josephine-mcp/src/server.ts
```

### 4. Tool Contract (Envelope)

Every tool returns a stable envelope:

```json
{
  "status": "ok | preview | error | not_supported",
  "requestId": "uuid",
  "durationMs": 42,
  "serverVersion": "0.1.0",
  "toolVersion": "v1",
  "data": { ... },
  "pagination": { "limit": 25, "offset": 0, "nextCursor": "...", "hasMore": true },
  "warnings": ["..."],
  "errors": [{ "code": "ERROR_CODE", "message": "...", "hint": "..." }],
  "meta": { "rowsTouched": 1, "resultSizeBytes": 234 }
}
```

**Pagination**: All list endpoints support `limit` + `cursor` (base64-encoded offset). Max 100 per page.

**Versioning**: `serverVersion` from package.json, `toolVersion` per tool (currently all `v1`).

### 5. Write Safety Rules

ALL write tools require four mandatory fields when writes are enabled:

| Field | Purpose |
|-------|---------|
| `confirm: true` | Explicit execution gate. If false/missing → returns `preview` with mutation plan. |
| `idempotencyKey` | Unique string per logical operation (e.g. `"adj-tomatoes-20260214"`). |
| `reason` | Human-readable justification logged to `mcp_idempotency_keys`. |
| `actor` | `{ name, role }` — who is making this change. Required when `JOSEPHINE_MCP_WRITE_ENABLED=true`. |

**Execution flag**: Every write response includes `meta.execution` with one of:
- `"executed"` — mutation was performed
- `"replay"` — idempotent replay, no new mutation
- `"preview"` — no mutation (confirm missing, writes disabled, circuit open, etc.)

**Idempotency behavior (hash + conflict + replay)**:
- Each write computes a `request_hash` from normalized input (excluding volatile fields).
- If `(tool_name, idempotency_key)` already exists:
  - Same hash → **replay**: returns original result without re-executing (`meta.execution: "replay"`).
  - Different hash → **CONFLICT**: returns error asking for a new key.
- Stored in `mcp_idempotency_keys` table with actor, reason, and result.
- **TTL cleanup**: `DELETE FROM mcp_idempotency_keys WHERE created_at < NOW() - INTERVAL '30 days'`.

### 6. WRITE ENABLE FLAG

**Env var**: `JOSEPHINE_MCP_WRITE_ENABLED` (default: `false`)

When `false` or missing, ALL write tools return `status: "preview"` with the mutation plan — even if `confirm: true`. No mutation is executed.

To enable writes: set `JOSEPHINE_MCP_WRITE_ENABLED=true` and restart the server.

This is a defense-in-depth safety gate for production environments.

### 7. Tool Index

| Tool | Ver | R/W | Purpose | Key Inputs | Key Outputs | Risks |
|------|-----|-----|---------|------------|-------------|-------|
| `josephine_locations_list` | v1 | R | List locations | limit, cursor, includeInactive | locations[] | None |
| `josephine_sales_summary` | v1 | R | Sales KPIs for date range | fromISO, toISO, locationIds | totalNetSales, avgCheck, variance | None |
| `josephine_sales_timeseries` | v1 | R | Sales chart data | fromISO, toISO, granularity | series[] (ts, actual, forecast) | None |
| `josephine_inventory_low_stock` | v1 | R | Items below par | locationId, thresholdMode | items[] with deficit | None |
| `josephine_inventory_item_history` | v1 | R | Stock movements | locationId, itemId, date range | movements[] | None |
| `josephine_settings_get` | v1 | R | Location settings | locationId? | settings[] | None |
| `josephine_etl_last_runs` | v1 | R | Sync run history | limit, status filter | runs[] | None |
| `josephine_data_quality_report` | v1 | R | Audit data coherence | locationIds | checks[], allPass | None |
| `josephine_locations_upsert` | v1 | W | Create/update location | location.name, confirm, key, reason | location record | Creates DB record |
| `josephine_inventory_upsert_item` | v1 | W | Create/update item | item.name, confirm, key, reason | item record | Creates DB record |
| `josephine_inventory_adjust_onhand` | v1 | W | Adjust stock | locationId, itemId, newOnHand/delta | prev→new stock | Modifies stock + movement |
| `josephine_purchases_build_po_suggestion` | v1 | R | PO suggestion | locationId, strategy | lines[] + totals | Read-only workflow |
| `josephine_purchases_create_po` | v1 | W | Create purchase order | supplierId, lines[], confirm, key, reason | PO + lines | Creates PO + lines |
| `josephine_settings_update` | v1 | W | Update settings | locationId, patch, confirm, key, reason | updated settings | Whitelisted keys only |
| `josephine_etl_trigger_sync` | v1 | W | Trigger ETL sync | source, confirm, key, reason | edge function response | Invokes edge function |
| `josephine_sales_backfill_ingest` | v1 | W | Backfill sales | source, dates | — | NOT_SUPPORTED |

### 8. Examples

#### READ: Sales Summary

```json
{
  "name": "josephine_sales_summary",
  "arguments": {
    "fromISO": "2026-02-01",
    "toISO": "2026-02-14",
    "currency": "EUR"
  }
}
```

#### READ: Low Stock Items

```json
{
  "name": "josephine_inventory_low_stock",
  "arguments": {
    "locationId": "513b91a7-48bc-4a36-abe9-7d1765082ff4",
    "thresholdMode": "par",
    "limit": 10
  }
}
```

#### WRITE: Adjust Stock (preview — confirm missing)

```json
{
  "name": "josephine_inventory_adjust_onhand",
  "arguments": {
    "locationId": "513b91a7-48bc-4a36-abe9-7d1765082ff4",
    "itemId": "abc123",
    "newOnHand": 50,
    "reason": "Physical count correction",
    "idempotencyKey": "adj-tomatoes-20260214"
  }
}
```
→ Returns `status: "preview"` because `confirm: true` is missing.

#### WRITE: Adjust Stock (execute)

```json
{
  "name": "josephine_inventory_adjust_onhand",
  "arguments": {
    "confirm": true,
    "locationId": "513b91a7-48bc-4a36-abe9-7d1765082ff4",
    "itemId": "abc123",
    "newOnHand": 50,
    "reason": "Physical count correction",
    "idempotencyKey": "adj-tomatoes-20260214",
    "actor": { "name": "Oscar", "role": "owner" }
  }
}
```

#### WRITE: Create Purchase Order

```json
{
  "name": "josephine_purchases_create_po",
  "arguments": {
    "confirm": true,
    "idempotencyKey": "po-supplier1-20260214",
    "reason": "Weekly restock based on par-level analysis",
    "locationId": "513b91a7-48bc-4a36-abe9-7d1765082ff4",
    "supplierId": "supplier-uuid",
    "lines": [
      { "itemId": "item-uuid-1", "qty": 20, "priceEstimate": 2.50 },
      { "itemId": "item-uuid-2", "qty": 10, "priceEstimate": 8.00 }
    ]
  }
}
```

#### WRITE: Update Settings

```json
{
  "name": "josephine_settings_update",
  "arguments": {
    "confirm": true,
    "idempotencyKey": "settings-centro-gp-20260214",
    "reason": "Adjusting target GP to match new menu pricing",
    "locationId": "513b91a7-48bc-4a36-abe9-7d1765082ff4",
    "patch": { "target_gp_percent": 72 }
  }
}
```

### 9. Danger Checklist

- [ ] **Never set `JOSEPHINE_MCP_WRITE_ENABLED=true` in production** without understanding the implications.
- [ ] **Always use unique idempotencyKeys** per logical operation to prevent duplicates.
- [ ] **Review `status: "preview"` responses** before adding `confirm: true`.
- [ ] **Check `warnings` array** — data quality flags indicate estimated vs actual data.
- [ ] **Rollback guidance**: Write operations create records (locations, POs, stock movements). To undo:
  - Locations: set `active: false` via `josephine_locations_upsert`.
  - Stock adjustments: create a reverse adjustment with negative delta.
  - Purchase orders: update status to 'draft' and delete lines manually via Supabase.
  - Settings: restore previous values via `josephine_settings_update`.

### 10. Operations

**RLS_DENIED**: You're using SUPABASE_ANON_KEY. Switch to SUPABASE_SERVICE_ROLE_KEY for write operations.

**Missing purchases schema**: `purchase_orders` and `purchase_order_lines` tables exist. If columns are missing, check migration `20260119231139_*.sql`.

**ETL edge function fails**: Check edge function logs in Supabase Dashboard. Common issues:
- Missing OAuth tokens in `integration_accounts`
- Rate limiting from POS provider
- Use `josephine_etl_last_runs` to check recent sync status

**Data quality warnings**: Run `josephine_data_quality_report` to identify:
- Missing data source rows
- Forecast vs actuals drift
- Unmapped order lines (need `backfill_order_lines_item_id` RPC)

### 11. Production Hardening (Required before enabling WRITES in prod)

#### Write Guard Gate Order (9 gates)

```
1. reason        → MISSING_REASON error
2. idempotencyKey → MISSING_IDEMPOTENCY_KEY error
3. idempotency   → replay (same hash) / CONFLICT (different hash)
4. circuit breaker → CIRCUIT_OPEN preview if too many errors
5. WRITES_ENABLED → preview if false/unset
6. actor         → MISSING_ACTOR error when writes enabled
7. bulk-cap      → TOO_MANY_ROWS preview if estimated > max
8. confirm       → preview if not true
9. ✅ execute     → GuardContext produced, mutation proceeds
```

#### Environment Variables

| Env Var | Default | Purpose |
|---------|---------|---------|
| `JOSEPHINE_MCP_WRITE_ENABLED` | `false` | Hard gate for all write operations |
| `JOSEPHINE_MCP_MAX_ROWS_PER_WRITE` | `20000` | Bulk-cap: max estimated rows per single write request |
| `JOSEPHINE_MCP_BREAKER_THRESHOLD` | `10` | Circuit breaker: errors to trip |
| `JOSEPHINE_MCP_BREAKER_WINDOW_SEC` | `60` | Circuit breaker: rolling error window (seconds) |
| `JOSEPHINE_MCP_BREAKER_COOLDOWN_SEC` | `60` | Circuit breaker: preview-only duration after tripping (seconds) |

#### Actor Requirement

When `JOSEPHINE_MCP_WRITE_ENABLED=true`, every write must include `actor: { name: "...", role: "..." }`. At least one of `name` or `role` must be non-empty. This is logged to `mcp_idempotency_keys.actor_json` for audit.

#### Circuit Breaker (in-memory, per-tool)

- If a write tool returns `UPSTREAM_ERROR` / DB errors N times within a rolling window, the breaker trips
- While open: all calls to that tool return `status: "preview"` with `errors: [{ code: "CIRCUIT_OPEN" }]` and `meta.retryAfterSec`
- After cooldown expires, the breaker resets and the tool can execute again
- A successful execution resets the error counter immediately
- State is in-memory (resets on server restart)

#### Bulk-Cap Per Request

- Each write tool declares its `estimatedRows` when calling `writeGuard`
- If `estimatedRows > JOSEPHINE_MCP_MAX_ROWS_PER_WRITE`, the request is blocked with `TOO_MANY_ROWS`
- The response includes `data.estimatedRows` and `data.maxAllowed` for the caller to adjust
- No rate limiting per minute — writes are unlimited but bounded per request

#### GuardContext (finalizeWrite bypass closure)

- `finalizeWrite()` only accepts `GuardContext`, an opaque branded type produced by `writeGuard` when `action: "execute"`
- This prevents calling `finalizeWrite` with raw input, closing the bypass gap
- TypeScript enforces this at compile time (`__brand: "GuardContext"`)

#### RLS Strategy: mcp_idempotency_keys

- **Access model**: service_role only (RLS blocks anon + authenticated)
- Explicit `DENY` policies for `anon` and `authenticated` roles
- `service_role` bypasses RLS entirely
- **If using SUPABASE_ANON_KEY**: idempotency checks will fail gracefully (table is inaccessible), write proceeds without idempotency protection. Use `SUPABASE_SERVICE_ROLE_KEY` for full safety.

#### Test Examples (for MCP Inspector or automated tests)

**Test: writeEnabled=false → preview**
```json
{
  "name": "josephine_locations_upsert",
  "arguments": {
    "confirm": true,
    "idempotencyKey": "test-we-off",
    "reason": "Test write-enabled gate",
    "actor": { "name": "QA", "role": "tester" },
    "location": { "name": "Test Location" }
  }
}
```
Expected: `status: "preview"`, `meta.execution: "preview"`, `meta.rowsTouched: 0`, warning about JOSEPHINE_MCP_WRITE_ENABLED.

**Test: missing actor → error**
```json
{
  "name": "josephine_locations_upsert",
  "arguments": {
    "confirm": true,
    "idempotencyKey": "test-no-actor",
    "reason": "Test actor gate",
    "location": { "name": "Test Location" }
  }
}
```
Expected (with WRITE_ENABLED=true): `status: "error"`, `errors[0].code: "MISSING_ACTOR"`.

**Test: replay vs executed**
- Call 1: full write with key `"test-replay-1"` → `meta.execution: "executed"`
- Call 2: exact same input with `"test-replay-1"` → `meta.execution: "replay"`, `meta.replay: true`

**Test: conflict**
- Call with key `"test-replay-1"` but different payload → `status: "error"`, `errors[0].code: "CONFLICT"`

**Test: bulk-cap (set `JOSEPHINE_MCP_MAX_ROWS_PER_WRITE=1`)**
```json
{
  "name": "josephine_purchases_create_po",
  "arguments": {
    "confirm": true,
    "idempotencyKey": "test-bulk",
    "reason": "Test bulk-cap",
    "actor": { "name": "QA", "role": "tester" },
    "locationId": "...",
    "supplierId": "...",
    "lines": [
      { "itemId": "...", "qty": 1 },
      { "itemId": "...", "qty": 1 }
    ]
  }
}
```
Expected: `status: "preview"`, `errors[0].code: "TOO_MANY_ROWS"`, `data.estimatedRows: 3` (1 header + 2 lines).

**Test: circuit breaker open**
- Trigger 10+ errors on `josephine_etl_trigger_sync` (e.g., point to non-existent edge function)
- Next call → `status: "preview"`, `errors[0].code: "CIRCUIT_OPEN"`, `meta.retryAfterSec`

### 12. Tool Changelog

| Date | Tool | Change | Breaking? |
|------|------|--------|-----------|
| 2026-02-14 | All tools | v1 initial release | N/A |
| 2026-02-14 | All write tools | Add `meta.execution` flag, actor requirement, GuardContext, circuit breaker, bulk-cap | No (additive) |

All tools are currently at `v1`. Future breaking changes will bump toolVersion and be documented here.
