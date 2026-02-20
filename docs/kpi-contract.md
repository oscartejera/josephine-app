# KPI Contract

Single source of truth for every number shown in the UI.

## SQL Layer

### Views

| View | Source tables | Purpose |
|------|-------------|---------|
| `mart_kpi_daily` | `sales_daily_unified` + `labour_daily_unified` + `cogs_daily` + `location_settings` | One row per location-day with sales, labour, COGS, GP%, COL% |
| `mart_sales_category_daily` | `product_sales_daily_unified` + `recipes` + `recipe_ingredients` + `inventory_items` + `location_settings` | Product-level COGS (recipe-based or estimated) |

### RPC

| Function | Returns |
|----------|---------|
| `rpc_kpi_range_summary(p_org_id, p_location_ids, p_from, p_to)` | `{ current, previous, period, previousPeriod }` — aggregated KPIs for selected range + automatic previous period |

### COGS Cascade (mart_kpi_daily)

```
COALESCE(
  NULLIF(cogs_daily.cogs_amount, 0),           -- 1. Actual from stock_movements
  net_sales * COALESCE(default_cogs_percent, 30) / 100  -- 2. Estimated from settings or 30% fallback
)
```

### Product COGS Cascade (mart_sales_category_daily)

```
COALESCE(
  SUM(recipe_ingredients.quantity * inventory_items.last_cost) * units_sold,  -- 1. Recipe-based
  net_sales * COALESCE(default_cogs_percent, 30) / 100                       -- 2. Estimated fallback
)
```

## KPI Definitions

| KPI | Formula | Source | Label |
|-----|---------|--------|-------|
| **net_sales** | `SUM(sales_daily_unified.net_sales)` | POS/CDM | always actual |
| **orders_count** | `SUM(sales_daily_unified.orders_count)` | POS/CDM | always actual |
| **covers** | `SUM(sales_daily_unified.covers)` | POS/CDM | always actual |
| **avg_check** | `net_sales / orders_count` | derived | — |
| **cogs** | stock_movements → fallback `default_cogs_percent` → 30% | `cogs_daily` or estimated | `actual` \| `estimated` |
| **gp_percent** | `(net_sales - cogs) / net_sales * 100` | derived | — |
| **labour_cost** | `SUM(labour_daily_unified.labour_cost)` | time_entries | `actual` \| NULL |
| **col_percent** | `labour_cost / net_sales * 100` | derived | — |
| **product_cogs** | recipe cost × units → fallback % | `recipes` or estimated | `recipe` \| `estimated` |

## Source Labels

- **actual**: Data comes from real transactional records (stock_movements, time_entries)
- **estimated**: Data uses a configurable fallback (`location_settings.default_cogs_percent`, default 30%)
- **recipe**: Product COGS calculated from `recipe_ingredients.quantity × inventory_items.last_cost`
- **NULL**: No data available (e.g., no time_entries for labour) — UI shows "No data" or hides the metric

## Previous Period

`rpc_kpi_range_summary` automatically computes the previous period as the same number of days immediately before the selected range.

Example: if range is Feb 10–16 (7 days), previous period is Feb 3–9.

## Data Layer (TypeScript)

| Module | Function | Purpose |
|--------|----------|---------|
| `src/data/kpi.ts` | `getKpiRangeSummary(ctx, from, to)` | Calls `rpc_kpi_range_summary` |
| `src/data/kpi.ts` | `getKpiDaily(ctx, from, to)` | Queries `mart_kpi_daily` directly |
| `src/hooks/useKpiSummary.ts` | `useKpiSummary(from, to)` | React Query wrapper for `getKpiRangeSummary` |

### Types

```typescript
interface KpiPeriodSummary {
  net_sales: number;
  orders_count: number;
  covers: number;
  avg_check: number;
  labour_cost: number | null;
  cogs: number;
  col_percent: number | null;
  gp_percent: number | null;
  cogs_source_mixed?: boolean;    // true if any day used estimated COGS
  labour_source_mixed?: boolean;  // true if any day used estimated labour
}

interface KpiRangeSummary {
  current: KpiPeriodSummary;
  previous: KpiPeriodSummary;
  period: { from: string; to: string; days: number };
  previousPeriod: { from: string; to: string };
}
```

## Page Consumption

| Page | Hook | Data source | What changed |
|------|------|-------------|-------------|
| **Dashboard** | `useKpiSummary` | `rpc_kpi_range_summary` | Removed hardcoded `cogsPercent: 30`. Uses real COGS + previous period deltas. Shows "Estimated" badge when `cogs_source_mixed`. |
| **Sales** | `useBISalesData` → `getKpiRangeSummary` | `rpc_kpi_range_summary` (for previous period) | Previous period comparison uses real historical data instead of forecast-only. |
| **Labour** | `useLabourData` | RPCs `get_labour_kpis`, `get_labour_timeseries`, `get_labour_locations_table` | Added `sanitizeKpis()` to guard NaN/Infinity. COL%=0 when sales=0, SPLH=0 when hours=0. |
| **Instant P&L** | `useInstantPLData` | `getInstantPnlRpc` | Removed `SeededRandom` fabricated labour data. Labour stays at actual value (0 or real). |
| **Top Products** | `useTopProducts` | `getTopProductsRpc` + `mart_sales_category_daily` | Removed `sales * 0.28` hardcode. Uses recipe or estimated COGS from mart view. |
| **Menu Engineering** | `useMenuEngineeringData` | `getMenuEngineeringSummaryRpc` + `mart_sales_category_daily` | Enriches COGS from mart view when RPC returns 0. Recomputes classification with real margins. |
| **Inventory** | `useInventoryData` | Direct Supabase queries | Removed arbitrary multipliers (`* 0.6`, `* 0.7`, `* 1.05`, `* 0.85`). Uses actual values. |

## Assumptions

1. If no recipes exist → use `location_settings.default_cogs_percent` (fallback: 30%)
2. If no time_entries → labour = NULL (not fabricated)
3. If no stock_movements → COGS = estimated via % (not 0)
4. "Estimated" badge visible in UI when data is not from the real source
5. Previous period = same number of days immediately before the selected range

## Implementation PRs

| PR | Branch | Description | Status |
|----|--------|-------------|--------|
| #121 | `feat/kpi-contract-sql` | SQL views + RPC + docs | Merged |
| #122 | `feat/kpi-data-layer` | `src/data/kpi.ts` + `useKpiSummary` hook + types | Merged |
| #123 | `refactor/dashboard-kpi-contract` | Dashboard uses `useKpiSummary`, real deltas, estimated badges | Merged |
| #124 | `fix/top-products-cogs` | TopProducts uses `mart_sales_category_daily` for real COGS | Merged |
| #125 | `refactor/sales-kpi-contract` | Sales page previous period from `getKpiRangeSummary` | Merged |
| #126 | `fix/labour-null-handling` | Labour `sanitizeKpis()` guards NaN/Infinity | Merged |
| #127 | `fix/pnl-remove-fake-data` | Instant P&L removes SeededRandom fabricated labour | Merged |
| #128 | `fix/inventory-menu-honest-data` | Inventory removes arbitrary multipliers, Menu Engineering uses real COGS | Merged |
| #129 | `chore/kpi-cleanup` | Updated docs with final state | Merged |
