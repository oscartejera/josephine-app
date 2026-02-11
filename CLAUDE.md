# CLAUDE.md

## Language

Always respond in **Spanish** to the user. Code, comments, and commit messages stay in English.

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
supabase/
  functions/         # Edge Functions (21) - forecast, AI, POS sync, payroll, etc.
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

## Key Architecture Notes

- **Demo Mode:** Toggle between real Supabase data and simulated mock data via DemoModeContext
- **RBAC:** Role-based access (Owner, Manager, Supervisor, Employee) with location-scoped permissions
- **POS Integration:** Square POS via OAuth + incremental webhook sync
- **AI Integration:** Prophet forecasting and Claude API insights both run as Supabase Edge Functions
- **Feature Store:** Facts tables for time-series aggregation (15min, hourly, daily)

## Workflow & Deployment

### CI/CD Pipeline

- **GitHub -> Vercel:** Auto-deploy on merge to `main`. No manual deploy needed.
- **Supabase:** Integrated with GitHub and Vercel via Supabase integration.
- Push to branch -> Create PR -> Merge to `main` -> Vercel deploys automatically.

### How Claude Should Operate

1. **Write code** on a feature branch
2. **Verify before merge:** Run `npm run build` and `npm run lint` — fix any errors before proceeding
3. **Push** the branch and **create a PR**
4. **Merge the PR** to `main` directly (owner has authorized autonomous merging)
5. Vercel handles deployment automatically after merge

### Environment Setup (automated via session-start hook)

The `.claude/hooks/session-start.sh` hook runs automatically on every web session and handles:
1. `npm install` - installs dependencies
2. Creates `.env.local` with Supabase keys (anon + service_role)
3. Installs `gh` CLI if missing
4. Authenticates `gh` with the owner's GitHub token

No manual setup needed. Everything is automated.

### Supabase Access

- **Project:** `qzrbvjklgorfoqersdpx`
- **URL:** `https://qzrbvjklgorfoqersdpx.supabase.co`
- **Anon key:** Available in `.env.local` (created by hook)
- **Service role key:** Available in `.env.local` (created by hook) - bypasses RLS for admin queries
- Claude has full DB read/write access via the service_role key and the Supabase REST API

### Database Access Pattern

To query/modify the database directly, use curl with the service_role key:
```bash
# Read example
curl "https://qzrbvjklgorfoqersdpx.supabase.co/rest/v1/TABLE_NAME" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# Insert/Update via POST/PATCH to the same REST API
```

### Repository

- **Owner:** oscartejera
- **Repo:** oscartejera/josephine-app
- **Main branch:** `main`

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

| Table | Key columns |
|-------|-------------|
| `facts_sales_15m` | location_id, ts_bucket, sales_gross, sales_net, tickets, covers |
| `facts_item_mix_daily` | location_id, day, item_id, qty, revenue_net, margin_est |
| `facts_labor_daily` | location_id, day, scheduled_hours, actual_hours, labor_cost_est |
| `facts_inventory_daily` | location_id, day, item_id, stock_on_hand, waste_est |
| `sales_daily_unified` | date, location_id, net_sales, orders_count, labor_cost (view) |
| `pos_daily_finance` | date, location_id, net_sales, gross_sales, payments_cash/card |
| `product_sales_daily` | date, location_id, product_id, units_sold, net_sales, cogs |

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

### Key RPC Functions (42 total)

- `get_daily_sales`, `get_daily_sales_summary`, `get_weekly_sales_summary` — sales queries
- `get_labour_kpis`, `get_labour_timeseries`, `get_labour_locations_table` — labour analytics
- `get_top_products`, `menu_engineering_summary` — product analytics
- `etl_tickets_to_facts` — ETL pipeline
- `run_daily_forecast`, `forecast_needs_refresh` — forecasting
- `check_kpi_alerts` — alerting
- `seed_josephine_demo_data`, `seed_demo_products_and_sales`, `seed_demo_labour_data` — demo seeding
- `has_permission`, `has_role`, `is_owner`, `get_user_permissions` — RBAC checks
- `add_loyalty_points`, `redeem_loyalty_reward` — loyalty
