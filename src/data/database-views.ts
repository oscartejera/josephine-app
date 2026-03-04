/**
 * Database View Type Definitions
 *
 * These types represent the SQL views created in the database.
 * They're not in the auto-generated types.ts because views
 * aren't exposed in the OpenAPI spec with the anon key.
 *
 * Update these when view schemas change.
 * The RPC contract tests will catch any drift.
 */

// ─── Row types for unified views ────────────────────────────────────────────

export interface SalesDailyUnifiedRow {
    org_id: string;
    location_id: string;
    day: string;
    net_sales: number;
    gross_sales: number;
    orders_count: number;
    avg_check: number;
    payments_cash: number;
    payments_card: number;
    payments_other: number;
    refunds_amount: number;
    refunds_count: number;
    discounts_amount: number;
    comps_amount: number;
    voids_amount: number;
    labor_cost: number;
    labor_hours: number;
    data_source: string;
}

export interface SalesHourlyUnifiedRow {
    org_id: string;
    location_id: string;
    day: string;
    hour_bucket: string;
    hour_of_day: number;
    net_sales: number;
    gross_sales: number;
    orders_count: number;
    covers: number;
    avg_check: number;
    discounts: number;
    refunds: number;
    data_source: string;
}

export interface LabourDailyUnifiedRow {
    org_id: string;
    location_id: string;
    day: string;
    actual_hours: number;
    actual_cost: number;
    scheduled_hours: number;
    scheduled_cost: number;
    scheduled_headcount: number;
    hours_variance: number;
    cost_variance: number;
    hours_variance_pct: number;
}

export interface BudgetDailyUnifiedRow {
    org_id: string;
    location_id: string;
    day: string;
    budget_sales: number;
    budget_labour: number;
    budget_cogs: number;
    budget_profit: number;
    budget_margin_pct: number;
    budget_col_pct: number;
    budget_cogs_pct: number;
}

export interface ForecastDailyUnifiedRow {
    org_id: string;
    location_id: string;
    day: string;
    forecast_sales: number;
    forecast_orders: number;
    planned_labor_hours: number;
    planned_labor_cost: number;
    forecast_avg_check: number;
    forecast_sales_lower: number;
    forecast_sales_upper: number;
    data_source: string;
}

export interface ProductSalesDailyUnifiedRow {
    org_id: string;
    location_id: string;
    day: string;
    product_id: string;
    product_name: string;
    product_category: string;
    units_sold: number;
    net_sales: number;
    cogs: number;
    gross_profit: number;
    margin_pct: number;
    data_source: string;
}

export interface InventoryPositionUnifiedRow {
    id: string;
    name: string;
    unit: string;
    current_stock: number;
    par_level: number;
    group_id: string;
    category?: string;
}

export interface MartKpiDailyRow {
    org_id: string;
    location_id: string;
    day: string;
    net_sales: number;
    orders_count: number;
    covers: number;
    avg_check: number;
    labour_cost: number | null;
    labour_hours: number | null;
    cogs: number;
}

// ─── View name → row type map (for typed queries) ──────────────────────────

export interface ViewRowMap {
    sales_daily_unified: SalesDailyUnifiedRow;
    sales_hourly_unified: SalesHourlyUnifiedRow;
    labour_daily_unified: LabourDailyUnifiedRow;
    budget_daily_unified: BudgetDailyUnifiedRow;
    forecast_daily_unified: ForecastDailyUnifiedRow;
    product_sales_daily_unified: ProductSalesDailyUnifiedRow;
    inventory_position_unified: InventoryPositionUnifiedRow;
    mart_kpi_daily: MartKpiDailyRow;
}

/** All known view names */
export type ViewName = keyof ViewRowMap;
