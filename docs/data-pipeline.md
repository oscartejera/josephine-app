# Data Pipeline Reference

## Unified Data Pipeline

| Data | Base table (freshest) | Unified view / access path |
|------|------------------------|----------------------------|
| Sales | `pos_daily_finance` | `sales_daily_unified` |
| Products | `pos_daily_products` | `product_sales_daily_unified` |
| Labour | `planned_shifts` × `employees.hourly_cost` | `labour_daily_unified` |
| Forecast | `forecast_daily_metrics` | `forecast_daily_unified` |
| COGS (stock) | `stock_movements` | `cogs_daily` |
| COGS (POS) | `pos_daily_products.cogs` | direct / downstream consumers |
| COGS (manual) | `monthly_cost_entries` | fallback manual source |

## COGS Source Priority

Josephine should treat COGS as a 3-source pipeline:

1. **POS receipt-level COGS**
   Source: `pos_daily_products.cogs`
   Preferred when available.

2. **Stock movement derived COGS**
   Source: `cogs_daily`
   Used when POS-level COGS is unavailable or incomplete.

3. **Manual entries**
   Source: `monthly_cost_entries`
   Lowest-priority fallback.

## Rules

- Never hardcode COGS percentages.
- Never assume a fallback percentage is acceptable without an explicit product requirement.
- Always preserve source priority when implementing analytics or KPI logic.
- If a metric depends on a unified layer, confirm whether it reads from a base table, a view, or an RPC.

## Data Source Normalization

Key file:
- `src/data/client.ts`

Function:
- `normaliseDataSource()`

### Important gotcha
If a new POS provider is added and its `data_source` string is not normalized in `normaliseDataSource()`, valid POS-backed data may become invisible in the frontend.

### Rule
Whenever a new provider is introduced:
1. add its raw `data_source` value to the normalization logic
2. verify downstream UI paths still resolve the provider as POS-backed
3. validate affected analytics and dashboard surfaces.
