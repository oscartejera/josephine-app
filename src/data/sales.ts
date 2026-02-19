/**
 * Data Access Layer — Sales
 *
 * All sales reads go through the `sales_daily_unified` and
 * `sales_hourly_unified` contract views created in migration 01/02.
 */

import { supabase, assertContext, hasNoLocations, applyFilters, toLegacyDataSource } from './client';
import {
  type QueryContext,
  type DateRange,
  type DashboardKpis,
  type SalesDailyRow,
  type SalesHourlyRow,
  type ProductSalesDailyRow,
  type SalesTimeseriesRpcResult,
  type TopProductsRpcResult,
  EMPTY_DASHBOARD_KPIS,
} from './types';

// ─── getDashboardKpis ───────────────────────────────────────────────────────

/**
 * Aggregate sales KPIs for the given date range and locations.
 * Reads from `sales_daily_unified` (contract view).
 */
export async function getDashboardKpis(
  ctx: QueryContext,
  range: DateRange
): Promise<DashboardKpis> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return EMPTY_DASHBOARD_KPIS;

  const dsLegacy = toLegacyDataSource(ctx.dataSource);

  let query = supabase
    .from('sales_daily_unified' as any)
    .select('net_sales, gross_sales, orders_count, avg_check, payments_cash, payments_card, payments_other, refunds_amount, discounts_amount, comps_amount, voids_amount, labor_cost, labor_hours')
    .eq('data_source', dsLegacy);

  query = applyFilters(query, ctx.locationIds, range, 'date');

  const { data, error } = await query;
  if (error) {
    console.error('[data/sales] getDashboardKpis error:', error.message);
    return EMPTY_DASHBOARD_KPIS;
  }

  const rows = (data || []) as any[];
  if (rows.length === 0) return EMPTY_DASHBOARD_KPIS;

  const kpis: DashboardKpis = {
    sales: rows.reduce((s, r) => s + (Number(r.net_sales) || 0), 0),
    grossSales: rows.reduce((s, r) => s + (Number(r.gross_sales) || 0), 0),
    ordersCount: rows.reduce((s, r) => s + (Number(r.orders_count) || 0), 0),
    avgCheck: 0,
    laborCost: rows.reduce((s, r) => s + (Number(r.labor_cost) || 0), 0),
    laborHours: rows.reduce((s, r) => s + (Number(r.labor_hours) || 0), 0),
    paymentsCash: rows.reduce((s, r) => s + (Number(r.payments_cash) || 0), 0),
    paymentsCard: rows.reduce((s, r) => s + (Number(r.payments_card) || 0), 0),
    paymentsOther: rows.reduce((s, r) => s + (Number(r.payments_other) || 0), 0),
    refundsAmount: rows.reduce((s, r) => s + (Number(r.refunds_amount) || 0), 0),
    discountsAmount: rows.reduce((s, r) => s + (Number(r.discounts_amount) || 0), 0),
    compsAmount: rows.reduce((s, r) => s + (Number(r.comps_amount) || 0), 0),
    voidsAmount: rows.reduce((s, r) => s + (Number(r.voids_amount) || 0), 0),
  };
  kpis.avgCheck = kpis.ordersCount > 0 ? kpis.sales / kpis.ordersCount : 0;

  return kpis;
}

// ─── getSalesTrends ─────────────────────────────────────────────────────────

/**
 * Daily or hourly sales trends for charting.
 * - granularity 'daily' reads `sales_daily_unified`
 * - granularity 'hourly' reads `sales_hourly_unified`
 */
export async function getSalesTrends(
  ctx: QueryContext,
  range: DateRange,
  granularity: 'daily' | 'hourly' = 'daily'
): Promise<SalesDailyRow[] | SalesHourlyRow[]> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return [];

  if (granularity === 'hourly') {
    return getSalesHourlyTrends(ctx, range);
  }

  const dsLegacy = toLegacyDataSource(ctx.dataSource);

  let query = supabase
    .from('sales_daily_unified' as any)
    .select('org_id, location_id, date, net_sales, gross_sales, orders_count, avg_check, payments_cash, payments_card, payments_other, refunds_amount, refunds_count, discounts_amount, comps_amount, voids_amount, labor_cost, labor_hours, data_source')
    .eq('data_source', dsLegacy)
    .order('date', { ascending: true });

  query = applyFilters(query, ctx.locationIds, range, 'date');

  const { data, error } = await query;
  if (error) {
    console.error('[data/sales] getSalesTrends error:', error.message);
    return [];
  }

  return (data || []).map((r: any) => ({
    orgId: r.org_id,
    locationId: r.location_id,
    day: r.date,
    netSales: Number(r.net_sales) || 0,
    grossSales: Number(r.gross_sales) || 0,
    ordersCount: Number(r.orders_count) || 0,
    avgCheck: Number(r.avg_check) || 0,
    paymentsCash: Number(r.payments_cash) || 0,
    paymentsCard: Number(r.payments_card) || 0,
    paymentsOther: Number(r.payments_other) || 0,
    refundsAmount: Number(r.refunds_amount) || 0,
    refundsCount: Number(r.refunds_count) || 0,
    discountsAmount: Number(r.discounts_amount) || 0,
    compsAmount: Number(r.comps_amount) || 0,
    voidsAmount: Number(r.voids_amount) || 0,
    laborCost: Number(r.labor_cost) || 0,
    laborHours: Number(r.labor_hours) || 0,
    dataSource: r.data_source,
  }));
}

// ─── getProductSalesDaily ───────────────────────────────────────────────────

/**
 * Product-level daily sales from `product_sales_daily_unified` contract view.
 * Returns per-product rows with name, category, COGS, and margin.
 */
export async function getProductSalesDaily(
  ctx: QueryContext,
  range: DateRange
): Promise<ProductSalesDailyRow[]> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return [];

  const dsLegacy = toLegacyDataSource(ctx.dataSource);

  let query = supabase
    .from('product_sales_daily_unified' as any)
    .select('org_id, location_id, day, product_id, product_name, product_category, units_sold, net_sales, cogs, gross_profit, margin_pct, data_source')
    .eq('data_source', dsLegacy)
    .order('day', { ascending: true });

  query = applyFilters(query, ctx.locationIds, range, 'day');

  const { data, error } = await query;
  if (error) {
    console.error('[data/sales] getProductSalesDaily error:', error.message);
    return [];
  }

  return (data || []).map((r: any) => ({
    orgId: r.org_id,
    locationId: r.location_id,
    day: r.day,
    productId: r.product_id,
    productName: r.product_name || 'Unknown',
    productCategory: r.product_category || 'Other',
    unitsSold: Number(r.units_sold) || 0,
    netSales: Number(r.net_sales) || 0,
    cogs: Number(r.cogs) || 0,
    grossProfit: Number(r.gross_profit) || 0,
    marginPct: Number(r.margin_pct) || 0,
    dataSource: r.data_source,
  }));
}

// ─── getSalesHourlyTrends (internal) ────────────────────────────────────────

async function getSalesHourlyTrends(
  ctx: QueryContext,
  range: DateRange
): Promise<SalesHourlyRow[]> {
  let query = supabase
    .from('sales_hourly_unified' as any)
    .select('org_id, location_id, day, hour_bucket, hour_of_day, net_sales, gross_sales, orders_count, covers, avg_check, discounts, refunds, data_source')
    .order('hour_bucket', { ascending: true });

  query = applyFilters(query, ctx.locationIds, range, 'day');

  const { data, error } = await query;
  if (error) {
    console.error('[data/sales] getSalesHourlyTrends error:', error.message);
    return [];
  }

  return (data || []).map((r: any) => ({
    orgId: r.org_id,
    locationId: r.location_id,
    day: r.day,
    hourBucket: r.hour_bucket,
    hourOfDay: Number(r.hour_of_day) || 0,
    netSales: Number(r.net_sales) || 0,
    grossSales: Number(r.gross_sales) || 0,
    ordersCount: Number(r.orders_count) || 0,
    covers: Number(r.covers) || 0,
    avgCheck: Number(r.avg_check) || 0,
    discounts: Number(r.discounts) || 0,
    refunds: Number(r.refunds) || 0,
    dataSource: r.data_source,
  }));
}

// ─── RPC Wrappers ───────────────────────────────────────────────────────────

/**
 * Call get_sales_timeseries_unified RPC.
 * Resolves data source server-side via resolve_data_source(org_id).
 */
export async function getSalesTimeseriesRpc(
  ctx: QueryContext,
  range: DateRange
): Promise<SalesTimeseriesRpcResult | null> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return null;

  const { data, error } = await (supabase.rpc as any)('get_sales_timeseries_unified', {
    p_org_id: ctx.orgId,
    p_location_ids: ctx.locationIds,
    p_from: range.from,
    p_to: range.to,
  });

  if (error) {
    console.error('[data/sales] getSalesTimeseriesRpc error:', error.message);
    throw error;
  }

  return data as SalesTimeseriesRpcResult | null;
}

/**
 * Call get_top_products_unified RPC.
 * Resolves data source server-side via resolve_data_source(org_id).
 */
export async function getTopProductsRpc(
  ctx: QueryContext,
  range: DateRange,
  limit = 20
): Promise<TopProductsRpcResult | null> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return null;

  const { data, error } = await (supabase.rpc as any)('get_top_products_unified', {
    p_org_id: ctx.orgId,
    p_location_ids: ctx.locationIds,
    p_from: range.from,
    p_to: range.to,
    p_limit: limit,
  });

  if (error) {
    console.error('[data/sales] getTopProductsRpc error:', error.message);
    throw error;
  }

  return data as TopProductsRpcResult | null;
}

/**
 * Call get_instant_pnl_unified RPC.
 * Returns per-location P&L snapshot with sales, labour, COGS estimation flags.
 */
export async function getInstantPnlRpc(
  ctx: QueryContext,
  range: DateRange
): Promise<Record<string, unknown> | null> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return null;

  const { data, error } = await (supabase.rpc as any)('get_instant_pnl_unified', {
    p_org_id: ctx.orgId,
    p_location_ids: ctx.locationIds,
    p_from: range.from,
    p_to: range.to,
  });

  if (error) {
    console.error('[data/sales] getInstantPnlRpc error:', error.message);
    throw error;
  }

  return data as Record<string, unknown> | null;
}

/**
 * Call menu_engineering_summary RPC.
 * Returns product classification (star/plow_horse/puzzle/dog) with margin and popularity.
 */
export async function getMenuEngineeringSummaryRpc(
  ctx: QueryContext,
  range: DateRange,
  locationId?: string | null
): Promise<Record<string, unknown>[]> {
  assertContext(ctx);

  const { data, error } = await (supabase.rpc as any)('menu_engineering_summary', {
    p_date_from: range.from,
    p_date_to: range.to,
    p_location_id: locationId || null,
    p_data_source: ctx.dataSource,
  });

  if (error) {
    console.error('[data/sales] getMenuEngineeringSummaryRpc error:', error.message);
    throw error;
  }

  return (data || []) as Record<string, unknown>[];
}
