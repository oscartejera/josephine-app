/**
 * Data Access Layer — Guarded Client Helpers
 *
 * Thin wrappers around the Supabase client that enforce invariants:
 *   1. org_id must be present (throws MissingOrgIdError)
 *   2. empty locationIds → returns early with empty data
 *   3. data_source is normalised to 'pos' | 'demo'
 */

import { supabase } from '@/integrations/supabase/client';
import { type QueryContext, type DateRange, MissingOrgIdError, NoLocationsError } from './types';

// Re-export the raw client for edge cases (auth, profiles, realtime)
export { supabase };

/** Validate context before any data query. Throws on missing org_id. */
export function assertContext(ctx: QueryContext): void {
  if (!ctx.orgId) {
    throw new MissingOrgIdError();
  }
}

/** Returns true if the context has no locations, meaning we should return empty data. */
export function hasNoLocations(ctx: QueryContext): boolean {
  return !ctx.locationIds || ctx.locationIds.length === 0;
}

/**
 * Normalise the AppContext dataSource ('pos' | 'simulated') to the DB value ('pos' | 'demo').
 * The unified views use 'simulated' as data_source; the v_*_unified views expose 'demo'|'pos'.
 * Our new contract views inherit from the base tables, so we map accordingly.
 */
export function normaliseLegacyDataSource(ds: string): 'pos' | 'demo' {
  return ds === 'pos' ? 'pos' : 'demo';
}

/**
 * Map the data source to the legacy "simulated" value used in base tables
 * (pos_daily_finance.data_source, pos_daily_metrics.data_source, etc.)
 */
export function toLegacyDataSource(ds: string): string {
  return ds === 'pos' ? 'pos' : 'simulated';
}

/**
 * Build a QueryContext from the typical AppContext + AuthContext values.
 * This is the bridge between React context and the data layer.
 */
export function buildQueryContext(
  orgId: string | null | undefined,
  locationIds: string[],
  dataSource: 'pos' | 'simulated' | 'demo'
): QueryContext {
  return {
    orgId: orgId || '',
    locationIds,
    dataSource: dataSource === 'pos' ? 'pos' : 'demo',
  };
}

/**
 * Apply standard location + date filters to a Supabase query builder.
 * Works with any table that has `location_id` and a date column.
 */
export function applyFilters<T extends { eq: any; in: any; gte: any; lte: any }>(
  query: T,
  locationIds: string[],
  range: DateRange,
  dateColumn = 'day'
): T {
  if (locationIds.length === 1) {
    query = query.eq('location_id', locationIds[0]);
  } else if (locationIds.length > 1) {
    query = query.in('location_id', locationIds);
  }
  query = query.gte(dateColumn, range.from).lte(dateColumn, range.to);
  return query;
}
