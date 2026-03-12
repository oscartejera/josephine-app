# RPC Catalog

> Last updated: 2026-03-12

Found **8** typed RPCs in `RPC_REGISTRY` (`src/data/rpc-contracts.ts`).

## Typed RPCs (with Zod validation)

| RPC | DAL File | Zod Schema | Key SQL Sources | Notes |
|-----|----------|------------|-----------------|-------|
| `get_labour_kpis` | labour.ts | `LabourKpisSchema` | `planned_shifts` × `employees.hourly_cost`, `sales_daily_unified` | Includes COGS from cogs_daily |
| `get_labour_timeseries` | labour.ts | `LabourTimeseriesSchema` | Same as kpis, daily breakdown | |
| `get_labour_locations_table` | labour.ts | `LabourLocationsSchema` | Per-location labour breakdown | |
| `rpc_kpi_range_summary` | kpi.ts | `KpiRangeSummarySchema` | **3-source COGS**: `cogs_daily` + `monthly_cost_entries` + `pos_daily_products`. Sales from `sales_daily_unified`, labour from `planned_shifts` | Returns `{current, previous}` with GP%, COL% |
| `get_sales_timeseries_unified` | sales.ts | `SalesTimeseriesSchema` | Hourly + daily sales from unified views | Returns metadata: `data_source, mode, reason, last_synced_at` |
| `get_top_products_unified` | sales.ts | `TopProductsSchema` | **Matview fallback**: checks `product_sales_daily_unified_mv` first, falls back to `pos_daily_products` if stale | Returns metadata + per-product COGS |
| `get_instant_pnl_unified` | sales.ts | `InstantPnlSchema` (flexible `Record`) | | |
| `menu_engineering_summary` | sales.ts | `MenuEngineeringSchema` | Product classification with COGS, margins | |

## Key Non-Typed RPCs

| RPC | Purpose | Params | Notes |
|-----|---------|--------|-------|
| `get_labour_cost_by_date` | Daily labour cost | `_location_ids uuid[], _from date, _to date` | Reads from `labour_daily_unified` |
| `get_food_cost_variance` | Food cost variance | Various | Requires `purchase_order_status` enum to include `'received'` |
| `resolve_data_source()` | Returns `'demo'` or `'pos'` per org | None | Used by unified views |
| `refresh_all_mvs()` | Refresh all materialized views | None | Call after schema changes |
| `bootstrap_demo` | Seed demo data | | |

## COGS Sources in RPCs

⚠️ **COGS is aggregated from 3 sources** using `GREATEST()`:

1. `pos_daily_products.cogs` — POS receipt-level (most up-to-date)
2. `cogs_daily` view — from `stock_movements` (may lag)
3. `monthly_cost_entries` — manual monthly entries

**Never hardcode COGS percentages** (e.g., `sales * 0.28`).

## Schema Validation

The `TopProductsSchema` requires these metadata fields in the RPC response:
```typescript
{
  data_source: string,     // e.g., 'pos_daily_products' or 'matview'
  mode: string,            // e.g., 'unified'
  reason: string,          // e.g., 'aggregated from pos_daily_products'
  last_synced_at: string | null,
  total_sales: number,
  items: Array<{ product_id, name, category, sales, qty, share, cogs }>
}
```

---

## How to Update

```bash
npm run docs:rpcs
```

This reads `rpc-contracts.ts` and the latest migrations to regenerate this file.