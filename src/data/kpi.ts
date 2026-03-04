/**
 * Data Access Layer — KPI Contract
 *
 * Reads from `mart_kpi_daily` view and `rpc_kpi_range_summary` RPC.
 * Single source of truth for dashboard, sales, P&L, and all KPI cards.
 */

import { supabase, assertContext, hasNoLocations, typedFrom } from './client';
import { typedRpc } from './typed-rpc';
import { KpiRangeSummarySchema } from './rpc-contracts';
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

  const data = await typedRpc('rpc_kpi_range_summary', KpiRangeSummarySchema, {
    p_org_id: ctx.orgId,
    p_location_ids: ctx.locationIds?.length ? ctx.locationIds : null,
    p_from: from,
    p_to: to,
  });

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

  let query = typedFrom('mart_kpi_daily')
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
