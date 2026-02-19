/**
 * Data Access Layer — Labour
 *
 * Reads from `labour_daily_unified` contract view.
 */

import { supabase, assertContext, hasNoLocations, applyFilters, toLegacyDataSource } from './client';
import {
  type QueryContext,
  type DateRange,
  type LabourDailyRow,
  type LabourSummary,
  EMPTY_LABOUR_SUMMARY,
} from './types';

// ─── getLabourDaily ─────────────────────────────────────────────────────────

export async function getLabourDaily(
  ctx: QueryContext,
  range: DateRange
): Promise<LabourDailyRow[]> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return [];

  let query = supabase
    .from('labour_daily_unified' as any)
    .select('org_id, location_id, day, actual_hours, actual_cost, scheduled_hours, scheduled_cost, scheduled_headcount, hours_variance, cost_variance, hours_variance_pct')
    .order('day', { ascending: true });

  query = applyFilters(query, ctx.locationIds, range, 'day');

  const { data, error } = await query;
  if (error) {
    console.error('[data/labour] getLabourDaily error:', error.message);
    return [];
  }

  return (data || []).map((r: any) => ({
    orgId: r.org_id,
    locationId: r.location_id,
    day: r.day,
    actualHours: Number(r.actual_hours) || 0,
    actualCost: Number(r.actual_cost) || 0,
    scheduledHours: Number(r.scheduled_hours) || 0,
    scheduledCost: Number(r.scheduled_cost) || 0,
    scheduledHeadcount: Number(r.scheduled_headcount) || 0,
    hoursVariance: Number(r.hours_variance) || 0,
    costVariance: Number(r.cost_variance) || 0,
    hoursVariancePct: Number(r.hours_variance_pct) || 0,
  }));
}

// ─── getLabourSummary ───────────────────────────────────────────────────────

/**
 * Aggregate labour KPIs for the date range.
 * Returns totals + daily breakdown.
 */
export async function getLabourSummary(
  ctx: QueryContext,
  range: DateRange
): Promise<LabourSummary> {
  const daily = await getLabourDaily(ctx, range);
  if (daily.length === 0) return EMPTY_LABOUR_SUMMARY;

  const totalActualHours = daily.reduce((s, r) => s + r.actualHours, 0);
  const totalActualCost = daily.reduce((s, r) => s + r.actualCost, 0);
  const totalScheduledHours = daily.reduce((s, r) => s + r.scheduledHours, 0);
  const totalScheduledCost = daily.reduce((s, r) => s + r.scheduledCost, 0);
  const avgHeadcount = daily.reduce((s, r) => s + r.scheduledHeadcount, 0) / daily.length;

  return {
    totalActualHours,
    totalActualCost,
    totalScheduledHours,
    totalScheduledCost,
    avgHeadcount: Math.round(avgHeadcount * 10) / 10,
    hoursVariancePct: totalScheduledHours > 0
      ? ((totalActualHours - totalScheduledHours) / totalScheduledHours) * 100
      : 0,
    costVariancePct: totalScheduledCost > 0
      ? ((totalActualCost - totalScheduledCost) / totalScheduledCost) * 100
      : 0,
    daily,
  };
}

// ─── RPC Wrappers ───────────────────────────────────────────────────────────

/**
 * Call get_labour_kpis RPC. Returns aggregated labour KPIs.
 */
export async function getLabourKpisRpc(
  ctx: QueryContext,
  range: DateRange,
  locationId?: string | null
): Promise<Record<string, unknown>> {
  assertContext(ctx);

  const { data, error } = await (supabase.rpc as any)('get_labour_kpis', {
    date_from: range.from,
    date_to: range.to,
    selected_location_id: locationId || null,
    p_data_source: toLegacyDataSource(ctx.dataSource),
  });

  if (error) {
    console.error('[data/labour] getLabourKpisRpc error:', error.message);
    throw error;
  }
  return data as Record<string, unknown>;
}

/**
 * Call get_labour_timeseries RPC. Returns daily labour timeseries.
 */
export async function getLabourTimeseriesRpc(
  ctx: QueryContext,
  range: DateRange,
  locationId?: string | null
): Promise<Record<string, unknown>[]> {
  assertContext(ctx);

  const { data, error } = await (supabase.rpc as any)('get_labour_timeseries', {
    date_from: range.from,
    date_to: range.to,
    selected_location_id: locationId || null,
    p_data_source: toLegacyDataSource(ctx.dataSource),
  });

  if (error) {
    console.error('[data/labour] getLabourTimeseriesRpc error:', error.message);
    throw error;
  }
  return (data || []) as Record<string, unknown>[];
}

/**
 * Call get_labour_locations_table RPC. Returns per-location labour breakdown.
 */
export async function getLabourLocationsRpc(
  ctx: QueryContext,
  range: DateRange,
  locationId?: string | null
): Promise<Record<string, unknown>[]> {
  assertContext(ctx);

  const { data, error } = await (supabase.rpc as any)('get_labour_locations_table', {
    date_from: range.from,
    date_to: range.to,
    selected_location_id: locationId || null,
    p_data_source: toLegacyDataSource(ctx.dataSource),
  });

  if (error) {
    console.error('[data/labour] getLabourLocationsRpc error:', error.message);
    throw error;
  }
  return (data || []) as Record<string, unknown>[];
}

/**
 * Call get_labor_plan_unified RPC.
 * Returns workforce planning data: metadata, hourly array, daily array, and flags.
 */
export async function getLaborPlanRpc(
  ctx: QueryContext,
  range: DateRange
): Promise<Record<string, unknown> | null> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return null;

  const { data, error } = await (supabase.rpc as any)('get_labor_plan_unified', {
    p_org_id: ctx.orgId,
    p_location_ids: ctx.locationIds,
    p_from: range.from,
    p_to: range.to,
  });

  if (error) {
    console.error('[data/labour] getLaborPlanRpc error:', error.message);
    return null;
  }

  return data as Record<string, unknown> | null;
}
