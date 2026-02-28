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
 * Normalise any data source value to the canonical 'pos' | 'demo'.
 */
export function normaliseDataSource(ds: string): 'pos' | 'demo' {
  return ds === 'pos' ? 'pos' : 'demo';
}

/**
 * @deprecated Use normaliseDataSource. Kept for backward compatibility.
 * Now returns 'demo' (not the old 'simulated') to match DB values.
 */
export const toLegacyDataSource = normaliseDataSource;

/**
 * Build a QueryContext from the typical AppContext + AuthContext values.
 * This is the bridge between React context and the data layer.
 */
export function buildQueryContext(
  orgId: string | null | undefined,
  locationIds: string[],
  dataSource: 'pos' | 'demo'
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
