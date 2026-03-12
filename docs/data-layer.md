# Data Layer Architecture

> How Josephine's frontend talks to the database — and why it never silently fails.

## The Problem We Solved

Before March 2026, the data layer used `(supabase.rpc as any)(...)` for all RPC calls. TypeScript couldn't validate response shapes, so when a SQL function returned `total_sales` but the UI read `actual_sales`, the code compiled fine, deployed fine, and showed **zeros** in production. No error, no warning — just wrong data.

## The Solution: Zero Trust Data Pipeline

```
                                    ┌─────────────┐
     SQL RPC / View                 │  Zod Schema  │
     (returns JSON)                 │  (contract)  │
           │                        └──────┬───────┘
           │                               │
           ▼                               ▼
    ┌─────────────┐              ┌─────────────────┐
    │  typedRpc() │──validates──▶│ rpc-contracts.ts │
    │  typedFrom()│              │  (Zod schemas)   │
    └──────┬──────┘              └─────────────────┘
           │
           │  DEV: throws RpcContractError if mismatch
           │  PROD: warns in console, returns raw data
           │
           ▼
    ┌─────────────┐
    │  DAL fn()   │   getLabourKpisRpc(), getSalesTrends()
    │  src/data/* │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  useQuery() │   React hook wraps DAL fn
    │  Hook       │   Maps DB shape → UI shape
    └──────┬──────┘
           │
           ▼
    ┌─────────────────────────┐
    │  InsightErrorBoundary   │   Catches runtime errors
    │  → retry button         │   Never shows infinite spinner
    └─────────────────────────┘
```

## Key Files

| File | Role |
|------|------|
| `src/data/typed-rpc.ts` | `typedRpc()` — validates RPC response with Zod |
| `src/data/rpc-contracts.ts` | Zod schemas for all 8+ RPCs — **single source of truth** |
| `src/data/database-views.ts` | TypeScript types for SQL views not in generated types |
| `src/data/client.ts` | `typedFrom()` — type-safe `.from()` for views. **Also contains `normaliseDataSource()`** which maps POS provider names (`cover_manager`, `square`, `lightspeed`, `toast`) to `'pos'` |
| `src/data/health.ts` | RPC health check — probes all RPCs on demand |
| `src/components/InsightErrorBoundary.tsx` | Catches errors per-page |
| `src/data/__tests__/rpc-contracts.test.ts` | Contract tests — validates schemas against live DB |

### ⚠️ Matview Staleness Warning

Materialized views (`*_mv`) can become stale. RPCs reading from matviews **MUST include fallback logic** to query base tables when the matview has no data for the requested date range. Example: `get_top_products_unified` checks `product_sales_daily_unified_mv` first, falls back to `pos_daily_products` if stale.

### ⚠️ Data Source Normalization

The `data_source` column in base tables stores provider-specific names (e.g., `'cover_manager'`). **If you add a new POS integration, you MUST add its name to `normaliseDataSource()` in `client.ts`** — otherwise all data from that source will be invisible to the frontend.

## How `typedRpc()` Works

```typescript
// Before (dangerous — compiles but can show zeros):
const { data } = await (supabase.rpc as any)('get_labour_kpis', params);

// After (safe — catches mismatches immediately):
const data = await typedRpc('get_labour_kpis', LabourKpisSchema, params);
//                          ▲ name           ▲ Zod schema      ▲ params
//
// 1. Calls supabase.rpc internally
// 2. Validates response with LabourKpisSchema.safeParse()
// 3. DEV: throws RpcContractError on mismatch
// 4. PROD: console.warn, returns raw data (no user-facing break)
```

## How `typedFrom()` Works

```typescript
// Before (no autocomplete, no type checking):
const { data } = await supabase.from('sales_daily_unified' as any).select('*');

// After (centralized cast, documented view types):
const { data } = await typedFrom('sales_daily_unified').select('*');
//                               ▲ only accepts ViewName (union type)
// The as any is pushed into typedFrom() — ONE place instead of 11
```

## Contract Tests

`src/data/__tests__/rpc-contracts.test.ts` contains tests that:

1. Validate each Zod schema accepts the correct shape
2. Verify Postgres `numeric` → JS `string` coercion is handled
3. Include a **regression test** that simulates the exact bug we had:
   ```typescript
   // If RPC returns {total_sales: 100} but schema expects {actual_sales: 100}
   // → schema rejects → test catches → deploy blocked
   ```

## CI Pipeline (`.github/workflows/ci.yml`)

On every push to `main` or `develop`:

| Gate | What | Blocks if... |
|------|------|-------------|
| 🔒 TypeScript | `tsc --noEmit` | Any type error |
| 🧪 Contract Tests | `vitest run rpc-contracts.test.ts` | Schema mismatch |
| 🛡️ Migration Lint | `validate-migration.mjs` | Orphan DROP FUNCTION |

## Adding a New RPC (Complete Checklist)

1. ☐ Write SQL function in migration (`CREATE OR REPLACE FUNCTION`)
2. ☐ Add `NOTIFY pgrst, 'reload schema'` at end of migration
3. ☐ Add Zod schema in `rpc-contracts.ts`
4. ☐ Add to `RPC_REGISTRY`
5. ☐ Create DAL wrapper using `typedRpc()`
6. ☐ Export from `index.ts`
7. ☐ Add contract test
8. ☐ Run `npx tsc --noEmit` — 0 errors
9. ☐ Run `npx vitest run rpc-contracts.test.ts` — all pass
