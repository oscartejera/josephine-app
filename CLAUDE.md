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

- **Project:** `qixipveebfhurbarksib`
- **URL:** `https://qixipveebfhurbarksib.supabase.co`
- **Anon key:** Available in `.env.local` (created by hook)
- **Service role key:** Available in `.env.local` (created by hook) - bypasses RLS for admin queries
- Claude has full DB read/write access via the service_role key and the Supabase REST API

### Database Access Pattern

To query/modify the database directly, use curl with the service_role key:
```bash
# Read example
curl "https://qixipveebfhurbarksib.supabase.co/rest/v1/TABLE_NAME" \
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
