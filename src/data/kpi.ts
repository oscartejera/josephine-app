/**
 * Data Access Layer — KPI Contract
 *
 * Reads from `mart_kpi_daily` view and `rpc_kpi_range_summary` RPC.
 * Single source of truth for dashboard, sales, P&L, and all KPI cards.
 */

import { supabase, assertContext, hasNoLocations } from './client';
import { type QueryContext, type KpiRangeSummary } from './types';

/**
 * Get aggregated KPIs for a date range with automatic previous period comparison.
 * Calls `rpc_kpi_range_summary` which reads from `mart_kpi_daily`.
 */
export async function getKpiRangeSummary(
  ctx: QueryContext,
  from: string,
  to: string
): Promise<KpiRangeSummary> {
  assertContext(ctx);

  const { data, error } = await (supabase.rpc as any)('rpc_kpi_range_summary', {
    p_org_id: ctx.orgId,
    p_location_ids: ctx.locationIds?.length ? ctx.locationIds : null,
    p_from: from,
    p_to: to,
  });

  if (error) {
    console.error('[data/kpi] getKpiRangeSummary error:', error.message);
    throw error;
  }

  return data as KpiRangeSummary;
}

/**
 * Get daily KPI rows from mart_kpi_daily for timeseries/P&L usage.
 */
export async function getKpiDaily(
  ctx: QueryContext,
  from: string,
  to: string
): Promise<any[]> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return [];

  let query = supabase
    .from('mart_kpi_daily' as any)
    .select('*')
    .eq('org_id', ctx.orgId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });

  if (ctx.locationIds.length === 1) {
    query = query.eq('location_id', ctx.locationIds[0]);
  } else if (ctx.locationIds.length > 1) {
    query = query.in('location_id', ctx.locationIds);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[data/kpi] getKpiDaily error:', error.message);
    return [];
  }

  return data || [];
}
