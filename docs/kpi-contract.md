# KPI Contract

Single source of truth for every number shown in the UI.

## Views

| View | Source |
|------|--------|
| `mart_kpi_daily` | `sales_daily_unified` + `labour_daily_unified` + `cogs_daily` + `location_settings` |
| `mart_sales_category_daily` | `product_sales_daily_unified` + `recipes` + `location_settings` |

## RPC

| Function | Returns |
|----------|---------|
| `rpc_kpi_range_summary(org_id, location_ids, from, to)` | `{ current, previous, period, previousPeriod }` |

## KPI Definitions

| KPI | Formula | Source | Label |
|-----|---------|--------|-------|
| **net_sales** | `SUM(sales_daily_unified.net_sales)` | POS/CDM | always actual |
| **orders_count** | `SUM(sales_daily_unified.orders_count)` | POS/CDM | always actual |
| **covers** | `SUM(sales_daily_unified.covers)` | POS/CDM | always actual |
| **avg_check** | `net_sales / orders_count` | derived | — |
| **cogs** | `stock_movements` → fallback `default_cogs_percent` → 30% | `cogs_daily` or estimated | `actual` \| `estimated` |
| **gp_percent** | `(net_sales - cogs) / net_sales * 100` | derived | — |
| **labour_cost** | `SUM(labour_daily_unified.actual_cost)` | time_entries | `actual` \| `estimated` |
| **col_percent** | `labour_cost / net_sales * 100` | derived | — |
| **product_cogs** | recipe cost × units → fallback % | `recipes` or estimated | `recipe` \| `estimated` |

## Source Labels

- **actual**: Data comes from real transactional records (stock_movements, time_entries)
- **estimated**: Data uses a configurable fallback (`location_settings.default_cogs_percent`, default 30%)
- **recipe**: Product COGS calculated from recipe ingredients × `inventory_items.last_cost`

## Previous Period

`rpc_kpi_range_summary` automatically computes the previous period as the same number of days immediately before the selected range.

Example: if range is Feb 10–16 (7 days), previous period is Feb 3–9.

## Assumptions

1. If no recipes exist → use `location_settings.default_cogs_percent` (fallback: 30%)
2. If no time_entries → labour = NULL (not fabricated)
3. If no stock_movements → COGS = estimated via % (not 0)
4. "Estimated" badge visible in UI when data is not from the real source
