/**
 * Data Access Layer — Labour
 *
 * RPC wrappers for labour insights.
 * All functions use typedRpc for compile-time + runtime type safety.
 */

import { assertContext, hasNoLocations, toLegacyDataSource } from './client';
import { typedRpc } from './typed-rpc';
import { LabourKpisSchema, LabourTimeseriesSchema, LabourLocationsSchema } from './rpc-contracts';
import { InstantPnlSchema } from './rpc-contracts';
import { type QueryContext, type DateRange } from './types';

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

  return typedRpc('get_labour_kpis', LabourKpisSchema, {
    date_from: range.from,
    date_to: range.to,
    selected_location_id: locationId || null,
    p_data_source: toLegacyDataSource(ctx.dataSource),
  });
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

  return typedRpc('get_labour_timeseries', LabourTimeseriesSchema, {
    date_from: range.from,
    date_to: range.to,
    selected_location_id: locationId || null,
    p_data_source: toLegacyDataSource(ctx.dataSource),
  });
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

  return typedRpc('get_labour_locations_table', LabourLocationsSchema, {
    date_from: range.from,
    date_to: range.to,
    selected_location_id: locationId || null,
    p_data_source: toLegacyDataSource(ctx.dataSource),
  });
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

  return typedRpc('get_labor_plan_unified', InstantPnlSchema, {
    p_org_id: ctx.orgId,
    p_location_ids: ctx.locationIds,
    p_from: range.from,
    p_to: range.to,
  });
}
