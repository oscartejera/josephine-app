/**
 * Data Access Layer — Forecast
 *
 * Reads from `forecast_daily_unified` contract view.
 * getForecastVsActual joins forecast + sales for variance analysis.
 */

import { supabase, assertContext, hasNoLocations, applyFilters, toLegacyDataSource } from './client';
import {
  type QueryContext,
  type DateRange,
  type ForecastDailyRow,
  type ForecastVsActualRow,
} from './types';

// ─── getForecastDaily ───────────────────────────────────────────────────────

export async function getForecastDaily(
  ctx: QueryContext,
  range: DateRange
): Promise<ForecastDailyRow[]> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return [];

  let query = supabase
    .from('forecast_daily_unified' as any)
    .select('org_id, location_id, day, forecast_sales, forecast_orders, planned_labor_hours, planned_labor_cost, forecast_avg_check, forecast_sales_lower, forecast_sales_upper, data_source')
    .order('day', { ascending: true });

  query = applyFilters(query, ctx.locationIds, range, 'day');

  const { data, error } = await query;
  if (error) {
    console.error('[data/forecast] getForecastDaily error:', error.message);
    return [];
  }

  return (data || []).map((r: any) => ({
    orgId: r.org_id,
    locationId: r.location_id,
    day: r.day,
    forecastSales: Number(r.forecast_sales) || 0,
    forecastOrders: Number(r.forecast_orders) || 0,
    plannedLaborHours: Number(r.planned_labor_hours) || 0,
    plannedLaborCost: Number(r.planned_labor_cost) || 0,
    forecastAvgCheck: Number(r.forecast_avg_check) || 0,
    forecastSalesLower: Number(r.forecast_sales_lower) || 0,
    forecastSalesUpper: Number(r.forecast_sales_upper) || 0,
    dataSource: r.data_source,
  }));
}

// ─── getForecastVsActual ────────────────────────────────────────────────────

/**
 * Combines daily forecasts with daily actuals to produce variance rows.
 * Reads `forecast_daily_unified` + `sales_daily_unified`.
 */
export async function getForecastVsActual(
  ctx: QueryContext,
  range: DateRange
): Promise<ForecastVsActualRow[]> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return [];

  const dsLegacy = toLegacyDataSource(ctx.dataSource);

  // Fetch forecast and actual in parallel
  let forecastQ = supabase
    .from('forecast_daily_unified' as any)
    .select('day, forecast_sales, forecast_sales_lower, forecast_sales_upper')
    .order('day', { ascending: true });
  forecastQ = applyFilters(forecastQ, ctx.locationIds, range, 'day');

  let actualQ = supabase
    .from('sales_daily_unified' as any)
    .select('date, net_sales')
    .eq('data_source', dsLegacy)
    .order('date', { ascending: true });
  actualQ = applyFilters(actualQ, ctx.locationIds, range, 'date');

  const [forecastRes, actualRes] = await Promise.all([forecastQ, actualQ]);

  if (forecastRes.error) {
    console.error('[data/forecast] getForecastVsActual forecast error:', forecastRes.error.message);
  }
  if (actualRes.error) {
    console.error('[data/forecast] getForecastVsActual actual error:', actualRes.error.message);
  }

  // Index actuals by day (aggregate across locations)
  const actualsByDay = new Map<string, number>();
  for (const r of (actualRes.data || []) as any[]) {
    const day = r.date;
    actualsByDay.set(day, (actualsByDay.get(day) || 0) + (Number(r.net_sales) || 0));
  }

  // Index forecasts by day (aggregate across locations)
  const forecastsByDay = new Map<string, { sales: number; lower: number; upper: number }>();
  for (const r of (forecastRes.data || []) as any[]) {
    const day = r.day;
    const existing = forecastsByDay.get(day) || { sales: 0, lower: 0, upper: 0 };
    existing.sales += Number(r.forecast_sales) || 0;
    existing.lower += Number(r.forecast_sales_lower) || 0;
    existing.upper += Number(r.forecast_sales_upper) || 0;
    forecastsByDay.set(day, existing);
  }

  // Merge
  const allDays = new Set([...actualsByDay.keys(), ...forecastsByDay.keys()]);
  const result: ForecastVsActualRow[] = [];

  for (const day of [...allDays].sort()) {
    const actual = actualsByDay.get(day) || 0;
    const forecast = forecastsByDay.get(day) || { sales: 0, lower: 0, upper: 0 };
    const variance = actual - forecast.sales;
    result.push({
      day,
      actualSales: actual,
      forecastSales: forecast.sales,
      forecastLower: forecast.lower,
      forecastUpper: forecast.upper,
      varianceEur: variance,
      variancePct: forecast.sales > 0 ? (variance / forecast.sales) * 100 : 0,
    });
  }

  return result;
}
