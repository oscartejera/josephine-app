/**
 * RPC Contracts — Zod schemas defining the exact shape of every RPC response.
 *
 * These are the SINGLE SOURCE OF TRUTH for the contract between
 * PostgreSQL functions and the TypeScript frontend.
 *
 * When you change an RPC's output fields, update the schema HERE.
 * The typed-rpc wrapper will catch any mismatch at runtime.
 */

import { z } from 'zod';

import { useTranslation } from 'react-i18next';
// ─── Helper: coerce numeric (Postgres returns strings for numeric types) ────
const num = z.coerce.number().default(0);
const numNullable = z.coerce.number().nullable().default(null);

// ─── Labour RPCs ────────────────────────────────────────────────────────────

export const LabourKpisSchema = z.object({
    actual_sales: num,
    forecast_sales: num,
    actual_orders: num,
    forecast_orders: num,
    actual_labor_cost: num,
    planned_labor_cost: num,
    actual_labor_hours: num,
    planned_labor_hours: num,
    schedule_labor_cost: num,
    actual_col_pct: num,
    planned_col_pct: num,
    actual_splh: num,
    planned_splh: num,
    actual_oplh: num,
    planned_oplh: num,
    sales_delta_pct: num,
    col_delta_pct: num,
    hours_delta_pct: num,
    splh_delta_pct: num,
    oplh_delta_pct: num,
    cost_per_cover: num,
    cogs_total: num,
    cogs_pct: num,
    prime_cost_pct: num,
    prime_cost_amount: num,
    labor_cost_source: z.string().default('payroll'),
    avg_headcount: num,
}).passthrough();
export type LabourKpisRpc = z.infer<typeof LabourKpisSchema>;

export const LabourTimeseriesRowSchema = z.object({
    date: z.string(),
    actual_sales: num,
    forecast_sales: num,
    actual_hours: num,
    actual_labor_cost: num,
    planned_hours: num,
    planned_labor_cost: num,
    actual_orders: num,
    forecast_orders: num,
    actual_splh: num,
    planned_splh: num,
    actual_col_pct: num,
    planned_col_pct: num,
    actual_oplh: num,
    planned_oplh: num,
    hours_variance: num,
    hours_variance_pct: num,
}).passthrough();
export type LabourTimeseriesRowRpc = z.infer<typeof LabourTimeseriesRowSchema>;
export const LabourTimeseriesSchema = z.array(LabourTimeseriesRowSchema);

export const LabourLocationRowSchema = z.object({
    location_id: z.string().nullable(),
    location_name: z.string(),
    sales_actual: num,
    sales_projected: num,
    sales_delta_pct: num,
    labor_cost_actual: num,
    labor_cost_projected: num,
    hours_actual: num,
    hours_projected: num,
    col_actual_pct: num,
    col_projected_pct: num,
    col_delta_pct: num,
    splh_actual: num,
    splh_projected: num,
    splh_delta_pct: num,
    oplh_actual: num,
    oplh_projected: num,
    oplh_delta_pct: num,
    is_summary: z.boolean().default(false),
}).passthrough();
export type LabourLocationRowRpc = z.infer<typeof LabourLocationRowSchema>;
export const LabourLocationsSchema = z.array(LabourLocationRowSchema);

// ─── KPI Range Summary (Control Tower) ──────────────────────────────────────

const KpiPeriodSchema = z.object({
    net_sales: num,
    orders_count: num,
    covers: num,
    avg_check: num,
    labour_cost: numNullable,
    labour_hours: numNullable,
    cogs: num,
    col_percent: numNullable,
    gp_percent: numNullable,
}).passthrough();

export const KpiRangeSummarySchema = z.object({
    current: KpiPeriodSchema,
    previous: KpiPeriodSchema,
    period: z.object({ from: z.string(), to: z.string(), days: z.number() }),
    previousPeriod: z.object({ from: z.string(), to: z.string() }),
}).passthrough();
export type KpiRangeSummaryRpc = z.infer<typeof KpiRangeSummarySchema>;

// ─── Sales RPCs ─────────────────────────────────────────────────────────────

const SalesHourlyItemSchema = z.object({
    ts_hour: z.string(),
    actual_sales: num,
    actual_orders: num,
    forecast_sales: num,
    forecast_orders: num,
    lower: num,
    upper: num,
}).passthrough();

const SalesDailyItemSchema = z.object({
    date: z.string(),
    actual_sales: num,
    actual_orders: num,
    forecast_sales: num,
    forecast_orders: num,
    lower: num,
    upper: num,
}).passthrough();

export const SalesTimeseriesSchema = z.object({
    data_source: z.string(),
    mode: z.string(),
    reason: z.string(),
    last_synced_at: z.string().nullable(),
    kpis: z.object({
        actual_sales: num,
        forecast_sales: num,
        actual_orders: num,
        forecast_orders: num,
        avg_check_actual: num,
        avg_check_forecast: num,
    }).passthrough(),
    hourly: z.array(SalesHourlyItemSchema),
    daily: z.array(SalesDailyItemSchema),
    busy_hours: z.array(z.object({
        date: z.string(),
        hour: z.number(),
        forecast_sales: num,
    }).passthrough()),
}).passthrough();
export type SalesTimeseriesRpc = z.infer<typeof SalesTimeseriesSchema>;

export const TopProductsSchema = z.object({
    data_source: z.string(),
    mode: z.string(),
    reason: z.string(),
    last_synced_at: z.string().nullable(),
    total_sales: num,
    items: z.array(z.object({
        product_id: z.string(),
        name: z.string(),
        category: z.string().default(''),
        sales: num,
        qty: num,
        share: num,
    }).passthrough()),
}).passthrough();
export type TopProductsRpc = z.infer<typeof TopProductsSchema>{t('data.rpc-contracts.instantPlFlexibleShapeVaries')}<typeof InstantPnlSchema>;

// Menu Engineering — array of product classifications (canonical Kasavana-Smith)
export const MenuEngineeringItemSchema = z.object({
    product_id: z.string().optional(),
    name: z.string(),
    category: z.string().default(''),
    classification: z.string().default(''),
    // Legacy compat fields
    units: num,                    // alias for units_sold
    units_sold: num,
    sales: num,                    // gross sales (VAT-inclusive)
    cogs: num,
    profit_eur: num,               // alias for total_gross_profit
    margin_pct: num,
    profit_per_sale: num,          // alias for unit_gross_profit
    popularity_share: num,         // alias for popularity_pct
    sales_share: num,
    action_tag: z.string().default(''),
    badges: z.array(z.string()).default([]),
    // Canonical Menu Engineering fields
    selling_price_ex_vat: num,
    unit_food_cost: num,
    unit_gross_profit: num,
    total_gross_profit: num,
    popularity_pct: num,
    ideal_average_popularity: num,
    average_gross_profit: num,
    popularity_class: z.string().default(''),
    profitability_class: z.string().default(''),
    classification_reason: z.string().default(''),
    cost_source: z.string().default('unknown'),
    data_confidence: z.string().default('low'),
    is_canonical: z.boolean().default(false),
    // Category-level stats
    item_count: num,
    total_units: num,
    total_sales: num,
    sales_ex_vat: num,
}).passthrough();
export const MenuEngineeringSchema = z.array(MenuEngineeringItemSchema);
export type MenuEngineeringRpc = z.infer<typeof MenuEngineeringSchema>;

// ─── Schema Registry — maps RPC name → schema for automated testing ────────

export const RPC_REGISTRY = {
    get_labour_kpis: LabourKpisSchema,
    get_labour_timeseries: LabourTimeseriesSchema,
    get_labour_locations_table: LabourLocationsSchema,
    rpc_kpi_range_summary: KpiRangeSummarySchema,
    get_sales_timeseries_unified: SalesTimeseriesSchema,
    get_top_products_unified: TopProductsSchema,
    get_instant_pnl_unified: InstantPnlSchema,
    menu_engineering_summary: MenuEngineeringSchema,
} as const;
