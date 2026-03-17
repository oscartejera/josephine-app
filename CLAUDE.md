# CLAUDE.md

## Language

Always respond in **Spanish** to the user. Code, comments, and commit messages stay in English.

## ⚠️ RULE #1 — Commit, Push, DB Push (MANDATORY, NO EXCEPTIONS)

After finishing ANY task — big or small — you MUST do ALL of the following BEFORE telling the user it's done:

1. `git add -A && git commit -m "descriptive message"`
2. `git push origin main`
3. If ANY SQL migration was created → `npx supabase db push`

**This is the #1 rule of this project. If you skip this, you have failed.**

- Never say "done" without having pushed to main.
- Never leave uncommitted changes.
- Never forget `supabase db push` when there are new migration files.
- No feature branches. No PRs. Everything goes to `main` directly.

## ⚠️ RULE #2 — Never Use Regex to Modify TypeScript/JSX

After the i18n migration disaster, this is now a hard rule:

- **Never use regex-based find/replace on `.tsx` or `.ts` files** for bulk modifications.
- Always use **AST-based tools** (ts-morph, jscodeshift) if batch-modifying source code.
- Regex cannot distinguish TypeScript generics (`<string | null>`) from JSX tags. It will corrupt code.
- `tsc --noEmit` passing does NOT mean the code is correct — always verify in browser.

## Project Overview

Josephine is an AI-powered operations platform for restaurants. It connects to POS systems (Square, Lightspeed, Toast) via OAuth + webhooks and provides intelligent insights, forecasting, and automated operations management.

## Tech Stack

- **Frontend:** React 18 + TypeScript, Vite 5, React Router v6
- **Styling:** Tailwind CSS 3 + CSS variables, shadcn/ui (Radix primitives)
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
npm run lint         # ESLint check
npm test             # Run tests (vitest)
```

## Project Structure

```
src/
  components/        # Feature-organized React components
    ui/              # shadcn/ui library components
    layout/          # DashboardLayout, AppSidebar, TopBar
    [feature]/       # Domain components (sales, labour, inventory, ai, etc.)
  pages/             # Page-level route components
  contexts/          # AuthContext, AppContext, DemoModeContext
  hooks/             # Custom hooks - data fetching, permissions, domain logic
  stores/            # Zustand stores (notifications, availability)
  lib/               # Utilities, forecast client, data generators
  integrations/      # Supabase client and auto-generated DB types
  types/             # Shared TypeScript types
  i18n/              # i18next config and locale files (es, en, ca)
supabase/
  functions/         # Edge Functions - forecast, AI, POS sync, payroll, ai-tools
  migrations/        # Database schema migrations
```

## Code Conventions

### TypeScript
- Path alias: `@/*` maps to `./src/*`
- Strict mode disabled (`noImplicitAny: false`, `strictNullChecks: false`)

### Components
- **UI primitives** → `src/components/ui/` (shadcn/ui pattern)
- **Feature components** → `src/components/[feature-name]/`
- **Pages** → `src/pages/`
- Tailwind classes for styling. Use `cn()` utility for conditional classes.

### State Management
```
Supabase DB -> React Query hooks -> Custom data hooks -> Components
Context API for auth/app state, Zustand for UI state
```

### Internationalization
- All user-facing strings use i18next translation keys
- Locale files: `src/i18n/locales/{es,en,ca}.json`
- Spanish is the default language

## Supabase Access

- **Project ref:** `qixipveebfhurbarksib`
- **URL:** `https://qixipveebfhurbarksib.supabase.co`
- **Demo org:** `7bca34d5-4448-40b8-bb7f-55f1417aeccd`
- **Demo login:** `owner@demo.com` / `Demo1234!`
- **All secrets** are in `.env.local` (gitignored)

### Database Changes Workflow
1. Create migration in `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Apply: `node scripts/run-migration.mjs supabase/migrations/FILE.sql`
3. Sync state: `npx supabase db push`
4. If replacing a function: `DROP FUNCTION IF EXISTS` before `CREATE OR REPLACE`

### Edge Function Deployment
```bash
npx supabase functions deploy FUNCTION_NAME --project-ref qixipveebfhurbarksib
```

## Vercel / Deployment

- **Domains:** `www.josephine-ai.com`, `josephine-ai.com`
- **Auto-deploy:** Every push to `main` triggers Vercel production build
- **No feature branches. No PRs.** Everything goes direct to `main`.

## Key Architecture Notes

### Demo Mode
Toggle between real Supabase data and simulated mock data via DemoModeContext. **Never break demo** — it's the primary sales tool.

### RBAC
Role-based access (Owner, Manager, Supervisor, Employee) with location-scoped permissions.

### ⚠️ Data-Source Normalization

The `data_source` column uses provider-specific names (`'cover_manager'`, `'square'`). The frontend normalizes via `normaliseDataSource()` in `src/data/client.ts`:
- `'cover_manager' | 'square' | 'lightspeed' | ... | 'pos'` → `'pos'`
- Everything else → `'demo'`

**If you add a new POS integration, add its string to `normaliseDataSource()` or all data from it will be invisible.**

### Data Pipeline

| Data | Base table (freshest) | Unified view |
|------|----------------------|--------------|
| Sales | `pos_daily_finance` | `sales_daily_unified` |
| Products | `pos_daily_products` | `product_sales_daily_unified` |
| Labour | `planned_shifts` × `employees.hourly_cost` | `labour_daily_unified` |
| Forecast | `forecast_daily_metrics` | `forecast_daily_unified` |
| COGS (stock) | `stock_movements` | `cogs_daily` (view) |
| COGS (POS) | `pos_daily_products.cogs` | — |
| COGS (manual) | `monthly_cost_entries` | — |

### ⚠️ Materialized View Staleness

Matviews (`*_mv`) can be stale. RPCs MUST include fallback to base tables.

### COGS Pipeline (3-Source)

| Source | Table | Priority |
|--------|-------|----------|
| POS receipt-level | `pos_daily_products.cogs` | 1st (preferred) |
| Stock movements | `cogs_daily` view | 2nd |
| Manual entries | `monthly_cost_entries` | 3rd |

**⚠️ NEVER hardcode COGS percentages** (e.g., `sales * 0.28`). Always read from data.

## Database Schema (Key Tables)

### Core / Multi-tenant
`groups`, `locations`, `profiles`, `location_settings`

### POS & Tickets
`tickets`, `ticket_lines`, `payments`, `products`, `pos_tables`, `pos_cash_sessions`

### CDM (Canonical Data Model)
`cdm_locations`, `cdm_items`, `cdm_orders`, `cdm_order_lines`, `cdm_payments`

### Facts / Aggregations
`pos_daily_finance`, `pos_daily_products`, `facts_sales_15m`, `facts_item_mix_daily`, `facts_labor_daily`

### AI / Forecasting
`ai_forecasts`, `ai_recommendations`, `forecast_daily_metrics`

### Workforce
`employees`, `planned_shifts`, `timesheets`, `labour_daily`

### Payroll
`payroll_runs`, `payslips`, `employment_contracts`, `legal_entities`

### Inventory
`inventory_items`, `stock_movements`, `stock_counts`, `suppliers`, `purchase_orders`, `waste_events`

### Integrations
`integrations`, `integration_accounts`, `integration_sync_runs`, `raw_events`

### Auth & RBAC
`roles`, `permissions`, `role_permissions`, `user_roles`, `user_locations`

### Key RPCs
- `rpc_kpi_range_summary` — KPI cards (sales, COGS, labour, GP%, COL%)
- `get_top_products_unified` — Top products with matview fallback
- `get_sales_timeseries_unified` — Sales chart data
- `get_instant_pnl_unified` — Instant P&L
- `menu_engineering_summary` — Menu engineering matrix
- `get_labour_kpis`, `get_labour_timeseries` — Labour analytics
- `resolve_data_source()` — Returns `'demo'` or `'pos'` per org
- `refresh_all_mvs()` — Refresh all materialized views
