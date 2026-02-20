# KPI Dictionary

Maps every KPI visible in the Josephine UI to its formula, SQL source, and fallback behavior.

## Sales KPIs

| KPI | Formula | SQL Source | Fallback |
|-----|---------|-----------|----------|
| Net Sales | SUM(net_sales) | `sales_daily_unified` / `mart_kpi_daily` | 0 |
| Gross Sales | SUM(gross_sales) | `sales_daily_unified` | 0 |
| Orders | SUM(orders_count) | `sales_daily_unified` | 0 |
| Avg Check | net_sales / orders_count | `mart_kpi_daily.avg_check` | 0 |
| Covers | SUM(covers) | `sales_daily_unified` (currently 0, not tracked) | 0 |
| Payments Cash | SUM(payments_cash) | `pos_daily_finance` | 0 |
| Payments Card | SUM(payments_card) | `pos_daily_finance` | 0 |
| Discounts | SUM(discounts_amount) | `sales_daily_unified` | 0 |
| Refunds | SUM(refunds_amount) | `sales_daily_unified` | 0 |

## Labour KPIs

| KPI | Formula | SQL Source | Fallback |
|-----|---------|-----------|----------|
| Labour Cost | SUM(actual_cost) | `labour_daily_unified` | 0 |
| Labour Hours | SUM(actual_hours) | `labour_daily_unified` | 0 |
| Scheduled Hours | SUM(scheduled_hours) | `labour_daily_unified` | 0 |
| Scheduled Cost | SUM(scheduled_cost) | `labour_daily_unified` | 0 |
| COL% | labour_cost / net_sales × 100 | `mart_kpi_daily.col_percent` | NULL if no labour |
| SPLH | net_sales / labour_hours | Computed in RPC `get_labour_kpis` | 0 if no hours |
| Hours Variance | actual_hours - scheduled_hours | `labour_daily_unified.hours_variance` | 0 |
| Hours Variance % | (actual - scheduled) / scheduled × 100 | `labour_daily_unified.hours_variance_pct` | 0 |
| Headcount | COUNT(DISTINCT employees per day) | `labour_daily_unified.scheduled_headcount` | 0 |

## Cost KPIs

| KPI | Formula | SQL Source | Fallback |
|-----|---------|-----------|----------|
| COGS | actual from stock_movements OR estimated | `mart_kpi_daily.cogs` | net_sales × default_cogs_percent / 100 |
| COGS Source | 'actual' if stock_movements exist, else 'estimated' | `mart_kpi_daily.cogs_source` | 'estimated' |
| GP% | (net_sales - cogs) / net_sales × 100 | `mart_kpi_daily.gp_percent` | NULL if no sales |
| GP Value | net_sales - cogs | Computed from mart_kpi_daily | 0 |

## Inventory KPIs

| KPI | Formula | SQL Source | Fallback |
|-----|---------|-----------|----------|
| On Hand | Current stock level | `inventory_item_location.on_hand` | 0 |
| Par Level | Target stock | `inventory_items.par_level` | 0 |
| Deficit | MAX(par_level - on_hand, 0) | `inventory_position_unified.deficit` | 0 |
| Waste % | waste_value / cogs × 100 | `waste_events` / `cogs_daily` | 0 |
| Waste Value | SUM(waste_value) | `waste_events` | 0 |
| Stock Count Variance | closing - opening - deliveries + sales | `stock_count_lines.variance_qty` | 0 |

## Forecast KPIs

| KPI | Formula | SQL Source | Fallback |
|-----|---------|-----------|----------|
| Forecast Sales | yhat | `forecast_daily_unified.forecast_sales` | 0 |
| Forecast Orders | forecast_sales / avg_check | `forecast_daily_unified.forecast_orders` | 0 |
| Planned Labour Hours | forecast_sales × target_col / hourly_rate | `forecast_daily_unified.planned_labor_hours` | 0 |
| Forecast Lower | yhat_lower (85% CI) | `forecast_daily_unified.forecast_sales_lower` | 0 |
| Forecast Upper | yhat_upper (115% CI) | `forecast_daily_unified.forecast_sales_upper` | 0 |

## Budget KPIs

| KPI | Formula | SQL Source | Fallback |
|-----|---------|-----------|----------|
| Budget Sales | Target net sales | `budget_daily_unified.budget_sales` | 0 |
| Budget Labour | Target labour cost | `budget_daily_unified.budget_labour` | 0 |
| Budget COGS | Target COGS | `budget_daily_unified.budget_cogs` | 0 |
| Budget Variance % | (actual - budget) / budget × 100 | Computed in hooks | NULL if no budget |
| Budget COL% | budget_labour / budget_sales × 100 | `budget_daily_unified.budget_col_pct` | 0 |
| Budget COGS% | budget_cogs / budget_sales × 100 | `budget_daily_unified.budget_cogs_pct` | 0 |
| Budget Margin% | budget_profit / budget_sales × 100 | `budget_daily_unified.budget_margin_pct` | 0 |

## Product KPIs (Menu Engineering)

| KPI | Formula | SQL Source | Fallback |
|-----|---------|-----------|----------|
| Units Sold | SUM(qty) per product | `product_sales_daily_unified_mv` | 0 |
| Product Sales | SUM(gross) per product | `product_sales_daily_unified_mv` | 0 |
| Product COGS | net_sales × default_cogs_percent / 100 | `mart_sales_category_daily_mv` | 0 (estimated) |
| Margin % | (sales - cogs) / sales × 100 | `mart_sales_category_daily_mv` | 100 (no COGS) |
| Classification | BCG matrix: star/plow_horse/puzzle/dog | `menu_engineering_summary` RPC | — |
| Sales Share | product_sales / total_sales | Computed in RPC | 0 |

## Payroll KPIs

| KPI | Formula | SQL Source | Fallback |
|-----|---------|-----------|----------|
| Gross Pay | base_salary + complementos | `payslips.gross_pay` | 0 |
| Net Pay | gross - IRPF - SS | `payslips.net_pay` | 0 |
| IRPF Withheld | gross × irpf_rate | `payslips.irpf_withheld` | 0 |

## Data Health KPIs

| KPI | Formula | SQL Source | Fallback |
|-----|---------|-----------|----------|
| Sales Data Exists | COUNT(daily_sales) > 0 | `audit_data_coherence` RPC | false |
| Labour Data Exists | COUNT(time_entries) > 0 | `audit_data_coherence` RPC | false |
| Forecast Data Exists | COUNT(forecast_points) > 0 | `audit_data_coherence` RPC | false |
| Budget Data Exists | COUNT(budget_days) > 0 | `audit_data_coherence` RPC | false |
| MV Row Counts | COUNT(*) per MV > 0 | `data_health_summary` RPC | 0 |

## View Dependency Chain

```
daily_sales ──────────────────────────┐
time_entries ─────────────────────────┤
  └→ sales_daily_unified (view)       │
  └→ labour_daily_unified (view)      │
                                      ├→ mart_kpi_daily_mv
stock_movements ──────────────────────┤
  └→ cogs_daily (view) ──────────────┘
location_settings ────────────────────┘

cdm_orders + cdm_order_lines ─────────┐
  └→ product_sales_daily_unified_mv ──┤
  └→ sales_hourly_unified_mv         │
                                      ├→ mart_sales_category_daily_mv
location_settings ────────────────────┘
```
