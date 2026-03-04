# Contributing to Josephine

> Everything you need to start contributing in 5 minutes.

## Prerequisites

- **Node.js 20+** and **npm 10+**
- Access to the Supabase project (`qixipveebfhurbarksib`)
- A code editor with TypeScript support (VS Code recommended)

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd josephine-app-1
npm install

# 2. Create .env.local (ask a team member for values)
cp .env.example .env.local

# 3. Start dev server
npm run dev
# → http://localhost:8080

# 4. Run safety checks
npx tsc --noEmit              # TypeScript — must be 0 errors
npm run test                   # Unit + contract tests
npm run db:lint                # Migration safety lint
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (public) |

---

## Project Structure

```
josephine-app-1/
├── src/
│   ├── data/              ← Data Access Layer (DAL)
│   │   ├── client.ts      ← Supabase client helpers + typedFrom()
│   │   ├── typed-rpc.ts   ← Type-safe RPC wrapper (Zod validation)
│   │   ├── rpc-contracts.ts ← Zod schemas for all RPCs
│   │   ├── database-views.ts ← TypeScript types for SQL views
│   │   ├── health.ts      ← RPC health check
│   │   ├── sales.ts       ← Sales data access
│   │   ├── labour.ts      ← Labour data access
│   │   ├── kpi.ts         ← KPI queries
│   │   ├── budget.ts      ← Budget queries
│   │   ├── forecast.ts    ← Forecast queries
│   │   ├── inventory.ts   ← Inventory & procurement
│   │   ├── types.ts       ← Shared DTOs and interfaces
│   │   └── index.ts       ← Barrel exports
│   ├── hooks/             ← React hooks (call DAL functions)
│   ├── pages/             ← Route-level components
│   ├── components/        ← UI components
│   └── contexts/          ← React context providers
├── supabase/
│   └── migrations/        ← SQL migrations (chronological)
├── scripts/               ← Build & maintenance scripts
├── docs/                  ← Technical documentation
│   ├── DB_APP_CONTRACT.md ← Complete DB↔App mapping
│   ├── data-layer.md      ← Data layer architecture
│   ├── erd.md             ← Entity Relationship Diagram
│   └── kpi-contract.md    ← KPI definitions
└── .github/workflows/     ← CI pipeline
```

---

## Data Flow Architecture

```
                         ┌─────────────────────────────────┐
                         │         Supabase (Postgres)       │
                         │                                   │
SQL Views ──────────►    │  sales_daily_unified              │
(typedFrom)              │  labour_daily_unified             │
                         │  budget_daily_unified  ...        │
                         │                                   │
SQL RPCs ───────────►    │  get_labour_kpis()                │
(typedRpc + Zod)         │  get_sales_timeseries_unified()   │
                         │  menu_engineering_summary()  ...  │
                         └───────────────┬───────────────────┘
                                         │
                         ┌───────────────▼───────────────────┐
                         │        Data Access Layer (DAL)     │
                         │        src/data/*.ts               │
                         │                                    │
                         │  typedFrom('view') → query builder │
                         │  typedRpc('rpc', ZodSchema, params)│
                         │       └→ Zod validates response    │
                         │       └→ DEV: throws on mismatch   │
                         │       └→ PROD: warns, returns data │
                         └───────────────┬────────────────────┘
                                         │
                         ┌───────────────▼───────────────────┐
                         │        React Hooks                 │
                         │        src/hooks/use*.ts            │
                         │                                    │
                         │  useQuery() wraps DAL function     │
                         │  Maps DB row → UI-friendly shape   │
                         └───────────────┬────────────────────┘
                                         │
                         ┌───────────────▼───────────────────┐
                         │        Pages + Components          │
                         │        src/pages/*.tsx              │
                         │                                    │
                         │  InsightErrorBoundary catches errs │
                         │  Shows retry button, not spinner   │
                         └────────────────────────────────────┘
```

---

## Recipes

### Recipe 1: Add a New Insight Page

1. **Create the page** in `src/pages/MyNewInsight.tsx`
2. **Create a hook** in `src/hooks/useMyNewInsightData.ts`
3. **Create/reuse DAL functions** in `src/data/` — use `typedFrom()` for views, `typedRpc()` for RPCs
4. **If adding a new RPC:**
   - Add Zod schema to `src/data/rpc-contracts.ts`
   - Add type to `RPC_REGISTRY`
   - Add test in `src/data/__tests__/rpc-contracts.test.ts`
5. **Register the route** in `src/App.tsx` — wrap with `<InsightErrorBoundary>`
6. **Add to sidebar** in `src/components/layout/AppSidebar.tsx`
7. **Run safety checks** (see below)

### Recipe 2: Add a New RPC Function

1. **Write the SQL** in a new migration file:
   ```sql
   -- supabase/migrations/YYYYMMDDHHMMSS_description.sql
   CREATE OR REPLACE FUNCTION public.my_new_rpc(
     p_org_id UUID,
     p_from DATE,
     p_to DATE
   ) RETURNS TABLE (column1 TEXT, column2 NUMERIC) AS $$
   BEGIN
     -- your query
   END;
   $$ LANGUAGE plpgsql STABLE;

   NOTIFY pgrst, 'reload schema';  -- REQUIRED!
   ```

2. **Add Zod schema** in `src/data/rpc-contracts.ts`:
   ```typescript
   export const MyNewRpcSchema = z.object({
     column1: z.string(),
     column2: z.coerce.number().default(0),
   });
   ```

3. **Add to RPC_REGISTRY**:
   ```typescript
   export const RPC_REGISTRY = {
     // ... existing
     my_new_rpc: MyNewRpcSchema,
   };
   ```

4. **Create DAL wrapper** in the appropriate `src/data/*.ts`:
   ```typescript
   export async function getMyNewData(ctx: QueryContext, range: DateRange) {
     assertContext(ctx);
     return typedRpc('my_new_rpc', MyNewRpcSchema, {
       p_org_id: ctx.orgId,
       p_from: range.from,
       p_to: range.to,
     });
   }
   ```

5. **Add contract test** in `src/data/__tests__/rpc-contracts.test.ts`

6. **Run safety checks**

### Recipe 3: Add a New SQL View

1. **Write the SQL** in a migration (use `CREATE OR REPLACE VIEW`)
2. **Add row type** in `src/data/database-views.ts`
3. **Add to `ViewRowMap`** in the same file
4. **Use `typedFrom('my_view')`** in DAL functions
5. **Run safety checks**

---

## Safety Checks (Mandatory Before Push)

```bash
# 1. TypeScript compiles
npx tsc --noEmit

# 2. Contract tests pass (RPC shapes match Zod schemas)
npx vitest run src/data/__tests__/rpc-contracts.test.ts

# 3. Migration lint (no orphan DROP FUNCTION)
npm run db:lint

# 4. Full test suite
npm run test
```

These also run automatically in CI (`.github/workflows/ci.yml`).

---

## Conventions

### Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| SQL view | `snake_case_unified` | `sales_daily_unified` |
| SQL RPC | `snake_case` | `get_labour_kpis` |
| DAL function | `camelCase` + suffix | `getLabourKpisRpc()` |
| React hook | `use` + PascalCase | `useLabourData()` |
| Zod schema | PascalCase + `Schema` | `LabourKpisSchema` |
| Row type | PascalCase + `Row` | `SalesDailyUnifiedRow` |

### Data Layer Rules

1. **Never use `supabase.rpc as any`** — use `typedRpc()` with a Zod schema
2. **Never use `.from('table' as any)`** — use `typedFrom('view')` 
3. **Always add `NOTIFY pgrst, 'reload schema'`** at the end of migration files that change functions
4. **Always add a contract test** when creating a new RPC
5. **Types come from `rpc-contracts.ts`** — don't duplicate interfaces in hooks

### Migrations

- Use `CREATE OR REPLACE FUNCTION` (not `CREATE FUNCTION`)
- Always include `IF EXISTS` on `DROP` statements
- Never drop an RPC without recreating it in the same file
- Run `npm run db:lint` to catch violations

---

## Key Documentation

| Doc | What it covers |
|-----|---------------|
| [`docs/DB_APP_CONTRACT.md`](docs/DB_APP_CONTRACT.md) | Every table, view, RPC, and edge function the app uses |
| [`docs/data-layer.md`](docs/data-layer.md) | Architecture of the typed data pipeline |
| [`docs/erd.md`](docs/erd.md) | Entity Relationship Diagram (Mermaid) |
| [`docs/kpi-contract.md`](docs/kpi-contract.md) | KPI definitions for all Insight pages |
| [`docs/kpi_dictionary.md`](docs/kpi_dictionary.md) | Business KPI dictionary |
